package control

import (
	"context"
	"time"

	"github.com/tunex/vnext/agent/internal/nativeexecution"
	"github.com/tunex/vnext/agent/internal/observationtrust"
	"github.com/tunex/vnext/agent/internal/platformruntime"
	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/probeecho"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

type qualifiedProbeEcho struct{ qualifiedAt, expiresAt, until time.Time }

func probeEchoMachine(session *registeredProbe) (probeecho.Machine, error) {
	return probeEchoMachineWith(platformruntime.Local{}, session)
}
func (runner *Runner) probeEchoMachine(session *registeredProbe) (probeecho.Machine, error) {
	return probeEchoMachineWith(runner.entropy(), session)
}
func probeEchoMachineWith(source runtimeplatform.Entropy, session *registeredProbe) (probeecho.Machine, error) {
	id, err := probeRequestIDWith(source)
	if err != nil {
		return probeecho.Machine{}, err
	}
	return nativeexecution.ProbeEchoMachine(session.node, session.boot, session.epoch, session.gate.InstanceID(), session.generation, id), nil
}

func probeEchoInvocation(session *registeredProbe, offer probeecho.Offer) (probeecho.Invocation, error) {
	if !probeecho.IsEcho(offer.Measurement) || offer.ServiceContext == nil || offer.Challenge == nil {
		return probeecho.Invocation{}, probe.ErrDenied
	}
	invocation := nativeexecution.ProbeEchoInvocation(session.gate.InstanceID(), session.generation, offer)
	digest, err := probeecho.InvocationDigest(invocation)
	if err != nil || digest != offer.Challenge.InvocationDigest {
		return probeecho.Invocation{}, probe.ErrDenied
	}
	if _, err := probeecho.RequestFrame(invocation, *offer.Challenge); err != nil {
		return probeecho.Invocation{}, err
	}
	return invocation, nil
}

func probeEchoOfferInputs(session *registeredProbe, offer probeecho.Offer) (*observationtrust.Context, *probeecho.Execution, error) {
	if probeecho.IsEcho(offer.Measurement) {
		invocation, err := probeEchoInvocation(session, offer)
		if err != nil {
			return nil, nil, err
		}
		raw, err := nativeexecution.EncodeProbeRequest(offer.ServiceContext)
		if err != nil {
			return nil, nil, err
		}
		parsed, err := probeecho.ParseServiceContext(raw)
		if err != nil || parsed.Config.Version != 2 {
			return nil, nil, probe.ErrDenied
		}
		copy := probeecho.CloneExecution(probeecho.Execution{Context: *parsed, Challenge: *offer.Challenge, Invocation: invocation})
		return nil, &copy, nil
	}
	if offer.Challenge != nil {
		return nil, nil, probe.ErrDenied
	}
	if offer.Measurement != probe.MeasurementIngressTLS {
		if offer.ServiceContext != nil {
			return nil, nil, probe.ErrDenied
		}
		return nil, nil, nil
	}
	if offer.ServiceContext == nil || offer.ServiceContext.Config.Version != 1 {
		return nil, nil, probe.ErrDenied
	}
	parsed, err := nativeexecution.DecodeProbeEchoTLSContext(offer.ServiceContext)
	if err != nil {
		return nil, nil, err
	}
	service, err := probeServiceContext(parsed)
	return service, nil, err
}

func probeEchoSelection(service *observationtrust.Context, echo *probeecho.Execution) *probeecho.Selection {
	if echo != nil {
		copy := echo.Context.Selection
		return &copy
	}
	return probeServiceSelection(service)
}

func probeEchoChallenge(echo *probeecho.Execution) *probeecho.Challenge {
	if echo == nil {
		return nil
	}
	copy := echo.Challenge
	return &copy
}

func sameProbeEchoChallenge(a, b *probeecho.Challenge) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}

