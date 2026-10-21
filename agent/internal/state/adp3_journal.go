package state

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/executionstate"
	"github.com/tunex/vnext/agent/internal/payloadbudget"
	"maps"
	"os"
	"regexp"
	"strconv"
	"strings"
)

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
	record := NativeRuntimeJournal(node, Journal{Snapshot: json.RawMessage("null"), Fences: map[string]uint64{}, Retired: map[string]uint64{}})
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
	if len(raw) > 4194304+1048576 {
		return fmt.Errorf("RESOURCE_LIMIT: Runtime journal payload capacity exhausted")
	}
	outer := Journal{Snapshot: raw, Generation: value.Journal.Generation, Digest: value.Journal.Digest, Fences: value.Journal.Fences, Retired: value.Journal.Retired}
	encoded, err := json.Marshal(outer)
	if err != nil {
		return err
	}
	if len(encoded) > 6291456-128 {
		return fmt.Errorf("RESOURCE_LIMIT: Runtime journal envelope capacity exhausted")
	}
	return Save(path, key, outer)
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
	if err := validateResourceBudgetEncoding(outer.Snapshot); err != nil {
		return RuntimeJournal{}, err
	}
	if err := payloadbudget.ValidateHistory(resourceBudgetFacts(record.ResourceBudgets), node); err != nil {
		return RuntimeJournal{}, err
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
	if record.Journal.Generation == 0 && (record.ResourceBudgets != nil || record.Journal.Digest != "" || string(record.Journal.Snapshot) != "null" || record.ImportedTransitDigest == "" && (len(record.Journal.Fences) != 0 || len(record.Journal.Retired) != 0)) {
		return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: Zero generation with execution history")
	}
	if record.Journal.Generation > 0 {
		value, err := adp3.Parse("Snapshot", record.Journal.Snapshot)
		if err != nil {
			return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: invalid persisted Snapshot: %w", err)
		}
		s := value.(adp3.Snapshot)
		history, err := runtimeSnapshotHistory(s)
		if err != nil {
			return RuntimeJournal{}, err
		}
		if err := payloadbudget.ValidateRetainedPolicies(resourceBudgetFacts(record.ResourceBudgets), history.ResourceLimits, node); err != nil {
			return RuntimeJournal{}, err
		}
		if s.ExecutionExtension != nil && record.ExecutionExtension == nil {
			return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: Missing durable execution extension")
		}
		if s.NodeId != node || s.SnapshotGeneration != record.Journal.Generation || s.SnapshotDigest != record.Journal.Digest {
			return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: Stored Snapshot differs")
		}
		for _, a := range s.Assignments {
			slot := PhysicalSlotKey(a.Resource.Protocol, a.Resource.Port)
			if record.Journal.Fences[slot] < a.BindingFence || record.Journal.Retired[slot] >= a.BindingFence {
				return RuntimeJournal{}, fmt.Errorf("INTEGRITY_FAILURE: Stored physical fence differs")
			}
		}
	}
	return record, nil
}

// AcceptRuntimeSnapshot persists complete high-water/fences before any caller may change sockets. It never executes cached authority.
func AcceptRuntimeSnapshot(path string, key []byte, current RuntimeJournal, snapshot adp3.Snapshot) (RuntimeJournal, error) {
	host := executionstate.RuntimeHost{Store: runtimeFileStore{path: path, key: key}, Codec: runtimeSnapshotCodec{}}
	next, err := host.Accept(RuntimeJournalFacts(current), runtimeSnapshotInput{snapshot: snapshot})
	if err != nil {
		return current, err
	}
	return RuntimeJournalFromFacts(next), nil
}

// EnableRuntimeExecution atomically upgrades the existing authoritative journal.
// The Agent instance lock must be held. Imported offline Transit history is retired,
// never executable. A crash before rename preserves the old journal; after rename
// old binaries reject the added fields and cannot discard the imported high-water.
func EnableRuntimeExecution(path string, key []byte, node, transitPath string) (RuntimeJournal, error) {
	release, err := acquireRuntimeFileLock(path)
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
				if PhysicalSlotKey(a.Resource.Protocol, a.Resource.Port) == slot && a.BindingFence <= cutoff {
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
