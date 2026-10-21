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
	"github.com/tunex/vnext/agent/internal/egress"
	"github.com/tunex/vnext/agent/internal/executionhost"
	"github.com/tunex/vnext/agent/internal/payloadstats"
)

// MaxTCPConnections bounds live client streams, including streams still
// dialing and streams draining under retired configuration generations.
const MaxTCPConnections = 4096

var tcpNodePermits = make(chan struct{}, MaxTCPConnections)

// tcpListenerSlot owns the listening socket independently of any one execution
// instance. Its lock is the linearization point for accepting, replacing and
// retiring instances: a socket always belongs to exactly one immutable config.
type tcpListenerSlot struct {
	listener    net.Listener
	nodePermits chan struct{}
	mutex       sync.Mutex
	current     *TCP
	done        chan struct{}
}

type TCP struct {
	authorization executionAuthorization
	slot          *tcpListenerSlot
	binding       contracts.Listen
	config        contracts.DirectConfig
	ctx           context.Context
	cancel        context.CancelFunc
	mutex         sync.Mutex
	connections   map[net.Conn]net.Conn
	permits       chan struct{}
	timeout       time.Duration
	done          sync.WaitGroup
	closeOnce     sync.Once
	payload       *payloadstats.Counters
	payloadGate   executionhost.PayloadGate
}

func validateTCPAssignment(assignment contracts.Assignment) error {
	if assignment.Protocol != "tcp" || assignment.Driver.Id != "native.direct.v1" || assignment.Phase != "active" {
		return fmt.Errorf("UNSUPPORTED_CAPABILITY")
	}
	return nil
}

func newTCP(slot *tcpListenerSlot, assignment contracts.Assignment, permits chan struct{}, timeout time.Duration) *TCP {
	return newTCPWithPayload(slot, assignment, permits, timeout, nil)
}
func newTCPWithPayload(slot *tcpListenerSlot, assignment contracts.Assignment, permits chan struct{}, timeout time.Duration, gate executionhost.PayloadGate) *TCP {
	ctx, cancel := context.WithCancel(context.Background())
	config := assignment.Driver.Config
	config.AllowedDestinationCidrs = append([]string(nil), config.AllowedDestinationCidrs...)
	return &TCP{slot: slot, binding: assignment.Listener, config: config, ctx: ctx, cancel: cancel,
		connections: make(map[net.Conn]net.Conn), permits: permits, timeout: timeout, payload: payloadstats.New(), payloadGate: gate}
}

func Start(assignment contracts.Assignment, policy contracts.Policy) (*TCP, error) {
	return StartAuthorized(assignment, policy, nil)
}
func StartAuthorized(assignment contracts.Assignment, policy contracts.Policy, authorize func() error) (*TCP, error) {
	return StartAuthorizedMetered(assignment, policy, authorize, nil)
}

// StartAuthorizedMetered binds the immutable payload gate before listening.
// A nil gate retains the legacy unmetered entrypoint behavior.
func StartAuthorizedMetered(assignment contracts.Assignment, policy contracts.Policy, authorize func() error, gate executionhost.PayloadGate) (*TCP, error) {
	if authorize != nil {
		if err := authorize(); err != nil {
			return nil, err
		}
	}
	if err := validateTCPAssignment(assignment); err != nil {
		return nil, err
	}
	if policy.MaxTcpConnectionsPerAssignment == 0 || policy.ConnectTimeoutSeconds == 0 {
		return nil, fmt.Errorf("INVALID_CONFIG: invalid TCP resource policy")
	}
	slot := &tcpListenerSlot{nodePermits: tcpNodePermits, done: make(chan struct{})}
	stream := newTCPWithPayload(slot, assignment, make(chan struct{}, min(policy.MaxTcpConnectionsPerAssignment, 1024)), time.Duration(min(policy.ConnectTimeoutSeconds, 10))*time.Second, gate)
	stream.authorization.Set(authorize)
	listener, err := net.Listen("tcp", net.JoinHostPort(assignment.Listener.Address, fmt.Sprint(assignment.Listener.Port)))
	if err != nil {
		stream.cancel()
		return nil, err
	}
	if authorize != nil {
		if err := authorize(); err != nil {
			listener.Close()
			stream.cancel()
			return nil, err
		}
	}
	slot.listener = listener
	slot.current = stream
	go slot.accept()
	return stream, nil
}

// Replace transfers the existing listener to a fresh execution instance. New
// sockets use the successor's config, while this instance retains its streams.
// The connection budget is shared across generations of the same listener.
func (stream *TCP) Replace(assignment contracts.Assignment) (*TCP, error) {
	return stream.ReplaceAuthorized(assignment, nil)
}
func (stream *TCP) ReplaceAuthorized(assignment contracts.Assignment, authorize func() error) (*TCP, error) {
	if authorize != nil {
		if err := authorize(); err != nil {
			return nil, err
		}
	}
	if stream.payloadGate != nil {
		return nil, fmt.Errorf("UNSUPPORTED_CAPABILITY: metered TCP replacement requires a new bound host")
	}
	if err := validateTCPAssignment(assignment); err != nil {
		return nil, err
	}
	if assignment.Listener != stream.binding {
		return nil, fmt.Errorf("INVALID_CONFIG: replacement requires the same TCP binding")
	}
	stream.slot.mutex.Lock()
	defer stream.slot.mutex.Unlock()
	if stream.slot.current != stream || stream.ctx.Err() != nil {
		return nil, fmt.Errorf("INVALID_CONFIG: TCP listener is no longer owned by this instance")
	}
	if authorize != nil {
		if err := authorize(); err != nil {
			return nil, err
		}
	}
	next := newTCP(stream.slot, assignment, stream.permits, stream.timeout)
	next.authorization.Set(authorize)
	stream.slot.current = next
	return next, nil
}

