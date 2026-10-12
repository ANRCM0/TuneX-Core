package forward

import (
	"bytes"
	"context"
	"fmt"
	"net"
	"net/netip"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/contracts"
)

func udpEchoTarget(t *testing.T, prefix string) *net.UDPConn {
	t.Helper()
	target, err := net.ListenUDP("udp", &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1)})
	if err != nil {
		t.Fatal(err)
	}
	done := make(chan struct{})
	go func() {
		defer close(done)
		packet := make([]byte, MaxUDPDatagramBytes+1)
		for {
			n, remote, err := target.ReadFromUDP(packet)
			if err != nil {
				return
			}
			target.WriteToUDP(append([]byte(prefix), packet[:n]...), remote)
		}
	}()
	t.Cleanup(func() { target.Close(); <-done })
	return target
}

func udpTestAssignment(t *testing.T, target *net.UDPConn) contracts.Assignment {
	t.Helper()
	reservation, err := net.ListenUDP("udp", &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1)})
	if err != nil {
		t.Fatal(err)
	}
	port := uint64(reservation.LocalAddr().(*net.UDPAddr).Port)
	reservation.Close()
	return contracts.Assignment{Protocol: "udp", Phase: "active", Listener: contracts.Listen{Address: "127.0.0.1", Port: port},
		Driver: contracts.Driver{Id: "native.direct.v1", Config: contracts.DirectConfig{Target: contracts.Target{Host: "127.0.0.1", Port: uint64(target.LocalAddr().(*net.UDPAddr).Port)}, AllowedDestinationCidrs: []string{"127.0.0.0/8"}}}}
}

func udpTestPolicy() contracts.Policy {
	return contracts.Policy{ConnectTimeoutSeconds: 2, UdpIdleTimeoutSeconds: 60, MaxUdpSessionsPerAssignment: 8}
}

func udpTestStream(t *testing.T, assignment contracts.Assignment, policy contracts.Policy) *UDP {
	t.Helper()
	stream, err := StartUDP(assignment, policy)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(stream.Close)
	return stream
}

func udpTestClient(t *testing.T, stream *UDP) *net.UDPConn {
	t.Helper()
	client, err := net.DialUDP("udp", nil, stream.slot.listener.LocalAddr().(*net.UDPAddr))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { client.Close() })
	return client
}

func udpWrite(t *testing.T, client *net.UDPConn, packet []byte) {
	t.Helper()
	client.SetWriteDeadline(time.Now().Add(2 * time.Second))
	if n, err := client.Write(packet); err != nil || n != len(packet) {
		t.Fatalf("write UDP %d/%d: %v", n, len(packet), err)
	}
}

func udpRead(t *testing.T, client *net.UDPConn) []byte {
	t.Helper()
	client.SetReadDeadline(time.Now().Add(2 * time.Second))
	packet := make([]byte, MaxUDPDatagramBytes+1)
	n, err := client.Read(packet)
	if err != nil {
		t.Fatal("read UDP reply", err)
	}
	return packet[:n]
}

func udpNoReply(t *testing.T, client *net.UDPConn) {
	t.Helper()
	client.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
	packet := make([]byte, MaxUDPDatagramBytes+1)
	if n, err := client.Read(packet); err == nil {
		t.Fatalf("unexpected UDP response: %q", packet[:n])
	} else if problem, ok := err.(net.Error); !ok || !problem.Timeout() {
		t.Fatal("expected UDP response timeout", err)
	}
}

func udpWait(t *testing.T, condition func() bool, message string) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if condition() {
			return
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatal(message)
}

func TestUDPMultipleClientRepliesStayIsolated(t *testing.T) {
	target := udpEchoTarget(t, "reply:")
	stream := udpTestStream(t, udpTestAssignment(t, target), udpTestPolicy())
	clients := []*net.UDPConn{udpTestClient(t, stream), udpTestClient(t, stream)}
	for attempt := range 30 {
		for index, client := range clients {
			udpWrite(t, client, fmt.Appendf(nil, "client%d-packet%d", index, attempt))
		}
		for index, client := range clients {
			expected := fmt.Sprintf("reply:client%d-packet%d", index, attempt)
			if reply := string(udpRead(t, client)); reply != expected {
				t.Fatalf("reply routed to wrong client: %q != %q", reply, expected)
			}
		}
	}
	if stream.Remaining() != 2 {
		t.Fatal("client associations not independent", stream.Stats())
	}
}

