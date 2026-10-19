package forward

import (
	"context"
	"fmt"
	"net"
	"net/netip"
	"sync"
	"sync/atomic"
	"time"

	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/payloadstats"
)

const (
	// MaxUDPDatagramBytes bounds both client and target datagrams. Oversize
	// packets are dropped in their entirety, never forwarded after truncation.
	MaxUDPDatagramBytes = 16 * 1024
	// MaxUDPSessions bounds descriptors and goroutines even if an authenticated
	// Control publishes an excessively permissive per-assignment policy.
	MaxUDPSessions = 4096
	UDPQueueDepth  = 4
	// A session can return one initial maximum-size packet, then earns sixteen
	// response bytes for every successfully forwarded request byte (minimum 64
	// bytes of credit/cost per datagram accounts for small-packet overhead). Credit
	// cannot exceed four maximum-size packets; arbitrary target floods are dropped.
	UDPReplyAmplification  = 16
	MaxUDPReplyCreditBytes = 4 * MaxUDPDatagramBytes
)

// UDPStats contains cumulative drop counters for one immutable execution.
// ActiveSessions includes associations still resolving or dialing targets.
type UDPStats struct {
	ActiveSessions       uint64
	CapacityDropped      uint64
	TargetRejected       uint64
	DatagramDropped      uint64
	QueueDropped         uint64
	AmplificationDropped uint64
}

// All UDP executions in one Agent process share the same session budget,
// including old and new instances while ownership is transferred.
var udpNodePermits = make(chan struct{}, MaxUDPSessions)

type udpListenerSlot struct {
	listener *net.UDPConn
	mutex    sync.Mutex
	current  *UDP
	done     chan struct{}
}

// UDP owns a bounded association table, not listener ownership across updates.
// Each client address/port has a distinct connected upstream socket, which
// rejects datagrams from any address or port other than its checked target.
type UDP struct {
	authorization executionAuthorization
	slot          *udpListenerSlot
	binding       contracts.Listen
	config        contracts.DirectConfig
	ctx           context.Context
	cancel        context.CancelFunc
	mutex         sync.Mutex
	sessions      map[netip.AddrPort]*udpAssociation
	maximum       uint64
	permits       chan struct{}
	timeout       time.Duration
	idle          time.Duration
	done          sync.WaitGroup
	closeOnce     sync.Once
	capacity      atomic.Uint64
	rejected      atomic.Uint64
	datagrams     atomic.Uint64
	queues        atomic.Uint64
	amplified     atomic.Uint64
	payload       *payloadstats.Counters
}

type udpAssociation struct {
	stream       *UDP
	client       netip.AddrPort
	ctx          context.Context
	cancel       context.CancelFunc
	packets      chan []byte
	target       *net.UDPConn
	lastActivity time.Time
	credit       int
	initialized  bool
}

func validateUDPAssignment(assignment contracts.Assignment) error {
	if assignment.Protocol != "udp" || assignment.Driver.Id != "native.direct.v1" || assignment.Phase != "active" {
		return fmt.Errorf("UNSUPPORTED_CAPABILITY")
	}
	return nil
}

func newUDP(slot *udpListenerSlot, assignment contracts.Assignment, maximum uint64, permits chan struct{}, timeout, idle time.Duration) *UDP {
	ctx, cancel := context.WithCancel(context.Background())
	config := assignment.Driver.Config
	config.AllowedDestinationCidrs = append([]string(nil), config.AllowedDestinationCidrs...)
	return &UDP{slot: slot, binding: assignment.Listener, config: config, ctx: ctx, cancel: cancel,
		sessions: make(map[netip.AddrPort]*udpAssociation), maximum: maximum, permits: permits, timeout: timeout, idle: idle, payload: payloadstats.New()}
}

func StartUDP(assignment contracts.Assignment, policy contracts.Policy) (*UDP, error) {
	return StartUDPAuthorized(assignment, policy, nil)
}
func StartUDPAuthorized(assignment contracts.Assignment, policy contracts.Policy, authorize func() error) (*UDP, error) {
	if authorize != nil {
		if err := authorize(); err != nil {
			return nil, err
		}
	}
	if err := validateUDPAssignment(assignment); err != nil {
		return nil, err
	}
	if policy.MaxUdpSessionsPerAssignment == 0 || policy.ConnectTimeoutSeconds == 0 || policy.UdpIdleTimeoutSeconds == 0 || policy.UdpIdleTimeoutSeconds > uint64((1<<63-1)/int64(time.Second)) {
		return nil, fmt.Errorf("INVALID_CONFIG: invalid UDP resource policy")
	}
	address, err := net.ResolveUDPAddr("udp", net.JoinHostPort(assignment.Listener.Address, fmt.Sprint(assignment.Listener.Port)))
	if err != nil {
		return nil, err
	}
	listener, err := net.ListenUDP("udp", address)
	if err != nil {
		return nil, err
	}
	if authorize != nil {
		if err := authorize(); err != nil {
			listener.Close()
			return nil, err
		}
	}
	slot := &udpListenerSlot{listener: listener, done: make(chan struct{})}
	stream := newUDP(slot, assignment, min(policy.MaxUdpSessionsPerAssignment, MaxUDPSessions), udpNodePermits, time.Duration(min(policy.ConnectTimeoutSeconds, 10))*time.Second, time.Duration(policy.UdpIdleTimeoutSeconds)*time.Second)
	stream.authorization.Set(authorize)
	slot.current = stream
	go slot.receive()
	return stream, nil
}

