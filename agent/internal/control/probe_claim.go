package control

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/probeclaim"
)

// A verified consumption receipt is NOT a probe.Permit/Grant and cannot execute.
// The execution adapter must independently recheck it through the monitor and one-use Gate.
type probeClaimReceipt struct {
	permitID                        string
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

	started := time.Now()
	work, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	stop := context.AfterFunc(session.ctx, cancel)
	defer stop()
	raw, err := json.Marshal(request)
	if err != nil {
		return nil, err
	}
	message, err := http.NewRequestWithContext(work, "POST", strings.TrimRight(runner.options.URL, "/")+"/agent/v3/probe/claim", bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	if message.URL.Scheme != "https" || runner.client == nil {
		return nil, probe.ErrDenied
	}
	message.Header.Set("Content-Type", "application/json")
	message.Header.Set("X-TuneX-Session-Epoch", strconv.FormatUint(session.epoch, 10))
	client := *runner.client
	client.CheckRedirect = func(*http.Request, []*http.Request) error { return fmt.Errorf("Probe claim redirects are forbidden") }
	response, err := client.Do(message)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	raw, err = io.ReadAll(io.LimitReader(response.Body, 4097))
	if err != nil {
		return nil, err
	}
	if len(raw) > 4096 {
		return nil, probe.ErrInvalid
	}
	if response.StatusCode != http.StatusOK {
		var problem struct {
			Code string `json:"code"`
		}
		_ = json.Unmarshal(raw, &problem)
		return nil, httpError{response.StatusCode, problem.Code}
	}
	ack, err := probeclaim.ParseResponse(raw)
	if err != nil {
		return nil, err
	}
	if err := probeclaim.CheckResponse(*request, *ack); err != nil {
		return nil, err
	}
	if claimBinding(ack.Binding) != binding {
		return nil, probe.ErrDenied
	}
	server, err := time.Parse(time.RFC3339Nano, ack.ServerTime)
	if err != nil || session.guard.ValidateServerTime(server) != nil {
		return nil, probe.ErrDenied
	}
	expires, err := time.Parse(time.RFC3339Nano, ack.ExpiresAt)
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
	if !time.Now().Before(until) {
		return nil, probe.ErrDenied
	}
	receipt := &probeClaimReceipt{permitID: permitID, binding: binding, until: until,
		timeout: time.Duration(ack.TimeoutMs) * time.Millisecond, session: session,
		issuedAt: ack.IssuedAt, expiresAt: ack.ExpiresAt, consumedAt: ack.ConsumedAt,
		serverAt: server, requestedAt: started, receivedAt: time.Now()}
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
