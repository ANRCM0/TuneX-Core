package control

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/probedelivery"
)

// An internal observation monitor, NOT a probe.Permit/Grant or socket admission by itself.
type probeAuthorityWatch struct {
	runner                                     *Runner
	receipt                                    probeClaimReceipt // Detached immutable copy of the accepted receipt.
	ctx                                        context.Context
	cancel                                     context.CancelFunc
	done                                       chan struct{} // Closes only after HTTP work and the local supervisor have terminated.
	changed                                    chan struct{}
	mutex                                      sync.Mutex
	ready                                      bool
	until, freshUntil, lastChecked, lastServer time.Time
	err                                        error
}

func (watch *probeAuthorityWatch) fail(err error) {
	watch.mutex.Lock()
	if watch.err == nil {
		watch.err = err
	}
	watch.mutex.Unlock()
	watch.cancel()
}
func (watch *probeAuthorityWatch) current() error {
	watch.mutex.Lock()
	defer watch.mutex.Unlock()
	if watch.err != nil {
		return watch.err
	}
	if err := watch.ctx.Err(); err != nil {
		return err
	}
	if !watch.ready || !time.Now().Before(watch.freshUntil) || !time.Now().Before(watch.until) {
		return probe.ErrDenied
	}
	return nil
}
func (watch *probeAuthorityWatch) Check() error {
	if err := watch.current(); err != nil {
		watch.fail(err)
		return err
	}
	if err := watch.runner.probeWatchLocal(watch); err != nil {
		watch.fail(err)
		return err
	}
	if err := watch.current(); err != nil {
		watch.fail(err)
		return err
	}
	return nil
}
func (watch *probeAuthorityWatch) Close() { watch.fail(context.Canceled); <-watch.done }

func (watch *probeAuthorityWatch) notify() {
	select {
	case watch.changed <- struct{}{}:
	default:
	}
}
func (watch *probeAuthorityWatch) tighten(until time.Time) error {
	watch.mutex.Lock()
	defer watch.mutex.Unlock()
	if watch.err != nil {
		return watch.err
	}
	if watch.ctx.Err() != nil || !time.Now().Before(until) || !time.Now().Before(watch.until) {
		return probe.ErrDenied
	}
	if until.Before(watch.until) {
		watch.until = until
		watch.freshUntil = minProbeDeadline(watch.freshUntil, until)
		watch.notify()
	}
	return nil
}
func (watch *probeAuthorityWatch) publish(until, checked, server time.Time) error {
	watch.mutex.Lock()
	defer watch.mutex.Unlock()
	now := time.Now()
	if watch.err != nil {
		return watch.err
	}
	if watch.ctx.Err() != nil || !now.Before(watch.freshUntil) || !now.Before(watch.until) || !now.Before(until) ||
		checked.Before(watch.lastChecked) || server.Before(watch.lastServer) {
		return probe.ErrDenied
	}
	watch.ready = true
	watch.freshUntil = minProbeDeadline(until, watch.until)
	watch.lastChecked, watch.lastServer = checked, server
	watch.notify()
	return nil
}

func (runner *Runner) probeWatchLocal(watch *probeAuthorityWatch) error {
	session, receipt := watch.receipt.session, watch.receipt
	runner.mutex.Lock()
	if runner.probeRegistration != session || !runner.probeCurrentLocked(session) || runner.hello.Policy.MaxClockSkewSeconds > 2 {
		runner.mutex.Unlock()
		return probe.ErrDenied
	}
	target, err := runner.probeTargetLocked(receipt.binding)
	until := minProbeDeadline(receipt.until, minProbeDeadline(session.until, target.ExecutionUntil))
	runner.mutex.Unlock()
	if err != nil {
		return err
	}
	return watch.tighten(until)
}

// Only an exact owner-retained successful claim receipt may start, once. Failures never clear that tombstone.
func (runner *Runner) monitorConsumedProbe(ctx context.Context, receipt *probeClaimReceipt) (*probeAuthorityWatch, error) {
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	runner.mutex.Lock()
	session := runner.probeRegistration
	if session == nil || receipt == nil || receipt.session != session || session.receipts[receipt.permitID] != receipt ||
		!runner.probeCurrentLocked(session) || runner.hello.Policy.MaxClockSkewSeconds > 2 || !time.Now().Before(receipt.until) {
		runner.mutex.Unlock()
		return nil, probe.ErrDenied
	}
	if receipt.watched {
		runner.mutex.Unlock()
		return nil, probe.ErrReplay
	}
	target, err := runner.probeTargetLocked(receipt.binding)
	if err != nil {
		runner.mutex.Unlock()
		return nil, err
	}
	receipt.watched = true
	copy := *receipt
	until := minProbeDeadline(copy.until, minProbeDeadline(session.until, target.ExecutionUntil))
	release, err := probeDeliveries.acquire(session.node, false, time.Now())
	runner.mutex.Unlock()
	if err != nil {
		return nil, err
	}
	work, cancel := context.WithDeadline(ctx, until)
	watch := &probeAuthorityWatch{runner: runner, receipt: copy, ctx: work, cancel: cancel, done: make(chan struct{}),
		changed: make(chan struct{}, 1), until: until, freshUntil: minProbeDeadline(until, time.Now().Add(probeExchangeLimit))}
	first := make(chan error, 1)
	go runner.runProbeWatch(watch, first, release)
	select {
	case err := <-first:
		if err != nil {
			<-watch.done
			return nil, err
		}
		if err := watch.Check(); err != nil {
			<-watch.done
			return nil, err
		}
		return watch, nil
	case <-work.Done():
		watch.fail(work.Err())
		return nil, work.Err()
	}
}

