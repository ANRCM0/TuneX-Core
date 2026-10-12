package control

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"errors"
	"math/big"
	"net/http"
	"net/http/httptest"
	"net/url"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/tunex/agent/internal/diag"
	"github.com/tunex/agent/internal/manager"
	"github.com/tunex/agent/internal/reporter"
	"github.com/tunex/agent/internal/restore"
	"github.com/tunex/agent/internal/securelink"
	"github.com/tunex/agent/internal/tstruntime"
)

func passiveLink(t *testing.T) tstruntime.Config {
	t.Helper()
	key, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	uri, _ := url.Parse("urn:tunex:tst:w:5:l:91:n:7:r:ingress")
	cert := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "test"}, NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour), IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign | x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth}, URIs: []*url.URL{uri}, DNSNames: []string{"tst-node-7.tunex.invalid"}}
	der, _ := x509.CreateCertificate(rand.Reader, cert, cert, &key.PublicKey, key)
	keyDER, _ := x509.MarshalPKCS8PrivateKey(key)
	certPEM := string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}))
	raw, _ := json.Marshal(tstruntime.TransportConfig{Protocol: "tst/1", Role: "ingress", WorkspaceID: 5, LinkID: 91, NodeID: 7, PeerNodeID: 8, CarrierHost: "127.0.0.1", CarrierPort: 2443, Identity: securelink.Identity{CertificatePEM: certPEM, PrivateKeyPEM: string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: keyDER})), CAPEM: certPEM, PeerURI: "urn:tunex:tst:w:5:l:91:n:8:r:egress"}, Bindings: []tstruntime.Binding{}})
	digest, err := tstruntime.Digest(raw)
	if err != nil {
		t.Fatal(err)
	}
	return tstruntime.Config{ID: "tunex-link-91-p7-ingress", LinkID: 91, WorkspaceID: 5, NodeID: 7, Role: "ingress", Generation: 1, LeaseExpiresAt: time.Now().Add(time.Minute).Format(time.RFC3339Nano), ConfigDigest: digest, TransportConfig: raw}
}

func linkClient(t *testing.T) *Client {
	t.Helper()
	c := newTestClient(t)
	links, err := tstruntime.New(t.TempDir(), "agent-uuid-identity")
	if err != nil {
		t.Fatal(err)
	}
	if err := links.SetPortGuard(c.tunnels); err != nil {
		t.Fatal(err)
	}
	if _, err := links.Reconcile(&tstruntime.Snapshot{NodeDBID: 7, Links: []tstruntime.Config{}}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { links.Close() })
	c.cfg.Links = links
	c.cfg.RuntimeFacts = RuntimeFacts{TSTLink: true}
	return c
}

func linkCommand(action string, cfg tstruntime.Config) *QueuedCommand {
	cmd := &QueuedCommand{Envelope: Envelope{CommandID: "link-command", ResourceID: cfg.ID, Action: action, Revision: cfg.Generation}}
	if action == ActionApplyLink {
		cmd.Link = &cfg
	}
	return cmd
}

