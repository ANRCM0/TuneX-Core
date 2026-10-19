package control

import (
	"context"
	"sync/atomic"
	"time"

	"github.com/tunex/vnext/agent/internal/nativeexecution"
	"github.com/tunex/vnext/agent/internal/platformruntime"
	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/probeecho"
	"github.com/tunex/vnext/agent/internal/proberesult"
	"github.com/tunex/vnext/agent/internal/probeservices"
	"github.com/tunex/vnext/agent/internal/probetypes"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

// An observation plus its still-live monitor, never reusable execution authority.
type probeExecution struct {
	watch                      *probeAuthorityWatch
	body                       proberesult.Request
	typedBody                  *probetypes.ResultRequest
	servicesBody               *probeservices.ResultRequest
	echoBody                   *probeecho.ResultRequest
	reportUntil, validityUntil time.Time
	reported                   atomic.Bool
}

func (execution *probeExecution) Close() { execution.watch.Close() }

func (execution *probeExecution) checkResultAuthority() error {
	if err := execution.watch.Check(); err != nil {
		return err
	}
	execution.watch.mutex.Lock()
	currentUntil := execution.watch.until
	clockRegressed := execution.watch.lastServer.Before(execution.watch.receipt.serverAt)
	execution.watch.mutex.Unlock()
	if !execution.watch.scheduler().Now().Before(execution.reportUntil) || execution.validityUntil.After(currentUntil) || clockRegressed {
		execution.watch.fail(probe.ErrDenied)
		return probe.ErrDenied
	}
	return nil
}

func (execution *probeExecution) resultRequest() (proberesult.Request, error) {
	if execution.typedBody != nil || execution.servicesBody != nil || execution.echoBody != nil || execution.watch.receipt.typed || execution.watch.receipt.services || execution.watch.receipt.echo {
		return proberesult.Request{}, probe.ErrDenied
	}
	if err := execution.checkResultAuthority(); err != nil {
		return proberesult.Request{}, err
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
	started := runner.scheduler().Now()
	result, err := owned.session.gate.Run(watch.ctx, probe.Grant{PermitID: owned.permitID,
		InstanceID: owned.session.gate.InstanceID(), Timeout: owned.timeout,
		Permit: probe.Permit{Binding: owned.binding, Measurement: owned.measurement, Service: owned.service, Echo: owned.echoInput, Until: until, Check: watch.Check}})
	if err != nil {
		return nil, err
	}
	if err := watch.Check(); err != nil {
		return nil, err
	}
	watch.mutex.Lock()
	until = minProbeDeadline(until, watch.until)
	watch.mutex.Unlock()
	body, reportUntil, err := projectProbeResultWith(runner.scheduler(), runner.entropy(), owned, started, until, result)
	if err != nil {
		return nil, err
	}
	// The wire-validity projection is later than the safe reporting cutoff.
	execution := &probeExecution{watch: watch, body: body, reportUntil: reportUntil,
		validityUntil: reportUntil.Add(owned.receivedAt.Sub(owned.requestedAt) + time.Millisecond)}
	if owned.echo {
		echoBody, err := probeEchoResult(owned, body, result)
		if err != nil {
			return nil, err
		}
		execution.echoBody = &echoBody
	} else if owned.services {
		services, err := serviceProbeResultWith(runner.scheduler(), owned, body, result)
		if err != nil {
			return nil, err
		}
		execution.servicesBody = &services
	} else if owned.typed {
		typed, err := typedProbeResult(owned, body)
		if err != nil {
			return nil, err
		}
		execution.typedBody = &typed
	}
	if err := execution.checkResultAuthority(); err != nil {
		return nil, err
	}
	accepted = true
	return execution, nil
}

func probeResultRequest(receipt probeClaimReceipt, started, until time.Time, result probe.Result) (proberesult.Request, time.Time, error) {
	if receipt.typed || receipt.services || receipt.echo || receipt.measurement != "" {
		return proberesult.Request{}, time.Time{}, probe.ErrDenied
	}
	return projectProbeResult(receipt, started, until, result)
}

// Both protocols use this one monotonic-to-wire clock projection and reporting cutoff.
func projectProbeResult(receipt probeClaimReceipt, started, until time.Time, result probe.Result) (proberesult.Request, time.Time, error) {
	return projectProbeResultWith(platformruntime.Schedule{}, platformruntime.Local{}, receipt, started, until, result)
}

func projectProbeResultWith(schedule runtimeplatform.Scheduler, source runtimeplatform.Entropy, receipt probeClaimReceipt, started, until time.Time, result probe.Result) (proberesult.Request, time.Time, error) {
	point := "agent-direct-egress"
	if receipt.echo {
		descriptor, err := probeecho.DescriptorFor(receipt.measurement)
		if err != nil || result.Measurement != receipt.measurement {
			return proberesult.Request{}, time.Time{}, probe.ErrDenied
		}
		point = descriptor.Point
	} else if receipt.services {
		descriptor, err := probeServicesDescriptor(receipt.measurement)
		if err != nil || receipt.typed || result.Measurement != receipt.measurement {
			return proberesult.Request{}, time.Time{}, probe.ErrDenied
		}
		point = descriptor.Point
	} else if receipt.typed {
		descriptor, err := probeTypesDescriptor(receipt.measurement)
		if err != nil || result.Measurement != receipt.measurement {
			return proberesult.Request{}, time.Time{}, probe.ErrDenied
		}
		point = descriptor.Point
	} else if receipt.measurement != "" || result.Measurement != "" {
		return proberesult.Request{}, time.Time{}, probe.ErrDenied
	}
	now := schedule.Now()
	consumed, e1 := nativeexecution.ParseProbeWireTime(receipt.consumedAt)
	expires, e2 := nativeexecution.ParseProbeWireTime(receipt.expiresAt)
	if e1 != nil || e2 != nil || receipt.serverAt.Before(consumed) || !receipt.serverAt.Before(expires) ||
		receipt.session == nil || receipt.session.gate == nil || receipt.serverAt.IsZero() ||
		receipt.requestedAt.IsZero() || receipt.receivedAt.IsZero() || receipt.requestedAt.After(receipt.receivedAt) ||
		receipt.receivedAt.After(started) || started.After(result.MeasuredAt) || result.MeasuredAt.After(now) ||
		result.Binding != receipt.binding || !result.IndependentProbe || result.Point != point ||
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
	id, err := probeRequestIDWith(source)
	if err != nil {
		return proberesult.Request{}, time.Time{}, err
	}
	b, session := receipt.binding, receipt.session
	body, err := nativeexecution.ProjectProbeResult(nativeexecution.ProbeResultProjection{NodeID: session.node,
		BootID: session.boot, SessionEpoch: session.epoch, InstanceID: session.gate.InstanceID(), InstanceGeneration: session.generation,
		PermitID: receipt.permitID, RequestID: id, Timeout: receipt.timeout,
		IssuedAt: receipt.issuedAt, ExpiresAt: receipt.expiresAt, ConsumedAt: receipt.consumedAt,
		Binding: proberesult.Binding{NodeId: b.NodeID, BootId: b.BootID, SessionEpoch: b.SessionEpoch,
			SnapshotGeneration: b.SnapshotGeneration, AssignmentId: b.AssignmentID, ForwardId: b.ForwardID,
			ForwardRevision: b.ForwardRevision, DeploymentGeneration: b.DeploymentGeneration,
			BindingFence: b.BindingFence, ConfigDigest: b.ConfigDigest, EgressPolicyRevision: b.EgressPolicyRevision},
		MeasuredAt: measured, ValidUntil: valid, Elapsed: result.Elapsed,
		Point: result.Point, Status: result.Status, Code: result.Code}, !receipt.typed && !receipt.services)
	if err != nil {
		return proberesult.Request{}, time.Time{}, err
	}
	// Server generation was AFTER requestedAt: this inverse upper bound deducts
	// the entire exchange uncertainty again, plus server millisecond quantization.
	reportUntil := receipt.requestedAt.Add(valid.Sub(receipt.serverAt) - time.Millisecond)
	if !schedule.Now().Before(reportUntil) {
		return proberesult.Request{}, time.Time{}, probe.ErrDenied
	}
	return body, reportUntil, nil
}
