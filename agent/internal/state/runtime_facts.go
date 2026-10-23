package state

import (
	"encoding/json"

	"github.com/tunex/vnext/agent/internal/executionstate"
	"github.com/tunex/vnext/agent/internal/payloadbudget"
)

// Projection retains the original raw backing storage, maps and extension pointer.
func RuntimeJournalFacts(value RuntimeJournal) executionstate.RuntimeJournal {
	return executionstate.RuntimeJournal{
		FormatVersion: value.ProtocolVersion,
		NodeID:        value.NodeID,
		Journal: executionstate.Journal{
			Snapshot:   []byte(value.Journal.Snapshot),
			Generation: value.Journal.Generation,
			Digest:     value.Journal.Digest,
			Fences:     value.Journal.Fences,
			Retired:    value.Journal.Retired,
		},
		ExecutionExtension:    value.ExecutionExtension,
		ImportedHistoryDigest: value.ImportedTransitDigest,
		ResourceBudgets:       resourceBudgetFacts(value.ResourceBudgets),
	}
}

func RuntimeJournalFromFacts(value executionstate.RuntimeJournal) RuntimeJournal {
	return RuntimeJournal{
		ProtocolVersion: value.FormatVersion,
		NodeID:          value.NodeID,
		Journal: Journal{
			Snapshot:   json.RawMessage(value.Journal.Snapshot),
			Generation: value.Journal.Generation,
			Digest:     value.Journal.Digest,
			Fences:     value.Journal.Fences,
			Retired:    value.Journal.Retired,
		},
		ExecutionExtension:    value.ExecutionExtension,
		ImportedTransitDigest: value.ImportedHistoryDigest,
		ResourceBudgets:       resourceBudgetRecords(value.ResourceBudgets),
	}
}

func resourceBudgetFacts(value *ResourceBudgetHistory) *payloadbudget.History {
	if value == nil {
		return nil
	}
	history := &payloadbudget.History{Version: value.Version}
	if value.Buckets != nil {
		history.Buckets = make(map[string]payloadbudget.Record, len(value.Buckets))
	}
	for id, record := range value.Buckets {
		policy := payloadbudget.Policy{Binding: payloadbudget.Binding{BucketID: record.BucketID, ScopeID: record.ScopeID, ActorID: record.ActorID, NodeID: record.NodeID, StartsAt: record.StartsAt, EndsAt: record.EndsAt},
			Revision: record.Revision, BytesPerSecond: record.BytesPerSecond, BurstBytes: record.BurstBytes, ByteLimit: record.ByteLimit}
		history.Buckets[id] = payloadbudget.Record{Policy: payloadbudget.ClonePolicy(policy), Consumed: record.Consumed}
	}
	return history
}

func resourceBudgetRecords(value *payloadbudget.History) *ResourceBudgetHistory {
	if value == nil {
		return nil
	}
	history := &ResourceBudgetHistory{Version: value.Version}
	if value.Buckets != nil {
		history.Buckets = make(map[string]ResourceBudgetRecord, len(value.Buckets))
	}
	for id, record := range value.Buckets {
		policy := payloadbudget.ClonePolicy(record.Policy)
		history.Buckets[id] = ResourceBudgetRecord{BucketID: policy.BucketID, ScopeID: policy.ScopeID, ActorID: policy.ActorID, NodeID: policy.NodeID, StartsAt: policy.StartsAt, EndsAt: policy.EndsAt,
			Revision: policy.Revision, BytesPerSecond: policy.BytesPerSecond, BurstBytes: policy.BurstBytes, ByteLimit: policy.ByteLimit, Consumed: record.Consumed}
	}
	return history
}
