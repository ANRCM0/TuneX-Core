package state

import (
	"encoding/json"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/executionstate"
)

type runtimeFileStore struct {
	path string
	key  []byte
}

func (store runtimeFileStore) AcquireLock() (func(), error) { return AcquireLock(store.path + ".lock") }
func (store runtimeFileStore) Load(node string) (executionstate.RuntimeJournal, error) {
	value, err := LoadRuntimeJournal(store.path, store.key, node)
	return RuntimeJournalFacts(value), err
}
func (store runtimeFileStore) Save(value executionstate.RuntimeJournal) error {
	return saveRuntimeJournal(store.path, store.key, RuntimeJournalFromFacts(value))
}

type runtimeSnapshotCodec struct{}

func (runtimeSnapshotCodec) SupportsProtocol(version uint64) bool { return version == 3 }
func (runtimeSnapshotCodec) PhysicalSlotKey(protocol string, port uint64) string {
	return PhysicalSlotKey(protocol, port)
}

type runtimeSnapshotInput struct{ snapshot adp3.Snapshot }

func (input runtimeSnapshotInput) EncodeValidated() (executionstate.SnapshotHistory, []byte, error) {
	raw, err := json.Marshal(input.snapshot)
	if err != nil {
		return executionstate.SnapshotHistory{}, nil, err
	}
	if _, err := adp3.Parse("Snapshot", raw); err != nil {
		return executionstate.SnapshotHistory{}, nil, err
	}
	return runtimeSnapshotHistory(input.snapshot), raw, nil
}
func (runtimeSnapshotCodec) DecodePrevious(raw []byte) (executionstate.SnapshotHistory, error) {
	var snapshot adp3.Snapshot
	err := json.Unmarshal(raw, &snapshot)
	if err != nil {
		return executionstate.SnapshotHistory{}, err
	}
	return runtimeSnapshotHistory(snapshot), nil
}

func runtimeSnapshotHistory(snapshot adp3.Snapshot) executionstate.SnapshotHistory {
	history := executionstate.SnapshotHistory{NodeId: string(snapshot.NodeId), SessionEpoch: uint64(snapshot.SessionEpoch),
		SnapshotGeneration: uint64(snapshot.SnapshotGeneration), SnapshotDigest: string(snapshot.SnapshotDigest), ExecutionExtension: snapshot.ExecutionExtension}
	for _, assignment := range snapshot.Assignments {
		history.Assignments = append(history.Assignments, executionstate.ExecutionIdentity{
			AssignmentId: string(assignment.AssignmentId), ForwardId: string(assignment.ForwardId), DeploymentGeneration: uint64(assignment.DeploymentGeneration),
			BindingFence: uint64(assignment.BindingFence), Role: assignment.Role, Protocol: string(assignment.Protocol), Phase: string(assignment.Phase),
			Driver:   executionstate.DriverIdentity{Id: assignment.Driver.Id, ConfigDigest: string(assignment.Driver.ConfigDigest)},
			Resource: executionstate.PhysicalResource{Address: assignment.Resource.Address, Port: assignment.Resource.Port, Protocol: assignment.Resource.Protocol},
		})
	}
	for _, retired := range snapshot.Tombstones {
		history.Tombstones = append(history.Tombstones, executionstate.PhysicalRetirement{
			PhysicalProtocol: string(retired.PhysicalProtocol), Port: retired.Port, BindingFence: uint64(retired.BindingFence),
		})
	}
	return history
}
