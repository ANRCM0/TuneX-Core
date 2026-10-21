package executionstate

import (
	"fmt"
	"maps"

	"github.com/tunex/vnext/agent/internal/payloadbudget"
)

// Accept persists authenticated high-water before returning permission to change sockets.
func (host RuntimeHost) Accept(current RuntimeJournal, input SnapshotInput) (RuntimeJournal, error) {
	if host.Store == nil || host.Codec == nil || input == nil {
		return current, fmt.Errorf("INTEGRITY_FAILURE: Runtime journal providers required")
	}
	release, err := host.Store.AcquireLock()
	if err != nil {
		return current, err
	}
	defer release()
	durable, err := host.Store.Load(current.NodeID)
	if err != nil {
		return current, err
	}
	if durable.FormatVersion != current.FormatVersion || !sameExtension(durable.ExecutionExtension, current.ExecutionExtension) || durable.ImportedHistoryDigest != current.ImportedHistoryDigest || durable.Journal.Generation != current.Journal.Generation || durable.Journal.Digest != current.Journal.Digest || !maps.Equal(durable.Journal.Fences, current.Journal.Fences) || !maps.Equal(durable.Journal.Retired, current.Journal.Retired) {
		return current, fmt.Errorf("INTEGRITY_FAILURE: Caller Runtime state is stale")
	}
	// Payload writers may have advanced consumption since the Runner cached this
	// Snapshot. The authenticated reload under this same lock is authoritative.
	retained := current
	retained.ResourceBudgets = durable.ResourceBudgets
	snapshot, raw, err := input.EncodeValidated()
	if err != nil {
		return current, err
	}
	if snapshot.ExecutionExtension != nil && current.ExecutionExtension == nil {
		return current, fmt.Errorf("UNSUPPORTED_CAPABILITY: Explicit durable execution migration required")
	}
	if !host.Codec.SupportsProtocol(current.FormatVersion) || current.NodeID != snapshot.NodeId || snapshot.SnapshotGeneration < current.Journal.Generation || snapshot.SnapshotGeneration == current.Journal.Generation && snapshot.SnapshotDigest != current.Journal.Digest {
		return current, fmt.Errorf("INTEGRITY_FAILURE: Runtime history/binding differs")
	}
	budgets, err := payloadbudget.AcceptHistory(retained.ResourceBudgets, snapshot.ResourceLimits, current.NodeID)
	if err != nil {
		return current, err
	}
	if snapshot.SnapshotGeneration == current.Journal.Generation {
		if err := payloadbudget.ValidateRetainedPolicies(retained.ResourceBudgets, snapshot.ResourceLimits, current.NodeID); err != nil {
			return current, err
		}
		return retained, nil
	}
	next := retained
	next.ResourceBudgets = budgets
	if snapshot.ExecutionExtension != nil {
		version := *snapshot.ExecutionExtension
		next.ExecutionExtension = &version
	}
	next.Journal.Fences = maps.Clone(current.Journal.Fences)
	next.Journal.Retired = maps.Clone(current.Journal.Retired)
	incoming := map[string]bool{}
	var prior SnapshotHistory
	if current.Journal.Generation > 0 {
		var err error
		prior, err = host.Codec.DecodePrevious(current.Journal.Snapshot)
		if err != nil {
			return current, fmt.Errorf("INTEGRITY_FAILURE: Prior runtime Snapshot")
		}
		if snapshot.SessionEpoch < prior.SessionEpoch {
			return current, fmt.Errorf("SESSION_SUPERSEDED: Persisted session cannot regress")
		}
	}
	for _, a := range snapshot.Assignments {
		slot := host.Codec.PhysicalSlotKey(a.Resource.Protocol, a.Resource.Port)
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
		slot := host.Codec.PhysicalSlotKey(t.PhysicalProtocol, t.Port)
		next.Journal.Retired[slot] = max(next.Journal.Retired[slot], t.BindingFence)
	}
	next.Journal.Generation = snapshot.SnapshotGeneration
	next.Journal.Digest = snapshot.SnapshotDigest
	next.Journal.Snapshot = raw
	if err := host.Store.Save(next); err != nil {
		return current, fmt.Errorf("PERSISTENCE_FAILURE: %w", err)
	}
	return next, nil
}

func sameExtension(a, b *uint64) bool {
	return a == nil && b == nil || a != nil && b != nil && *a == *b
}
