package observationresponder

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net"
	"sync"
	"time"
)

type server struct {
	config      configuration
	certificate *x509.Certificate
	tlsConfig   *tls.Config
	listener    net.Listener
	mutex       sync.Mutex
	connections map[net.Conn]struct{}
	workers     sync.WaitGroup
	stopping    bool
	cause       error
	tokens      float64
	refilledAt  time.Time
}

// Run serves one explicit endpoint. It never dials, reads application data or grants Agent authority.
func Run(ctx context.Context, input Config) error {
	config, err := parseConfig(input, time.Now())
	if err != nil {
		return err
	}
	tlsConfig, leaf, err := loadTLS(config)
	if err != nil {
		return err
	}
	if ctx.Err() != nil {
		return ctx.Err()
	}
	network := "tcp6"
	if config.listen.Addr().Is4() {
		network = "tcp4"
	}
	listener, err := (&net.ListenConfig{}).Listen(ctx, network, config.listen.String())
	if err != nil {
		return fmt.Errorf("OBSERVATION_LISTEN_FAILED: explicit endpoint unavailable")
	}
	address, ok := listener.Addr().(*net.TCPAddr)
	if !ok || address.AddrPort().Addr().Unmap() != config.listen.Addr() || address.AddrPort().Port() != config.listen.Port() {
		listener.Close()
		return fmt.Errorf("OBSERVATION_LISTEN_FAILED: actual listener differs from explicit endpoint")
	}
	responder := &server{config: config, certificate: leaf, tlsConfig: tlsConfig, listener: listener,
		connections: make(map[net.Conn]struct{}, config.maxConnections), tokens: float64(min(config.maxConnections, config.handshakesPerSecond)), refilledAt: time.Now()}
	watch, cancel := context.WithCancel(ctx)
	done := make(chan struct{})
	go responder.supervise(watch, done)
	defer func() { cancel(); responder.stop(nil); <-done; responder.workers.Wait() }()
	for {
		connection, err := listener.Accept()
		if err != nil {
			if ctx.Err() != nil {
				responder.stop(nil)
			} else {
				responder.stop(fmt.Errorf("OBSERVATION_ACCEPT_FAILED: listener stopped"))
			}
			responder.mutex.Lock()
			cause := responder.cause
			responder.mutex.Unlock()
			return cause
		}
		acceptedAt := time.Now()
		if !responder.admit(connection) {
			connection.Close()
			continue
		}
		go responder.handshake(watch, connection, acceptedAt)
	}
}

// One endpoint-wide budget, no accepted queue or per-source map. Kernel backlog is OS-owned.
func (server *server) admit(connection net.Conn) bool {
	address, ok := connection.RemoteAddr().(*net.TCPAddr)
	if !ok || !server.config.allows(address.AddrPort().Addr()) {
		return false
	}
	server.mutex.Lock()
	defer server.mutex.Unlock()
	now := time.Now()
	if server.stopping || len(server.connections) >= server.config.maxConnections || verifyLeaf(server.certificate, server.config, now) != nil {
		return false
	}
	burst := float64(min(server.config.maxConnections, server.config.handshakesPerSecond))
	elapsed := now.Sub(server.refilledAt).Seconds()
	if elapsed < 0 {
		return false
	}
	server.tokens = min(burst, server.tokens+elapsed*float64(server.config.handshakesPerSecond))
	server.refilledAt = now
	if server.tokens < 1 {
		return false
	}
	server.tokens--
	server.connections[connection] = struct{}{}
	server.workers.Add(1)
	return true
}

func (server *server) handshake(ctx context.Context, connection net.Conn, acceptedAt time.Time) {
	defer func() {
		connection.Close()
		server.mutex.Lock()
		delete(server.connections, connection)
		server.mutex.Unlock()
		server.workers.Done()
	}()
	now := time.Now()
	deadline := acceptedAt.Add(ConnectionTimeout)
	if server.config.validUntil.Before(deadline) {
		deadline = server.config.validUntil
	}
	if server.certificate.NotAfter.Before(deadline) {
		deadline = server.certificate.NotAfter
	}
	if !now.Before(deadline) || connection.SetDeadline(deadline) != nil {
		return
	}
	handshakeUntil := acceptedAt.Add(HandshakeTimeout)
	if deadline.Before(handshakeUntil) {
		handshakeUntil = deadline
	}
	if !now.Before(handshakeUntil) {
		return
	}
	work, cancel := context.WithDeadline(ctx, handshakeUntil)
	defer cancel()
	if verifyLeaf(server.certificate, server.config, time.Now()) != nil {
		return
	}
	wire := &wireBudgetConn{Conn: connection}
	secured := tls.Server(wire, server.tlsConfig)
	if secured.HandshakeContext(work) != nil {
		return
	}
	if work.Err() != nil || wire.exhausted.Load() || verifyLeaf(server.certificate, server.config, time.Now()) != nil {
		return
	}
	// No application Read/Write, nonce echo, upstream, proxy or business Open follows TLS completion.
}

func (server *server) stop(cause error) {
	server.mutex.Lock()
	if server.stopping {
		server.mutex.Unlock()
		return
	}
	server.stopping, server.cause = true, cause
	connections := make([]net.Conn, 0, len(server.connections))
	for connection := range server.connections {
		connections = append(connections, connection)
	}
	server.mutex.Unlock()
	server.listener.Close()
	for _, connection := range connections {
		connection.Close()
	}
}

func (server *server) supervise(ctx context.Context, done chan<- struct{}) {
	defer close(done)
	deadline := time.NewTimer(time.Until(server.config.validUntil))
	defer deadline.Stop()
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			server.stop(nil)
			return
		case <-deadline.C:
			server.stop(fmt.Errorf("OBSERVATION_EXPIRED: finite service window ended"))
			return
		case <-ticker.C:
			if verifyLeaf(server.certificate, server.config, time.Now()) != nil {
				server.stop(fmt.Errorf("OBSERVATION_EXPIRED: service credential or validity ended"))
				return
			}
		}
	}
}
