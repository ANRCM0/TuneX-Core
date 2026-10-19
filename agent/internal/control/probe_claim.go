package control

import (
	"context"
	"net/http"
	"time"

	"github.com/tunex/vnext/agent/internal/nativeexecution"
	"github.com/tunex/vnext/agent/internal/observationtrust"
	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/probeclaim"
	"github.com/tunex/vnext/agent/internal/probeecho"
)

// A verified consumption receipt is NOT a probe.Permit/Grant and cannot execute.
// The execution adapter must independently recheck it through the monitor and one-use Gate.
type probeClaimReceipt struct {
	permitID                        string
	measurement                     string
	typed                           bool
	services                        bool
	echo                            bool
	echoInput                       *probeecho.Execution
	service                         *observationtrust.Context
	instance                        execution
	binding                         probe.Binding
	until                           time.Time
	timeout                         time.Duration
	session                         *registeredProbe
	issuedAt, expiresAt, consumedAt string
	serverAt                        time.Time // Original server clock, bracketed by local monotonic exchange instants.
	requestedAt, receivedAt         time.Time
	watched                         bool // Runner mutex; never reset, including failed or cancelled monitor admission.
}

func claimBinding(b probeclaim.Binding) probe.Binding {
	return probe.Binding{NodeID: b.NodeId, BootID: b.BootId, SessionEpoch: b.SessionEpoch,
		SnapshotGeneration: b.SnapshotGeneration, AssignmentID: b.AssignmentId, ForwardID: b.ForwardId,
		ForwardRevision: b.ForwardRevision, DeploymentGeneration: b.DeploymentGeneration,
		BindingFence: b.BindingFence, ConfigDigest: b.ConfigDigest, EgressPolicyRevision: b.EgressPolicyRevision}
}

// The expected binding comes from bounded discovery and is rechecked against Runner-owned execution facts.
func (runner *Runner) claimProbe(ctx context.Context, permitID string, binding probe.Binding) (*probeClaimReceipt, error) {
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	runner.mutex.Lock()
	session := runner.probeRegistration
	if session == nil || !runner.probeCurrentLocked(session) || !binding.Valid() ||
		runner.hello.Policy.MaxClockSkewSeconds > 2 {
		runner.mutex.Unlock()
		return nil, probe.ErrDenied
	}
	_, err := runner.probeTargetLocked(binding)
	if err != nil {
		runner.mutex.Unlock()
		return nil, err
	}
	request, err := probeclaim.NewRequest(session.node, session.boot, session.epoch, session.gate.InstanceID(), session.generation, permitID)
	if err != nil {
		runner.mutex.Unlock()
		return nil, err
	}
	if _, used := session.claims[permitID]; used {
		runner.mutex.Unlock()
		return nil, probe.ErrReplay
	}
	if len(session.claims) >= 256 {
		runner.mutex.Unlock()
		return nil, probe.ErrBusy
	}
	if session.claims == nil {
		session.claims = make(map[string]struct{})
	}
	// Burn before I/O, including timeout, cancellation, denial or lost acknowledgement. Never retry automatically.
	session.claims[permitID] = struct{}{}
	skew := time.Duration(runner.hello.Policy.MaxClockSkewSeconds) * time.Second
	runner.mutex.Unlock()

	started := runner.scheduler().Now()
	work, cancel := runner.scheduler().WithTimeout(ctx, 2*time.Second)
	defer cancel()
	stop := runner.scheduler().AfterFunc(session.ctx, cancel)
	defer stop()
	raw, err := nativeexecution.EncodeProbeRequest(request)
	if err != nil {
		return nil, err
	}
	response, err := runner.auxiliary().ProbeClaim(work, runner.client, runner.options.URL, raw, session.epoch)
	if err != nil {
		return nil, probeChannelError(err)
	}
	defer response.Body.Close()
	raw, oversized, err := nativeexecution.ReadProbeResponseBody(response.Body, 4096)
	if err != nil {
		return nil, err
	}
	if oversized {
		return nil, probe.ErrInvalid
	}
	if response.StatusCode != http.StatusOK {
		return nil, httpError{response.StatusCode, nativeexecution.ProbeResponseErrorCode(raw)}
	}
	ack, err := nativeexecution.DecodeProbeClaimResponse(*request, raw)
	if err != nil {
		return nil, err
	}
	if claimBinding(ack.Binding) != binding {
		return nil, probe.ErrDenied
	}
	server, err := nativeexecution.ParseProbeWireTime(ack.ServerTime)
	if err != nil || session.guard.ValidateServerTime(server) != nil {
		return nil, probe.ErrDenied
	}
	expires, err := nativeexecution.ParseProbeWireTime(ack.ExpiresAt)
	if err != nil {
		return nil, err
	}
	// Anchoring before the request subtracts all round-trip delay; no wall-clock deadline extension.
	remaining := expires.Sub(server) - skew
	if remaining <= 0 || remaining > 2*time.Second {
		return nil, probe.ErrDenied
	}
	until := started.Add(remaining)
	runner.mutex.Lock()
	defer runner.mutex.Unlock()
	if work.Err() != nil {
		return nil, work.Err()
	}
	if runner.probeRegistration != session || !runner.probeCurrentLocked(session) {
		return nil, probe.ErrDenied
	}
	target, err := runner.probeTargetLocked(binding)
	if err != nil {
		return nil, err
	}
	until = minProbeDeadline(until, minProbeDeadline(session.until, target.ExecutionUntil))
	if !runner.scheduler().Now().Before(until) {
		return nil, probe.ErrDenied
	}
	receipt := &probeClaimReceipt{permitID: permitID, binding: binding, until: until,
		timeout: time.Duration(ack.TimeoutMs) * time.Millisecond, session: session,
		issuedAt: ack.IssuedAt, expiresAt: ack.ExpiresAt, consumedAt: ack.ConsumedAt,
		serverAt: server, requestedAt: started, receivedAt: runner.scheduler().Now()}
	if session.receipts == nil {
		session.receipts = make(map[string]*probeClaimReceipt)
	}
	session.receipts[permitID] = receipt
	return receipt, nil
}

func minProbeDeadline(a, b time.Time) time.Time {
	if a.Before(b) {
		return a
	}
	return b
}
