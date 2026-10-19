package observationresponder

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/asn1"
	"encoding/pem"
	"errors"
	"io"
	"math/big"
	"net"
	"net/netip"
	"net/url"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func responderCompleteInput(t *testing.T) (Config, configuration, *x509.Certificate, tls.Certificate) {
	t.Helper()
	now := time.Now().UTC()
	until := now.Add(time.Hour).Truncate(time.Millisecond)
	input := Config{ScopeID: "scope", ServiceID: "service", ServerName: "observation.test", Listen: "127.0.0.1:12345", CertificatePath: filepath.Join(t.TempDir(), "certificate.pem"), PrivateKeyPath: filepath.Join(t.TempDir(), "private.pem"), AllowCIDRs: []string{"127.0.0.0/8", "::1/128"}, ValidUntil: until.Format("2006-01-02T15:04:05.000Z")}
	config, err := parseConfig(input, now)
	if err != nil {
		t.Fatal(err)
	}
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	uri, err := url.Parse(config.uri)
	if err != nil {
		t.Fatal(err)
	}
	template := &x509.Certificate{SerialNumber: big.NewInt(1), NotBefore: now.Add(-time.Hour), NotAfter: until.Add(time.Hour), DNSNames: []string{input.ServerName}, URIs: []*url.URL{uri}, KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	leaf, err := x509.ParseCertificate(der)
	if err != nil {
		t.Fatal(err)
	}
	keyDER, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(input.CertificatePath, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(input.PrivateKeyPath, pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: keyDER}), 0600); err != nil {
		t.Fatal(err)
	}
	return input, config, leaf, tls.Certificate{Certificate: [][]byte{der}, PrivateKey: key, Leaf: leaf}
}

func TestResponderNativeCompleteConfigEveryBoundCanonicalSourceAndNoFallback(t *testing.T) {
	input, _, _, _ := responderCompleteInput(t)
	now := time.Now().UTC().Truncate(time.Millisecond)
	for _, mutate := range []func(*Config){
		func(c *Config) { c.ScopeID = "" }, func(c *Config) { c.ServiceID = "" }, func(c *Config) { c.ServerName = "UPPER.example" }, func(c *Config) { c.ServerName = "localhost" }, func(c *Config) { c.ServerName = "host.example." }, func(c *Config) { c.Listen = "" }, func(c *Config) { c.Listen = "localhost:80" }, func(c *Config) { c.Listen = "127.0.0.1:0" }, func(c *Config) { c.Listen = "[::ffff:127.0.0.1]:80" }, func(c *Config) { c.Listen = "[fe80::1%eth0]:80" }, func(c *Config) { c.Listen = "0.0.0.0:80" }, func(c *Config) { c.Listen = "224.0.0.1:80" }, func(c *Config) { c.Listen = "169.254.169.254:80" }, func(c *Config) { c.ValidUntil = now.Format("2006-01-02T15:04:05.000Z") }, func(c *Config) {
			c.ValidUntil = now.Add(MaximumLifetime + time.Millisecond).Format("2006-01-02T15:04:05.000Z")
		}, func(c *Config) { c.ValidUntil = "2026-10-20T01:00:00Z" }, func(c *Config) { c.MaxConnections = -1 }, func(c *Config) { c.MaxConnections = 65 }, func(c *Config) { c.HandshakesPerSecond = -1 }, func(c *Config) { c.HandshakesPerSecond = 65 }, func(c *Config) { c.AllowCIDRs = nil }, func(c *Config) { c.AllowCIDRs = []string{"127.0.0.0/8", "127.0.0.0/8"} }, func(c *Config) { c.AllowCIDRs = []string{"127.0.0.1/8"} }, func(c *Config) { c.AllowCIDRs = []string{"::ffff:127.0.0.0/104"} }, func(c *Config) { c.AllowCIDRs = []string{"bad"} }, func(c *Config) { c.AllowCIDRs = make([]string, 33) }, func(c *Config) { c.CertificatePath = "" }, func(c *Config) { c.PrivateKeyPath = "bad\x00key" }, func(c *Config) { c.CertificatePath = strings.Repeat("x", 4097) },
	} {
		copy := input
		mutate(&copy)
		if got, err := parseConfig(copy, now); err == nil || got.listen.IsValid() {
			t.Fatal("invalid explicit responder config accepted", copy, err)
		}
	}
	for _, v := range []struct{ connections, rate int }{{0, 0}, {1, 1}, {64, 64}} {
		copy := input
		copy.MaxConnections = v.connections
		copy.HandshakesPerSecond = v.rate
		copy.ValidUntil = now.Add(MaximumLifetime).Format("2006-01-02T15:04:05.000Z")
		got, err := parseConfig(copy, now)
		if err != nil {
			t.Fatal("inclusive config limit", err)
		}
		wantMax, wantRate := v.connections, v.rate
		if wantMax == 0 {
			wantMax = 16
		}
		if wantRate == 0 {
			wantRate = 16
		}
		if got.maxConnections != wantMax || got.handshakesPerSecond != wantRate || got.uri != "urn:tunex:observation-service:scope:service" {
			t.Fatal("default/config identity changed")
		}
		copy.AllowCIDRs[0] = "caller-mutated"
		if !got.allows(netip.MustParseAddr("127.0.0.1")) || !got.allows(netip.MustParseAddr("::ffff:127.0.0.1")) || got.allows(netip.MustParseAddr("192.0.2.1")) || got.allows(netip.MustParseAddr("169.254.169.254")) {
			t.Fatal("source canonical copy/policy changed")
		}
		input.AllowCIDRs = []string{"127.0.0.0/8", "::1/128"}
	}
	if ALPN != "tunex-observation/1" || HandshakeTimeout != 2*time.Second || ConnectionTimeout != 3*time.Second || MaximumLifetime != 7*24*time.Hour || MaximumReadWireBytes != 32768 || MaximumWriteWireBytes != 32768 {
		t.Fatal("native responder fixed constants changed")
	}
}

