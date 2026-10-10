package tstruntime

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/tunex/agent/internal/forwarder"
	"github.com/tunex/agent/internal/manager"
	"github.com/tunex/agent/internal/portlease"
	"github.com/tunex/agent/internal/securelink"
)

type recordingPortGuard struct {
	mu     sync.Mutex
	owners map[string][]portlease.Binding
}

func (g *recordingPortGuard) ReserveExternal(owner string, bindings []portlease.Binding) error {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.owners[owner] = append([]portlease.Binding(nil), bindings...)
	return nil
}

func (g *recordingPortGuard) ReleaseExternal(owner string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	delete(g.owners, owner)
}

func (g *recordingPortGuard) bindings(owner string) []portlease.Binding {
	g.mu.Lock()
	defer g.mu.Unlock()
	return append([]portlease.Binding(nil), g.owners[owner]...)
}

func identities(t testing.TB) (securelink.Identity, securelink.Identity) {
	return identitiesExpiring(t, time.Now().Add(time.Hour), time.Now().Add(time.Hour))
}
func identitiesExpiring(t testing.TB, ingressExpiry, egressExpiry time.Time) (securelink.Identity, securelink.Identity) {
	t.Helper()
	caKey, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	ca := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "runtime test CA"}, NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour), IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign}
	der, e := x509.CreateCertificate(rand.Reader, ca, ca, &caKey.PublicKey, caKey)
	if e != nil {
		t.Fatal(e)
	}
	caPEM := string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}))
	leaf := func(node, peer int64, role, peerRole string) securelink.Identity {
		key, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		uri, _ := url.Parse(identityURI(5, 91, node, role))
		expires := ingressExpiry
		if role == "egress" {
			expires = egressExpiry
		}
		c := &x509.Certificate{SerialNumber: big.NewInt(node), Subject: pkix.Name{CommonName: role}, NotBefore: ca.NotBefore, NotAfter: expires, KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth}, URIs: []*url.URL{uri}, DNSNames: []string{fmt.Sprintf("tst-node-%d.tunex.invalid", node)}}
		der, e := x509.CreateCertificate(rand.Reader, c, ca, &key.PublicKey, caKey)
		if e != nil {
			t.Fatal(e)
		}
		pk, _ := x509.MarshalPKCS8PrivateKey(key)
		return securelink.Identity{CertificatePEM: string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})), PrivateKeyPEM: string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: pk})), CAPEM: caPEM, PeerURI: identityURI(5, 91, peer, peerRole)}
	}
	return leaf(7, 8, "ingress", "egress"), leaf(8, 7, "egress", "ingress")
}
func freePort(t testing.TB) int {
	t.Helper()
	l, e := net.Listen("tcp", "127.0.0.1:0")
	if e != nil {
		t.Fatal(e)
	}
	p := l.Addr().(*net.TCPAddr).Port
	l.Close()
	return p
}
func configFor(t testing.TB, role string, identity securelink.Identity, carrier int, bindings []Binding) Config {
	t.Helper()
	node, peer := int64(7), int64(8)
	if role == "egress" {
		node, peer = peer, node
	}
	transport := TransportConfig{Protocol: "tst/1", Role: role, WorkspaceID: 5, LinkID: 91, NodeID: node, PeerNodeID: peer, CarrierHost: "127.0.0.1", CarrierPort: carrier, Identity: identity, Bindings: bindings}
	raw, _ := json.Marshal(transport)
	digest, e := Digest(raw)
	if e != nil {
		t.Fatal(e)
	}
	c := Config{ID: "link-" + role, WorkspaceID: 5, LinkID: 91, NodeID: node, Role: role, Generation: 1, LeaseExpiresAt: time.Now().Add(time.Minute).UTC().Format(time.RFC3339Nano), ConfigDigest: digest, TransportConfig: raw, Ports: []Port{}, RuntimeIDs: []string{}}
	if role == "egress" {
		c.Ports = append(c.Ports, Port{"tcp", "127.0.0.1", carrier})
	} else {
		for _, b := range bindings {
			for _, p := range []string{"tcp", "udp"} {
				if b.Protocol == p || b.Protocol == "both" {
					c.Ports = append(c.Ports, Port{p, b.ListenHost, b.ListenPort})
				}
			}
		}
	}
	return c
}
func revise(t *testing.T, c Config, mutate func(*TransportConfig)) Config {
	t.Helper()
	var tr TransportConfig
	json.Unmarshal(c.TransportConfig, &tr)
	mutate(&tr)
	c.TransportConfig, _ = json.Marshal(tr)
	c.ConfigDigest, _ = Digest(c.TransportConfig)
	c.Generation++
	return c
}
func testManager(t testing.TB, dir, id string) *Manager {
	t.Helper()
	m, e := New(dir, id)
	if e != nil {
		t.Fatal(e)
	}
	if e = m.EnableTraffic(); e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { m.Close() })
	return m
}
func echoTargets(t testing.TB) (int, int) {
	t.Helper()
	tcp, e := net.Listen("tcp", "127.0.0.1:0")
	if e != nil {
		t.Fatal(e)
	}
	udp, e := net.ListenUDP("udp", &net.UDPAddr{IP: net.ParseIP("127.0.0.1")})
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { tcp.Close(); udp.Close() })
	go func() {
		for {
			c, e := tcp.Accept()
			if e != nil {
				return
			}
			go func() { defer c.Close(); io.Copy(c, c) }()
		}
	}()
	go func() {
		b := make([]byte, 65507)
		for {
			n, a, e := udp.ReadFromUDP(b)
			if e != nil {
				return
			}
			udp.WriteToUDP(b[:n], a)
		}
	}()
	return tcp.Addr().(*net.TCPAddr).Port, udp.LocalAddr().(*net.UDPAddr).Port
}
func exchange(t *testing.T, c net.Conn, payload string) {
	t.Helper()
	c.SetDeadline(time.Now().Add(4 * time.Second))
	if _, e := c.Write([]byte(payload)); e != nil {
		t.Fatal(e)
	}
	buf := make([]byte, len(payload))
	if _, e := io.ReadFull(c, buf); e != nil {
		t.Fatal(e)
	}
	if string(buf) != payload {
		t.Fatalf("payload %q", buf)
	}
}
func TestRealTCPUDPAndBoth(t *testing.T) {
	for _, protocol := range []string{"tcp", "udp", "both"} {
		t.Run(protocol, func(t *testing.T) {
			a, b := identities(t)
			tcp, udp := echoTargets(t)
			if protocol == "both" {
				// Bind UDP echo on the TCP target port so both address the same endpoint.
				u, e := net.ListenUDP("udp", &net.UDPAddr{IP: net.ParseIP("127.0.0.1"), Port: tcp})
				if e != nil {
					t.Fatal(e)
				}
				t.Cleanup(func() { u.Close() })
				go func() {
					buf := make([]byte, 65507)
					for {
						n, addr, e := u.ReadFromUDP(buf)
						if e != nil {
							return
						}
						u.WriteToUDP(buf[:n], addr)
					}
				}()
				udp = tcp
			}
			carrier, listen := freePort(t), freePort(t)
			target := tcp
			if protocol == "udp" {
				target = udp
			}
			in := configFor(t, "ingress", a, carrier, []Binding{{ForwardID: 101, Revision: 1, Protocol: protocol, ListenHost: "127.0.0.1", ListenPort: listen}})
			out := configFor(t, "egress", b, carrier, []Binding{{ForwardID: 101, Revision: 1, Protocol: protocol, TargetHost: "127.0.0.1", TargetPort: target}})
			mi, me := testManager(t, t.TempDir(), "in"), testManager(t, t.TempDir(), "out")
			if _, e := me.Apply(out); e != nil {
				t.Fatal(e)
			}
			if _, e := mi.Apply(in); e != nil {
				t.Fatal(e)
			}
			for _, network := range []string{"tcp", "udp"} {
				if protocol != network && protocol != "both" {
					continue
				}
				c, e := net.Dial(network, net.JoinHostPort("127.0.0.1", strconv.Itoa(listen)))
				if e != nil {
					t.Fatal(e)
				}
				exchange(t, c, network+" actual payload")
				c.Close()
			}
			deadline := time.Now().Add(3 * time.Second)
			var samples []TrafficSample
			for time.Now().Before(deadline) {
				samples, _ = mi.TrafficSamples()
				var total int64
				for _, s := range samples {
					n, _ := trafficNumber(s.BytesOut)
					total += n
				}
				if total > 0 {
					break
				}
				time.Sleep(10 * time.Millisecond)
			}
			if len(samples) != 1 {
				t.Fatalf("stats %v", samples)
			}
			if samples[0].BytesIn == "0" || samples[0].BytesOut == "0" || samples[0].Connections == "0" {
				t.Fatal(samples)
			}
			if !mi.Status()[0].Ready {
				t.Fatal("authenticated carrier not ready")
			}
			if len(me.Status()[0].TargetStatus) != 1 {
				t.Fatal("target observation missing")
			}
		})
	}
}

