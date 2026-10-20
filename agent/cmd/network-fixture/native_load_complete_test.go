package main

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"
)

// These are real loopback fixture peers. They do not stand in for an Agent,
// namespaces, physical hosts, authorization cutoff or a production route change.
func fixtureLoadCompletePeers(t *testing.T, mode string) (int, func()) {
	t.Helper()
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	udp, err := net.ListenUDP("udp4", &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1), Port: port})
	if err != nil {
		listener.Close()
		t.Fatal(err)
	}
	var workers sync.WaitGroup
	var sockets sync.Map
	workers.Add(2)
	go func() {
		defer workers.Done()
		for {
			connection, err := listener.Accept()
			if err != nil {
				return
			}
			sockets.Store(connection, true)
			workers.Add(1)
			go func() {
				defer workers.Done()
				defer sockets.Delete(connection)
				defer connection.Close()
				buffer := make([]byte, 64)
				round := 0
				for {
					if _, err := io.ReadFull(connection, buffer); err != nil {
						return
					}
					round++
					if round > 1 && mode == "cutoff" {
						return
					}
					reply := append([]byte(nil), buffer...)
					if round > 1 && mode == "corruption" {
						reply[len(reply)-1] ^= 1
					}
					if _, err := connection.Write(reply); err != nil {
						return
					}
				}
			}()
		}
	}()
	go func() {
		defer workers.Done()
		buffer := make([]byte, 4097)
		for {
			n, peer, err := udp.ReadFromUDP(buffer)
			if err != nil {
				return
			}
			if n != 64 {
				continue
			}
			sequence := binary.BigEndian.Uint64(buffer[8:16])
			if sequence > 1 && mode == "cutoff" {
				continue
			}
			reply := buffer[:n]
			if sequence > 1 && mode == "corruption" {
				reply = reply[:n-1]
			}
			udp.WriteToUDP(reply, peer)
		}
	}()
	return port, func() {
		listener.Close()
		udp.Close()
		sockets.Range(func(key, value any) bool { key.(net.Conn).Close(); return true })
		workers.Wait()
	}
}

func fixtureCaptureComplete(t *testing.T, operation func() error) (error, []map[string]any) {
	t.Helper()
	file, err := os.CreateTemp(t.TempDir(), "stdout-*.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	old := os.Stdout
	os.Stdout = file
	defer func() { os.Stdout = old; file.Close() }()
	result := operation()
	if _, err := file.Seek(0, 0); err != nil {
		t.Fatal(err)
	}
	decoder := json.NewDecoder(file)
	var records []map[string]any
	for {
		var record map[string]any
		err := decoder.Decode(&record)
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatal("fixture emitted invalid JSON", err)
		}
		records = append(records, record)
	}
	return result, records
}

func TestNetworkFixtureCompleteActualLoadPayloadAccountingCutoffAndCorruption(t *testing.T) {
	for _, mode := range []string{"success", "cutoff", "corruption"} {
		t.Run(mode, func(t *testing.T) {
			port, closePeers := fixtureLoadCompletePeers(t, mode)
			defer closePeers()
			seconds := 1
			cutoff := mode != "success"
			if cutoff {
				seconds = 5
			}
			err, records := fixtureCaptureComplete(t, func() error { return load(port, 1, 1, seconds, 64, "actual-fixture-run", cutoff, 10, cutoff) })
			if mode == "corruption" {
				if err == nil || err.Error() != "payload corruption is never an expected cutoff" {
					t.Fatal("fixture credited corrupt bytes as cutoff", err)
				}
				if len(records) == 0 || records[0]["running"] != true {
					t.Fatal("original load startup progress missing")
				}
				return
			}
			if err != nil {
				t.Fatal("native fixture load", mode, err)
			}
			if len(records) == 0 {
				t.Fatal("load did not emit result")
			}
			last := records[len(records)-1]
			if last["completed"] != true || last["expectedCutoff"] != cutoff || last["tcpClients"] != float64(1) || last["udpClients"] != float64(1) || last["payloadBytes"] != float64(64) {
				t.Fatal("original load result contract changed", last)
			}
			count := last["verifiedReplies"].(float64)
			if count < 2 || last["verifiedBidirectionalBytes"] != count*128 || last["sampledLatencies"] != count {
				t.Fatal("load counted unverified/carrier bytes", last)
			}
			clients := last["clients"].([]any)
			if len(clients) != 2 {
				t.Fatal("load lost client observations")
			}
			for index, value := range clients {
				client := value.(map[string]any)
				protocol := "tcp"
				if index == 1 {
					protocol = "udp"
				}
				if client["protocol"] != protocol || client["verified"].(float64) < 1 || client["closedAt"] == nil || client["lastVerifiedAt"] == nil {
					t.Fatal("per-client native verification/cleanup projection changed", client)
				}
				if cutoff && client["failure"] == nil {
					t.Fatal("expected cutoff did not observe every client failure")
				}
			}
			quantiles := last["roundTripMicroseconds"].(map[string]any)
			if quantiles["p50"].(float64) > quantiles["p95"].(float64) || quantiles["p95"].(float64) > quantiles["p99"].(float64) || last["bytesPerSecond"].(float64) <= 0 {
				t.Fatal("quantile/throughput projection changed")
			}
			if cutoff && last["errors"] != float64(2) {
				t.Fatal("cutoff errors are not per-client", last)
			}
		})
	}
}