func TestResponderNativeCompleteOperatorFilesPEMAndOSPermissionRefusal(t *testing.T) {
	input, config, _, _ := responderCompleteInput(t)
	for _, v := range []struct {
		name  string
		bytes []byte
	}{{"empty", nil}, {"oversized", bytes.Repeat([]byte{'a'}, MaximumPEMBytes+1)}} {
		path := filepath.Join(t.TempDir(), v.name)
		if err := os.WriteFile(path, v.bytes, 0600); err != nil {
			t.Fatal(err)
		}
		if got, err := readOperatorFile(path, false); got != nil || err == nil {
			t.Fatal("unbounded operator file accepted", v.name)
		}
	}
	for _, path := range []string{filepath.Join(t.TempDir(), "absent"), t.TempDir()} {
		if got, err := readOperatorFile(path, false); got != nil || err == nil {
			t.Fatal("nonregular/missing operator file accepted")
		}
	}
	if runtime.GOOS != "windows" {
		link := filepath.Join(t.TempDir(), "link")
		if err := os.Symlink(input.CertificatePath, link); err != nil {
			t.Fatal(err)
		}
		if got, err := readOperatorFile(link, false); got != nil || err == nil {
			t.Fatal("symlink operator identity accepted")
		}
	}
	raw, err := os.ReadFile(input.CertificatePath)
	if err != nil {
		t.Fatal(err)
	}
	if got, err := readOperatorFile(input.CertificatePath, false); err != nil || !bytes.Equal(got, raw) {
		t.Fatal("native bounded public file changed", err)
	}
	block, _ := pem.Decode(raw)
	for _, v := range [][]byte{[]byte("bad"), append(append([]byte(nil), raw...), raw...), pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: block.Bytes, Headers: map[string]string{"x": "y"}}), pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: bytes.Repeat([]byte{1}, 8193)}), append([]byte("prefix"), raw...)} {
		if _, err := onePEM(v, true); err == nil {
			t.Fatal("multiple/encrypted/header/prefix/unbounded certificate PEM accepted")
		}
	}
	for _, kind := range []string{"PRIVATE KEY", "EC PRIVATE KEY", "RSA PRIVATE KEY"} {
		if _, err := onePEM(pem.EncodeToMemory(&pem.Block{Type: kind, Bytes: []byte{1}}), false); err != nil {
			t.Fatal("original unencrypted key PEM type refused", kind, err)
		}
	}
	if _, err := onePEM(pem.EncodeToMemory(&pem.Block{Type: "ENCRYPTED PRIVATE KEY", Bytes: []byte{1}}), false); err == nil {
		t.Fatal("encrypted operator key accepted")
	}
	if runtime.GOOS != "linux" {
		if got, err := readOperatorFile(input.PrivateKeyPath, true); got != nil || err == nil || !strings.HasPrefix(err.Error(), "OBSERVATION_KEY_PERMISSION_UNVERIFIED:") {
			t.Fatal("unsupported OS silently accepted private ownership", err)
		}
		if tlsConfig, leaf, err := loadTLS(config); tlsConfig != nil || leaf != nil || err == nil {
			t.Fatal("native TLS bypassed OS ownership refusal")
		}
		return
	}
	for _, mode := range []os.FileMode{0400, 0600, 0644, 0000} {
		if err := os.Chmod(input.PrivateKeyPath, mode); err != nil {
			t.Fatal(err)
		}
		got, err := readOperatorFile(input.PrivateKeyPath, true)
		valid := mode == 0400 || mode == 0600
		if (err == nil) != valid || valid && len(got) == 0 {
			t.Fatal("Linux owner-only private mode changed", mode, err)
		}
	}
	if err := os.Chmod(input.PrivateKeyPath, 0600); err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(input.PrivateKeyPath)
	if err != nil || !privateFileAllowed(info) || privateFileAllowed(nil) {
		t.Fatal("native Linux effective-owner predicate changed", err)
	}
}