func TestCompilerShapedWildcardPlacement(t *testing.T) {
	a, b := identities(t)
	target, _ := echoTargets(t)
	carrier, listen := freePort(t), freePort(t)
	in := configFor(t, "ingress", a, carrier, []Binding{{ForwardID: 101, Revision: 1, Protocol: "tcp", ListenHost: "0.0.0.0", ListenPort: listen}})
	out := configFor(t, "egress", b, carrier, []Binding{{ForwardID: 101, Revision: 1, Protocol: "tcp", TargetHost: "127.0.0.1", TargetPort: target}})
	out = revise(t, out, func(c *TransportConfig) { c.CarrierHost = "0.0.0.0" })
	out.Ports[0].Host = "0.0.0.0"
	for _, c := range []*Config{&in, &out} {
		c.ID = "tunex-tst-91-" + c.Role
		c.RuntimeIDs = []string{"tunex-tst-91-f101-" + c.Role + "-tcp"}
		if _, _, e := validateConfig(c); e != nil {
			t.Fatal(c.Role, e)
		}
	}
	bad := cloneConfig(in)
	bad.Ports[0].Host = "127.0.0.1"
	if _, _, e := validateConfig(&bad); !errors.Is(e, ErrInvalidConfig) {
		t.Fatal("declared listener scope disagrees with binding", e)
	}
	bad = revise(t, in, func(c *TransportConfig) { c.Bindings[0].Revision = 0 })
	if _, _, e := validateConfig(&bad); !errors.Is(e, ErrInvalidConfig) {
		t.Fatal("unversioned authorization accepted", e)
	}
	mi, me := testManager(t, t.TempDir(), "in"), testManager(t, t.TempDir(), "out")
	if _, e := me.Apply(out); e != nil {
		t.Fatal(e)
	}
	if _, e := mi.Apply(in); e != nil {
		t.Fatal(e)
	}
	c, e := net.Dial("tcp", fmt.Sprintf("127.0.0.1:%d", listen))
	if e != nil {
		t.Fatal(e)
	}
	defer c.Close()
	exchange(t, c, "compiler wildcard listener")
	for _, m := range []*Manager{mi, me} {
		if o := m.Status()[0]; !o.Ready || o.State != "ready" {
			t.Fatalf("live runtime state violates Panel report contract: %+v", o)
		}
	}
	if e := mi.Close(); e != nil {
		t.Fatal(e)
	}
	if o := mi.Status()[0]; o.Ready || o.State != "closed" {
		t.Fatalf("closed runtime state violates Panel report contract: %+v", o)
	}
}

func TestHandshakeBudgetBoundsAndRefills(t *testing.T) {
	var budget handshakeBudget
	now := time.Now()
	for i := 0; i < handshakeBurst; i++ {
		if !budget.allow(now) {
			t.Fatal("initial handshake burst rejected", i)
		}
	}
	if budget.allow(now) || budget.allow(now.Add(249*time.Millisecond)) {
		t.Fatal("unauthenticated handshake rate was unbounded")
	}
	if !budget.allow(now.Add(250*time.Millisecond)) || budget.allow(now.Add(250*time.Millisecond)) {
		t.Fatal("refill did not grant exactly one handshake")
	}
	for i := 0; i < handshakeBurst; i++ {
		if !budget.allow(now.Add(time.Hour)) {
			t.Fatal("idle handshake budget did not refill", i)
		}
	}
	if budget.allow(now.Add(time.Hour)) || budget.allow(now) {
		t.Fatal("idle or reversed clock bypassed burst limit")
	}
}

