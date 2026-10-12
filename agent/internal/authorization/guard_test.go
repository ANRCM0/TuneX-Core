package authorization

import (
	"errors"
	"testing"
	"time"
)

func fixture(t *testing.T) (*Guard, *Sample) {
	t.Helper()
	sample := &Sample{Wall: time.Unix(2000000000, 0).UTC(), Uptime: 100 * time.Hour}
	guard, err := New(func() (Sample, error) { return *sample, nil }, 5*time.Second, 300*time.Second, sample.Wall.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	return guard, sample
}
func TestSuspendAndExpiryCannotRenewOldTicket(t *testing.T) {
	guard, sample := fixture(t)
	old, err := guard.Accept(sample.Wall, sample.Wall.Add(20*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	sample.Wall = sample.Wall.Add(10 * time.Second)
	sample.Uptime += 10 * time.Second
	renewed, err := guard.Accept(sample.Wall, sample.Wall.Add(20*time.Second))
	if err != nil {
		t.Fatal(err)
	}
	sample.Wall = sample.Wall.Add(5 * time.Second)
	sample.Uptime += 5 * time.Second
	if old.Allow() == nil {
		t.Fatal("old ticket inherited renewal")
	}
	if err := renewed.Allow(); err != nil {
		t.Fatal(err)
	}
	sample.Wall = sample.Wall.Add(20 * time.Second)
	sample.Uptime += 20 * time.Second
	if renewed.Allow() == nil {
		t.Fatal("suspend extended authorization")
	}
	if _, err := guard.Accept(sample.Wall, sample.Wall.Add(300*time.Second)); err == nil {
		t.Fatal("late renewal resurrected expired session")
	}
}
func TestRollbackJumpAndClockFailureLatchClosed(t *testing.T) {
	for _, delta := range []time.Duration{-6 * time.Second, 6 * time.Second} {
		t.Run(delta.String(), func(t *testing.T) {
			guard, sample := fixture(t)
			ticket, err := guard.Accept(sample.Wall, sample.Wall.Add(300*time.Second))
			if err != nil {
				t.Fatal(err)
			}
			initial := *sample
			sample.Wall = sample.Wall.Add(delta)
			if ticket.Allow() == nil {
				t.Fatal("clock jump accepted")
			}
			*sample = initial
			if guard.Check() == nil {
				t.Fatal("failed guard resurrected")
			}
		})
	}
	guard, sample := fixture(t)
	ticket, _ := guard.Accept(sample.Wall, sample.Wall.Add(300*time.Second))
	guard.clock = func() (Sample, error) { return Sample{}, errors.New("failed") }
	if ticket.Allow() == nil {
		t.Fatal("failed clock read accepted")
	}
}
func TestCredentialAndDrainRespectEarliestCutoff(t *testing.T) {
	guard, sample := fixture(t)
	ticket, _ := guard.Accept(sample.Wall, sample.Wall.Add(20*time.Second))
	drain := ticket.Drain(30 * time.Second)
	if drain.Deadline() != ticket.Deadline() {
		t.Fatal("drain outlived authorization")
	}
	if err := guard.Credential(sample.Wall.Add(3 * time.Second)); err != nil {
		t.Fatal(err)
	}
	sample.Wall = sample.Wall.Add(3 * time.Second)
	sample.Uptime += 3 * time.Second
	if ticket.Allow() == nil {
		t.Fatal("expired credential accepted")
	}
}
func TestServerSkewAndInvalidLeaseAreRejected(t *testing.T) {
	guard, sample := fixture(t)
	if err := guard.ValidateServerTime(sample.Wall.Add(6 * time.Second)); err == nil {
		t.Fatal("server skew accepted")
	}
	guard, sample = fixture(t)
	if _, err := guard.Accept(sample.Wall.Add(6*time.Second), sample.Wall.Add(306*time.Second)); err == nil {
		t.Fatal("future issuance accepted")
	}
	if _, err := guard.Accept(sample.Wall, sample.Wall.Add(301*time.Second)); err == nil {
		t.Fatal("unbounded lease accepted")
	}
}
func TestSystemClockHasForwardUptime(t *testing.T) {
	a, err := SystemClock()
	if err != nil {
		t.Fatal(err)
	}
	time.Sleep(2 * time.Millisecond)
	b, err := SystemClock()
	if err != nil || b.Uptime < a.Uptime {
		t.Fatal("invalid platform uptime", err)
	}
}
