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
	"strconv"
	"strings"
)

type RuntimeJournal struct {
	ProtocolVersion       uint64  `json:"protocolVersion"`
	NodeID                string  `json:"nodeId"`
	Journal               Journal `json:"journal"`
	ExecutionExtension    *uint64 `json:"executionExtension,omitempty"`
	ImportedTransitDigest string  `json:"importedTransitDigest,omitempty"`
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
		return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: invalid Runtime journal envelope: %w", err)
	}
	outer, err := Load(path, key)
	if err != nil {
		return RuntimeJournal{}, err
	}
	if _, err := contracts.ParseJSON(outer.Snapshot, 4194304+1048576); err != nil {
		return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: invalid Runtime journal payload: %w", err)
	}
	decoder := json.NewDecoder(bytes.NewReader(outer.Snapshot))
	decoder.DisallowUnknownFields()
	var record RuntimeJournal
	if err := decoder.Decode(&record); err != nil {
		return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: invalid Runtime journal body: %w", err)
	}
	if record.ProtocolVersion != 3 || record.NodeID != node || record.Journal.Generation != outer.Generation || record.Journal.Digest != outer.Digest || !maps.Equal(record.Journal.Fences, outer.Fences) || !maps.Equal(record.Journal.Retired, outer.Retired) {
		return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: Runtime journal binding differs")
	}
	if record.ExecutionExtension != nil && *record.ExecutionExtension != 1 {
		return RuntimeJournal{}, fmt.Errorf("UNSUPPORTED_PROTOCOL_VERSION: Runtime journal extension")
	}
	if record.ImportedTransitDigest != "" && (record.ExecutionExtension == nil || !regexp.MustCompile(`^sha256:[a-f0-9]{64}$`).MatchString(record.ImportedTransitDigest)) {
		return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: Invalid Transit import")
	}
	for _, values := range []map[string]uint64{record.Journal.Fences, record.Journal.Retired} {
		if values == nil {
			return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: Runtime journal maps missing")
		}
		for slot, counter := range values {
			if !regexp.MustCompile(`^(tcp|udp)/[1-9][0-9]{0,4}$`).MatchString(slot) || counter < 1 {
				return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: Invalid physical fence record")
			}
			port, err := strconv.ParseUint(strings.SplitN(slot, "/", 2)[1], 10, 16)
			if err != nil || port == 0 {
				return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: Invalid physical port history")
			}
			if counter > contracts.MaxCounter {
				return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: Runtime journal counter overflow")
			}
		}
	}
	if record.Journal.Generation > contracts.MaxCounter {
		return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: Runtime generation overflow")
	}
	if record.Journal.Generation == 0 && (record.Journal.Digest != "" || string(record.Journal.Snapshot) != "null" || record.ImportedTransitDigest == "" && (len(record.Journal.Fences) != 0 || len(record.Journal.Retired) != 0)) {
		return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: Zero generation with execution history")
	}
	if record.Journal.Generation > 0 {
		value, err := adp3.Parse("Snapshot", record.Journal.Snapshot)
		if err != nil {
			return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: invalid persisted Snapshot: %w", err)
		}
		s := value.(adp3.Snapshot)
		if s.ExecutionExtension != nil && record.ExecutionExtension == nil {
			return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: Missing durable execution extension")
		}
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
	if durable.ProtocolVersion != current.ProtocolVersion || !sameExtension(durable.ExecutionExtension, current.ExecutionExtension) || durable.ImportedTransitDigest != current.ImportedTransitDigest || durable.Journal.Generation != current.Journal.Generation || durable.Journal.Digest != current.Journal.Digest || !maps.Equal(durable.Journal.Fences, current.Journal.Fences) || !maps.Equal(durable.Journal.Retired, current.Journal.Retired) {
		return current, fmt.Errorf("INTEGRITY_FAILURE: Caller Runtime state is stale")
	}
	raw, err := json.Marshal(snapshot)
	if err != nil {
		return current, err
	}
	if _, err := adp3.Parse("Snapshot", raw); err != nil {
		return current, err
	}
	if snapshot.ExecutionExtension != nil && current.ExecutionExtension == nil {
		return current, fmt.Errorf("UNSUPPORTED_CAPABILITY: Explicit durable execution migration required")
	}
	if current.ProtocolVersion != 3 || current.NodeID != snapshot.NodeId || snapshot.SnapshotGeneration < current.Journal.Generation || snapshot.SnapshotGeneration == current.Journal.Generation && snapshot.SnapshotDigest != current.Journal.Digest {
		return current, fmt.Errorf("INTEGRITY_FAILURE: Runtime history/binding differs")
	}
	if snapshot.SnapshotGeneration == current.Journal.Generation {
		return current, nil
	}
	next := current
	if snapshot.ExecutionExtension != nil {
		version := *snapshot.ExecutionExtension
		next.ExecutionExtension = &version
	}
	next.Journal.Fences = maps.Clone(current.Journal.Fences)
	next.Journal.Retired = maps.Clone(current.Journal.Retired)
	incoming := map[string]bool{}
	var prior adp3.Snapshot
	if current.Journal.Generation > 0 {
		if err := json.Unmarshal(current.Journal.Snapshot, &prior); err != nil {
			return current, fmt.Errorf("INTEGRITY_FAILURE: Prior runtime Snapshot")
		}
		if snapshot.SessionEpoch < prior.SessionEpoch {
			return current, fmt.Errorf("SESSION_SUPERSEDED: Persisted session cannot regress")
		}
	}
	for _, a := range snapshot.Assignments {
		slot := fmt.Sprintf("%s/%d", a.Resource.Protocol, a.Resource.Port)
		incoming[slot] = true
		if a.BindingFence < next.Journal.Fences[slot] || a.BindingFence <= next.Journal.Retired[slot] {
			return current, fmt.Errorf("FENCING_REJECTED")
		}
		for _, old := range prior.Assignments {
			if old.Resource.Protocol != a.Resource.Protocol || old.Resource.Port != a.Resource.Port {
				continue
			}
			if a.BindingFence == old.BindingFence && (old.AssignmentId != a.AssignmentId || old.ForwardId != a.ForwardId || old.DeploymentGeneration != a.DeploymentGeneration || old.Role != a.Role || old.Driver.Id != a.Driver.Id) {
				return current, fmt.Errorf("FENCING_REJECTED: New physical owner requires a new Fence")
			}
			if old.AssignmentId == a.AssignmentId && old.DeploymentGeneration == a.DeploymentGeneration && old.BindingFence == a.BindingFence {
				if old.Driver.ConfigDigest != a.Driver.ConfigDigest || old.Resource != a.Resource || old.Protocol != a.Protocol {
					return current, fmt.Errorf("INTEGRITY_FAILURE: Immutable execution changed")
				}
				if old.Phase == "draining" && a.Phase != "draining" || old.Phase == "active" && a.Phase == "prepared" {
					return current, fmt.Errorf("FENCING_REJECTED: Execution phase regressed")
				}
			}
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

func sameExtension(a, b *uint64) bool {
	return a == nil && b == nil || a != nil && b != nil && *a == *b
}

// EnableRuntimeExecution atomically upgrades the existing authoritative journal.
// The Agent instance lock must be held. Imported offline Transit history is retired,
// never executable. A crash before rename preserves the old journal; after rename
// old binaries reject the added fields and cannot discard the imported high-water.
func EnableRuntimeExecution(path string, key []byte, node, transitPath string) (RuntimeJournal, error) {
	release, err := AcquireLock(path + ".lock")
	if err != nil {
		return RuntimeJournal{}, err
	}
	defer release()
	current, err := LoadRuntimeJournal(path, key, node)
	if err != nil {
		return current, err
	}
	version := uint64(1)
	if transitPath != "" {
		runtimeFile, runtimeErr := os.Stat(path)
		transitFile, transitErr := os.Stat(transitPath)
		if transitPath == path || runtimeErr == nil && transitErr == nil && os.SameFile(runtimeFile, transitFile) {
			return current, fmt.Errorf("INVALID_CONFIG: Separate legacy Transit journal required")
		}
		unlock, err := AcquireLock(transitPath + ".lock")
		if err != nil {
			return current, err
		}
		defer unlock()
		transit, err := LoadTransitJournal(transitPath, key, node)
		if err != nil {
			return current, err
		}
		hash, err := contracts.ComputeDigest(transit)
		if err != nil {
			return current, err
		}
		if current.ImportedTransitDigest != "" {
			if current.ImportedTransitDigest != hash {
				return current, fmt.Errorf("INTEGRITY_FAILURE: Imported Transit history changed")
			}
			return current, nil
		}
		fences, retired := maps.Clone(current.Journal.Fences), maps.Clone(current.Journal.Retired)
		var snapshot adp3.Snapshot
		if current.Journal.Generation > 0 {
			if err = json.Unmarshal(current.Journal.Snapshot, &snapshot); err != nil {
				return current, err
			}
		}
		legacy := maps.Clone(transit.Fences)
		for slot, fence := range transit.Retired {
			legacy[slot] = max(legacy[slot], fence)
		}
		for slot, cutoff := range legacy {
			for _, a := range snapshot.Assignments {
				if fmt.Sprintf("%s/%d", a.Resource.Protocol, a.Resource.Port) == slot && a.BindingFence <= cutoff {
					return current, fmt.Errorf("RESOURCE_CONFLICT: Legacy Transit history overlaps live Runtime ownership")
				}
			}
			fences[slot] = max(fences[slot], cutoff)
			retired[slot] = max(retired[slot], cutoff)
		}
		current.Journal.Fences = fences
		current.Journal.Retired = retired
		current.ImportedTransitDigest = hash
	}
	current.ExecutionExtension = &version
	if err = saveRuntimeJournal(path, key, current); err != nil {
		return current, fmt.Errorf("PERSISTENCE_FAILURE: %w", err)
	}
	return current, nil
}