func TestResponderNativeCompleteLeafIdentityTLSCallbacksAndNativeTime(t *testing.T) {
	input, config, leaf, _ := responderCompleteInput(t)
	now := time.Now()
	if err := verifyLeaf(leaf, config, now); err != nil {
		t.Fatal(err)
	}
	for _, mutate := range []func(*x509.Certificate){func(c *x509.Certificate) { c.Raw = nil }, func(c *x509.Certificate) { c.IsCA = true }, func(c *x509.Certificate) { c.ExtKeyUsage = []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth} }, func(c *x509.Certificate) { c.ExtKeyUsage = append(c.ExtKeyUsage, x509.ExtKeyUsageClientAuth) }, func(c *x509.Certificate) { c.UnknownExtKeyUsage = []asn1.ObjectIdentifier{{1, 2, 3}} }, func(c *x509.Certificate) { c.UnhandledCriticalExtensions = []asn1.ObjectIdentifier{{1, 2, 3}} }, func(c *x509.Certificate) { c.DNSNames = []string{"agent.test"} }, func(c *x509.Certificate) { c.URIs = nil }, func(c *x509.Certificate) { c.URIs = []*url.URL{nil} }, func(c *x509.Certificate) { c.IPAddresses = []net.IP{net.IPv4(127, 0, 0, 1)} }, func(c *x509.Certificate) { c.EmailAddresses = []string{"x@example.test"} }, func(c *x509.Certificate) { c.Extensions = nil }, func(c *x509.Certificate) { c.NotBefore = now.Add(time.Hour) }, func(c *x509.Certificate) { c.NotAfter = now }, func(c *x509.Certificate) { c.PublicKey = &ecdsa.PublicKey{Curve: elliptic.P224()} }, func(c *x509.Certificate) { c.PublicKey = &rsa.PublicKey{N: big.NewInt(17), E: 65537} }, func(c *x509.Certificate) { c.PublicKey = ed25519.PublicKey{1} }, func(c *x509.Certificate) { c.PublicKey = nil }} {
		copy := *leaf
		mutate(&copy)
		if err := verifyLeaf(&copy, config, now); err == nil {
			t.Fatal("dedicated responder leaf refusal relaxed")
		}
	}
	if verifyLeaf(nil, config, now) == nil || verifyLeaf(leaf, config, config.validUntil) == nil || verifyLeaf(leaf, config, leaf.NotBefore.Add(-time.Nanosecond)) == nil || verifyLeaf(leaf, config, leaf.NotAfter) == nil {
		t.Fatal("native leaf/config validity boundary changed")
	}
	if runtime.GOOS != "linux" {
		return
	}
	native, loaded, err := loadTLS(config)
	if err != nil || loaded == nil || native.MinVersion != tls.VersionTLS13 || native.MaxVersion != tls.VersionTLS13 || native.ClientAuth != tls.NoClientCert || !native.SessionTicketsDisabled || !reflect.DeepEqual(native.NextProtos, []string{ALPN}) {
		t.Fatal("native dedicated TLS defaults changed", err)
	}
	for _, hello := range []*tls.ClientHelloInfo{{ServerName: input.ServerName, SupportedProtos: []string{ALPN}}, {ServerName: "agent.test", SupportedProtos: []string{ALPN}}, {ServerName: input.ServerName}, {ServerName: input.ServerName, SupportedProtos: []string{ALPN, "other"}}} {
		_, err := native.GetConfigForClient(hello)
		valid := hello.ServerName == input.ServerName && len(hello.SupportedProtos) == 1 && hello.SupportedProtos[0] == ALPN
		if (err == nil) != valid {
			t.Fatal("exact SNI/single ALPN callback", err)
		}
	}
	cert, err := native.GetCertificate(&tls.ClientHelloInfo{})
	if err != nil || cert.Leaf != loaded || len(cert.Certificate) != 1 {
		t.Fatal("native cert callback did not retain original leaf", err)
	}
	baseline := tls.ConnectionState{Version: tls.VersionTLS13, NegotiatedProtocol: ALPN, ServerName: input.ServerName}
	if err := native.VerifyConnection(baseline); err != nil {
		t.Fatal(err)
	}
	for _, mutate := range []func(*tls.ConnectionState){func(s *tls.ConnectionState) { s.Version = tls.VersionTLS12 }, func(s *tls.ConnectionState) { s.NegotiatedProtocol = "other" }, func(s *tls.ConnectionState) { s.ServerName = "agent.test" }, func(s *tls.ConnectionState) { s.DidResume = true }} {
		state := baseline
		mutate(&state)
		if err := native.VerifyConnection(state); err == nil {
			t.Fatal("native fresh dedicated TLS policy relaxed")
		}
	}
	loaded.NotAfter = time.Now().Add(-time.Second)
	if _, err := native.GetCertificate(nil); err == nil {
		t.Fatal("GetCertificate cached expired identity")
	}
	if _, err := native.GetConfigForClient(&tls.ClientHelloInfo{ServerName: input.ServerName, SupportedProtos: []string{ALPN}}); err == nil {
		t.Fatal("ClientHello cached expired identity")
	}
}

