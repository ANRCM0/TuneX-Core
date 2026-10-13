package relay

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"math/big"
	"net"
	"net/url"
	"testing"
	"time"
)

type testCA struct {
	key         *ecdsa.PrivateKey
	certificate *x509.Certificate
	roots       *x509.CertPool
}

func createCA(t *testing.T) testCA {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	template := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "Relay Test CA"}, NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour), IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign}
	raw, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	cert, err := x509.ParseCertificate(raw)
	if err != nil {
		t.Fatal(err)
	}
	roots := x509.NewCertPool()
	roots.AddCert(cert)
	return testCA{key, cert, roots}
}
func (c testCA) issue(t *testing.T, node string, usage []x509.ExtKeyUsage, expired bool) tls.Certificate {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	uri, err := url.Parse("urn:tunex:node:" + node)
	if err != nil {
		t.Fatal(err)
	}
	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 100))
	if err != nil {
		t.Fatal(err)
	}
	until := time.Now().Add(time.Hour)
	if expired {
		until = time.Now().Add(-time.Second)
	}
	template := &x509.Certificate{SerialNumber: serial, Subject: pkix.Name{CommonName: node}, NotBefore: time.Now().Add(-time.Hour), NotAfter: until, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: usage, URIs: []*url.URL{uri}}
	raw, err := x509.CreateCertificate(rand.Reader, template, c.certificate, &key.PublicKey, c.key)
	if err != nil {
		t.Fatal(err)
	}
	leaf, err := x509.ParseCertificate(raw)
	if err != nil {
		t.Fatal(err)
	}
	return tls.Certificate{Certificate: [][]byte{raw}, PrivateKey: key, Leaf: leaf}
}
func handshake(t *testing.T, serverConfig, clientConfig *tls.Config) (error, error) {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	serverResult := make(chan error, 1)
	go func() {
		raw, err := listener.Accept()
		if err != nil {
			serverResult <- err
			return
		}
		defer raw.Close()
		raw.SetDeadline(time.Now().Add(2 * time.Second))
		server := tls.Server(raw, serverConfig)
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		serverResult <- server.HandshakeContext(ctx)
	}()
	raw, err := net.DialTimeout("tcp", listener.Addr().String(), time.Second)
	if err != nil {
		t.Fatal(err)
	}
	defer raw.Close()
	raw.SetDeadline(time.Now().Add(2 * time.Second))
	client := tls.Client(raw, clientConfig)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	clientErr := client.HandshakeContext(ctx)
	if clientErr == nil {
		var b [1]byte
		_, clientErr = client.Read(b[:])
		if clientErr != nil && clientErr.Error() == "EOF" {
			clientErr = nil
		}
	}
	return <-serverResult, clientErr
}
func TestMutualTLSExactNodeIdentityAndNoDowngrade(t *testing.T) {
	ca := createCA(t)
	usage := []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth}
	server := ca.issue(t, "node-b", usage, false)
	client := ca.issue(t, "node-a", usage, false)
	serverConfig, err := TLSConfig(server, ca.roots, "node-a", []string{Fingerprint(client.Leaf)}, true)
	if err != nil {
		t.Fatal(err)
	}
	clientConfig, err := TLSConfig(client, ca.roots, "node-b", []string{Fingerprint(server.Leaf)}, false)
	if err != nil {
		t.Fatal(err)
	}
	if se, ce := handshake(t, serverConfig, clientConfig); se != nil || ce != nil {
		t.Fatal(se, ce)
	}
	old := clientConfig.Clone()
	old.MinVersion = tls.VersionTLS12
	old.MaxVersion = tls.VersionTLS12
	if se, ce := handshake(t, serverConfig, old); se == nil && ce == nil {
		t.Fatal("TLS downgrade accepted")
	}
}
func TestMutualTLSRefusesForeignNodeTrustPurposeExpiryAndPin(t *testing.T) {
	ca := createCA(t)
	usage := []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth}
	server := ca.issue(t, "node-b", usage, false)
	client := ca.issue(t, "node-a", usage, false)
	foreign := createCA(t)
	for _, scenario := range []struct {
		name      string
		cert      tls.Certificate
		roots     *x509.CertPool
		node, pin string
	}{
		{"wrong-node", client, ca.roots, "node-c", Fingerprint(server.Leaf)}, {"wrong-ca", client, foreign.roots, "node-b", Fingerprint(server.Leaf)}, {"wrong-pin", client, ca.roots, "node-b", "sha256:1111111111111111111111111111111111111111111111111111111111111111"}, {"expired-client", ca.issue(t, "node-a", usage, true), ca.roots, "node-b", Fingerprint(server.Leaf)}, {"client-only-leaf", ca.issue(t, "node-a", []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth}, false), ca.roots, "node-b", Fingerprint(server.Leaf)},
		{"wrong-client-purpose", ca.issue(t, "node-a", []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}, false), ca.roots, "node-b", Fingerprint(server.Leaf)}, {"foreign-client", foreign.issue(t, "node-a", usage, false), ca.roots, "node-b", Fingerprint(server.Leaf)},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			sc, err := TLSConfig(server, ca.roots, "node-a", []string{Fingerprint(scenario.cert.Leaf)}, true)
			if err != nil {
				t.Fatal(err)
			}
			cc, err := TLSConfig(scenario.cert, scenario.roots, scenario.node, []string{scenario.pin}, false)
			if err != nil {
				t.Fatal(err)
			}
			if se, ce := handshake(t, sc, cc); se == nil && ce == nil {
				t.Fatal("invalid identity accepted")
			}
		})
	}
}