func TestQueuedLinkWireMatchesBackendContract(t *testing.T) {
	c := linkClient(t)
	cfg := passiveLink(t)
	// Decode the actual backend wire shape, rather than constructing only the
	// Go field: a sibling tag drift must fail this boundary test.
	wire, err := json.Marshal(map[string]any{
		"envelope": Envelope{CommandID: "wire-apply", ResourceID: cfg.ID, Revision: cfg.Generation, Action: ActionApplyLink},
		"config":   nil,
		"link":     cfg,
	})
	if err != nil {
		t.Fatal(err)
	}
	var cmd QueuedCommand
	if err := json.Unmarshal(wire, &cmd); err != nil {
		t.Fatal(err)
	}
	if cmd.Link == nil || cmd.Config != nil {
		t.Fatal("backend sibling link was not decoded")
	}
	if ack := c.execute(context.Background(), &cmd); !ack.OK {
		t.Fatalf("wire apply: %+v", ack)
	}
	encoded, err := json.Marshal(cmd)
	if err != nil {
		t.Fatal(err)
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(encoded, &fields); err != nil || fields["link"] == nil {
		t.Fatalf("wire encode: %s %v", encoded, err)
	}
	removeWire, err := json.Marshal(map[string]any{"envelope": Envelope{CommandID: "wire-remove", ResourceID: cfg.ID, Revision: cfg.Generation, Action: ActionRemoveLink}})
	if err != nil {
		t.Fatal(err)
	}
	var remove QueuedCommand
	if err := json.Unmarshal(removeWire, &remove); err != nil {
		t.Fatal(err)
	}
	if ack := c.execute(context.Background(), &remove); !ack.OK {
		t.Fatalf("wire remove: %+v", ack)
	}
}

func TestLinkActionsPassiveApplyEnvelopeOnlyRemoveAndFence(t *testing.T) {
	c := linkClient(t)
	cfg := passiveLink(t)
	ack := c.execute(context.Background(), linkCommand(ActionApplyLink, cfg))
	if !ack.OK || ack.LinkObservation == nil || ack.LinkObservation.State != "passive" || ack.LinkObservation.Ready || ack.AppliedRevision == nil || *ack.AppliedRevision != 1 {
		t.Fatalf("passive: %+v", ack)
	}
	ack = c.execute(context.Background(), linkCommand(ActionRemoveLink, cfg))
	if !ack.OK || ack.LinkObservation.State != "removed" {
		t.Fatalf("remove without sibling: %+v", ack)
	}
	ack = c.execute(context.Background(), linkCommand(ActionApplyLink, cfg))
	if ack.OK || ack.ErrorCode != "stale_generation" {
		t.Fatalf("resurrection: %+v", ack)
	}
	cfg.Generation = 2
	ack = c.execute(context.Background(), linkCommand(ActionApplyLink, cfg))
	if !ack.OK {
		t.Fatal(ack)
	}
	cfg.Generation = 1
	ack = c.execute(context.Background(), linkCommand(ActionRemoveLink, cfg))
	if ack.ErrorCode != "stale_generation" {
		t.Fatalf("stale remove: %+v", ack)
	}
}

func TestLinkMutationReportsActualStateBeforeAcknowledgement(t *testing.T) {
	c := linkClient(t)
	var states []string
	r := reporter.New(reporter.Config{PanelURL: "http://panel.invalid", Credential: "fixture"},
		reporter.WithLinkPlacements(c.cfg.Links.Status),
		reporter.WithPost(func(_ context.Context, _ string, body []byte, _ map[string]string) error {
			var payload struct {
				Placements []reporter.LinkPlacement `json:"link_placements"`
			}
			if err := json.Unmarshal(body, &payload); err != nil {
				return err
			}
			if len(payload.Placements) != 1 {
				t.Fatalf("expected current placement facts: %s", body)
			}
			states = append(states, payload.Placements[0].State)
			return nil
		}),
	)
	c.cfg.ReportLinkState = r.ReportOnce
	cfg := passiveLink(t)
	if ack := c.execute(context.Background(), linkCommand(ActionApplyLink, cfg)); !ack.OK {
		t.Fatal(ack)
	}
	if len(states) != 1 || states[0] != "passive" {
		t.Fatalf("apply ACK preceded actual report: %v", states)
	}
	if ack := c.execute(context.Background(), linkCommand(ActionRemoveLink, cfg)); !ack.OK {
		t.Fatal(ack)
	}
	if len(states) != 2 || states[1] != "removed" {
		t.Fatalf("remove ACK preceded actual report: %v", states)
	}
	if ack := c.execute(context.Background(), linkCommand(ActionApplyLink, cfg)); ack.OK {
		t.Fatal("stale generation accepted")
	}
	if len(states) != 2 {
		t.Fatal("rejected mutation triggered a success report")
	}
	// Losing telemetry must not misrepresent a completed runtime change as a
	// failed apply. Existing panel facts remain conservative until refreshed.
	c.cfg.ReportLinkState = func(context.Context) error { return errors.New("offline fixture") }
	cfg.Generation++
	if ack := c.execute(context.Background(), linkCommand(ActionApplyLink, cfg)); !ack.OK || ack.LinkObservation.State != "passive" {
		t.Fatalf("telemetry changed runtime outcome: %+v", ack)
	}
}

func TestLinkAdmissionAndNoLegacyLKGSecrets(t *testing.T) {
	for _, tc := range []struct {
		name   string
		mutate func(*QueuedCommand)
		code   string
	}{
		{"resource", func(c *QueuedCommand) { c.Envelope.ResourceID = "another" }, "resource_mismatch"},
		{"generation", func(c *QueuedCommand) { c.Envelope.Revision = 2 }, "revision_mismatch"},
		{"wrong node", func(c *QueuedCommand) { c.Link.NodeID = 8 }, "node_mismatch"},
		{"legacy config", func(c *QueuedCommand) { c.Config = &configStub }, "invalid_payload"},
		{"missing sibling", func(c *QueuedCommand) { c.Link = nil }, "invalid_payload"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c := linkClient(t)
			cmd := linkCommand(ActionApplyLink, passiveLink(t))
			tc.mutate(cmd)
			ack := c.execute(context.Background(), cmd)
			if ack.OK || ack.ErrorCode != tc.code || len(c.cfg.Links.Status()) != 0 || c.tunnels.Len() != 0 {
				t.Fatalf("admission: %+v", ack)
			}
		})
	}
	c := linkClient(t)
	cfg := passiveLink(t)
	if ack := c.execute(context.Background(), linkCommand(ActionApplyLink, cfg)); !ack.OK {
		t.Fatal(ack)
	}
	cfg.Generation++
	cfg.WorkspaceID++
	if ack := c.execute(context.Background(), linkCommand(ActionApplyLink, cfg)); ack.ErrorCode != "identity_mismatch" {
		t.Fatal(ack)
	}
	data, _ := json.Marshal(restore.SnapshotOf(c.tunnels, "v1"))
	if strings.Contains(string(data), "transport_config") || strings.Contains(string(data), cfg.ID) {
		t.Fatal("Link in legacy LKG")
	}
	c.cfg.RuntimeFacts = RuntimeFacts{}
	if ack := c.execute(context.Background(), linkCommand(ActionRemoveLink, cfg)); ack.ErrorCode != "unsupported_action" {
		t.Fatal(ack)
	}
}

