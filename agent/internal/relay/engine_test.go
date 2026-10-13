package relay

import (
	"bytes"
	"crypto/x509"
	"fmt"
	"github.com/tunex/vnext/agent/internal/adp3relay"
	"github.com/tunex/vnext/agent/internal/contracts"
	"io"
	"net"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func freePort(t *testing.T, protocol string) uint64 {
	t.Helper()
	if protocol == "udp" {
		s, err := net.ListenUDP("udp", &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1)})
		if err != nil {
			t.Fatal(err)
		}
		defer s.Close()
		return uint64(s.LocalAddr().(*net.UDPAddr).Port)
	}
	s, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	return uint64(s.Addr().(*net.TCPAddr).Port)
}
func makePair(t *testing.T, protocol string, targetPort uint64, maximum int, allow func() error) (*Engine, *Engine) {
	t.Helper()
	ca := createCA(t)
	usage := []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth}
	client := ca.issue(t, "node-a", usage, false)
	server := ca.issue(t, "node-b", usage, false)
	profile := adp3relay.ProfileConfig{Driver: "native.relay.v1", WireVersion: 1, Security: "mutual-tls13", Protocols: []string{"tcp", "udp"}, HandshakeTimeoutSeconds: 2, IdleTimeoutSeconds: 1, MaxFrameBytes: 65536, MaxUdpDatagramBytes: 16384, MaxConnectionsPerNode: 32}
	hash, err := contracts.ComputeDigest(profile)
	if err != nil {
		t.Fatal(err)
	}
	binding := adp3relay.Binding{ScopeId: "scope-a", ForwardId: "forward-a", ForwardRevision: 1, DeploymentGeneration: 1, IngressNodeId: "node-a", EgressNodeId: "node-b", IngressAssignmentId: "assignment-a", EgressAssignmentId: "assignment-b", IngressSessionEpoch: 2, EgressSessionEpoch: 3, IngressFence: 4, EgressFence: 5, ProfileId: "profile-a", ProfileRevision: 1, ProfileDigest: hash}
	peerPort := freePort(t, "tcp")
	clientPort := freePort(t, protocol)
	config := adp3relay.RelayConfig{Role: "relay-egress", Binding: binding, Profile: profile, PeerFingerprints: []string{Fingerprint(client.Leaf)}, Target: &adp3relay.Target{Host: "127.0.0.1", Port: targetPort}, EgressPolicyRevision: 1, AllowMetadataTargets: false, AllowedDestinationCidrs: []string{"127.0.0.0/8"}}
	hash, err = contracts.ComputeDigest(config)
	if err != nil {
		t.Fatal(err)
	}
	egressAssignment := adp3relay.Assignment{ProtocolVersion: 3, NodeId: "node-b", SessionEpoch: 3, AssignmentId: "assignment-b", ForwardId: "forward-a", ForwardRevision: 1, DeploymentGeneration: 1, BindingFence: 5, Role: "relay-egress", Protocol: protocol, Phase: "prepared", Resource: adp3relay.Resource{Address: "127.0.0.1", Port: peerPort, Protocol: "tcp"}, Driver: adp3relay.RelayDriver{Id: "native.relay.v1", SchemaVersion: 1, ConfigDigest: hash, Config: config}, DrainTimeoutSeconds: 1}
	egress, err := Prepare(egressAssignment, Identity{server, ca.roots}, maximum, allow)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(egress.Close)
	config.Role = "relay-ingress"
	config.Target = nil
	config.PeerEndpoint = &adp3relay.Target{Host: "127.0.0.1", Port: peerPort}
	config.PeerFingerprints = []string{Fingerprint(server.Leaf)}
	hash, err = contracts.ComputeDigest(config)
	if err != nil {
		t.Fatal(err)
	}
	ingressAssignment := egressAssignment
	ingressAssignment.NodeId = "node-a"
	ingressAssignment.SessionEpoch = 2
	ingressAssignment.AssignmentId = "assignment-a"
	ingressAssignment.BindingFence = 4
	ingressAssignment.Role = "relay-ingress"
	ingressAssignment.Resource = adp3relay.Resource{Address: "127.0.0.1", Port: clientPort, Protocol: protocol}
	ingressAssignment.Driver = adp3relay.RelayDriver{Id: "native.relay.v1", SchemaVersion: 1, ConfigDigest: hash, Config: config}
	ingress, err := Prepare(ingressAssignment, Identity{client, ca.roots}, maximum, allow)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(ingress.Close)
	return ingress, egress
}
func tcpTarget(t *testing.T, prefix string, halfClose bool) uint64 {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			client, err := listener.Accept()
			if err != nil {
				return
			}
			go func() {
				defer client.Close()
				if halfClose {
					raw, err := io.ReadAll(client)
					if err == nil {
						client.Write(append([]byte(prefix), raw...))
					}
					return
				}
				buffer := make([]byte, 4096)
				for {
					n, err := client.Read(buffer)
					if n > 0 {
						client.Write(buffer[:n])
					}
					if err != nil {
						return
					}
				}
			}()
		}
	}()
	t.Cleanup(func() { listener.Close(); <-done })
	return uint64(listener.Addr().(*net.TCPAddr).Port)
}
func wait(t *testing.T, check func() bool) {
	t.Helper()
	start := time.Now()
	for time.Since(start) < 3*time.Second {
		if check() {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatal("condition timed out")
}
func TestEncryptedTCPPreparedGateHalfCloseAndHardCutoff(t *testing.T) {
	var denied atomic.Bool
	allow := func() error {
		if denied.Load() {
			return fmt.Errorf("LEASE_EXPIRED")
		}
		return nil
	}
	target := tcpTarget(t, "reply:", true)
	ingress, egress := makePair(t, "tcp", target, 4, allow)
	if err := ingress.Activate(); err == nil {
		t.Fatal("prepared egress opened ingress")
	}
	if client, err := net.DialTimeout("tcp", net.JoinHostPort("127.0.0.1", fmt.Sprint(ingress.assignment.Resource.Port)), 100*time.Millisecond); err == nil {
		client.Close()
		t.Fatal("public listener opened before downstream active")
	}
	if err := egress.Activate(); err != nil {
		t.Fatal(err)
	}
	if err := ingress.Activate(); err != nil {
		t.Fatal(err)
	}
	client, err := net.Dial("tcp", ingress.listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	client.SetDeadline(time.Now().Add(2 * time.Second))
	payload := bytes.Repeat([]byte("unique-tcp-"), 8192)
	if _, err := client.Write(payload); err != nil {
		t.Fatal(err)
	}
	client.(*net.TCPConn).CloseWrite()
	reply, err := io.ReadAll(client)
	if err != nil || !bytes.Equal(reply, append([]byte("reply:"), payload...)) {
		t.Fatal("half-close/frame payload mismatch", err)
	}
	wait(t, func() bool { return ingress.Remaining() == 0 && egress.Remaining() == 0 })
	held, err := net.Dial("tcp", ingress.listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	defer held.Close()
	wait(t, func() bool { return ingress.Remaining() == 1 })
	denied.Store(true)
	held.SetReadDeadline(time.Now().Add(time.Second))
	var b [1]byte
	if _, err := held.Read(b[:]); err == nil {
		t.Fatal("hard cutoff did not close held client")
	}
	wait(t, func() bool { return ingress.Remaining() == 0 && egress.Remaining() == 0 })
}
func TestEncryptedUDPIsolatedClientsIdleAndResourceReclamation(t *testing.T) {
	target, err := net.ListenUDP("udp", &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1)})
	if err != nil {
		t.Fatal(err)
	}
	done := make(chan struct{})
	go func() {
		defer close(done)
		packet := make([]byte, 16384)
		for {
			n, client, err := target.ReadFromUDP(packet)
			if err != nil {
				return
			}
			target.WriteToUDP(packet[:n], client)
		}
	}()
	t.Cleanup(func() { target.Close(); <-done })
	ingress, egress := makePair(t, "udp", uint64(target.LocalAddr().(*net.UDPAddr).Port), 4, func() error { return nil })
	if err := egress.Activate(); err != nil {
		t.Fatal(err)
	}
	if err := ingress.Activate(); err != nil {
		t.Fatal(err)
	}
	clients := []*net.UDPConn{}
	for range 2 {
		client, err := net.DialUDP("udp", nil, ingress.udp.LocalAddr().(*net.UDPAddr))
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { client.Close() })
		clients = append(clients, client)
	}
	for sequence := range 12 {
		for index, client := range clients {
			payload := []byte(fmt.Sprintf("client-%d-sequence-%d", index, sequence))
			if sequence == 0 {
				payload = nil
			}
			client.SetDeadline(time.Now().Add(2 * time.Second))
			client.Write(payload)
			reply := make([]byte, 16384)
			n, err := client.Read(reply)
			if err != nil || !bytes.Equal(reply[:n], payload) {
				t.Fatal("UDP frame/client mapping mismatch", err)
			}
		}
	}
	if ingress.Remaining() != 2 {
		t.Fatal("clients not isolated")
	}
	wait(t, func() bool { return ingress.Remaining() == 0 && egress.Remaining() == 0 })
	clients[0].SetDeadline(time.Now().Add(2 * time.Second))
	clients[0].Write([]byte("after-idle"))
	reply := make([]byte, 64)
	n, err := clients[0].Read(reply)
	if err != nil || string(reply[:n]) != "after-idle" {
		t.Fatal("reclaimed UDP budget not reusable", err)
	}
	ingress.Close()
	egress.Close()
	if ingress.Remaining() != 0 || egress.Remaining() != 0 {
		t.Fatal("resources leaked")
	}
}
func TestOpenRejectsOldBindingOverActualTLS(t *testing.T) {
	target := tcpTarget(t, "", false)
	ingress, egress := makePair(t, "tcp", target, 2, func() error { return nil })
	if err := egress.Activate(); err != nil {
		t.Fatal(err)
	}
	ingress.assignment.Driver.Config.Binding.EgressSessionEpoch++
	if client, err := ingress.dialPeer("probe"); err == nil {
		client.Close()
		t.Fatal("actual TLS accepted old deployment/session")
	}
	if egress.Rejected() == 0 {
		t.Fatal("rejection not observable")
	}
}

func TestRelayNodeBudgetSharedAndReturnedAcrossProtocols(t *testing.T) {
	first, err := acquireNode(1, "tcp")
	if err != nil {
		t.Fatal(err)
	}
	if release, err := acquireNode(1, "udp"); err == nil {
		release()
		t.Fatal("node total budget bypassed")
	}
	first()
	first()
	second, err := acquireNode(1, "udp")
	if err != nil {
		t.Fatal("capacity not reclaimed", err)
	}
	second()
}
func TestRelayTargetPolicyRefusedOnActualNumericDial(t *testing.T) {
	target := tcpTarget(t, "", false)
	ingress, egress := makePair(t, "tcp", target, 2, func() error { return nil })
	egress.assignment.Driver.Config.AllowedDestinationCidrs = []string{"10.0.0.0/8"}
	if err := egress.Activate(); err != nil {
		t.Fatal(err)
	}
	if peer, err := ingress.dialPeer("tcp"); err == nil {
		peer.Close()
		t.Fatal("forbidden target dialed")
	}
	if egress.Rejected() == 0 {
		t.Fatal("target refusal missing")
	}
}
func TestRelayDrainRetiresListenerWhileBoundedEstablishedTCPCanFinish(t *testing.T) {
	target := tcpTarget(t, "", false)
	ingress, egress := makePair(t, "tcp", target, 2, func() error { return nil })
	if err := egress.Activate(); err != nil {
		t.Fatal(err)
	}
	if err := ingress.Activate(); err != nil {
		t.Fatal(err)
	}
	client, err := net.Dial("tcp", ingress.listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	client.SetDeadline(time.Now().Add(2 * time.Second))
	client.Write([]byte("before"))
	reply := make([]byte, 6)
	if _, err := io.ReadFull(client, reply); err != nil || string(reply) != "before" {
		t.Fatal(err)
	}
	ingress.Drain()
	if next, err := net.DialTimeout("tcp", ingress.listener.Addr().String(), 100*time.Millisecond); err == nil {
		next.Close()
		t.Fatal("draining listener accepted new flow")
	}
	client.Write([]byte("after"))
	reply = make([]byte, 5)
	if _, err := io.ReadFull(client, reply); err != nil || string(reply) != "after" {
		t.Fatal("drained established flow changed", err)
	}
	client.(*net.TCPConn).CloseWrite()
	io.ReadAll(client)
	wait(t, func() bool { return ingress.Remaining() == 0 })
	ingress.Close()
	egress.Close()
}

func TestRelayUDPHardCutoffClosesActiveAssociations(t *testing.T) {
	var denied atomic.Bool
	target, err := net.ListenUDP("udp", &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1)})
	if err != nil {
		t.Fatal(err)
	}
	done := make(chan struct{})
	go func() {
		defer close(done)
		packet := make([]byte, 64)
		for {
			n, remote, err := target.ReadFromUDP(packet)
			if err != nil {
				return
			}
			target.WriteToUDP(packet[:n], remote)
		}
	}()
	t.Cleanup(func() { target.Close(); <-done })
	ingress, egress := makePair(t, "udp", uint64(target.LocalAddr().(*net.UDPAddr).Port), 2, func() error {
		if denied.Load() {
			return fmt.Errorf("LEASE_EXPIRED")
		}
		return nil
	})
	if err := egress.Activate(); err != nil {
		t.Fatal(err)
	}
	if err := ingress.Activate(); err != nil {
		t.Fatal(err)
	}
	client, err := net.DialUDP("udp", nil, ingress.udp.LocalAddr().(*net.UDPAddr))
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	client.SetDeadline(time.Now().Add(time.Second))
	client.Write([]byte("active"))
	buffer := make([]byte, 64)
	if _, err := client.Read(buffer); err != nil {
		t.Fatal(err)
	}
	denied.Store(true)
	wait(t, func() bool { return ingress.Remaining() == 0 && egress.Remaining() == 0 })
	client.SetDeadline(time.Now().Add(150 * time.Millisecond))
	client.Write([]byte("expired"))
	if _, err := client.Read(buffer); err == nil {
		t.Fatal("UDP survived hard cutoff")
	}
}
func TestRelayExpiredPeerStopsExistingCheckedFlow(t *testing.T) {
	target := tcpTarget(t, "", false)
	ingress, egress := makePair(t, "tcp", target, 2, func() error { return nil })
	if err := egress.Activate(); err != nil {
		t.Fatal(err)
	}
	peer, err := ingress.dialPeer("tcp")
	if err != nil {
		t.Fatal(err)
	}
	defer closeSocket(peer)
	defer ingress.untrackPeer(peer)
	ingress.mutex.Lock()
	ingress.peers[peer] = time.Now().Add(-time.Second)
	ingress.mutex.Unlock()
	peer.SetReadDeadline(time.Now().Add(time.Second))
	buffer := make([]byte, 1)
	if _, err := peer.Read(buffer); err == nil {
		t.Fatal("expired tracked peer not closed")
	}
	wait(t, func() bool { return egress.Remaining() == 0 })
}

