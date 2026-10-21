package state

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestJournalInspectionDoesNotWriteOrMigrate(t *testing.T) {
	for _, extended := range []bool{false, true} {
		t.Run(map[bool]string{false: "base", true: "extended"}[extended], func(t *testing.T) {
			dir := t.TempDir()
			path := filepath.Join(dir, "journal.json")
			key := bytes.Repeat([]byte{5}, 32)
			if err := InitializeRuntimeJournal(path, key, "node-a"); err != nil {
				t.Fatal(err)
			}
			if extended {
				if _, err := EnableRuntimeExecution(path, key, "node-a", ""); err != nil {
					t.Fatal(err)
				}
			}
			before, _ := os.ReadFile(path)
			entries, _ := os.ReadDir(dir)
			result, err := InspectRuntimeJournal(path, key, "node-a")
			if err != nil {
				t.Fatal(err)
			}
			if result.Version != 2 || result.ResourceBudgetVersion != 0 || result.ResourceBudgetBuckets != 0 || result.PrechargedBytes != "0" || result.ProtocolVersion != 3 || result.NodeID != "node-a" || result.Generation != 0 ||
				(result.ExecutionExtension == 1) != extended || !strings.HasPrefix(result.FileDigest, "sha256:") {
				t.Fatal("unexpected summary", result)
			}
			after, _ := os.ReadFile(path)
			afterEntries, _ := os.ReadDir(dir)
			if !bytes.Equal(before, after) || len(entries) != len(afterEntries) {
				t.Fatal("inspection wrote state or locks")
			}
			raw, _ := json.Marshal(result)
			for _, secret := range []string{`"snapshot":`, `"fences":`, `"retired":`, `"mac":`, `"key":`} {
				if bytes.Contains(raw, []byte(secret)) {
					t.Fatal("summary contains protected material", secret)
				}
			}
		})
	}
}

func TestJournalInspectionRejectsTamperingIdentityAndMissingState(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "journal.json")
	key := bytes.Repeat([]byte{6}, 32)
	if err := InitializeRuntimeJournal(path, key, "node-a"); err != nil {
		t.Fatal(err)
	}
	for _, attempt := range []struct {
		path string
		key  []byte
		node string
	}{
		{path, key, "node-b"},
		{path, bytes.Repeat([]byte{7}, 32), "node-a"},
		{path, key[:31], "node-a"},
		{filepath.Join(dir, "missing"), key, "node-a"},
	} {
		if _, err := InspectRuntimeJournal(attempt.path, attempt.key, attempt.node); err == nil {
			t.Fatal("unsafe inspection accepted")
		}
	}
	raw, _ := os.ReadFile(path)
	if err := os.WriteFile(path, bytes.Replace(raw, []byte(`"node-a"`), []byte(`"node-b"`), 1), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := InspectRuntimeJournal(path, key, "node-b"); err == nil {
		t.Fatal("tampered state accepted")
	}
}

func TestJournalInspectionRetainsImportedPhysicalHighWater(t *testing.T) {
	path := filepath.Join(t.TempDir(), "journal.json")
	key := bytes.Repeat([]byte{8}, 32)
	record := RuntimeJournal{
		ProtocolVersion: 3, NodeID: "node-a",
		Journal: Journal{Snapshot: json.RawMessage("null"), Fences: map[string]uint64{"tcp/32100": 12},
			Retired: map[string]uint64{"tcp/32100": 12}},
		ImportedTransitDigest: "sha256:" + strings.Repeat("a", 64),
	}
	version := uint64(1)
	record.ExecutionExtension = &version
	if err := saveRuntimeJournal(path, key, record); err != nil {
		t.Fatal(err)
	}
	result, err := InspectRuntimeJournal(path, key, "node-a")
	if err != nil || !result.ImportedTransit || result.MaxBindingFence != 12 || result.MaxRetiredFence != 12 {
		t.Fatal("inspection discarded high-water", result, err)
	}
}
