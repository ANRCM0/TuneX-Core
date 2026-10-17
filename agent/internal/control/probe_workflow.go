package control

import (
	"context"
	"time"

	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/proberesult"
)

// One serial task, with all admission and target selection still owned by the existing gates.
func (runner *Runner) runProbeTask(ctx context.Context) error {
	if !runner.options.ProbeExecution || !runner.options.ProbeRegistration {
		return probe.ErrDenied
	}
	offer, err := runner.pollProbe(ctx)
	if err != nil || offer == nil {
		return err
	}
	if !time.Now().Before(offer.until) {
		return probe.ErrDenied
	}
	receipt, err := runner.claimProbe(ctx, offer.permitID, offer.binding)
	if err != nil {
		return err
	}
	if receipt.timeout != offer.timeout {
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
	request, err := execution.resultRequest()
	if err != nil {
		return err
	}
	work, cancel := context.WithDeadline(execution.watch.ctx, execution.reportUntil)
	defer cancel()
	raw, _, err := runner.probeDeliveryExchange(work, execution.watch.receipt.session, "/agent/v3/probe/result", request)
	if err != nil {
		return err
	}
	ack, err := proberesult.ParseResponse(raw)
	if err != nil {
		return err
	}
	if err := proberesult.CheckResponse(request, *ack); err != nil {
		return err
	}
	server, err := time.Parse(time.RFC3339Nano, ack.ServerTime)
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
		timer := time.NewTimer(time.Second)
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}
	}
}
