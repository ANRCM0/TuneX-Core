package forwarder

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"io"
	"math/big"
	"net"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/tunex/agent/internal/securelink"
)

func routeTestPair(t *testing.T, from, to int) (*securelink.Identity, *securelink.Identity) {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	ca := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "routing test CA"},
		NotBefore: now.Add(-time.Minute), NotAfter: now.Add(time.Hour), IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign}
	der, err := x509.CreateCertificate(rand.Reader, ca, ca, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	capem := string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}))
	issue := func(node int, role string) *securelink.Identity {
		own := routeURI(7, 40, node, role)
		uri, _ := url.Parse(own)
		k, e := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		if e != nil {
			t.Fatal(e)
		}
		leaf := &x509.Certificate{SerialNumber: big.NewInt(int64(node + 2)), Subject: pkix.Name{CommonName: "routing node"}, NotBefore: ca.NotBefore, NotAfter: ca.NotAfter,
			KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth},
			DNSNames: []string{"tst-node-" + strconv.Itoa(node) + ".tunex.invalid"}, URIs: []*url.URL{uri}}
		cert, e := x509.CreateCertificate(rand.Reader, leaf, ca, &k.PublicKey, key)
		if e != nil {
			t.Fatal(e)
		}
		private, e := x509.MarshalPKCS8PrivateKey(k)
		if e != nil {
			t.Fatal(e)
		}
		return &securelink.Identity{CertificatePEM: string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: cert})),
			PrivateKeyPEM: string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: private})), CAPEM: capem, OwnURI: own}
	}
	client, server := issue(from, "ingress"), issue(to, "egress")
	client.PeerURI = server.OwnURI
	server.PeerURI = client.OwnURI
	return client, server
}

func TestRoutingThreeHopRealPayloadAndPlainBypassRefused(t *testing.T) {
	target, stop := echoTarget(t)
	defer stop()
	host, portstr, _ := net.SplitHostPort(target)
	port, _ := strconv.Atoi(portstr)
	out1, in1 := routeTestPair(t, 1, 2)
	out2, in2 := routeTestPair(t, 2, 3)
	path := []int{1, 2, 3}
	grant := func(index int, in, out *securelink.Identity) *RouteAuth {
		return &RouteAuth{Version: 1, WorkspaceID: 7, ForwardID: 40, Revision: 5, NodeIDs: path, HopIndex: index, Incoming: in, Outgoing: out}
	}
	exitPort, middlePort, ingressPort := freePort(t), freePort(t), freePort(t)
	exit, err := NewEgress(TunnelConfig{ID: "exit", Mode: ModeEgress, Protocol: ProtocolTCP, EgressPort: exitPort, Revision: 5, RouteAuth: grant(2, in2, nil)}, staticSelector{Target{Host: host, Port: port}})
	if err != nil {
		t.Fatal(err)
	}
	if err = exit.Start(); err != nil {
		t.Fatal(err)
	}
	defer exit.Stop()
	middle, err := NewEgress(TunnelConfig{ID: "middle", Mode: ModeEgress, Protocol: ProtocolTCP, EgressPort: middlePort, Revision: 5, RouteAuth: grant(1, in1, out2)}, staticSelector{Target{Host: "127.0.0.1", Port: exitPort}})
	if err != nil {
		t.Fatal(err)
	}
	if err = middle.Start(); err != nil {
		t.Fatal(err)
	}
	defer middle.Stop()
	ingress, err := NewSingleHop(TunnelConfig{ID: "ingress", Mode: ModeRelay, Protocol: ProtocolTCP, IngressPort: ingressPort, NextHop: net.JoinHostPort("127.0.0.1", strconv.Itoa(middlePort)), Revision: 5, RouteAuth: grant(0, nil, out1)})
	if err != nil {
		t.Fatal(err)
	}
	if err = ingress.Start(); err != nil {
		t.Fatal(err)
	}
	defer ingress.Stop()
	conn, err := net.DialTimeout("tcp", net.JoinHostPort("127.0.0.1", strconv.Itoa(ingressPort)), time.Second)
	if err != nil {
		t.Fatal(err)
	}
	_ = conn.SetDeadline(time.Now().Add(3 * time.Second))
	payload := []byte("authorized-three-hop-payload")
	if _, err = conn.Write(payload); err != nil {
		t.Fatal(err)
	}
	got := make([]byte, len(payload))
	if _, err = io.ReadFull(conn, got); err != nil || string(got) != string(payload) {
		t.Fatalf("payload %q %v", got, err)
	}
	_ = conn.Close()
	// Count application bytes once at each observation point. Neither TLS
	// records nor the path header belong to the Forward's payload budget.
	want := int64(2 * len(payload))
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) && (ingress.Stats() != want || middle.Stats() != want || exit.Stats() != want) {
		time.Sleep(time.Millisecond)
	}
	if ingress.Stats() != want || middle.Stats() != want || exit.Stats() != want {
		t.Fatalf("payload meters ingress/middle/exit = %d/%d/%d, want %d each", ingress.Stats(), middle.Stats(), exit.Stats(), want)
	}
	for _, p := range []int{middlePort, exitPort} {
		plain, e := net.DialTimeout("tcp", net.JoinHostPort("127.0.0.1", strconv.Itoa(p)), time.Second)
		if e != nil {
			t.Fatal(e)
		}
		_ = plain.SetDeadline(time.Now().Add(time.Second))
		_, _ = plain.Write([]byte("plaintext-bypass"))
		var b [1]byte
		_, e = plain.Read(b[:])
		_ = plain.Close()
		if e == nil {
			t.Fatal("unauthenticated connection reached target")
		}
	}
}

