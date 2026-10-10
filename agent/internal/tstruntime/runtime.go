package tstruntime

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"io"
	"net"
	"reflect"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/tunex/agent/internal/securelink"
)

const (
	udpIdle             = 60 * time.Second
	handshakeBurst      = 8
	handshakesPerSecond = 4
)

type placement struct {
	manager         *Manager
	mu              sync.Mutex
	config          Config
	transport       TransportConfig
	tlsConfig       *tls.Config
	ctx             context.Context
	cancel          context.CancelFunc
	carrier         net.Listener
	rules           map[int64]*ruleRuntime
	sessions        map[*securelink.Session]bool
	dialMu          sync.Mutex
	session         *securelink.Session
	handshakes      chan struct{}
	handshakeBudget handshakeBudget
	connected       atomic.Bool
	carrierStarted  bool
	flows           chan struct{}
	identityExpires time.Time
}
type ruleRuntime struct {
	placement              *placement
	binding                Binding
	template               TrafficSample
	mu                     sync.Mutex
	tcp                    net.Listener
	udp                    *net.UDPConn
	ctx                    context.Context
	cancel                 context.CancelFunc
	conns                  map[net.Conn]bool
	perIP                  map[string]int
	active                 int
	associations           map[string]*association
	limitIn, limitOut      limiter
	target                 TargetStatus
	tcpStarted, udpStarted bool
}
type association struct {
	stream *securelink.Stream
	remote *net.UDPAddr
	queue  chan []byte
	last   atomic.Int64
}

