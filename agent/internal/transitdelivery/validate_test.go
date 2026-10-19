package transitdelivery

import (
	"encoding/json"
	"testing"

	"github.com/tunex/vnext/agent/internal/contracts"
)

func encode(t *testing.T, value any) []byte {
	t.Helper()
	raw, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}
func fixture(t *testing.T) map[string]any {
	t.Helper()
	body := map[string]any{
		"protocolVersion": 3, "extensionVersion": 1, "kind": "transit-command-preview-v1",
		"executionEnabled": false, "nodeId": "node-b", "bootId": "boot-b", "sessionEpoch": 8,
		"forwardId": "forward-1", "deploymentGeneration": 4, "coordinationRevision": 1,
		"previewAction": "prepare", "commandDigest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		"issuedAt": "2026-10-15T00:00:00Z", "validUntil": "2026-10-15T00:01:00Z",
	}
	sum, err := contracts.ComputeDigest(body)
	if err != nil {
		t.Fatal(err)
	}
	body["envelopeDigest"] = sum
	return body
}
func TestNonExecutablePreviewAndReceipt(t *testing.T) {
	c, err := ParseCommand(encode(t, fixture(t)))
	if err != nil {
		t.Fatal(err)
	}
	if c.ExecutionEnabled || c.Kind != "transit-command-preview-v1" {
		t.Fatal("preview became executable")
	}
	report := Report{
		ProtocolVersion: 3, ExtensionVersion: 1, Kind: "transit-delivery-report-v1",
		NodeId: c.NodeId, BootId: c.BootId, SessionEpoch: c.SessionEpoch,
		CommandDigest: c.CommandDigest, EnvelopeDigest: c.EnvelopeDigest,
		ReportSequence: 1, ObservedAt: "2026-10-15T00:00:20Z", Condition: "received",
	}
	r, err := ParseReport(encode(t, report))
	if err != nil {
		t.Fatal(err)
	}
	if err = ValidateSession(*c, *r); err != nil {
		t.Fatal(err)
	}
	ack := Ack{
		ProtocolVersion: 3, ExtensionVersion: 1, Kind: "transit-delivery-ack-v1",
		ExecutionEnabled: false, NodeId: c.NodeId, BootId: c.BootId, SessionEpoch: c.SessionEpoch,
		CommandDigest: c.CommandDigest, EnvelopeDigest: c.EnvelopeDigest, ReportSequence: 1,
		Status: "accepted",
	}
	if _, err = ParseAck(encode(t, ack)); err != nil {
		t.Fatal(err)
	}
}
func TestRejectForgedDigestUnknownExecutionAndFakeReady(t *testing.T) {
	for name, mutate := range map[string]func(map[string]any){
		"execution": func(m map[string]any) { m["executionEnabled"] = true },
		"unknown":   func(m map[string]any) { m["driver"] = map[string]any{"id": "native.transit.v1"} },
		"version":   func(m map[string]any) { m["extensionVersion"] = 2 },
		"digest": func(m map[string]any) {
			m["commandDigest"] = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
		},
		"expiry": func(m map[string]any) { m["validUntil"] = m["issuedAt"] },
	} {
		t.Run(name, func(t *testing.T) {
			m := fixture(t)
			mutate(m)
			if _, err := ParseCommand(encode(t, m)); err == nil {
				t.Fatal("unsafe preview accepted")
			}
		})
	}
	r := map[string]any{
		"protocolVersion": 3, "extensionVersion": 1, "kind": "transit-delivery-report-v1",
		"nodeId": "node-b", "bootId": "boot-b", "sessionEpoch": 8,
		"commandDigest":  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		"envelopeDigest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		"reportSequence": 1, "observedAt": "2026-10-15T00:00:20Z", "condition": "ready",
	}
	if _, err := ParseReport(encode(t, r)); err == nil {
		t.Fatal("delivery receipt impersonated Ready")
	}
}
