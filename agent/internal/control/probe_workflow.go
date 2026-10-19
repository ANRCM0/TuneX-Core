package control

import (
	"context"
	"time"

	"github.com/tunex/vnext/agent/internal/nativeexecution"
	"github.com/tunex/vnext/agent/internal/probe"
)

// One serial task, with all admission and target selection still owned by the existing gates.
func (runner *Runner) runProbeTask(ctx context.Context) error {
	if !runner.options.ProbeExecution || !runner.options.ProbeRegistration {
		return probe.ErrDenied
	}
	offer, err := runner.pollProbeTask(ctx)
	if err != nil || offer == nil {
		return err
	}
	if !runner.scheduler().Now().Before(offer.until) {
		return probe.ErrDenied
	}
	var receipt *probeClaimReceipt
	if offer.echo {
		receipt, err = runner.claimProbeEcho(ctx, *offer)
	} else if offer.services {
		receipt, err = runner.claimProbeServices(ctx, *offer)
	} else if offer.typed {
		receipt, err = runner.claimProbeTypes(ctx, *offer)
	} else {
		receipt, err = runner.claimProbe(ctx, offer.permitID, offer.binding)
	}
	if err != nil {
		return err
	}
	if receipt.timeout != offer.timeout || receipt.typed != offer.typed || receipt.services != offer.services || receipt.echo != offer.echo || receipt.measurement != offer.measurement ||
		!sameProbeServiceSelection(probeServiceSelection(receipt.service), probeServiceSelection(offer.service)) || !sameProbeEchoInput(receipt.echoInput, offer.echoInput) {
		return probe.ErrDenied
	}
	runner.mutex.Lock()
	receipt.until = minProbeDeadline(receipt.until, offer.until)
	runner.mutex.Unlock()
	execution, err := runner.executeConsumedProbe(ctx, receipt)
	if err != nil {
		return err
	}
	defer execution.Close()
	return runner.reportProbe(execution)
}

func (runner *Runner) reportProbe(execution *probeExecution) error {
	// Burn before I/O. Lost acknowledgements and even local admission failures are never retried.
	if !execution.reported.CompareAndSwap(false, true) {
		return probe.ErrReplay
	}
	if execution.watch.receipt.echo {
		return runner.reportProbeEcho(execution)
	}
	if execution.watch.receipt.services {
		return runner.reportProbeServices(execution)
	}
	if execution.watch.receipt.typed {
		return runner.reportProbeTypes(execution)
	}
	request, err := execution.resultRequest()
	if err != nil {
		return err
	}
	work, cancel := runner.scheduler().WithDeadline(execution.watch.ctx, execution.reportUntil)
	defer cancel()
	raw, _, err := runner.probeDeliveryExchange(work, execution.watch.receipt.session, "/agent/v3/probe/result", request)
	if err != nil {
		return err
	}
	ack, err := nativeexecution.DecodeProbeResultResponse(request, raw)
	if err != nil {
		return err
	}
	server, err := nativeexecution.ParseProbeWireTime(ack.ServerTime)
	if err != nil || execution.watch.receipt.session.guard.ValidateServerTime(server) != nil {
		return probe.ErrDenied
	}
	_, err = execution.resultRequest()
	return err
}

func (runner *Runner) maintainProbeExecution(ctx context.Context) {
	for ctx.Err() == nil {
		// A failed task stays failed. Future polls may discover only other, independently issued IDs.
		_ = runner.runProbeTask(ctx)
		timer := runner.scheduler().NewTimer(time.Second)
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C():
		}
	}
}
