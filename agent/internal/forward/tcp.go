package forward

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/netip"
	"sync"
	"time"

	"github.com/tunex/vnext/agent/internal/contracts"
)

type TCP struct {
	listener    net.Listener
	config      contracts.DirectConfig
	ctx         context.Context
	cancel      context.CancelFunc
	mutex       sync.Mutex
	connections map[net.Conn]bool
	permits     chan struct{}
	timeout     time.Duration
	done        sync.WaitGroup
}

func Start(assignment contracts.Assignment, policy contracts.Policy) (*TCP, error) {
	if assignment.Protocol != "tcp" || assignment.Driver.Id != "native.direct.v1" || assignment.Phase != "active" {
		return nil, fmt.Errorf("UNSUPPORTED_CAPABILITY")
	}
	if policy.MaxTcpConnectionsPerAssignment == 0 || policy.ConnectTimeoutSeconds == 0 {
		return nil, fmt.Errorf("INVALID_CONFIG: invalid TCP resource policy")
	}
	listener, err := net.Listen("tcp", net.JoinHostPort(assignment.Listener.Address, fmt.Sprint(assignment.Listener.Port)))
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithCancel(context.Background())
	stream := &TCP{listener: listener, config: assignment.Driver.Config, ctx: ctx, cancel: cancel, connections: make(map[net.Conn]bool), permits: make(chan struct{}, min(policy.MaxTcpConnectionsPerAssignment, 1024)), timeout: time.Duration(min(policy.ConnectTimeoutSeconds, 10)) * time.Second}
	stream.done.Add(1)
	go stream.accept()
	return stream, nil
}
func (stream *TCP) accept() {
	defer stream.done.Done()
	for {
		client, err := stream.listener.Accept()
		if err != nil {
			return
		}
		select {
		case stream.permits <- struct{}{}:
		default:
			client.Close()
			continue
		}
		stream.mutex.Lock()
		if stream.ctx.Err() != nil {
			stream.mutex.Unlock()
			client.Close()
			<-stream.permits
			return
		}
		stream.connections[client] = true
		stream.done.Add(1)
		stream.mutex.Unlock()
		go stream.copy(client)
	}
}

var sensitivePrefixes = []string{"169.254.0.0/16", "100.100.100.200/32", "fd00:ec2::254/128", "fe80::/10"}

func Allowed(addr netip.Addr, config contracts.DirectConfig) bool {
	addr = addr.Unmap()
	if !addr.IsValid() || addr.IsUnspecified() || addr.IsMulticast() {
		return false
	}
	if !config.AllowMetadataTargets {
		for _, text := range sensitivePrefixes {
			if netip.MustParsePrefix(text).Contains(addr) {
				return false
			}
		}
	}
	for _, text := range config.AllowedDestinationCidrs {
		prefix, err := netip.ParsePrefix(text)
		if err == nil && prefix.Addr().BitLen() == addr.BitLen() && prefix.Contains(addr) {
			return true
		}
	}
	return false
}
func (stream *TCP) copy(client net.Conn) {
	defer stream.done.Done()
	defer func() {
		client.Close()
		stream.mutex.Lock()
		delete(stream.connections, client)
		stream.mutex.Unlock()
		<-stream.permits
	}()
	ctx, cancel := context.WithTimeout(stream.ctx, stream.timeout)
	defer cancel()
	addresses, err := net.DefaultResolver.LookupNetIP(ctx, "ip", stream.config.Target.Host)
	if err != nil {
		return
	}
	var target net.Conn
	for _, addr := range addresses {
		if !Allowed(addr, stream.config) {
			continue
		}
		target, err = (&net.Dialer{}).DialContext(ctx, "tcp", net.JoinHostPort(addr.Unmap().String(), fmt.Sprint(stream.config.Target.Port)))
		if err == nil {
			break
		}
	}
	if target == nil {
		return
	}
	defer target.Close()
	stream.mutex.Lock()
	if stream.ctx.Err() != nil {
		stream.mutex.Unlock()
		return
	}
	stream.connections[target] = true
	stream.mutex.Unlock()
	defer func() { stream.mutex.Lock(); delete(stream.connections, target); stream.mutex.Unlock() }()
	finished := make(chan struct{}, 1)
	go func() {
		io.Copy(target, client)
		if tcp, ok := target.(*net.TCPConn); ok {
			tcp.CloseWrite()
		}
		finished <- struct{}{}
	}()
	io.Copy(client, target)
	if tcp, ok := client.(*net.TCPConn); ok {
		tcp.CloseWrite()
	}
	<-finished
}
func (stream *TCP) Close() {
	stream.cancel()
	stream.listener.Close()
	stream.mutex.Lock()
	for connection := range stream.connections {
		connection.Close()
	}
	stream.mutex.Unlock()
	stream.done.Wait()
}
