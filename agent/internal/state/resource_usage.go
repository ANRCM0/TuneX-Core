package state

import (
	"fmt"
	"sort"

	"github.com/tunex/vnext/agent/internal/payloadbudget"
)

// ReadRuntimePayloadUsage takes the original Journal lock and authenticates the
// current durable record. The Runner's cached snapshot may predate payload debits.
func ReadRuntimePayloadUsage(path string, key []byte, node string) (uint64, []payloadbudget.Record, error) {
	release, err := acquireRuntimeFileLock(path)
	if err != nil {
		return 0, nil, err
	}
	defer release()
	current, err := LoadRuntimeJournal(path, key, node)
	if err != nil {
		return 0, nil, err
	}
	history := RuntimeJournalFacts(current).ResourceBudgets
	if err := payloadbudget.ValidateHistory(history, node); err != nil {
		return 0, nil, err
	}
	if history == nil {
		return current.Journal.Generation, nil, nil
	}
	if len(history.Buckets) > payloadbudget.MaxBuckets {
		return 0, nil, fmt.Errorf("RESOURCE_LIMIT: Usage projection capacity exceeded")
	}
	records := make([]payloadbudget.Record, 0, len(history.Buckets))
	for _, record := range history.Buckets {
		record.Policy = payloadbudget.ClonePolicy(record.Policy)
		records = append(records, record)
	}
	sort.Slice(records, func(i, j int) bool { return records[i].BucketID < records[j].BucketID })
	return current.Journal.Generation, records, nil
}