func TestRoutingHeaderRejectsRevisionWorkspacePathTTLAndForeignCA(t *testing.T) {
	out, in := routeTestPair(t, 1, 2)
	client := &RouteAuth{Version: 1, WorkspaceID: 7, ForwardID: 40, Revision: 5, NodeIDs: []int{1, 2}, HopIndex: 0, Outgoing: out}
	server := &RouteAuth{Version: 1, WorkspaceID: 7, ForwardID: 40, Revision: 5, NodeIDs: []int{1, 2}, HopIndex: 1, Incoming: in}
	for _, name := range []string{"valid", "workspace", "forward", "revision", "ttl", "loop", "foreign_ca", "missing_client"} {
		t.Run(name, func(t *testing.T) {
			left, right := net.Pipe()
			defer left.Close()
			defer right.Close()
			done := make(chan error, 1)
			go func() { _, err := routeIncoming(server, right); done <- err }()
			id := *out
			cfg, err := securelink.RoutingTLSConfig(id)
			if err != nil {
				t.Fatal(err)
			}
			if name == "foreign_ca" {
				foreign, _ := routeTestPair(t, 1, 2)
				cfg, err = securelink.RoutingTLSConfig(*foreign)
				if err != nil {
					t.Fatal(err)
				}
			}
			if name == "missing_client" {
				cfg.Certificates = nil
			}
			conn := tls.Client(left, cfg)
			_ = conn.SetDeadline(time.Now().Add(time.Second))
			err = conn.Handshake()
			if err == nil {
				header := routeHeader(client, 1)
				switch name {
				case "workspace":
					header[7]++
				case "forward":
					header[11]++
				case "revision":
					header[19]++
				case "ttl":
					header[22] = 0
				case "loop":
					copy(header[28:32], header[24:28])
				}
				_, err = conn.Write(header)
				if err == nil {
					var ack [1]byte
					_, err = io.ReadFull(conn, ack[:])
					if err == nil && ack[0] != 1 {
						err = ErrRouteIdentity
					}
				}
			}
			_ = left.Close()
			_ = right.Close()
			serverErr := <-done
			if name == "valid" {
				if err != nil || serverErr != nil {
					t.Fatalf("%v %v", err, serverErr)
				}
			} else if err == nil || serverErr == nil {
				t.Fatalf("accepted %s", name)
			}
		})
	}
}

func TestRoutingGrantValidationCloneAndPublicProjection(t *testing.T) {
	out, _ := routeTestPair(t, 1, 2)
	cfg := TunnelConfig{ID: "route", Mode: ModeRelay, Protocol: ProtocolTCP, IngressPort: 22000, NextHop: "127.0.0.1:22001", Revision: 5,
		RouteAuth: &RouteAuth{Version: 1, WorkspaceID: 7, ForwardID: 40, Revision: 5, NodeIDs: []int{1, 2}, HopIndex: 0, Outgoing: out}}
	if err := cfg.Validate(); err != nil {
		t.Fatal(err)
	}
	clone := cfg.Clone()
	clone.RouteAuth.NodeIDs[1] = 1
	if err := clone.Validate(); err == nil {
		t.Fatal("loop accepted")
	}
	clone = cfg.Clone()
	clone.RouteAuth.Revision++
	if err := clone.Validate(); err == nil {
		t.Fatal("wrong revision accepted")
	}
	clone = cfg.Clone()
	clone.Protocol = ProtocolBoth
	if err := clone.Validate(); err == nil {
		t.Fatal("unsupported datagrams accepted")
	}
	clone = cfg.Clone()
	clone.RouteAuth = nil
	if SameDataPlanePolicy(cfg, clone) {
		t.Fatal("security change hot-swapped")
	}
	wire, _ := json.Marshal(cfg.PublicConfig())
	if strings.Contains(string(wire), "route_auth") || strings.Contains(string(wire), "PRIVATE KEY") {
		t.Fatal("private grant leaked")
	}
	if cfg.RouteAuth.NodeIDs[1] != 2 {
		t.Fatal("clone mutated original")
	}
}
