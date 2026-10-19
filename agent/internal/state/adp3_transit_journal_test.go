package state

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/tunex/vnext/agent/internal/adp3transit"
	"github.com/tunex/vnext/agent/internal/contracts"
)

func transitTestHash(t *testing.T, v any) string {
	t.Helper()
	sum, err := contracts.ComputeDigest(v)
	if err != nil {
		t.Fatal(err)
	}
	return sum
}
func transitTestIntent(t *testing.T) map[string]any {
	t.Helper()
	raw, err := os.ReadFile("../../../docs/protocol/fixtures/transit-v1.json")
	if err != nil {
		t.Fatal(err)
	}
	var vector struct{ Cases []struct{ Name, Raw string } }
	if err = json.Unmarshal(raw, &vector); err != nil {
		t.Fatal(err)
	}
	for _, sample := range vector.Cases {
		if sample.Name == "valid-three-node-transit-udp" {
			var intent map[string]any
			if err = json.Unmarshal([]byte(sample.Raw), &intent); err != nil {
				t.Fatal(err)
			}
			return intent
		}
	}
	t.Fatal("missing Transit fixture")
	return nil
}
func transitTestSnapshot(t *testing.T, generation uint64, withAssignment bool, fence uint64, retire bool) adp3transit.Snapshot {
	t.Helper()
	var assignments []any
	if withAssignment {
		intent := transitTestIntent(t)
		intent["bindingFence"] = fence
		config := map[string]any{"intent": intent}
		assignments = []any{map[string]any{
			"protocolVersion": 3, "extensionVersion": 1, "nodeId": "node-b", "sessionEpoch": 8,
			"assignmentId": "assign-b", "forwardId": "forward-1", "forwardRevision": 2,
			"deploymentGeneration": 4, "bindingFence": fence,
			"role": "relay-transit", "protocol": "udp", "phase": "prepared",
			"resource": map[string]any{"address": "127.0.0.1", "port": 32100, "protocol": "tcp"},
			"driver": map[string]any{"id": "native.transit.v1", "schemaVersion": 1,
				"configDigest": transitTestHash(t, config), "config": config},
			"drainTimeoutSeconds": 30,
		}}
	} else {
		assignments = []any{}
	}
	tombstones := []any{}
	if retire {
		tombstones = append(tombstones, map[string]any{
			"assignmentId": "retired-b", "forwardId": "forward-1", "role": "relay-transit",
			"protocol": "udp", "physicalProtocol": "tcp", "port": 32100, "bindingFence": fence,
			"retirementGeneration": generation,
		})
	}
	body := map[string]any{
		"protocolVersion": 3, "extensionVersion": 1, "kind": "transit-snapshot",
		"requiredCapabilities": []string{"adp.multihop.1", "transit.wire.1", "native.transit.v1"},
		"nodeId":               "node-b", "sessionEpoch": 8, "snapshotGeneration": generation, "complete": true,
		"issuedAt": "2026-10-15T00:00:00Z", "validUntil": "2026-10-15T00:04:00Z",
		"assignments": assignments, "tombstones": tombstones,
	}
	body["snapshotDigest"] = transitTestHash(t, body)
	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	snapshot, err := adp3transit.ParseSnapshot(raw)
	if err != nil {
		t.Fatal(err)
	}
	return *snapshot
}
func TestTransitJournalPersistenceRetirementAndReplay(t *testing.T) {
	path := filepath.Join(t.TempDir(), "transit.journal")
	key := bytes.Repeat([]byte{6}, 32)
	if err := InitializeTransitJournal(path, key, "node-b"); err != nil {
		t.Fatal(err)
	}
	if err := InitializeTransitJournal(path, key, "node-b"); err == nil {
		t.Fatal("implicit reinitialization accepted")
	}
	initial, err := LoadTransitJournal(path, key, "node-b")
	if err != nil {
		t.Fatal(err)
	}
	first := transitTestSnapshot(t, 10, true, 9, false)
	stored, err := AcceptTransitSnapshot(path, key, initial, first)
	if err != nil {
		t.Fatal(err)
	}
	if stored.Generation != 10 || stored.Fences["tcp/32100"] != 9 {
		t.Fatal("lost durable Transit owner")
	}
	disk, err := LoadTransitJournal(path, key, "node-b")
	if err != nil || disk.Digest != stored.Digest {
		t.Fatalf("lost retained Transit journal: %v", err)
	}
	if _, err = AcceptTransitSnapshot(path, key, initial, first); err == nil {
		t.Fatal("stale writer accepted")
	}
	if _, err = AcceptTransitSnapshot(path, key, disk, transitTestSnapshot(t, 9, true, 9, false)); err == nil {
		t.Fatal("generation rollback accepted")
	}
	// An unrelated logical assignment must never inherit a port at the same Fence.
	takeover := transitTestSnapshot(t, 11, true, 9, false)
	encoded, err := json.Marshal(takeover)
	if err != nil {
		t.Fatal(err)
	}
	var candidate map[string]any
	if err = json.Unmarshal(encoded, &candidate); err != nil {
		t.Fatal(err)
	}
	a := candidate["assignments"].([]any)[0].(map[string]any)
	a["assignmentId"] = "assign-foreign"
	config := a["driver"].(map[string]any)["config"].(map[string]any)
	config["intent"].(map[string]any)["assignmentId"] = "assign-foreign"
	a["driver"].(map[string]any)["configDigest"] = transitTestHash(t, config)
	delete(candidate, "snapshotDigest")
	candidate["snapshotDigest"] = transitTestHash(t, candidate)
	encoded, err = json.Marshal(candidate)
	if err != nil {
		t.Fatal(err)
	}
	forged, err := adp3transit.ParseSnapshot(encoded)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = AcceptTransitSnapshot(path, key, disk, *forged); err == nil {
		t.Fatal("different port owner inherited existing binding Fence")
	}
	removed := transitTestSnapshot(t, 11, false, 9, true)
	disk, err = AcceptTransitSnapshot(path, key, disk, removed)
	if err != nil {
		t.Fatal(err)
	}
	if disk.Retired["tcp/32100"] != 9 {
		t.Fatal("retired physical Fence not persisted")
	}
	if _, err = AcceptTransitSnapshot(path, key, disk, transitTestSnapshot(t, 12, true, 9, false)); err == nil {
		t.Fatal("retired Fence resurrected")
	}
	replacement := transitTestSnapshot(t, 12, true, 10, false)
	disk, err = AcceptTransitSnapshot(path, key, disk, replacement)
	if err != nil {
		t.Fatal(err)
	}
	if disk.Fences["tcp/32100"] != 10 {
		t.Fatal("monotonic physical Fence not advanced")
	}
	if _, err = LoadTransitJournal(path, key, "other-node"); err == nil {
		t.Fatal("cross-node journal load accepted")
	}
	if _, err = LoadTransitJournal(path, bytes.Repeat([]byte{7}, 32), "node-b"); err == nil {
		t.Fatal("wrong MAC key accepted")
	}
}
func TestTransitJournalFailsClosedOnCorruptDurableFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "transit.journal")
	key := bytes.Repeat([]byte{2}, 32)
	if err := InitializeTransitJournal(path, key, "node-b"); err != nil {
		t.Fatal(err)
	}
	file, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if len(file) < 8 {
		t.Fatal("unexpected empty journal")
	}
	file[len(file)-4] ^= 1
	if err = os.WriteFile(path, file, 0600); err != nil {
		t.Fatal(err)
	}
	if _, err = LoadTransitJournal(path, key, "node-b"); err == nil {
		t.Fatal("tampered journal unexpectedly accepted")
	}
}