func TestUDPIdleExpiryReclaimsAssociation(t *testing.T) {
	target := udpEchoTarget(t, "reply:")
	policy := udpTestPolicy()
	policy.UdpIdleTimeoutSeconds = 1
	stream := udpTestStream(t, udpTestAssignment(t, target), policy)
	client := udpTestClient(t, stream)
	udpWrite(t, client, []byte("first"))
	if got := string(udpRead(t, client)); got != "reply:first" {
		t.Fatal(got)
	}
	udpWait(t, func() bool { return stream.Remaining() == 0 }, "idle UDP association never expired")
	udpWrite(t, client, []byte("after-idle"))
	if got := string(udpRead(t, client)); got != "reply:after-idle" {
		t.Fatal("fresh association after idle", got)
	}
	if stream.Remaining() != 1 {
		t.Fatal("new association missing")
	}
}

func TestUDPCapacityDropPreservesExistingClient(t *testing.T) {
	target := udpEchoTarget(t, "reply:")
	policy := udpTestPolicy()
	policy.MaxUdpSessionsPerAssignment = 1
	stream := udpTestStream(t, udpTestAssignment(t, target), policy)
	first, excess := udpTestClient(t, stream), udpTestClient(t, stream)
	udpWrite(t, first, []byte("accepted"))
	if got := string(udpRead(t, first)); got != "reply:accepted" {
		t.Fatal(got)
	}
	udpWrite(t, excess, []byte("excess"))
	udpWait(t, func() bool { return stream.Stats().CapacityDropped > 0 }, "excess UDP association not counted")
	udpNoReply(t, excess)
	udpWrite(t, first, []byte("still-active"))
	if got := string(udpRead(t, first)); got != "reply:still-active" {
		t.Fatal("existing UDP client affected by capacity drop", got)
	}
	stream.Close()
	if stream.Remaining() != 0 {
		t.Fatal("UDP associations leaked after Close")
	}
}

func TestUDPNewAssociationsCheckResolvedTargetPolicy(t *testing.T) {
	target := udpEchoTarget(t, "reply:")
	for _, scenario := range []struct {
		name, host string
		cidrs      []string
		allow      bool
	}{
		{"allowed-DNS", "localhost", []string{"127.0.0.0/8"}, true},
		{"denied-DNS", "localhost", []string{"10.0.0.0/8"}, false},
		{"metadata-denied", "169.254.169.254", []string{"0.0.0.0/0"}, false},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			assignment := udpTestAssignment(t, target)
			assignment.Driver.Config.Target.Host = scenario.host
			assignment.Driver.Config.AllowedDestinationCidrs = scenario.cidrs
			stream := udpTestStream(t, assignment, udpTestPolicy())
			client := udpTestClient(t, stream)
			udpWrite(t, client, []byte("policy"))
			if scenario.allow {
				if got := string(udpRead(t, client)); got != "reply:policy" {
					t.Fatal(got)
				}
			} else {
				udpWait(t, func() bool { return stream.Stats().TargetRejected > 0 && stream.Remaining() == 0 }, "denied UDP target not rejected or reclaimed")
				udpNoReply(t, client)
			}
		})
	}
}

