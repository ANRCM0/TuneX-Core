package payloadbudget

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"
)

type Sample struct {
	Wall      time.Time
	Monotonic time.Duration
}
type Clock func() (Sample, error)
type Wait func(time.Duration) <-chan time.Time
type Precharge func(context.Context, Policy, uint64, int64) (Record, error)

type Gate struct {
	mutex     sync.Mutex
	record    Record
	clock     Clock
	wait      Wait
	precharge Precharge
	last      time.Duration
	credit    uint64
	failed    error
}

func New(record Record, clock Clock, wait Wait, precharge Precharge) (*Gate, error) {
	if err := ValidatePolicy(record.Policy); err != nil {
		return nil, err
	}
	if record.Consumed > MaxCounter || clock == nil || wait == nil || precharge == nil {
		return nil, fmt.Errorf("INVALID_CONFIG: Payload gate providers required")
	}
	sample, err := clock()
	if err != nil {
		return nil, err
	}
	if sample.Monotonic < 0 || sample.Wall.IsZero() {
		return nil, fmt.Errorf("CLOCK_UNCERTAIN: Invalid payload clock")
	}
	// Persisted consumption survives restart; rate credit deliberately does not.
	return &Gate{record: Record{Policy: ClonePolicy(record.Policy), Consumed: record.Consumed}, clock: clock, wait: wait, precharge: precharge, last: sample.Monotonic}, nil
}

func (gate *Gate) update(record Record, sample Sample) error {
	if err := ValidatePolicy(record.Policy); err != nil {
		return err
	}
	if record.Binding != gate.record.Binding || record.Revision < gate.record.Revision || record.Consumed > MaxCounter || record.Revision == gate.record.Revision && !SamePolicy(record.Policy, gate.record.Policy) {
		return fmt.Errorf("INTEGRITY_FAILURE: Payload gate binding or policy regressed")
	}
	if record.Revision != gate.record.Revision {
		// Policy changes preserve used bytes; resetting transient credit is conservative.
		gate.credit = 0
		gate.last = sample.Monotonic
	}
	record.Policy = ClonePolicy(record.Policy)
	record.Consumed = max(record.Consumed, gate.record.Consumed)
	gate.record = record
	return nil
}

func (gate *Gate) Configure(record Record) error {
	gate.mutex.Lock()
	defer gate.mutex.Unlock()
	sample, err := gate.clock()
	if err == nil {
		err = gate.update(record, sample)
	}
	if err != nil {
		gate.failed = err
	}
	return err
}

func (gate *Gate) check(sample Sample) error {
	if gate.failed != nil {
		return gate.failed
	}
	if sample.Monotonic < gate.last || sample.Wall.IsZero() {
		gate.failed = fmt.Errorf("CLOCK_UNCERTAIN: Payload monotonic clock regressed")
		return gate.failed
	}
	at := sample.Wall.UnixMilli()
	if at < gate.record.StartsAt || at >= gate.record.EndsAt {
		return ErrPeriod
	}
	if gate.record.Consumed >= MaxCounter || gate.record.ByteLimit != nil && gate.record.Consumed >= *gate.record.ByteLimit {
		return ErrExhausted
	}
	if gate.record.BytesPerSecond != nil && *gate.record.BytesPerSecond == 0 {
		return ErrExhausted
	}
	return nil
}

// Check lets the original Runner stop existing streams even when they are idle.
func (gate *Gate) Check() error {
	gate.mutex.Lock()
	defer gate.mutex.Unlock()
	sample, err := gate.clock()
	if err != nil {
		gate.failed = err
		return err
	}
	return gate.check(sample)
}

func (gate *Gate) Binding() Binding {
	gate.mutex.Lock()
	defer gate.mutex.Unlock()
	return gate.record.Binding
}

type AuthorizedGate struct {
	gate  *Gate
	mutex sync.RWMutex
	check func() error
}

func (gate *Gate) WithAuthorization(check func() error) *AuthorizedGate {
	return &AuthorizedGate{gate: gate, check: check}
}

func (bound *AuthorizedGate) SetAuthorization(check func() error) {
	bound.mutex.Lock()
	bound.check = check
	bound.mutex.Unlock()
}

func (bound *AuthorizedGate) authorize() error {
	bound.mutex.RLock()
	check := bound.check
	bound.mutex.RUnlock()
	if check == nil {
		return fmt.Errorf("AUTHORIZATION_DENIED: Payload authorizer required")
	}
	return check()
}

func (bound *AuthorizedGate) Shared() *Gate {
	if bound == nil {
		return nil
	}
	return bound.gate
}

func (bound *AuthorizedGate) Check() error {
	if bound == nil || bound.gate == nil {
		return fmt.Errorf("INTEGRITY_FAILURE: Payload gate required")
	}
	if err := bound.authorize(); err != nil {
		return err
	}
	return bound.gate.Check()
}

