package state

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"sync"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/payloadbudget"
)

func nativePayloadFixture(t *testing.T) (string, []byte, adp3.Snapshot, RuntimeJournal, payloadbudget.Policy) {
	t.Helper()
	snapshot := runtimeFixture(t)
	limit := uint64(100)
	bucket := adp3.ResourceLimitBucket{BucketId: "shared-bucket", ScopeId: "scope", ActorId: "actor", NodeId: snapshot.NodeId, Revision: 1, StartsAt: "2026-01-01T00:00:00.000Z", EndsAt: "2027-01-01T00:00:00.000Z", BurstBytes: 65536, ByteLimit: &limit, AssignmentIds: []string{snapshot.Assignments[0].AssignmentId}}
	snapshot.ResourceLimits = &adp3.ResourceLimits{Version: 1, Buckets: []adp3.ResourceLimitBucket{bucket}}
	resign(t, &snapshot)
	path := filepath.Join(t.TempDir(), "runtime.json")
	key := bytes.Repeat([]byte{43}, 32)
	if err := InitializeRuntimeJournal(path, key, snapshot.NodeId); err != nil {
		t.Fatal(err)
	}
	current, err := LoadRuntimeJournal(path, key, snapshot.NodeId)
	if err != nil {
		t.Fatal(err)
	}
	current, err = AcceptRuntimeSnapshot(path, key, current, snapshot)
	if err != nil {
		t.Fatal(err)
	}
	policy, err := RuntimeResourcePolicy(bucket)
	if err != nil {
		t.Fatal(err)
	}
	return path, key, snapshot, current, policy
}

func TestNativePayloadJournalDebitSurvivesReloadSnapshotRemovalAndExecutionUpgrade(t *testing.T) {
	path, key, snapshot, cached, policy := nativePayloadFixture(t)
	if record, err := PrechargeRuntimePayload(context.Background(), path, key, snapshot.NodeId, policy, 17, policy.StartsAt+1000); err != nil || record.Consumed != 17 {
		t.Fatal(record, err)
	}
	loaded, err := LoadRuntimeJournal(path, key, snapshot.NodeId)
	if err != nil || loaded.ResourceBudgets.Buckets[policy.BucketID].Consumed != 17 {
		t.Fatal(loaded, err)
	}
	if cached.ResourceBudgets.Buckets[policy.BucketID].Consumed != 0 {
		t.Fatal("debit mutated Runner cache")
	}
	removed := snapshot
	removed.ResourceLimits = nil
	removed.SnapshotGeneration++
	resign(t, &removed)
	accepted, err := AcceptRuntimeSnapshot(path, key, cached, removed)
	if err != nil || accepted.ResourceBudgets.Buckets[policy.BucketID].Consumed != 17 {
		t.Fatal("Snapshot lost concurrent debit", accepted, err)
	}
	upgraded, err := EnableRuntimeExecution(path, key, snapshot.NodeId, "")
	if err != nil || upgraded.ResourceBudgets.Buckets[policy.BucketID].Consumed != 17 || !reflect.DeepEqual(upgraded.Journal.Fences, accepted.Journal.Fences) || !reflect.DeepEqual(upgraded.Journal.Retired, accepted.Journal.Retired) {
		t.Fatal("execution migration cleared quota or fences", upgraded, err)
	}
	// Removing the policy never refunds a draining instance's original bucket.
	if record, err := PrechargeRuntimePayload(context.Background(), path, key, snapshot.NodeId, policy, 3, policy.StartsAt+1000); err != nil || record.Consumed != 20 {
		t.Fatal(record, err)
	}
	before, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := InitializeRuntimeJournal(path, key, snapshot.NodeId); err == nil {
		t.Fatal("quota journal reinitialized")
	}
	after, err := os.ReadFile(path)
	if err != nil || !bytes.Equal(before, after) {
		t.Fatal("failed initialization changed protected quota", err)
	}
}

func TestNativePayloadSnapshotAndConcurrentDebitsShareOriginalFileLock(t *testing.T) {
	path, key, snapshot, cached, policy := nativePayloadFixture(t)
	snapshot.SnapshotGeneration++
	resign(t, &snapshot)
	var workers sync.WaitGroup
	for index := 0; index < 20; index++ {
		workers.Add(1)
		go func() {
			defer workers.Done()
			if _, err := PrechargeRuntimePayload(context.Background(), path, key, snapshot.NodeId, policy, 1, policy.StartsAt+1000); err != nil {
				t.Error(err)
			}
		}()
	}
	workers.Add(1)
	go func() {
		defer workers.Done()
		if _, err := AcceptRuntimeSnapshot(path, key, cached, snapshot); err != nil {
			t.Error(err)
		}
	}()
	workers.Wait()
	loaded, err := LoadRuntimeJournal(path, key, snapshot.NodeId)
	if err != nil || loaded.Journal.Generation != snapshot.SnapshotGeneration || loaded.ResourceBudgets.Buckets[policy.BucketID].Consumed != 20 {
		t.Fatal("concurrent native writers lost state", loaded, err)
	}
}