func newPlacement(m *Manager, c Config, t TransportConfig) (*placement, error) {
	cfg, e := securelink.TLSConfig(t.Identity)
	if e != nil {
		return nil, ErrInvalidConfig
	}
	certificate, e := x509.ParseCertificate(cfg.Certificates[0].Certificate[0])
	if e != nil || time.Now().Before(certificate.NotBefore) || !time.Now().Before(certificate.NotAfter) {
		return nil, ErrIdentityMismatch
	}
	ctx, cancel := context.WithDeadline(context.Background(), certificate.NotAfter)
	p := &placement{manager: m, config: c, transport: t, tlsConfig: cfg, ctx: ctx, cancel: cancel, rules: map[int64]*ruleRuntime{}, sessions: map[*securelink.Session]bool{}, handshakes: make(chan struct{}, 8), flows: make(chan struct{}, 256)}
	p.identityExpires = certificate.NotAfter
	if c.Role == "egress" {
		p.carrier, e = net.Listen("tcp", net.JoinHostPort(t.CarrierHost, strconv.Itoa(t.CarrierPort)))
		if e != nil {
			cancel()
			return nil, ErrStartFailed
		}
	}
	for _, b := range t.Bindings {
		r, re := p.newRule(b)
		if re != nil {
			p.close()
			return nil, re
		}
		p.rules[b.ForwardID] = r
	}
	if p.carrier != nil {
		go p.acceptCarrier()
	}
	p.startRules()
	if c.Role == "ingress" && len(t.Bindings) > 0 {
		p.carrierStarted = true
		go p.maintainCarrier()
	}
	go func() { <-p.ctx.Done(); p.close() }()
	return p, nil
}
func (p *placement) newRule(b Binding) (*ruleRuntime, error) {
	ctx, cancel := context.WithCancel(p.ctx)
	r := &ruleRuntime{placement: p, binding: b, ctx: ctx, cancel: cancel, conns: map[net.Conn]bool{}, perIP: map[string]int{}, associations: map[string]*association{}, limitIn: limiter{rate: b.BytesPerSecondIn}, limitOut: limiter{rate: b.BytesPerSecondOut}, target: TargetStatus{ForwardID: b.ForwardID, States: []string{"unknown"}, Reason: "initial"}}
	if p.config.Role == "ingress" {
		r.template = TrafficSample{ProducerID: producerID(), LinkID: p.config.LinkID, WorkspaceID: p.config.WorkspaceID, NodeID: p.config.NodeID, ForwardID: b.ForwardID, Generation: p.config.Generation, ConfigDigest: p.config.ConfigDigest}
		if r.template.ProducerID == "" {
			cancel()
			return nil, ErrStartFailed
		}
		address := net.JoinHostPort(b.ListenHost, strconv.Itoa(b.ListenPort))
		var e error
		if b.Protocol == "tcp" || b.Protocol == "both" {
			r.tcp, e = net.Listen("tcp", address)
			if e != nil {
				cancel()
				return nil, ErrStartFailed
			}
		}
		if b.Protocol == "udp" || b.Protocol == "both" {
			a, e := net.ResolveUDPAddr("udp", address)
			if e != nil {
				r.close()
				return nil, ErrStartFailed
			}
			r.udp, e = net.ListenUDP("udp", a)
			if e != nil {
				r.close()
				return nil, ErrStartFailed
			}
		}
	}
	return r, nil
}
func (p *placement) startRules() {
	for _, r := range p.rules {
		r.start()
	}
}
func (r *ruleRuntime) start() {
	if r.tcp != nil && !r.tcpStarted {
		r.tcpStarted = true
		go r.acceptTCP(r.tcp)
	}
	if r.udp != nil && !r.udpStarted {
		r.udpStarted = true
		go r.acceptUDP(r.udp)
	}
}
func (p *placement) snapshot() Config { p.mu.Lock(); defer p.mu.Unlock(); return cloneConfig(p.config) }
func (p *placement) ready() bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.ctx.Err() != nil {
		return false
	}
	if p.config.Role == "egress" {
		return p.carrier != nil
	}
	return len(p.rules) > 0 && p.connected.Load()
}
func (p *placement) compatible(t TransportConfig) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	a, b := p.transport, t
	a.Bindings = nil
	b.Bindings = nil
	return reflect.DeepEqual(a, b)
}
func (p *placement) update(c Config, t TransportConfig) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	created := map[int64]*ruleRuntime{}
	for _, b := range t.Bindings {
		old := p.rules[b.ForwardID]
		if old != nil && old.binding == b {
			created[b.ForwardID] = old
			continue
		}
		// Unchanged listener addresses can retain their socket while only this
		// rule's active flows are drained. Sibling rules and carrier remain alive.
		if old != nil && old.binding.ListenHost == b.ListenHost && old.binding.ListenPort == b.ListenPort && old.binding.Protocol == b.Protocol {
			ctx, cancel := context.WithCancel(p.ctx)
			r := &ruleRuntime{placement: p, binding: b, ctx: ctx, cancel: cancel, conns: map[net.Conn]bool{}, perIP: map[string]int{}, associations: map[string]*association{}, limitIn: limiter{rate: b.BytesPerSecondIn}, limitOut: limiter{rate: b.BytesPerSecondOut}, target: TargetStatus{ForwardID: b.ForwardID, States: []string{"unknown"}, Reason: "initial"}}
			if c.Role == "ingress" {
				r.template = TrafficSample{ProducerID: producerID(), LinkID: c.LinkID, WorkspaceID: c.WorkspaceID, NodeID: c.NodeID, ForwardID: b.ForwardID, Generation: c.Generation, ConfigDigest: c.ConfigDigest}
			}
			if c.Role == "ingress" && r.template.ProducerID == "" {
				cancel()
				for id, n := range created {
					if n != p.rules[id] {
						n.close()
					}
				}
				return ErrStartFailed
			}
			created[b.ForwardID] = r
			continue
		}
		oldConfig := p.config
		p.config = c
		r, e := p.newRule(b)
		p.config = oldConfig
		if e != nil {
			for id, n := range created {
				if n != p.rules[id] {
					n.close()
				}
			}
			return e
		}
		created[b.ForwardID] = r
	}
	for id, old := range p.rules {
		replacement := created[id]
		if replacement == old {
			continue
		}
		if replacement != nil && old.binding.ListenHost == replacement.binding.ListenHost && old.binding.ListenPort == replacement.binding.ListenPort && old.binding.Protocol == replacement.binding.Protocol {
			// Transfer sockets by replacing the rule behind a stable listener owner.
			// Existing accept loops consult replacement through currentRule().
			replacement.tcp = old.tcp
			replacement.udp = old.udp
			replacement.tcpStarted = old.tcpStarted
			replacement.udpStarted = old.udpStarted
			old.tcp = nil
			old.udp = nil
		}
		old.close()
	}
	p.rules = created
	p.config = c
	p.transport = t
	for id, r := range created {
		_ = id
		if r.tcp != nil || r.udp != nil {
			r.start()
		}
	}
	if c.Role == "ingress" && len(created) > 0 && !p.carrierStarted {
		p.carrierStarted = true
		go p.maintainCarrier()
	}
	return nil
}
func (p *placement) producers() []string {
	p.mu.Lock()
	defer p.mu.Unlock()
	ids := []string{}
	for _, r := range p.rules {
		if r.template.ProducerID != "" {
			ids = append(ids, r.template.ProducerID)
		}
	}
	return ids
}
func (p *placement) targets() []TargetStatus {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.config.Role != "egress" {
		return nil
	}
	out := make([]TargetStatus, 0, len(p.rules))
	for _, r := range p.rules {
		r.mu.Lock()
		t := r.target
		t.States = append([]string(nil), t.States...)
		r.mu.Unlock()
		out = append(out, t)
	}
	return out
}
func (p *placement) close() {
	p.cancel()
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.carrier != nil {
		p.carrier.Close()
	}
	for _, r := range p.rules {
		r.close()
	}
	for s := range p.sessions {
		s.Close()
	}
	p.connected.Store(false)
}
func (r *ruleRuntime) close() {
	r.cancel()
	if r.tcp != nil {
		r.tcp.Close()
	}
	if r.udp != nil {
		r.udp.Close()
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	for c := range r.conns {
		c.Close()
	}
	for _, a := range r.associations {
		if a.stream != nil {
			a.stream.Close()
		}
	}
}
func (p *placement) acceptCarrier() {
	for {
		c, e := p.carrier.Accept()
		if e != nil {
			return
		}
		if !p.handshakeBudget.allow(time.Now()) {
			c.Close()
			continue
		}
		select {
		case p.handshakes <- struct{}{}:
			go func() {
				defer func() { <-p.handshakes }()
				tlsConn := tls.Server(c, p.tlsConfig)
				ctx, cancel := context.WithTimeout(p.ctx, 5*time.Second)
				defer cancel()
				if tlsConn.HandshakeContext(ctx) != nil {
					c.Close()
					return
				}
				p.mu.Lock()
				if p.ctx.Err() != nil || len(p.sessions) >= 4 {
					p.mu.Unlock()
					c.Close()
					return
				}
				s := securelink.NewSession(tlsConn, true)
				p.sessions[s] = true
				p.mu.Unlock()
				stopExpiry := expireAuthenticatedSession(s, tlsConn)
				defer stopExpiry()
				defer func() { s.Close(); p.mu.Lock(); delete(p.sessions, s); p.mu.Unlock() }()
				for {
					stream, e := s.Accept(p.ctx)
					if e != nil {
						return
					}
					go p.egressStream(stream)
				}
			}()
		default:
			c.Close()
		}
	}
}

// Charge every accepted socket before TLS work, including failed handshakes.
// Concurrent and rate bounds address different costs of unauthenticated peers.
type handshakeBudget struct {
	mu     sync.Mutex
	tokens float64
	last   time.Time
}

func (b *handshakeBudget) allow(now time.Time) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.last.IsZero() {
		b.tokens = handshakeBurst
		b.last = now
	} else if now.After(b.last) {
		b.tokens = min(float64(handshakeBurst), b.tokens+now.Sub(b.last).Seconds()*handshakesPerSecond)
		b.last = now
	}
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}
func (p *placement) getSession(ctx context.Context) (*securelink.Session, error) {
	p.dialMu.Lock()
	defer p.dialMu.Unlock()
	if p.session != nil {
		select {
		case <-p.session.Done():
			p.connected.Store(false)
			p.session = nil
		default:
			return p.session, nil
		}
	}
	if p.ctx.Err() != nil {
		return nil, ErrClosed
	}
	dial := tls.Dialer{NetDialer: &net.Dialer{Timeout: 5 * time.Second}, Config: p.tlsConfig}
	p.mu.Lock()
	address := net.JoinHostPort(p.transport.CarrierHost, strconv.Itoa(p.transport.CarrierPort))
	p.mu.Unlock()
	c, e := dial.DialContext(ctx, "tcp", address)
	if e != nil {
		return nil, ErrStartFailed
	}
	s := securelink.NewSession(c, false)
	p.mu.Lock()
	if p.ctx.Err() != nil {
		p.mu.Unlock()
		s.Close()
		return nil, ErrClosed
	}
	p.sessions[s] = true
	p.session = s
	p.mu.Unlock()
	p.connected.Store(true)
	stopExpiry := expireAuthenticatedSession(s, c.(*tls.Conn))
	go func() {
		<-s.Done()
		stopExpiry()
		p.dialMu.Lock()
		if p.session == s {
			p.connected.Store(false)
		}
		p.mu.Lock()
		delete(p.sessions, s)
		p.mu.Unlock()
		p.dialMu.Unlock()
	}()
	return s, nil
}

