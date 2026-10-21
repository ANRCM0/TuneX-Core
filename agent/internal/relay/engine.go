package relay

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/adp3relay"
	"github.com/tunex/vnext/agent/internal/egress"
	"github.com/tunex/vnext/agent/internal/executionhost"
	"github.com/tunex/vnext/agent/internal/forward"
	"github.com/tunex/vnext/agent/internal/payloadstats"
	"github.com/tunex/vnext/agent/internal/relaycontracts"
	"io"
	"net"
	"net/netip"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

type Identity struct {
	Certificate tls.Certificate
	Roots       *x509.CertPool
}
type Engine struct {
	payload         *payloadstats.Counters
	payloadGate     executionhost.PayloadGate
	multihop        *adp3.HopConfig
	assignment      adp3relay.Assignment
	identity        Identity
	credentialUntil time.Time
	peers           map[*tls.Conn]time.Time
	ctx             context.Context
	cancel          context.CancelFunc
	mutex           sync.Mutex
	authorization   sync.RWMutex
	allow           func() error
	active          bool
	listener        net.Listener
	udp             *net.UDPConn
	connections     map[net.Conn]net.Conn
	sessions        map[netip.AddrPort]*association
	maximum         int
	workers         sync.WaitGroup
	stopOnce        sync.Once
	guardDone       chan struct{}
	draining        bool
	drainUntil      time.Time
	rejected        atomic.Uint64
	dropped         atomic.Uint64
}
type association struct {
	engine     *Engine
	client     netip.AddrPort
	queue      chan []byte
	connection *tls.Conn
	last       time.Time
	credit     int
	cancel     context.CancelFunc
	ctx        context.Context
}

var nodeMutex sync.Mutex
var nodeConnections int

func acquireNode(maximum int, protocol string) (func(), error) {
	nodeMutex.Lock()
	defer nodeMutex.Unlock()
	if nodeConnections >= maximum || nodeConnections >= 4096 {
		return nil, fmt.Errorf("RESOURCE_LIMIT")
	}
	tcpRelease, err := forward.AcquireNodeBudget("tcp")
	if err != nil {
		return nil, err
	}
	udpRelease := func() {}
	if protocol == "udp" {
		udpRelease, err = forward.AcquireNodeBudget("udp")
		if err != nil {
			tcpRelease()
			return nil, err
		}
	}
	nodeConnections++
	var once sync.Once
	return func() {
		once.Do(func() { tcpRelease(); udpRelease(); nodeMutex.Lock(); nodeConnections--; nodeMutex.Unlock() })
	}, nil
}
func Prepare(assignment adp3relay.Assignment, identity Identity, maximum int, allow func() error) (*Engine, error) {
	return prepare(assignment, identity, maximum, allow, nil)
}

