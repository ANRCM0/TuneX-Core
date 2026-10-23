package payloadbudget

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func limit(value uint64) *uint64 { return &value }
func budgetPolicy() Policy {
	return Policy{Binding: Binding{BucketID: "bucket", ScopeID: "scope", ActorID: "actor", NodeID: "node", StartsAt: 0, EndsAt: 100000}, Revision: 1, BurstBytes: 4, ByteLimit: limit(100)}
}

type gateFixture struct {
	mutex     sync.Mutex
	sample    Sample
	history   *History
	waits     []time.Duration
	failure   error
	afterSave func()
	waitHook  func(time.Duration) <-chan time.Time
}

func newGateFixture(t *testing.T, policy Policy) (*gateFixture, *Gate) {
	t.Helper()
	history, err := AcceptHistory(nil, []Policy{policy}, "node")
	if err != nil {
		t.Fatal(err)
	}
	f := &gateFixture{sample: Sample{Wall: time.UnixMilli(1000), Monotonic: time.Hour}, history: history}
	gate, err := New(history.Buckets[policy.BucketID], f.clock, f.wait, f.precharge)
	if err != nil {
		t.Fatal(err)
	}
	return f, gate
}

func (f *gateFixture) clock() (Sample, error) {
	f.mutex.Lock()
	defer f.mutex.Unlock()
	return f.sample, nil
}
func (f *gateFixture) wait(delay time.Duration) <-chan time.Time {
	if f.waitHook != nil {
		return f.waitHook(delay)
	}
	f.mutex.Lock()
	f.waits = append(f.waits, delay)
	f.sample.Wall = f.sample.Wall.Add(delay)
	f.sample.Monotonic += delay
	at := f.sample.Wall
	f.mutex.Unlock()
	ready := make(chan time.Time, 1)
	ready <- at
	return ready
}
func (f *gateFixture) precharge(ctx context.Context, policy Policy, count uint64, at int64) (Record, error) {
	f.mutex.Lock()
	defer f.mutex.Unlock()
	if err := ctx.Err(); err != nil {
		return Record{}, err
	}
	record, err := Debit(f.history, policy, count, at)
	if err != nil {
		return record, err
	}
	if f.failure != nil {
		return Record{}, f.failure
	}
	f.history.Buckets[policy.BucketID] = record
	if f.afterSave != nil {
		f.afterSave()
	}
	return record, nil
}
func allow() error { return nil }

func TestSharedPayloadTCPUDPAndBothDirectionsConsumeOneConservativeBalance(t *testing.T) {
	policy := budgetPolicy()
	policy.ByteLimit = limit(10)
	f, gate := newGateFixture(t, policy)
	ingress := gate.WithAuthorization(allow)
	egress := gate.WithAuthorization(allow)
	if n, err := ingress.Acquire(context.Background(), 6, false); n != 6 || err != nil {
		t.Fatal(n, err)
	}
	// The caller may short-write or crash here. The six reserved bytes stay used.
	if n, err := egress.Acquire(context.Background(), 5, true); n != 0 || !errors.Is(err, ErrExhausted) {
		t.Fatal(n, err)
	}
	if f.history.Buckets[policy.BucketID].Consumed != 6 {
		t.Fatal("atomic refusal partially charged")
	}
	if n, err := egress.Acquire(context.Background(), 8, false); n != 4 || err != nil {
		t.Fatal(n, err)
	}
	if !errors.Is(gate.Check(), ErrExhausted) || f.history.Buckets[policy.BucketID].Consumed != 10 {
		t.Fatal("aggregate hard limit escaped")
	}
	if n, err := ingress.Acquire(context.Background(), 1, false); n != 0 || !errors.Is(err, ErrExhausted) {
		t.Fatal(n, err)
	}
}

func TestPayloadRateStartsEmptyAndRestartDoesNotMintBurst(t *testing.T) {
	policy := budgetPolicy()
	policy.BytesPerSecond = limit(4)
	f, gate := newGateFixture(t, policy)
	if n, err := gate.WithAuthorization(allow).Acquire(context.Background(), 4, true); n != 4 || err != nil {
		t.Fatal(n, err)
	}
	if len(f.waits) != 10 {
		t.Fatal("initial rate credit was minted", f.waits)
	}
	before := f.sample.Monotonic
	restarted, err := New(f.history.Buckets[policy.BucketID], f.clock, f.wait, f.precharge)
	if err != nil {
		t.Fatal(err)
	}
	if n, err := restarted.WithAuthorization(allow).Acquire(context.Background(), 4, true); n != 4 || err != nil {
		t.Fatal(n, err)
	}
	if f.sample.Monotonic-before != time.Second || f.history.Buckets[policy.BucketID].Consumed != 8 {
		t.Fatal("restart reset durable use or minted tokens")
	}
	if n, err := gate.WithAuthorization(allow).Acquire(context.Background(), 5, true); n != 0 || err == nil {
		t.Fatal("oversized atomic datagram waited forever or partially sent", n, err)
	}
}

