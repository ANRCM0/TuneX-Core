package control

import (
	"context"
	"encoding/json"
	"sync/atomic"
	"time"

	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/proberesult"
)

// An observation plus its still-live monitor, never reusable execution authority.
type probeExecution struct {
	watch                      *probeAuthorityWatch
	body                       proberesult.Request
	reportUntil, validityUntil time.Time
	reported                   atomic.Bool
}

func (execution *probeExecution) Close() { execution.watch.Close() }

func (execution *probeExecution) resultRequest() (proberesult.Request, error) {
	if err := execution.watch.Check(); err != nil {
		return proberesult.Request{}, err
	}
	execution.watch.mutex.Lock()
	currentUntil := execution.watch.until
	clockRegressed := execution.watch.lastServer.Before(execution.watch.receipt.serverAt)
	execution.watch.mutex.Unlock()
	if !time.Now().Before(execution.reportUntil) || execution.validityUntil.After(currentUntil) || clockRegressed {
		execution.watch.fail(probe.ErrDenied)
		return proberesult.Request{}, probe.ErrDenied
	}
	return execution.body, nil
}

// Close must drain the monitor after the caller finishes with the detached report.
func (runner *Runner) executeConsumedProbe(ctx context.Context, receipt *probeClaimReceipt) (*probeExecution, error) {
	watch, err := runner.monitorConsumedProbe(ctx, receipt)
	if err != nil {
		return nil, err
	}
	accepted := false
	defer func() {
		if !accepted {
			watch.Close()
		}
	}()
	watch.mutex.Lock()
	until := watch.until
	clockRegressed := watch.lastServer.Before(watch.receipt.serverAt)
	watch.mutex.Unlock()
	if clockRegressed {
		return nil, probe.ErrDenied
	}
	owned := watch.receipt
	started := time.Now()
	result, err := owned.session.gate.Run(watch.ctx, probe.Grant{PermitID: owned.permitID,
		InstanceID: owned.session.gate.InstanceID(), Timeout: owned.timeout,
		Permit: probe.Permit{Binding: owned.binding, Until: until, Check: watch.Check}})
	if err != nil {
		return nil, err
	}
	if err := watch.Check(); err != nil {
		return nil, err
	}
	watch.mutex.Lock()
	until = minProbeDeadline(until, watch.until)
	watch.mutex.Unlock()
	body, reportUntil, err := probeResultRequest(owned, started, until, result)
	if err != nil {
		return nil, err
	}
	// The wire-validity projection is later than the safe reporting cutoff.
	execution := &probeExecution{watch: watch, body: body, reportUntil: reportUntil,
		validityUntil: reportUntil.Add(owned.receivedAt.Sub(owned.requestedAt) + time.Millisecond)}
	if _, err := execution.resultRequest(); err != nil {
		return nil, err
	}
	accepted = true
	return execution, nil
}

func probeResultRequest(receipt probeClaimReceipt, started, until time.Time, result probe.Result) (proberesult.Request, time.Time, error) {
	now := time.Now()
	consumed, e1 := time.Parse(time.RFC3339Nano, receipt.consumedAt)
	expires, e2 := time.Parse(time.RFC3339Nano, receipt.expiresAt)
	if e1 != nil || e2 != nil || receipt.serverAt.Before(consumed) || !receipt.serverAt.Before(expires) ||
		receipt.session == nil || receipt.session.gate == nil || receipt.serverAt.IsZero() ||
		receipt.requestedAt.IsZero() || receipt.receivedAt.IsZero() || receipt.requestedAt.After(receipt.receivedAt) ||
		receipt.receivedAt.After(started) || started.After(result.MeasuredAt) || result.MeasuredAt.After(now) ||
		result.Binding != receipt.binding || !result.IndependentProbe || result.Point != "agent-direct-egress" ||
		result.ApplicationHealth != "unknown" || result.Elapsed < 0 || result.Elapsed > receipt.timeout ||
		result.Elapsed > result.MeasuredAt.Sub(started) || !result.ValidUntil.After(result.MeasuredAt) ||
		result.ValidUntil.After(receipt.until) || receipt.timeout%time.Millisecond != 0 {
		return proberesult.Request{}, time.Time{}, probe.ErrDenied
	}
	until = minProbeDeadline(until, minProbeDeadline(receipt.until, result.ValidUntil))
	if !now.Before(until) {
		return proberesult.Request{}, time.Time{}, probe.ErrDenied
	}
	// A server response was generated BEFORE receivedAt. Advancing it only by
	// subsequent monotonic elapsed time gives a conservative server-clock lower
	// bound, subtracting all response delay. Never clamp an invalid measurement.
	measured := receipt.serverAt.Add(result.MeasuredAt.Sub(receipt.receivedAt)).UTC().Truncate(time.Millisecond)
	valid := receipt.serverAt.Add(until.Sub(receipt.receivedAt)).UTC().Truncate(time.Millisecond)
	id, err := probeRequestID()
	if err != nil {
		return proberesult.Request{}, time.Time{}, err
	}
	b, session := receipt.binding, receipt.session
	stamp := func(at time.Time) string { return at.Format("2006-01-02T15:04:05.000Z") }
	body := proberesult.Request{ProtocolVersion: 3, ProbeVersion: 1, Kind: "probe-result", NodeId: session.node,
		BootId: session.boot, SessionEpoch: session.epoch, InstanceId: session.gate.InstanceID(), InstanceGeneration: session.generation,
		PermitId: receipt.permitID, RequestId: id, TimeoutMs: uint64(receipt.timeout / time.Millisecond),
		IssuedAt: receipt.issuedAt, ExpiresAt: receipt.expiresAt, ConsumedAt: receipt.consumedAt,
		Binding: proberesult.Binding{NodeId: b.NodeID, BootId: b.BootID, SessionEpoch: b.SessionEpoch,
			SnapshotGeneration: b.SnapshotGeneration, AssignmentId: b.AssignmentID, ForwardId: b.ForwardID,
			ForwardRevision: b.ForwardRevision, DeploymentGeneration: b.DeploymentGeneration,
			BindingFence: b.BindingFence, ConfigDigest: b.ConfigDigest, EgressPolicyRevision: b.EgressPolicyRevision},
		MeasuredAt: stamp(measured), ValidUntil: stamp(valid), ElapsedMs: uint64((result.Elapsed + time.Millisecond - 1) / time.Millisecond),
		Point: result.Point, Status: result.Status, Code: result.Code, ApplicationHealth: "unknown", Source: "agent-reported",
		ApplicationPayloadBytes: 0}
	raw, err := json.Marshal(body)
	if err != nil {
		return proberesult.Request{}, time.Time{}, err
	}
	if _, err := proberesult.ParseRequest(raw); err != nil {
		return proberesult.Request{}, time.Time{}, err
	}
	// Server generation was AFTER requestedAt: this inverse upper bound deducts
	// the entire exchange uncertainty again, plus server millisecond quantization.
	reportUntil := receipt.requestedAt.Add(valid.Sub(receipt.serverAt) - time.Millisecond)
	if !time.Now().Before(reportUntil) {
		return proberesult.Request{}, time.Time{}, probe.ErrDenied
	}
	return body, reportUntil, nil
}