func TestReorderedSameGenerationLeaseKeepsAppliedLongerLease(t *testing.T) {
	a, b := identities(t)
	target, _ := echoTargets(t)
	carrier, listen := freePort(t), freePort(t)
	in := configFor(t, "ingress", a, carrier, []Binding{{ForwardID: 101, Revision: 1, Protocol: "tcp", ListenHost: "127.0.0.1", ListenPort: listen}})
	out := configFor(t, "egress", b, carrier, []Binding{{ForwardID: 101, Revision: 1, Protocol: "tcp", TargetHost: "127.0.0.1", TargetPort: target}})
	mi, me := testManager(t, t.TempDir(), "in"), testManager(t, t.TempDir(), "out")
	if _, e := me.Apply(out); e != nil {
		t.Fatal(e)
	}
	if _, e := mi.Apply(in); e != nil {
		t.Fatal(e)
	}
	held, e := net.Dial("tcp", fmt.Sprintf("127.0.0.1:%d", listen))
	if e != nil {
		t.Fatal(e)
	}
	defer held.Close()
	exchange(t, held, "before lease reorder")
	longLease := time.Now().Add(2 * time.Minute).UTC().Format(time.RFC3339Nano)
	for _, entry := range []struct {
		manager *Manager
		config  Config
		owner   string
	}{{mi, in, "in"}, {me, out, "out"}} {
		fresh := cloneConfig(entry.config)
		fresh.LeaseExpiresAt = longLease
		// The authoritative snapshot renewal arrives before the queued command.
		if _, e := entry.manager.Reconcile(&Snapshot{NodeDBID: fresh.NodeID, AgentID: entry.owner, Links: []Config{fresh}}); e != nil {
			t.Fatal(e)
		}
		p := entry.manager.running[fresh.ID]
		rule := p.rules[101]
		before, e := os.ReadFile(filepath.Join(entry.manager.cache.dir, "state.enc.json"))
		if e != nil {
			t.Fatal(e)
		}
		for i := 0; i < 2; i++ {
			o, e := entry.manager.Apply(entry.config)
			if e != nil || o.LeaseExpiresAt != longLease || o.Generation != fresh.Generation || o.ObservedGeneration != fresh.Generation || !o.Ready {
				t.Fatalf("out-of-order duplicate did not retain newer lease: %+v %v", o, e)
			}
		}
		after, e := os.ReadFile(filepath.Join(entry.manager.cache.dir, "state.enc.json"))
		if e != nil || !bytes.Equal(before, after) || entry.manager.running[fresh.ID] != p || p.rules[101] != rule {
			t.Fatal("lease duplicate mutated durable state or restarted rule", e)
		}
		expired := cloneConfig(entry.config)
		expired.LeaseExpiresAt = time.Now().Add(-time.Second).UTC().Format(time.RFC3339Nano)
		if _, e := entry.manager.Apply(expired); !errors.Is(e, ErrLeaseExpired) {
			t.Fatal("expired queued lease accepted", e)
		}
		older := cloneConfig(entry.config)
		older.Generation = 0
		if _, e := entry.manager.Apply(older); e == nil {
			t.Fatal("invalid generation accepted through duplicate path")
		}
		conflict := cloneConfig(entry.config)
		conflict.RuntimeIDs = []string{"different-same-generation"}
		if _, e := entry.manager.Apply(conflict); !errors.Is(e, ErrGenerationConflict) {
			t.Fatal("same-generation content conflict accepted", e)
		}
	}
	exchange(t, held, "after lease reorder")
	if _, e := mi.Remove(in.ID, 2); e != nil {
		t.Fatal(e)
	}
	if _, e := mi.Apply(in); !errors.Is(e, ErrStaleGeneration) {
		t.Fatal("removed placement resurrected by reordered lease", e)
	}
}

func TestActualTLSAcceptPathEnforcesHandshakeBudget(t *testing.T) {
	a, b := identities(t)
	carrier := freePort(t)
	out := configFor(t, "egress", b, carrier, nil)
	m := testManager(t, t.TempDir(), "out")
	if _, e := m.Apply(out); e != nil {
		t.Fatal(e)
	}
	p := m.running[out.ID]
	// Hold the exhausted budget at a controlled clock value so a busy host
	// cannot refill it during this actual network admission assertion.
	p.handshakeBudget.mu.Lock()
	p.handshakeBudget.tokens = 0
	p.handshakeBudget.last = time.Now().Add(time.Hour)
	p.handshakeBudget.mu.Unlock()
	cfg, e := securelink.TLSConfig(a)
	if e != nil {
		t.Fatal(e)
	}
	dialer := tls.Dialer{NetDialer: &net.Dialer{Timeout: time.Second}, Config: cfg}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if c, e := dialer.DialContext(ctx, "tcp", fmt.Sprintf("127.0.0.1:%d", carrier)); e == nil {
		c.Close()
		t.Fatal("valid certificate bypassed exhausted pre-TLS budget")
	}
	p.handshakeBudget.mu.Lock()
	p.handshakeBudget.tokens = handshakeBurst
	p.handshakeBudget.last = time.Now()
	p.handshakeBudget.mu.Unlock()
	c, e := dialer.DialContext(ctx, "tcp", fmt.Sprintf("127.0.0.1:%d", carrier))
	if e != nil {
		t.Fatal("handshake admission did not recover", e)
	}
	c.Close()
}