func (bound *AuthorizedGate) Acquire(ctx context.Context, count int, atomic bool) (int, error) {
	if bound == nil || bound.gate == nil {
		return 0, fmt.Errorf("AUTHORIZATION_DENIED: Payload authorizer required")
	}
	return bound.gate.acquire(ctx, count, atomic, bound.authorize)
}

func (gate *Gate) accrue(sample Sample) {
	if gate.record.BytesPerSecond == nil {
		gate.last = sample.Monotonic
		return
	}
	rate := *gate.record.BytesPerSecond
	capacity := gate.record.BurstBytes * 1000000000
	if rate > 0 && sample.Monotonic > gate.last && gate.credit < capacity {
		elapsed := uint64(sample.Monotonic - gate.last)
		needed := capacity - gate.credit
		fill := needed / rate
		if needed%rate != 0 {
			fill++
		}
		if elapsed >= fill {
			gate.credit = capacity
		} else {
			gate.credit += elapsed * rate
		}
	}
	gate.last = sample.Monotonic
}

func (gate *Gate) acquire(ctx context.Context, count int, atomic bool, check func() error) (int, error) {
	if count < 0 || count == 0 && !atomic {
		return 0, fmt.Errorf("INVALID_CONFIG: Positive stream payload reservation required")
	}
	for {
		if err := ctx.Err(); err != nil {
			return 0, err
		}
		if err := check(); err != nil {
			return 0, err
		}
		gate.mutex.Lock()
		sample, err := gate.clock()
		if err == nil {
			err = gate.check(sample)
		}
		if err != nil {
			gate.mutex.Unlock()
			return 0, err
		}
		gate.accrue(sample)
		requested := uint64(count)
		remaining := MaxCounter - gate.record.Consumed
		if gate.record.ByteLimit != nil {
			remaining = min(remaining, *gate.record.ByteLimit-gate.record.Consumed)
		}
		if atomic && requested > remaining {
			gate.mutex.Unlock()
			return 0, ErrExhausted
		}
		allowed := min(requested, remaining)
		waitFor := time.Duration(0)
		if gate.record.BytesPerSecond != nil {
			if atomic && requested > gate.record.BurstBytes {
				gate.mutex.Unlock()
				return 0, fmt.Errorf("RESOURCE_LIMIT: Datagram exceeds shared payload burst")
			}
			wanted := uint64(1)
			if atomic {
				wanted = requested
			}
			if gate.credit/1000000000 < wanted {
				needed := wanted*1000000000 - gate.credit
				rate := *gate.record.BytesPerSecond
				nanos := needed / rate
				if needed%rate != 0 {
					nanos++
				}
				waitFor = time.Duration(nanos)
			} else {
				allowed = min(allowed, gate.credit/1000000000)
			}
		}
		if waitFor > 0 {
			gate.mutex.Unlock()
			// Short monotonic waits retain original authorization and period checks.
			select {
			case <-ctx.Done():
				return 0, ctx.Err()
			case <-gate.wait(min(waitFor, 100*time.Millisecond)):
			}
			continue
		}
		updated, err := gate.precharge(ctx, gate.record.Policy, allowed, sample.Wall.UnixMilli())
		if errors.Is(err, ErrPolicyChanged) {
			err = gate.update(updated, sample)
			gate.mutex.Unlock()
			if err != nil {
				return 0, err
			}
			continue
		}
		if err != nil {
			if !errors.Is(err, ErrExhausted) && !errors.Is(err, ErrPeriod) {
				gate.failed = err
			}
			gate.mutex.Unlock()
			return 0, err
		}
		if updated.Binding != gate.record.Binding || !SamePolicy(updated.Policy, gate.record.Policy) || updated.Consumed < gate.record.Consumed+allowed {
			gate.failed = fmt.Errorf("INTEGRITY_FAILURE: Durable payload reservation differs")
			err = gate.failed
			gate.mutex.Unlock()
			return 0, err
		}
		gate.record = updated
		if gate.record.BytesPerSecond != nil {
			gate.credit -= allowed * 1000000000
		}
		current, clockErr := gate.clock()
		if clockErr == nil && (current.Monotonic < sample.Monotonic || current.Wall.IsZero()) {
			clockErr = fmt.Errorf("CLOCK_UNCERTAIN: Payload reservation clock regressed")
		}
		if clockErr == nil && (current.Wall.UnixMilli() < gate.record.StartsAt || current.Wall.UnixMilli() >= gate.record.EndsAt) {
			clockErr = ErrPeriod
		}
		if clockErr != nil && !errors.Is(clockErr, ErrPeriod) {
			gate.failed = clockErr
		}
		gate.mutex.Unlock()
		// No refund: cancellation or a later short/failed socket write is ambiguous.
		if clockErr != nil {
			return 0, clockErr
		}
		if err := ctx.Err(); err != nil {
			return 0, err
		}
		if err := check(); err != nil {
			return 0, err
		}
		return int(allowed), nil
	}
}
