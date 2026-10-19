package control

import (
	"time"

	"github.com/tunex/vnext/agent/internal/nativeexecution"
	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/probeecho"
	"github.com/tunex/vnext/agent/internal/proberesult"
)

func (runner *Runner) probeEchoStatusExchange(watch *probeAuthorityWatch) error {
	if !watch.receipt.echo {
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
	machine, err := runner.probeEchoMachine(session)
	if err != nil {
		return err
	}
	descriptor, err := probeecho.DescriptorFor(receipt.measurement)
	if err != nil {
		return err
	}
	request, raw, err := nativeexecution.EncodeProbeEchoStatus(machine, descriptor, receipt.permitID,
		probeEchoSelection(receipt.service, receipt.echoInput), probeEchoChallenge(receipt.echoInput))
	if err != nil {
		return err
	}
	raw, started, err := runner.probeDeliveryExchange(work, session, "/agent/v3/probe/echo/status", request)
	if err != nil {
		return err
	}
	ack, err := nativeexecution.DecodeProbeEchoStatus(request, raw)
	if err != nil {
		return err
	}
	if !sameProbeServiceSelection(request.Service, ack.Service) || !sameProbeEchoChallenge(request.Challenge, ack.Challenge) ||
		probeTypesBinding(ack.Binding) != receipt.binding || ack.IssuedAt != receipt.issuedAt || ack.ExpiresAt != receipt.expiresAt ||
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

func probeEchoResult(receipt probeClaimReceipt, fields proberesult.Request, result probe.Result) (probeecho.ResultRequest, error) {
	if !receipt.echo || receipt.echoInput == nil || receipt.service != nil || result.Service != nil || result.TLS != nil {
		return probeecho.ResultRequest{}, probe.ErrDenied
	}
	descriptor, err := probeecho.DescriptorFor(receipt.measurement)
	if err != nil || fields.Point != descriptor.Point || result.Measurement != receipt.measurement {
		return probeecho.ResultRequest{}, probe.ErrDenied
	}
	var proof *probeecho.Proof
	if result.Echo != nil {
		if !result.Echo.Verified || fields.Status != "echoed" || fields.Code != "nonce-echo-verified" ||
			!probeecho.VerifyProof(receipt.echoInput.Context, receipt.echoInput.Invocation, receipt.echoInput.Challenge, *result.Echo) ||
			result.RequestBytes != 256 || result.ResponseBytes != 256 {
			return probeecho.ResultRequest{}, probe.ErrDenied
		}
		copy := *result.Echo
		proof = &copy
	} else if fields.Status != "unverified" || fields.Code != "nonce-echo-rejected" && fields.Code != "tcp-connect-failed" {
		return probeecho.ResultRequest{}, probe.ErrDenied
	}
	return nativeexecution.ProbeEchoResult(fields, descriptor, typedProbeBinding(receipt.binding), probeEchoSelection(receipt.service, receipt.echoInput),
		probeEchoChallenge(receipt.echoInput), proof, result.RequestBytes, result.ResponseBytes)
}

func (execution *probeExecution) echoResultRequest() (probeecho.ResultRequest, error) {
	if !execution.watch.receipt.echo || execution.watch.receipt.typed || execution.watch.receipt.services || execution.echoBody == nil {
		return probeecho.ResultRequest{}, probe.ErrDenied
	}
	if err := execution.checkResultAuthority(); err != nil {
		return probeecho.ResultRequest{}, err
	}
	copy := *execution.echoBody
	if copy.Service != nil {
		value := *copy.Service
		copy.Service = &value
	}
	if copy.Challenge != nil {
		value := *copy.Challenge
		copy.Challenge = &value
	}
	if copy.Echo != nil {
		value := *copy.Echo
		copy.Echo = &value
	}
	return copy, nil
}

func (runner *Runner) reportProbeEcho(execution *probeExecution) error {
	request, err := execution.echoResultRequest()
	if err != nil {
		return err
	}
	work, cancel := runner.scheduler().WithDeadline(execution.watch.ctx, execution.reportUntil)
	defer cancel()
	raw, _, err := runner.probeDeliveryExchange(work, execution.watch.receipt.session, "/agent/v3/probe/echo/result", request)
	if err != nil {
		return err
	}
	ack, err := nativeexecution.DecodeProbeEchoResultResponse(request, raw)
	if err != nil {
		return err
	}
	if !sameProbeServiceSelection(request.Service, ack.Service) || !sameProbeEchoChallenge(request.Challenge, ack.Challenge) {
		return probe.ErrDenied
	}
	server, err := nativeexecution.ParseProbeWireTime(ack.ServerTime)
	if err != nil || execution.watch.receipt.session.guard.ValidateServerTime(server) != nil {
		return probe.ErrDenied
	}
	_, err = execution.echoResultRequest()
	return err
}