func TestUDPBidirectionalActivityAndIdleCleanup(t *testing.T) {
	for _, direction := range []string{"requests_only", "responses_only"} {
		t.Run(direction, func(t *testing.T) {
			a, b := identities(t)
			target, e := net.ListenUDP("udp", &net.UDPAddr{IP: net.ParseIP("127.0.0.1")})
			if e != nil {
				t.Fatal(e)
			}
			defer target.Close()
			carrier, listen := freePort(t), freePort(t)
			in := configFor(t, "ingress", a, carrier, []Binding{{ForwardID: 101, Revision: 1, Protocol: "udp", ListenHost: "127.0.0.1", ListenPort: listen}})
			out := configFor(t, "egress", b, carrier, []Binding{{ForwardID: 101, Revision: 1, Protocol: "udp", TargetHost: "127.0.0.1", TargetPort: target.LocalAddr().(*net.UDPAddr).Port}})
			makeManager := func(id string) *Manager {
				m, e := newManager(t.TempDir(), id, time.Second)
				if e != nil {
					t.Fatal(e)
				}
				if e = m.EnableTraffic(); e != nil {
					t.Fatal(e)
				}
				t.Cleanup(func() { m.Close() })
				return m
			}
			mi, me := makeManager("in"), makeManager("out")
			if _, e = me.Apply(out); e != nil {
				t.Fatal(e)
			}
			if _, e = mi.Apply(in); e != nil {
				t.Fatal(e)
			}
			client, e := net.DialUDP("udp", nil, &net.UDPAddr{IP: net.ParseIP("127.0.0.1"), Port: listen})
			if e != nil {
				t.Fatal(e)
			}
			defer client.Close()
			buf := make([]byte, 16)
			client.Write([]byte("start"))
			target.SetReadDeadline(time.Now().Add(3 * time.Second))
			_, peer, e := target.ReadFromUDP(buf)
			if e != nil {
				t.Fatal(e)
			}
			ri, re := mi.running[in.ID].rules[101], me.running[out.ID].rules[101]
			key := client.LocalAddr().String()
			ri.mu.Lock()
			original := ri.associations[key].stream
			ri.mu.Unlock()
			ticker := time.NewTicker(200 * time.Millisecond)
			defer ticker.Stop()
			for i := 0; i < 7; i++ {
				<-ticker.C
				if direction == "requests_only" {
					client.Write([]byte("request"))
					target.SetReadDeadline(time.Now().Add(time.Second))
					_, observed, e := target.ReadFromUDP(buf)
					if e != nil || observed.String() != peer.String() {
						t.Fatal("active request association replaced", observed, e)
					}
				} else {
					target.WriteToUDP([]byte("response"), peer)
					client.SetReadDeadline(time.Now().Add(time.Second))
					if _, e := client.Read(buf); e != nil {
						t.Fatal("active response association expired", e)
					}
				}
				ri.mu.Lock()
				current := ri.associations[key]
				unchanged := current != nil && current.stream == original
				ri.mu.Unlock()
				if !unchanged {
					t.Fatal("one-way activity did not preserve association")
				}
			}
			deadline := time.After(3 * time.Second)
			for {
				ri.mu.Lock()
				cleanIn := len(ri.associations) == 0 && ri.active == 0
				ri.mu.Unlock()
				re.mu.Lock()
				cleanOut := re.active == 0 && len(re.conns) == 0
				re.mu.Unlock()
				if cleanIn && cleanOut {
					break
				}
				select {
				case <-ticker.C:
				case <-deadline:
					t.Fatal("idle association retained streams or quota")
				}
			}
			client.Write([]byte("reopen"))
			target.SetReadDeadline(time.Now().Add(2 * time.Second))
			if _, _, e := target.ReadFromUDP(buf); e != nil {
				t.Fatal("quota did not recover after idle cleanup", e)
			}
			ri.mu.Lock()
			current := ri.associations[key]
			reopened := current != nil && current.stream != original
			ri.mu.Unlock()
			if !reopened {
				t.Fatal("expired association did not reopen")
			}
		})
	}
}
func TestHotReloadPreservesSiblingTCPAndUDP(t *testing.T) {
	a, b := identities(t)
	targetTCP, targetUDP := echoTargets(t)
	carrier, pa, pb := freePort(t), freePort(t), freePort(t)
	in := configFor(t, "ingress", a, carrier, []Binding{{ForwardID: 101, Revision: 1, Protocol: "tcp", ListenHost: "127.0.0.1", ListenPort: pa}, {ForwardID: 102, Revision: 1, Protocol: "tcp", ListenHost: "127.0.0.1", ListenPort: pb}, {ForwardID: 103, Revision: 1, Protocol: "udp", ListenHost: "127.0.0.1", ListenPort: pb}})
	out := configFor(t, "egress", b, carrier, []Binding{{ForwardID: 101, Revision: 1, Protocol: "tcp", TargetHost: "127.0.0.1", TargetPort: targetTCP}, {ForwardID: 102, Revision: 1, Protocol: "tcp", TargetHost: "127.0.0.1", TargetPort: targetTCP}, {ForwardID: 103, Revision: 1, Protocol: "udp", TargetHost: "127.0.0.1", TargetPort: targetUDP}})
	mi, me := testManager(t, t.TempDir(), "in"), testManager(t, t.TempDir(), "out")
	if _, e := me.Apply(out); e != nil {
		t.Fatal(e)
	}
	if _, e := mi.Apply(in); e != nil {
		t.Fatal(e)
	}
	tcp, e := net.Dial("tcp", fmt.Sprintf("127.0.0.1:%d", pb))
	if e != nil {
		t.Fatal(e)
	}
	defer tcp.Close()
	udp, e := net.Dial("udp", fmt.Sprintf("127.0.0.1:%d", pb))
	if e != nil {
		t.Fatal(e)
	}
	defer udp.Close()
	exchange(t, tcp, "before tcp")
	exchange(t, udp, "before udp")
	out = revise(t, out, func(c *TransportConfig) { c.Bindings[0].Revision++; c.Bindings[0].MaxConnections = 5 })
	in = revise(t, in, func(c *TransportConfig) { c.Bindings[0].Revision++; c.Bindings[0].MaxConnections = 5 })
	if o, e := me.Apply(out); e != nil || o.UpdateMode != "rules" {
		t.Fatalf("%v %v", o, e)
	}
	if o, e := mi.Apply(in); e != nil || o.UpdateMode != "rules" {
		t.Fatalf("%v %v", o, e)
	}
	exchange(t, tcp, "after tcp")
	exchange(t, udp, "after udp")
	in = revise(t, in, func(c *TransportConfig) { c.Bindings = c.Bindings[1:] })
	in.Ports = in.Ports[1:]
	if _, e := mi.Apply(in); e != nil {
		t.Fatal(e)
	}
	exchange(t, tcp, "after delete tcp")
	exchange(t, udp, "after delete udp")
}
func TestLeasesFencesCacheAndDurableAccounting(t *testing.T) {
	a, _ := identities(t)
	dir := t.TempDir()
	m := testManager(t, dir, "owner")
	c := configFor(t, "ingress", a, freePort(t), []Binding{})
	if _, e := m.Reconcile(&Snapshot{NodeDBID: 7, AgentID: "owner", Links: []Config{c}}); e != nil {
		t.Fatal(e)
	}
	sample := TrafficSample{ProducerID: producerID(), LinkID: 91, WorkspaceID: 5, NodeID: 7, ForwardID: 101, Generation: 1, ConfigDigest: c.ConfigDigest}
	if e := m.account(sample, 123, 456, 1); e != nil {
		t.Fatal(e)
	}
	saved, e := m.TrafficSamples()
	if e != nil || len(saved) != 1 {
		t.Fatal(e, saved)
	}
	if _, e = m.Remove(c.ID, 2); e != nil {
		t.Fatal(e)
	}
	m.Close()
	data, e := os.ReadFile(filepath.Join(dir, "state.enc.json"))
	if e != nil || bytes.Contains(data, []byte("PRIVATE KEY")) || bytes.Contains(data, []byte("transport_config")) {
		t.Fatal("plaintext private state", e)
	}
	reopened := testManager(t, dir, "owner")
	if _, e := reopened.Restore(); e != nil {
		t.Fatal(e)
	}
	if _, e := reopened.Apply(c); !errors.Is(e, ErrStaleGeneration) {
		t.Fatal("removed config resurrected", e)
	}
	restored, _ := reopened.TrafficSamples()
	if !reflect.DeepEqual(saved, restored) {
		t.Fatal(saved, restored)
	}
	bad := saved[0]
	bad.BytesIn = "124"
	if e := reopened.AckTraffic([]TrafficSample{bad}); !errors.Is(e, ErrTrafficAck) {
		t.Fatal(e)
	}
	if e := reopened.AckTraffic(saved); e != nil {
		t.Fatal(e)
	}
	pending, _ := reopened.TrafficSamples()
	if len(pending) != 0 {
		t.Fatal(pending)
	}
	if _, e := New(dir, "foreign"); !errors.Is(e, ErrCache) {
		t.Fatal(e)
	}
	c.Generation = 3
	c.LeaseExpiresAt = time.Now().Add(200 * time.Millisecond).UTC().Format(time.RFC3339Nano)
	if _, e := reopened.Apply(c); e != nil {
		t.Fatal(e)
	}
	time.Sleep(400 * time.Millisecond)
	if reopened.Status()[0].State != "expired" {
		t.Fatal(reopened.Status())
	}
	reopened.Close()
	if _, e := New(dir, "foreign"); !errors.Is(e, ErrAgentMismatch) {
		t.Fatal(e)
	}
	third := testManager(t, dir, "owner")
	third.Restore()
	if third.Status()[0].Ready {
		t.Fatal("expired config restored")
	}
	if _, e := third.Apply(c); !errors.Is(e, ErrLeaseExpired) {
		t.Fatal(e)
	}
}
func TestNativePortGuardAndUnauthorizedRule(t *testing.T) {
	a, b := identities(t)
	tcp, _ := echoTargets(t)
	carrier, listen := freePort(t), freePort(t)
	in := configFor(t, "ingress", a, carrier, []Binding{{ForwardID: 101, Revision: 1, Protocol: "tcp", ListenHost: "127.0.0.1", ListenPort: listen}})
	out := configFor(t, "egress", b, carrier, []Binding{{ForwardID: 101, Revision: 2, Protocol: "tcp", TargetHost: "127.0.0.1", TargetPort: tcp}})
	native := manager.NewTunnelManager(manager.NewEgressManager(), "127.0.0.1")
	defer native.StopAll()
	if _, e := native.Apply(forwarder.TunnelConfig{ID: "native", Mode: "RELAY", ListenHost: "127.0.0.1", IngressPort: listen, NextHop: fmt.Sprintf("127.0.0.1:%d", tcp)}); e != nil {
		t.Fatal(e)
	}
	mi, me := testManager(t, t.TempDir(), "in"), testManager(t, t.TempDir(), "out")
	mi.SetPortGuard(native)
	if _, e := mi.Apply(in); !errors.Is(e, ErrPortConflict) {
		t.Fatal(e)
	}
	native.Remove("native")
	if _, e := me.Apply(out); e != nil {
		t.Fatal(e)
	}
	in.Generation++
	if _, e := mi.Apply(in); e != nil {
		t.Fatal(e)
	}
	c, e := net.Dial("tcp", fmt.Sprintf("127.0.0.1:%d", listen))
	if e != nil {
		t.Fatal(e)
	}
	defer c.Close()
	c.SetDeadline(time.Now().Add(3 * time.Second))
	c.Write([]byte("unauthorized"))
	buf := make([]byte, 1)
	if n, e := c.Read(buf); n != 0 || e == nil {
		t.Fatal("unauthorized stream succeeded", n, e)
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	session, e := mi.running[in.ID].getSession(ctx)
	if e != nil {
		t.Fatal(e)
	}
	if _, e := session.Open(ctx, securelink.OpenRequest{ForwardID: 999, Revision: 1, Protocol: "tcp"}); e == nil {
		t.Fatal("unknown rule accepted")
	}
	if _, e := native.Apply(forwarder.TunnelConfig{ID: "native2", Mode: "RELAY", ListenHost: "127.0.0.1", IngressPort: listen, NextHop: fmt.Sprintf("127.0.0.1:%d", tcp)}); e == nil {
		t.Fatal("native stole TST port")
	}
	mi.Remove(in.ID, 3)
	if _, e := native.Apply(forwarder.TunnelConfig{ID: "native2", Mode: "RELAY", ListenHost: "127.0.0.1", IngressPort: listen, NextHop: fmt.Sprintf("127.0.0.1:%d", tcp)}); e != nil {
		t.Fatal("port not released", e)
	}
}

func TestRealQoSCeilingAndConnectionQuota(t *testing.T) {
	a, b := identities(t)
	target, _ := echoTargets(t)
	carrier, listen := freePort(t), freePort(t)
	in := configFor(t, "ingress", a, carrier, []Binding{{ForwardID: 101, Revision: 1, Protocol: "tcp", ListenHost: "127.0.0.1", ListenPort: listen, BytesPerSecondIn: 1000, BytesPerSecondOut: 1000, MaxConnections: 1, MaxConnectionsPerIP: 1}})
	out := configFor(t, "egress", b, carrier, []Binding{{ForwardID: 101, Revision: 1, Protocol: "tcp", TargetHost: "127.0.0.1", TargetPort: target}})
	mi, me := testManager(t, t.TempDir(), "in"), testManager(t, t.TempDir(), "out")
	if _, e := me.Apply(out); e != nil {
		t.Fatal(e)
	}
	if _, e := mi.Apply(in); e != nil {
		t.Fatal(e)
	}
	c, e := net.Dial("tcp", fmt.Sprintf("127.0.0.1:%d", listen))
	if e != nil {
		t.Fatal(e)
	}
	defer c.Close()
	payload := string(bytes.Repeat([]byte("q"), 300))
	start := time.Now()
	exchange(t, c, payload)
	if elapsed := time.Since(start); elapsed < 550*time.Millisecond {
		t.Fatalf("directional rate ceiling bypassed: %v", elapsed)
	}
	other, e := net.Dial("tcp", fmt.Sprintf("127.0.0.1:%d", listen))
	if e != nil {
		t.Fatal(e)
	}
	defer other.Close()
	other.SetDeadline(time.Now().Add(time.Second))
	other.Write([]byte("no admission"))
	if n, e := other.Read(make([]byte, 20)); n > 0 || e == nil {
		t.Fatal("connection quota bypassed")
	}
	samples, _ := mi.TrafficSamples()
	if len(samples) != 1 || samples[0].Connections != "1" || samples[0].BytesIn != "300" || samples[0].BytesOut != "300" {
		t.Fatal(samples)
	}
}

func TestLeaseStopsActualSocketsAndReleasesPort(t *testing.T) {
	a, _ := identities(t)
	listen := freePort(t)
	c := configFor(t, "ingress", a, freePort(t), []Binding{{ForwardID: 101, Revision: 1, Protocol: "both", ListenHost: "127.0.0.1", ListenPort: listen}})
	c.LeaseExpiresAt = time.Now().Add(200 * time.Millisecond).UTC().Format(time.RFC3339Nano)
	m := testManager(t, t.TempDir(), "owner")
	if _, e := m.Apply(c); e != nil {
		t.Fatal(e)
	}
	deadline := time.Now().Add(3 * time.Second)
	for m.Status()[0].State != "expired" && time.Now().Before(deadline) {
		time.Sleep(20 * time.Millisecond)
	}
	if m.Status()[0].State != "expired" {
		t.Fatal(m.Status())
	}
	tcp, e := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", listen))
	if e != nil {
		t.Fatal("expired TCP listener retained", e)
	}
	tcp.Close()
	udp, e := net.ListenUDP("udp", &net.UDPAddr{IP: net.ParseIP("127.0.0.1"), Port: listen})
	if e != nil {
		t.Fatal("expired UDP listener retained", e)
	}
	udp.Close()
}

func TestFailedHigherGenerationKeepsSiblingAndNeverRestoresOlderConfig(t *testing.T) {
	a, b := identities(t)
	target, _ := echoTargets(t)
	carrier, listen := freePort(t), freePort(t)
	in := configFor(t, "ingress", a, carrier, []Binding{{ForwardID: 101, Revision: 1, Protocol: "tcp", ListenHost: "127.0.0.1", ListenPort: listen}})
	out := configFor(t, "egress", b, carrier, []Binding{{ForwardID: 101, Revision: 1, Protocol: "tcp", TargetHost: "127.0.0.1", TargetPort: target}})
	dir := t.TempDir()
	mi, me := testManager(t, dir, "in"), testManager(t, t.TempDir(), "out")
	if _, e := me.Apply(out); e != nil {
		t.Fatal(e)
	}
	if _, e := mi.Apply(in); e != nil {
		t.Fatal(e)
	}
	held, e := net.Dial("tcp", fmt.Sprintf("127.0.0.1:%d", listen))
	if e != nil {
		t.Fatal(e)
	}
	defer held.Close()
	exchange(t, held, "before candidate")
	occupied, e := net.Listen("tcp", "127.0.0.1:0")
	if e != nil {
		t.Fatal(e)
	}
	defer occupied.Close()
	port := occupied.Addr().(*net.TCPAddr).Port
	bad := revise(t, in, func(c *TransportConfig) {
		c.Bindings = append(c.Bindings, Binding{ForwardID: 102, Revision: 1, Protocol: "tcp", ListenHost: "127.0.0.1", ListenPort: port})
	})
	bad.Ports = append(bad.Ports, Port{"tcp", "127.0.0.1", port})
	if o, e := mi.Apply(bad); !errors.Is(e, ErrStartFailed) || o.Generation != 2 || o.ObservedGeneration != 1 || o.State != "rolled_back" {
		t.Fatalf("fence/rollback %v %v", o, e)
	}
	shortFailed := cloneConfig(bad)
	shortFailed.LeaseExpiresAt = time.Now().Add(20 * time.Second).UTC().Format(time.RFC3339Nano)
	if _, e := mi.Apply(shortFailed); !errors.Is(e, ErrLeaseRegression) {
		t.Fatal("failed generation acknowledged as applied via lease duplicate", e)
	}
	if _, e := mi.Apply(in); !errors.Is(e, ErrStaleGeneration) {
		t.Fatal("lower generation accepted after failed newer apply", e)
	}
	exchange(t, held, "after rejected candidate")
	mi.Close()
	restarted := testManager(t, dir, "in")
	if _, e := restarted.Restore(); e != nil {
		t.Fatal(e)
	}
	if restarted.Status()[0].Ready || restarted.Status()[0].ObservedGeneration != 0 {
		t.Fatal("old generation restored behind newer fence")
	}
	if _, e := restarted.Apply(in); !errors.Is(e, ErrStaleGeneration) {
		t.Fatal(e)
	}
	listener, e := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", listen))
	if e != nil {
		t.Fatal("old listener resurrected", e)
	}
	listener.Close()
}

func TestRepeatedFailedApplyRestoresPortGuardAndStopsCandidates(t *testing.T) {
	a, _ := identities(t)
	listen := freePort(t)
	in := configFor(t, "ingress", a, freePort(t), []Binding{{
		ForwardID: 101, Revision: 1, Protocol: "tcp", ListenHost: "127.0.0.1", ListenPort: listen,
	}})
	m := testManager(t, t.TempDir(), "owner")
	guard := &recordingPortGuard{owners: map[string][]portlease.Binding{}}
	if err := m.SetPortGuard(guard); err != nil {
		t.Fatal(err)
	}
	if _, err := m.Apply(in); err != nil {
		t.Fatal(err)
	}
	owner := "tst:" + in.ID
	want := []portlease.Binding{portlease.New("tcp", listen, "127.0.0.1")}
	if got := guard.bindings(owner); !reflect.DeepEqual(got, want) {
		t.Fatalf("initial guard bindings = %+v, want %+v", got, want)
	}

	for generation := int64(2); generation < 10; generation++ {
		occupied, err := net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			t.Fatal(err)
		}
		candidate := cloneConfig(in)
		candidate.Generation = generation
		candidate.TransportConfig = append(json.RawMessage(nil), in.TransportConfig...)
		var transport TransportConfig
		if err := json.Unmarshal(candidate.TransportConfig, &transport); err != nil {
			occupied.Close()
			t.Fatal(err)
		}
		transport.Bindings = append(transport.Bindings, Binding{
			ForwardID: 1000 + generation, Revision: 1, Protocol: "tcp",
			ListenHost: "127.0.0.1", ListenPort: occupied.Addr().(*net.TCPAddr).Port,
		})
		candidate.TransportConfig, _ = json.Marshal(transport)
		candidate.ConfigDigest, err = Digest(candidate.TransportConfig)
		if err != nil {
			occupied.Close()
			t.Fatal(err)
		}
		candidate.Ports = append(append([]Port(nil), in.Ports...), Port{"tcp", "127.0.0.1", occupied.Addr().(*net.TCPAddr).Port})

		if _, err := m.Apply(candidate); !errors.Is(err, ErrStartFailed) {
			occupied.Close()
			t.Fatalf("generation %d apply error = %v, want ErrStartFailed", generation, err)
		}
		if got := guard.bindings(owner); !reflect.DeepEqual(got, want) {
			occupied.Close()
			t.Fatalf("generation %d leaked guard bindings = %+v, want %+v", generation, got, want)
		}
		occupied.Close()
		if observation := m.Status()[0]; observation.ObservedGeneration != 1 || observation.State != "rolled_back" {
			t.Fatalf("generation %d observation = %+v, want old runtime with durable fence", generation, observation)
		}
	}

	if _, err := m.Remove(in.ID, 10); err != nil {
		t.Fatal(err)
	}
	if got := guard.bindings(owner); len(got) != 0 {
		t.Fatalf("guard bindings after removal = %+v, want empty", got)
	}
	listener, err := net.Listen("tcp", net.JoinHostPort("127.0.0.1", strconv.Itoa(listen)))
	if err != nil {
		t.Fatalf("listener port remained occupied after cleanup: %v", err)
	}
	listener.Close()
}