func TestTSTCapabilitiesRequireRuntimeFacts(t *testing.T) {
	for _, facts := range []RuntimeFacts{{}, {TSTLink: true}, {TrafficRotation: true}, {PolicyRuntime: true, TrafficRotation: true}} {
		if slices.Contains(Capabilities(facts), CapabilityTrafficRotation) {
			t.Fatal("unconstructed or legacy TST advertises epoch rotation", facts)
		}
	}
	if !slices.Contains(Capabilities(RuntimeFacts{TSTLink: true, TrafficRotation: true}), CapabilityTrafficRotation) {
		t.Fatal("negotiated TST omits epoch rotation")
	}
	if !slices.Contains(Capabilities(RuntimeFacts{PolicyRuntime: true}), CapabilityRuntimePolicy) || slices.Contains(Capabilities(RuntimeFacts{PolicyRuntime: true}), CapabilityTSTLink) {
		t.Fatal("native policy runtime must advertise independently of optional TST")
	}
	for _, cap := range []string{ActionApplyLink, ActionRemoveLink, ActionDiagnoseLink, CapabilityTSTLink, CapabilityRuntimePolicy} {
		if slices.Contains(Capabilities(), cap) || slices.Contains(Capabilities(RuntimeFacts{}), cap) {
			t.Fatalf("default advertises %s", cap)
		}
		if !slices.Contains(Capabilities(RuntimeFacts{TSTLink: true}), cap) {
			t.Fatalf("wired runtime omits %s", cap)
		}
	}
	if Implements(ActionApplyLink) || !Implements(ActionApplyLink, RuntimeFacts{TSTLink: true}) {
		t.Fatal("action gate drift")
	}
	t.Setenv("TUNEX_TST_ENABLED", "false")

	m, facts, err := NewLinkRuntime(t.TempDir(), "agent", manager.NewTunnelManager(manager.NewEgressManager(), "127.0.0.1"))
	if err != nil || m != nil || facts.TSTLink {
		t.Fatalf("disabled: %v %+v", err, facts)
	}
	t.Setenv("TUNEX_TST_ENABLED", "true")
	m, facts, err = NewLinkRuntime(t.TempDir(), "agent", nil)
	if err == nil || m != nil || facts.TSTLink {
		t.Fatal("missing executable advertised")
	}
}

func TestLinkRestoreFallbackOnlyOnOutage(t *testing.T) {
	c := linkClient(t)
	for _, tc := range []struct {
		status int
		body   string
		want   error
		cached bool
	}{
		{503, `{}`, nil, true}, {401, `{}`, tstruntime.ErrPanelUnauthorized, false},
		{200, `{"data":{"snapshot":{"tunnels":[]}}}`, tstruntime.ErrSnapshot, false},
		{200, `{"data":{"snapshot":{"node_db_id":7,"links":[]}}}`, nil, false},
	} {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(tc.status); w.Write([]byte(tc.body)) }))
		cached, err := RestoreLinks(context.Background(), tstruntime.HTTPSource{PanelURL: srv.URL, Credential: "credential", AgentID: "agent-uuid-identity"}, c.cfg.Links)
		srv.Close()
		if cached != tc.cached || !errors.Is(err, tc.want) {
			t.Fatalf("status=%d cached=%v error=%v", tc.status, cached, err)
		}
	}
}

func TestTSTDiagnosisControlRejectsForeignPayloadAndStaleAuthorization(t *testing.T) {
	c := linkClient(t)
	cfg := passiveLink(t)
	if ack := c.execute(context.Background(), linkCommand(ActionApplyLink, cfg)); !ack.OK {
		t.Fatal(ack)
	}
	cmd := &QueuedCommand{Envelope: Envelope{CommandID: "tst-probe", ResourceID: cfg.ID, Action: ActionDiagnoseLink, Revision: 1}, LinkProbe: &tstruntime.ProbeRequest{ForwardID: 101, Revision: 1}}
	if ack := c.execute(context.Background(), cmd); ack.OK || ack.ErrorCode != "identity_mismatch" {
		t.Fatal("ingress target authorized", ack)
	}
	cmd.Probe = &diag.Request{}
	if ack := c.execute(context.Background(), cmd); ack.ErrorCode != "invalid_payload" {
		t.Fatal(ack)
	}
	cmd.Probe = nil
	c.cfg.RuntimeFacts = RuntimeFacts{}
	if ack := c.execute(context.Background(), cmd); ack.ErrorCode != "unsupported_action" {
		t.Fatal(ack)
	}
	cmd.Envelope.Action = ActionCollectDiagnostics
	if ack := c.execute(context.Background(), cmd); ack.ErrorCode != "invalid_payload" {
		t.Fatal("foreign sibling accepted", ack)
	}
}
