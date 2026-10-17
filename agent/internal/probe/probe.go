// Package probe performs bounded, independently authorized measurements, not deployments.
// Its types are internal ports, not a remotely accepted command or wire protocol.
package probe

import (
	"context"
	"errors"
	"net"
	"net/netip"
	"regexp"
	"strconv"
	"sync"
	"time"

	"github.com/tunex/vnext/agent/internal/egress"
)

type Binding struct {
	NodeID, BootID, AssignmentID, ForwardID, ConfigDigest    string
	SessionEpoch, SnapshotGeneration, ForwardRevision        uint64
	DeploymentGeneration, BindingFence, EgressPolicyRevision uint64
}

// Permit must come from an independent Probe authority. An execution ticket alone
// is insufficient. No issuer or remote dispatch is supplied by this package.
type Permit struct {
	Binding Binding
	Until   time.Time
	Check   func() error
}

type Target struct {
	Binding                 Binding
	Host                    string
	Port                    int
	AllowedDestinationCIDRs []string
	ExecutionUntil          time.Time
	Check                   func() error
}

// Resolver returns host-owned, detached current execution facts, never caller targets.
type Resolver func(context.Context, Binding) (Target, error)

type Result struct {
	Binding                                Binding
	Point, Status, Code, ApplicationHealth string
	IndependentProbe                       bool
	MeasuredAt, ValidUntil                 time.Time
	Elapsed                                time.Duration
}

var (
	ErrInvalid    = errors.New("INVALID_CONFIG: invalid probe request")
	ErrDenied     = errors.New("AUTHORIZATION_DENIED: probe authority or binding unavailable")
	ErrBusy       = errors.New("PROBE_BUSY: bounded admission unavailable")
	idPattern     = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`)
	digestPattern = regexp.MustCompile(`^sha256:[a-f0-9]{64}$`)
)

type Executor struct {
	resolve Resolver
	dial    func(context.Context, string, string) (net.Conn, error)
}

func New(resolve Resolver) (*Executor, error) {
	if resolve == nil {
		return nil, ErrInvalid
	}
	dialer := &net.Dialer{}
	return &Executor{resolve: resolve, dial: dialer.DialContext}, nil
}

func (binding Binding) Valid() bool {
	for _, id := range []string{binding.NodeID, binding.BootID, binding.AssignmentID, binding.ForwardID} {
		if !idPattern.MatchString(id) {
			return false
		}
	}
	for _, count := range []uint64{binding.SessionEpoch, binding.SnapshotGeneration, binding.ForwardRevision,
		binding.DeploymentGeneration, binding.BindingFence, binding.EgressPolicyRevision} {
		if count == 0 || count > 9007199254740991 {
			return false
		}
	}
	return digestPattern.MatchString(binding.ConfigDigest)
}

func (executor *Executor) Run(parent context.Context, permit Permit, timeout time.Duration) (Result, error) {
	if !permit.Binding.Valid() || timeout < 100*time.Millisecond || timeout > 2*time.Second {
		return Result{}, ErrInvalid
	}
	start := time.Now()
	if permit.Check == nil || !permit.Until.After(start) || permit.Until.After(start.Add(2*time.Second)) ||
		permit.Check() != nil {
		return Result{}, ErrDenied
	}
	ctx, cancel := context.WithDeadline(parent, minTime(start.Add(timeout), permit.Until))
	defer cancel()
	if ctx.Err() != nil {
		return Result{}, ctx.Err()
	}
	target, err := executor.resolve(ctx, permit.Binding)
	if err != nil {
		return Result{}, ErrDenied
	}
	address, err := netip.ParseAddr(target.Host)
	if err != nil || address.Zone() != "" || target.Port < 1 || target.Port > 65535 {
		return Result{}, ErrDenied
	}
	address = address.Unmap()
	if target.Binding != permit.Binding || target.Check == nil || !target.ExecutionUntil.After(time.Now()) ||
		!egress.Allowed(address, target.AllowedDestinationCIDRs, false) ||
		address.Is4() && address.As4()[0] >= 224 {
		return Result{}, ErrDenied
	}
	ctx, stop := context.WithDeadline(ctx, target.ExecutionUntil)
	defer stop()
	check := func() error {
		if !time.Now().Before(permit.Until) || !time.Now().Before(target.ExecutionUntil) ||
			permit.Check() != nil || target.Check() != nil {
			return ErrDenied
		}
		return nil
	}
	if err := check(); err != nil {
		return Result{}, err
	}
	release, err := admissions.acquire(permit.Binding.NodeID, time.Now())
	if err != nil {
		return Result{}, err
	}
	defer release()
	work, revoke := context.WithCancel(ctx)
	done := make(chan struct{})
	go func() {
		defer close(done)
		ticker := time.NewTicker(25 * time.Millisecond)
		defer ticker.Stop()
		for {
			select {
			case <-work.Done():
				return
			case <-ticker.C:
				if check() != nil {
					revoke()
					return
				}
			}
		}
	}()
	defer func() { revoke(); <-done }()
	if err := check(); err != nil {
		return Result{}, err
	}
	// Numeric literal only, exactly one connection, no payload writes or reads.
	connection, dialErr := executor.dial(work, "tcp", net.JoinHostPort(address.String(), strconv.Itoa(target.Port)))
	if connection != nil {
		_ = connection.Close()
	}
	if err := check(); err != nil {
		return Result{}, err
	}
	if err := work.Err(); err != nil {
		return Result{}, err
	}
	status, code := "connected", "tcp-connected"
	if dialErr != nil {
		status, code = "unreachable", "tcp-connect-failed"
	}
	now := time.Now()
	deadline, _ := work.Deadline()
	if !now.Before(deadline) || !now.Before(permit.Until) || !now.Before(target.ExecutionUntil) {
		return Result{}, ErrDenied
	}
	return Result{Binding: permit.Binding, Point: "agent-direct-egress", Status: status, Code: code,
		ApplicationHealth: "unknown", IndependentProbe: true, MeasuredAt: now,
		ValidUntil: minTime(now.Add(5*time.Second), minTime(permit.Until, target.ExecutionUntil)),
		Elapsed:    now.Sub(start)}, nil
}

func minTime(a, b time.Time) time.Time {
	if a.Before(b) {
		return a
	}
	return b
}

type admission struct {
	active bool
	until  time.Time
}
type budget struct {
	mutex  sync.Mutex
	nodes  map[string]admission
	active int
}

// Shared across all Executor instances so construction cannot reset process budgets.
var admissions = budget{nodes: make(map[string]admission)}

func (budget *budget) acquire(node string, now time.Time) (func(), error) {
	budget.mutex.Lock()
	defer budget.mutex.Unlock()
	for key, slot := range budget.nodes {
		if !slot.active && !now.Before(slot.until) {
			delete(budget.nodes, key)
		}
	}
	if _, exists := budget.nodes[node]; exists || budget.active >= 4 || len(budget.nodes) >= 128 {
		return nil, ErrBusy
	}
	budget.nodes[node] = admission{active: true}
	budget.active++
	return func() {
		budget.mutex.Lock()
		defer budget.mutex.Unlock()
		budget.active--
		budget.nodes[node] = admission{until: time.Now().Add(time.Second)}
	}, nil
}