func TestHalfCloseReturnsTargetResponseAndCarrierReconnects(t *testing.T) {
	a, b := identities(t)
	target, e := net.Listen("tcp", "127.0.0.1:0")
	if e != nil {
		t.Fatal(e)
	}
	defer target.Close()
	go func() {
		for {
			c, e := target.Accept()
			if e != nil {
				return
			}
			go func() {
				defer c.Close()
				request, e := io.ReadAll(c)
				if e == nil {
					c.Write(append([]byte("reply:"), request...))
				}
			}()
		}
	}()
	carrier, listen := freePort(t), freePort(t)
	in := configFor(t, "ingress", a, carrier, []Binding{{ForwardID: 101, Revision: 1, Protocol: "tcp", ListenHost: "127.0.0.1", ListenPort: listen}})
	out := configFor(t, "egress", b, carrier, []Binding{{ForwardID: 101, Revision: 1, Protocol: "tcp", TargetHost: "127.0.0.1", TargetPort: target.Addr().(*net.TCPAddr).Port}})
	mi, me := testManager(t, t.TempDir(), "in"), testManager(t, t.TempDir(), "out")
	if _, e := me.Apply(out); e != nil {
		t.Fatal(e)
	}
	if _, e := mi.Apply(in); e != nil {
		t.Fatal(e)
	}
	attempt := func() {
		c, e := net.Dial("tcp", fmt.Sprintf("127.0.0.1:%d", listen))
		if e != nil {
			t.Fatal(e)
		}
		defer c.Close()
		c.SetDeadline(time.Now().Add(4 * time.Second))
		c.Write([]byte("request"))
		c.(*net.TCPConn).CloseWrite()
		response, e := io.ReadAll(c)
		if e != nil || string(response) != "reply:request" {
			t.Fatal(string(response), e)
		}
	}
	attempt()
	mi.mu.Lock()
	p := mi.running[in.ID]
	mi.mu.Unlock()
	p.mu.Lock()
	for s := range p.sessions {
		s.Close()
	}
	p.mu.Unlock()
	attempt()
}

