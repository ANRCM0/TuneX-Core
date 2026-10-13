package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"
)

// TLS stays end-to-end between Agent and Control; the proxy only joins isolated
// acceptance namespaces to the existing Control address without host NAT rules.
func tcpProxy(host, upstream string, port int, runID string) error {
	if net.ParseIP(upstream) == nil || port < 1 || port > 65535 || runID == "" {
		return fmt.Errorf("Explicit bounded proxy upstream and run identity required")
	}
	listener, err := net.Listen("tcp", net.JoinHostPort(host, "0"))
	if err != nil {
		return err
	}
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	defer listener.Close()
	go func() { <-ctx.Done(); listener.Close() }()
	permits := make(chan struct{}, 128)
	var workers sync.WaitGroup
	if err := json.NewEncoder(os.Stdout).Encode(map[string]any{"port": listener.Addr().(*net.TCPAddr).Port, "pid": os.Getpid(), "runId": runID}); err != nil {
		return err
	}
	for {
		client, err := listener.Accept()
		if err != nil {
			if ctx.Err() == nil {
				return err
			}
			break
		}
		select {
		case permits <- struct{}{}:
		default:
			client.Close()
			continue
		}
		workers.Add(1)
		go func() {
			defer workers.Done()
			defer func() { <-permits }()
			defer client.Close()
			server, err := (&net.Dialer{Timeout: 3 * time.Second}).DialContext(ctx, "tcp", net.JoinHostPort(upstream, fmt.Sprint(port)))
			if err != nil {
				return
			}
			defer server.Close()
			stop := context.AfterFunc(ctx, func() { client.Close(); server.Close() })
			defer stop()
			client.SetDeadline(time.Now().Add(30 * time.Second))
			server.SetDeadline(time.Now().Add(30 * time.Second))
			done := make(chan struct{})
			go func() { io.Copy(server, client); server.(*net.TCPConn).CloseWrite(); close(done) }()
			io.Copy(client, server)
			client.Close()
			server.Close()
			<-done
		}()
	}
	workers.Wait()
	return nil
}
