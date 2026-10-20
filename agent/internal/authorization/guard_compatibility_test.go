package authorization

import (
	"errors"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/executiontime"
)

// These assignments protect the old source names as aliases, not lookalike types.
var (
	_ executiontime.Clock   = Clock(nil)
	_ Clock                 = executiontime.Clock(nil)
	_ executiontime.Sample  = Sample{}
	_ Sample                = executiontime.Sample{}
	_ *executiontime.Ticket = (*Ticket)(nil)
	_ *Ticket               = (*executiontime.Ticket)(nil)
)

func compatibilityGuard(t *testing.T) (*Guard, *Ticket, Sample, *int) {
	t.Helper()
	sample := Sample{Wall: time.Date(2026, 10, 19, 1, 2, 3, 0, time.UTC), Uptime: time.Hour}
	calls := 0
	guard, err := New(func() (Sample, error) { calls++; return sample, nil }, time.Second, time.Minute, sample.Wall.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	ticket, err := guard.Accept(sample.Wall, sample.Wall.Add(30*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	calls = 0
	return guard, ticket, sample, &calls
}

func TestLegacyGuardClockReplacementReachesEveryMethodAndExistingTicket(t *testing.T) {
	for _, method := range []string{"check", "server", "credential", "accept", "allow", "drain"} {
		t.Run(method, func(t *testing.T) {
			guard, ticket, sample, originalCalls := compatibilityGuard(t)
			owner := guard.value
			replacementCalls := 0
			sample.Wall = sample.Wall.Add(time.Second)
			sample.Uptime += time.Second
			guard.clock = func() (Sample, error) { replacementCalls++; return sample, nil }
			var err error
			switch method {
			case "check":
				err = guard.Check()
			case "server":
				err = guard.ValidateServerTime(sample.Wall)
			case "credential":
				err = guard.Credential(sample.Wall.Add(time.Hour))
			case "accept":
				_, err = guard.Accept(sample.Wall, sample.Wall.Add(30*time.Second))
			case "allow":
				err = ticket.Allow()
			case "drain":
				drain := ticket.Drain(3 * time.Second)
				if drain.Deadline() != sample.Wall.Add(3*time.Second) {
					t.Fatal("drain used captured old clock")
				}
			}
			if err != nil || *originalCalls != 0 || replacementCalls != 1 || guard.value != owner {
				t.Fatalf("old=%d replacement=%d sameOwner=%v err=%v", *originalCalls, replacementCalls, guard.value == owner, err)
			}
		})
	}
}

func TestLegacyClockFailureLatchPrecedesReplacementClockAndNewParameters(t *testing.T) {
	guard, ticket, sample, originalCalls := compatibilityGuard(t)
	failureCalls := 0
	guard.clock = func() (Sample, error) { failureCalls++; return Sample{}, errors.New("private clock failure") }
	latched := ticket.Allow()
	if latched == nil || latched.Error() != "CLOCK_UNCERTAIN: clock read failed" || failureCalls != 1 {
		t.Fatalf("clock failure not latched: %v", latched)
	}
	healthyCalls := 0
	guard.clock = func() (Sample, error) { healthyCalls++; return sample, nil }
	checks := []error{
		guard.Check(), guard.ValidateServerTime(time.Time{}), guard.Credential(time.Time{}), ticket.Allow(),
	}
	next, err := guard.Accept(sample.Wall.Add(100*time.Hour), time.Time{})
	checks = append(checks, err)
	if next != nil {
		t.Fatal("latched guard issued new authority")
	}
	drain := ticket.Drain(time.Hour)
	if !drain.Deadline().IsZero() {
		t.Fatal("failed drain acquired a valid wall deadline")
	}
	checks = append(checks, drain.Allow())
	for _, err := range checks {
		if err != latched {
			t.Fatalf("later parameter/provider changed original failure identity: got=%v want=%v", err, latched)
		}
	}
	if healthyCalls != 0 || *originalCalls != 0 || failureCalls != 1 {
		t.Fatalf("failed guard sampled again: healthy=%d old=%d failed=%d", healthyCalls, *originalCalls, failureCalls)
	}
}

func TestLegacyGuardConstructorRefusesInvalidOptionsBeforeClockAndPreservesReadError(t *testing.T) {
	for _, vector := range []struct {
		name          string
		nilClock      bool
		skew, maximum time.Duration
	}{
		{"nil-clock", true, time.Second, time.Minute},
		{"zero-skew", false, 0, time.Minute},
		{"negative-skew", false, -time.Second, time.Minute},
		{"maximum-equal-skew", false, time.Second, time.Second},
		{"maximum-below-skew", false, time.Second, time.Millisecond},
	} {
		t.Run(vector.name, func(t *testing.T) {
			calls := 0
			clock := Clock(func() (Sample, error) { calls++; return Sample{}, errors.New("must not sample") })
			if vector.nilClock {
				clock = nil
			}
			guard, err := New(clock, vector.skew, vector.maximum, time.Time{})
			if guard != nil || err == nil || err.Error() != "INVALID_CONFIG: invalid authorization timing" || calls != 0 {
				t.Fatalf("constructor order changed: guard=%v calls=%d err=%v", guard, calls, err)
			}
		})
	}
	failure := errors.New("initial clock read")
	calls := 0
	guard, err := New(func() (Sample, error) { calls++; return Sample{}, failure }, time.Second, time.Minute, time.Time{})
	if guard != nil || err != failure || calls != 1 {
		t.Fatalf("initial read outcome changed: guard=%v calls=%d err=%v", guard, calls, err)
	}
}

func TestLegacyNilTicketAllowKeepsLowerRefusal(t *testing.T) {
	var legacy *Ticket
	var lower *executiontime.Ticket
	for _, ticket := range []*executiontime.Ticket{legacy, lower} {
		if err := ticket.Allow(); err == nil || err.Error() != "LEASE_EXPIRED: no execution authorization" {
			t.Fatalf("nil Ticket refusal changed: %v", err)
		}
	}
}