func TestPayloadWaitRetainsCancellationAndPerInstanceAuthorization(t *testing.T) {
	policy := budgetPolicy()
	policy.BytesPerSecond = limit(1)
	f, gate := newGateFixture(t, policy)
	ctx, cancel := context.WithCancel(context.Background())
	f.waitHook = func(time.Duration) <-chan time.Time { cancel(); return make(chan time.Time) }
	if n, err := gate.WithAuthorization(allow).Acquire(ctx, 1, true); n != 0 || !errors.Is(err, context.Canceled) {
		t.Fatal(n, err)
	}
	if f.history.Buckets[policy.BucketID].Consumed != 0 {
		t.Fatal("cancelled wait charged payload")
	}
	f.waitHook = nil
	checks := 0
	ended := errors.New("original lease ended")
	bound := gate.WithAuthorization(func() error {
		checks++
		if checks > 2 {
			return ended
		}
		return nil
	})
	if n, err := bound.Acquire(context.Background(), 1, true); n != 0 || err != ended {
		t.Fatal(n, err)
	}
	if f.history.Buckets[policy.BucketID].Consumed != 0 {
		t.Fatal("expired waiter charged payload")
	}
	bound.SetAuthorization(allow)
	if n, err := bound.Acquire(context.Background(), 1, true); n != 1 || err != nil {
		t.Fatal("renewed original holder cannot resume", n, err)
	}
}

func TestPayloadSaveFailureAndPeriodEndNeverAuthorizeWrite(t *testing.T) {
	policy := budgetPolicy()
	f, gate := newGateFixture(t, policy)
	failure := errors.New("fsync failed")
	f.failure = failure
	if n, err := gate.WithAuthorization(allow).Acquire(context.Background(), 2, false); n != 0 || err != failure {
		t.Fatal(n, err)
	}
	if gate.Check() != failure || f.history.Buckets[policy.BucketID].Consumed != 0 {
		t.Fatal("failed save admitted payload")
	}
	f.failure = nil
	if n, err := gate.WithAuthorization(allow).Acquire(context.Background(), 2, false); n != 0 || err != failure {
		t.Fatal("storage failure silently recovered", n, err)
	}
	fresh, err := New(f.history.Buckets[policy.BucketID], f.clock, f.wait, f.precharge)
	if err != nil {
		t.Fatal(err)
	}
	f.afterSave = func() { f.sample.Wall = time.UnixMilli(policy.EndsAt) }
	if n, err := fresh.WithAuthorization(allow).Acquire(context.Background(), 2, false); n != 0 || !errors.Is(err, ErrPeriod) {
		t.Fatal(n, err)
	}
	if f.history.Buckets[policy.BucketID].Consumed != 2 {
		t.Fatal("ambiguous reservation was refunded")
	}
}

func TestPayloadLowerThenIncreaseRetainsUsedAndRecoversWithoutRebinding(t *testing.T) {
	policy := budgetPolicy()
	f, gate := newGateFixture(t, policy)
	bound := gate.WithAuthorization(allow)
	if n, err := bound.Acquire(context.Background(), 10, false); n != 10 || err != nil {
		t.Fatal(n, err)
	}
	lower := ClonePolicy(policy)
	lower.Revision++
	lower.ByteLimit = limit(5)
	next, err := AcceptHistory(f.history, []Policy{lower}, "node")
	if err != nil {
		t.Fatal(err)
	}
	f.history = next
	if n, err := bound.Acquire(context.Background(), 1, false); n != 0 || !errors.Is(err, ErrExhausted) {
		t.Fatal("stale gate ignored lower revision", n, err)
	}
	if f.history.Buckets[policy.BucketID].Consumed != 10 {
		t.Fatal("lowering reset used")
	}
	increase := ClonePolicy(lower)
	increase.Revision++
	increase.ByteLimit = limit(20)
	f.history, err = AcceptHistory(f.history, []Policy{increase}, "node")
	if err != nil {
		t.Fatal(err)
	}
	if err := gate.Configure(f.history.Buckets[policy.BucketID]); err != nil {
		t.Fatal(err)
	}
	if n, err := bound.Acquire(context.Background(), 10, true); n != 10 || err != nil {
		t.Fatal("higher policy could not reuse stable gate", n, err)
	}
}