func (runner *Runner) probeStatusExchange(watch *probeAuthorityWatch) error {
	if err := runner.probeWatchLocal(watch); err != nil {
		return err
	}
	watch.mutex.Lock()
	freshUntil := watch.freshUntil
	watch.mutex.Unlock()
	work, cancel := context.WithDeadline(watch.ctx, freshUntil)
	defer cancel()
	id, err := probeRequestID()
	if err != nil {
		return err
	}
	session, receipt := watch.receipt.session, watch.receipt
	request := probedelivery.StatusRequest{ProtocolVersion: 3, ProbeVersion: 1, Kind: "probe-status", NodeId: session.node,
		BootId: session.boot, SessionEpoch: session.epoch, InstanceId: session.gate.InstanceID(), InstanceGeneration: session.generation,
		RequestId: id, PermitId: receipt.permitID}
	raw, err := json.Marshal(request)
	if err != nil {
		return err
	}
	if _, err := probedelivery.ParseStatusRequest(raw); err != nil {
		return err
	}
	raw, started, err := runner.probeDeliveryExchange(work, session, "/agent/v3/probe/status", request)
	if err != nil {
		return err
	}
	ack, err := probedelivery.ParseStatusResponse(raw)
	if err != nil {
		return err
	}
	if err := probedelivery.CheckStatusResponse(request, *ack); err != nil {
		return err
	}
	if deliveryBinding(ack.Binding) != receipt.binding || ack.IssuedAt != receipt.issuedAt || ack.ExpiresAt != receipt.expiresAt ||
		ack.ConsumedAt != receipt.consumedAt || time.Duration(ack.TimeoutMs)*time.Millisecond != receipt.timeout {
		return probe.ErrDenied
	}
	freshUntil, err = probeFreshUntil(session, started, ack.CheckedAt, ack.ServerTime)
	if err != nil {
		return err
	}
	if err := runner.probeWatchLocal(watch); err != nil {
		return err
	}
	checked, _ := time.Parse(time.RFC3339Nano, ack.CheckedAt)
	server, _ := time.Parse(time.RFC3339Nano, ack.ServerTime)
	if work.Err() != nil {
		return work.Err()
	}
	return watch.publish(freshUntil, checked, server)
}

func (runner *Runner) superviseProbeWatch(watch *probeAuthorityWatch, done chan struct{}) {
	defer close(done)
	ticker := time.NewTicker(25 * time.Millisecond)
	defer ticker.Stop()
	for {
		if watch.ctx.Err() != nil {
			return
		}
		if err := runner.probeWatchLocal(watch); err != nil {
			watch.fail(err)
			return
		}
		watch.mutex.Lock()
		until := minProbeDeadline(watch.until, watch.freshUntil)
		watch.mutex.Unlock()
		deadline := time.NewTimer(time.Until(until))
		select {
		case <-watch.ctx.Done():
			deadline.Stop()
			return
		case <-deadline.C:
			// A completed response may have moved freshness while the previous timer was selected.
			watch.mutex.Lock()
			expired := !time.Now().Before(minProbeDeadline(watch.until, watch.freshUntil))
			watch.mutex.Unlock()
			if expired {
				watch.fail(probe.ErrDenied)
				return
			}
		case <-watch.changed:
			deadline.Stop()
		case <-ticker.C:
			deadline.Stop()
		}
	}
}
func (runner *Runner) runProbeWatch(watch *probeAuthorityWatch, first chan<- error, release func()) {
	supervised := make(chan struct{})
	stop := context.AfterFunc(watch.receipt.session.ctx, func() { watch.fail(probe.ErrDenied) })
	defer stop()
	go runner.superviseProbeWatch(watch, supervised)
	defer func() { watch.fail(context.Canceled); <-supervised; release(); close(watch.done) }()
	for attempt := 0; attempt < 40; attempt++ {
		err := runner.probeStatusExchange(watch)
		if err != nil {
			watch.fail(err)
		}
		if attempt == 0 {
			first <- err
		}
		if err != nil {
			return
		}
		// Wait AFTER completion: no overlapping requests, catch-up bursts, retries or unbounded polling.
		timer := time.NewTimer(probeStatusInterval)
		select {
		case <-watch.ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}
	}
}