func TestNativePayloadLoaderRejectsClosedHistoryCorruptionWithoutHistoryReset(t *testing.T) {
	for _, kind := range []string{"missing-history", "empty-history", "missing-consumed", "unknown-field", "foreign-node", "overflow"} {
		t.Run(kind, func(t *testing.T) {
			path, key, snapshot, current, policy := nativePayloadFixture(t)
			raw, err := json.Marshal(current)
			if err != nil {
				t.Fatal(err)
			}
			var root map[string]json.RawMessage
			if err := json.Unmarshal(raw, &root); err != nil {
				t.Fatal(err)
			}
			var history map[string]json.RawMessage
			if err := json.Unmarshal(root["resourceBudgets"], &history); err != nil {
				t.Fatal(err)
			}
			var buckets map[string]json.RawMessage
			if err := json.Unmarshal(history["buckets"], &buckets); err != nil {
				t.Fatal(err)
			}
			var record map[string]json.RawMessage
			if err := json.Unmarshal(buckets[policy.BucketID], &record); err != nil {
				t.Fatal(err)
			}
			switch kind {
			case "missing-history":
				delete(root, "resourceBudgets")
			case "empty-history":
				history["buckets"] = json.RawMessage(`{}`)
			case "missing-consumed":
				delete(record, "consumed")
			case "unknown-field":
				record["refunded"] = json.RawMessage(`0`)
			case "foreign-node":
				record["nodeId"] = json.RawMessage(`"foreign"`)
			case "overflow":
				record["consumed"] = json.RawMessage(`9007199254740992`)
			}
			if kind != "missing-history" {
				if kind != "empty-history" {
					buckets[policy.BucketID], err = json.Marshal(record)
					if err != nil {
						t.Fatal(err)
					}
					history["buckets"], err = json.Marshal(buckets)
					if err != nil {
						t.Fatal(err)
					}
				}
				root["resourceBudgets"], err = json.Marshal(history)
				if err != nil {
					t.Fatal(err)
				}
			}
			raw, err = json.Marshal(root)
			if err != nil {
				t.Fatal(err)
			}
			if err := Save(path, key, Journal{Snapshot: raw, Generation: current.Journal.Generation, Digest: current.Journal.Digest, Fences: current.Journal.Fences, Retired: current.Journal.Retired}); err != nil {
				t.Fatal(err)
			}
			before, err := os.ReadFile(path)
			if err != nil {
				t.Fatal(err)
			}
			if _, err := LoadRuntimeJournal(path, key, snapshot.NodeId); err == nil {
				t.Fatal("corrupt quota accepted")
			}
			if _, err := EnableRuntimeExecution(path, key, snapshot.NodeId, ""); err == nil {
				t.Fatal("migration reset corrupt quota")
			}
			after, err := os.ReadFile(path)
			if err != nil || !bytes.Equal(before, after) {
				t.Fatal("refusal rewrote corrupt protected history", err)
			}
		})
	}
}

func TestNativePayloadInspectionUsesExactDecimalAndRemainsReadOnly(t *testing.T) {
	path, key, snapshot, current, policy := nativePayloadFixture(t)
	first := current.ResourceBudgets.Buckets[policy.BucketID]
	first.Consumed = payloadbudget.MaxCounter
	current.ResourceBudgets.Buckets[policy.BucketID] = first
	second := first
	second.BucketID = "other-bucket"
	second.ActorID = "other-actor"
	current.ResourceBudgets.Buckets[second.BucketID] = second
	if err := saveRuntimeJournal(path, key, current); err != nil {
		t.Fatal(err)
	}
	before, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	inspection, err := InspectRuntimeJournal(path, key, snapshot.NodeId)
	if err != nil || inspection.Version != 2 || inspection.ResourceBudgetVersion != 1 || inspection.ResourceBudgetBuckets != 2 || inspection.PrechargedBytes != "18014398509481982" {
		t.Fatal(inspection, err)
	}
	after, err := os.ReadFile(path)
	if err != nil || !bytes.Equal(before, after) {
		t.Fatal("inspection mutated quota", err)
	}
	encoded, err := json.Marshal(inspection)
	if err != nil {
		t.Fatal(err)
	}
	for _, secret := range []string{policy.BucketID, policy.ActorID, policy.ScopeID, `"resourceBudgets"`, `"consumed"`} {
		if bytes.Contains(encoded, []byte(secret)) {
			t.Fatal("inspection leaked protected bucket identities", string(encoded))
		}
	}
}

func TestNativePayloadCanonicalMillisecondsAndSnapshotDigestCoverPolicy(t *testing.T) {
	_, _, snapshot, _, _ := nativePayloadFixture(t)
	bucket := snapshot.ResourceLimits.Buckets[0]
	for _, value := range []string{"2026-01-01T00:00:00Z", "2026-01-01T00:00:00.000000Z", "2026-01-01T00:00:00.0001Z", "2026-01-01T01:00:00.000+01:00"} {
		changed := bucket
		changed.StartsAt = value
		if _, err := RuntimeResourcePolicy(changed); err == nil {
			t.Fatal("distinct signed period collapsed", value)
		}
	}
	policy, err := RuntimeResourcePolicy(bucket)
	if err != nil || policy.StartsAt != time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC).UnixMilli() {
		t.Fatal(policy, err)
	}
	changed := snapshot
	changed.ResourceLimits = &adp3.ResourceLimits{Version: 1, Buckets: append([]adp3.ResourceLimitBucket(nil), snapshot.ResourceLimits.Buckets...)}
	changed.ResourceLimits.Buckets[0].BurstBytes--
	encoded, err := json.Marshal(changed)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := adp3.Parse("Snapshot", encoded); err == nil {
		t.Fatal("limit policy changed without changing original Snapshot digest")
	}
}
