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
	ProtocolVersion       uint64  `json:"protocolVersion"`
	NodeID                string  `json:"nodeId"`
	Journal               Journal `json:"journal"`
	ExecutionExtension    *uint64 `json:"executionExtension,omitempty"`
	ImportedTransitDigest string  `json:"importedTransitDigest,omitempty"`
}
