// Package probe performs bounded, independently authorized measurements, not deployments.
// Its types are internal ports, not a remotely accepted command or wire protocol.
package probe

import (
	"context"
	"errors"
	"net"
	"regexp"
	"sync"
	"time"

	"github.com/tunex/vnext/agent/internal/observationtrust"
	probenative "github.com/tunex/vnext/agent/internal/probe/native"
	"github.com/tunex/vnext/agent/internal/probeecho"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

type Binding struct {
	NodeID, BootID, AssignmentID, ForwardID, ConfigDigest    string
	SessionEpoch, SnapshotGeneration, ForwardRevision        uint64
	DeploymentGeneration, BindingFence, EgressPolicyRevision uint64
}

// Permit must come from an independent Probe authority. An execution ticket alone
// is insufficient. No issuer or remote dispatch is supplied by this package.
type Permit struct {
	Binding     Binding
	Measurement string
	Service     *observationtrust.Context
	Echo        *probeecho.Execution
	Until       time.Time
	Check       func() error
}

type Target struct {
	Binding                 Binding
	Measurement             string
	Service                 *observationtrust.Context
	Echo                    *probeecho.Execution
	Host                    string
	Port                    int
	AllowedDestinationCIDRs []string
	ExecutionUntil          time.Time
	Check                   func() error
}

// Resolver returns host-owned, detached current execution facts, never caller targets.
type Resolver func(context.Context, Binding) (Target, error)
type ServiceResolver func(context.Context, Binding, observationtrust.Context) (Target, error)
type EchoResolver func(context.Context, Binding, probeecho.Execution) (Target, error)

type Result struct {
	Binding                                Binding
	Measurement                            string
	Service                                *observationtrust.Context
	TLS                                    *observationtrust.Verification
	Echo                                   *probeecho.Proof
	EchoInput                              *probeecho.Execution
	RequestBytes, ResponseBytes            uint64
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
	resolve        Resolver
	resolveIngress Resolver
	resolveService ServiceResolver
	resolveEcho    EchoResolver
	dial           func(context.Context, string, string) (net.Conn, error)
	schedule       runtimeplatform.Scheduler
	entropy        runtimeplatform.Entropy
}

const MeasurementEgress = "tcp-connect-v1"
const MeasurementIngress = "tcp-ingress-connect-v1"
const MeasurementIngressTLS = "tcp-ingress-tls-v1"
const MeasurementIngressTCPEcho = "tcp-ingress-echo-v1"
const MeasurementIngressUDPEcho = "udp-ingress-echo-v1"

func validMeasurement(value string) bool {
	return value == "" || value == MeasurementEgress || value == MeasurementIngress || value == MeasurementIngressTLS ||
		probeecho.IsEcho(value)
}

func sameMeasurement(a, b string) bool {
	if a == "" {
		a = MeasurementEgress
	}
	if b == "" {
		b = MeasurementEgress
	}
	return a == b
}

func New(resolve Resolver) (*Executor, error) {
	if resolve == nil {
		return nil, ErrInvalid
	}
	return NewWithEffects(resolve, nativeEffects())
}

// Only the host supplies the second resolver; a wire caller never supplies a target.
func NewWithIngress(resolve, ingress Resolver) (*Executor, error) {
	if ingress == nil {
		return nil, ErrInvalid
	}
	executor, err := New(resolve)
	if err != nil {
		return nil, err
	}
	executor.resolveIngress = ingress
	return executor, nil
}

func NewWithServices(resolve, ingress Resolver, service ServiceResolver) (*Executor, error) {
	if service == nil {
		return nil, ErrInvalid
	}
	executor, err := NewWithIngress(resolve, ingress)
	if err != nil {
		return nil, err
	}
	executor.resolveService = service
	return executor, nil
}

func NewWithEcho(resolve, ingress Resolver, service ServiceResolver, echo EchoResolver) (*Executor, error) {
	if echo == nil {
		return nil, ErrInvalid
	}
	executor, err := NewWithServices(resolve, ingress, service)
	if err != nil {
		return nil, err
	}
	executor.resolveEcho = echo
	return executor, nil
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
	return executor.run(parent, permit, timeout, nil)
}

func (executor *Executor) run(parent context.Context, permit Permit, timeout time.Duration, invocation *counterInvocation) (Result, error) {
	if !permit.Binding.Valid() || !validMeasurement(permit.Measurement) || timeout < 100*time.Millisecond || timeout > 2*time.Second {
		return Result{}, ErrInvalid
	}
	start := executor.scheduler().Now()
	echo := probeecho.IsEcho(permit.Measurement)
	if echo {
		if permit.Echo == nil || executor.resolveEcho == nil || permit.Service != nil {
			return Result{}, ErrDenied
		}
		copy := probeecho.CloneExecution(*permit.Echo)
		permit.Echo = &copy
		if validateEchoExecution(copy, permit.Binding, permit.Measurement, start) != nil || copy.Invocation.TimeoutMs != uint64(timeout/time.Millisecond) {
			return Result{}, ErrDenied
		}
	} else if permit.Echo != nil {
		return Result{}, ErrInvalid
	}
	var trust *observationtrust.Trust
	if permit.Measurement == MeasurementIngressTLS {
		if permit.Service == nil || executor.resolveService == nil {
			return Result{}, ErrDenied
		}
		copy := *permit.Service
		permit.Service = &copy
		var err error
		trust, err = observationtrust.New(copy, start)
		if err != nil {
			return Result{}, ErrDenied
		}
	} else if permit.Service != nil {
		return Result{}, ErrInvalid
	}
	if permit.Check == nil || !permit.Until.After(start) || permit.Until.After(start.Add(2*time.Second)) ||
		permit.Check() != nil {
		return Result{}, ErrDenied
	}
	ctx, cancel := executor.scheduler().WithDeadline(parent, minTime(start.Add(timeout), permit.Until))
	defer cancel()
	if ctx.Err() != nil {
		return Result{}, ctx.Err()
	}
	resolve := executor.resolve
	if permit.Measurement == MeasurementIngress {
		if executor.resolveIngress == nil {
			return Result{}, ErrDenied
		}
		resolve = executor.resolveIngress
	}
	var target Target
	var err error
	if echo {
		target, err = executor.resolveEcho(ctx, permit.Binding, probeecho.CloneExecution(*permit.Echo))
	} else if trust != nil {
		target, err = executor.resolveService(ctx, permit.Binding, trust.Context())
	} else {
		target, err = resolve(ctx, permit.Binding)
	}
	if err != nil {
		return Result{}, ErrDenied
	}
	if trust != nil {
		if target.Service == nil || *target.Service != trust.Context() {
			return Result{}, ErrDenied
		}
		copy := *target.Service
		target.Service = &copy
		target.ExecutionUntil = minTime(target.ExecutionUntil, trust.ValidUntil())
	} else if target.Service != nil {
		return Result{}, ErrDenied
	}
	if echo {
		if target.Echo == nil || !sameEchoExecution(*target.Echo, *permit.Echo) {
			return Result{}, ErrDenied
		}
		copy := probeecho.CloneExecution(*target.Echo)
		target.Echo = &copy
		target.ExecutionUntil = minTime(target.ExecutionUntil, time.UnixMilli(int64(copy.Context.Config.ValidUntil)))
	} else if target.Echo != nil {
		return Result{}, ErrDenied
	}
	destination, validDestination := probenative.ParseDestination(target.Host, target.Port)
	if !validDestination {
		return Result{}, ErrDenied
	}
	if target.Binding != permit.Binding || !sameMeasurement(target.Measurement, permit.Measurement) || target.Check == nil || !target.ExecutionUntil.After(executor.scheduler().Now()) ||
		!destination.Allowed(target.AllowedDestinationCIDRs) {
		return Result{}, ErrDenied
	}
	ctx, stop := executor.scheduler().WithDeadline(ctx, target.ExecutionUntil)
	defer stop()
	check := func() error {
		if trust != nil && trust.Current(executor.scheduler().Now()) != nil {
			return ErrDenied
		}
		if echo && validateEchoExecution(*permit.Echo, permit.Binding, permit.Measurement, executor.scheduler().Now()) != nil {
			return ErrDenied
		}
		if !executor.scheduler().Now().Before(permit.Until) || !executor.scheduler().Now().Before(target.ExecutionUntil) ||
			permit.Check() != nil || target.Check() != nil {
			return ErrDenied
		}
		return nil
	}
	if err := check(); err != nil {
		return Result{}, err
	}
	release, err := admissions.acquireWith(permit.Binding.NodeID, executor.scheduler().Now(), executor.scheduler())
	if err != nil {
		return Result{}, err
	}
	defer release()
	work, revoke := context.WithCancel(ctx)
	done := make(chan struct{})
	go func() {
		defer close(done)
		ticker := executor.scheduler().NewTicker(25 * time.Millisecond)
		defer ticker.Stop()
		for {
			select {
			case <-work.Done():
				return
			case <-ticker.C():
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
	// Numeric literal only and exactly one connection. Only the service kind may send TLS handshake records.
	attempt := invocation.begin()
	defer attempt.finish("unknown")
	network := destination.Network(probeecho.IsUDP(permit.Measurement))
	connection, dialErr := executor.dial(work, network, destination.Address())
	if connection != nil && trust == nil && !echo {
		_ = connection.Close()
	}
	if connection != nil && (trust != nil || echo) {
		defer connection.Close()
	}
	if err := check(); err != nil {
		return Result{}, err
	}
	if err := work.Err(); err != nil {
		return Result{}, err
	}
	status, code := "connected", "tcp-connected"
	var verification *observationtrust.Verification
	var proof *probeecho.Proof
	var requestBytes, responseBytes uint64
	if dialErr != nil {
		if probeecho.IsUDP(permit.Measurement) {
			return Result{}, ErrDenied
		}
		if trust != nil || echo {
			var timed net.Error
			if errors.As(dialErr, &timed) && timed.Timeout() {
				return Result{}, ErrDenied
			}
		}
		status, code = "unreachable", "tcp-connect-failed"
	} else if echo {
		if connection == nil {
			return Result{}, ErrDenied
		}
		proof, requestBytes, responseBytes, err = exchangeEcho(work, connection, *permit.Echo, check)
		if err != nil {
			return Result{}, err
		}
		status, code = "echoed", "nonce-echo-verified"
		if proof == nil {
			status, code = "unverified", "nonce-echo-rejected"
		}
	} else if trust != nil {
		if connection == nil {
			return Result{}, ErrDenied
		}
		verification, err = handshakeService(work, connection, trust, check)
		if err != nil {
			return Result{}, err
		}
		status, code = "verified", "tls-handshake-verified"
		if verification == nil {
			status, code = "unverified", "tls-handshake-failed"
		}
	}
	now := executor.scheduler().Now()
	deadline, _ := work.Deadline()
	if !now.Before(deadline) || !now.Before(permit.Until) || !now.Before(target.ExecutionUntil) {
		return Result{}, ErrDenied
	}
	if dialErr == nil {
		attempt.finish("succeeded")
	} else {
		attempt.finish("failed")
	}
	point := "agent-direct-egress"
	if permit.Measurement == MeasurementIngress || permit.Measurement == MeasurementIngressTLS || echo {
		point = "agent-local-direct-ingress"
	}
	if probeecho.IsPath(permit.Measurement) { point = "agent-local-forward-ingress" }
    return Result{Binding: permit.Binding, Measurement: permit.Measurement, Point: point, Status: status, Code: code,
		Service: permit.Service, TLS: verification,
		Echo: proof, EchoInput: permit.Echo, RequestBytes: requestBytes, ResponseBytes: responseBytes,
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
	return budget.acquireWith(node, now, probenative.Schedule())
}

func (budget *budget) acquireWith(node string, now time.Time, schedule runtimeplatform.Scheduler) (func(), error) {
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
		budget.nodes[node] = admission{until: schedule.Now().Add(time.Second)}
	}, nil
}
