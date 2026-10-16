package state

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
)

// JournalInspection exports no keys, raw snapshots, endpoints or physical slot maps.
// The caller must retain the original journal and key; this is not a backup.
type JournalInspection struct {
	Version            uint64 `json:"version"`
	NodeID             string `json:"nodeId"`
	ProtocolVersion    uint64 `json:"protocolVersion"`
	ExecutionExtension uint64 `json:"executionExtension"`
	Generation         uint64 `json:"generation"`
	SnapshotDigest     string `json:"snapshotDigest"`
	FileDigest         string `json:"fileDigest"`
	MaxBindingFence    uint64 `json:"maxBindingFence"`
	MaxRetiredFence    uint64 `json:"maxRetiredFence"`
	ImportedTransit    bool   `json:"importedTransit"`
}

func journalBytes(path string) ([]byte, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil || !info.Mode().IsRegular() || info.Size() > 6291456 {
		return nil, fmt.Errorf("journal file unavailable or too large")
	}
	raw, err := io.ReadAll(io.LimitReader(file, 6291457))
	if err != nil || len(raw) > 6291456 {
		return nil, fmt.Errorf("journal read failed or too large")
	}
	return raw, nil
}

// InspectRuntimeJournal authenticates existing state without locks, initialization,
// migration or network access. Concurrent replacement requires a fresh inspection.
func InspectRuntimeJournal(path string, key []byte, node string) (JournalInspection, error) {
	before, err := journalBytes(path)
	if err != nil {
		return JournalInspection{}, err
	}
	record, err := LoadRuntimeJournal(path, key, node)
	if err != nil {
		return JournalInspection{}, err
	}
	after, err := journalBytes(path)
	if err != nil || !bytes.Equal(before, after) {
		return JournalInspection{}, fmt.Errorf("journal changed during inspection")
	}
	hash := sha256.Sum256(after)
	result := JournalInspection{
		Version: 1, NodeID: record.NodeID, ProtocolVersion: record.ProtocolVersion,
		Generation: record.Journal.Generation, SnapshotDigest: record.Journal.Digest,
		FileDigest:      "sha256:" + hex.EncodeToString(hash[:]),
		ImportedTransit: record.ImportedTransitDigest != "",
	}
	if record.ExecutionExtension != nil {
		result.ExecutionExtension = *record.ExecutionExtension
	}
	for _, fence := range record.Journal.Fences {
		result.MaxBindingFence = max(result.MaxBindingFence, fence)
	}
	for _, fence := range record.Journal.Retired {
		result.MaxRetiredFence = max(result.MaxRetiredFence, fence)
	}
	return result, nil
}
