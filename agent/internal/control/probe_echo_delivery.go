package control

import (
	"context"
	"time"

	"github.com/tunex/vnext/agent/internal/nativeexecution"
	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/probeecho"
)

func (runner *Runner) pollProbeEcho(ctx context.Context, session *registeredProbe) (*probeDeliveryOffer, error) {
	runner.mutex.Lock()
	if ctx.Err() != nil || !runner.probeEchoCurrentLocked(session) || runner.hello.Policy.MaxClockSkewSeconds > 2 {
		runner.mutex.Unlock()
		return nil, probe.ErrDenied
	}
	skew := time.Duration(runner.hello.Policy.MaxClockSkewSeconds) * time.Second
	runner.mutex.Unlock()
	release, err := probeDeliveries.acquire(session.node, true, runner.scheduler().Now())
	if err != nil {
		return nil, err
	}
	defer release()
	machine, err := runner.probeEchoMachine(session)
	if err != nil {
		return nil, err
	}
	request, raw, err := nativeexecution.EncodeProbeEchoPoll(machine, runner.probeEchoMeasurements())
	if err != nil {
		return nil, err
	}
	raw, started, err := runner.probeDeliveryExchangeBounded(ctx, session, "/agent/v3/probe/echo/poll", request, 32768)
	if err != nil {
		if runner.options.Diagnostics != "" && runner.options.ProbePathEcho {
			runner.localLog().Warn("Echo poll exchange failed after milliseconds:", runner.scheduler().Now().Sub(started).Milliseconds())
		}
		return nil, err
	}
	ack, err := nativeexecution.DecodeProbeEchoPoll(request, raw)
	if err != nil {
		return nil, err
	}
	freshUntil, err := probeFreshUntilWith(runner.scheduler(), session, started, ack.ObservedAt, ack.ServerTime)
	if err != nil {
		return nil, err
	}
	if ack.Offer == nil {
		runner.mutex.Lock()
		defer runner.mutex.Unlock()
		if ctx.Err() != nil || !runner.probeEchoCurrentLocked(session) || !runner.scheduler().Now().Before(freshUntil) {
			return nil, probe.ErrDenied
		}
		return nil, nil
	}
	offer := ack.Offer
	descriptor, err := probeecho.DescriptorFor(offer.Measurement)
	if err != nil || descriptor != offer.Descriptor {
		return nil, probe.ErrDenied
	}
	service, echoInput, err := probeEchoOfferInputs(session, *offer)
	if err != nil {
		return nil, err
	}
	runner.mutex.Lock()
	defer runner.mutex.Unlock()
	if ctx.Err() != nil || !runner.probeEchoCurrentLocked(session) || !runner.scheduler().Now().Before(freshUntil) {
		return nil, probe.ErrDenied
	}
	if _, used := session.claims[offer.PermitId]; used {
		return nil, probe.ErrReplay
	}
	binding := probeTypesBinding(offer.Binding)
	target, err := runner.probeEchoTargetLocked(binding, offer.Measurement, service, echoInput)
	if err != nil {
		return nil, err
	}
	expires, _ := nativeexecution.ParseProbeWireTime(offer.ExpiresAt)
	server, _ := nativeexecution.ParseProbeWireTime(ack.ServerTime)
	remaining := expires.Sub(server) - skew
	if remaining <= 0 || remaining > 2*time.Second {
		if runner.options.Diagnostics != "" && runner.options.ProbePathEcho {
			runner.localLog().Warn("Echo remaining milliseconds after skew:", remaining.Milliseconds(), "raw:", expires.Sub(server).Milliseconds())
		}
		return nil, probe.ErrDenied
	}
	until := minProbeDeadline(started.Add(remaining), minProbeDeadline(session.echo.until, target.ExecutionUntil))
	if !runner.scheduler().Now().Before(until) || !runner.scheduler().Now().Before(freshUntil) {
		if runner.options.Diagnostics != "" && runner.options.ProbePathEcho {
			runner.localLog().Warn("Echo discovery deadline milliseconds:", until.Sub(started).Milliseconds(), "fresh:", freshUntil.Sub(started).Milliseconds(), "elapsed:", runner.scheduler().Now().Sub(started).Milliseconds())
		}
		return nil, probe.ErrDenied
	}
	return &probeDeliveryOffer{permitID: offer.PermitId, measurement: offer.Measurement, echo: true, service: service, echoInput: echoInput,
		binding: binding, until: until, timeout: time.Duration(offer.TimeoutMs) * time.Millisecond,
		instance: runner.probeInstanceLocked(binding), session: session, issuedAt: offer.IssuedAt, expiresAt: offer.ExpiresAt}, nil
}

