package relay

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io"
	"net"
	"sync/atomic"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/contracts"
)

func multihopChain(t *testing.T, count int, protocol string, target uint64, allow func() error) []*Engine {
	t.Helper()
	ca := createCA(t)
	certs := make([]tls.Certificate, count)
	path := make([]adp3.HopNode, count)
	for i := range count {
		id := fmt.Sprintf("hop-%d", i)
		certs[i] = ca.issue(t, id, []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth}, false)
		physical := "tcp"
		if i == 0 {
			physical = protocol
		}
		path[i] = adp3.HopNode{NodeId: id, AssignmentId: "assignment-" + id, SessionEpoch: uint64(i + 1), BindingFence: uint64(i + 2), PeerFingerprint: Fingerprint(certs[i].Leaf), ListenAddress: "127.0.0.1", Host: "127.0.0.1", Port: freePort(t, physical)}
	}
	profile := adp3.ProfileConfig{Driver: "native.relay.v1", WireVersion: 1, Security: "mutual-tls13", Protocols: []string{"tcp", "udp"}, HandshakeTimeoutSeconds: 5, IdleTimeoutSeconds: 2, MaxFrameBytes: 65536, MaxUdpDatagramBytes: 16384, MaxConnectionsPerNode: 128}
	hash, err := contracts.ComputeDigest(profile)
	if err != nil {
		t.Fatal(err)
	}
	engines := make([]*Engine, count)
	for i := count - 1; i >= 0; i-- {
		h := adp3.HopConfig{ScopeId: "scope-a", ForwardId: "forward-a", ForwardRevision: 1, DeploymentGeneration: 1, ProfileId: "profile-a", ProfileRevision: 1, ProfileDigest: hash, Protocol: protocol, HopIndex: uint64(i), Path: path, Profile: profile, Target: adp3.Target{Host: "127.0.0.1", Port: target}, EgressPolicyRevision: 1, AllowedDestinationCidrs: []string{"127.0.0.0/8"}}
		h.PathDigest, err = adp3.HopPathDigest(h)
		if err != nil {
			t.Fatal(err)
		}
		config := adp3.RuntimeConfig{Hop: &h}
		configHash, err := contracts.ComputeDigest(config)
		if err != nil {
			t.Fatal(err)
		}
		role, physical := "multihop-transit", "tcp"
		if i == 0 {
			role = "multihop-ingress"
			physical = protocol
		} else if i == count-1 {
			role = "multihop-egress"
		}
		a := adp3.Assignment{AssignmentId: path[i].AssignmentId, ForwardId: "forward-a", ForwardRevision: 1, DeploymentGeneration: 1, BindingFence: path[i].BindingFence, Role: role, Protocol: protocol, Phase: "prepared", Resource: adp3.Resource{Address: "127.0.0.1", Port: path[i].Port, Protocol: physical}, Driver: adp3.Driver{Id: "native.multihop.v1", SchemaVersion: 1, ConfigDigest: configHash, Config: config}, DrainTimeoutSeconds: 1}
		engines[i], err = PrepareMultihop(a, Identity{certs[i], ca.roots}, 8, allow)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(engines[i].Close)
	}
	return engines
}
func activateChain(t *testing.T, engines []*Engine) {
	t.Helper()
	for i := len(engines) - 1; i >= 0; i-- {
		if err := engines[i].Activate(); err != nil {
			t.Fatal(err)
		}
	}
}