func TestResponderNativeCompleteExactSANEncodingKeyBoundsAndLeafHorizon(t *testing.T) {
	_, config, leaf, _ := responderCompleteInput(t)
	now := time.Now()
	if err := verifyLeaf(leaf, config, leaf.NotBefore); err != nil {
		t.Fatal("inclusive native certificate NotBefore changed", err)
	}
	for _, key := range []any{&rsa.PublicKey{N: new(big.Int).Lsh(big.NewInt(1), 2047), E: 3}, &rsa.PublicKey{N: new(big.Int).Lsh(big.NewInt(1), 8191), E: 65537}, &ecdsa.PublicKey{Curve: elliptic.P256()}, &ecdsa.PublicKey{Curve: elliptic.P384()}, &ecdsa.PublicKey{Curve: elliptic.P521()}, ed25519.PublicKey(make([]byte, 32))} {
		v := *leaf
		v.PublicKey = key
		if err := verifyLeaf(&v, config, now); err != nil {
			t.Fatal("native supported metadata key bounds changed", err)
		}
	}
	for _, key := range []any{&rsa.PublicKey{E: 65537}, &rsa.PublicKey{N: new(big.Int).Lsh(big.NewInt(1), 2046), E: 3}, &rsa.PublicKey{N: new(big.Int).Lsh(big.NewInt(1), 8192), E: 3}, &rsa.PublicKey{N: new(big.Int).Lsh(big.NewInt(1), 2047), E: 2}} {
		v := *leaf
		v.PublicKey = key
		if err := verifyLeaf(&v, config, now); err == nil {
			t.Fatal("native RSA bounds relaxed")
		}
	}
	for _, mutate := range []func(*x509.Certificate){func(c *x509.Certificate) { c.Raw = make([]byte, MaximumLeafDERBytes+1) }, func(c *x509.Certificate) { c.ExtKeyUsage = nil }, func(c *x509.Certificate) { c.NotAfter = config.validUntil.Add(-time.Nanosecond) }} {
		v := *leaf
		mutate(&v)
		if err := verifyLeaf(&v, config, now); err == nil {
			t.Fatal("native leaf bound/horizon relaxed")
		}
	}
	san := func(names ...asn1.RawValue) []byte {
		raw, err := asn1.Marshal(names)
		if err != nil {
			t.Fatal(err)
		}
		return raw
	}
	dns := asn1.RawValue{Class: 2, Tag: 2, Bytes: []byte(config.serverName)}
	uri := asn1.RawValue{Class: 2, Tag: 6, Bytes: []byte(config.uri)}
	for _, value := range [][]byte{nil, {1}, append(san(dns, uri), 0), san(dns), san(uri), san(dns, dns, uri), san(dns, uri, uri), san(dns, uri, asn1.RawValue{Class: 2, Tag: 7, Bytes: []byte{127, 0, 0, 1}}), san(asn1.RawValue{Class: 2, Tag: 2, IsCompound: true, Bytes: []byte(config.serverName)}, uri), san(asn1.RawValue{Class: 0, Tag: 2, Bytes: []byte(config.serverName)}, uri), san(asn1.RawValue{Class: 2, Tag: 2, Bytes: []byte("other.test")}, uri)} {
		v := *leaf
		v.Extensions = append([]pkix.Extension(nil), leaf.Extensions...)
		for i := range v.Extensions {
			if v.Extensions[i].Id.Equal(asn1.ObjectIdentifier{2, 5, 29, 17}) {
				v.Extensions[i].Value = value
			}
		}
		if exactServiceSAN(&v, config) || verifyLeaf(&v, config, now) == nil {
			t.Fatal("native dedicated SAN raw encoding accepted", value)
		}
	}
	duplicate := *leaf
	for _, extension := range leaf.Extensions {
		if extension.Id.Equal(asn1.ObjectIdentifier{2, 5, 29, 17}) {
			duplicate.Extensions = append(append([]pkix.Extension(nil), leaf.Extensions...), extension)
			break
		}
	}
	if exactServiceSAN(&duplicate, config) {
		t.Fatal("multiple SAN extensions accepted")
	}
}