// PrepareMetered installs the machine's payload gate before any peer listener.
// TLS, Open/Accept/Probe and frame control never consume payload credit.
func PrepareMetered(assignment adp3relay.Assignment, identity Identity, maximum int, allow func() error, gate executionhost.PayloadGate) (*Engine, error) {
	return prepareWithPayload(assignment, identity, maximum, allow, nil, gate)
}
func prepare(assignment adp3relay.Assignment, identity Identity, maximum int, allow func() error, hop *adp3.HopConfig) (*Engine, error) {
	return prepareWithPayload(assignment, identity, maximum, allow, hop, nil)
}
func prepareWithPayload(assignment adp3relay.Assignment, identity Identity, maximum int, allow func() error, hop *adp3.HopConfig, gate executionhost.PayloadGate) (*Engine, error) {
	raw, err := json.Marshal(assignment)
	if err != nil {
		return nil, err
	}
	var checked adp3relay.Assignment
	if err := adp3relay.Parse("Assignment", raw, &checked); err != nil {
		return nil, err
	}
	if identity.Roots == nil {
		return nil, fmt.Errorf("AUTHENTICATION_FAILED: Trusted peer CA required")
	}
	if checked.Phase != "prepared" || maximum < 1 || maximum > 4096 || allow == nil {
		return nil, fmt.Errorf("INVALID_CONFIG: Prepared authorized Relay required")
	}
	if err := allow(); err != nil {
		return nil, err
	}
	leaf := identity.Certificate.Leaf
	if leaf == nil && len(identity.Certificate.Certificate) > 0 {
		leaf, err = x509.ParseCertificate(identity.Certificate.Certificate[0])
		if err != nil {
			return nil, err
		}
	}
	if leaf == nil || leaf.IsCA || !time.Now().Before(leaf.NotAfter) || !slices.Contains(leaf.ExtKeyUsage, x509.ExtKeyUsageClientAuth) || !slices.Contains(leaf.ExtKeyUsage, x509.ExtKeyUsageServerAuth) || len(leaf.URIs) != 1 || leaf.URIs[0].String() != "urn:tunex:node:"+checked.NodeId {
		return nil, fmt.Errorf("AUTHENTICATION_FAILED: Local Node identity differs")
	}
	localConfig, err := TLSConfig(identity.Certificate, identity.Roots, checked.NodeId, []string{Fingerprint(leaf)}, true)
	if err != nil {
		return nil, err
	}
	state := tls.ConnectionState{Version: tls.VersionTLS13, NegotiatedProtocol: ALPN, PeerCertificates: []*x509.Certificate{leaf}}
	if err := localConfig.VerifyConnection(state); err != nil {
		return nil, err
	}
	identity.Roots = identity.Roots.Clone()
	ctx, cancel := context.WithCancel(context.Background())
	engine := &Engine{payloadGate: gate, multihop: hop, assignment: checked, identity: identity, credentialUntil: leaf.NotAfter, peers: map[*tls.Conn]time.Time{}, ctx: ctx, cancel: cancel, allow: allow, maximum: maximum, connections: map[net.Conn]net.Conn{}, sessions: map[netip.AddrPort]*association{}, guardDone: make(chan struct{})}
	if checked.Role == "relay-ingress" {
		engine.payload = payloadstats.New()
	}
	if checked.Role == "relay-egress" {
		listener, err := net.Listen("tcp", net.JoinHostPort(checked.Resource.Address, fmt.Sprint(checked.Resource.Port)))
		if err != nil {
			cancel()
			return nil, err
		}
		if err := engine.check(); err != nil {
			listener.Close()
			cancel()
			return nil, err
		}
		engine.listener = listener
		engine.workers.Add(1)
		go engine.acceptPeers()
	}
	go engine.watch()
	return engine, nil
}

