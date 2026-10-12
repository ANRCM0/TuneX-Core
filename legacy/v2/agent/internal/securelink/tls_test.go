package securelink

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"io"
	"math/big"
	"net"
	"net/url"
	"testing"
	"time"
)

func makeIdentities(t testing.TB, expired ...bool) (Identity, Identity) {
	t.Helper()
	caKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	ca := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "TST test CA"}, NotBefore: now.Add(-time.Minute), NotAfter: now.Add(time.Hour), IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign}
	caDER, err := x509.CreateCertificate(rand.Reader, ca, ca, &caKey.PublicKey, caKey)
	if err != nil {
		t.Fatal(err)
	}
	caPEM := string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: caDER}))
	issue := func(node int64, role string) Identity {
		key, e := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		if e != nil {
			t.Fatal(e)
		}
		uri := identityURI(node, role)
		parsed, _ := url.Parse(uri)
		leaf := &x509.Certificate{SerialNumber: big.NewInt(node + 2), Subject: pkix.Name{CommonName: "test"}, NotBefore: now.Add(-time.Minute), NotAfter: now.Add(time.Hour), KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth}, DNSNames: []string{"tst-node-" + big.NewInt(node).String() + ".tunex.invalid"}, URIs: []*url.URL{parsed}}
		if len(expired) > 0 && expired[0] && role == "ingress" {
			leaf.NotBefore = now.Add(-time.Hour)
			leaf.NotAfter = now.Add(-time.Minute)
		}
		der, e := x509.CreateCertificate(rand.Reader, leaf, ca, &key.PublicKey, caKey)
		if e != nil {
			t.Fatal(e)
		}
		private, e := x509.MarshalPKCS8PrivateKey(key)
		if e != nil {
			t.Fatal(e)
		}
		return Identity{CertificatePEM: string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})), PrivateKeyPEM: string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: private})), CAPEM: caPEM, OwnURI: uri}
	}
	client, server := issue(12, "ingress"), issue(23, "egress")
	client.PeerURI = server.OwnURI
	server.PeerURI = client.OwnURI
	return client, server
}

func identityURI(node int64, role string) string {
	return "urn:tunex:tst:w:1:l:2:n:" + big.NewInt(node).String() + ":r:" + role
}

func TestTLSMutualIdentityAndALPN(t *testing.T) {
	clientIdentity, serverIdentity := makeIdentities(t)
	for _, scenario := range []string{"valid", "wrong_workspace", "wrong_role", "wrong_ca", "expired", "tls12", "wrong_alpn", "missing_client"} {
		t.Run(scenario, func(t *testing.T) {
			client, err := TLSConfig(clientIdentity)
			if err != nil {
				t.Fatal(err)
			}
			server, err := TLSConfig(serverIdentity)
			if err != nil {
				t.Fatal(err)
			}
			switch scenario {
			case "wrong_workspace":
				bad := serverIdentity
				bad.PeerURI = "urn:tunex:tst:w:99:l:2:n:12:r:ingress"
				server, err = TLSConfig(bad)
			case "wrong_role":
				bad := serverIdentity
				bad.PeerURI = identityURI(12, "egress")
				server, err = TLSConfig(bad)
			case "wrong_ca":
				foreign, _ := makeIdentities(t)
				bad := clientIdentity
				bad.CAPEM = foreign.CAPEM
				client, err = TLSConfig(bad)
			case "tls12":
				client.MinVersion = tls.VersionTLS12
				client.MaxVersion = tls.VersionTLS12
			case "wrong_alpn":
				client.NextProtos = []string{"unknown/1"}
			case "missing_client":
				client.Certificates = nil
			case "expired":
				bad, badServer := makeIdentities(t, true)
				client, err = TLSConfig(bad)
				if err != nil {
					t.Fatal(err)
				}
				server, err = TLSConfig(badServer)
			}
			if err != nil {
				t.Fatal(err)
			}
			listener, err := net.Listen("tcp", "127.0.0.1:0")
			if err != nil {
				t.Fatal(err)
			}
			defer listener.Close()
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			serverResult := make(chan error, 1)
			go func() {
				raw, e := listener.Accept()
				if e != nil {
					serverResult <- e
					return
				}
				defer raw.Close()
				conn := tls.Server(raw, server)
				e = conn.HandshakeContext(ctx)
				if e == nil {
					_, e = conn.Write([]byte("ok"))
				}
				serverResult <- e
			}()
			raw, err := net.DialTimeout("tcp", listener.Addr().String(), time.Second)
			if err != nil {
				t.Fatal(err)
			}
			defer raw.Close()
			conn := tls.Client(raw, client)
			err = conn.HandshakeContext(ctx)
			if err == nil {
				_ = conn.SetReadDeadline(time.Now().Add(time.Second))
				buf := make([]byte, 2)
				_, err = conn.Read(buf)
			}
			serverErr := <-serverResult
			if scenario == "valid" {
				if err != nil || serverErr != nil {
					t.Fatalf("valid: %v %v", err, serverErr)
				}
			} else if err == nil && serverErr == nil {
				t.Fatal("authentication failure admitted")
			}
		})
	}
}

