package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"
)

// Lost/in-flight packets during route changes are counted, not advertised as transparent UDP migration.
func udpRouteMonitor(port int, original, successor string) error {
	if original == "" || successor == "" || original == successor {
		return fmt.Errorf("Distinct fixture target tags required")
	}
	socket, err := net.DialTimeout("udp", fmt.Sprintf("127.0.0.1:%d", port), time.Second)
	if err != nil {
		return err
	}
	defer socket.Close()
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	payload := make([]byte, 64)
	if _, err := rand.Read(payload); err != nil {
		return err
	}
	reply := make([]byte, 128)
	counts := map[string]int{original: 0, successor: 0}
	lost := 0
	switched := false
	sequence := uint64(0)
	for ctx.Err() == nil {
		sequence++
		binary.BigEndian.PutUint64(payload[:8], sequence)
		socket.SetDeadline(time.Now().Add(300 * time.Millisecond))
		if _, err := socket.Write(payload); err != nil {
			lost++
			time.Sleep(150 * time.Millisecond)
			continue
		}
		n, err := socket.Read(reply)
		if err != nil {
			lost++
			time.Sleep(150 * time.Millisecond)
			continue
		}
		tag := ""
		for _, candidate := range []string{original, successor} {
			if n == len(candidate)+len(payload) && bytes.Equal(reply[:len(candidate)], []byte(candidate)) && bytes.Equal(reply[len(candidate):n], payload) {
				tag = candidate
				break
			}
		}
		if tag == "" {
			lost++
			continue
		}
		if switched && tag == original {
			return fmt.Errorf("Old UDP target replied after successor was established")
		}
		if tag == successor {
			switched = true
		}
		counts[tag]++
		if err := json.NewEncoder(os.Stdout).Encode(map[string]any{"verified": counts, "lost": lost, "tag": tag, "pid": os.Getpid()}); err != nil {
			return err
		}
		time.Sleep(150 * time.Millisecond)
	}
	return nil
}

func occupyUDP(port int, runID string) error {
	socket, err := net.ListenUDP("udp", &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1), Port: port})
	if err != nil {
		return err
	}
	defer socket.Close()
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	if err := json.NewEncoder(os.Stdout).Encode(map[string]any{"pid": os.Getpid(), "port": port, "runId": runID}); err != nil {
		return err
	}
	<-ctx.Done()
	return nil
}
