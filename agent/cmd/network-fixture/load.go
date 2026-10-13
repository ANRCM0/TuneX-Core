package main

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"os"
	"sync"
	"sync/atomic"
	"time"
)

func load(port, tcpCount, udpCount, seconds, size int, runID string, progress bool, interval int, expectCutoff bool) error {
	if tcpCount < 1 || tcpCount > 256 || udpCount < 1 || udpCount > 256 || seconds < 1 || seconds > 180 || size < 64 || size > 4096 || interval < 0 || interval > 1000 || expectCutoff && !progress {
		return fmt.Errorf("bounded load parameters required")
	}
	sockets := []net.Conn{}
	for i := 0; i < tcpCount+udpCount; i++ {
		protocol := "tcp"
		if i >= tcpCount {
			protocol = "udp"
		}
		socket, err := net.DialTimeout(protocol, fmt.Sprintf("127.0.0.1:%d", port), 5*time.Second)
		if err != nil {
			for _, s := range sockets {
				s.Close()
			}
			return err
		}
		sockets = append(sockets, socket)
	}
	defer func() {
		for _, socket := range sockets {
			socket.Close()
		}
	}()
	loadContext, cancel := context.WithTimeout(context.Background(), time.Duration(seconds)*time.Second)
	defer cancel()
	started := time.Now()
	var completed atomic.Uint64
	var transferred atomic.Uint64
	var mutex sync.Mutex
	latencies := []int64{}
	failures := []string{}
	clients := make([]map[string]any, len(sockets))
	for index := range clients {
		protocol := "tcp"
		if index >= tcpCount {
			protocol = "udp"
		}
		clients[index] = map[string]any{"protocol": protocol, "verified": uint64(0)}
	}
	invalidPayload := false
	encoder := json.NewEncoder(os.Stdout)
	if progress {
		if err := encoder.Encode(map[string]any{"running": true, "pid": os.Getpid(), "runId": runID, "tcpClients": tcpCount, "udpClients": udpCount}); err != nil {
			return err
		}
	}
	stopProgress := make(chan struct{})
	progressDone := make(chan struct{})
	if progress {
		go func() {
			defer close(progressDone)
			ticker := time.NewTicker(time.Second)
			defer ticker.Stop()
			for {
				select {
				case <-stopProgress:
					return
				case <-ticker.C:
					mutex.Lock()
					encoder.Encode(map[string]any{"verifiedReplies": completed.Load(), "errors": len(failures), "clients": clients})
					mutex.Unlock()
				}
			}
		}()
	}
	wait := sync.WaitGroup{}
	for index, socket := range sockets {
		wait.Add(1)
		go func(index int, socket net.Conn) {
			defer wait.Done()
			verified := uint64(0)
			defer func() {
				socket.Close()
				mutex.Lock()
				clients[index]["closedAt"] = time.Now().UTC().Format(time.RFC3339Nano)
				mutex.Unlock()
			}()
			payload := make([]byte, size)
			for i := range payload {
				payload[i] = byte(index + 17 + i)
			}
			reply := make([]byte, size)
			sequence := uint64(0)
			for loadContext.Err() == nil {
				sequence++
				binary.BigEndian.PutUint64(payload[:8], uint64(index))
				binary.BigEndian.PutUint64(payload[8:16], sequence)
				socket.SetDeadline(time.Now().Add(2 * time.Second))
				round := time.Now()
				if n, err := socket.Write(payload); err != nil || n != len(payload) {
					mutex.Lock()
					failures = append(failures, "write")
					clients[index]["failure"] = "write"
					mutex.Unlock()
					return
				}
				var err error
				malformed := false
				if index < tcpCount {
					_, err = io.ReadFull(socket, reply)
				} else {
					var n int
					n, err = socket.Read(reply)
					if n != len(payload) && err == nil {
						malformed = true
						err = fmt.Errorf("UDP size mismatch")
					}
				}
				if err != nil || !bytes.Equal(payload, reply) {
					mutex.Lock()
					failures = append(failures, "reply")
					clients[index]["failure"] = "reply"
					if err == nil || malformed {
						invalidPayload = true
					}
					mutex.Unlock()
					return
				}
				completed.Add(1)
				verified++
				transferred.Add(uint64(2 * size))
				elapsed := time.Since(round).Microseconds()
				mutex.Lock()
				clients[index]["verified"] = verified
				clients[index]["lastVerifiedAt"] = time.Now().UTC().Format(time.RFC3339Nano)
				if len(latencies) < 1000000 {
					latencies = append(latencies, elapsed)
				}
				mutex.Unlock()
				if interval > 0 {
					select {
					case <-loadContext.Done():
					case <-time.After(time.Duration(interval) * time.Millisecond):
					}
				}
			}
		}(index, socket)
	}
	wait.Wait()
	if progress {
		close(stopProgress)
		<-progressDone
	}
	elapsed := time.Since(started)
	if !expectCutoff && len(failures) > 0 || completed.Load() == 0 {
		return fmt.Errorf("load failed: %d errors, %d verified replies", len(failures), completed.Load())
	}
	if expectCutoff && (len(failures) != len(sockets) || elapsed >= time.Duration(seconds)*time.Second) {
		return fmt.Errorf("all load clients must reach the expected early cutoff")
	}
	for _, client := range clients {
		if client["verified"].(uint64) == 0 {
			return fmt.Errorf("every load client must verify payload before completion")
		}
	}
	if invalidPayload {
		return fmt.Errorf("payload corruption is never an expected cutoff")
	}
	sortLatency(latencies)
	quantile := func(percent int) int64 { index := (len(latencies) - 1) * percent / 100; return latencies[index] }
	return encoder.Encode(map[string]any{"completed": true, "expectedCutoff": expectCutoff, "tcpClients": tcpCount, "udpClients": udpCount, "payloadBytes": size, "seconds": elapsed.Seconds(), "verifiedReplies": completed.Load(), "clients": clients, "verifiedBidirectionalBytes": transferred.Load(), "bytesPerSecond": float64(transferred.Load()) / elapsed.Seconds(), "roundTripMicroseconds": map[string]int64{"p50": quantile(50), "p95": quantile(95), "p99": quantile(99)}, "sampledLatencies": len(latencies), "errors": len(failures)})
}