func TestUDPOversizedDatagramsAreNotTruncatedAndForwarded(t *testing.T) {
	target, err := net.ListenUDP("udp", &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1)})
	if err != nil {
		t.Fatal(err)
	}
	var received atomic.Uint64
	done := make(chan struct{})
	go func() {
		defer close(done)
		packet := make([]byte, 65507)
		for {
			n, remote, err := target.ReadFromUDP(packet)
			if err != nil {
				return
			}
			received.Add(1)
			if string(packet[:n]) == "large-reply" {
				target.WriteToUDP(make([]byte, MaxUDPDatagramBytes+1), remote)
			} else {
				target.WriteToUDP(packet[:n], remote)
			}
		}
	}()
	t.Cleanup(func() { target.Close(); <-done })
	stream := udpTestStream(t, udpTestAssignment(t, target), udpTestPolicy())
	client := udpTestClient(t, stream)
	udpWrite(t, client, make([]byte, MaxUDPDatagramBytes+1))
	udpWait(t, func() bool { return stream.Stats().DatagramDropped == 1 }, "large client packet not rejected")
	udpNoReply(t, client)
	if received.Load() != 0 || stream.Remaining() != 0 {
		t.Fatal("oversized packet forwarded or association allocated")
	}
	udpWrite(t, client, []byte("large-reply"))
	udpWait(t, func() bool { return stream.Stats().DatagramDropped == 2 }, "large target packet not rejected")
	udpNoReply(t, client)
	udpWrite(t, client, []byte("valid"))
	if got := string(udpRead(t, client)); got != "valid" {
		t.Fatal("valid packet affected by oversized drops", got)
	}
}

func TestUDPConnectedUpstreamRejectsDifferentPeer(t *testing.T) {
	target, err := net.ListenUDP("udp", &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1)})
	if err != nil {
		t.Fatal(err)
	}
	remote := make(chan *net.UDPAddr, 1)
	done := make(chan struct{})
	go func() {
		defer close(done)
		packet := make([]byte, 100)
		n, addr, err := target.ReadFromUDP(packet)
		if err == nil {
			remote <- addr
			target.WriteToUDP(append([]byte("real:"), packet[:n]...), addr)
		}
	}()
	t.Cleanup(func() { target.Close(); <-done })
	stream := udpTestStream(t, udpTestAssignment(t, target), udpTestPolicy())
	client := udpTestClient(t, stream)
	udpWrite(t, client, []byte("request"))
	if got := string(udpRead(t, client)); got != "real:request" {
		t.Fatal(got)
	}
	var upstream *net.UDPAddr
	select {
	case upstream = <-remote:
	case <-time.After(2 * time.Second):
		t.Fatal("upstream client not observed")
	}
	spoof, err := net.DialUDP("udp", nil, upstream)
	if err != nil {
		t.Fatal(err)
	}
	defer spoof.Close()
	udpWrite(t, spoof, []byte("forged-reply"))
	udpNoReply(t, client)
}

func TestUDPReplacementResetsOldAssociationsAndKeepsListener(t *testing.T) {
	firstTarget, nextTarget := udpEchoTarget(t, "first:"), udpEchoTarget(t, "next:")
	assignment := udpTestAssignment(t, firstTarget)
	first := udpTestStream(t, assignment, udpTestPolicy())
	client := udpTestClient(t, first)
	udpWrite(t, client, []byte("before"))
	if got := string(udpRead(t, client)); got != "first:before" {
		t.Fatal(got)
	}
	assignment.Driver.Config.Target.Port = uint64(nextTarget.LocalAddr().(*net.UDPAddr).Port)
	next, err := first.Replace(assignment)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(next.Close)
	if first.Remaining() != 0 {
		t.Fatal("old UDP associations retained across replacement")
	}
	first.Close()
	first.Drain()
	if _, err := first.Replace(assignment); err == nil {
		t.Fatal("retired UDP instance reacquired listener")
	}
	udpWrite(t, client, []byte("after"))
	if got := string(udpRead(t, client)); got != "next:after" {
		t.Fatal("successor target/listener broken", got)
	}
	if next.Remaining() != 1 {
		t.Fatal("successor association missing")
	}
}

func TestUDPDrainClosesAllSessionsAndReleasesBinding(t *testing.T) {
	target := udpEchoTarget(t, "reply:")
	stream := udpTestStream(t, udpTestAssignment(t, target), udpTestPolicy())
	client := udpTestClient(t, stream)
	udpWrite(t, client, []byte("active"))
	udpRead(t, client)
	address := stream.slot.listener.LocalAddr().(*net.UDPAddr)
	stream.Drain()
	if stream.Remaining() != 0 {
		t.Fatal("UDP Drain failed to close sessions")
	}
	rebound, err := net.ListenUDP("udp", address)
	if err != nil {
		t.Fatal("UDP Drain retained listener", err)
	}
	rebound.Close()
	if _, err := stream.Replace(contracts.Assignment{}); err == nil {
		t.Fatal("drained UDP stream replaced with invalid config")
	}
}