// Replace swaps ownership without rebinding the socket. Unlike TCP replacement,
// UDP replacement invalidates all old associations; subsequent datagrams create
// associations against the successor's config. Old cleanup cannot close the
// successor's listener or send stale replies through it.
func (stream *UDP) Replace(assignment contracts.Assignment) (*UDP, error) {
	return stream.ReplaceAuthorized(assignment, nil)
}
func (stream *UDP) ReplaceAuthorized(assignment contracts.Assignment, authorize func() error) (*UDP, error) {
	if authorize != nil {
		if err := authorize(); err != nil {
			return nil, err
		}
	}
	if err := validateUDPAssignment(assignment); err != nil {
		return nil, err
	}
	if assignment.Listener != stream.binding {
		return nil, fmt.Errorf("INVALID_CONFIG: replacement requires the same UDP binding")
	}
	stream.slot.mutex.Lock()
	if stream.slot.current != stream || stream.ctx.Err() != nil {
		stream.slot.mutex.Unlock()
		return nil, fmt.Errorf("INVALID_CONFIG: UDP listener is no longer owned by this instance")
	}
	if authorize != nil {
		if err := authorize(); err != nil {
			stream.slot.mutex.Unlock()
			return nil, err
		}
	}
	next := newUDP(stream.slot, assignment, stream.maximum, stream.permits, stream.timeout, stream.idle)
	next.authorization.Set(authorize)
	stream.slot.current = next
	stream.slot.mutex.Unlock()
	stream.Close()
	return next, nil
}

func (slot *udpListenerSlot) receive() {
	defer close(slot.done)
	packet := make([]byte, MaxUDPDatagramBytes+1)
	for {
		n, client, err := slot.listener.ReadFromUDPAddrPort(packet)
		if err != nil {
			return
		}
		client = netip.AddrPortFrom(client.Addr().Unmap(), client.Port())
		slot.mutex.Lock()
		stream := slot.current
		if stream == nil || stream.ctx.Err() != nil || stream.authorization.Allow() != nil {
			slot.mutex.Unlock()
			continue
		}
		if n > MaxUDPDatagramBytes {
			stream.datagrams.Add(1)
			slot.mutex.Unlock()
			continue
		}
		stream.mutex.Lock()
		association := stream.sessions[client]
		// A retired association may still occupy the map until its cleanup
		// goroutine completes. Never enqueue the first packet of a new session
		// into its canceled, unserviced queue: replace the stale mapping now.
		// The previous goroutine only deletes its own pointer on exit.
		if association != nil && association.ctx.Err() != nil {
			delete(stream.sessions, client)
			association = nil
		}
		if association == nil {
			if uint64(len(stream.sessions)) >= stream.maximum {
				stream.capacity.Add(1)
				stream.mutex.Unlock()
				slot.mutex.Unlock()
				continue
			}
			select {
			case stream.permits <- struct{}{}:
			default:
				stream.capacity.Add(1)
				stream.mutex.Unlock()
				slot.mutex.Unlock()
				continue
			}
			ctx, cancel := context.WithCancel(stream.ctx)
			association = &udpAssociation{stream: stream, client: client, ctx: ctx, cancel: cancel, packets: make(chan []byte, UDPQueueDepth)}
			stream.sessions[client] = association
			stream.payload.UDPCreate()
			// Positive Add is serialized with Close through listener ownership.
			stream.done.Add(1)
			go association.run()
		}
		select {
		case association.packets <- append([]byte(nil), packet[:n]...):
		default:
			stream.queues.Add(1)
		}
		stream.mutex.Unlock()
		slot.mutex.Unlock()
	}
}

func (association *udpAssociation) connect() (*net.UDPConn, error) {
	stream := association.stream
	ctx, cancel := context.WithTimeout(association.ctx, stream.timeout)
	defer cancel()
	addresses, err := net.DefaultResolver.LookupNetIP(ctx, "ip", stream.config.Target.Host)
	if err != nil {
		return nil, err
	}
	for _, addr := range addresses {
		if !Allowed(addr, stream.config) || stream.authorization.Allow() != nil {
			continue
		}
		connection, err := (&net.Dialer{}).DialContext(ctx, "udp", net.JoinHostPort(addr.Unmap().String(), fmt.Sprint(stream.config.Target.Port)))
		if err == nil {
			return connection.(*net.UDPConn), nil
		}
	}
	return nil, fmt.Errorf("TARGET_UNREACHABLE: no permitted UDP target")
}

