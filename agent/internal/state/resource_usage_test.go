package state

import (
	"context"
	"testing"
)

func TestResourceUsageReadsDurableDebitsNotCachedSnapshotAndNeverMutatesJournal(t *testing.T) {
	path, key, _, cached, policy := nativePayloadFixture(t)
	if _, err := PrechargeRuntimePayload(context.Background(), path, key, policy.NodeID, policy, 17, policy.StartsAt+1); err != nil { t.Fatal(err) }
	generation, rows, err := ReadRuntimePayloadUsage(path, key, policy.NodeID)
	if err != nil || generation != cached.Journal.Generation || len(rows) != 1 || rows[0].Consumed != 17 { t.Fatal(generation, rows, err) }
	rows[0].Consumed = 0
	_, durable, err := ReadRuntimePayloadUsage(path, key, policy.NodeID)
	if err != nil || durable[0].Consumed != 17 { t.Fatal(durable, err) }
	if _, _, err := ReadRuntimePayloadUsage(path, key, "foreign"); err == nil { t.Fatal("foreign journal accepted") }
}