func TestPrivateCacheTamperAndSingleOwnerFailClosed(t *testing.T) {
	a, _ := identities(t)
	dir := t.TempDir()
	m := testManager(t, dir, "owner")
	if _, e := New(dir, "owner"); !errors.Is(e, ErrCache) {
		t.Fatal("cache double owner admitted", e)
	}
	c := configFor(t, "ingress", a, freePort(t), []Binding{})
	if _, e := m.Apply(c); e != nil {
		t.Fatal(e)
	}
	m.Close()
	path := filepath.Join(dir, "state.enc.json")
	b, e := os.ReadFile(path)
	if e != nil {
		t.Fatal(e)
	}
	var env envelope
	if e = json.Unmarshal(b, &env); e != nil {
		t.Fatal(e)
	}
	env.Sealed[len(env.Sealed)/2] ^= 1
	b, _ = json.Marshal(env)
	if e = os.WriteFile(path, b, 0600); e != nil {
		t.Fatal(e)
	}
	if _, e := New(dir, "owner"); !errors.Is(e, ErrCache) {
		t.Fatal("unauthenticated cache accepted", e)
	}
}

func TestLocalCertificateExpiresIndependentOfLeaseAndCacheCanRecover(t *testing.T) {
	expiry := time.Now().Add(2 * time.Second).Truncate(time.Second)
	a, _ := identitiesExpiring(t, expiry, time.Now().Add(time.Hour))
	dir := t.TempDir()
	m := testManager(t, dir, "owner")
	c := configFor(t, "ingress", a, freePort(t), []Binding{})
	if _, e := m.Apply(c); e != nil {
		t.Fatal(e)
	}
	deadline := expiry.Add(time.Second)
	for m.Status()[0].State != "expired" && time.Now().Before(deadline) {
		time.Sleep(20 * time.Millisecond)
	}
	if o := m.Status()[0]; o.State != "expired" || o.LastError != ErrIdentityExpired.Error() {
		t.Fatal(o)
	}
	m.Close()
	reopened := testManager(t, dir, "owner")
	fresh, _ := identities(t)
	replacement := configFor(t, "ingress", fresh, freePort(t), []Binding{})
	replacement.Generation = 2
	if _, e := reopened.Apply(replacement); e != nil {
		t.Fatal("expired certificate cache blocked new authority", e)
	}
}

