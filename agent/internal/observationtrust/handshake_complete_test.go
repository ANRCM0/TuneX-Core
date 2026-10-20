package observationtrust

import (
	"context"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/asn1"
	"encoding/base64"
	"errors"
	"io"
	"math/big"
	"net"
	"net/url"
	"reflect"
	"sync/atomic"
	"testing"
	"time"
)

type handshakeCompleteConn struct {
	net.Conn
	readData                       []byte
	readErr, writeErr, deadlineErr error
	readN, writeN                  int
	calls                          []string
	deadline                       time.Time
	closes                         atomic.Int32
}

func (c *handshakeCompleteConn) Read(p []byte) (int, error) {
	c.calls = append(c.calls, "read")
	c.readN = len(p)
	n := copy(p, c.readData)
	c.readData = c.readData[n:]
	return n, c.readErr
}
func (c *handshakeCompleteConn) Write(p []byte) (int, error) {
	c.calls = append(c.calls, "write")
	c.writeN = len(p)
	n := len(p)
	if c.writeErr != nil && n > 2 {
		n = 2
	}
	return n, c.writeErr
}
func (c *handshakeCompleteConn) SetDeadline(d time.Time) error {
	c.calls = append(c.calls, "deadline")
	c.deadline = d
	return c.deadlineErr
}
func (c *handshakeCompleteConn) Close() error {
	c.closes.Add(1)
	if c.Conn != nil {
		return c.Conn.Close()
	}
	return nil
}

func TestHandshakeCompleteWireExactCapsPartialIOAndIndependentBudgets(t *testing.T) {
	failure := errors.New("original raw I/O")
	raw := &handshakeCompleteConn{readData: []byte{1, 2, 3}, readErr: failure, writeErr: failure}
	wire := &handshakeWire{Conn: raw, rx: MaximumTLSWireBytes - 2, tx: MaximumTLSWireBytes - 3}
	b := make([]byte, 9)
	n, err := wire.Read(b)
	if n != 2 || err != failure || raw.readN != 2 || wire.rx != MaximumTLSWireBytes || wire.exhausted {
		t.Fatal("read cap/partial error changed", n, err)
	}
	before := len(raw.calls)
	n, err = wire.Read(nil)
	if n != 0 || err != ErrTLSBudget || !wire.exhausted || len(raw.calls) != before {
		t.Fatal("exhausted RX reached raw socket")
	}
	wire.exhausted = false
	n, err = wire.Write([]byte{1, 2, 3})
	if n != 2 || err != failure || wire.tx != MaximumTLSWireBytes-1 || raw.writeN != 3 || wire.exhausted {
		t.Fatal("TX partial count/error changed", n, err)
	}
	raw.writeErr = nil
	n, err = wire.Write([]byte{4})
	if n != 1 || err != nil || wire.tx != MaximumTLSWireBytes || wire.exhausted {
		t.Fatal("exact TX cap incorrectly rejected")
	}
	before = len(raw.calls)
	n, err = wire.Write([]byte{5})
	if n != 0 || err != ErrTLSBudget || !wire.exhausted || len(raw.calls) != before {
		t.Fatal("TX over-cap reached raw socket")
	}
	// A single oversized write is refused in full, while oversized reads are
	// capped. The independent direction remains usable after an RX limit.
	raw = &handshakeCompleteConn{readData: []byte{7}}
	wire = &handshakeWire{Conn: raw}
	if n, err := wire.Write(make([]byte, MaximumTLSWireBytes+1)); n != 0 || err != ErrTLSBudget || wire.tx != 0 || len(raw.calls) != 0 {
		t.Fatal("oversized TX was partially forwarded")
	}
	if n, err := wire.Read(make([]byte, MaximumTLSWireBytes+1)); n != 1 || err != nil || raw.readN != MaximumTLSWireBytes || wire.rx != 1 {
		t.Fatal("oversized RX cap changed")
	}
	wire = &handshakeWire{Conn: raw, rx: MaximumTLSWireBytes}
	_, _ = wire.Read(b)
	if n, err := wire.Write([]byte{9}); n != 1 || err != nil || wire.tx != 1 {
		t.Fatal("RX consumed TX budget")
	}
}