// Operational payload telemetry remains ingress-only. The independent durable
// payload gate applies to every metered machine, including transit and egress.
func (e *Engine) PayloadCounters() (payloadstats.Snapshot, bool) {
	return e.payload.Snapshot()
}
func (e *Engine) check() error {
	if e.ctx.Err() != nil || !time.Now().Before(e.credentialUntil) {
		return fmt.Errorf("LEASE_EXPIRED")
	}
	e.authorization.RLock()
	check := e.allow
	until := e.drainUntil
	e.authorization.RUnlock()
	if !until.IsZero() && !time.Now().Before(until) {
		return fmt.Errorf("LEASE_EXPIRED: drain ended")
	}
	return check()
}
func (e *Engine) SetAuthorization(check func() error) {
	if check == nil {
		e.stop()
		return
	}
	e.mutex.Lock()
	if e.draining {
		e.mutex.Unlock()
		return
	}
	e.authorization.Lock()
	e.allow = check
	e.authorization.Unlock()
	e.mutex.Unlock()
}
func (e *Engine) watch() {
	defer close(e.guardDone)
	ticker := time.NewTicker(25 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-e.ctx.Done():
			return
		case <-ticker.C:
			e.mutex.Lock()
			for peer, until := range e.peers {
				if !time.Now().Before(until) {
					closeSocket(peer)
				}
			}
			e.mutex.Unlock()
			if e.check() != nil {
				e.stop()
				return
			}
		}
	}
}
func (e *Engine) Activate() error {
	if err := e.check(); err != nil {
		return err
	}
	e.mutex.Lock()
	if e.active {
		e.mutex.Unlock()
		if e.hasDownstream() {
			peer, err := e.dialPeer("probe")
			if err != nil {
				return err
			}
			closeSocket(peer)
			e.untrackPeer(peer)
		}
		return e.check()
	}
	if e.ctx.Err() != nil || e.draining {
		e.mutex.Unlock()
		return fmt.Errorf("LEASE_EXPIRED")
	}
	e.mutex.Unlock()
	if e.hasDownstream() {
		peer, err := e.dialPeer("probe")
		if err != nil {
			return err
		}
		closeSocket(peer)
		e.untrackPeer(peer)
	}
	e.mutex.Lock()
	defer e.mutex.Unlock()
	if err := e.check(); err != nil {
		return err
	}
	if e.active {
		return nil
	}
	if e.assignment.Role == "relay-ingress" {
		address := net.JoinHostPort(e.assignment.Resource.Address, fmt.Sprint(e.assignment.Resource.Port))
		if e.assignment.Protocol == "tcp" {
			listener, err := net.Listen("tcp", address)
			if err != nil {
				return err
			}
			if err := e.check(); err != nil {
				listener.Close()
				return err
			}
			e.listener = listener
			e.workers.Add(1)
			go e.acceptClients()
		} else {
			address, err := net.ResolveUDPAddr("udp", address)
			if err != nil {
				return err
			}
			socket, err := net.ListenUDP("udp", address)
			if err != nil {
				return err
			}
			if err := e.check(); err != nil {
				socket.Close()
				return err
			}
			e.udp = socket
			e.workers.Add(1)
			go e.receiveClients()
		}
	}
	e.active = true
	return nil
}
func (e *Engine) Remaining() uint64 {
	e.mutex.Lock()
	defer e.mutex.Unlock()
	return uint64(len(e.connections) + len(e.sessions))
}
func (e *Engine) Rejected() uint64 { return e.rejected.Load() }

