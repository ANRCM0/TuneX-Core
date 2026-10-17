package probe

import (
	"context"
	"errors"
	"net"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func gateFixture(t *testing.T) (*Gate, Grant, *Executor) {
	t.Helper()
	permit, target := testRequest(t)
	executor, _ := New(func(context.Context, Binding) (Target, error) { return target, nil })
	executor.dial = func(context.Context, string, string) (net.Conn, error) {
		return nil, errors.New("connection refused")
	}
	gate, err := NewGate(permit.Binding.NodeID, permit.Binding.BootID, permit.Binding.SessionEpoch, executor)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(gate.Close)
	return gate, Grant{PermitID: "permit-a", InstanceID: gate.InstanceID(), Permit: permit, Timeout: time.Second}, executor
}

func TestProbeGateConsumesBeforeAttemptAndDoesNotResetOnFailure(t *testing.T) {
	gate, grant, _ := gateFixture(t)
	result, err := gate.Run(context.Background(), grant)
	if err != nil || result.Status != "unreachable" {
		t.Fatalf("unexpected first attempt: %+v %v", result, err)
	}
	if _, err := gate.Run(context.Background(), grant); !errors.Is(err, ErrReplay) {
		t.Fatalf("same permit executed twice: %v", err)
	}
	other := grant
	other.PermitID = "permit-b"
	if _, err := gate.Run(context.Background(), other); !errors.Is(err, ErrBusy) {
		t.Fatalf("process Node cooldown bypassed: %v", err)
	}
	if _, err := gate.Run(context.Background(), other); !errors.Is(err, ErrReplay) {
		t.Fatalf("busy permit silently retryable: %v", err)
	}
}

func TestProbeGateRejectsForeignInstancesAndRequiresIndependentAuthority(t *testing.T) {
	gate, grant, _ := gateFixture(t)
	for _, mutate := range []func(*Grant){
		func(g *Grant) { g.InstanceID = strings.Repeat("b", 64) },
		func(g *Grant) { g.PermitID = "../permit" },
		func(g *Grant) { g.Permit.Binding.BootID = "retired-boot" },
		func(g *Grant) { g.Permit.Binding.SessionEpoch++ },
		func(g *Grant) { g.Permit.Binding.NodeID = "foreign-node" },
		func(g *Grant) { g.Permit.Check = nil },
		func(g *Grant) { g.Permit.Check = func() error { return ErrDenied } },
		func(g *Grant) { g.Permit.Until = time.Now().Add(3 * time.Second) },
		func(g *Grant) { g.Timeout = 2001 * time.Millisecond },
	} {
		copy := grant
		mutate(&copy)
		if _, err := gate.Run(context.Background(), copy); err == nil {
			t.Fatal("foreign or unauthorized grant accepted")
		}
	}
	if len(gate.claims) != 0 {
		t.Fatal("unverified inputs consumed replay capacity")
	}
	restarted, err := NewGate(grant.Permit.Binding.NodeID, grant.Permit.Binding.BootID,
		grant.Permit.Binding.SessionEpoch, gate.executor)
	if err != nil {
		t.Fatal(err)
	}
	defer restarted.Close()
	if restarted.InstanceID() == gate.InstanceID() {
		t.Fatal("new gate reused an old instance nonce")
	}
	if _, err := restarted.Run(context.Background(), grant); !errors.Is(err, ErrDenied) {
		t.Fatal("old permit survived instance restart")
	}
}

func TestProbeGateConcurrentDuplicateHasOnlyOneAttempt(t *testing.T) {
	gate, grant, executor := gateFixture(t)
	var attempts atomic.Int32
	executor.dial = func(context.Context, string, string) (net.Conn, error) {
		attempts.Add(1)
		return nil, errors.New("refused")
	}
	var workers sync.WaitGroup
	problems := make(chan error, 24)
	for range 24 {
		workers.Go(func() { _, err := gate.Run(context.Background(), grant); problems <- err })
	}
	workers.Wait()
	close(problems)
	success, duplicates := 0, 0
	for err := range problems {
		if err == nil {
			success++
		} else if errors.Is(err, ErrReplay) {
			duplicates++
		} else {
			t.Fatalf("unexpected duplicate outcome: %v", err)
		}
	}
	if attempts.Load() != 1 || success != 1 || duplicates != 23 {
		t.Fatalf("attempts=%d success=%d duplicates=%d", attempts.Load(), success, duplicates)
	}
}

func TestProbeGateCloseCancelsInflightAndDeniesFurtherWork(t *testing.T) {
	gate, grant, executor := gateFixture(t)
	entered := make(chan struct{})
	executor.dial = func(ctx context.Context, _, _ string) (net.Conn, error) {
		close(entered)
		<-ctx.Done()
		return nil, ctx.Err()
	}
	finished := make(chan error, 1)
	go func() { _, err := gate.Run(context.Background(), grant); finished <- err }()
	select {
	case <-entered:
	case err := <-finished:
		t.Fatalf("failed before dial: %v", err)
	case <-time.After(3 * time.Second):
		t.Fatal("dial not started")
	}
	gate.Close()
	select {
	case err := <-finished:
		if err == nil {
			t.Fatal("closed gate emitted evidence")
		}
	case <-time.After(3 * time.Second):
		t.Fatal("gate closure did not cancel network work")
	}
	grant.PermitID = "new-permit"
	if _, err := gate.Run(context.Background(), grant); !errors.Is(err, ErrDenied) {
		t.Fatal("closed gate accepted new work")
	}
	gate.Close()
}

func TestProbeGateCapacityNeverEvictsConsumedIDs(t *testing.T) {
	gate, grant, _ := gateFixture(t)
	for i := range 256 {
		gate.claims[strings.Repeat("a", i/128+1)+string(rune(i))] = nil
	}
	if _, err := gate.Run(context.Background(), grant); !errors.Is(err, ErrBusy) {
		t.Fatal("gate reset its full cache or exceeded capacity")
	}
	if len(gate.claims) != 256 {
		t.Fatal("used IDs were evicted")
	}
	gate.claims[grant.PermitID] = nil
	if _, err := gate.Run(context.Background(), grant); !errors.Is(err, ErrReplay) {
		t.Fatal("capacity check hid a replay")
	}
}