func TestPayloadConcurrentAssignmentsCannotOverspend(t *testing.T) {
	policy := budgetPolicy()
	f, gate := newGateFixture(t, policy)
	var accepted atomic.Int32
	var workers sync.WaitGroup
	for index := 0; index < 20; index++ {
		workers.Add(1)
		go func() {
			defer workers.Done()
			n, err := gate.WithAuthorization(allow).Acquire(context.Background(), 10, true)
			if err == nil && n == 10 {
				accepted.Add(1)
			} else if n != 0 || !errors.Is(err, ErrExhausted) {
				t.Errorf("reservation %d %v", n, err)
			}
		}()
	}
	workers.Wait()
	if accepted.Load() != 10 || f.history.Buckets[policy.BucketID].Consumed != 100 {
		t.Fatal("concurrent aggregate escaped", accepted.Load(), f.history)
	}
}

func TestPayloadImmutableBindingRollbackOverlapAndCapacityRetainHistory(t *testing.T) {
	policy := budgetPolicy()
	history, err := AcceptHistory(nil, []Policy{policy}, "node")
	if err != nil {
		t.Fatal(err)
	}
	record := history.Buckets[policy.BucketID]
	record.Consumed = 9
	history.Buckets[policy.BucketID] = record
	for _, mutate := range []func(*Policy){func(p *Policy) { p.ActorID = "other" }, func(p *Policy) { p.StartsAt++ }, func(p *Policy) { p.Revision = 0 }, func(p *Policy) { p.ByteLimit = limit(1) }, func(p *Policy) { p.BucketID = "new-id" }} {
		changed := ClonePolicy(policy)
		mutate(&changed)
		if _, err := AcceptHistory(history, []Policy{changed}, "node"); err == nil {
			t.Fatal("unsafe policy accepted", changed)
		}
	}
	period := ClonePolicy(policy)
	period.BucketID = "next-period"
	period.StartsAt = policy.EndsAt
	period.EndsAt += 100000
	retained, err := AcceptHistory(history, []Policy{period}, "node")
	if err != nil {
		t.Fatal(err)
	}
	if len(retained.Buckets) != 2 || retained.Buckets[policy.BucketID].Consumed != 9 {
		t.Fatal("new cycle discarded old history")
	}
	full := &History{Version: 1, Buckets: map[string]Record{}}
	for index := 0; index < MaxBuckets; index++ {
		p := ClonePolicy(policy)
		p.BucketID = fmt.Sprintf("bucket-%d", index)
		p.ActorID = fmt.Sprintf("actor-%d", index)
		full.Buckets[p.BucketID] = Record{Policy: p}
	}
	newcomer := ClonePolicy(policy)
	newcomer.BucketID = "overflow"
	newcomer.ActorID = "new-actor"
	if _, err := AcceptHistory(full, []Policy{newcomer}, "node"); err == nil || len(full.Buckets) != MaxBuckets {
		t.Fatal("protected history evicted instead of refusing")
	}
}

func TestEmptyDatagramStillChecksPeriodZeroRateAndExhaustion(t *testing.T) {
	for _, kind := range []string{"active", "zero-rate", "exhausted", "expired"} {
		t.Run(kind, func(t *testing.T) {
			policy := budgetPolicy()
			if kind == "zero-rate" {
				policy.BytesPerSecond = limit(0)
			}
			if kind == "exhausted" {
				policy.ByteLimit = limit(0)
			}
			f, gate := newGateFixture(t, policy)
			if kind == "expired" {
				f.sample.Wall = time.UnixMilli(policy.EndsAt)
			}
			n, err := gate.WithAuthorization(allow).Acquire(context.Background(), 0, true)
			if n != 0 || (err == nil) != (kind == "active") || f.history.Buckets[policy.BucketID].Consumed != 0 {
				t.Fatal("empty datagram bypassed policy or charged payload", n, err)
			}
		})
	}
}
