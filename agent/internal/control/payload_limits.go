package control

import (
	"context"
	"fmt"
	"slices"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/payloadbudget"
	"github.com/tunex/vnext/agent/internal/state"
)

const sharedPayloadCapability = "shared-resource-limits.v1"

func resourceLimitAssignments(snapshot adp3.Snapshot) (map[string]payloadbudget.Policy, error) {
	limits := make(map[string]payloadbudget.Policy)
	if snapshot.ResourceLimits == nil {
		return limits, nil
	}
	if snapshot.ResourceLimits.Version != 1 || len(snapshot.ResourceLimits.Buckets) > 1000 {
		return nil, fmt.Errorf("UNSUPPORTED_CAPABILITY: Shared payload limit version/capacity")
	}
	assignments := make(map[string]bool, len(snapshot.Assignments))
	for _, assignment := range snapshot.Assignments {
		assignments[assignment.AssignmentId] = true
	}
	for _, bucket := range snapshot.ResourceLimits.Buckets {
		policy, err := state.RuntimeResourcePolicy(bucket)
		if err != nil {
			return nil, err
		}
		if policy.NodeID != snapshot.NodeId {
			return nil, fmt.Errorf("INTEGRITY_FAILURE: Foreign payload policy")
		}
		for _, id := range bucket.AssignmentIds {
			if _, duplicate := limits[id]; duplicate || !assignments[id] {
				return nil, fmt.Errorf("INTEGRITY_FAILURE: Payload assignment binding differs")
			}
			limits[id] = policy
		}
	}
	return limits, nil
}

func (runner *Runner) configurePayloadGates(snapshot adp3.Snapshot, limits map[string]payloadbudget.Policy) (map[string]*payloadbudget.Gate, error) {
	result := make(map[string]*payloadbudget.Gate, len(limits))
	if snapshot.ResourceLimits == nil || len(snapshot.ResourceLimits.Buckets) == 0 {
		return result, nil
	}
	if runner.clock == nil || runner.guard == nil {
		return nil, fmt.Errorf("CLOCK_UNCERTAIN: Original payload authorization clock required")
	}
	if runner.payloadGates == nil {
		runner.payloadGates = make(map[string]*payloadbudget.Gate)
	}
	history := state.RuntimeJournalFacts(runner.runtimeState).ResourceBudgets
	if history == nil {
		return nil, fmt.Errorf("INTEGRITY_FAILURE: Durable payload history required before binding")
	}
	clock := func() (payloadbudget.Sample, error) {
		if err := runner.guard.Check(); err != nil {
			return payloadbudget.Sample{}, err
		}
		sample, err := runner.clock()
		return payloadbudget.Sample{Wall: sample.Wall, Monotonic: sample.Uptime}, err
	}
	for _, bucket := range snapshot.ResourceLimits.Buckets {
		policy, err := state.RuntimeResourcePolicy(bucket)
		if err != nil {
			return nil, err
		}
		record, exists := history.Buckets[policy.BucketID]
		if !exists || !payloadbudget.SamePolicy(record.Policy, policy) {
			return nil, fmt.Errorf("INTEGRITY_FAILURE: Accepted payload policy differs")
		}
		gate := runner.payloadGates[policy.BucketID]
		if gate == nil {
			var err error
			gate, err = payloadbudget.New(record, clock, runner.scheduler().After, func(ctx context.Context, expected payloadbudget.Policy, count uint64, at int64) (payloadbudget.Record, error) {
				return state.PrechargeRuntimePayload(ctx, runner.options.Journal, runner.key, runner.options.NodeID, expected, count, at)
			})
			if err != nil {
				return nil, err
			}
			runner.payloadGates[policy.BucketID] = gate
		} else if err := gate.Configure(record); err != nil {
			return nil, err
		}
	}
	for assignment, policy := range limits {
		result[assignment] = runner.payloadGates[policy.BucketID]
	}
	return result, nil
}

func payloadBindingChanged(old *payloadbudget.AuthorizedGate, next *payloadbudget.Gate) bool {
	if old == nil {
		return next != nil
	}
	return old.Shared() != next
}

func (runner *Runner) executionCapabilities() []string {
	capabilities := builtinExecutionDrivers.capabilities(runner.executionFeatures())
	if !slices.Contains(capabilities, sharedPayloadCapability) {
		capabilities = append(capabilities, sharedPayloadCapability)
	}
	if runner.options.ProbePathEcho && slices.Contains(capabilities,"native.relay.v1") && slices.Contains(capabilities,"probe.udp-ingress-echo.v1") {
        capabilities = append(capabilities, "probe.tcp-path-echo.v1", "probe.udp-path-echo.v1")
    }
    return capabilities
}

// Called by the existing 100ms authority watch, independently of traffic/polling.
func (runner *Runner) stopPayloadLimitedLocked() {
	for key, instance := range runner.instances {
		if instance.payload != nil && instance.payload.Check() != nil {
			instance.stream.Close()
			runner.retainForwardCounterTailLocked(instance)
			delete(runner.instances, key)
		}
	}
	for key, drain := range runner.drains {
		if drain.instance.payload != nil && drain.instance.payload.Check() != nil {
			drain.instance.stream.Close()
			runner.retainForwardCounterTailLocked(drain.instance)
			delete(runner.drains, key)
		}
	}
}