func TestPeerCertificateExpiryClosesSessionWithoutRemoteShutdown(t *testing.T) {
	expiry := time.Now().Add(2 * time.Second).Truncate(time.Second)
	a, b := identitiesExpiring(t, time.Now().Add(time.Hour), expiry)
	tlsConfig, e := securelink.TLSConfig(b)
	if e != nil {
		t.Fatal(e)
	}
	listener, e := net.Listen("tcp", "127.0.0.1:0")
	if e != nil {
		t.Fatal(e)
	}
	defer listener.Close()
	remoteReady := make(chan *securelink.Session, 1)
	go func() {
		conn, e := listener.Accept()
		if e != nil {
			return
		}
		c := tls.Server(conn, tlsConfig)
		if c.HandshakeContext(context.Background()) != nil {
			conn.Close()
			return
		}
		s := securelink.NewSession(c, true)
		remoteReady <- s
		for {
			st, e := s.Accept(context.Background())
			if e != nil {
				return
			}
			st.Accept()
			go func() { defer st.Close(); io.Copy(st, st) }()
		}
	}()
	carrier := listener.Addr().(*net.TCPAddr).Port
	listen := freePort(t)
	c := configFor(t, "ingress", a, carrier, []Binding{{ForwardID: 101, Revision: 1, Protocol: "tcp", ListenHost: "127.0.0.1", ListenPort: listen}})
	m := testManager(t, t.TempDir(), "owner")
	if _, e := m.Apply(c); e != nil {
		t.Fatal(e)
	}
	client, e := net.Dial("tcp", fmt.Sprintf("127.0.0.1:%d", listen))
	if e != nil {
		t.Fatal(e)
	}
	defer client.Close()
	exchange(t, client, "authenticated before expiry")
	remote := <-remoteReady
	defer remote.Close()
	select {
	case <-remote.Done():
	case <-time.After(time.Until(expiry) + time.Second):
		t.Fatal("peer certificate expired while session remained authenticated")
	}
	if m.running[c.ID].ctx.Err() != nil {
		t.Fatal("local certificate unexpectedly expired")
	}
	client.SetReadDeadline(time.Now().Add(time.Second))
	if n, e := client.Read(make([]byte, 20)); n != 0 || e == nil {
		t.Fatal("held flow survived peer certificate expiry")
	}
	if m.Status()[0].Ready {
		t.Fatal("expired peer reported ready")
	}
}