func TestResponderNativeCompleteNativeCredentialReadParseKeyPairFailureOrder(t *testing.T) {
	input, config, _, _ := responderCompleteInput(t)
	certificate, err := os.ReadFile(input.CertificatePath)
	if err != nil {
		t.Fatal(err)
	}
	private, err := os.ReadFile(input.PrivateKeyPath)
	if err != nil {
		t.Fatal(err)
	}
	exact := filepath.Join(t.TempDir(), "exact-file")
	if err := os.WriteFile(exact, bytes.Repeat([]byte{'a'}, MaximumPEMBytes), 0600); err != nil {
		t.Fatal(err)
	}
	if raw, err := readOperatorFile(exact, false); err != nil || len(raw) != MaximumPEMBytes {
		t.Fatal("inclusive native operator byte limit", err)
	}
	if runtime.GOOS != "linux" {
		return
	}
	for _, mode := range []string{"key-read-before-cert-pem", "key-pem-before-cert-der", "bad-der", "mismatched-key", "chain"} {
		t.Run(mode, func(t *testing.T) {
			cert, key := append([]byte(nil), certificate...), append([]byte(nil), private...)
			keyPath := config.privateKeyPath
			want := ""
			switch mode {
			case "key-read-before-cert-pem":
				cert = []byte("malformed certificate PEM")
				keyPath = filepath.Join(t.TempDir(), "absent-key")
				want = "OBSERVATION_CREDENTIAL_INVALID: bounded regular operator file required"
			case "key-pem-before-cert-der":
				cert = pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: []byte{1}})
				key = []byte("malformed private PEM")
				want = "OBSERVATION_CREDENTIAL_INVALID: exactly one unencrypted PEM block required"
			case "bad-der":
				cert = pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: []byte{1}})
				want = "OBSERVATION_CREDENTIAL_INVALID: valid leaf DER required"
			case "mismatched-key":
				_, other, _, _ := responderCompleteInput(t)
				key, err = os.ReadFile(other.privateKeyPath)
				if err != nil {
					t.Fatal(err)
				}
				want = "OBSERVATION_CREDENTIAL_INVALID: dedicated matching leaf and private key required"
			case "chain":
				cert = append(cert, certificate...)
				want = "OBSERVATION_CREDENTIAL_INVALID: exactly one unencrypted PEM block required"
			}
			if err := os.WriteFile(input.CertificatePath, cert, 0600); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(input.PrivateKeyPath, key, 0600); err != nil {
				t.Fatal(err)
			}
			c := config
			c.privateKeyPath = keyPath
			if native, leaf, err := loadTLS(c); native != nil || leaf != nil || err == nil || err.Error() != want {
				t.Fatal("native credential prerequisite/parse order changed", mode, err, want)
			}
		})
	}
}

type responderCompleteConn struct {
	net.Conn
	remote                          net.Addr
	raw                             []byte
	readErr, writeErr, deadlineErr  error
	readSize, writeSize, writeCount int
	deadline                        time.Time
	closes                          atomic.Int32
}

func (c *responderCompleteConn) Read(p []byte) (int, error) {
	c.readSize = len(p)
	n := copy(p, c.raw)
	c.raw = c.raw[n:]
	return n, c.readErr
}
func (c *responderCompleteConn) Write(p []byte) (int, error) {
	c.writeSize = len(p)
	n := len(p)
	if c.writeCount >= 0 && c.writeCount < n {
		n = c.writeCount
	}
	return n, c.writeErr
}
func (c *responderCompleteConn) RemoteAddr() net.Addr          { return c.remote }
func (c *responderCompleteConn) SetDeadline(d time.Time) error { c.deadline = d; return c.deadlineErr }
func (c *responderCompleteConn) Close() error {
	c.closes.Add(1)
	if c.Conn != nil {
		return c.Conn.Close()
	}
	return nil
}

type responderCompleteListener struct{ closed atomic.Int32 }

func (l *responderCompleteListener) Accept() (net.Conn, error) { return nil, io.EOF }
func (l *responderCompleteListener) Close() error              { l.closed.Add(1); return nil }
func (l *responderCompleteListener) Addr() net.Addr {
	return &net.TCPAddr{IP: net.IPv4(127, 0, 0, 1), Port: 12345}
}

type responderCompleteFileInfo struct {
	os.FileInfo
	system any
}

func (i responderCompleteFileInfo) Sys() any { return i.system }

func TestResponderNativeCompleteActualOSPrivateFileTypeAndOwnerPredicate(t *testing.T) {
	input, _, _, _ := responderCompleteInput(t)
	info, err := os.Stat(input.PrivateKeyPath)
	if err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS != "linux" {
		if privateFileAllowed(info) || privateFileAllowed(nil) {
			t.Fatal("unsupported native OS acquired private-file permission acceptance")
		}
		return
	}
	if privateFileAllowed(responderCompleteFileInfo{FileInfo: info, system: nil}) || privateFileAllowed(responderCompleteFileInfo{FileInfo: info, system: struct{}{}}) {
		t.Fatal("Linux ownership accepted missing/wrong native stat type")
	}
	original := reflect.ValueOf(info.Sys())
	if original.Kind() != reflect.Pointer {
		t.Fatal("Linux native Stat type changed")
	}
	foreign := reflect.New(original.Type().Elem())
	foreign.Elem().Set(original.Elem())
	uid := foreign.Elem().FieldByName("Uid")
	if !uid.IsValid() || !uid.CanSet() {
		t.Fatal("Linux native effective-owner field changed")
	}
	uid.SetUint((uid.Uint() + 1) & 0xffffffff)
	if privateFileAllowed(responderCompleteFileInfo{FileInfo: info, system: foreign.Interface()}) {
		t.Fatal("Linux foreign-owner key accepted")
	}
}