func BenchmarkTSTMutualTLS(b *testing.B) {
	clientIdentity, serverIdentity := makeIdentities(b)
	clientConfig, err := TLSConfig(clientIdentity)
	if err != nil {
		b.Fatal(err)
	}
	serverConfig, err := TLSConfig(serverIdentity)
	if err != nil {
		b.Fatal(err)
	}
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		b.Fatal(err)
	}
	defer listener.Close()
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	serverReady := make(chan *Session, 1)
	result := make(chan error, 1)
	go func() {
		raw, e := listener.Accept()
		if e != nil {
			result <- e
			return
		}
		conn := tls.Server(raw, serverConfig)
		if e = conn.HandshakeContext(ctx); e != nil {
			_ = raw.Close()
			result <- e
			return
		}
		session := NewSession(conn, true)
		serverReady <- session
		st, e := session.Accept(ctx)
		if e != nil {
			result <- e
			return
		}
		if e = st.Accept(); e != nil {
			result <- e
			return
		}
		_, e = io.Copy(io.Discard, st)
		result <- e
	}()
	raw, err := net.DialTimeout("tcp", listener.Addr().String(), time.Second)
	if err != nil {
		b.Fatal(err)
	}
	conn := tls.Client(raw, clientConfig)
	if err = conn.HandshakeContext(ctx); err != nil {
		b.Fatal(err)
	}
	client := NewSession(conn, false)
	defer client.Close()
	var server *Session
	select {
	case server = <-serverReady:
	case err = <-result:
		b.Fatal(err)
	}
	defer server.Close()
	st, err := client.Open(ctx, OpenRequest{ForwardID: 1, Revision: 1, Protocol: "tcp"})
	if err != nil {
		b.Fatal(err)
	}
	defer st.Close()
	payload := make([]byte, MaxData)
	b.SetBytes(MaxData)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err = st.Write(payload); err != nil {
			b.Fatal(err)
		}
	}
	b.StopTimer()
	if err = st.CloseWrite(); err != nil {
		b.Fatal(err)
	}
	if err = <-result; err != nil {
		b.Fatal(err)
	}
}

func BenchmarkPlainTCP(b *testing.B) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		b.Fatal(err)
	}
	defer listener.Close()
	result := make(chan error, 1)
	go func() {
		conn, e := listener.Accept()
		if e != nil {
			result <- e
			return
		}
		defer conn.Close()
		_, e = io.Copy(io.Discard, conn)
		result <- e
	}()
	conn, err := net.DialTimeout("tcp", listener.Addr().String(), time.Second)
	if err != nil {
		b.Fatal(err)
	}
	defer conn.Close()
	payload := make([]byte, MaxData)
	b.SetBytes(MaxData)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err = conn.Write(payload); err != nil {
			b.Fatal(err)
		}
	}
	b.StopTimer()
	_ = conn.Close()
	if err = <-result; err != nil {
		b.Fatal(err)
	}
}
