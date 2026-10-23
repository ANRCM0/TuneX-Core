package state

import "encoding/json"

type Journal struct {
	Snapshot   json.RawMessage   `json:"snapshot"`
	Generation uint64            `json:"generation"`
	Digest     string            `json:"digest"`
	Fences     map[string]uint64 `json:"fences"`
	Retired    map[string]uint64 `json:"retired"`
}

type RuntimeJournal struct {
	ProtocolVersion       uint64                 `json:"protocolVersion"`
	NodeID                string                 `json:"nodeId"`
	Journal               Journal                `json:"journal"`
	ExecutionExtension    *uint64                `json:"executionExtension,omitempty"`
	ImportedTransitDigest string                 `json:"importedTransitDigest,omitempty"`
	ResourceBudgets       *ResourceBudgetHistory `json:"resourceBudgets,omitempty"`
}

// Persisted only inside the original authenticated Runtime Journal.
type ResourceBudgetHistory struct {
	Version uint64                          `json:"version"`
	Buckets map[string]ResourceBudgetRecord `json:"buckets"`
}

type ResourceBudgetRecord struct {
	BucketID       string  `json:"bucketId"`
	ScopeID        string  `json:"scopeId"`
	ActorID        string  `json:"actorId"`
	NodeID         string  `json:"nodeId"`
	StartsAt       int64   `json:"startsAt"`
	EndsAt         int64   `json:"endsAt"`
	Revision       uint64  `json:"revision"`
	BytesPerSecond *uint64 `json:"bytesPerSecond"`
	BurstBytes     uint64  `json:"burstBytes"`
	ByteLimit      *uint64 `json:"byteLimit"`
	Consumed       uint64  `json:"consumed"`
}