func TestResponderNativeCompleteRawWireExactCapClosePartialAndCrossDirectionRefusal(t *testing.T) {
	original := errors.New("original socket failure")
	raw := &responderCompleteConn{raw: []byte{1, 2, 3}, readErr: original, writeCount: -1}
	wire := &wireBudgetConn{Conn: raw, readBytes: MaximumReadWireBytes - 2}
	n, err := wire.Read(make([]byte, 10))
	if n != 2 || err != errWireBudget || raw.readSize != 2 || wire.readBytes != MaximumReadWireBytes || !wire.exhausted.Load() || raw.closes.Load() != 1 {
		t.Fatal("exact RX limit close/error precedence changed", n, err)
	}
	if n, err := wire.Write([]byte{1}); n != 0 || err != errWireBudget || raw.writeSize != 0 {
		t.Fatal("exhausted RX allowed TX")
	}
	raw = &responderCompleteConn{writeCount: -1}
	wire = &wireBudgetConn{Conn: raw, writeBytes: MaximumWriteWireBytes - 1}
	n, err = wire.Write([]byte{1})
	if n != 1 || err != errWireBudget || raw.closes.Load() != 1 || wire.writeBytes != MaximumWriteWireBytes {
		t.Fatal("exact TX cap did not close", n, err)
	}
	raw = &responderCompleteConn{writeCount: -1}
	wire = &wireBudgetConn{Conn: raw}
	if n, err := wire.Write(make([]byte, MaximumWriteWireBytes+1)); n != 0 || err != errWireBudget || raw.writeSize != 0 || raw.closes.Load() != 1 {
		t.Fatal("oversized write partially forwarded")
	}
	raw = &responderCompleteConn{writeCount: 2}
	wire = &wireBudgetConn{Conn: raw}
	if n, err := wire.Write([]byte{1, 2, 3}); n != 2 || err != io.ErrShortWrite || !wire.exhausted.Load() || raw.closes.Load() != 1 {
		t.Fatal("native short write not closed", n, err)
	}
	raw = &responderCompleteConn{raw: []byte{1, 2}, readErr: original, writeCount: 1, writeErr: original}
	wire = &wireBudgetConn{Conn: raw}
	if n, err := wire.Read(make([]byte, 9)); n != 2 || err != original || wire.readBytes != 2 || wire.exhausted.Load() {
		t.Fatal("partial RX original error changed")
	}
	if n, err := wire.Write([]byte{1, 2}); n != 1 || err != original || wire.writeBytes != 1 || wire.exhausted.Load() {
		t.Fatal("partial TX original error changed")
	}
	raw = &responderCompleteConn{writeCount: -1}
	wire = &wireBudgetConn{Conn: raw}
	if n, err := wire.Read(nil); n != 0 || err != nil {
		t.Fatal("zero RX changed")
	}
	if n, err := wire.Write(nil); n != 0 || err != nil || raw.closes.Load() != 0 {
		t.Fatal("zero TX changed")
	}
}

