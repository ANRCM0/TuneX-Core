package control

import (
	"sort"
	"time"

	"github.com/tunex/vnext/agent/internal/observationwire"
	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/proberesult"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

const (
	probeCounterPageLimit     = 32
	probeCounterSnapshotLimit = 2
	probeCounterTailLimit     = 128
	probeCounterRetiringLimit = 8
	probeCounterRetention     = 10 * time.Minute
)

type probeCounterIdentity = observationwire.ProbeCounterIdentity
type probeCounterValues = observationwire.ProbeCounterValues
type probeCounterPoint = observationwire.ProbeCounterPoint
type probeCounterCoverage = observationwire.ProbeCounterCoverage

type probeCounterSource struct {
	node, boot, instance string
	epoch, generation    uint64
	reader               *probe.CounterSet
	retiredAt            time.Time
}

type probeCounterTail struct {
	identity probeCounterIdentity
	values   probe.CounterSnapshot
}

type probeCounterPage struct {
	node, boot   string
	sessionEpoch uint64
	capturedAt   string
	coverage     probeCounterCoverage
	items        []probeCounterPoint
}

func addProbeCounterLoss(value *uint64, amount uint64) {
	if amount > ^uint64(0)-*value {
		*value = ^uint64(0)
	} else {
		*value += amount
	}
}

func probeCounterBinding(binding probe.Binding) proberesult.Binding {
	return proberesult.Binding{NodeId: binding.NodeID, BootId: binding.BootID, SessionEpoch: binding.SessionEpoch,
		SnapshotGeneration: binding.SnapshotGeneration, AssignmentId: binding.AssignmentID, ForwardId: binding.ForwardID,
		ForwardRevision: binding.ForwardRevision, DeploymentGeneration: binding.DeploymentGeneration,
		BindingFence: binding.BindingFence, ConfigDigest: binding.ConfigDigest, EgressPolicyRevision: binding.EgressPolicyRevision}
}

func probeCounterSourceIdentity(source probeCounterSource, values probe.CounterSnapshot) probeCounterIdentity {
	return probeCounterIdentity{Binding: probeCounterBinding(values.Binding),
		InstanceID: source.instance, InstanceGeneration: source.generation}
}

func probeCounterPointWith(identity probeCounterIdentity, values probe.CounterSnapshot, schedule runtimeplatform.Scheduler) probeCounterPoint {
	at := schedule.Now().UTC()
	state := "current"
	if !values.EndedAt.IsZero() {
		at, state = values.EndedAt, "terminal"
	}
	point := probeCounterPoint{Identity: identity, State: state, CapturedAt: observationwire.TimeText(at), Availability: "unavailable"}
	if state == "terminal" {
		ended := point.CapturedAt
		point.EndedAt = &ended
	}
	if !values.Available {
		return point
	}
	point.Availability = "available"
	point.CounterEpoch, point.Overflowed = &values.Epoch, &values.Overflowed
	point.Counters = &probeCounterValues{Attempted: observationwire.Uint64Text(values.Attempted),
		Succeeded: observationwire.Uint64Text(values.Succeeded), Failed: observationwire.Uint64Text(values.Failed),
		Unknown: observationwire.Uint64Text(values.Unknown), InFlight: observationwire.Uint64Text(values.InFlight)}
	return point
}

// Caller owns Runner.mutex. Frozen tails contain values only and never retain their reader.
func (runner *Runner) appendProbeCounterTailLocked(source probeCounterSource, values probe.CounterSnapshot) {
	identity := probeCounterSourceIdentity(source, values)
	for _, tail := range runner.probeCounterTails {
		if tail.identity == identity && tail.values.Epoch == values.Epoch {
			return
		}
	}
	if len(runner.probeCounterTails) == probeCounterTailLimit {
		copy(runner.probeCounterTails, runner.probeCounterTails[1:])
		runner.probeCounterTails = runner.probeCounterTails[:probeCounterTailLimit-1]
		addProbeCounterLoss(&runner.probeCounterTailsEvicted, 1)
	}
	runner.probeCounterTails = append(runner.probeCounterTails, probeCounterTail{identity: identity, values: values})
}

func sameProbeCounterSession(source probeCounterSource, node, boot string, epoch uint64) bool {
	return source.node == node && source.boot == boot && source.epoch == epoch
}

// Retiring readers are pure CounterSets: at most 8 * 256 Bindings, with no Gate, context or callbacks.
func (runner *Runner) refreshProbeCounterTailsLocked(now time.Time, node, boot string, epoch uint64) {
	keptTails := runner.probeCounterTails[:0]
	for _, tail := range runner.probeCounterTails {
		binding := tail.identity.Binding
		if binding.NodeId != node || binding.BootId != boot || binding.SessionEpoch != epoch ||
			now.Sub(tail.values.EndedAt) >= probeCounterRetention {
			addProbeCounterLoss(&runner.probeCounterTailsExpired, 1)
			continue
		}
		keptTails = append(keptTails, tail)
	}
	clear(runner.probeCounterTails[len(keptTails):])
	runner.probeCounterTails = keptTails
	keptSources := runner.probeCounterRetiring[:0]
	for _, source := range runner.probeCounterRetiring {
		values, frozen := source.reader.Snapshots()
		if !sameProbeCounterSession(source, node, boot, epoch) || now.Sub(source.retiredAt) >= probeCounterRetention {
			addProbeCounterLoss(&runner.probeCounterTailsExpired, uint64(len(values)))
			continue
		}
		if frozen {
			for _, value := range values {
				runner.appendProbeCounterTailLocked(source, value)
			}
			continue
		}
		keptSources = append(keptSources, source)
	}
	clear(runner.probeCounterRetiring[len(keptSources):])
	runner.probeCounterRetiring = keptSources
}

// Called after the original Gate.Close; it never waits for active probes or authority monitors.
func (runner *Runner) retainProbeCountersLocked(session *registeredProbe) {
	if !runner.options.ProbeTelemetry {
		return
	}
	reader := session.gate.CounterReader()
	if reader == nil {
		return
	}
	now := runner.scheduler().Now()
	runner.refreshProbeCounterTailsLocked(now, runner.options.NodeID, runner.options.BootID, runner.hello.SessionEpoch)
	source := probeCounterSource{node: session.node, boot: session.boot, epoch: session.epoch,
		instance: session.gate.InstanceID(), generation: session.generation, reader: reader, retiredAt: now}
	values, frozen := reader.Snapshots()
	if !sameProbeCounterSession(source, runner.options.NodeID, runner.options.BootID, runner.hello.SessionEpoch) {
		addProbeCounterLoss(&runner.probeCounterTailsExpired, uint64(len(values)))
		return
	}
	if frozen {
		for _, value := range values {
			runner.appendProbeCounterTailLocked(source, value)
		}
		return
	}
	for _, previous := range runner.probeCounterRetiring {
		if previous.reader == reader {
			return
		}
	}
	if len(runner.probeCounterRetiring) == probeCounterRetiringLimit {
		lost, _ := runner.probeCounterRetiring[0].reader.Snapshots()
		addProbeCounterLoss(&runner.probeCounterTailsEvicted, uint64(len(lost)))
		copy(runner.probeCounterRetiring, runner.probeCounterRetiring[1:])
		runner.probeCounterRetiring = runner.probeCounterRetiring[:probeCounterRetiringLimit-1]
	}
	runner.probeCounterRetiring = append(runner.probeCounterRetiring, source)
}

func (runner *Runner) captureProbeCounterPage() probeCounterPage {
	runner.mutex.Lock()
	node, boot, epoch := runner.options.NodeID, runner.options.BootID, runner.hello.SessionEpoch
	runner.refreshProbeCounterTailsLocked(runner.scheduler().Now(), node, boot, epoch)
	session := runner.probeRegistration
	var current probeCounterSource
	if session != nil && session.node == node && session.boot == boot && session.epoch == epoch {
		current = probeCounterSource{node: node, boot: boot, epoch: epoch, instance: session.gate.InstanceID(),
			generation: session.generation, reader: session.gate.CounterReader()}
	}
	sources := append([]probeCounterSource(nil), runner.probeCounterRetiring...)
	tails := append([]probeCounterTail(nil), runner.probeCounterTails...)
	evicted, expired, cursor := runner.probeCounterTailsEvicted, runner.probeCounterTailsExpired, runner.probeCounterCursor
	runner.mutex.Unlock()
	type pointKey struct {
		identity probeCounterIdentity
		epoch    string
	}
	points := make(map[pointKey]probeCounterPoint, 256+len(sources)*256+len(tails))
	addSource := func(source probeCounterSource) {
		values, _ := source.reader.Snapshots()
		for _, value := range values {
			binding := value.Binding
			if binding.NodeID != node || binding.BootID != boot || binding.SessionEpoch != epoch {
				continue
			}
			identity := probeCounterSourceIdentity(source, value)
			points[pointKey{identity: identity, epoch: value.Epoch}] = probeCounterPointWith(identity, value, runner.probeCounterScheduler())
		}
	}
	unavailable := 0
	if current.instance != "" {
		if !current.reader.Available() {
			unavailable = 1
		}
		addSource(current)
	}
	for _, source := range sources {
		addSource(source)
	}
	for _, tail := range tails {
		points[pointKey{identity: tail.identity, epoch: tail.values.Epoch}] = probeCounterPointWith(tail.identity, tail.values, runner.probeCounterScheduler())
	}
	type orderedPoint struct {
		key   string
		point probeCounterPoint
	}
	ordered := make([]orderedPoint, 0, len(points))
	for key, point := range points {
		identity, _ := observationwire.EncodeValue(key.identity)
		ordered = append(ordered, orderedPoint{key: string(identity) + "/" + key.epoch, point: point})
	}
	sort.Slice(ordered, func(left, right int) bool { return ordered[left].key < ordered[right].key })
	offset, next := 0, 0
	items := make([]probeCounterPoint, 0, min(len(ordered), probeCounterPageLimit))
	if len(ordered) > 0 {
		offset = int(cursor % uint64(len(ordered)))
		generations := make(map[uint64]bool)
		for scanned := 0; scanned < len(ordered) && len(items) < probeCounterPageLimit; scanned++ {
			point := ordered[(offset+scanned)%len(ordered)].point
			generation := point.Identity.Binding.SnapshotGeneration
			if !generations[generation] && len(generations) == probeCounterSnapshotLimit {
				continue
			}
			generations[generation] = true
			items = append(items, point)
		}
		if len(ordered) > len(items) {
			next = (offset + max(1, len(items))) % len(ordered)
		} else {
			offset = 0
		}
	}
	runner.mutex.Lock()
	runner.probeCounterCursor = uint64(next)
	runner.mutex.Unlock()
	return probeCounterPage{node: node, boot: boot, sessionEpoch: epoch, capturedAt: observationwire.UTCTimeText(runner.scheduler().Now()), items: items,
		coverage: probeCounterCoverage{Limit: probeCounterPageLimit, SnapshotLimit: probeCounterSnapshotLimit,
			Available: len(ordered), Returned: len(items), Omitted: len(ordered) - len(items), Truncated: len(ordered) > len(items),
			Offset: offset, NextOffset: next, UnavailableSources: unavailable, RetiringSourceLimit: probeCounterRetiringLimit,
			RetiringSources: len(sources), TailLimit: probeCounterTailLimit, TailRetentionSeconds: int(probeCounterRetention / time.Second),
			TailsEvicted: observationwire.Uint64Text(evicted), TailsExpired: observationwire.Uint64Text(expired), HistoryComplete: false}}
}
