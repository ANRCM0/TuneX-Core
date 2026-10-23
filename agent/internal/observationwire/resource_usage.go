package observationwire

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/tunex/vnext/agent/internal/payloadbudget"
)

type ResourceUsageBucket struct {
	BucketID string `json:"bucketId"`
	ScopeID string `json:"scopeId"`
	ActorID string `json:"actorId"`
	Revision uint64 `json:"revision"`
	StartsAt string `json:"startsAt"`
	EndsAt string `json:"endsAt"`
	ConsumedBytes string `json:"consumedBytes"`
}
type ResourceUsageReport struct {
	Version uint64 `json:"version"`
	NodeID string `json:"nodeId"`
	BootID string `json:"bootId"`
	SessionEpoch uint64 `json:"sessionEpoch"`
	ReportSequence uint64 `json:"reportSequence"`
	SnapshotGeneration uint64 `json:"snapshotGeneration"`
	Buckets []ResourceUsageBucket `json:"buckets"`
}

func EncodeResourceUsage(node, boot string, epoch, sequence, generation uint64, records []payloadbudget.Record) ([]byte, error) {
	if len(records) > payloadbudget.MaxBuckets || generation == 0 || epoch == 0 || sequence == 0 {
		return nil, fmt.Errorf("INVALID_CONFIG: Bounded accepted resource report required")
	}
	report := ResourceUsageReport{Version: 1, NodeID: node, BootID: boot, SessionEpoch: epoch,
		ReportSequence: sequence, SnapshotGeneration: generation, Buckets: []ResourceUsageBucket{}}
	previous := ""
	for _, record := range records {
		if err := payloadbudget.ValidatePolicy(record.Policy); err != nil { return nil, err }
		if record.NodeID != node || record.BucketID <= previous || record.Consumed > payloadbudget.MaxCounter {
			return nil, fmt.Errorf("INTEGRITY_FAILURE: Usage record binding differs")
		}
		previous = record.BucketID
		report.Buckets = append(report.Buckets, ResourceUsageBucket{BucketID: record.BucketID, ScopeID: record.ScopeID,
			ActorID: record.ActorID, Revision: record.Revision, StartsAt: time.UnixMilli(record.StartsAt).UTC().Format("2006-01-02T15:04:05.000Z"),
			EndsAt: time.UnixMilli(record.EndsAt).UTC().Format("2006-01-02T15:04:05.000Z"), ConsumedBytes: strconv.FormatUint(record.Consumed, 10)})
	}
	raw, err := json.Marshal(report)
	if len(raw) > 524288 { return nil, fmt.Errorf("RESOURCE_LIMIT: Usage report byte capacity exceeded") }
	return raw, err
}
