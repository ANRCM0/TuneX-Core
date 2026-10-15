package state

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/contracts"
)

func executionFixture(t *testing.T) adp3.Snapshot {
	t.Helper()
	raw, err := os.ReadFile("../../../docs/protocol/fixtures/adp-v3-execution.json")
	if err != nil {
		t.Fatal(err)
	}
	var f struct{ Cases []struct{ Name, Raw string } }
	if err = json.Unmarshal(raw, &f); err != nil {
		t.Fatal(err)
	}
	for _, c := range f.Cases {
		if c.Name == "3-node-2" {
			v, err := adp3.Parse("Snapshot", []byte(c.Raw))
			if err != nil {
				t.Fatal(err)
			}
			return v.(adp3.Snapshot)
		}
	}
	t.Fatal("missing execution fixture")
	return adp3.Snapshot{}
}
func TestExecutionMigrationIsExplicitAndRetainsImportedHighWater(t *testing.T) {
	dir := t.TempDir()
	path, oldPath := filepath.Join(dir, "runtime"), filepath.Join(dir, "transit")
	key := bytes.Repeat([]byte{5}, 32)
	if err := InitializeRuntimeJournal(path, key, "node-b"); err != nil {
		t.Fatal(err)
	}
	if err := InitializeTransitJournal(oldPath, key, "node-b"); err != nil {
		t.Fatal(err)
	}
	old, err := LoadTransitJournal(oldPath, key, "node-b")
	if err != nil {
		t.Fatal(err)
	}
	old, err = AcceptTransitSnapshot(oldPath, key, old, transitTestSnapshot(t, 1, true, 9, false))
	if err != nil {
		t.Fatal(err)
	}
	imported, err := EnableRuntimeExecution(path, key, "node-b", oldPath)
	if err != nil {
		t.Fatal(err)
	}
	if imported.ExecutionExtension == nil || imported.ImportedTransitDigest == "" || imported.Journal.Fences["tcp/32100"] != 9 || imported.Journal.Retired["tcp/32100"] != 9 {
		t.Fatal("legacy physical high-water lost")
	}
	loaded, err := LoadRuntimeJournal(path, key, "node-b")
	if err != nil || loaded.Journal.Fences["tcp/32100"] != 9 {
		t.Fatal("restart lost imported history", err)
	}
	if _, err = EnableRuntimeExecution(path, key, "node-b", oldPath); err != nil {
		t.Fatal("idempotent import rejected", err)
	}
	if _, err = AcceptTransitSnapshot(oldPath, key, old, transitTestSnapshot(t, 2, false, 9, true)); err != nil {
		t.Fatal(err)
	}
	if _, err = EnableRuntimeExecution(path, key, "node-b", oldPath); err == nil {
		t.Fatal("changed legacy history silently imported again")
	}
}
func TestMultihopJournalRequiresMigrationAndRejectsCrossRoleOwnerAtSameFence(t *testing.T) {
	s := executionFixture(t)
	path := filepath.Join(t.TempDir(), "runtime")
	key := bytes.Repeat([]byte{7}, 32)
	if err := InitializeRuntimeJournal(path, key, s.NodeId); err != nil {
		t.Fatal(err)
	}
	current, err := LoadRuntimeJournal(path, key, s.NodeId)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = AcceptRuntimeSnapshot(path, key, current, s); err == nil {
		t.Fatal("implicit migration accepted")
	}
	current, err = EnableRuntimeExecution(path, key, s.NodeId, "")
	if err != nil {
		t.Fatal(err)
	}
	current, err = AcceptRuntimeSnapshot(path, key, current, s)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = AcceptRuntimeSnapshot(path, key, current, s); err != nil {
		t.Fatal("duplicate rejected", err)
	}
	s.SnapshotGeneration++
	a := s.Assignments[0]
	a.Role = "direct"
	a.Driver.Id = "native.direct.v1"
	a.Protocol = "tcp"
	a.Resource.Protocol = "tcp"
	target := adp3.Target{Host: "127.0.0.1", Port: 32002}
	revision := uint64(1)
	allow := false
	cidrs := []string{"127.0.0.0/8"}
	a.Driver.Config = adp3.RuntimeConfig{Target: &target, EgressPolicyRevision: &revision, AllowMetadataTargets: &allow, AllowedDestinationCidrs: &cidrs}
	a.Driver.ConfigDigest, err = contracts.ComputeDigest(a.Driver.Config)
	if err != nil {
		t.Fatal(err)
	}
	s.Assignments = []adp3.Assignment{a}
	resign(t, &s)
	if _, err = AcceptRuntimeSnapshot(path, key, current, s); err == nil {
		t.Fatal("cross-role physical owner reused Fence")
	}
	a.BindingFence++
	s.Assignments = []adp3.Assignment{a}
	resign(t, &s)
	if _, err = AcceptRuntimeSnapshot(path, key, current, s); err != nil {
		t.Fatal("higher physical Fence could not switch role", err)
	}
}