func TestUDPReplyAmplificationIsBounded(t *testing.T) {
	target, err := net.ListenUDP("udp", &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1)})
	if err != nil {
		t.Fatal(err)
	}
	done := make(chan struct{})
	go func() {
		defer close(done)
		packet := make([]byte, 100)
		_, remote, err := target.ReadFromUDP(packet)
		if err == nil {
			for range 12 {
				target.WriteToUDP(bytes.Repeat([]byte("x"), MaxUDPDatagramBytes/2), remote)
			}
		}
	}()
	t.Cleanup(func() { target.Close(); <-done })
	stream := udpTestStream(t, udpTestAssignment(t, target), udpTestPolicy())
	client := udpTestClient(t, stream)
	udpWrite(t, client, []byte("burst"))
	for range 2 {
		if n := len(udpRead(t, client)); n != MaxUDPDatagramBytes/2 {
			t.Fatal("unexpected allowed burst packet", n)
		}
	}
	udpWait(t, func() bool { return stream.Stats().AmplificationDropped > 0 }, "target amplification not bounded")
	udpNoReply(t, client)
}

func TestUDPZeroLengthDatagramsArePreserved(t *testing.T) {
	target := udpEchoTarget(t, "")
	stream := udpTestStream(t, udpTestAssignment(t, target), udpTestPolicy())
	client := udpTestClient(t, stream)
	udpWrite(t, client, nil)
	if reply := udpRead(t, client); len(reply) != 0 {
		t.Fatal("zero UDP datagram changed", reply)
	}
}

func TestUDPCloseCancelsPendingDNSAndReclaimsSession(t *testing.T) {
	original := net.DefaultResolver
	started := make(chan struct{})
	var once sync.Once
	net.DefaultResolver = &net.Resolver{PreferGo: true, Dial: func(ctx context.Context, _, _ string) (net.Conn, error) {
		once.Do(func() { close(started) })
		<-ctx.Done()
		return nil, ctx.Err()
	}}
	t.Cleanup(func() { net.DefaultResolver = original })
	target := udpEchoTarget(t, "unused:")
	assignment := udpTestAssignment(t, target)
	assignment.Driver.Config.Target.Host = "held.invalid"
	stream := udpTestStream(t, assignment, udpTestPolicy())
	client := udpTestClient(t, stream)
	udpWrite(t, client, []byte("pending"))
	select {
	case <-started:
	case <-time.After(2 * time.Second):
		t.Fatal("DNS work did not start")
	}
	if stream.Remaining() != 1 {
		t.Fatal("in-flight DNS not charged against UDP session budget")
	}
	for range UDPQueueDepth + 2 {
		udpWrite(t, client, []byte("queued"))
	}
	udpWait(t, func() bool { return stream.Stats().QueueDropped > 0 }, "pending UDP association did not bound queued datagrams")
	done := make(chan struct{})
	go func() { stream.Close(); close(done) }()
	select {
	case <-done:
	case <-time.After(500 * time.Millisecond):
		t.Fatal("UDP Close did not cancel DNS")
	}
	if stream.Remaining() != 0 {
		t.Fatal("pending UDP session leaked")
	}
}

func TestUDPInvalidResourcesRejectedAndPolicyMaximumBounded(t *testing.T) {
	target := udpEchoTarget(t, "reply:")
	assignment := udpTestAssignment(t, target)
	for _, policy := range []contracts.Policy{
		{ConnectTimeoutSeconds: 1, UdpIdleTimeoutSeconds: 1},
		{MaxUdpSessionsPerAssignment: 1, UdpIdleTimeoutSeconds: 1},
		{MaxUdpSessionsPerAssignment: 1, ConnectTimeoutSeconds: 1},
		{MaxUdpSessionsPerAssignment: 1, ConnectTimeoutSeconds: 1, UdpIdleTimeoutSeconds: ^uint64(0)},
	} {
		if stream, err := StartUDP(assignment, policy); err == nil {
			stream.Close()
			t.Fatal("invalid UDP resource policy accepted")
		}
	}
	policy := udpTestPolicy()
	policy.MaxUdpSessionsPerAssignment = ^uint64(0)
	stream := udpTestStream(t, assignment, policy)
	if stream.maximum != MaxUDPSessions {
		t.Fatal("UDP session hard limit missing", stream.maximum)
	}
}

