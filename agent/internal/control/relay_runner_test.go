package control

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/authorization"
	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/relay"
	"github.com/tunex/vnext/agent/internal/state"
)

func runnerFreePort(t *testing.T) uint64 {
	t.Helper()
	socket, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := uint64(socket.Addr().(*net.TCPAddr).Port)
	socket.Close()
	return port
}
func runnerSnapshot(t *testing.T, node string, epoch, generation uint64, assignments []adp3.Assignment) []byte {
	t.Helper()
	now := time.Now().UTC()
	body := map[string]any{"protocolVersion": 3, "nodeId": node, "sessionEpoch": epoch, "snapshotGeneration": generation, "complete": true, "issuedAt": now.Format(time.RFC3339Nano), "validUntil": now.Add(300 * time.Second).Format(time.RFC3339Nano), "assignments": assignments, "tombstones": []any{}}
	hash, err := contracts.ComputeDigest(body)
	if err != nil {
		t.Fatal(err)
	}
	body["snapshotDigest"] = hash
	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := adp3.Parse("Snapshot", raw); err != nil {
		t.Fatal(err)
	}
	return raw
}
func relayTestRunner(t *testing.T, node string, epoch uint64, certificate tls.Certificate, roots *x509.CertPool, raw *[]byte) *Runner {
	t.Helper()
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		if request.Method == "POST" {
			var report adp3.ReportRequest
			if err := json.NewDecoder(request.Body).Decode(&report); err != nil {
				t.Error(err)
			}
			json.NewEncoder(w).Encode(adp3.ReportAck{ProtocolVersion: 3, NodeId: node, BootId: report.BootId, SessionEpoch: epoch, ReportSequence: report.ReportSequence, Status: "accepted"})
			return
		}
		w.Write(*raw)
	}))
	t.Cleanup(server.Close)
	root := t.TempDir()
	key := bytes.Repeat([]byte{8}, 32)
	path := filepath.Join(root, "journal.json")
	if err := state.InitializeRuntimeJournal(path, key, node); err != nil {
		t.Fatal(err)
	}
	stored, err := state.LoadRuntimeJournal(path, key, node)
	if err != nil {
		t.Fatal(err)
	}
	runner := &Runner{options: Options{URL: server.URL, NodeID: node, BootID: "test-boot", Relay: true, Journal: path}, client: server.Client(), key: key, journal: stored.Journal, hello: adp3.HelloResponse{SessionEpoch: epoch, Policy: adp3.Policy{LeaseSeconds: 300, MaxClockSkewSeconds: 5, ConnectTimeoutSeconds: 2, MaxTcpConnectionsPerAssignment: 8, MaxUdpSessionsPerAssignment: 8}}, instances: map[string]running{}, roots: roots, relayCertificate: certificate, relayUntil: certificate.Leaf.NotAfter, clock: authorization.SystemClock}
	t.Cleanup(runner.stop)
	return runner
}

