package authorization

import (
	"time"

	"github.com/tunex/vnext/agent/internal/executiontime"
)

// Keep the old construction surface, with one lower-owned guard and no copied state.
type Guard struct {
	value *executiontime.Guard
	clock Clock
}

type Ticket = executiontime.Ticket

func New(clock Clock, skew, maximum time.Duration, credentialUntil time.Time) (*Guard, error) {
	if clock == nil {
		_, err := executiontime.New(nil, skew, maximum, credentialUntil)
		return nil, err
	}
	owner := &Guard{clock: clock}
	value, err := executiontime.New(func() (Sample, error) { return owner.clock() }, skew, maximum, credentialUntil)
	if err != nil {
		return nil, err
	}
	owner.value = value
	return owner, nil
}

func (guard *Guard) Check() error { return guard.value.Check() }
func (guard *Guard) ValidateServerTime(server time.Time) error {
	return guard.value.ValidateServerTime(server)
}
func (guard *Guard) Credential(until time.Time) error { return guard.value.Credential(until) }
func (guard *Guard) Accept(issued, valid time.Time) (*Ticket, error) {
	return guard.value.Accept(issued, valid)
}
