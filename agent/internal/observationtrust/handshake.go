package observationtrust

import (
	"context"
	"crypto/tls"
	"errors"
	"net"
	"time"
)

var ErrTLSBudget = errors.New("PROBE_TLS_BUDGET: raw handshake wire limit exceeded")
var ErrHandshakeDenied = errors.New("OBSERVATION_HANDSHAKE_DENIED: authority, time or wire budget unavailable")

type handshakeWire struct {
	net.Conn
	rx, tx    int
	exhausted bool
}

func (wire *handshakeWire) Read(p []byte) (int, error) {
	remaining := MaximumTLSWireBytes - wire.rx
	if remaining <= 0 {
		wire.exhausted = true
		return 0, ErrTLSBudget
	}
	if len(p) > remaining {
		p = p[:remaining]
	}
	n, err := wire.Conn.Read(p)
	wire.rx += n
	return n, err
}

func (wire *handshakeWire) Write(p []byte) (int, error) {
	if len(p) > MaximumTLSWireBytes-wire.tx {
		wire.exhausted = true
		return 0, ErrTLSBudget
	}
	n, err := wire.Conn.Write(p)
	wire.tx += n
	return n, err
}

// Handshake performs only the original bounded pinned TLS handshake. The caller
// owns the raw connection and supplies a continuously checked authority callback.
func (trust *Trust) Handshake(ctx context.Context, raw net.Conn, check func() error) (*Verification, error) {
	deadline, ok := ctx.Deadline()
	if !ok || check() != nil {
		return nil, ErrHandshakeDenied
	}
	if err := raw.SetDeadline(deadline); err != nil {
		return nil, ErrHandshakeDenied
	}
	stop := context.AfterFunc(ctx, func() { _ = raw.Close() })
	defer stop()
	wire := &handshakeWire{Conn: raw}
	var verified *Verification
	client := tls.Client(wire, &tls.Config{MinVersion: tls.VersionTLS13, MaxVersion: tls.VersionTLS13,
		ServerName: trust.Context().Config.Trust.ServerName, NextProtos: []string{ALPN},
		InsecureSkipVerify: true, // Exact pinned public leaf and purpose/identity checks replace CA validation.
		VerifyConnection: func(state tls.ConnectionState) error {
			var err error
			verified, err = trust.VerifyConnection(state, time.Now())
			return err
		}})
	err := client.HandshakeContext(ctx)
	if check() != nil || ctx.Err() != nil || !time.Now().Before(deadline) || wire.exhausted {
		return nil, ErrHandshakeDenied
	}
	if err != nil {
		var timed net.Error
		if errors.As(err, &timed) && timed.Timeout() {
			return nil, ErrHandshakeDenied
		}
		return nil, nil
	}
	if verified == nil {
		return nil, ErrHandshakeDenied
	}
	return verified, nil
}
