package probe

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sync"
	"time"
)

var ErrReplay = errors.New("PROBE_REPLAY: permit already consumed")

// Grant is a trusted internal input, NOT a parsed or authenticated wire permit.
// A future remote verifier must supply the independently authorized Permit.
type Grant struct {
	PermitID, InstanceID string
	Permit               Permit
	Timeout              time.Duration
}

// Gate burns permit IDs before network work. Used IDs are never evicted during
// its lifetime; capacity exhaustion requires a new independently negotiated
// random instance, never clearing a replay cache under the same identity.
type Gate struct {
	mutex                sync.Mutex
	node, boot, instance string
	epoch                uint64
	executor             *Executor
	closed               bool
	claims               map[string]context.CancelFunc
}

func NewGate(node, boot string, epoch uint64, executor *Executor) (*Gate, error) {
	if !idPattern.MatchString(node) || !idPattern.MatchString(boot) || epoch == 0 ||
		epoch > 9007199254740991 || executor == nil || executor.resolve == nil || executor.dial == nil {
		return nil, ErrInvalid
	}
	var random [32]byte
	if _, err := rand.Read(random[:]); err != nil {
		return nil, ErrDenied
	}
	return &Gate{node: node, boot: boot, epoch: epoch, instance: hex.EncodeToString(random[:]),
		executor: executor, claims: make(map[string]context.CancelFunc)}, nil
}

func (gate *Gate) InstanceID() string { return gate.instance }

func (gate *Gate) Run(ctx context.Context, grant Grant) (Result, error) {
	p := grant.Permit
	if !idPattern.MatchString(grant.PermitID) || !p.Binding.Valid() ||
		grant.Timeout < 100*time.Millisecond || grant.Timeout > 2*time.Second {
		return Result{}, ErrInvalid
	}
	now := time.Now()
	if grant.InstanceID != gate.instance || p.Binding.NodeID != gate.node || p.Binding.BootID != gate.boot ||
		p.Binding.SessionEpoch != gate.epoch || p.Check == nil || !p.Until.After(now) ||
		p.Until.After(now.Add(2*time.Second)) || p.Check() != nil {
		return Result{}, ErrDenied
	}
	work, cancel := context.WithCancel(ctx)
	defer cancel()
	gate.mutex.Lock()
	if gate.closed {
		gate.mutex.Unlock()
		return Result{}, ErrDenied
	}
	if _, exists := gate.claims[grant.PermitID]; exists {
		gate.mutex.Unlock()
		return Result{}, ErrReplay
	}
	if len(gate.claims) >= 256 {
		gate.mutex.Unlock()
		return Result{}, ErrBusy
	}
	gate.claims[grant.PermitID] = cancel
	gate.mutex.Unlock()
	defer func() {
		gate.mutex.Lock()
		gate.claims[grant.PermitID] = nil // Keep the ID even on busy, denial or cancellation.
		gate.mutex.Unlock()
	}()
	p.Check = func() error {
		gate.mutex.Lock()
		closed := gate.closed
		gate.mutex.Unlock()
		if closed {
			return ErrDenied
		}
		return grant.Permit.Check()
	}
	return gate.executor.Run(work, p, grant.Timeout)
}

func (gate *Gate) Close() {
	gate.mutex.Lock()
	gate.closed = true
	cancels := make([]context.CancelFunc, 0)
	for _, cancel := range gate.claims {
		if cancel != nil {
			cancels = append(cancels, cancel)
		}
	}
	gate.mutex.Unlock()
	for _, cancel := range cancels {
		cancel()
	}
}