// Drain closes acceptance but preserves already established TCP within its original authority and bounded deadline.
func (e *Engine) Drain() {
	if e.assignment.Protocol == "udp" {
		e.Close()
		return
	}
	e.mutex.Lock()
	if e.draining {
		e.mutex.Unlock()
		return
	}
	e.draining = true
	e.active = false
	if e.listener != nil {
		e.listener.Close()
	}
	e.authorization.Lock()
	e.drainUntil = time.Now().Add(time.Duration(e.assignment.DrainTimeoutSeconds) * time.Second)
	e.authorization.Unlock()
	e.mutex.Unlock()
}
func (e *Engine) Close() { e.stop(); e.workers.Wait(); <-e.guardDone }
func (e *Engine) stop() {
	e.stopOnce.Do(func() {
		e.mutex.Lock()
		defer e.mutex.Unlock()
		e.cancel()
		e.active = false
		if e.listener != nil {
			e.listener.Close()
		}
		if e.udp != nil {
			e.udp.Close()
		}
		for client, target := range e.connections {
			closeSocket(client)
			if target != nil {
				closeSocket(target)
			}
		}
		for peer := range e.peers {
			closeSocket(peer)
		}
		for _, session := range e.sessions {
			session.cancel()
			if session.connection != nil {
				closeSocket(session.connection)
			}
		}
	})
}
func (e *Engine) acceptPeers() {
	defer e.workers.Done()
	for {
		client, err := e.listener.Accept()
		if err != nil {
			return
		}
		e.mutex.Lock()
		if e.draining || e.check() != nil || len(e.connections) >= e.maximum {
			e.mutex.Unlock()
			closeSocket(client)
			e.rejected.Add(1)
			continue
		}
		release, err := acquireNode(int(e.assignment.Driver.Config.Profile.MaxConnectionsPerNode), e.assignment.Protocol)
		if err != nil {
			e.mutex.Unlock()
			closeSocket(client)
			e.rejected.Add(1)
			continue
		}
		e.connections[client] = nil
		e.workers.Add(1)
		e.mutex.Unlock()
		go func() {
			defer e.workers.Done()
			defer release()
			defer func() { closeSocket(client); e.mutex.Lock(); delete(e.connections, client); e.mutex.Unlock() }()
			e.servePeer(client)
		}()
	}
}
func (e *Engine) servePeer(client net.Conn) {
	config := e.assignment.Driver.Config
	tlsConfig, err := e.peerTLS(false)
	if err != nil {
		e.rejected.Add(1)
		return
	}
	connection := tls.Server(client, tlsConfig)
	defer connection.Close()
	defer e.untrackPeer(connection)
	connection.SetDeadline(time.Now().Add(time.Duration(config.Profile.HandshakeTimeoutSeconds) * time.Second))
	if err := connection.HandshakeContext(e.ctx); err != nil {
		e.rejected.Add(1)
		return
	}
	e.trackPeer(connection)
	open, err := e.readOpen(connection)
	if err != nil {
		e.rejected.Add(1)
		return
	}
	expected, err := e.wireBinding(false)
	if err != nil {
		return
	}
	e.mutex.Lock()
	active := e.active
	e.mutex.Unlock()
	if err := ValidateOpen(open, expected, active, e.check); err != nil {
		e.rejected.Add(1)
		code := strings.Split(err.Error(), ":")[0]
		if !slices.Contains([]string{"AUTHENTICATION_FAILED", "AUTHORIZATION_DENIED", "STALE_DEPLOYMENT", "DOWNSTREAM_NOT_ACTIVE", "UNSUPPORTED_CAPABILITY", "RESOURCE_LIMIT"}, code) {
			code = "AUTHORIZATION_DENIED"
		}
		WriteControl(connection, "Reject", relaycontracts.Reject{WireVersion: 1, Type: "rejected", RequestId: open.RequestId, Code: code, Retryable: code == "DOWNSTREAM_NOT_ACTIVE" || code == "RESOURCE_LIMIT"})
		return
	}
	if open.Action != "probe" && open.Action != e.assignment.Protocol {
		e.rejected.Add(1)
		return
	}
	hash, err := e.wireDigest(expected)
	if err != nil {
		return
	}
	if open.Action == "probe" {
		if e.multihop != nil && e.hasDownstream() {
			peer, err := e.dialPeer("probe")
			if err != nil {
				WriteControl(connection, "Reject", relaycontracts.Reject{WireVersion: 1, Type: "rejected", RequestId: open.RequestId, Code: "DOWNSTREAM_NOT_ACTIVE", Retryable: true})
				return
			}
			closeSocket(peer)
			e.untrackPeer(peer)
		}
		WriteControl(connection, "Accept", relaycontracts.Accept{WireVersion: 1, Type: "accepted", RequestId: open.RequestId, BindingDigest: hash})
		return
	}
	if e.multihop != nil && e.hasDownstream() {
		e.serveTransit(client, connection, open, hash)
		return
	}
	target, err := e.dialTarget(e.assignment.Protocol, *config.Target)
	if err != nil {
		e.rejected.Add(1)
		WriteControl(connection, "Reject", relaycontracts.Reject{WireVersion: 1, Type: "rejected", RequestId: open.RequestId, Code: "TARGET_UNAVAILABLE", Retryable: true})
		return
	}
	defer closeSocket(target)
	e.mutex.Lock()
	if e.check() != nil {
		e.mutex.Unlock()
		return
	}
	e.connections[client] = target
	e.mutex.Unlock()
	if err := WriteControl(connection, "Accept", relaycontracts.Accept{WireVersion: 1, Type: "accepted", RequestId: open.RequestId, BindingDigest: hash}); err != nil {
		return
	}
	connection.SetDeadline(time.Time{})
	if e.assignment.Protocol == "tcp" {
		e.bridgeTCP(target, &framedTCP{Conn: connection, maximum: int(config.Profile.MaxFrameBytes), allow: func() error { return e.peerCheck(connection) }})
	} else {
		e.bridgeUDP(target, connection)
	}
}
func relayBinding(binding adp3relay.Binding) (relaycontracts.Binding, error) {
	raw, err := json.Marshal(binding)
	if err != nil {
		return relaycontracts.Binding{}, err
	}
	var value relaycontracts.Binding
	err = json.Unmarshal(raw, &value)
	return value, err
}
func (e *Engine) dialTarget(protocol string, target adp3relay.Target) (net.Conn, error) {
	ctx, cancel := context.WithTimeout(e.ctx, time.Duration(e.assignment.Driver.Config.Profile.HandshakeTimeoutSeconds)*time.Second)
	defer cancel()
	addresses, err := net.DefaultResolver.LookupNetIP(ctx, "ip", target.Host)
	if err != nil {
		return nil, err
	}
	config := e.assignment.Driver.Config
	authorized := false
	for _, address := range addresses {
		if !egress.Allowed(address, config.AllowedDestinationCidrs, config.AllowMetadataTargets) || e.check() != nil {
			continue
		}
		authorized = true
		client, err := (&net.Dialer{}).DialContext(ctx, protocol, net.JoinHostPort(address.Unmap().String(), fmt.Sprint(target.Port)))
		if err == nil {
			if e.check() != nil {
				closeSocket(client)
				return nil, fmt.Errorf("LEASE_EXPIRED")
			}
			return client, nil
		}
	}
	if err := e.check(); err != nil {
		return nil, err
	}
	if authorized {
		return nil, fmt.Errorf("TARGET_UNAVAILABLE")
	}
	return nil, fmt.Errorf("TARGET_REJECTED")
}
func (e *Engine) dialPeer(action string) (*tls.Conn, error) {
	config := e.assignment.Driver.Config
	endpoint := config.PeerEndpoint
	if e.multihop != nil {
		n := e.multihop.Path[e.multihop.HopIndex+1]
		endpoint = &adp3relay.Target{Host: n.Host, Port: n.Port}
	}
	if endpoint == nil {
		return nil, fmt.Errorf("INVALID_CONFIG: Downstream endpoint required")
	}
	raw, err := e.dialTarget("tcp", *endpoint)
	if err != nil {
		if strings.SplitN(err.Error(), ":", 2)[0] == "TARGET_UNAVAILABLE" {
			return nil, fmt.Errorf("DOWNSTREAM_UNAVAILABLE: %w", err)
		}
		return nil, err
	}
	success := false
	defer func() {
		if !success {
			raw.Close()
		}
	}()
	tlsConfig, err := e.peerTLS(true)
	if err != nil {
		return nil, err
	}
	client := tls.Client(raw, tlsConfig)
	client.SetDeadline(time.Now().Add(time.Duration(config.Profile.HandshakeTimeoutSeconds) * time.Second))
	if err := client.HandshakeContext(e.ctx); err != nil {
		return nil, err
	}
	request := make([]byte, 16)
	if _, err := rand.Read(request); err != nil {
		return nil, err
	}
	binding, err := e.wireBinding(true)
	if err != nil {
		return nil, err
	}
	open := relaycontracts.Open{WireVersion: 1, Type: "open", Action: action, RequestId: hex.EncodeToString(request), Binding: binding}
	if err := e.writeOpen(client, open); err != nil {
		return nil, err
	}
	hash, err := e.wireDigest(binding)
	if err != nil {
		return nil, err
	}
	if err := ReadReply(client, open.RequestId, hash); err != nil {
		return nil, err
	}
	if e.check() != nil {
		return nil, fmt.Errorf("AUTHORIZATION_DENIED")
	}
	e.trackPeer(client)
	client.SetDeadline(time.Time{})
	success = true
	return client, nil
}
func (e *Engine) acceptClients() {
	defer e.workers.Done()
	for {
		client, err := e.listener.Accept()
		if err != nil {
			return
		}
		e.mutex.Lock()
		if e.draining || e.check() != nil || len(e.connections) >= e.maximum {
			e.mutex.Unlock()
			closeSocket(client)
			e.rejected.Add(1)
			continue
		}
		release, err := acquireNode(int(e.assignment.Driver.Config.Profile.MaxConnectionsPerNode), "tcp")
		if err != nil {
			e.mutex.Unlock()
			closeSocket(client)
			e.rejected.Add(1)
			continue
		}
		e.connections[client] = nil
		e.workers.Add(1)
		e.mutex.Unlock()
		go func() {
			defer e.workers.Done()
			defer release()
			defer func() {
				closeSocket(client)
				e.payload.TCPClose()
				e.mutex.Lock()
				delete(e.connections, client)
				e.mutex.Unlock()
			}()
			e.payload.TCPAccept()
			peer, err := e.dialPeer("tcp")
			if err != nil {
				e.rejected.Add(1)
				return
			}
			defer closeSocket(peer)
			defer e.untrackPeer(peer)
			e.mutex.Lock()
			if e.check() != nil {
				e.mutex.Unlock()
				return
			}
			e.connections[client] = peer
			e.payload.TCPConnect()
			e.mutex.Unlock()
			e.bridgeTCP(client, &framedTCP{Conn: peer, maximum: int(e.assignment.Driver.Config.Profile.MaxFrameBytes), allow: func() error { return e.peerCheck(peer) }})
		}()
	}
}