func TestResponderNativeCompleteGlobalAdmissionClockCapacityAndStopCause(t *testing.T) {
	_, config, leaf, _ := responderCompleteInput(t)
	config.maxConnections = 2
	config.handshakesPerSecond = 2
	for _, mode := range []string{"valid", "source", "remote-type", "stopping", "capacity", "expired", "rollback", "tokens", "refill"} {
		t.Run(mode, func(t *testing.T) {
			certificate := *leaf
			s := &server{config: config, certificate: &certificate, connections: map[net.Conn]struct{}{}, tokens: 2, refilledAt: time.Now()}
			c := &responderCompleteConn{remote: &net.TCPAddr{IP: net.IPv4(127, 0, 0, 1), Port: 3456}}
			switch mode {
			case "source":
				c.remote = &net.TCPAddr{IP: net.IPv4(192, 0, 2, 1), Port: 3456}
			case "remote-type":
				c.remote = &net.UnixAddr{Name: "foreign"}
			case "stopping":
				s.stopping = true
			case "capacity":
				s.connections[&responderCompleteConn{}] = struct{}{}
				s.connections[&responderCompleteConn{}] = struct{}{}
			case "expired":
				certificate.NotAfter = time.Now()
			case "rollback":
				s.refilledAt = time.Now().Add(time.Hour)
			case "tokens":
				s.tokens = 0
			case "refill":
				s.tokens = 0
				s.refilledAt = time.Now().Add(-time.Hour)
			}
			allowed := mode == "valid" || mode == "refill"
			if s.admit(c) != allowed {
				t.Fatal("global admission predicate changed", mode)
			}
			if allowed {
				if _, exists := s.connections[c]; !exists || s.tokens > 1 || s.tokens < 0 {
					t.Fatal("admitted connection/token not owned")
				}
				s.workers.Done()
			} else if _, exists := s.connections[c]; exists {
				t.Fatal("denied connection retained")
			}
		})
	}
	listener := &responderCompleteListener{}
	first, second := &responderCompleteConn{}, &responderCompleteConn{}
	cause := errors.New("first native stop cause")
	s := &server{listener: listener, connections: map[net.Conn]struct{}{first: {}, second: {}}}
	s.stop(cause)
	s.stop(nil)
	if !s.stopping || s.cause != cause || listener.closed.Load() != 1 || first.closes.Load() != 1 || second.closes.Load() != 1 {
		t.Fatal("stop cause/once-only listener/connections changed")
	}
}

func TestResponderNativeCompleteHandshakeEarlyDeadlineAlwaysClosesAndReleases(t *testing.T) {
	_, config, leaf, _ := responderCompleteInput(t)
	for _, mode := range []string{"expired", "setdeadline"} {
		t.Run(mode, func(t *testing.T) {
			c := &responderCompleteConn{writeCount: -1}
			s := &server{config: config, certificate: leaf, connections: map[net.Conn]struct{}{c: {}}}
			s.workers.Add(1)
			accepted := time.Now()
			if mode == "expired" {
				accepted = accepted.Add(-ConnectionTimeout)
			} else {
				c.deadlineErr = errors.New("SetDeadline refusal")
			}
			s.handshake(context.Background(), c, accepted)
			s.workers.Wait()
			if len(s.connections) != 0 || c.closes.Load() != 1 || c.readSize != 0 || c.writeSize != 0 {
				t.Fatal("early handshake did work/leaked native ownership")
			}
			if mode == "setdeadline" && !c.deadline.Equal(accepted.Add(ConnectionTimeout)) {
				t.Fatal("native acceptedAt deadline projection changed")
			}
		})
	}
}

func TestResponderNativeCompleteHandshakeEarliestNativeDeadlineAndPreTLSRefusal(t *testing.T) {
	_, config, leaf, _ := responderCompleteInput(t)
	for _, mode := range []string{"connection", "service", "certificate", "handshake-window", "invalid-leaf"} {
		t.Run(mode, func(t *testing.T) {
			c := &responderCompleteConn{writeCount: -1}
			certificate := *leaf
			s := &server{config: config, certificate: &certificate, connections: map[net.Conn]struct{}{c: {}}}
			s.workers.Add(1)
			accepted := time.Now()
			want := accepted.Add(ConnectionTimeout)
			switch mode {
			case "connection":
				c.deadlineErr = errors.New("stop before TLS")
			case "service":
				s.config.validUntil = accepted.Add(time.Second)
				want = s.config.validUntil
				c.deadlineErr = errors.New("stop before TLS")
			case "certificate":
				certificate.NotAfter = accepted.Add(500 * time.Millisecond)
				want = certificate.NotAfter
				c.deadlineErr = errors.New("stop before TLS")
			case "handshake-window":
				accepted = accepted.Add(-HandshakeTimeout - 100*time.Millisecond)
				want = accepted.Add(ConnectionTimeout)
			case "invalid-leaf":
				certificate.NotBefore = accepted.Add(time.Hour)
			}
			s.handshake(context.Background(), c, accepted)
			s.workers.Wait()
			if !c.deadline.Equal(want) || len(s.connections) != 0 || c.closes.Load() != 1 || c.readSize != 0 || c.writeSize != 0 {
				t.Fatal("native minimum deadline/refusal or worker cleanup changed", mode, c.deadline, want, c.closes.Load())
			}
		})
	}
}

func TestResponderNativeCompleteSupervisionExpiryAndCredentialClockStops(t *testing.T) {
	_, config, leaf, _ := responderCompleteInput(t)
	for _, mode := range []string{"context", "window", "credential"} {
		t.Run(mode, func(t *testing.T) {
			copy := *leaf
			c := config
			listener := &responderCompleteListener{}
			s := &server{config: c, certificate: &copy, listener: listener, connections: map[net.Conn]struct{}{}}
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			if mode == "context" {
				cancel()
			}
			if mode == "window" {
				s.config.validUntil = time.Now().Add(20 * time.Millisecond)
			}
			if mode == "credential" {
				copy.NotAfter = time.Now().Add(-time.Second)
			}
			done := make(chan struct{})
			go s.supervise(ctx, done)
			select {
			case <-done:
			case <-time.After(2 * time.Second):
				t.Fatal("native supervision did not stop")
			}
			if listener.closed.Load() != 1 || !s.stopping || (s.cause == nil) != (mode == "context") {
				t.Fatal("native context/window/credential stop cause", s.cause)
			}
		})
	}
}

