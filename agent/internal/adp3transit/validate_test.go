package adp3transit

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/contracts"
)

type vector struct {
	Cases []struct {
		Name  string `json:"name"`
		Raw   string `json:"raw"`
		Valid bool   `json:"valid"`
	} `json:"cases"`
}

func baseIntent(t *testing.T) map[string]any {
	t.Helper()
	raw, err := os.ReadFile("../../../docs/protocol/fixtures/transit-v1.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture vector
	if err = json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}
	for _, v := range fixture.Cases {
		if v.Name == "valid-three-node-transit-udp" {
			var intent map[string]any
			if err = json.Unmarshal([]byte(v.Raw), &intent); err != nil {
				t.Fatal(err)
			}
			return intent
		}
	}
	t.Fatal("missing shared Transit v1 fixture")
	return nil
}
func encode(t *testing.T, value any) []byte {
	t.Helper()
	raw, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}
func hash(t *testing.T, body any) string {
	t.Helper()
	sum, err := contracts.ComputeDigest(body)
	if err != nil {
		t.Fatal(err)
	}
	return sum
}
func baseAssignment(t *testing.T) map[string]any {
	t.Helper()
	intent := baseIntent(t)
	config := map[string]any{"intent": intent}
	return map[string]any{
		"protocolVersion": 3, "extensionVersion": 1,
		"nodeId": intent["nodeId"], "sessionEpoch": intent["sessionEpoch"],
		"assignmentId": intent["assignmentId"], "forwardId": intent["forwardId"],
		"forwardRevision": intent["forwardRevision"], "deploymentGeneration": intent["deploymentGeneration"],
		"bindingFence": intent["bindingFence"], "role": "relay-transit", "protocol": "udp", "phase": "prepared",
		"resource":            map[string]any{"address": "127.0.0.1", "port": 32100, "protocol": "tcp"},
		"driver":              map[string]any{"id": "native.transit.v1", "schemaVersion": 1, "configDigest": hash(t, config), "config": config},
		"drainTimeoutSeconds": 30,
	}
}
func baseSnapshot(t *testing.T) map[string]any {
	t.Helper()
	snapshot := map[string]any{
		"protocolVersion": 3, "extensionVersion": 1, "kind": "transit-snapshot",
		"requiredCapabilities": []string{"adp.multihop.1", "transit.wire.1", "native.transit.v1"},
		"nodeId":               "node-b", "sessionEpoch": 8, "snapshotGeneration": 10, "complete": true,
		"issuedAt": "2026-10-15T00:00:00Z", "validUntil": "2026-10-15T00:04:00Z",
		"assignments": []any{baseAssignment(t)}, "tombstones": []any{},
	}
	seal(t, snapshot)
	return snapshot
}
func seal(t *testing.T, s map[string]any) {
	t.Helper()
	delete(s, "snapshotDigest")
	s["snapshotDigest"] = hash(t, s)
}
func checkFailure(t *testing.T, s map[string]any) {
	t.Helper()
	seal(t, s)
	if _, err := ParseSnapshot(encode(t, s)); err == nil {
		t.Fatal("expected Transit snapshot rejection")
	}
}
func TestOfflineTransitADP3Envelope(t *testing.T) {
	a, err := ParseAssignment(encode(t, baseAssignment(t)))
	if err != nil {
		t.Fatal(err)
	}
	if a.Protocol != "udp" || a.Resource.Protocol != "tcp" || a.BindingFence != 9 {
		t.Fatalf("unexpected typed binding: %+v", a)
	}
	s := baseSnapshot(t)
	if _, err = ParseSnapshot(encode(t, s)); err != nil {
		t.Fatal(err)
	}
	if err = RequireCapabilities([]string{"adp.multihop.1", "transit.wire.1", "native.transit.v1"}); err != nil {
		t.Fatal(err)
	}
	if err = RequireCapabilities([]string{"adp.multihop.1", "native.relay.v1"}); err == nil {
		t.Fatal("capability downgrade accepted")
	}
	if _, err = adp3.Parse("Snapshot", encode(t, s)); err == nil {
		t.Fatal("legacy ADP/3 unexpectedly accepted Transit")
	}
}
func TestTransitADP3RejectsVersionAndBindingDrift(t *testing.T) {
	cases := []struct {
		name   string
		change func(a map[string]any)
	}{
		{"extension", func(a map[string]any) { a["extensionVersion"] = 2 }},
		{"role", func(a map[string]any) { a["role"] = "relay-egress" }},
		{"physical protocol", func(a map[string]any) { a["resource"].(map[string]any)["protocol"] = "udp" }},
		{"physical port", func(a map[string]any) { a["resource"].(map[string]any)["port"] = 32101 }},
		{"session", func(a map[string]any) { a["sessionEpoch"] = 9 }},
		{"fence", func(a map[string]any) { a["bindingFence"] = 10 }},
		{"driver digest", func(a map[string]any) {
			a["driver"].(map[string]any)["configDigest"] = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
		}},
		{"neighbor spoof", func(a map[string]any) {
			a["driver"].(map[string]any)["config"].(map[string]any)["intent"].(map[string]any)["upstream"].(map[string]any)["nodeId"] = "node-b"
		}},
		{"nested extra authority", func(a map[string]any) {
			a["driver"].(map[string]any)["config"].(map[string]any)["intent"].(map[string]any)["unexpectedAuthority"] = true
		}},
	}
	for _, item := range cases {
		t.Run(item.name, func(t *testing.T) {
			s := baseSnapshot(t)
			a := s["assignments"].([]any)[0].(map[string]any)
			item.change(a)
			checkFailure(t, s)
		})
	}
}
func TestTransitADP3RejectsStaleAndConflictingSnapshots(t *testing.T) {
	t.Run("wrong extension", func(t *testing.T) { s := baseSnapshot(t); s["extensionVersion"] = 2; checkFailure(t, s) })
	t.Run("capability mismatch", func(t *testing.T) {
		s := baseSnapshot(t)
		s["requiredCapabilities"] = []string{"native.relay.v1"}
		checkFailure(t, s)
	})
	t.Run("digest corruption", func(t *testing.T) {
		s := baseSnapshot(t)
		s["sessionEpoch"] = 9
		if _, err := ParseSnapshot(encode(t, s)); err == nil {
			t.Fatal("snapshot digest corruption accepted")
		}
	})
	t.Run("session swap", func(t *testing.T) { s := baseSnapshot(t); s["sessionEpoch"] = 9; checkFailure(t, s) })
	t.Run("lease exceeded", func(t *testing.T) { s := baseSnapshot(t); s["validUntil"] = "2026-10-15T00:06:00Z"; checkFailure(t, s) })
	t.Run("duplicate assignment", func(t *testing.T) {
		s := baseSnapshot(t)
		s["assignments"] = []any{baseAssignment(t), baseAssignment(t)}
		checkFailure(t, s)
	})
	t.Run("retired fence resurrected", func(t *testing.T) {
		s := baseSnapshot(t)
		s["tombstones"] = []any{map[string]any{"assignmentId": "old", "forwardId": "forward-1", "role": "relay-transit",
			"protocol": "udp", "physicalProtocol": "tcp", "port": 32100, "bindingFence": 9, "retirementGeneration": 9}}
		checkFailure(t, s)
	})
}
