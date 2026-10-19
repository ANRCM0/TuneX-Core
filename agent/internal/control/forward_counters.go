package control

import (
	"sort"
	"time"

	"github.com/tunex/vnext/agent/internal/observationwire"
	"github.com/tunex/vnext/agent/internal/payloadstats"
)

const (
	forwardCounterLimit         = 256
	forwardCounterTailLimit     = 128
	forwardCounterTailRetention = 10 * time.Minute
)

type forwardCounterResource = observationwire.ForwardCounterResource
type forwardCounterIdentity = observationwire.ForwardCounterIdentity
type forwardCounterValues = observationwire.ForwardCounterValues
type forwardCounterPoint = observationwire.ForwardCounterPoint

type forwardCounterTail struct {
	identity  forwardCounterIdentity
	phase     string
	counters  payloadstats.Snapshot
	available bool
	endedAt   time.Time
}

type forwardCounterReference struct {
	identity     forwardCounterIdentity
	phase, state string
	stream       execution
}

type forwardCounterKey struct {
	identity forwardCounterIdentity
	epoch    string
}

func ingressPayload(instance running) bool {
	switch instance.assignment.Role {
	case "direct", "relay-ingress", "multihop-ingress":
		return true
	default:
		return false
	}
}

func readPayloadCounters(stream execution) (payloadstats.Snapshot, bool) {
	reader, ok := stream.(interface {
		PayloadCounters() (payloadstats.Snapshot, bool)
	})
	if !ok {
		return payloadstats.Snapshot{}, false
	}
	return reader.PayloadCounters()
}

// Caller owns Runner.mutex. Identity is copied, never inferred from later desired state.
func (runner *Runner) forwardCounterIdentityLocked(instance running) forwardCounterIdentity {
	a := instance.assignment
	return forwardCounterIdentity{
		NodeID: runner.options.NodeID, BootID: runner.options.BootID, SessionEpoch: runner.hello.SessionEpoch,
		AssignmentID: a.AssignmentId, ForwardID: a.ForwardId, ForwardRevision: a.ForwardRevision,
		DeploymentGeneration: a.DeploymentGeneration, BindingFence: a.BindingFence,
		Role: a.Role, Protocol: a.Protocol, DriverID: a.Driver.Id,
		DriverSchemaVersion: a.Driver.SchemaVersion, ConfigDigest: a.Driver.ConfigDigest,
		Resource: forwardCounterResource{Protocol: a.Resource.Protocol, Address: a.Resource.Address, Port: a.Resource.Port},
	}
}

func incrementForwardCounter(value *uint64) {
	if *value != ^uint64(0) {
		*value = *value + 1
	}
}

func (runner *Runner) expireForwardCounterTailsLocked(now time.Time) {
	kept := runner.forwardCounterTails[:0]
	for _, tail := range runner.forwardCounterTails {
		if now.Sub(tail.endedAt) >= forwardCounterTailRetention {
			incrementForwardCounter(&runner.forwardCounterTailsExpired)
			continue
		}
		kept = append(kept, tail)
	}
	clear(runner.forwardCounterTails[len(kept):])
	runner.forwardCounterTails = kept
}

// Called only after existing Close has completed, immediately before removal.
// Built-in readers perform atomic loads only; no engine locks, I/O or retained engines.
func (runner *Runner) retainForwardCounterTailLocked(instance running) {
	if (runner.options.Diagnostics == "" && !runner.options.ForwardTelemetry) || !ingressPayload(instance) {
		return
	}
	counters, available := readPayloadCounters(instance.stream)
	identity := runner.forwardCounterIdentityLocked(instance)
	for _, tail := range runner.forwardCounterTails {
		if tail.identity == identity && tail.counters.Epoch == counters.Epoch {
			return
		}
	}
	now := runner.scheduler().Now()
	runner.expireForwardCounterTailsLocked(now)
	if len(runner.forwardCounterTails) == forwardCounterTailLimit {
		copy(runner.forwardCounterTails, runner.forwardCounterTails[1:])
		runner.forwardCounterTails = runner.forwardCounterTails[:forwardCounterTailLimit-1]
		incrementForwardCounter(&runner.forwardCounterTailsEvicted)
	}
	runner.forwardCounterTails = append(runner.forwardCounterTails, forwardCounterTail{
		identity: identity, phase: instance.assignment.Phase, counters: counters, available: available, endedAt: now,
	})
}

func newForwardCounterPoint(identity forwardCounterIdentity, phase, lifecycle string, captured time.Time,
	counters payloadstats.Snapshot, available bool) forwardCounterPoint {
	point := forwardCounterPoint{Identity: identity, Phase: phase, State: lifecycle,
		CapturedAt: observationwire.UTCTimeText(captured), Availability: "unavailable"}
	if lifecycle == "terminal" {
		ended := point.CapturedAt
		point.EndedAt = &ended
	}
	if !available {
		return point
	}
	point.Availability = "available"
	point.CounterEpoch, point.Overflowed = &counters.Epoch, &counters.Overflowed
	point.Counters = &forwardCounterValues{
		PayloadSentBytes:     observationwire.Uint64Text(counters.PayloadSentBytes),
		PayloadReceivedBytes: observationwire.Uint64Text(counters.PayloadReceivedBytes),
		TCPAccepted:          observationwire.Uint64Text(counters.TCPAccepted), TCPConnected: observationwire.Uint64Text(counters.TCPConnected),
		TCPClosed:              observationwire.Uint64Text(counters.TCPClosed),
		UDPAssociationsCreated: observationwire.Uint64Text(counters.UDPAssociationsCreated),
		UDPAssociationsClosed:  observationwire.Uint64Text(counters.UDPAssociationsClosed),
		UDPDatagramsSent:       observationwire.Uint64Text(counters.UDPDatagramsSent),
		UDPDatagramsReceived:   observationwire.Uint64Text(counters.UDPDatagramsReceived),
	}
	return point
}

