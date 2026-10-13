package state

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/contracts"
	"maps"
	"os"
	"regexp"
)

type RuntimeJournal struct {
	ProtocolVersion uint64  `json:"protocolVersion"`
	NodeID          string  `json:"nodeId"`
	Journal         Journal `json:"journal"`
}

func InitializeRuntimeJournal(path string, key []byte, node string) error {
	if len(key) != 32 || !regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`).MatchString(node) {
		return fmt.Errorf("INTEGRITY_FAILURE: Runtime identity/key required")
	}
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return fmt.Errorf("INTEGRITY_FAILURE: Explicit new Runtime journal required: %w", err)
	}
	if err := file.Sync(); err != nil {
		file.Close()
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	record := RuntimeJournal{ProtocolVersion: 3, NodeID: node, Journal: Journal{Snapshot: json.RawMessage("null"), Fences: map[string]uint64{}, Retired: map[string]uint64{}}}
	return saveRuntimeJournal(path, key, record)
}
func saveRuntimeJournal(path string, key []byte, value RuntimeJournal) error {
	if len(key) != 32 {
		return fmt.Errorf("INTEGRITY_FAILURE: Runtime journal key required")
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return Save(path, key, Journal{Snapshot: raw, Generation: value.Journal.Generation, Digest: value.Journal.Digest, Fences: value.Journal.Fences, Retired: value.Journal.Retired})
}
func LoadRuntimeJournal(path string, key []byte, node string) (RuntimeJournal, error) {
	if len(key) != 32 {
		return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: Runtime journal key required")
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: Runtime journal unavailable: %w", err)
	}
	if _, err := contracts.ParseJSON(raw, 6291456); err != nil {
		return RuntimeJournal{}, err
	}
	outer, err := Load(path, key)
	if err != nil {
		return RuntimeJournal{}, err
	}
	if _, err := contracts.ParseJSON(outer.Snapshot, 4194304+1048576); err != nil {
		return RuntimeJournal{}, err
	}
	decoder := json.NewDecoder(bytes.NewReader(outer.Snapshot))
	decoder.DisallowUnknownFields()
	var record RuntimeJournal
	if err := decoder.Decode(&record); err != nil {
		return RuntimeJournal{}, err
	}
	if record.ProtocolVersion != 3 || record.NodeID != node || record.Journal.Generation != outer.Generation || record.Journal.Digest != outer.Digest || !maps.Equal(record.Journal.Fences, outer.Fences) || !maps.Equal(record.Journal.Retired, outer.Retired) {
		return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: Runtime journal binding differs")
	}
	for _, values := range []map[string]uint64{record.Journal.Fences, record.Journal.Retired} {
		if values == nil {
			return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: Runtime journal maps missing")
		}
		for slot, counter := range values {
			if !regexp.MustCompile(`^(tcp|udp)/[1-9][0-9]{0,4}$`).MatchString(slot) || counter < 1 {
				return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: Invalid physical fence record")
			}
			if counter > contracts.MaxCounter {
				return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: Runtime journal counter overflow")
			}
		}
	}
	if record.Journal.Generation > contracts.MaxCounter {
		return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: Runtime generation overflow")
	}
	if record.Journal.Generation == 0 && (record.Journal.Digest != "" || string(record.Journal.Snapshot) != "null" || len(record.Journal.Fences) != 0 || len(record.Journal.Retired) != 0) {
		return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: Zero generation with execution history")
	}
	if record.Journal.Generation > 0 {
		value, err := adp3.Parse("Snapshot", record.Journal.Snapshot)
		if err != nil {
			return RuntimeJournal{}, err
		}
		s := value.(adp3.Snapshot)
		if s.NodeId != node || s.SnapshotGeneration != record.Journal.Generation || s.SnapshotDigest != record.Journal.Digest {
			return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: Stored Snapshot differs")
		}
		for _, a := range s.Assignments {
			slot := fmt.Sprintf("%s/%d", a.Resource.Protocol, a.Resource.Port)
			if record.Journal.Fences[slot] < a.BindingFence || record.Journal.Retired[slot] >= a.BindingFence {
				return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: Stored physical fence differs")
			}
		}
	}
	return record, nil
}

// AcceptRuntimeSnapshot persists complete high-water/fences before any caller may change sockets. It never executes cached authority.
func AcceptRuntimeSnapshot(path string, key []byte, current RuntimeJournal, snapshot adp3.Snapshot) (RuntimeJournal, error) {
	release, err := AcquireLock(path + ".lock")
	if err != nil {
		return current, err
	}
	defer release()
	durable, err := LoadRuntimeJournal(path, key, current.NodeID)
	if err != nil {
		return current, err
	}
	if durable.ProtocolVersion != current.ProtocolVersion || durable.Journal.Generation != current.Journal.Generation || durable.Journal.Digest != current.Journal.Digest || !maps.Equal(durable.Journal.Fences, current.Journal.Fences) || !maps.Equal(durable.Journal.Retired, current.Journal.Retired) {
		return current, fmt.Errorf("INTEGRITY_FAILURE: Caller Runtime state is stale")
	}
	raw, err := json.Marshal(snapshot)
	if err != nil {
		return current, err
	}
	if _, err := adp3.Parse("Snapshot", raw); err != nil {
		return current, err
	}
	if current.ProtocolVersion != 3 || current.NodeID != snapshot.NodeId || snapshot.SnapshotGeneration < current.Journal.Generation || snapshot.SnapshotGeneration == current.Journal.Generation && snapshot.SnapshotDigest != current.Journal.Digest {
		return current, fmt.Errorf("INTEGRITY_FAILURE: Runtime history/binding differs")
	}
	if snapshot.SnapshotGeneration == current.Journal.Generation {
		return current, nil
	}
	next := current
	next.Journal.Fences = maps.Clone(current.Journal.Fences)
	next.Journal.Retired = maps.Clone(current.Journal.Retired)
	incoming := map[string]bool{}
	for _, a := range snapshot.Assignments {
		slot := fmt.Sprintf("%s/%d", a.Resource.Protocol, a.Resource.Port)
		incoming[slot] = true
		if a.BindingFence < next.Journal.Fences[slot] || a.BindingFence <= next.Journal.Retired[slot] {
			return current, fmt.Errorf("FENCING_REJECTED")
		}
		next.Journal.Fences[slot] = a.BindingFence
	}
	for slot, fence := range next.Journal.Fences {
		if !incoming[slot] {
			next.Journal.Retired[slot] = max(next.Journal.Retired[slot], fence)
		}
	}
	for _, t := range snapshot.Tombstones {
		slot := fmt.Sprintf("%s/%d", t.PhysicalProtocol, t.Port)
		next.Journal.Retired[slot] = max(next.Journal.Retired[slot], t.BindingFence)
	}
	next.Journal.Generation = snapshot.SnapshotGeneration
	next.Journal.Digest = snapshot.SnapshotDigest
	next.Journal.Snapshot = raw
	if err := saveRuntimeJournal(path, key, next); err != nil {
		return current, fmt.Errorf("PERSISTENCE_FAILURE: %w", err)
	}
	return next, nil
}