func (runner *Runner) claimProbeEcho(ctx context.Context, offer probeDeliveryOffer) (*probeClaimReceipt, error) {
	descriptor, err := probeecho.DescriptorFor(offer.measurement)
	if err != nil || !offer.echo || offer.services || offer.typed || ctx.Err() != nil {
		return nil, probe.ErrDenied
	}
	if offer.service != nil {
		copy := *offer.service
		offer.service = &copy
	}
	if offer.echoInput != nil {
		copy := probeecho.CloneExecution(*offer.echoInput)
		offer.echoInput = &copy
	}
	runner.mutex.Lock()
	session := runner.probeRegistration
	if session == nil || session != offer.session || !runner.probeEchoCurrentLocked(session) || !offer.binding.Valid() ||
		runner.hello.Policy.MaxClockSkewSeconds > 2 || !runner.scheduler().Now().Before(offer.until) {
		runner.mutex.Unlock()
		return nil, probe.ErrDenied
	}
	target, err := runner.probeEchoTargetLocked(offer.binding, offer.measurement, offer.service, offer.echoInput)
	if err != nil || offer.measurement != probe.MeasurementEgress &&
		(offer.instance == nil || runner.probeInstanceLocked(offer.binding) != offer.instance) {
		runner.mutex.Unlock()
		return nil, probe.ErrDenied
	}
	machine, err := runner.probeEchoMachine(session)
	if err != nil {
		runner.mutex.Unlock()
		return nil, err
	}
	request := nativeexecution.ProbeEchoClaimRequest(machine, descriptor, offer.permitID, probeEchoSelection(offer.service, offer.echoInput), probeEchoChallenge(offer.echoInput))
	if _, used := session.claims[offer.permitID]; used {
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
	// All v4 kinds burn the original session table before I/O; nothing refunds a failed exchange.
	session.claims[offer.permitID] = struct{}{}
	skew := time.Duration(runner.hello.Policy.MaxClockSkewSeconds) * time.Second
	limit := minProbeDeadline(offer.until, minProbeDeadline(session.echo.until, target.ExecutionUntil))
	runner.mutex.Unlock()
	work, cancel := runner.scheduler().WithDeadline(ctx, limit)
	defer cancel()
	raw, err := nativeexecution.EncodeProbeEchoClaim(request)
	if err != nil {
		return nil, err
	}
	release, err := probeDeliveries.acquire(session.node, false, runner.scheduler().Now())
	if err != nil {
		return nil, err
	}
	defer release()
	raw, started, err := runner.probeDeliveryExchange(work, session, "/agent/v3/probe/echo/claim", request)
	if err != nil {
		return nil, err
	}
	ack, err := nativeexecution.DecodeProbeEchoClaim(request, raw)
	if err != nil {
		return nil, err
	}
	if !sameProbeServiceSelection(request.Service, ack.Service) || !sameProbeEchoChallenge(request.Challenge, ack.Challenge) ||
		probeTypesBinding(ack.Binding) != offer.binding || time.Duration(ack.TimeoutMs)*time.Millisecond != offer.timeout ||
		ack.IssuedAt != offer.issuedAt || ack.ExpiresAt != offer.expiresAt {
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
	remaining := expires.Sub(server) - skew
	if remaining <= 0 || remaining > 2*time.Second {
		return nil, probe.ErrDenied
	}
	runner.mutex.Lock()
	defer runner.mutex.Unlock()
	if work.Err() != nil || !runner.probeEchoCurrentLocked(session) {
		return nil, probe.ErrDenied
	}
	receipt := &probeClaimReceipt{permitID: offer.permitID, measurement: offer.measurement, echo: true, service: offer.service, echoInput: offer.echoInput,
		instance: offer.instance, binding: offer.binding, timeout: offer.timeout, session: session, issuedAt: ack.IssuedAt, expiresAt: ack.ExpiresAt,
		consumedAt: ack.ConsumedAt, serverAt: server, requestedAt: started, receivedAt: runner.scheduler().Now()}
	target, err = runner.probeTargetForReceiptLocked(*receipt)
	if err != nil {
		return nil, err
	}
	receipt.until = minProbeDeadline(limit, minProbeDeadline(started.Add(remaining), minProbeDeadline(session.echo.until, target.ExecutionUntil)))
	if !runner.scheduler().Now().Before(receipt.until) {
		return nil, probe.ErrDenied
	}
	if session.receipts == nil {
		session.receipts = make(map[string]*probeClaimReceipt)
	}
	session.receipts[offer.permitID] = receipt
	return receipt, nil
}
