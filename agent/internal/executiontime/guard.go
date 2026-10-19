package executiontime

import (
	"fmt"
	"sync"
	"time"
)

type Guard struct {
	mutex           sync.Mutex
	clock           Clock
	origin          Sample
	last            Sample
	skew            time.Duration
	maximum         time.Duration
	credentialUntil time.Time
	failed          error
	currentUntil    time.Duration
	hasCurrent      bool
}
type Ticket struct {
	guard     *Guard
	until     time.Duration
	wallUntil time.Time
}

func New(clock Clock, skew, maximum time.Duration, credentialUntil time.Time) (*Guard, error) {
	if clock == nil || skew <= 0 || maximum <= skew {
		return nil, fmt.Errorf("INVALID_CONFIG: invalid authorization timing")
	}
	sample, err := clock()
	if err != nil {
		return nil, err
	}
	if sample.Uptime < 0 || sample.Wall.IsZero() {
		return nil, fmt.Errorf("CLOCK_UNCERTAIN: invalid clock sample")
	}
	return &Guard{clock: clock, origin: sample, last: sample, skew: skew, maximum: maximum, credentialUntil: credentialUntil}, nil
}
func (guard *Guard) sampleLocked() (Sample, error) {
	if guard.failed != nil {
		return Sample{}, guard.failed
	}
	sample, err := guard.clock()
	if err != nil {
		guard.failed = fmt.Errorf("CLOCK_UNCERTAIN: clock read failed")
		return Sample{}, guard.failed
	}
	delta := sample.Wall.Sub(guard.origin.Wall) - (sample.Uptime - guard.origin.Uptime)
	if sample.Uptime < guard.last.Uptime || sample.Wall.Before(guard.last.Wall.Add(-guard.skew)) || delta > guard.skew || delta < -guard.skew {
		guard.failed = fmt.Errorf("CLOCK_UNCERTAIN: wall and uptime history diverged")
		return Sample{}, guard.failed
	}
	guard.last = sample
	if !guard.credentialUntil.IsZero() && !sample.Wall.Before(guard.credentialUntil) {
		guard.failed = fmt.Errorf("LEASE_EXPIRED: credential expired")
		return Sample{}, guard.failed
	}
	return sample, nil
}
func (guard *Guard) Check() error {
	guard.mutex.Lock()
	defer guard.mutex.Unlock()
	_, err := guard.sampleLocked()
	return err
}
func (guard *Guard) ValidateServerTime(server time.Time) error {
	guard.mutex.Lock()
	defer guard.mutex.Unlock()
	sample, err := guard.sampleLocked()
	if err != nil {
		return err
	}
	delta := sample.Wall.Sub(server)
	if delta > guard.skew || delta < -guard.skew {
		guard.failed = fmt.Errorf("CLOCK_UNCERTAIN: server clock skew exceeds policy")
		return guard.failed
	}
	return nil
}
func (guard *Guard) Credential(until time.Time) error {
	guard.mutex.Lock()
	defer guard.mutex.Unlock()
	if _, err := guard.sampleLocked(); err != nil {
		return err
	}
	guard.credentialUntil = until
	return nil
}
func (guard *Guard) Accept(issued, valid time.Time) (*Ticket, error) {
	guard.mutex.Lock()
	defer guard.mutex.Unlock()
	sample, err := guard.sampleLocked()
	if err != nil {
		return nil, err
	}
	if guard.hasCurrent && sample.Uptime >= guard.currentUntil {
		return nil, fmt.Errorf("LEASE_EXPIRED: expired execution requires a new online session")
	}
	if issued.After(sample.Wall.Add(guard.skew)) || !valid.After(issued) || valid.Sub(issued) > guard.maximum {
		return nil, fmt.Errorf("LEASE_EXPIRED: invalid snapshot time window")
	}
	cutoff := valid.Add(-guard.skew)
	if !guard.credentialUntil.IsZero() && guard.credentialUntil.Before(cutoff) {
		cutoff = guard.credentialUntil
	}
	remaining := cutoff.Sub(sample.Wall)
	if remaining <= 0 {
		return nil, fmt.Errorf("LEASE_EXPIRED: snapshot has no remaining authority")
	}
	remaining = min(remaining, guard.maximum)
	guard.currentUntil = sample.Uptime + remaining
	guard.hasCurrent = true
	return &Ticket{guard: guard, until: guard.currentUntil, wallUntil: cutoff}, nil
}
func (ticket *Ticket) Allow() error {
	if ticket == nil {
		return fmt.Errorf("LEASE_EXPIRED: no execution authorization")
	}
	guard := ticket.guard
	guard.mutex.Lock()
	defer guard.mutex.Unlock()
	sample, err := guard.sampleLocked()
	if err != nil {
		return err
	}
	if sample.Uptime >= ticket.until || !sample.Wall.Before(ticket.wallUntil) {
		return fmt.Errorf("LEASE_EXPIRED: execution authorization ended")
	}
	return nil
}
func (ticket *Ticket) Deadline() time.Time { return ticket.wallUntil }
func (ticket *Ticket) Drain(duration time.Duration) *Ticket {
	guard := ticket.guard
	guard.mutex.Lock()
	defer guard.mutex.Unlock()
	sample, err := guard.sampleLocked()
	if err != nil {
		return &Ticket{guard: guard, until: 0, wallUntil: sample.Wall}
	}
	return &Ticket{guard: guard, until: min(ticket.until, sample.Uptime+duration), wallUntil: minTime(ticket.wallUntil, sample.Wall.Add(duration))}
}
func minTime(a, b time.Time) time.Time {
	if a.Before(b) {
		return a
	}
	return b
}