func (slot *tcpListenerSlot) accept() {
	defer close(slot.done)
	for {
		client, err := slot.listener.Accept()
		if err != nil {
			return
		}
		slot.mutex.Lock()
		stream := slot.current
		if stream == nil || stream.ctx.Err() != nil || stream.authorization.Allow() != nil {
			slot.mutex.Unlock()
			client.Close()
			continue
		}
		select {
		case stream.permits <- struct{}{}:
		default:
			slot.mutex.Unlock()
			client.Close()
			continue
		}
		select {
		case slot.nodePermits <- struct{}{}:
		default:
			<-stream.permits
			slot.mutex.Unlock()
			client.Close()
			continue
		}
		stream.mutex.Lock()
		stream.connections[client] = nil
		stream.payload.TCPAccept()
		// Close holds slot.mutex before stopping ownership, so no Add can race
		// with a Wait after the final admission of this execution instance.
		stream.done.Add(1)
		stream.mutex.Unlock()
		slot.mutex.Unlock()
		go stream.copy(client)
	}
}

func Allowed(addr netip.Addr, config contracts.DirectConfig) bool {
	return egress.Allowed(addr, config.AllowedDestinationCidrs, config.AllowMetadataTargets)
}

func (stream *TCP) copy(client net.Conn) {
	defer stream.done.Done()
	defer func() {
		client.Close()
		stream.mutex.Lock()
		<-stream.slot.nodePermits
		<-stream.permits
		delete(stream.connections, client)
		stream.mutex.Unlock()
		stream.payload.TCPClose()
	}()
	ctx, cancel := context.WithTimeout(stream.ctx, stream.timeout)
	defer cancel()
	addresses, err := net.DefaultResolver.LookupNetIP(ctx, "ip", stream.config.Target.Host)
	if err != nil {
		return
	}
	var target net.Conn
	for _, addr := range addresses {
		if !Allowed(addr, stream.config) || stream.authorization.Allow() != nil {
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
	if stream.ctx.Err() != nil || stream.authorization.Allow() != nil {
		stream.mutex.Unlock()
		return
	}
	stream.connections[client] = target
	stream.mutex.Unlock()
	stream.payload.TCPConnect()
	payloadCtx, payloadCancel := context.WithCancel(stream.ctx)
	defer payloadCancel()
	finished := make(chan struct{}, 1)
	go func() {
		_, err := io.Copy(authorizedWriter{payloadWriter{target: quotaWriter{target: target, ctx: payloadCtx, gate: stream.payloadGate, allow: stream.authorization.Allow}, counters: stream.payload}, &stream.authorization}, authorizedReader{client, &stream.authorization})
		if tcp, ok := target.(*net.TCPConn); ok {
			tcp.CloseWrite()
		}
		if err != nil {
			payloadCancel()
			target.Close()
		}
		finished <- struct{}{}
	}()
	_, err = io.Copy(authorizedWriter{payloadWriter{target: quotaWriter{target: client, ctx: payloadCtx, gate: stream.payloadGate, allow: stream.authorization.Allow}, counters: stream.payload, received: true}, &stream.authorization}, authorizedReader{target, &stream.authorization})
	if tcp, ok := client.(*net.TCPConn); ok {
		tcp.CloseWrite()
	}
	if err != nil {
		payloadCancel()
		client.Close()
	}
	<-finished
}
func (stream *TCP) SetAuthorization(check func() error) { stream.authorization.Set(check) }

// Drain retires listener ownership without closing accepted connections. A
// retired instance cannot close a listener subsequently owned by Replace.
func (stream *TCP) Drain() {
	stream.slot.mutex.Lock()
	owned := stream.slot.current == stream
	if owned {
		stream.slot.current = nil
		stream.slot.listener.Close()
	}
	stream.slot.mutex.Unlock()
	if owned {
		<-stream.slot.done
	}
}

// Remaining counts client streams once, including connections still dialing.
func (stream *TCP) Remaining() uint64 {
	stream.mutex.Lock()
	defer stream.mutex.Unlock()
	return uint64(len(stream.connections))
}

// Close ends this execution instance, and closes its listener only if it still
// owns it. Callers enforce drain and authorization deadlines by calling Close.
func (stream *TCP) Close() {
	stream.closeOnce.Do(func() {
		stream.slot.mutex.Lock()
		stream.cancel()
		owned := stream.slot.current == stream
		if owned {
			stream.slot.current = nil
			stream.slot.listener.Close()
		}
		stream.slot.mutex.Unlock()
		stream.mutex.Lock()
		for client, target := range stream.connections {
			client.Close()
			if target != nil {
				target.Close()
			}
		}
		stream.mutex.Unlock()
		if owned {
			<-stream.slot.done
		}
	})
	stream.done.Wait()
}