type gateReader struct {
	in    io.Reader
	allow func() error
}

func (r gateReader) Read(buffer []byte) (int, error) {
	if err := r.allow(); err != nil {
		return 0, err
	}
	n, err := r.in.Read(buffer)
	if denied := r.allow(); denied != nil {
		return 0, denied
	}
	return n, err
}

type gateWriter struct {
	out   io.Writer
	allow func() error
}

type payloadWriter struct {
	out   io.Writer
	count func(int)
}

func (w payloadWriter) Write(buffer []byte) (int, error) {
	n, err := w.out.Write(buffer)
	if n > 0 {
		w.count(n)
	}
	return n, err
}

func (w gateWriter) Write(buffer []byte) (int, error) {
	if err := w.allow(); err != nil {
		return 0, err
	}
	return w.out.Write(buffer)
}
func (e *Engine) bridgeTCP(local net.Conn, tunnel *framedTCP) {
	ctx, cancel := context.WithCancel(e.ctx)
	defer cancel()
	tunnel.payloadContext = ctx
	tunnel.payloadGate = e.payloadGate
	tunnel.payloadWritten = e.payload.Sent
	finished := make(chan struct{})
	go func() {
		defer close(finished)
		_, err := io.Copy(gateWriter{tunnel, e.check}, gateReader{local, e.check})
		if err == nil {
			tunnel.CloseWrite()
		} else {
			cancel()
			local.Close()
			tunnel.Close()
		}
	}()
	_, err := io.Copy(payloadWriter{quotaWriter{out: local, ctx: ctx, gate: e.payloadGate, check: func() error { return e.peerCheck(tunnel.Conn) }}, e.payload.Received}, gateReader{tunnel, e.check})
	if tcp, ok := local.(*net.TCPConn); ok {
		tcp.CloseWrite()
	}
	if err != nil {
		cancel()
		local.Close()
		tunnel.Close()
	}
	<-finished
}

func (e *Engine) trackPeer(peer *tls.Conn) {
	state := peer.ConnectionState()
	until := e.credentialUntil
	for _, certificate := range state.PeerCertificates {
		if certificate.NotAfter.Before(until) {
			until = certificate.NotAfter
		}
	}
	e.mutex.Lock()
	defer e.mutex.Unlock()
	if e.ctx.Err() != nil {
		closeSocket(peer)
		return
	}
	e.peers[peer] = until
}
func (e *Engine) untrackPeer(peer *tls.Conn) { e.mutex.Lock(); delete(e.peers, peer); e.mutex.Unlock() }

func (e *Engine) peerCheck(peer *tls.Conn) error {
	if err := e.check(); err != nil {
		return err
	}
	state := peer.ConnectionState()
	for _, certificate := range state.PeerCertificates {
		if !time.Now().Before(certificate.NotAfter) {
			return fmt.Errorf("AUTHENTICATION_FAILED: Peer certificate expired")
		}
	}
	return nil
}

func closeSocket(socket net.Conn) {
	if secured, ok := socket.(*tls.Conn); ok {
		secured.NetConn().Close()
		return
	}
	socket.Close()
}