func expireAuthenticatedSession(s *securelink.Session, c *tls.Conn) func() {
	state := c.ConnectionState()
	if len(state.PeerCertificates) == 0 {
		s.Close()
		return func() {}
	}
	timer := time.AfterFunc(time.Until(state.PeerCertificates[0].NotAfter), func() { s.Close() })
	return func() { timer.Stop() }
}
func (p *placement) maintainCarrier() {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		ctx, cancel := context.WithTimeout(p.ctx, 5*time.Second)
		_, _ = p.getSession(ctx)
		cancel()
		select {
		case <-p.ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
func (r *ruleRuntime) admit(c net.Conn, ip string) bool {
	select {
	case r.placement.flows <- struct{}{}:
	default:
		return false
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	max := r.binding.MaxConnections
	if max == 0 {
		max = 256
	}
	perIP := r.binding.MaxConnectionsPerIP
	if perIP == 0 {
		perIP = 64
	}
	if r.ctx.Err() != nil || r.active >= max || r.perIP[ip] >= perIP {
		<-r.placement.flows
		return false
	}
	r.active++
	r.perIP[ip]++
	if c != nil {
		r.conns[c] = true
	}
	return true
}
func (r *ruleRuntime) release(c net.Conn, ip string) {
	<-r.placement.flows
	r.mu.Lock()
	defer r.mu.Unlock()
	if c != nil {
		delete(r.conns, c)
	}
	if r.active > 0 {
		r.active--
	}
	if r.perIP[ip] > 1 {
		r.perIP[ip]--
	} else {
		delete(r.perIP, ip)
	}
}
func (r *ruleRuntime) acceptTCP(listener net.Listener) {
	for {
		c, e := listener.Accept()
		if e != nil {
			return
		}
		r.placement.mu.Lock()
		current := r.placement.rules[r.binding.ForwardID]
		r.placement.mu.Unlock()
		if current == nil {
			c.Close()
			continue
		}
		ip, _, _ := net.SplitHostPort(c.RemoteAddr().String())
		if !current.admit(c, ip) {
			c.Close()
			continue
		}
		go current.ingressTCP(c, ip)
	}
}
func (r *ruleRuntime) ingressTCP(c net.Conn, ip string) {
	defer c.Close()
	defer r.release(c, ip)
	ctx, cancel := context.WithTimeout(r.ctx, 10*time.Second)
	defer cancel()
	session, e := r.placement.getSession(ctx)
	if e != nil {
		return
	}
	stream, e := session.Open(ctx, securelink.OpenRequest{ForwardID: r.binding.ForwardID, Revision: r.binding.Revision, Protocol: "tcp"})
	if e != nil {
		return
	}
	defer stream.Close()
	r.mu.Lock()
	if r.ctx.Err() != nil {
		r.mu.Unlock()
		return
	}
	r.conns[stream] = true
	r.mu.Unlock()
	defer func() { r.mu.Lock(); delete(r.conns, stream); r.mu.Unlock() }()
	if r.placement.manager.account(r.template, 0, 0, 1) != nil {
		return
	}
	bridge(r, c, stream, true)
}
func (p *placement) egressStream(s *securelink.Stream) {
	defer s.Close()
	req := s.Request()
	p.mu.Lock()
	r := p.rules[req.ForwardID]
	p.mu.Unlock()
	if r == nil || r.binding.Revision != req.Revision || (r.binding.Protocol != req.Protocol && r.binding.Protocol != "both") || !r.admit(s, "peer") {
		s.Reject("tst_rule_unauthorized")
		return
	}
	defer r.release(s, "peer")
	ctx, cancel := context.WithTimeout(r.ctx, 5*time.Second)
	defer cancel()
	c, e := (&net.Dialer{}).DialContext(ctx, req.Protocol, net.JoinHostPort(r.binding.TargetHost, strconv.Itoa(r.binding.TargetPort)))
	if e != nil {
		r.observeTarget(false, req.Protocol)
		s.Reject("tst_target_unavailable")
		return
	}
	defer c.Close()
	r.mu.Lock()
	if r.ctx.Err() != nil {
		r.mu.Unlock()
		return
	}
	r.conns[c] = true
	r.mu.Unlock()
	defer func() { r.mu.Lock(); delete(r.conns, c); r.mu.Unlock() }()
	if s.Accept() != nil {
		return
	}
	if req.Protocol == "tcp" {
		r.observeTarget(true, "tcp")
		bridge(r, s, c, false)
	} else {
		r.egressUDP(s, c)
	}
}
func (r *ruleRuntime) observeTarget(ok bool, protocol string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	stamp := time.Now().UTC().Format(time.RFC3339Nano)
	r.target.LastCheckedAt = &stamp
	if ok {
		r.target.States = []string{"healthy"}
		r.target.Reason = "selected"
		zero := 0
		if protocol == "tcp" {
			r.target.SelectedTCP = &zero
		} else {
			r.target.SelectedUDP = &zero
		}
	} else {
		r.target.States = []string{"unhealthy"}
		r.target.Reason = "target_failed"
		r.target.SelectedTCP = nil
		r.target.SelectedUDP = nil
	}
}
func bridge(r *ruleRuntime, a, b net.Conn, account bool) {
	done := make(chan error, 2)
	copySide := func(dst, src net.Conn, in bool) {
		buf := make([]byte, 16<<10)
		for {
			n, e := src.Read(buf)
			if n > 0 {
				limit := &r.limitOut
				if in {
					limit = &r.limitIn
				}
				if le := limit.wait(r.ctx, n); le != nil {
					done <- le
					return
				}
				written, we := dst.Write(buf[:n])
				if account && written > 0 {
					var ai, ao int64
					if in {
						ai = int64(written)
					} else {
						ao = int64(written)
					}
					if ae := r.placement.manager.account(r.template, ai, ao, 0); ae != nil {
						done <- ae
						return
					}
				}
				if we != nil {
					done <- we
					return
				}
				if written != n {
					done <- io.ErrShortWrite
					return
				}
			}
			if e != nil {
				if e == io.EOF {
					if half, ok := dst.(interface{ CloseWrite() error }); ok {
						_ = half.CloseWrite()
					}
				}
				done <- e
				return
			}
		}
	}
	go copySide(b, a, true)
	go copySide(a, b, false)
	e := <-done
	if e != io.EOF {
		a.Close()
		b.Close()
	}
	select {
	case <-done:
	case <-r.ctx.Done():
		a.Close()
		b.Close()
		<-done
	}
}
func (r *ruleRuntime) acceptUDP(conn *net.UDPConn) {
	buf := make([]byte, 65507)
	for {
		n, addr, e := conn.ReadFromUDP(buf)
		if e != nil {
			return
		}
		r.placement.mu.Lock()
		current := r.placement.rules[r.binding.ForwardID]
		r.placement.mu.Unlock()
		if current != nil {
			current.receiveUDP(conn, addr, append([]byte(nil), buf[:n]...))
		}
	}
}
func (r *ruleRuntime) receiveUDP(conn *net.UDPConn, addr *net.UDPAddr, data []byte) {
	key := addr.String()
	ip := addr.IP.String()
	r.mu.Lock()
	a := r.associations[key]
	if a != nil {
		a.last.Store(time.Now().UnixNano())
		select {
		case a.queue <- data:
		default:
		}
		r.mu.Unlock()
		return
	}
	r.mu.Unlock()
	if !r.admit(nil, ip) {
		return
	}
	a = &association{remote: addr, queue: make(chan []byte, 4)}
	a.last.Store(time.Now().UnixNano())
	r.mu.Lock()
	if r.ctx.Err() != nil {
		r.mu.Unlock()
		r.release(nil, ip)
		return
	}
	if existing := r.associations[key]; existing != nil {
		r.mu.Unlock()
		r.release(nil, ip)
		return
	}
	r.associations[key] = a
	r.mu.Unlock()
	a.queue <- data
	go r.ingressUDP(conn, key, ip, a)
}
func (r *ruleRuntime) ingressUDP(conn *net.UDPConn, key, ip string, a *association) {
	defer r.release(nil, ip)
	defer func() { r.mu.Lock(); delete(r.associations, key); r.mu.Unlock() }()
	ctx, cancel := context.WithTimeout(r.ctx, 10*time.Second)
	defer cancel()
	s, e := r.placement.getSession(ctx)
	if e != nil {
		return
	}
	stream, e := s.Open(ctx, securelink.OpenRequest{ForwardID: r.binding.ForwardID, Revision: r.binding.Revision, Protocol: "udp"})
	if e != nil {
		return
	}
	defer stream.Close()
	flowCtx, cancelFlow := udpIdleContext(r.ctx, r.placement.manager.udpIdle, &a.last)
	defer cancelFlow()
	context.AfterFunc(flowCtx, func() { stream.Close() })
	r.mu.Lock()
	if r.ctx.Err() != nil {
		r.mu.Unlock()
		return
	}
	a.stream = stream
	r.mu.Unlock()
	if r.placement.manager.account(r.template, 0, 0, 1) != nil {
		return
	}
	done := make(chan struct{})
	go func() {
		defer close(done)
		buf := make([]byte, 65507)
		for {
			n, e := stream.ReadDatagram(buf)
			if e != nil {
				return
			}
			if r.limitOut.wait(flowCtx, n) != nil {
				return
			}
			written, e := conn.WriteToUDP(buf[:n], a.remote)
			if e != nil {
				return
			}
			a.last.Store(time.Now().UnixNano())
			if r.placement.manager.account(r.template, 0, int64(written), 0) != nil {
				return
			}
		}
	}()
	defer func() { cancelFlow(); stream.Close(); <-done }()
	for {
		select {
		case data := <-a.queue:
			if r.limitIn.wait(flowCtx, len(data)) != nil {
				return
			}
			if stream.WriteDatagram(data) != nil {
				return
			}
			if r.placement.manager.account(r.template, int64(len(data)), 0, 0) != nil {
				return
			}
		case <-done:
			return
		case <-flowCtx.Done():
			return
		}
	}
}
func (r *ruleRuntime) egressUDP(s *securelink.Stream, c net.Conn) {
	var last atomic.Int64
	last.Store(time.Now().UnixNano())
	flowCtx, cancelFlow := udpIdleContext(r.ctx, r.placement.manager.udpIdle, &last)
	defer cancelFlow()
	context.AfterFunc(flowCtx, func() { c.Close(); s.Close() })
	done := make(chan error, 2)
	go func() {
		buf := make([]byte, 65507)
		for {
			n, e := s.ReadDatagram(buf)
			if e != nil {
				done <- e
				return
			}
			last.Store(time.Now().UnixNano())
			if e = r.limitIn.wait(flowCtx, n); e != nil {
				done <- e
				return
			}
			if _, e = c.Write(buf[:n]); e != nil {
				r.observeTarget(false, "udp")
				done <- e
				return
			}
		}
	}()
	go func() {
		buf := make([]byte, 65507)
		for {
			n, e := c.Read(buf)
			if e != nil {
				done <- e
				return
			}
			last.Store(time.Now().UnixNano())
			r.observeTarget(true, "udp")
			if e = r.limitOut.wait(flowCtx, n); e != nil {
				done <- e
				return
			}
			if e = s.WriteDatagram(buf[:n]); e != nil {
				done <- e
				return
			}
		}
	}()
	<-done
	cancelFlow()
	c.Close()
	s.Close()
	<-done
}

// Either direction keeps a UDP association alive. A single activity deadline
// also cancels a rate limiter or blocked writer, rather than waiting for a
// response from an application that may intentionally send none.
func udpIdleContext(parent context.Context, idle time.Duration, last *atomic.Int64) (context.Context, context.CancelFunc) {
	ctx, cancel := context.WithCancel(parent)
	interval := min(time.Second, idle/4)
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				if time.Since(time.Unix(0, last.Load())) >= idle {
					cancel()
					return
				}
			case <-ctx.Done():
				return
			}
		}
	}()
	return ctx, cancel
}

type limiter struct {
	mu   sync.Mutex
	rate int64
	next time.Time
}

func (l *limiter) wait(ctx context.Context, n int) error {
	if l.rate == 0 || n == 0 {
		return nil
	}
	l.mu.Lock()
	now := time.Now()
	start := l.next
	if start.Before(now) {
		start = now
	}
	duration := time.Duration((int64(n)*int64(time.Second) + l.rate - 1) / l.rate)
	l.next = start.Add(duration)
	wait := time.Until(l.next)
	l.mu.Unlock()
	timer := time.NewTimer(wait)
	defer timer.Stop()
	select {
	case <-timer.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
