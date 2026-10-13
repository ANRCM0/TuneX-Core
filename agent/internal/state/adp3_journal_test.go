package state

import (
	"bytes"
	"encoding/json"
	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/contracts"
	"os"
	"path/filepath"
	"testing"
)

func runtimeFixture(t *testing.T) adp3.Snapshot {
	t.Helper()
	raw, err := os.ReadFile("../../../docs/protocol/fixtures/adp-v3-runtime.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct{ Cases []struct{ Name, Raw string } }
	if err := json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}
	for _, item := range fixture.Cases {
		if item.Name == "relay-egress-udp" {
			value, err := adp3.Parse("Snapshot", []byte(item.Raw))
			if err != nil {
				t.Fatal(err)
			}
			return value.(adp3.Snapshot)
		}
	}
	t.Fatal("fixture absent")
	return adp3.Snapshot{}
}
func resign(t *testing.T, s *adp3.Snapshot) {
	t.Helper()
	raw, _ := json.Marshal(s)
	var value map[string]json.RawMessage
	json.Unmarshal(raw, &value)
	delete(value, "snapshotDigest")
	hash, err := contracts.ComputeDigest(value)
	if err != nil {
		t.Fatal(err)
	}
	s.SnapshotDigest = hash
}
func TestRuntimeJournalPersistsPhysicalTCPForUDPAndRefusesHistoryReset(t *testing.T) {
	path := filepath.Join(t.TempDir(), "runtime.json")
	key := bytes.Repeat([]byte{1}, 32)
	s := runtimeFixture(t)
	if err := InitializeRuntimeJournal(path, key, s.NodeId); err != nil {
		t.Fatal(err)
	}
	current, err := LoadRuntimeJournal(path, key, s.NodeId)
	if err != nil {
		t.Fatal(err)
	}
	next, err := AcceptRuntimeSnapshot(path, key, current, s)
	if err != nil {
		t.Fatal(err)
	}
	if next.Journal.Fences["tcp/32004"] != slotFence(s) {
		t.Fatal("internal UDP TLS fence stored under wrong physical protocol")
	}
	if _, err := AcceptRuntimeSnapshot(path, key, current, s); err == nil {
		t.Fatal("stale caller overwrote advanced durable high-water")
	}
	loaded, err := LoadRuntimeJournal(path, key, s.NodeId)
	if err != nil || loaded.Journal.Generation != s.SnapshotGeneration {
		t.Fatal(err)
	}
	if _, err := LoadRuntimeJournal(path, key, "wrong-node"); err == nil {
		t.Fatal("foreign journal accepted")
	}
	removed := s
	removed.Assignments = []adp3.Assignment{}
	removed.SnapshotGeneration++
	resign(t, &removed)
	retired, err := AcceptRuntimeSnapshot(path, key, loaded, removed)
	if err != nil {
		t.Fatal(err)
	}
	s.SnapshotGeneration = removed.SnapshotGeneration + 1
	resign(t, &s)
	if _, err := AcceptRuntimeSnapshot(path, key, retired, s); err == nil {
		t.Fatal("old fence resurrected")
	}
	s.Assignments[0].BindingFence++
	s.Assignments[0].Driver.Config.Binding.EgressFence = s.Assignments[0].BindingFence
	hash, err := contracts.ComputeDigest(s.Assignments[0].Driver.Config)
	if err != nil {
		t.Fatal(err)
	}
	s.Assignments[0].Driver.ConfigDigest = hash
	resign(t, &s)
	if _, err := AcceptRuntimeSnapshot(path, key, retired, s); err != nil {
		t.Fatal("higher fence refused", err)
	}
	os.Remove(path)
	if _, err := LoadRuntimeJournal(path, key, s.NodeId); err == nil {
		t.Fatal("missing journal reset")
	}
}
func slotFence(s adp3.Snapshot) uint64 { return s.Assignments[0].BindingFence }
func TestRuntimeJournalWriteFailureDoesNotAdvanceCallerHighWater(t *testing.T) {
	s := runtimeFixture(t)
	current := RuntimeJournal{ProtocolVersion: 3, NodeID: s.NodeId, Journal: Journal{Fences: map[string]uint64{}, Retired: map[string]uint64{}}}
	path := filepath.Join(t.TempDir(), "missing", "runtime.json")
	next, err := AcceptRuntimeSnapshot(path, bytes.Repeat([]byte{1}, 32), current, s)
	if err == nil || next.Journal.Generation != 0 || len(current.Journal.Fences) != 0 {
		t.Fatal("failed persistence advanced caller state", err)
	}
}

func TestRuntimeJournalCannotReinitializeOrUseCorruptState(t *testing.T) {
	path := filepath.Join(t.TempDir(), "runtime.json")
	key := bytes.Repeat([]byte{1}, 32)
	if err := InitializeRuntimeJournal(path, key, "node-a"); err != nil {
		t.Fatal(err)
	}
	original, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := InitializeRuntimeJournal(path, key, "node-a"); err == nil {
		t.Fatal("existing journal was reset")
	}
	after, _ := os.ReadFile(path)
	if !bytes.Equal(original, after) {
		t.Fatal("reinitialization changed durable state")
	}
	if err := os.WriteFile(path, []byte(`{"broken":true}`), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadRuntimeJournal(path, key, "node-a"); err == nil {
		t.Fatal("corrupt Runtime journal accepted")
	}
	if err := InitializeRuntimeJournal(path, key, "node-a"); err == nil {
		t.Fatal("corrupt journal replaced")
	}
}