func TestUDPSharedNodeBudgetAppliesAcrossBindingsAndIsReturned(t *testing.T) {
	original := udpNodePermits
	udpNodePermits = make(chan struct{}, 2)
	t.Cleanup(func() { udpNodePermits = original })
	target := udpEchoTarget(t, "reply:")
	first := udpTestStream(t, udpTestAssignment(t, target), udpTestPolicy())
	next := udpTestStream(t, udpTestAssignment(t, target), udpTestPolicy())
	for index := range 2 {
		client := udpTestClient(t, first)
		udpWrite(t, client, fmt.Appendf(nil, "first-%d", index))
		udpRead(t, client)
	}
	client := udpTestClient(t, next)
	udpWrite(t, client, []byte("capacity"))
	udpWait(t, func() bool { return next.Stats().CapacityDropped > 0 }, "Node-wide UDP budget not enforced")
	udpNoReply(t, client)
	if next.Remaining() != 0 {
		t.Fatal("Node-wide UDP budget allowed an extra association")
	}
	first.Close()
	udpWrite(t, client, []byte("reclaimed"))
	if got := string(udpRead(t, client)); got != "reply:reclaimed" {
		t.Fatal("Node budget not returned after cleanup", got)
	}
}

func TestUDPIPv6TargetWithIPv4Client(t *testing.T) {
	target, err := net.ListenUDP("udp6", &net.UDPAddr{IP: net.ParseIP("::1")})
	if err != nil {
		t.Skip("IPv6 loopback unavailable:", err)
	}
	done := make(chan struct{})
	go func() {
		defer close(done)
		packet := make([]byte, 100)
		n, remote, err := target.ReadFromUDP(packet)
		if err == nil {
			target.WriteToUDP(append([]byte("ipv6:"), packet[:n]...), remote)
		}
	}()
	t.Cleanup(func() { target.Close(); <-done })
	assignment := udpTestAssignment(t, target)
	assignment.Driver.Config.Target.Host = "::1"
	assignment.Driver.Config.AllowedDestinationCidrs = []string{"::1/128"}
	stream := udpTestStream(t, assignment, udpTestPolicy())
	client := udpTestClient(t, stream)
	udpWrite(t, client, []byte("request"))
	if got := string(udpRead(t, client)); got != "ipv6:request" {
		t.Fatal("IPv6 target reply", got)
	}
}

func TestUDPTargetMetadataOverrideStillRequiresCIDRAndOrdinaryIP(t *testing.T) {
	config := contracts.DirectConfig{AllowMetadataTargets: true, AllowedDestinationCidrs: []string{"127.0.0.0/8"}}
	if Allowed(netip.MustParseAddr("169.254.169.254"), config) {
		t.Fatal("metadata override bypassed CIDR policy")
	}
	config.AllowedDestinationCidrs = []string{"169.254.0.0/16"}
	if !Allowed(netip.MustParseAddr("169.254.169.254"), config) {
		t.Fatal("explicit metadata policy not applied")
	}
	config.AllowedDestinationCidrs = []string{"0.0.0.0/0", "::/0"}
	for _, text := range []string{"0.0.0.0", "::", "224.0.0.1", "ff02::1"} {
		if Allowed(netip.MustParseAddr(text), config) {
			t.Fatal("metadata override enabled unsafe target", text)
		}
	}
	config.AllowedDestinationCidrs = []string{"::/0"}
	if Allowed(netip.MustParseAddr("::ffff:127.0.0.1"), config) {
		t.Fatal("mapped IPv4 bypassed destination address family")
	}
}
