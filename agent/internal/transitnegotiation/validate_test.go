package transitnegotiation

import (
	"encoding/json"
	"testing"
)

func encoded(t *testing.T, v any) []byte {
	t.Helper()
	raw, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}
func reply() Response {
	return Response{
		ProtocolVersion: 3, ExtensionVersion: 1, NodeId: "node-b", BootId: "boot-b",
		SessionEpoch: 8, RequiredCapabilities: []string{"adp.multihop.1", "transit.wire.1", "native.transit.v1"},
		ServerTime: "2026-10-15T12:00:00Z", State: "contract-only", ExecutionEnabled: false,
	}
}
func TestTransitNegotiationIsNotExecutable(t *testing.T) {
	req, err := NewRequest("node-b", "boot-b", 8, 0, RequiredCapabilities)
	if err != nil {
		t.Fatal(err)
	}
	ack, err := ParseResponse(encoded(t, reply()))
	if err != nil {
		t.Fatal(err)
	}
	if err = CheckResponse(*req, *ack); err != nil {
		t.Fatal(err)
	}
	if ack.ExecutionEnabled {
		t.Fatal("contract negotiation became execution grant")
	}
}
func TestTransitNegotiationRejectsUnsafeShapesAndDowngrades(t *testing.T) {
	if _, err := NewRequest("node-b", "boot-b", 8, 0, []string{"adp.multihop.1"}); err == nil {
		t.Fatal("incomplete capability negotiation accepted")
	}
	req, err := NewRequest("node-b", "boot-b", 8, 0, RequiredCapabilities)
	if err != nil {
		t.Fatal(err)
	}
	for name, change := range map[string]func(map[string]any){
		"extension":  func(m map[string]any) { m["extensionVersion"] = 2 },
		"unknown":    func(m map[string]any) { m["leaseKey"] = "authority" },
		"grant":      func(m map[string]any) { m["executionEnabled"] = true },
		"wrong role": func(m map[string]any) { m["requiredCapabilities"] = []string{"native.relay.v1"} },
	} {
		t.Run("request "+name, func(t *testing.T) {
			var m map[string]any
			if err := json.Unmarshal(encoded(t, req), &m); err != nil {
				t.Fatal(err)
			}
			change(m)
			if _, err := ParseRequest(encoded(t, m)); err == nil {
				t.Fatal("negotiation mismatch accepted")
			}
		})
	}
	for name, change := range map[string]func(map[string]any){
		"execute":   func(m map[string]any) { m["executionEnabled"] = true },
		"status":    func(m map[string]any) { m["state"] = "active" },
		"unknown":   func(m map[string]any) { m["validUntil"] = "2099-01-01T00:00:00Z" },
		"downgrade": func(m map[string]any) { m["requiredCapabilities"] = []string{"native.relay.v1"} },
	} {
		t.Run("response "+name, func(t *testing.T) {
			var m map[string]any
			if err := json.Unmarshal(encoded(t, reply()), &m); err != nil {
				t.Fatal(err)
			}
			change(m)
			if _, err := ParseResponse(encoded(t, m)); err == nil {
				t.Fatal("unsafe response accepted")
			}
		})
	}
	wrong := reply()
	wrong.SessionEpoch = 9
	if err := CheckResponse(*req, wrong); err == nil {
		t.Fatal("new Session accepted for old Boot")
	}
}
