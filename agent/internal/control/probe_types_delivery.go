package control

import (
	"context"
	"time"

	"github.com/tunex/vnext/agent/internal/nativeexecution"
	"github.com/tunex/vnext/agent/internal/probe"
)

// Select one protocol before I/O; a typed failure never falls back or spends a second poll slot.
func (runner *Runner) pollProbeTask(ctx context.Context) (*probeDeliveryOffer, error) {
	runner.mutex.Lock()
	session := runner.probeRegistration
	if session == nil || session.typesPending || !runner.probeCurrentLocked(session) {
		runner.mutex.Unlock()
		return nil, probe.ErrDenied
	}
	typed := session.types != nil
	services := session.services != nil
	echo := session.echo != nil
	if runner.options.ProbeEcho && !echo || echo && !runner.probeEchoCurrentLocked(session) {
		runner.mutex.Unlock()
		return nil, probe.ErrDenied
	}
	if !echo && runner.options.ProbeServices && !services || services && !runner.probeServicesCurrentLocked(session) {
		runner.mutex.Unlock()
		return nil, probe.ErrDenied
	}
	if typed && !runner.probeTypesCurrentLocked(session) {
		runner.mutex.Unlock()
		return nil, probe.ErrDenied
	}
	runner.mutex.Unlock()
	if echo {
		return runner.pollProbeEcho(ctx, session)
	}
	if services {
		return runner.pollProbeServices(ctx, session)
	}
	if typed {
		return runner.pollProbeTypes(ctx, session)
	}
	return runner.pollProbe(ctx)
}

