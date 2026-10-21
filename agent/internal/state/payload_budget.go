package state

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/tunex/vnext/agent/internal/executionstate"
	"github.com/tunex/vnext/agent/internal/payloadbudget"
)

func PrechargeRuntimePayload(ctx context.Context, path string, key []byte, node string, policy payloadbudget.Policy, count uint64, at int64) (payloadbudget.Record, error) {
	host := executionstate.RuntimeHost{Store: runtimeFileStore{path: path, key: key}, Codec: runtimeSnapshotCodec{}}
	return host.Precharge(ctx, node, policy, count, at)
}

func validateResourceBudgetEncoding(raw []byte) error {
	var root map[string]json.RawMessage
	if err := json.Unmarshal(raw, &root); err != nil {
		return err
	}
	value, present := root["resourceBudgets"]
	if !present {
		return nil
	}
	var history map[string]json.RawMessage
	if err := json.Unmarshal(value, &history); err != nil || len(history) != 2 || history["version"] == nil || history["buckets"] == nil {
		return fmt.Errorf("INTEGRITY_FAILURE: Closed protected payload history required")
	}
	var buckets map[string]json.RawMessage
	if err := json.Unmarshal(history["buckets"], &buckets); err != nil || buckets == nil {
		return fmt.Errorf("INTEGRITY_FAILURE: Protected payload buckets required")
	}
	fields := []string{"bucketId", "scopeId", "actorId", "nodeId", "startsAt", "endsAt", "revision", "bytesPerSecond", "burstBytes", "byteLimit", "consumed"}
	for _, rawRecord := range buckets {
		var record map[string]json.RawMessage
		if err := json.Unmarshal(rawRecord, &record); err != nil || len(record) != len(fields) {
			return fmt.Errorf("INTEGRITY_FAILURE: Closed payload debit record required")
		}
		for _, field := range fields {
			if record[field] == nil || field != "bytesPerSecond" && field != "byteLimit" && string(record[field]) == "null" {
				return fmt.Errorf("INTEGRITY_FAILURE: Missing payload debit field")
			}
		}
	}
	return nil
}