func TestHandshakeCompletePrerequisiteDeadlineAndUnknownErrorOrder(t *testing.T) {
	// No Trust is needed until native TLS configuration; deadline/auth and raw
	// deadline errors must refuse before accessing a nil receiver.
	var trust *Trust
	calls := 0
	deny := errors.New("authority revoked")
	raw := &handshakeCompleteConn{}
	if got, err := trust.Handshake(context.Background(), raw, func() error { calls++; return nil }); got != nil || err != ErrHandshakeDenied || calls != 0 || len(raw.calls) != 0 {
		t.Fatal("missing deadline sampled authority or socket")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if got, err := trust.Handshake(ctx, raw, func() error { calls++; return deny }); got != nil || err != ErrHandshakeDenied || calls != 1 || len(raw.calls) != 0 {
		t.Fatal("revocation did not precede SetDeadline")
	}
	raw.deadlineErr = errors.New("raw deadline failure")
	if got, err := trust.Handshake(ctx, raw, func() error { calls++; return nil }); got != nil || err != ErrHandshakeDenied || calls != 2 || !reflect.DeepEqual(raw.calls, []string{"deadline"}) || raw.closes.Load() != 0 {
		t.Fatal("SetDeadline failure added TLS/close")
	}
	if want, _ := ctx.Deadline(); raw.deadline != want {
		t.Fatal("deadline not passed unchanged")
	}
	// Native write errors which are neither timeout nor a budget/authority
	// refusal are unknown/unverified, preserving the old nil,nil outcome.
	native, _ := handshakeCompleteTrust(t)
	raw = &handshakeCompleteConn{writeErr: io.ErrUnexpectedEOF}
	got, err := native.Handshake(ctx, raw, func() error { return nil })
	if got != nil || err != nil || raw.closes.Load() != 0 {
		t.Fatal("unknown native TLS error became denial or closed caller-owned socket", err)
	}
}

func handshakeCompleteTrust(t *testing.T) (*Trust, tls.Certificate) {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	uri, err := url.Parse("urn:tunex:observation-service:scope:service")
	if err != nil {
		t.Fatal(err)
	}
	template := &x509.Certificate{SerialNumber: big.NewInt(1), NotBefore: now.Add(-time.Hour), NotAfter: now.Add(time.Hour), DNSNames: []string{"observation.test"}, URIs: []*url.URL{uri}, KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	leaf, err := x509.ParseCertificate(der)
	if err != nil {
		t.Fatal(err)
	}
	config := Config{Version: 1, Purpose: "direct-ingress-tls-handshake", Endpoint: Endpoint{Address: "127.0.0.1", Port: 443}, Trust: LeafPin{Mode: "pinned-leaf-v1", ServerName: "observation.test", CertificateDer: base64.StdEncoding.EncodeToString(der)}, ValidFrom: uint64(now.Add(-time.Minute).UnixMilli()), ValidUntil: uint64(now.Add(time.Minute).UnixMilli())}
	c := Context{ScopeID: "scope", ServiceID: "service", Revision: 1, ConfigRevision: 1, Config: config}
	c.ConfigDigest, err = publicDigest(configValue(config))
	if err != nil {
		t.Fatal(err)
	}
	c.ContextDigest, err = publicDigest(map[string]any{"scopeId": c.ScopeID, "serviceId": c.ServiceID, "revision": c.Revision, "configRevision": c.ConfigRevision, "configDigest": c.ConfigDigest, "config": configValue(config)})
	if err != nil {
		t.Fatal(err)
	}
	trust, err := New(c, now)
	if err != nil {
		t.Fatal(err)
	}
	return trust, tls.Certificate{Certificate: [][]byte{der}, PrivateKey: key, Leaf: leaf}
}

type handshakeCompleteTracked struct {
	net.Conn
	closed atomic.Int32
}

func (c *handshakeCompleteTracked) Close() error { c.closed.Add(1); return c.Conn.Close() }

// TLS rejection writes an alert before returning. With a bare net.Pipe this
// can deadlock against the server's unfinished certificate flight. Buffer only
// the fixture's server writes; the client's real handshakeWire still counts
// every byte read from the original pipe and owns all client-side closes.
type handshakeCompleteBufferedServer struct {
	net.Conn
	writes chan []byte
	stop   chan struct{}
	done   chan struct{}
	tx     int
}

func (c *handshakeCompleteBufferedServer) Write(p []byte) (int, error) {
	if len(p) > 4*MaximumTLSWireBytes-c.tx {
		return 0, io.ErrShortWrite
	}
	b := append([]byte(nil), p...)
	select {
	case c.writes <- b:
		c.tx += len(b)
		return len(b), nil
	case <-c.done:
		return 0, io.ErrClosedPipe
	case <-c.stop:
		return 0, io.ErrClosedPipe
	}
}

func (c *handshakeCompleteBufferedServer) pump() {
	defer close(c.done)
	for {
		select {
		case b := <-c.writes:
			for len(b) > 0 {
				n, err := c.Conn.Write(b)
				if err != nil || n == 0 {
					return
				}
				b = b[n:]
			}
		case <-c.stop:
			return
		}
	}
}

func TestHandshakeCompleteNativeTLS13SNIAlpnRevocationAndNoCallerClose(t *testing.T) {
	for _, mode := range []string{"valid", "revoke-after", "wrong-pin", "tls12", "wrong-alpn", "wire-budget"} {
		t.Run(mode, func(t *testing.T) {
			trust, certificate := handshakeCompleteTrust(t)
			if mode == "wrong-pin" {
				other, _ := handshakeCompleteTrust(t)
				trust.pin = other.pin
			}
			if mode == "wire-budget" {
				for i := 0; i < 100; i++ {
					certificate.Certificate = append(certificate.Certificate, certificate.Certificate[0])
				}
			}
			clientRaw, serverRaw := net.Pipe()
			raw := &handshakeCompleteTracked{Conn: clientRaw}
			bufferedServer := &handshakeCompleteBufferedServer{Conn: serverRaw, writes: make(chan []byte, 16), stop: make(chan struct{}), done: make(chan struct{})}
			go bufferedServer.pump()
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer func() {
				// Close original endpoints before waiting: a budget refusal leaves
				// the server flight unread, and no TLS owner should close it for us.
				close(bufferedServer.stop)
				_ = clientRaw.Close()
				_ = serverRaw.Close()
				cancel()
				<-bufferedServer.done
			}()
			deadline, _ := ctx.Deadline()
			_ = serverRaw.SetDeadline(deadline)
			version := uint16(tls.VersionTLS13)
			alpn := ALPN
			if mode == "tls12" {
				version = tls.VersionTLS12
			}
			if mode == "wrong-alpn" {
				alpn = "other/1"
			}
			hello := make(chan *tls.ClientHelloInfo, 1)
			finished := make(chan error, 1)
			go func() {
				server := tls.Server(bufferedServer, &tls.Config{Certificates: []tls.Certificate{certificate}, MinVersion: version, MaxVersion: version, NextProtos: []string{alpn}, SessionTicketsDisabled: true, GetConfigForClient: func(info *tls.ClientHelloInfo) (*tls.Config, error) { hello <- info; return nil, nil }})
				finished <- server.HandshakeContext(ctx)
			}()
			calls := 0
			verified, err := trust.Handshake(ctx, raw, func() error {
				calls++
				if mode == "revoke-after" && calls == 2 {
					return errors.New("revoked after TLS")
				}
				return nil
			})
			select {
			case info := <-hello:
				if info.ServerName != "observation.test" || !reflect.DeepEqual(info.SupportedVersions, []uint16{tls.VersionTLS13}) || !reflect.DeepEqual(info.SupportedProtos, []string{ALPN}) {
					t.Fatal("native TLS bounds/SNI/ALPN changed", info)
				}
			case <-ctx.Done():
				t.Fatal("native server received no ClientHello")
			}
			if calls != 2 || raw.closed.Load() != 0 {
				t.Fatal("handshake callback count or caller connection ownership changed", calls, raw.closed.Load())
			}
			if ctx.Err() != nil || !time.Now().Before(deadline) {
				t.Fatal("native result came from fixture timeout", err)
			}
			switch mode {
			case "valid":
				if err != nil || verified == nil || !verified.Verified || verified.Version != "TLSv1.3" || verified.ALPN != ALPN || verified.LeafFingerprint != trust.Fingerprint() {
					t.Fatal("valid native handshake not verified", verified, err)
				}
			case "revoke-after", "wire-budget":
				if verified != nil || err != ErrHandshakeDenied {
					t.Fatal("post-handshake revocation bypassed", err)
				}
			default:
				if verified != nil || err != nil {
					t.Fatal("unverified native TLS failure changed to authority denial", err)
				}
			}
			_ = raw.Close()
			_ = serverRaw.Close()
			cleanup := time.NewTimer(time.Second)
			defer cleanup.Stop()
			select {
			case serverErr := <-finished:
				if (mode == "valid" || mode == "revoke-after") && serverErr != nil {
					t.Fatal("native server failed a completed TLS handshake", serverErr)
				}
			case <-cleanup.C:
				t.Fatal("native server did not finish")
			}
		})
	}
}

func TestHandshakeCompleteCancellationClosesRawAndTimeoutDenies(t *testing.T) {
	trust, _ := handshakeCompleteTrust(t)
	for _, mode := range []string{"cancel", "timeout"} {
		t.Run(mode, func(t *testing.T) {
			client, server := net.Pipe()
			raw := &handshakeCompleteTracked{Conn: client}
			defer server.Close()
			defer raw.Close()
			duration := time.Second
			if mode == "timeout" {
				duration = 20 * time.Millisecond
			}
			ctx, cancel := context.WithTimeout(context.Background(), duration)
			defer cancel()
			ready := make(chan struct{})
			go func() { b := make([]byte, 1); _, _ = server.Read(b); close(ready) }()
			done := make(chan error, 1)
			go func() {
				v, err := trust.Handshake(ctx, raw, func() error { return nil })
				if v != nil {
					done <- errors.New("cancelled handshake verified")
					return
				}
				done <- err
			}()
			select {
			case <-ready:
			case <-ctx.Done():
				if mode == "cancel" {
					t.Fatal("client did not enter native handshake")
				}
			}
			if mode == "cancel" {
				cancel()
			}
			select {
			case err := <-done:
				if err != ErrHandshakeDenied {
					t.Fatal("cancel/timeout not denial", err)
				}
			case <-time.After(2 * time.Second):
				t.Fatal("handshake cancellation did not return")
			}
			// AfterFunc may already have started when Handshake's deferred stop runs.
			limit := time.After(time.Second)
			for mode == "cancel" && raw.closed.Load() == 0 {
				select {
				case <-limit:
					t.Fatal("cancellation did not close raw socket")
				default:
					time.Sleep(time.Millisecond)
				}
			}
		})
	}
}

func TestHandshakeCompleteTrustNativeClockAndVerificationBoundaries(t *testing.T) {
	trust, certificate := handshakeCompleteTrust(t)
	from := time.UnixMilli(int64(trust.context.Config.ValidFrom))
	until := trust.ValidUntil()
	for _, v := range []struct {
		now   time.Time
		valid bool
	}{{from.Add(-time.Nanosecond), false}, {from, true}, {until.Add(-time.Nanosecond), true}, {until, false}} {
		if (trust.Current(v.now) == nil) != v.valid {
			t.Fatal("native trust validity boundary changed", v.now)
		}
	}
	now := time.Now()
	state := tls.ConnectionState{Version: tls.VersionTLS13, NegotiatedProtocol: ALPN, ServerName: "observation.test", PeerCertificates: []*x509.Certificate{certificate.Leaf}}
	if v, err := trust.VerifyConnection(state, now); err != nil || v == nil {
		t.Fatal("native trust baseline", err)
	}
	for _, mutate := range []func(*tls.ConnectionState){func(s *tls.ConnectionState) { s.Version = tls.VersionTLS12 }, func(s *tls.ConnectionState) { s.NegotiatedProtocol = "" }, func(s *tls.ConnectionState) { s.ServerName = "other.test" }, func(s *tls.ConnectionState) { s.DidResume = true }, func(s *tls.ConnectionState) { s.PeerCertificates = nil }, func(s *tls.ConnectionState) { s.PeerCertificates = []*x509.Certificate{nil} }, func(s *tls.ConnectionState) { s.PeerCertificates = append(s.PeerCertificates, certificate.Leaf) }} {
		copy := state
		mutate(&copy)
		if v, err := trust.VerifyConnection(copy, now); v != nil || err == nil {
			t.Fatal("native verification relaxed")
		}
	}
	if trust.pin != sha256.Sum256(certificate.Certificate[0]) {
		t.Fatal("handshake pin not exact native DER")
	}
}

func TestHandshakeCompleteStrictNewAndLeafRefusalsHaveNoFallback(t *testing.T) {
	trust, certificate := handshakeCompleteTrust(t)
	now := time.Now()
	base := trust.Context()
	for _, mutate := range []func(*Context){
		func(c *Context) { c.ScopeID = "" }, func(c *Context) { c.ServiceID = "" }, func(c *Context) { c.Revision = 0 }, func(c *Context) { c.Revision = maximumCounter + 1 }, func(c *Context) { c.ConfigRevision = 0 }, func(c *Context) { c.ConfigRevision = 65 }, func(c *Context) { c.Config.Version = 2 }, func(c *Context) { c.Config.Purpose = "other" }, func(c *Context) { c.Config.Endpoint.Port = 0 }, func(c *Context) { c.Config.Endpoint.Port = 65536 }, func(c *Context) { c.Config.Trust.Mode = "ca" }, func(c *Context) { c.Config.Trust.ServerName = "localhost" }, func(c *Context) { c.Config.Trust.CertificateDer = "!!!!" }, func(c *Context) { c.ConfigDigest = "sha256:" + string(make([]byte, 64)) }, func(c *Context) { c.ContextDigest = "sha256:" + string(make([]byte, 64)) }, func(c *Context) { c.Config.ValidUntil = c.Config.ValidFrom }, func(c *Context) { c.Config.ValidFrom = maximumTime + 1 }, func(c *Context) {
			c.Config.ValidUntil = c.Config.ValidFrom + uint64(maximumValidity/time.Millisecond) + 1
		},
	} {
		v := base
		mutate(&v)
		if got, err := New(v, now); got != nil || err == nil {
			t.Fatal("malformed native trust/config/digest acquired fallback")
		}
	}
	for _, address := range []string{"::ffff:127.0.0.1", "fe80::1%eth0", "0.0.0.0", "::", "224.0.0.1", "ff02::1", "169.254.169.254", "100.100.100.200", "fd00:ec2::254", "fe80::1", "127.000.0.1", "example.test", " 127.0.0.1"} {
		if AddressAllowed(address) {
			t.Fatal("forbidden/noncanonical native endpoint", address)
		}
	}
	for _, address := range []string{"127.0.0.1", "::1", "192.0.2.1", "2001:db8::1"} {
		if !AddressAllowed(address) {
			t.Fatal("original native numeric endpoint refused", address)
		}
	}
	for _, mutate := range []func(*x509.Certificate){
		func(c *x509.Certificate) { c.Raw = nil }, func(c *x509.Certificate) { c.Raw = make([]byte, MaximumCertificateBytes+1) }, func(c *x509.Certificate) { c.IsCA = true }, func(c *x509.Certificate) { c.ExtKeyUsage = nil }, func(c *x509.Certificate) {
			c.ExtKeyUsage = []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth, x509.ExtKeyUsageClientAuth}
		}, func(c *x509.Certificate) { c.UnknownExtKeyUsage = []asn1.ObjectIdentifier{{1, 2, 3}} }, func(c *x509.Certificate) { c.UnhandledCriticalExtensions = []asn1.ObjectIdentifier{{1, 2, 3}} }, func(c *x509.Certificate) { c.DNSNames = []string{"other.test"} }, func(c *x509.Certificate) { c.URIs = nil }, func(c *x509.Certificate) { c.URIs = []*url.URL{nil} }, func(c *x509.Certificate) { c.IPAddresses = []net.IP{net.IPv4(127, 0, 0, 1)} }, func(c *x509.Certificate) { c.EmailAddresses = []string{"x@example.test"} }, func(c *x509.Certificate) { c.Extensions = nil }, func(c *x509.Certificate) { c.NotBefore = now.Add(time.Hour) }, func(c *x509.Certificate) { c.NotAfter = now }, func(c *x509.Certificate) { c.PublicKey = nil }, func(c *x509.Certificate) { c.PublicKey = &ecdsa.PublicKey{Curve: elliptic.P224()} }, func(c *x509.Certificate) { c.PublicKey = ed25519.PublicKey{1} }, func(c *x509.Certificate) { c.PublicKey = &rsa.PublicKey{N: big.NewInt(17), E: 65537} },
	} {
		leaf := *certificate.Leaf
		mutate(&leaf)
		if err := trust.validLeaf(&leaf, now); err == nil {
			t.Fatal("native leaf/SAN/purpose/key/time constraint relaxed")
		}
	}
}