func (runner *Runner) pollProbeTypes(ctx context.Context, session *registeredProbe) (*probeDeliveryOffer, error) {
	runner.mutex.Lock()
	if ctx.Err() != nil || !runner.probeTypesCurrentLocked(session) || runner.hello.Policy.MaxClockSkewSeconds > 2 {
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
	machine, err := runner.probeTypesMachine(session)
	if err != nil {
		return nil, err
	}
	request, raw, err := nativeexecution.EncodeProbeTypesPoll(machine, probeTypesMeasurements())
	if err != nil {
		return nil, err
	}
	raw, started, err := runner.probeDeliveryExchange(ctx, session, "/agent/v3/probe/types/poll", request)
	if err != nil {
		return nil, err
	}
	ack, err := nativeexecution.DecodeProbeTypesPoll(request, raw)
	if err != nil {
		return nil, err
	}
	freshUntil, err := probeFreshUntilWith(runner.scheduler(), session, started, ack.ObservedAt, ack.ServerTime)
	if err != nil {
		return nil, err
	}
	runner.mutex.Lock()
	defer runner.mutex.Unlock()
	if ctx.Err() != nil || !runner.probeTypesCurrentLocked(session) || !runner.scheduler().Now().Before(freshUntil) {
		return nil, probe.ErrDenied
	}
	if ack.Offer == nil {
		return nil, nil
	}
	offer := ack.Offer
	descriptor, err := probeTypesDescriptor(offer.Measurement)
	if err != nil || descriptor != offer.Descriptor {
		return nil, probe.ErrDenied
	}
	if _, used := session.claims[offer.PermitId]; used {
		return nil, probe.ErrReplay
	}
	binding := probeTypesBinding(offer.Binding)
	target, err := runner.probeTargetForMeasurementLocked(binding, offer.Measurement)
	if err != nil {
		return nil, err
	}
	expires, _ := nativeexecution.ParseProbeWireTime(offer.ExpiresAt)
	server, _ := nativeexecution.ParseProbeWireTime(ack.ServerTime)
	remaining := expires.Sub(server) - skew
	if remaining <= 0 || remaining > 2*time.Second {
		return nil, probe.ErrDenied
	}
	until := minProbeDeadline(started.Add(remaining), minProbeDeadline(session.types.until, target.ExecutionUntil))
	if !runner.scheduler().Now().Before(until) || !runner.scheduler().Now().Before(freshUntil) {
		return nil, probe.ErrDenied
	}
	return &probeDeliveryOffer{permitID: offer.PermitId, measurement: offer.Measurement, typed: true,
		binding: binding, until: until, timeout: time.Duration(offer.TimeoutMs) * time.Millisecond,
		instance: runner.probeInstanceLocked(binding), session: session, issuedAt: offer.IssuedAt, expiresAt: offer.ExpiresAt}, nil
}

func (runner *Runner) claimProbeTypes(ctx context.Context, offer probeDeliveryOffer) (*probeClaimReceipt, error) {
	descriptor, err := probeTypesDescriptor(offer.measurement)
	if err != nil || !offer.typed || ctx.Err() != nil {
		return nil, probe.ErrDenied
	}
	runner.mutex.Lock()
	session := runner.probeRegistration
	if session == nil || session != offer.session || !runner.probeTypesCurrentLocked(session) || !offer.binding.Valid() ||
		runner.hello.Policy.MaxClockSkewSeconds > 2 || !runner.scheduler().Now().Before(offer.until) {
		runner.mutex.Unlock()
		return nil, probe.ErrDenied
	}
	target, err := runner.probeTargetForMeasurementLocked(offer.binding, offer.measurement)
	if err != nil || offer.measurement == probe.MeasurementIngress &&
		(offer.instance == nil || runner.probeInstanceLocked(offer.binding) != offer.instance) {
		runner.mutex.Unlock()
		return nil, probe.ErrDenied
	}
	machine, err := runner.probeTypesMachine(session)
	if err != nil {
		runner.mutex.Unlock()
		return nil, err
	}
	request := nativeexecution.ProbeTypesClaimRequest(machine, descriptor, offer.permitID)
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
	// The same original session claim table is burned before every typed exchange, including lost acknowledgements.
	session.claims[offer.permitID] = struct{}{}
	skew := time.Duration(runner.hello.Policy.MaxClockSkewSeconds) * time.Second
	limit := minProbeDeadline(offer.until, minProbeDeadline(session.types.until, target.ExecutionUntil))
	runner.mutex.Unlock()
	work, cancel := runner.scheduler().WithDeadline(ctx, limit)
	defer cancel()
	raw, err := nativeexecution.EncodeProbeTypesClaim(request)
	if err != nil {
		return nil, err
	}
	release, err := probeDeliveries.acquire(session.node, false, runner.scheduler().Now())
	if err != nil {
		return nil, err
	}
	defer release()
	raw, started, err := runner.probeDeliveryExchange(work, session, "/agent/v3/probe/types/claim", request)
	if err != nil {
		return nil, err
	}
	ack, err := nativeexecution.DecodeProbeTypesClaim(request, raw)
	if err != nil {
		return nil, err
	}
	if probeTypesBinding(ack.Binding) != offer.binding || time.Duration(ack.TimeoutMs)*time.Millisecond != offer.timeout ||
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
	if work.Err() != nil || !runner.probeTypesCurrentLocked(session) {
		return nil, probe.ErrDenied
	}
	receipt := &probeClaimReceipt{permitID: offer.permitID, measurement: offer.measurement, typed: true, instance: offer.instance,
		binding: offer.binding, timeout: offer.timeout, session: session, issuedAt: ack.IssuedAt, expiresAt: ack.ExpiresAt,
		consumedAt: ack.ConsumedAt, serverAt: server, requestedAt: started, receivedAt: runner.scheduler().Now()}
	target, err = runner.probeTargetForReceiptLocked(*receipt)
	if err != nil {
		return nil, err
	}
	receipt.until = minProbeDeadline(limit, minProbeDeadline(started.Add(remaining), minProbeDeadline(session.types.until, target.ExecutionUntil)))
	if !runner.scheduler().Now().Before(receipt.until) {
		return nil, probe.ErrDenied
	}
	if session.receipts == nil {
		session.receipts = make(map[string]*probeClaimReceipt)
	}
	session.receipts[offer.permitID] = receipt
	return receipt, nil
}
