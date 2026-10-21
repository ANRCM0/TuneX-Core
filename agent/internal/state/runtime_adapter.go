package state

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/executionstate"
	"github.com/tunex/vnext/agent/internal/payloadbudget"
)

type runtimeFileStore struct {
	path string
	key  []byte
}

func (store runtimeFileStore) AcquireLock() (func(), error) {
	return acquireRuntimeFileLock(store.path)
}
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
	history, err := runtimeSnapshotHistory(input.snapshot)
	return history, raw, err
}
func (runtimeSnapshotCodec) DecodePrevious(raw []byte) (executionstate.SnapshotHistory, error) {
	var snapshot adp3.Snapshot
	err := json.Unmarshal(raw, &snapshot)
	if err != nil {
		return executionstate.SnapshotHistory{}, err
	}
	return runtimeSnapshotHistory(snapshot)
}

func runtimeSnapshotHistory(snapshot adp3.Snapshot) (executionstate.SnapshotHistory, error) {
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
	if snapshot.ResourceLimits != nil {
		for _, bucket := range snapshot.ResourceLimits.Buckets {
			policy, err := RuntimeResourcePolicy(bucket)
			if err != nil {
				return history, err
			}
			history.ResourceLimits = append(history.ResourceLimits, policy)
		}
	}
	return history, nil
}

// RuntimeResourcePolicy projects only the immutable binding and revisioned policy.
// Canonical milliseconds prevent distinct signed periods collapsing in history.
func RuntimeResourcePolicy(bucket adp3.ResourceLimitBucket) (payloadbudget.Policy, error) {
	parse := func(value string) (int64, error) {
		parsed, err := time.Parse(time.RFC3339Nano, value)
		if err != nil || parsed.Format("2006-01-02T15:04:05.000Z") != value {
			return 0, fmt.Errorf("INTEGRITY_FAILURE: Canonical payload period required")
		}
		return parsed.UnixMilli(), nil
	}
	starts, err := parse(bucket.StartsAt)
	if err != nil {
		return payloadbudget.Policy{}, err
	}
	ends, err := parse(bucket.EndsAt)
	if err != nil {
		return payloadbudget.Policy{}, err
	}
	policy := payloadbudget.Policy{Binding: payloadbudget.Binding{BucketID: bucket.BucketId, ScopeID: bucket.ScopeId, ActorID: bucket.ActorId, NodeID: bucket.NodeId, StartsAt: starts, EndsAt: ends},
		Revision: bucket.Revision, BytesPerSecond: bucket.BytesPerSecond, BurstBytes: bucket.BurstBytes, ByteLimit: bucket.ByteLimit}
	return payloadbudget.ClonePolicy(policy), payloadbudget.ValidatePolicy(policy)
}