func TestNetworkFixtureCompleteLoadBoundsClassifiersAndQuantileSource(t *testing.T) {
	valid := []int{1, 1, 1, 64, 0}
	for index, invalid := range map[int][]int{0: {0, 257}, 1: {0, 257}, 2: {0, 181}, 3: {63, 4097}, 4: {-1, 1001}} {
		for _, value := range invalid {
			args := append([]int(nil), valid...)
			args[index] = value
			if err := load(0, args[0], args[1], args[2], args[3], "", false, args[4], false); err == nil || err.Error() != "bounded load parameters required" {
				t.Fatal("fixture bounds moved after socket effects", index, value, err)
			}
		}
	}
	if err := load(0, 1, 1, 1, 64, "", false, 0, true); err == nil || err.Error() != "bounded load parameters required" {
		t.Fatal("cutoff without progress accepted", err)
	}
	for _, v := range []struct {
		err  error
		want string
	}{{nil, "payload-mismatch"}, {fmt.Errorf("wrapped: %w", io.EOF), "eof"}, {fmt.Errorf("wrapped: %w", net.ErrClosed), "closed"}, {errors.New("opaque"), "io-error"}, {&net.OpError{Op: "read", Net: "tcp", Err: os.ErrDeadlineExceeded}, "timeout"}} {
		if got := classifyLoadError(v.err); got != v.want {
			t.Fatal("native failure classifier changed", got, v.want)
		}
	}
	values := []int64{90, -2, 30, 30, 0}
	sortLatency(values)
	if !reflect.DeepEqual(values, []int64{-2, 0, 30, 30, 90}) {
		t.Fatal("native stable numeric latency order changed", values)
	}
	port, cleanup := fixtureLoadCompletePeers(t, "corruption")
	defer cleanup()
	err, records := fixtureCaptureComplete(t, func() error { return load(port, 1, 1, 2, 64, "", false, 0, false) })
	if err == nil || !strings.HasPrefix(err.Error(), "load failed:") {
		t.Fatal("unexpected error suppressed", err)
	}
	if len(records) != 1 || records[0]["completed"] != false || records[0]["reason"] != "unexpected-client-failure" {
		t.Fatal("failure artifact missing", records)
	}
	if raw, err := json.Marshal(records); err != nil || bytes.Contains(raw, []byte("payloadSHA")) {
		t.Fatal("load artifact unexpectedly exposed payload digest", err)
	}
}

func TestNetworkFixtureCompleteLoadRealFailureClosesEarlierSocket(t *testing.T) {
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	accepted := make(chan net.Conn, 1)
	go func() {
		socket, err := listener.Accept()
		if err == nil {
			accepted <- socket
			listener.Close()
		}
	}()
	// UDP port -1 is deliberately not used to manufacture a later failure: the
	// production function takes one shared port. Exact later-dial cleanup is
	// exercised by the original-source collaborator fixture, not scheduler races.
	err = load(listener.Addr().(*net.TCPAddr).Port, 1, 1, 1, 64, "", true, 0, true)
	select {
	case socket := <-accepted:
		defer socket.Close()
		socket.SetReadDeadline(time.Now().Add(time.Second))
		raw := make([]byte, 128)
		for {
			_, readErr := socket.Read(raw)
			if readErr != nil {
				if network, ok := readErr.(net.Error); ok && network.Timeout() {
					t.Fatal("completed native load retained TCP socket")
				}
				break
			}
		}
	case <-time.After(time.Second):
		t.Fatal("native load never opened first socket")
	}
	if err == nil {
		t.Fatal("fixture without any echo unexpectedly succeeded")
	}
}