type forwardCounterCoverage = observationwire.ForwardCounterCoverage

type forwardCounterSnapshot struct {
	nodeID, bootID string
	sessionEpoch   uint64
	observationwire.ForwardCounterSnapshot
}

func (runner *Runner) captureForwardCounters(final bool) forwardCounterSnapshot {
	return runner.captureForwardCounterPage(final, forwardCounterLimit)
}

func (runner *Runner) captureForwardCounterPage(final bool, limit int) forwardCounterSnapshot {
	limit = max(1, min(limit, forwardCounterLimit))
	now := runner.scheduler().Now()
	runner.mutex.Lock()
	node, boot, session := runner.options.NodeID, runner.options.BootID, runner.hello.SessionEpoch
	runner.expireForwardCounterTailsLocked(now)
	references := make([]forwardCounterReference, 0, len(runner.instances)+len(runner.drains))
	for _, instance := range runner.instances {
		if ingressPayload(instance) {
			references = append(references, forwardCounterReference{identity: runner.forwardCounterIdentityLocked(instance),
				phase: instance.assignment.Phase, state: "current", stream: instance.stream})
		}
	}
	for _, drain := range runner.drains {
		instance := drain.instance
		if ingressPayload(instance) {
			references = append(references, forwardCounterReference{identity: runner.forwardCounterIdentityLocked(instance),
				phase: instance.assignment.Phase, state: "draining", stream: instance.stream})
		}
	}
	tails := make([]forwardCounterTail, 0, len(runner.forwardCounterTails))
	for _, tail := range runner.forwardCounterTails {
		if tail.identity.NodeID == node && tail.identity.BootID == boot && tail.identity.SessionEpoch == session {
			tails = append(tails, tail)
		}
	}
	// Local 500 ms sampling must not advance or starve the independent remote page rotation.
	pageCursor := &runner.forwardCounterCursor
	if limit < forwardCounterLimit {
		pageCursor = &runner.forwardTelemetryCursor
	}
	generation, cursor := runner.journal.Generation, *pageCursor
	if *pageCursor > ^uint64(0)-uint64(limit) {
		*pageCursor = 0
	} else {
		*pageCursor += uint64(limit)
	}
	evicted, expired := runner.forwardCounterTailsEvicted, runner.forwardCounterTailsExpired
	runner.mutex.Unlock()

	points := make(map[forwardCounterKey]forwardCounterPoint, len(references)+len(tails))
	for _, reference := range references {
		counters, available := readPayloadCounters(reference.stream)
		key := forwardCounterKey{reference.identity, counters.Epoch}
		point := newForwardCounterPoint(reference.identity, reference.phase, reference.state, runner.scheduler().Now(), counters, available)
		if previous, exists := points[key]; !exists || previous.State == "current" && reference.state == "draining" {
			points[key] = point
		}
	}
	for _, tail := range tails {
		points[forwardCounterKey{tail.identity, tail.counters.Epoch}] = newForwardCounterPoint(
			tail.identity, tail.phase, "terminal", tail.endedAt, tail.counters, tail.available)
	}
	type orderedPoint struct {
		key   string
		point forwardCounterPoint
	}
	ordered := make([]orderedPoint, 0, len(points))
	unavailable := 0
	for key, point := range points {
		encoded, _ := observationwire.EncodeValue(key.identity)
		ordered = append(ordered, orderedPoint{string(encoded) + "/" + key.epoch, point})
		if point.Availability == "unavailable" {
			unavailable++
		}
	}
	sort.Slice(ordered, func(i, j int) bool { return ordered[i].key < ordered[j].key })
	returned, offset, next := min(len(ordered), limit), 0, 0
	items := make([]forwardCounterPoint, 0, returned)
	if len(ordered) > 0 {
		if len(ordered) > limit {
			offset = int(cursor % uint64(len(ordered)))
		}
		for index := 0; index < returned; index++ {
			items = append(items, ordered[(offset+index)%len(ordered)].point)
		}
		if len(ordered) > limit {
			next = (offset + returned) % len(ordered)
		}
	}
	return forwardCounterSnapshot{nodeID: node, bootID: boot, sessionEpoch: session,
		ForwardCounterSnapshot: observationwire.ForwardCounterSnapshot{
			CounterVersion: 1, Kind: "native-forward-counters", Source: "agent-reported",
			Health: "not-assessed", ExecutionAuthorized: false, CapturedAt: observationwire.UTCTimeText(runner.scheduler().Now()),
			Final: final, SnapshotGeneration: generation, Items: items,
			Coverage: forwardCounterCoverage{Limit: limit, Available: len(ordered), Returned: returned,
				Omitted: len(ordered) - returned, Truncated: len(ordered) > returned, Offset: offset, NextOffset: next,
				UnavailableSources: unavailable, TailLimit: forwardCounterTailLimit,
				TailRetentionSeconds: int(forwardCounterTailRetention / time.Second),
				TailsEvicted:         observationwire.Uint64Text(evicted), TailsExpired: observationwire.Uint64Text(expired), HistoryComplete: false},
		},
	}
}

func (runner *Runner) writeForwardCounters(final bool) error {
	if runner.options.Diagnostics == "" {
		return nil
	}
	encoded, err := observationwire.EncodeValue(runner.captureForwardCounters(final).ForwardCounterSnapshot)
	if err != nil {
		return err
	}
	return runner.measurementFiles().WriteForwardCounters(runner.options.Diagnostics, encoded)
}