func TestRelayRepeatedDrainAndAuthorizationCannotExtendRetiredFlow(t *testing.T) {
	target := tcpTarget(t, "", false)
	ingress, egress := makePair(t, "tcp", target, 2, func() error { return nil })
	if err := egress.Activate(); err != nil {
		t.Fatal(err)
	}
	if err := ingress.Activate(); err != nil {
		t.Fatal(err)
	}
	ingress.Drain()
	first := ingress.drainUntil
	time.Sleep(time.Millisecond)
	ingress.Drain()
	ingress.SetAuthorization(func() error { return nil })
	if ingress.drainUntil != first {
		t.Fatal("repeated drain renewed retired authority")
	}
	if err := ingress.Activate(); err == nil {
		t.Fatal("retired execution reactivated")
	}
}

func TestRelayPeerOutageAndCustomerTargetOutageRemainDistinct(t *testing.T) {
	target := tcpTarget(t, "", false)
	ingress, egress := makePair(t, "tcp", target, 2, func() error { return nil })
	if err := egress.Activate(); err != nil {
		t.Fatal(err)
	}
	if err := ingress.Activate(); err != nil {
		t.Fatal(err)
	}
	egress.Close()
	if err := ingress.Activate(); err == nil || !strings.HasPrefix(err.Error(), "DOWNSTREAM_UNAVAILABLE:") {
		t.Fatalf("peer outage must identify the downstream link: %v", err)
	}
	missing := adp3relay.Target{Host: "127.0.0.1", Port: freePort(t, "tcp")}
	if connection, err := ingress.dialTarget("tcp", missing); err == nil || err.Error() != "TARGET_UNAVAILABLE" {
		if connection != nil {
			connection.Close()
		}
		t.Fatalf("customer target outage must retain its own classification: %v", err)
	}
}
