package relay

import (
	"context"
	"crypto/tls"
	"net"
	"net/netip"
	"sync"
	"time"
)

func (e *Engine) receiveClients() {
	defer e.workers.Done()
	maximum := int(e.assignment.Driver.Config.Profile.MaxUdpDatagramBytes)
	packet := make([]byte, maximum+1)
	for {
		n, address, err := e.udp.ReadFromUDPAddrPort(packet)
		if err != nil {
			return
		}
		if n > maximum {
			e.dropped.Add(1)
			continue
		}
		address = netip.AddrPortFrom(address.Addr().Unmap(), address.Port())
		e.mutex.Lock()
		if !e.active || e.check() != nil {
			e.mutex.Unlock()
			continue
		}
		session := e.sessions[address]
		if session == nil {
			if len(e.sessions) >= e.maximum {
				e.mutex.Unlock()
				e.rejected.Add(1)
				continue
			}
			release, err := acquireNode(int(e.assignment.Driver.Config.Profile.MaxConnectionsPerNode), "udp")
			if err != nil {
				e.mutex.Unlock()
				e.rejected.Add(1)
				continue
			}
			ctx, cancel := context.WithCancel(e.ctx)
			session = &association{engine: e, client: address, queue: make(chan []byte, 16), last: time.Now(), credit: int(e.assignment.Driver.Config.Profile.MaxUdpDatagramBytes), ctx: ctx, cancel: cancel}
			e.sessions[address] = session
			e.payload.UDPCreate()
			e.workers.Add(1)
			go func() { defer e.workers.Done(); defer release(); session.run() }()
		}
		select {
		case session.queue <- append([]byte(nil), packet[:n]...):
		default:
			e.dropped.Add(1)
		}
		e.mutex.Unlock()
	}
}
func (s *association) run() {
	e := s.engine
	defer func() {
		s.cancel()
		e.payload.UDPClose()
		e.mutex.Lock()
		if e.sessions[s.client] == s {
			delete(e.sessions, s.client)
		}
		e.mutex.Unlock()
	}()
	peer, err := e.dialPeer("udp")
	if err != nil {
		e.rejected.Add(1)
		return
	}
	defer closeSocket(peer)
	defer e.untrackPeer(peer)
	e.mutex.Lock()
	if s.ctx.Err() != nil || e.check() != nil {
		e.mutex.Unlock()
		return
	}
	s.connection = peer
	e.mutex.Unlock()
	done := make(chan struct{})
	go func() { defer close(done); defer s.cancel(); s.replies() }()
	defer func() { closeSocket(peer); <-done }()
	for {
		select {
		case <-s.ctx.Done():
			return
		case packet := <-s.queue:
			if e.peerCheck(peer) != nil {
				return
			}
			if _, err := reservePayload(s.ctx, e.payloadGate, func() error { return e.peerCheck(peer) }, len(packet), true); err != nil {
				return
			}
			peer.SetWriteDeadline(time.Now().Add(time.Duration(e.assignment.Driver.Config.Profile.HandshakeTimeoutSeconds) * time.Second))
			if err := WriteFrame(peer, FrameUDP, packet, "udp", int(e.assignment.Driver.Config.Profile.MaxUdpDatagramBytes)); err != nil {
				return
			}
			e.payload.UDPSent(len(packet))
			e.mutex.Lock()
			s.last = time.Now()
			s.credit = min(4*int(e.assignment.Driver.Config.Profile.MaxUdpDatagramBytes), s.credit+3*max(len(packet), 64))
			e.mutex.Unlock()
		}
	}
}
func (s *association) replies() {
	e := s.engine
	idle := time.Duration(e.assignment.Driver.Config.Profile.IdleTimeoutSeconds) * time.Second
	for {
		e.mutex.Lock()
		deadline := s.last.Add(idle)
		e.mutex.Unlock()
		s.connection.SetReadDeadline(deadline)
		kind, packet, err := ReadFrame(s.connection, "udp", int(e.assignment.Driver.Config.Profile.MaxUdpDatagramBytes))
		if err != nil {
			if problem, ok := err.(net.Error); ok && problem.Timeout() {
				e.mutex.Lock()
				stillActive := time.Now().Before(s.last.Add(idle))
				e.mutex.Unlock()
				if stillActive && s.ctx.Err() == nil {
					continue
				}
			}
			return
		}
		if kind == FrameClose || e.peerCheck(s.connection) != nil {
			return
		}
		e.mutex.Lock()
		allowed := s.credit >= max(len(packet), 64)
		if allowed {
			s.credit -= max(len(packet), 64)
		}
		e.mutex.Unlock()
		if !allowed {
			e.dropped.Add(1)
			continue
		}
		if _, err := reservePayload(s.ctx, e.payloadGate, func() error { return e.peerCheck(s.connection) }, len(packet), true); err != nil {
			return
		}
		e.udp.SetWriteDeadline(time.Now().Add(time.Second))
		n, err := e.udp.WriteToUDPAddrPort(packet, s.client)
		if err != nil {
			return
		}
		if n == len(packet) {
			e.payload.UDPReceived(n)
		}
	}
}
func (e *Engine) bridgeUDP(target net.Conn, connection *tls.Conn) {
	// Every target reply consumes bounded credit; unsolicited floods never produce unlimited Relay traffic.
	maximum := int(e.assignment.Driver.Config.Profile.MaxUdpDatagramBytes)
	idle := time.Duration(e.assignment.Driver.Config.Profile.IdleTimeoutSeconds) * time.Second
	sessionCtx, cancel := context.WithCancel(e.ctx)
	defer cancel()
	last := time.Now()
	credit := maximum
	var lock sync.Mutex
	done := make(chan struct{})
	go func() {
		defer close(done)
		defer cancel()
		packet := make([]byte, maximum+1)
		for {
			lock.Lock()
			deadline := last.Add(idle)
			lock.Unlock()
			target.SetReadDeadline(deadline)
			n, err := target.Read(packet)
			if err != nil {
				if problem, ok := err.(net.Error); ok && problem.Timeout() {
					lock.Lock()
					active := time.Now().Before(last.Add(idle))
					lock.Unlock()
					if active && sessionCtx.Err() == nil {
						continue
					}
				}
				return
			}
			if e.peerCheck(connection) != nil {
				return
			}
			if n > maximum {
				e.dropped.Add(1)
				continue
			}
			lock.Lock()
			allowed := credit >= max(n, 64)
			if allowed {
				credit -= max(n, 64)
			}
			lock.Unlock()
			if !allowed {
				e.dropped.Add(1)
				continue
			}
			if _, err := reservePayload(sessionCtx, e.payloadGate, func() error { return e.peerCheck(connection) }, n, true); err != nil {
				return
			}
			connection.SetWriteDeadline(time.Now().Add(time.Duration(e.assignment.Driver.Config.Profile.HandshakeTimeoutSeconds) * time.Second))
			if err := WriteFrame(connection, FrameUDP, packet[:n], "udp", maximum); err != nil {
				return
			}
		}
	}()
	defer func() { closeSocket(target); closeSocket(connection); <-done }()
	for {
		connection.SetReadDeadline(time.Now().Add(idle))
		kind, packet, err := ReadFrame(connection, "udp", maximum)
		if err != nil || kind == FrameClose || sessionCtx.Err() != nil || e.peerCheck(connection) != nil {
			return
		}
		if _, err := reservePayload(sessionCtx, e.payloadGate, func() error { return e.peerCheck(connection) }, len(packet), true); err != nil {
			return
		}
		lock.Lock()
		last = time.Now()
		credit = min(4*maximum, credit+3*max(len(packet), 64))
		lock.Unlock()
		target.SetWriteDeadline(time.Now().Add(time.Second))
		if _, err := target.Write(packet); err != nil {
			return
		}
	}
}