func TestResponderNativeCompleteRunNativeListenTLSNoApplicationAndFiniteLifetime(t *testing.T) {
	input, config, _, _ := responderCompleteInput(t)
	if runtime.GOOS != "linux" {
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		if err := Run(ctx, input); err == nil || !strings.HasPrefix(err.Error(), "OBSERVATION_KEY_PERMISSION_UNVERIFIED:") {
			t.Fatal("native key prerequisite no longer precedes cancelled context", err)
		}
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := Run(ctx, input); err != context.Canceled {
		t.Fatal("native cancelled context lost before listen", err)
	}
	busy, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	input.Listen = busy.Addr().String()
	if err := Run(context.Background(), input); err == nil || err.Error() != "OBSERVATION_LISTEN_FAILED: explicit endpoint unavailable" {
		t.Fatal("native busy listener error changed", err)
	}
	busy.Close()
	for _, mode := range []string{"tls", "lifetime"} {
		t.Run(mode, func(t *testing.T) {
			port, err := net.Listen("tcp4", "127.0.0.1:0")
			if err != nil {
				t.Fatal(err)
			}
			copy := input
			copy.Listen = port.Addr().String()
			port.Close()
			if mode == "lifetime" {
				copy.ValidUntil = time.Now().Add(500 * time.Millisecond).UTC().Format("2006-01-02T15:04:05.000Z")
			}
			parent, stop := context.WithTimeout(context.Background(), 4*time.Second)
			defer stop()
			runContext, runCancel := context.WithCancel(parent)
			defer runCancel()
			done := make(chan error, 1)
			go func() { done <- Run(runContext, copy) }()
			if mode == "tls" {
				var ready net.Conn
				for ready == nil {
					ready, err = net.DialTimeout("tcp4", copy.Listen, 20*time.Millisecond)
					if err != nil {
						select {
						case err := <-done:
							t.Fatal("native Run stopped before listen", err)
						case <-parent.Done():
							t.Fatal("native listener did not become ready")
						case <-time.After(time.Millisecond):
						}
					}
				}
				ready.Close()
				cache := tls.NewLRUClientSessionCache(1)
				for _, peer := range []string{"valid", "wrong-sni", "wrong-alpn", "multiple-alpn", "tls12", "read-budget", "valid-again"} {
					client := &tls.Config{MinVersion: tls.VersionTLS13, MaxVersion: tls.VersionTLS13, ServerName: config.serverName, NextProtos: []string{ALPN}, InsecureSkipVerify: true, ClientSessionCache: cache}
					switch peer {
					case "wrong-sni":
						client.ServerName = "other.test"
					case "wrong-alpn":
						client.NextProtos = []string{"other/1"}
					case "multiple-alpn":
						client.NextProtos = []string{ALPN, "other/1"}
					case "tls12":
						client.MinVersion = tls.VersionTLS12
						client.MaxVersion = tls.VersionTLS12
					case "read-budget":
						client.NextProtos = make([]string, 130)
						for i := range client.NextProtos {
							client.NextProtos[i] = strings.Repeat("p", 255)
						}
					}
					secured, err := tls.DialWithDialer(&net.Dialer{Timeout: time.Second}, "tcp4", copy.Listen, client)
					valid := peer == "valid" || peer == "valid-again"
					if !valid {
						if secured != nil {
							secured.Close()
						}
						if err == nil {
							t.Fatal("dedicated native responder accepted forbidden peer", peer)
						}
						continue
					}
					if err != nil {
						t.Fatal("dedicated native responder TLS failed", peer, err)
					}
					if state := secured.ConnectionState(); state.Version != tls.VersionTLS13 || state.NegotiatedProtocol != ALPN || state.DidResume || len(state.PeerCertificates) != 1 {
						t.Fatal("native responder TLS state changed")
					}
					secured.SetReadDeadline(time.Now().Add(time.Second))
					b := make([]byte, 1)
					if n, err := secured.Read(b); n != 0 || err == nil {
						t.Fatal("responder sent application data or retained application connection")
					}
					secured.Close()
				}
				runCancel()
			}
			select {
			case err := <-done:
				if mode == "tls" && err != nil || mode == "lifetime" && (err == nil || !strings.HasPrefix(err.Error(), "OBSERVATION_EXPIRED:")) {
					t.Fatal("native finite/cancel Run outcome", err)
				}
			case <-parent.Done():
				t.Fatal("native Run did not join workers before returning")
			}
		})
	}
}
