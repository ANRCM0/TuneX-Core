package state

import (
	"encoding/json"

	"github.com/tunex/vnext/agent/internal/executionstate"
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
	}
}