func BenchmarkTSTLoopbackTCP(b *testing.B) {
	ingress, egress := identities(b)
	target, _ := echoTargets(b)
	carrier, listen := freePort(b), freePort(b)
	in := configFor(b, "ingress", ingress, carrier, []Binding{{ForwardID: 101, Revision: 1, Protocol: "tcp", ListenHost: "127.0.0.1", ListenPort: listen}})
	out := configFor(b, "egress", egress, carrier, []Binding{{ForwardID: 101, Revision: 1, Protocol: "tcp", TargetHost: "127.0.0.1", TargetPort: target}})
	mi, me := testManager(b, b.TempDir(), "in"), testManager(b, b.TempDir(), "out")
	if _, e := me.Apply(out); e != nil {
		b.Fatal(e)
	}
	if _, e := mi.Apply(in); e != nil {
		b.Fatal(e)
	}
	conn, e := net.Dial("tcp", fmt.Sprintf("127.0.0.1:%d", listen))
	if e != nil {
		b.Fatal(e)
	}
	defer conn.Close()
	payload := bytes.Repeat([]byte("x"), 64<<10)
	response := make([]byte, len(payload))
	b.SetBytes(int64(len(payload) * 2))
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		conn.SetDeadline(time.Now().Add(15 * time.Second))
		if _, e := conn.Write(payload); e != nil {
			b.Fatal(e)
		}
		if _, e := io.ReadFull(conn, response); e != nil {
			b.Fatal(e)
		}
	}
	b.StopTimer()
	if !bytes.Equal(payload, response) {
		b.Fatal("payload mismatch")
	}
}

func TestClosedOwnerCannotOverwriteReopenedCache(t *testing.T) {
	a, _ := identities(t)
	dir := t.TempDir()
	old := testManager(t, dir, "owner")
	c := configFor(t, "ingress", a, freePort(t), []Binding{})
	if _, e := old.Apply(c); e != nil {
		t.Fatal(e)
	}
	old.Close()
	current := testManager(t, dir, "owner")
	if _, e := current.Remove(c.ID, 2); e != nil {
		t.Fatal(e)
	}
	sample := TrafficSample{ProducerID: producerID(), LinkID: 91, WorkspaceID: 5, NodeID: 7, ForwardID: 101, Generation: 1, ConfigDigest: c.ConfigDigest}
	if e := old.account(sample, 1, 1, 1); !errors.Is(e, ErrClosed) {
		t.Fatal("closed owner wrote accounting", e)
	}
	if e := old.AckTraffic(nil); !errors.Is(e, ErrClosed) {
		t.Fatal("closed owner wrote ACK", e)
	}
	current.Close()
	third := testManager(t, dir, "owner")
	if _, e := third.Apply(c); !errors.Is(e, ErrStaleGeneration) {
		t.Fatal("closed owner erased new fence", e)
	}
}

func TestDiagnosisUsesOnlyLiveEgressAuthorizationAndDoesNotBill(t *testing.T) {
	_, identity := identities(t)
	tcp, _ := echoTargets(t)
	out := configFor(t, "egress", identity, freePort(t), []Binding{{ForwardID: 101, Revision: 9, Protocol: "tcp", TargetHost: "127.0.0.1", TargetPort: tcp}, {ForwardID: 102, Revision: 4, Protocol: "udp", TargetHost: "127.0.0.1", TargetPort: tcp}})
	m := testManager(t, t.TempDir(), "out")
	if _, e := m.Apply(out); e != nil {
		t.Fatal(e)
	}
	probe := ProbeRequest{ForwardID: 101, Revision: 9, TimeoutMS: 1000}
	results, e := m.Diagnose(context.Background(), out.ID, 1, probe)
	if e != nil || len(results) != 1 || results[0].Status != "reachable" || results[0].Host != "127.0.0.1" || results[0].Port != tcp {
		t.Fatal(results, e)
	}
	for _, req := range []ProbeRequest{{ForwardID: 999, Revision: 9}, {ForwardID: 101, Revision: 8}} {
		if _, e := m.Diagnose(context.Background(), out.ID, 1, req); e == nil {
			t.Fatal("unauthorized target probe accepted", req)
		}
	}
	if _, e := m.Diagnose(context.Background(), out.ID, 2, probe); !errors.Is(e, ErrStaleGeneration) {
		t.Fatal(e)
	}
	unsupported, e := m.Diagnose(context.Background(), out.ID, 1, ProbeRequest{ForwardID: 102, Revision: 4})
	if e != nil || unsupported[0].Status != "unsupported" {
		t.Fatal(unsupported, e)
	}
	samples, _ := m.TrafficSamples()
	if len(samples) != 0 {
		t.Fatal("diagnostics entered business accounting", samples)
	}
	m.Remove(out.ID, 2)
	if _, e := m.Diagnose(context.Background(), out.ID, 1, probe); e == nil {
		t.Fatal("removed target authorization used")
	}
}
