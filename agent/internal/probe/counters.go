package probe

import (
	"encoding/hex"
	"sync"
	"time"

	probenative "github.com/tunex/vnext/agent/internal/probe/native"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

// CounterSnapshot contains detached operational values, never a reusable Permit or authority callback.
type CounterSnapshot struct {
	Binding    Binding
	Epoch      string
	Available  bool
	Attempted  uint64
	Succeeded  uint64
	Failed     uint64
	Unknown    uint64
	InFlight   uint64
	Overflowed bool
	EndedAt    time.Time
}

type counterEntry struct {
	attempted, succeeded, failed, unknown, inFlight uint64
	overflowed                                      bool
}

// CounterSet owns only measurements. It cannot authorize, cancel or start any work.
type CounterSet struct {
	mutex    sync.Mutex
	epoch    string
	entries  map[Binding]*counterEntry
	closing  bool
	calls    uint64
	endedAt  time.Time
	schedule runtimeplatform.Scheduler
}

type counterAttempt struct {
	registry *CounterSet
	entry    *counterEntry
	finished bool
}

type counterInvocation struct {
	registry      *CounterSet
	entry         *counterEntry
	started, left bool
}

func newCounterRegistry() *CounterSet {
	return newCounterRegistryWith(probenative.Schedule(), probenative.Entropy())
}

func newCounterRegistryWith(schedule runtimeplatform.Scheduler, entropy runtimeplatform.Entropy) *CounterSet {
	registry := &CounterSet{entries: make(map[Binding]*counterEntry), schedule: schedule}
	var epoch [16]byte
	if _, err := entropy.ReadRandom(epoch[:]); err == nil {
		registry.epoch = hex.EncodeToString(epoch[:])
	}
	return registry
}

func (registry *CounterSet) scheduler() runtimeplatform.Scheduler {
	if registry.schedule != nil {
		return registry.schedule
	}
	return probenative.Schedule()
}

func (entry *counterEntry) add(value *uint64, amount uint64) {
	if amount > ^uint64(0)-*value {
		*value = ^uint64(0)
		entry.overflowed = true
		return
	}
	*value += amount
}

func (registry *CounterSet) enter(binding Binding) *counterInvocation {
	if registry == nil {
		return nil
	}
	registry.mutex.Lock()
	defer registry.mutex.Unlock()
	if registry.closing {
		return nil
	}
	entry := registry.entries[binding]
	if entry == nil {
		// Gate's existing non-evicting 256-claim budget also bounds distinct measured Bindings.
		if len(registry.entries) >= 256 {
			return nil
		}
		entry = &counterEntry{}
		registry.entries[binding] = entry
	}
	registry.calls++
	return &counterInvocation{registry: registry, entry: entry}
}

func (invocation *counterInvocation) begin() *counterAttempt {
	if invocation == nil {
		return nil
	}
	registry := invocation.registry
	registry.mutex.Lock()
	defer registry.mutex.Unlock()
	if invocation.started || invocation.left {
		return nil
	}
	invocation.started = true
	entry := invocation.entry
	entry.add(&entry.attempted, 1)
	if registry.closing {
		// The existing final check may race Gate.Close before the actual dial.
		entry.add(&entry.unknown, 1)
	} else {
		entry.add(&entry.inFlight, 1)
	}
	return &counterAttempt{registry: registry, entry: entry}
}

func (invocation *counterInvocation) leave() {
	if invocation == nil {
		return
	}
	registry := invocation.registry
	registry.mutex.Lock()
	defer registry.mutex.Unlock()
	if invocation.left {
		return
	}
	invocation.left = true
	registry.calls--
	if registry.closing && registry.calls == 0 {
		registry.endedAt = registry.scheduler().Now().UTC()
	}
}

func (attempt *counterAttempt) finish(outcome string) {
	if attempt == nil {
		return
	}
	registry := attempt.registry
	registry.mutex.Lock()
	defer registry.mutex.Unlock()
	if attempt.finished {
		return
	}
	attempt.finished = true
	if registry.closing {
		return
	}
	entry := attempt.entry
	if entry.inFlight == 0 {
		entry.overflowed = true
		return
	}
	entry.inFlight--
	switch outcome {
	case "succeeded":
		entry.add(&entry.succeeded, 1)
	case "failed":
		entry.add(&entry.failed, 1)
	default:
		entry.add(&entry.unknown, 1)
	}
}

func (registry *CounterSet) seal() {
	if registry == nil {
		return
	}
	registry.mutex.Lock()
	defer registry.mutex.Unlock()
	if registry.closing {
		return
	}
	registry.closing = true
	if registry.calls == 0 {
		registry.endedAt = registry.scheduler().Now().UTC()
	}
	for _, entry := range registry.entries {
		entry.add(&entry.unknown, entry.inFlight)
		entry.inFlight = 0
	}
}

func (registry *CounterSet) Snapshots() ([]CounterSnapshot, bool) {
	if registry == nil {
		return nil, true
	}
	registry.mutex.Lock()
	defer registry.mutex.Unlock()
	result := make([]CounterSnapshot, 0, len(registry.entries))
	for binding, entry := range registry.entries {
		result = append(result, CounterSnapshot{Binding: binding, Epoch: registry.epoch, Available: registry.epoch != "",
			Attempted: entry.attempted, Succeeded: entry.succeeded, Failed: entry.failed, Unknown: entry.unknown,
			InFlight: entry.inFlight, Overflowed: entry.overflowed, EndedAt: registry.endedAt})
	}
	return result, !registry.endedAt.IsZero()
}

func (registry *CounterSet) Available() bool {
	return registry != nil && registry.epoch != ""
}

// EnableCounters opts in only this Gate. Failure to obtain an epoch never changes execution admission.
func (gate *Gate) EnableCounters() {
	registry := newCounterRegistryWith(gate.executor.scheduler(), gate.executor.randomSource())
	gate.mutex.Lock()
	defer gate.mutex.Unlock()
	if !gate.closed && gate.counters == nil {
		gate.counters = registry
	}
}

func (gate *Gate) CounterSnapshots() []CounterSnapshot {
	values, _ := gate.CounterReader().Snapshots()
	return values
}

func (gate *Gate) CounterReader() *CounterSet {
	gate.mutex.Lock()
	registry := gate.counters
	gate.mutex.Unlock()
	return registry
}