func (association *udpAssociation) run() {
	stream := association.stream
	defer stream.done.Done()
	defer func() {
		association.cancel()
		stream.mutex.Lock()
		if stream.sessions[association.client] == association {
			delete(stream.sessions, association.client)
		}
		stream.mutex.Unlock()
		<-stream.permits
		stream.payload.UDPClose()
	}()
	target, err := association.connect()
	if err != nil {
		if association.ctx.Err() == nil {
			stream.rejected.Add(1)
		}
		return
	}
	stream.mutex.Lock()
	if association.ctx.Err() != nil || stream.authorization.Allow() != nil {
		stream.mutex.Unlock()
		target.Close()
		return
	}
	association.target = target
	association.lastActivity = time.Now()
	stream.mutex.Unlock()
	readerDone := make(chan struct{})
	go func() {
		defer close(readerDone)
		defer association.cancel()
		association.replies()
	}()
	defer func() {
		target.Close()
		<-readerDone
	}()
	for {
		select {
		case <-association.ctx.Done():
			return
		case <-readerDone:
			return
		case packet := <-association.packets:
			stream.mutex.Lock()
			if association.ctx.Err() != nil || stream.authorization.Allow() != nil {
				stream.mutex.Unlock()
				return
			}
			target.SetWriteDeadline(time.Now().Add(stream.timeout))
			n, err := target.Write(packet)
			if err != nil {
				stream.mutex.Unlock()
				return
			}
			if n == len(packet) {
				stream.payload.UDPSent(n)
			}
			association.lastActivity = time.Now()
			if !association.initialized {
				association.credit = MaxUDPDatagramBytes
				association.initialized = true
			}
			association.credit = min(MaxUDPReplyCreditBytes, association.credit+UDPReplyAmplification*max(len(packet), 64))
			deadline := association.lastActivity.Add(stream.idle)
			stream.mutex.Unlock()
			target.SetReadDeadline(deadline)
		}
	}
}

func (association *udpAssociation) replies() {
	stream := association.stream
	packet := make([]byte, MaxUDPDatagramBytes+1)
	for {
		stream.mutex.Lock()
		deadline := association.lastActivity.Add(stream.idle)
		stream.mutex.Unlock()
		association.target.SetReadDeadline(deadline)
		n, err := association.target.Read(packet)
		if err != nil {
			if problem, ok := err.(net.Error); ok && problem.Timeout() {
				stream.mutex.Lock()
				active := time.Now().Before(association.lastActivity.Add(stream.idle)) && association.ctx.Err() == nil
				if !active {
					// Publish expiry before releasing the same mutex receive()
					// uses to select the association for a new client packet.
					// Otherwise a packet may enter a queue whose reader has
					// already decided to exit, with no upstream reply possible.
					association.cancel()
				}
				stream.mutex.Unlock()
				if active {
					continue
				}
			}
			return
		}
		if n > MaxUDPDatagramBytes {
			stream.datagrams.Add(1)
			continue
		}
		stream.slot.mutex.Lock()
		if stream.slot.current != stream || association.ctx.Err() != nil || stream.authorization.Allow() != nil {
			stream.slot.mutex.Unlock()
			return
		}
		stream.mutex.Lock()
		if max(n, 64) > association.credit {
			stream.amplified.Add(1)
			stream.mutex.Unlock()
			stream.slot.mutex.Unlock()
			continue
		}
		stream.slot.listener.SetWriteDeadline(time.Now().Add(stream.timeout))
		written, writeErr := stream.slot.listener.WriteToUDPAddrPort(packet[:n], association.client)
		err = writeErr
		if err == nil {
			if written == n {
				stream.payload.UDPReceived(written)
			}
			association.credit -= max(n, 64)
			association.lastActivity = time.Now()
		}
		stream.mutex.Unlock()
		stream.slot.mutex.Unlock()
		if err != nil {
			return
		}
	}
}

// Drain immediately retires UDP associations. The protocol deliberately makes
// no guarantee of transparent UDP migration or delivery of in-flight datagrams.
func (stream *UDP) Drain() {
	stream.Close()
}

func (stream *UDP) Remaining() uint64 {
	stream.mutex.Lock()
	defer stream.mutex.Unlock()
	return uint64(len(stream.sessions))
}
func (stream *UDP) SetAuthorization(check func() error) { stream.authorization.Set(check) }

func (stream *UDP) Stats() UDPStats {
	return UDPStats{ActiveSessions: stream.Remaining(), CapacityDropped: stream.capacity.Load(), TargetRejected: stream.rejected.Load(), DatagramDropped: stream.datagrams.Load(), QueueDropped: stream.queues.Load(), AmplificationDropped: stream.amplified.Load()}
}

// Close cancels pending DNS/dial work, closes all upstream sockets, and waits for
// resource reclamation. Only the current owner may close the shared listener.
func (stream *UDP) Close() {
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
		for _, association := range stream.sessions {
			association.cancel()
			if association.target != nil {
				association.target.Close()
			}
		}
		stream.mutex.Unlock()
		if owned {
			<-stream.slot.done
		}
	})
	stream.done.Wait()
}