func TestRelayRunnerPersistsBeforePrepareAndActivatesAfterRealPeerProbe(t *testing.T) {
	for _, protocol := range []string{"tcp", "udp"} {
		t.Run(protocol, func(t *testing.T) {
			ca, caKey, roots := relayTestCA(t)
			makeIdentity := func(node string) tls.Certificate {
				request, err := prepareRotation(filepath.Join(t.TempDir(), "request.json"), node)
				if err != nil {
					t.Fatal(err)
				}
				bundle := signRelayTest(t, ca, caKey, request, node, []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth})
				certificate, _, err := validateRelayBundle(bundle, node, roots)
				if err != nil {
					t.Fatal(err)
				}
				return certificate
			}
			ingressIdentity, egressIdentity := makeIdentity("node-a"), makeIdentity("node-b")
			var targetPort uint64
			if protocol == "tcp" {
				listener, err := net.Listen("tcp", "127.0.0.1:0")
				if err != nil {
					t.Fatal(err)
				}
				targetPort = uint64(listener.Addr().(*net.TCPAddr).Port)
				go func() {
					for {
						client, err := listener.Accept()
						if err != nil {
							return
						}
						go func() {
							defer client.Close()
							raw, err := io.ReadAll(client)
							if err == nil {
								client.Write(raw)
							}
						}()
					}
				}()
				t.Cleanup(func() { listener.Close() })
			} else {
				socket, err := net.ListenUDP("udp", &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1)})
				if err != nil {
					t.Fatal(err)
				}
				targetPort = uint64(socket.LocalAddr().(*net.UDPAddr).Port)
				go func() {
					buffer := make([]byte, 16384)
					for {
						n, remote, err := socket.ReadFromUDP(buffer)
						if err != nil {
							return
						}
						socket.WriteToUDP(buffer[:n], remote)
					}
				}()
				t.Cleanup(func() { socket.Close() })
			}
			profile := adp3.ProfileConfig{Driver: "native.relay.v1", WireVersion: 1, Security: "mutual-tls13", Protocols: []string{"tcp", "udp"}, HandshakeTimeoutSeconds: 2, IdleTimeoutSeconds: 1, MaxFrameBytes: 65536, MaxUdpDatagramBytes: 16384, MaxConnectionsPerNode: 32}
			profileDigest, _ := contracts.ComputeDigest(profile)
			binding := adp3.Binding{ScopeId: "scope-a", ForwardId: "forward-a", ForwardRevision: 1, DeploymentGeneration: 1, IngressNodeId: "node-a", EgressNodeId: "node-b", IngressAssignmentId: "assignment-a", EgressAssignmentId: "assignment-b", IngressSessionEpoch: 2, EgressSessionEpoch: 3, IngressFence: 4, EgressFence: 5, ProfileId: "profile-a", ProfileRevision: 1, ProfileDigest: profileDigest}
			listenPort, peerPort := runnerFreePort(t), runnerFreePort(t)
			policyRevision, metadata, cidrs := uint64(1), false, []string{"127.0.0.0/8"}
			build := func(role string) adp3.Assignment {
				config := adp3.RuntimeConfig{Role: &role, Binding: &binding, Profile: &profile, EgressPolicyRevision: &policyRevision, AllowMetadataTargets: &metadata, AllowedDestinationCidrs: &cidrs}
				id, fence, port, physical := "assignment-a", uint64(4), listenPort, protocol
				pins := []string{relay.Fingerprint(egressIdentity.Leaf)}
				config.PeerEndpoint = &adp3.Target{Host: "127.0.0.1", Port: peerPort}
				if role == "relay-egress" {
					id, fence, port, physical = "assignment-b", 5, peerPort, "tcp"
					pins = []string{relay.Fingerprint(ingressIdentity.Leaf)}
					config.PeerEndpoint = nil
					config.Target = &adp3.Target{Host: "127.0.0.1", Port: targetPort}
				}
				config.PeerFingerprints = &pins
				hash, _ := contracts.ComputeDigest(config)
				return adp3.Assignment{AssignmentId: id, ForwardId: "forward-a", ForwardRevision: 1, DeploymentGeneration: 1, BindingFence: fence, Role: role, Protocol: protocol, Phase: "prepared", Resource: adp3.Resource{Address: "127.0.0.1", Port: port, Protocol: physical}, Driver: adp3.Driver{Id: "native.relay.v1", SchemaVersion: 1, ConfigDigest: hash, Config: config}, DrainTimeoutSeconds: 1}
			}
			ingress, egress := build("relay-ingress"), build("relay-egress")
			ingressRaw, egressRaw := runnerSnapshot(t, "node-a", 2, 1, []adp3.Assignment{ingress}), runnerSnapshot(t, "node-b", 3, 1, []adp3.Assignment{egress})
			a, b := relayTestRunner(t, "node-a", 2, ingressIdentity, roots, &ingressRaw), relayTestRunner(t, "node-b", 3, egressIdentity, roots, &egressRaw)
			ctx := context.Background()
			a.options.Relay = false
			if err := a.poll(ctx); err == nil || a.journal.Generation != 0 || len(a.instances) != 0 {
				t.Fatal("disabled Relay changed persistent or socket state")
			}
			a.options.Relay = true
			if err := b.poll(ctx); err != nil {
				t.Fatal(err)
			}
			if err := a.poll(ctx); err != nil {
				t.Fatal(err)
			}
			if a.observations[0].Condition != "prepared" || b.observations[0].Condition != "prepared" {
				t.Fatal("prepared is falsely ready")
			}
			ingress.Phase = "active"
			ingressRaw = runnerSnapshot(t, "node-a", 2, 2, []adp3.Assignment{ingress})
			if err := a.poll(ctx); err != nil {
				t.Fatal(err)
			}
			if a.observations[0].Condition != "error" {
				t.Fatal("prepared downstream accepted active ingress")
			}
			if !a.observations[0].Retryable || *a.observations[0].ErrorCode != "DOWNSTREAM_NOT_ACTIVE" {
				t.Fatal("prepared downstream refusal lost its retry classification")
			}
			egress.Phase = "active"
			egressRaw = runnerSnapshot(t, "node-b", 3, 2, []adp3.Assignment{egress})
			if err := b.poll(ctx); err != nil {
				t.Fatal(err)
			}
			if err := a.poll(ctx); err != nil {
				t.Fatal(err)
			}
			if a.observations[0].Condition != "ready" {
				t.Fatal("active probe did not recover", a.observations)
			}
			client, err := net.DialTimeout(protocol, net.JoinHostPort("127.0.0.1", fmtPort(listenPort)), time.Second)
			if err != nil {
				t.Fatal(err)
			}
			defer client.Close()
			client.SetDeadline(time.Now().Add(2 * time.Second))
			payload := []byte("relay-client-unique-payload")
			if protocol == "tcp" {
				payload = bytes.Repeat(payload, 4096)
			}
			if _, err := client.Write(payload); err != nil {
				t.Fatal(err)
			}
			var reply []byte
			if protocol == "tcp" {
				client.(*net.TCPConn).CloseWrite()
				reply, err = io.ReadAll(client)
			} else {
				buffer := make([]byte, 16384)
				var n int
				n, err = client.Read(buffer)
				reply = buffer[:n]
			}
			if err != nil || !bytes.Equal(payload, reply) {
				t.Fatal("Agent Relay payload differs", err)
			}
			key := protocol + "/" + fmtPort(listenPort)
			original := a.instances[key].stream
			ingressRaw = runnerSnapshot(t, "node-a", 2, 3, []adp3.Assignment{ingress})
			if err := a.poll(ctx); err != nil || a.instances[key].stream != original {
				t.Fatal("renewal restarted Relay", err)
			}
			stored, err := state.LoadRuntimeJournal(a.options.Journal, a.key, "node-a")
			if err != nil || stored.Journal.Generation != 3 {
				t.Fatal("Relay authority not persistent", err)
			}
			b.stop()
			if err := a.poll(ctx); err != nil {
				t.Fatal(err)
			}
			if a.observations[0].Condition != "error" || !a.observations[0].Retryable {
				t.Fatal("lost downstream remained falsely ready")
			}
			// A new generation at the same client-facing physical port first becomes
			// Prepared. Once the *ingress* accepts that Snapshot, the previous
			// generation must stop accepting clients for both physical protocols.
			// Merely seeing egress Prepared is not enough: Agents poll separately.
			nextIngress := ingress
			nextIngress.ForwardRevision = 2
			nextIngress.DeploymentGeneration = 2
			nextIngress.BindingFence = ingress.BindingFence + 2
			nextIngress.Phase = "prepared"
			nextConfig := ingress.Driver.Config
			nextBinding := *nextConfig.Binding
			nextBinding.ForwardRevision = 2
			nextBinding.DeploymentGeneration = 2
			nextBinding.IngressFence = nextIngress.BindingFence
			nextConfig.Binding = &nextBinding
			nextDigest, err := contracts.ComputeDigest(nextConfig)
			if err != nil {
				t.Fatal(err)
			}
			nextIngress.Driver.Config = nextConfig
			nextIngress.Driver.ConfigDigest = nextDigest
			ingressRaw = runnerSnapshot(t, "node-a", 2, 4, []adp3.Assignment{nextIngress})
			if err := a.poll(ctx); err != nil {
				t.Fatal("new generation Prepared failed", err)
			}
			if a.observations[0].Condition != "prepared" || a.observations[0].DeploymentGeneration != 2 {
				t.Fatal("successor Prepared was not reported", a.observations)
			}
			assertAvailable := func() {
				address := net.JoinHostPort("127.0.0.1", fmtPort(listenPort))
				var probe net.PacketConn
				var probeTCP net.Listener
				var err error
				if protocol == "tcp" {
					probeTCP, err = net.Listen("tcp", address)
				} else {
					probe, err = net.ListenPacket("udp", address)
				}
				if err != nil {
					t.Fatal("previous Relay listener remains bound after ingress Prepared", err)
				}
				if probeTCP != nil { probeTCP.Close() }
				if probe != nil { probe.Close() }
			}
			assertAvailable()
			ingressRaw = runnerSnapshot(t, "node-a", 2, 5, []adp3.Assignment{})
			if err := a.poll(ctx); err != nil {
				t.Fatal(err)
			}
			if len(a.instances) != 0 {
				t.Fatal("removed Relay listener retained")
			}
			if a.journal.Retired[key] != nextIngress.BindingFence {
				t.Fatal("successor physical Relay fence not retired")
			}
		})
	}
}