func TestMultihopTCPConsecutiveTransitHalfCloseRenewalAndCutoff(t *testing.T) {
	for _, count := range []int{3, 4, 8} {
		t.Run(fmt.Sprint(count), func(t *testing.T) {
			var revoked atomic.Bool
			allow := func() error {
				if revoked.Load() {
					return fmt.Errorf("LEASE_EXPIRED")
				}
				return nil
			}
			engines := multihopChain(t, count, "tcp", tcpTarget(t, "reply:", true), allow)
			if err := engines[0].Activate(); err == nil {
				t.Fatal("prepared downstream opened public ingress")
			}
			activateChain(t, engines)
			client, err := net.Dial("tcp", engines[0].listener.Addr().String())
			if err != nil {
				t.Fatal(err)
			}
			defer client.Close()
			client.SetDeadline(time.Now().Add(5 * time.Second))
			payload := bytes.Repeat([]byte("multi-hop-frame-"), 8192)
			if _, err = client.Write(payload); err != nil {
				t.Fatal(err)
			}
			for _, e := range engines {
				e.SetAuthorization(allow)
			}
			client.(*net.TCPConn).CloseWrite()
			reply, err := io.ReadAll(client)
			if err != nil || !bytes.Equal(reply, append([]byte("reply:"), payload...)) {
				t.Fatal("multi-hop half-close/renewal payload differs", err)
			}
			wait(t, func() bool {
				for _, e := range engines {
					if e.Remaining() != 0 {
						return false
					}
				}
				return true
			})
			held, err := net.Dial("tcp", engines[0].listener.Addr().String())
			if err != nil {
				t.Fatal(err)
			}
			defer held.Close()
			revoked.Store(true)
			held.SetReadDeadline(time.Now().Add(time.Second))
			var b [1]byte
			if _, err = held.Read(b[:]); err == nil {
				t.Fatal("revoked authority remained open")
			}
		})
	}
}
func TestMultihopUDPClientIsolationAndIntermediateFailure(t *testing.T) {
	for _, count := range []int{3, 4, 8} {
		t.Run(fmt.Sprint(count), func(t *testing.T) {
			target, err := net.ListenUDP("udp", &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1)})
			if err != nil {
				t.Fatal(err)
			}
			done := make(chan struct{})
			go func() {
				defer close(done)
				packet := make([]byte, 16384)
				for {
					n, addr, err := target.ReadFromUDP(packet)
					if err != nil {
						return
					}
					target.WriteToUDP(packet[:n], addr)
				}
			}()
			t.Cleanup(func() { target.Close(); <-done })
			engines := multihopChain(t, count, "udp", uint64(target.LocalAddr().(*net.UDPAddr).Port), func() error { return nil })
			activateChain(t, engines)
			for clientID := range 2 {
				client, err := net.DialUDP("udp", nil, engines[0].udp.LocalAddr().(*net.UDPAddr))
				if err != nil {
					t.Fatal(err)
				}
				defer client.Close()
				for sequence := range 3 {
					payload := []byte(fmt.Sprintf("client-%d/%d", clientID, sequence))
					if sequence == 0 {
						payload = nil
					}
					client.SetDeadline(time.Now().Add(5 * time.Second))
					client.Write(payload)
					reply := make([]byte, 16384)
					n, err := client.Read(reply)
					if err != nil || !bytes.Equal(reply[:n], payload) {
						t.Fatal("UDP client/datagram differs", err)
					}
				}
			}
			engines[1].Close()
			if err := engines[0].Activate(); err == nil {
				t.Fatal("lost intermediate still reports ready")
			}
		})
	}
}

func TestMultihopUDPRequestActivityPreservesAssociationBeforeDelayedReply(t *testing.T) {
	target, err := net.ListenUDP("udp", &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1)})
	if err != nil {
		t.Fatal(err)
	}
	var replaced atomic.Bool
	done := make(chan struct{})
	go func() {
		defer close(done)
		packet := make([]byte, 64)
		first := ""
		for count := 1; ; count++ {
			n, peer, err := target.ReadFromUDP(packet)
			if err != nil {
				return
			}
			if first == "" {
				first = peer.String()
			} else if peer.String() != first {
				replaced.Store(true)
			}
			if count == 12 {
				target.WriteToUDP(packet[:n], peer)
			}
		}
	}()
	t.Cleanup(func() { target.Close(); <-done })
	engines := multihopChain(t, 3, "udp", uint64(target.LocalAddr().(*net.UDPAddr).Port), func() error { return nil })
	activateChain(t, engines)
	client, err := net.DialUDP("udp", nil, engines[0].udp.LocalAddr().(*net.UDPAddr))
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	for sequence := range 12 {
		if _, err = client.Write([]byte(fmt.Sprintf("request-%d", sequence))); err != nil {
			t.Fatal(err)
		}
		if sequence < 11 {
			time.Sleep(250 * time.Millisecond)
		}
	}
	client.SetReadDeadline(time.Now().Add(5 * time.Second))
	var reply [64]byte
	n, err := client.Read(reply[:])
	if err != nil || string(reply[:n]) != "request-11" || replaced.Load() {
		t.Fatal("one-way activity lost or replaced the UDP association", err)
	}
}
