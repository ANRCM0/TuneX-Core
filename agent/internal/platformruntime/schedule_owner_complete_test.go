package platformruntime

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"
)

func TestScheduleOwnerCompleteNativeTimersAndReadDomain(t *testing.T) {
	schedule := Schedule{}
	before := time.Now()
	now := schedule.Now()
	after := time.Now()
	if now.Before(before) || now.After(after) {
		t.Fatal("native Now domain changed")
	}
	start := time.Now().Add(-time.Second)
	beforeElapsed := time.Since(start)
	elapsed := schedule.Since(start)
	afterElapsed := time.Since(start)
	if elapsed < beforeElapsed || elapsed > afterElapsed {
		t.Fatalf("native Since %v outside %v..%v", elapsed, beforeElapsed, afterElapsed)
	}
	deadline := time.Now().Add(time.Hour)
	beforeRemaining := time.Until(deadline)
	remaining := schedule.Until(deadline)
	afterRemaining := time.Until(deadline)
	if remaining > beforeRemaining || remaining < afterRemaining {
		t.Fatalf("native Until %v outside %v..%v", remaining, afterRemaining, beforeRemaining)
	}
	select {
	case <-schedule.After(0):
	case <-time.After(5 * time.Second):
		t.Fatal("native After not delivered")
	}
	timed := schedule.NewTimer(time.Hour)
	native, ok := timed.(timer)
	if !ok || timed.C() != native.value.C || !timed.Stop() || timed.Stop() {
		t.Fatal("native timer channel/Stop forwarding")
	}
	completed := schedule.NewTimer(0)
	select {
	case <-completed.C():
	case <-time.After(5 * time.Second):
		t.Fatal("native timer did not fire")
	}
	if completed.Stop() {
		t.Fatal("completed timer Stop changed")
	}
	ticks := schedule.NewTicker(time.Hour)
	nativeTicker, ok := ticks.(ticker)
	if !ok || ticks.C() != nativeTicker.value.C {
		t.Fatal("native ticker channel changed")
	}
	ticks.Stop()
	ticks.Stop()
}

func TestScheduleOwnerCompleteNativeContextDeadlineAndAfterFunc(t *testing.T) {
	schedule := Schedule{}
	parent, parentCancel := context.WithCancel(context.Background())
	defer parentCancel()
	before := time.Now()
	timeout, cancel := schedule.WithTimeout(parent, time.Hour)
	after := time.Now()
	defer cancel()
	deadline, ok := timeout.Deadline()
	if !ok || deadline.Before(before.Add(time.Hour)) || deadline.After(after.Add(time.Hour)) {
		t.Fatal("native timeout deadline changed")
	}
	instant := time.Now().Add(2 * time.Hour)
	bounded, cancelBounded := schedule.WithDeadline(parent, instant)
	defer cancelBounded()
	if actual, ok := bounded.Deadline(); !ok || !actual.Equal(instant) {
		t.Fatal("native explicit deadline changed")
	}
	parentCancel()
	for _, ctx := range []context.Context{timeout, bounded} {
		select {
		case <-ctx.Done():
		case <-time.After(5 * time.Second):
			t.Fatal("parent cancel did not propagate")
		}
		if !errors.Is(ctx.Err(), context.Canceled) {
			t.Fatal("parent cancellation error changed")
		}
	}
	expired, expiredCancel := schedule.WithTimeout(context.Background(), 0)
	defer expiredCancel()
	if !errors.Is(expired.Err(), context.DeadlineExceeded) {
		t.Fatal("zero timeout not native expired")
	}
	past, pastCancel := schedule.WithDeadline(context.Background(), time.Now().Add(-time.Second))
	defer pastCancel()
	if !errors.Is(past.Err(), context.DeadlineExceeded) {
		t.Fatal("past deadline not native expired")
	}
	ctx, cancelWork := context.WithCancel(context.Background())
	var calls atomic.Int32
	done := make(chan struct{})
	stop := schedule.AfterFunc(ctx, func() { calls.Add(1); close(done) })
	cancelWork()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("native AfterFunc not called")
	}
	if stop() || calls.Load() != 1 {
		t.Fatal("started native AfterFunc stop/count changed")
	}
	quiet, quietCancel := context.WithCancel(context.Background())
	var unexpected atomic.Int32
	prevent := schedule.AfterFunc(quiet, func() { unexpected.Add(1) })
	if !prevent() || prevent() {
		t.Fatal("native AfterFunc stop idempotence")
	}
	quietCancel()
	if unexpected.Load() != 0 {
		t.Fatal("stopped callback executed")
	}
}
