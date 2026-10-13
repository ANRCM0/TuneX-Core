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

func load(port, tcpCount, udpCount, seconds, size int) error {
	if tcpCount < 1 || tcpCount > 256 || udpCount < 1 || udpCount > 256 || seconds < 1 || seconds > 10 || size < 64 || size > 4096 {
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
	context, cancel := context.WithTimeout(context.Background(), time.Duration(seconds)*time.Second)
	defer cancel()
	started := time.Now()
	var completed atomic.Uint64
	var transferred atomic.Uint64
	var mutex sync.Mutex
	latencies := []int64{}
	failures := []string{}
	wait := sync.WaitGroup{}
	for index, socket := range sockets {
		wait.Add(1)
		go func(index int, socket net.Conn) {
			defer wait.Done()
			payload := make([]byte, size)
			for i := range payload {
				payload[i] = byte(index + 17 + i)
			}
			reply := make([]byte, size)
			sequence := uint64(0)
			for context.Err() == nil {
				sequence++
				binary.BigEndian.PutUint64(payload[:8], uint64(index))
				binary.BigEndian.PutUint64(payload[8:16], sequence)
				socket.SetDeadline(time.Now().Add(2 * time.Second))
				round := time.Now()
				if _, err := socket.Write(payload); err != nil {
					mutex.Lock()
					failures = append(failures, "write")
					mutex.Unlock()
					return
				}
				var err error
				if index < tcpCount {
					_, err = io.ReadFull(socket, reply)
				} else {
					var n int
					n, err = socket.Read(reply)
					if n != len(payload) && err == nil {
						err = fmt.Errorf("UDP size mismatch")
					}
				}
				if err != nil || !bytes.Equal(payload, reply) {
					mutex.Lock()
					failures = append(failures, "reply")
					mutex.Unlock()
					return
				}
				completed.Add(1)
				transferred.Add(uint64(2 * size))
				elapsed := time.Since(round).Microseconds()
				mutex.Lock()
				if len(latencies) < 1000000 {
					latencies = append(latencies, elapsed)
				}
				mutex.Unlock()
			}
		}(index, socket)
	}
	wait.Wait()
	elapsed := time.Since(started)
	if len(failures) > 0 || completed.Load() == 0 {
		return fmt.Errorf("load failed: %d errors, %d verified replies", len(failures), completed.Load())
	}
	sortLatency(latencies)
	quantile := func(percent int) int64 { index := (len(latencies) - 1) * percent / 100; return latencies[index] }
	return json.NewEncoder(os.Stdout).Encode(map[string]any{"tcpClients": tcpCount, "udpClients": udpCount, "payloadBytes": size, "seconds": elapsed.Seconds(), "verifiedReplies": completed.Load(), "verifiedBidirectionalBytes": transferred.Load(), "bytesPerSecond": float64(transferred.Load()) / elapsed.Seconds(), "roundTripMicroseconds": map[string]int64{"p50": quantile(50), "p95": quantile(95), "p99": quantile(99)}, "sampledLatencies": len(latencies), "errors": len(failures)})
}