func (runner *Runner) probeEchoCurrentLocked(session *registeredProbe) bool {
	return runner.options.ProbeEcho && runner.options.ProbeServices && runner.options.ProbeIngress && runner.options.ProbeExecution && runner.options.ProbeRegistration &&
		runner.probeRegistration == session && runner.probeCurrentLocked(session) && !session.typesPending && session.types == nil && session.services == nil &&
		session.echo != nil && runner.scheduler().Now().Before(session.echo.until) && !session.echo.until.After(session.until)
}

// Qualify all five measurements once on the original Gate; no lower-version qualification or fallback follows.
func (runner *Runner) qualifyProbeEcho(ctx context.Context, session *registeredProbe) error {
	runner.mutex.Lock()
	current := runner.options.ProbeEcho && runner.options.ProbeServices && runner.options.ProbeIngress && runner.probeRegistration == session && runner.probeCurrentLocked(session) &&
		session.typesPending && session.types == nil && session.services == nil && session.echo == nil && runner.hello.Policy.MaxClockSkewSeconds <= 2
	skew := time.Duration(runner.hello.Policy.MaxClockSkewSeconds) * time.Second
	runner.mutex.Unlock()
	if !current {
		return probe.ErrDenied
	}
	release, err := probeDeliveries.acquire(session.node, false, runner.scheduler().Now())
	if err != nil {
		return err
	}
	defer release()
	for _, action := range []string{"inspect", "register"} {
		machine, err := runner.probeEchoMachine(session)
		if err != nil {
			return err
		}
		request, raw, err := nativeexecution.EncodeProbeEchoQualification(machine, action, probeecho.Measurements())
		if err != nil {
			return err
		}
		raw, started, err := runner.probeDeliveryExchange(ctx, session, "/agent/v3/probe/echo/instance", request)
		if err != nil {
			return err
		}
		ack, err := nativeexecution.DecodeProbeEchoQualification(request, raw)
		if err != nil {
			return err
		}
		server, err := nativeexecution.ParseProbeWireTime(ack.ServerTime)
		if err != nil || session.guard.ValidateServerTime(server) != nil || server.Before(session.originalServerAt) {
			return probe.ErrDenied
		}
		runner.mutex.Lock()
		current = runner.options.ProbeEcho && runner.probeRegistration == session && runner.probeCurrentLocked(session) &&
			session.typesPending && session.types == nil && session.services == nil && session.echo == nil
		runner.mutex.Unlock()
		if ctx.Err() != nil || !current {
			return probe.ErrDenied
		}
		if action == "inspect" {
			if ack.Qualified || ack.QualifiedAt != nil || ack.ExpiresAt != nil {
				return probe.ErrDenied
			}
			continue
		}
		if !ack.Qualified || ack.QualifiedAt == nil || ack.ExpiresAt == nil {
			return probe.ErrDenied
		}
		qualified, expires, parsedQualification := nativeexecution.ParseProbeQualificationTimes(*ack.QualifiedAt, *ack.ExpiresAt)
		if !parsedQualification || qualified.Before(session.originalServerAt) || qualified.After(server) ||
			!expires.After(qualified) || expires.After(session.originalExpiresAt) {
			return probe.ErrDenied
		}
		remaining := expires.Sub(server) - skew
		if remaining <= 0 || remaining > 30*time.Second {
			return probe.ErrDenied
		}
		until := minProbeDeadline(session.until, started.Add(remaining))
		runner.mutex.Lock()
		if ctx.Err() != nil || runner.probeRegistration != session || !runner.probeCurrentLocked(session) ||
			!session.typesPending || session.types != nil || session.services != nil || session.echo != nil || !runner.scheduler().Now().Before(until) {
			runner.mutex.Unlock()
			return probe.ErrDenied
		}
		session.echo = &qualifiedProbeEcho{qualifiedAt: qualified, expiresAt: expires, until: until}
		session.typesPending = false
		runner.mutex.Unlock()
	}
	return nil
}
