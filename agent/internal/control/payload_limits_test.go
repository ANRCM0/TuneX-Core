package control

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/payloadbudget"
	"github.com/tunex/vnext/agent/internal/state"
)

func runnerPayloadSnapshot(t *testing.T, now time.Time, generation uint64, assignments []adp3.Assignment, bucket *adp3.ResourceLimitBucket) []byte {
	t.Helper()
	snapshot, _ := runnerOwnerSnapshot(t, now, generation, assignments)
	if bucket != nil {
		snapshot.ResourceLimits = &adp3.ResourceLimits{Version: 1, Buckets: []adp3.ResourceLimitBucket{*bucket}}
	}
	raw, err := json.Marshal(snapshot)
	if err != nil {
		t.Fatal(err)
	}
	var body map[string]json.RawMessage
	if err := json.Unmarshal(raw, &body); err != nil {
		t.Fatal(err)
	}
	delete(body, "snapshotDigest")
	snapshot.SnapshotDigest, err = contracts.ComputeDigest(body)
	if err != nil {
		t.Fatal(err)
	}
	raw, err = json.Marshal(snapshot)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func runnerPayloadBucket(now time.Time, assignment string) adp3.ResourceLimitBucket {
	limit := uint64(100)
	return adp3.ResourceLimitBucket{BucketId: "shared-bucket", ScopeId: "scope", ActorId: "actor", NodeId: "node", Revision: 1, StartsAt: now.Add(-time.Hour).Format("2006-01-02T15:04:05.000Z"), EndsAt: now.Add(time.Hour).Format("2006-01-02T15:04:05.000Z"), BurstBytes: 65536, ByteLimit: &limit, AssignmentIds: []string{assignment}}
}

func TestRunnerPayloadStartRenewRemoveAndOldDrainUseOriginalJournal(t *testing.T) {
	r, clock, trace, assignment := newRunnerOwnerPoll(t)
	bucket := runnerPayloadBucket(clock.now, assignment.AssignmentId)
	raw := runnerPayloadSnapshot(t, clock.now, 2, []adp3.Assignment{assignment}, &bucket)
	r.providers.Channel = &timeOwnerChannel{trace: trace, request: func(method, path string, body []byte, epoch bool, session uint64) ([]byte, error) {
		if method == "POST" && path == "/agent/v3/report" {
			return json.Marshal(adp3.ReportAck{ProtocolVersion: 3, NodeId: "node", BootId: "boot", SessionEpoch: 2, ReportSequence: r.sequence, Status: "accepted"})
		}
		if method != "GET" {
			t.Fatal(method, path)
		}
		return raw, nil
	}}
	events := []string{}
	starts := 0
	var shared *payloadbudget.Gate
	driver := nativeDirectDriver()
	if !slices.Contains(driver.descriptor.capabilities, sharedPayloadCapability) {
		driver.descriptor.capabilities = append(driver.descriptor.capabilities, sharedPayloadCapability)
	}
	driver.start = func(host executionHost, a adp3.Assignment, check func() error) (execution, error) {
		starts++
		durable, err := state.LoadRuntimeJournal(r.options.Journal, r.key, "node")
		if err != nil || durable.Journal.Generation != r.journal.Generation {
			t.Fatal("bind preceded durable acceptance", err)
		}
		if starts == 1 {
			bound, ok := host.payload.(*payloadbudget.AuthorizedGate)
			if !ok || check() != nil {
				t.Fatal("limited assignment received no original gate")
			}
			shared = bound.Shared()
			if n, err := host.payload.Acquire(context.Background(), 7, false); n != 7 || err != nil {
				t.Fatal(n, err)
			}
		} else if host.payload != nil {
			t.Fatal("policy removal retained active gate")
		}
		return &runnerOwnerStream{runner: r, name: fmt.Sprintf("instance-%d", starts), events: &events, count: 1}, nil
	}
	driver.replace = func(execution, adp3.Assignment, func() error) (execution, error) {
		t.Fatal("limited hostless replacement reached engine")
		return nil, nil
	}
	driver.phase = func(execution, string) error { return nil }
	registry, err := newExecutionRegistry(driver)
	if err != nil {
		t.Fatal(err)
	}
	original := builtinExecutionDrivers
	builtinExecutionDrivers = registry
	defer func() { builtinExecutionDrivers = original }()
	if err := r.poll(context.Background()); err != nil {
		t.Fatal(err)
	}
	first := r.instances["tcp/23456"]
	holder := first.payload
	raw = runnerPayloadSnapshot(t, clock.now, 3, []adp3.Assignment{assignment}, &bucket)
	if err := r.poll(context.Background()); err != nil {
		t.Fatal(err)
	}
	if starts != 1 || r.instances["tcp/23456"].stream != first.stream || r.instances["tcp/23456"].payload != holder || holder.Shared() != shared {
		t.Fatal("authorization renewal restarted or rebound original gate")
	}
	loaded, err := state.LoadRuntimeJournal(r.options.Journal, r.key, "node")
	if err != nil || loaded.ResourceBudgets.Buckets[bucket.BucketId].Consumed != 7 {
		t.Fatal("Snapshot acceptance lost payload debit", err)
	}
	// Retiring executions retain their own bound gate when active policy is removed.
	r.mutex.Lock()
	r.beginDrain(first, clock.now, r.deadline)
	r.mutex.Unlock()
	raw = runnerPayloadSnapshot(t, clock.now, 4, []adp3.Assignment{assignment}, nil)
	if err := r.poll(context.Background()); err != nil {
		t.Fatal(err)
	}
	if starts != 2 || r.instances["tcp/23456"].payload != nil || len(r.drains) != 1 {
		t.Fatal("policy removal did not close/start with explicit host")
	}
	for _, drain := range r.drains {
		if drain.instance.payload.Shared() != shared {
			t.Fatal("old drain inherited new active policy")
		}
	}
}

func TestRunnerPayloadUnsupportedDriverRefusesBeforeDurableAccept(t *testing.T) {
	r, clock, trace, assignment := newRunnerOwnerPoll(t)
	bucket := runnerPayloadBucket(clock.now, assignment.AssignmentId)
	raw := runnerPayloadSnapshot(t, clock.now, 2, []adp3.Assignment{assignment}, &bucket)
	r.providers.Channel = &timeOwnerChannel{trace: trace, request: func(string, string, []byte, bool, uint64) ([]byte, error) { return raw, nil }}
	driver := nativeDirectDriver()
	driver.descriptor.capabilities = []string{"native.direct.v1", "tcp", "udp"}
	driver.start = func(executionHost, adp3.Assignment, func() error) (execution, error) {
		t.Fatal("unsupported driver started")
		return nil, nil
	}
	registry, err := newExecutionRegistry(driver)
	if err != nil {
		t.Fatal(err)
	}
	original := builtinExecutionDrivers
	builtinExecutionDrivers = registry
	defer func() { builtinExecutionDrivers = original }()
	if err := r.poll(context.Background()); err == nil {
		t.Fatal("limited assignment ran unsupported")
	}
	loaded, err := state.LoadRuntimeJournal(r.options.Journal, r.key, "node")
	if err != nil || loaded.Journal.Generation != 1 || loaded.ResourceBudgets != nil {
		t.Fatal("unsupported limited execution advanced durable history", err)
	}
}

func TestRunnerPayloadWatchStopsIdleActiveAndDrainingInstances(t *testing.T) {
	policy := payloadbudget.Policy{Binding: payloadbudget.Binding{BucketID: "bucket", ScopeID: "scope", ActorID: "actor", NodeID: "node", StartsAt: 0, EndsAt: 2000}, Revision: 1, BurstBytes: 1, ByteLimit: new(uint64)}
	gate, err := payloadbudget.New(payloadbudget.Record{Policy: policy}, func() (payloadbudget.Sample, error) {
		return payloadbudget.Sample{Wall: time.UnixMilli(1000), Monotonic: time.Second}, nil
	}, func(time.Duration) <-chan time.Time { return make(chan time.Time) }, func(context.Context, payloadbudget.Policy, uint64, int64) (payloadbudget.Record, error) {
		t.Fatal("exhausted watcher attempted debit")
		return payloadbudget.Record{}, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	r := &Runner{instances: map[string]running{}, drains: map[string]draining{}}
	events := []string{}
	bound := gate.WithAuthorization(func() error { return nil })
	active := &runnerOwnerStream{runner: r, name: "active", events: &events}
	drain := &runnerOwnerStream{runner: r, name: "drain", events: &events}
	r.instances["active"] = running{stream: active, payload: bound}
	r.drains["old"] = draining{instance: running{stream: drain, payload: bound}}
	r.mutex.Lock()
	r.stopPayloadLimitedLocked()
	r.mutex.Unlock()
	if active.closed != 1 || drain.closed != 1 || len(r.instances) != 0 || len(r.drains) != 0 {
		t.Fatal("idle exhausted instances survived")
	}
}

func TestRunnerControlOnlyBucketRevisesExistingDrainWithoutActiveAssignments(t *testing.T) {
	r, clock, trace, assignment := newRunnerOwnerPoll(t)
	bucket := runnerPayloadBucket(clock.now, assignment.AssignmentId)
	raw := runnerPayloadSnapshot(t, clock.now, 2, []adp3.Assignment{assignment}, &bucket)
	r.providers.Channel = &timeOwnerChannel{trace: trace, request: func(method, path string, body []byte, epoch bool, session uint64) ([]byte, error) {
		if method == "POST" && path == "/agent/v3/report" {
			return json.Marshal(adp3.ReportAck{ProtocolVersion: 3, NodeId: "node", BootId: "boot", SessionEpoch: 2, ReportSequence: r.sequence, Status: "accepted"})
		}
		if method != "GET" {
			t.Fatal(method, path)
		}
		return raw, nil
	}}
	events := []string{}
	stream := &runnerOwnerStream{runner: r, name: "limited-drain", events: &events, count: 1}
	driver := nativeDirectDriver()
	if !slices.Contains(driver.descriptor.capabilities, sharedPayloadCapability) {
		driver.descriptor.capabilities = append(driver.descriptor.capabilities, sharedPayloadCapability)
	}
	driver.start = func(host executionHost, a adp3.Assignment, check func() error) (execution, error) {
		if host.payload == nil {
			t.Fatal("missing limited host")
		}
		return stream, nil
	}
	driver.phase = func(execution, string) error { return nil }
	registry, err := newExecutionRegistry(driver)
	if err != nil {
		t.Fatal(err)
	}
	original := builtinExecutionDrivers
	builtinExecutionDrivers = registry
	defer func() { builtinExecutionDrivers = original }()
	if err := r.poll(context.Background()); err != nil {
		t.Fatal(err)
	}
	first := r.instances["tcp/23456"]
	shared := first.payload.Shared()
	if n, err := first.payload.Acquire(context.Background(), 7, false); n != 7 || err != nil {
		t.Fatal(n, err)
	}
	r.mutex.Lock()
	r.beginDrain(first, clock.now, r.deadline)
	r.mutex.Unlock()
	bucket.Revision++
	bucket.AssignmentIds = []string{}
	zero := uint64(0)
	bucket.ByteLimit = &zero
	raw = runnerPayloadSnapshot(t, clock.now, 3, []adp3.Assignment{}, &bucket)
	if err := r.poll(context.Background()); err != nil {
		t.Fatal(err)
	}
	if len(r.instances) != 0 || len(r.drains) != 1 || r.payloadGates[bucket.BucketId] != shared {
		t.Fatal("control-only policy lost old drain gate")
	}
	loaded, err := state.LoadRuntimeJournal(r.options.Journal, r.key, "node")
	if err != nil || loaded.ResourceBudgets.Buckets[bucket.BucketId].Revision != 2 || loaded.ResourceBudgets.Buckets[bucket.BucketId].Consumed != 7 {
		t.Fatal("drain revision reset or failed to persist used bytes", loaded, err)
	}
	if err := first.payload.Check(); err == nil {
		t.Fatal("control-only zero limit left drain authorized")
	}
	r.mutex.Lock()
	r.stopPayloadLimitedLocked()
	r.mutex.Unlock()
	if len(r.drains) != 0 || stream.closed == 0 {
		t.Fatal("watch retained exhausted old drain")
	}
}
