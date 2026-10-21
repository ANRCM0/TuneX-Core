package executionstate

import (
	"context"
	"fmt"
	"maps"

	"github.com/tunex/vnext/agent/internal/payloadbudget"
)

// Precharge reloads, debits and saves the original authenticated record while
// holding the same lock used by Accept and native journal migrations.
func (host RuntimeHost) Precharge(ctx context.Context, node string, policy payloadbudget.Policy, count uint64, at int64) (payloadbudget.Record, error) {
	if host.Store == nil || node != policy.NodeID {
		return payloadbudget.Record{}, fmt.Errorf("INTEGRITY_FAILURE: Runtime payload store/binding required")
	}
	if err := ctx.Err(); err != nil {
		return payloadbudget.Record{}, err
	}
	release, err := host.Store.AcquireLock()
	if err != nil {
		return payloadbudget.Record{}, err
	}
	defer release()
	if err := ctx.Err(); err != nil {
		return payloadbudget.Record{}, err
	}
	durable, err := host.Store.Load(node)
	if err != nil {
		return payloadbudget.Record{}, err
	}
	if durable.NodeID != node {
		return payloadbudget.Record{}, fmt.Errorf("INTEGRITY_FAILURE: Payload journal identity differs")
	}
	if err := payloadbudget.ValidateHistory(durable.ResourceBudgets, node); err != nil {
		return payloadbudget.Record{}, err
	}
	record, err := payloadbudget.Debit(durable.ResourceBudgets, policy, count, at)
	if err != nil {
		return record, err
	}
	if count == 0 {
		return record, nil
	}
	next := *durable.ResourceBudgets
	next.Buckets = maps.Clone(next.Buckets)
	next.Buckets[policy.BucketID] = record
	durable.ResourceBudgets = &next
	if err := host.Store.Save(durable); err != nil {
		return payloadbudget.Record{}, fmt.Errorf("PERSISTENCE_FAILURE: %w", err)
	}
	return record, nil
}
