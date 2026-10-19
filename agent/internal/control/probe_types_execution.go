package control

import (
	"time"

	"github.com/tunex/vnext/agent/internal/nativeexecution"
	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/proberesult"
	"github.com/tunex/vnext/agent/internal/probetypes"
)

func (runner *Runner) probeTypesStatusExchange(watch *probeAuthorityWatch) error {
	if !watch.receipt.typed || watch.receipt.services {
		return probe.ErrDenied
	}
	if err := runner.probeWatchLocal(watch); err != nil {
		return err
	}
	watch.mutex.Lock()
	freshUntil := watch.freshUntil
	watch.mutex.Unlock()
	work, cancel := runner.scheduler().WithDeadline(watch.ctx, freshUntil)
	defer cancel()
	session, receipt := watch.receipt.session, watch.receipt
	machine, err := runner.probeTypesMachine(session)
	if err != nil {
		return err
	}
	descriptor, err := probeTypesDescriptor(receipt.measurement)
	if err != nil {
		return err
	}
	request, raw, err := nativeexecution.EncodeProbeTypesStatus(machine, descriptor, receipt.permitID)
	if err != nil {
		return err
	}
	raw, started, err := runner.probeDeliveryExchange(work, session, "/agent/v3/probe/types/status", request)
	if err != nil {
		return err
	}
	ack, err := nativeexecution.DecodeProbeTypesStatus(request, raw)
	if err != nil {
		return err
	}
	if probeTypesBinding(ack.Binding) != receipt.binding || ack.IssuedAt != receipt.issuedAt || ack.ExpiresAt != receipt.expiresAt ||
		ack.ConsumedAt != receipt.consumedAt || time.Duration(ack.TimeoutMs)*time.Millisecond != receipt.timeout {
		return probe.ErrDenied
	}
	freshUntil, err = probeFreshUntilWith(runner.scheduler(), session, started, ack.CheckedAt, ack.ServerTime)
	if err != nil {
		return err
	}
	if err := runner.probeWatchLocal(watch); err != nil {
		return err
	}
	checked, _ := nativeexecution.ParseProbeWireTime(ack.CheckedAt)
	server, _ := nativeexecution.ParseProbeWireTime(ack.ServerTime)
	if work.Err() != nil {
		return work.Err()
	}
	return watch.publish(freshUntil, checked, server)
}

// The legacy struct is an internal projection here, never sent or parsed on the v1 route.
func typedProbeResult(receipt probeClaimReceipt, fields proberesult.Request) (probetypes.ResultRequest, error) {
	if !receipt.typed || receipt.services {
		return probetypes.ResultRequest{}, probe.ErrDenied
	}
	descriptor, err := probeTypesDescriptor(receipt.measurement)
	if err != nil || fields.Point != descriptor.Point {
		return probetypes.ResultRequest{}, probe.ErrDenied
	}
	return nativeexecution.ProbeTypesResult(fields, descriptor, typedProbeBinding(receipt.binding))
}

func (execution *probeExecution) typedResultRequest() (probetypes.ResultRequest, error) {
	if !execution.watch.receipt.typed || execution.watch.receipt.services || execution.typedBody == nil {
		return probetypes.ResultRequest{}, probe.ErrDenied
	}
	if err := execution.checkResultAuthority(); err != nil {
		return probetypes.ResultRequest{}, err
	}
	return *execution.typedBody, nil
}

func (runner *Runner) reportProbeTypes(execution *probeExecution) error {
	// reportProbe already burned the shared once-only report bit before dispatching here.
	request, err := execution.typedResultRequest()
	if err != nil {
		return err
	}
	work, cancel := runner.scheduler().WithDeadline(execution.watch.ctx, execution.reportUntil)
	defer cancel()
	raw, _, err := runner.probeDeliveryExchange(work, execution.watch.receipt.session, "/agent/v3/probe/types/result", request)
	if err != nil {
		return err
	}
	ack, err := nativeexecution.DecodeProbeTypesResultResponse(request, raw)
	if err != nil {
		return err
	}
	server, err := nativeexecution.ParseProbeWireTime(ack.ServerTime)
	if err != nil || execution.watch.receipt.session.guard.ValidateServerTime(server) != nil {
		return probe.ErrDenied
	}
	_, err = execution.typedResultRequest()
	return err
}
