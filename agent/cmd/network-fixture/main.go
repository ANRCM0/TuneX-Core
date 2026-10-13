// network-fixture supplies isolated Linux loopback peers for acceptance; it is not an Agent driver.
package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net"
	"os"
	"os/signal"
	"runtime"
	"sort"
	"syscall"
	"time"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
func run() error {
	mode := flag.String("mode", "", "target or probe")
	port := flag.Int("port", 0, "Loopback Agent port for probe")
	runID := flag.String("run-id", "", "Acceptance run identity for target cleanup")
	udpOnly := flag.Bool("udp-only", false, "Probe only UDP")
	tcpOnly := flag.Bool("tcp-only", false, "Probe only TCP")
	tcpClients := flag.Int("tcp-clients", 64, "Bounded TCP clients for load")
	udpClients := flag.Int("udp-clients", 32, "Bounded UDP clients for load")
	seconds := flag.Int("seconds", 3, "Bounded load duration")
	payload := flag.Int("payload-bytes", 1024, "Bounded verified payload size")
	relayCA := flag.String("relay-ca", "", "Trusted Relay CA for a negative probe")
	relayCert := flag.String("relay-cert", "", "Machine-only credential used by the negative probe")
	relayKey := flag.String("relay-key", "", "Protected fixture key path")
	relayNode := flag.String("relay-node", "", "Expected peer Node")
	relayPin := flag.String("relay-pin", "", "Expected peer fingerprint")
	relayOpen := flag.String("relay-open", "", "Strict current deployment Open fixture")
	oldTLS := flag.Bool("tls12", false, "Attempt unsupported TLS 1.2 on Relay listener")
	tag := flag.String("tag", "", "Bounded target identity tag or expected probe tag")
	nextTag := flag.String("next-tag", "", "Successor tag for a UDP route monitor")
	flag.Parse()
	if len(*tag) > 32 || len(*nextTag) > 32 {
		return fmt.Errorf("Bounded fixture tag required")
	}
	if *mode == "relay-negative" && *port > 0 && *port <= 65535 {
		return relayNegative(*port, *relayCA, *relayCert, *relayKey, *relayNode, *relayPin, *relayOpen, *oldTLS)
	}
	if *mode == "load" && *port > 0 && *port <= 65535 {
		return load(*port, *tcpClients, *udpClients, *seconds, *payload)
	}
	if *mode == "target" {
		return target(*runID, *tag)
	}
	if *mode == "port" {
		listener, err := net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			return err
		}
		defer listener.Close()
		return json.NewEncoder(os.Stdout).Encode(map[string]any{"port": listener.Addr().(*net.TCPAddr).Port, "platform": runtime.GOOS})
	}
	if *mode == "probe" && *port > 0 && *port <= 65535 {
		if *udpOnly && *tcpOnly {
			return fmt.Errorf("Select only one probe protocol")
		}
		return probe(*port, *udpOnly, *tcpOnly, *tag)
	}
	if *mode == "monitor" && *port > 0 && *port <= 65535 {
		return monitor(*port, *tag)
	}
	if *mode == "udp-route-monitor" && *port > 0 && *port <= 65535 {
		return udpRouteMonitor(*port, *tag, *nextTag)
	}
	if *mode == "occupy-udp" && *port > 0 && *port <= 65535 {
		return occupyUDP(*port, *runID)
	}
	return fmt.Errorf("target or probe with valid port required")
}
func sortLatency(values []int64) {
	sort.Slice(values, func(i, j int) bool { return values[i] < values[j] })
}
func target(runID, tag string) error {
	tcp, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return err
	}
	defer tcp.Close()
	port := tcp.Addr().(*net.TCPAddr).Port
	udp, err := net.ListenUDP("udp", &net.UDPAddr{IP: net.ParseIP("127.0.0.1"), Port: port})
	if err != nil {
		return err
	}
	defer udp.Close()
	context, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	go func() {
		for {
			socket, err := tcp.Accept()
			if err != nil {
				return
			}
			go func() {
				defer socket.Close()
				socket.SetDeadline(time.Now().Add(30 * time.Second))
				if len(tag) > 0 {
					if _, err := socket.Write([]byte(tag)); err != nil {
						return
					}
				}
				io.Copy(socket, socket)
			}()
		}
	}()
	go func() {
		payload := make([]byte, 16384)
		for {
			n, client, err := udp.ReadFromUDP(payload)
			if err != nil {
				return
			}
			udp.WriteToUDP(append([]byte(tag), payload[:n]...), client)
		}
	}()
	json.NewEncoder(os.Stdout).Encode(map[string]any{"port": port, "platform": runtime.GOOS, "pid": os.Getpid(), "runId": runID, "tag": tag})
	<-context.Done()
	return nil
}
func probe(port int, udpOnly, tcpOnly bool, tag string) error {
	payload := make([]byte, 256)
	if _, err := rand.Read(payload); err != nil {
		return err
	}
	if !udpOnly {
		socket, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", port), 5*time.Second)
		if err != nil {
			return err
		}
		defer socket.Close()
		socket.SetDeadline(time.Now().Add(5 * time.Second))
		if _, err := socket.Write(payload); err != nil {
			return err
		}
		if tcp, ok := socket.(*net.TCPConn); ok {
			tcp.CloseWrite()
		}
		reply, err := io.ReadAll(socket)
		if err != nil {
			return err
		}
		if string(reply) != tag+string(payload) {
			return fmt.Errorf("TCP payload mismatch")
		}
	}
	if tcpOnly {
		checksum := sha256.Sum256(payload)
		return json.NewEncoder(os.Stdout).Encode(map[string]any{"tcp": true, "udp": false, "payloadSHA": hex.EncodeToString(checksum[:]), "tag": tag})
	}
	udp, err := net.DialTimeout("udp", fmt.Sprintf("127.0.0.1:%d", port), 5*time.Second)
	if err != nil {
		return err
	}
	defer udp.Close()
	udp.SetDeadline(time.Now().Add(5 * time.Second))
	if _, err := udp.Write(payload); err != nil {
		return err
	}
	data := make([]byte, 1024)
	n, err := udp.Read(data)
	if err != nil {
		return err
	}
	if string(data[:n]) != tag+string(payload) {
		return fmt.Errorf("UDP payload mismatch")
	}
	checksum := sha256.Sum256(payload)
	return json.NewEncoder(os.Stdout).Encode(map[string]any{"tcp": !udpOnly, "udp": true, "payloadSHA": hex.EncodeToString(checksum[:]), "tag": tag})
}
func monitor(port int, tag string) error {
	socket, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", port), 5*time.Second)
	if err != nil {
		return err
	}
	defer socket.Close()
	socket.SetDeadline(time.Now().Add(3 * time.Second))
	header := make([]byte, len(tag))
	if _, err := io.ReadFull(socket, header); err != nil || string(header) != tag {
		return fmt.Errorf("Held TCP target identity differs")
	}
	started := time.Now()
	json.NewEncoder(os.Stdout).Encode(map[string]any{"connected": true, "pid": os.Getpid(), "tag": tag})
	verified := 0
	for {
		socket.SetDeadline(time.Now().Add(2 * time.Second))
		if _, err := socket.Write([]byte("held")); err != nil {
			break
		}
		reply := make([]byte, 4)
		if _, err := io.ReadFull(socket, reply); err != nil {
			break
		}
		if string(reply) != "held" {
			return fmt.Errorf("held stream payload mismatch")
		}
		verified++
		json.NewEncoder(os.Stdout).Encode(map[string]any{"verified": verified, "tag": tag})
		time.Sleep(200 * time.Millisecond)
	}
	return json.NewEncoder(os.Stdout).Encode(map[string]any{"ended": true, "elapsedMs": time.Since(started).Milliseconds(), "verified": verified, "tag": tag})
}
