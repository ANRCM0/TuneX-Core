package control

import (
	"context"
	"time"

	"github.com/tunex/vnext/agent/internal/nativeexecution"
	"github.com/tunex/vnext/agent/internal/observationtrust"
	"github.com/tunex/vnext/agent/internal/platformruntime"
	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/probeservices"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

type qualifiedProbeServices struct{ qualifiedAt, expiresAt, until time.Time }

func probeServicesMeasurements() []string {
	return []string{probe.MeasurementEgress, probe.MeasurementIngress, probe.MeasurementIngressTLS}
}

func probeServicesMachine(session *registeredProbe) (probeservices.Machine, error) {
	return probeServicesMachineWith(platformruntime.Local{}, session)
}
func (runner *Runner) probeServicesMachine(session *registeredProbe) (probeservices.Machine, error) {
	return probeServicesMachineWith(runner.entropy(), session)
}
func probeServicesMachineWith(source runtimeplatform.Entropy, session *registeredProbe) (probeservices.Machine, error) {
	id, err := probeRequestIDWith(source)
	if err != nil {
		return probeservices.Machine{}, err
	}
	return nativeexecution.ProbeServicesMachine(session.node, session.boot, session.epoch, session.gate.InstanceID(), session.generation, id), nil
}

func probeServicesDescriptor(measurement string) (probeservices.Descriptor, error) {
	if measurement == probe.MeasurementIngressTLS {
		return probeservices.Descriptor{Measurement: measurement, TaskKind: "tcp-ingress-tls", Point: "agent-local-direct-ingress", Capability: "probe.tcp-ingress-tls.v1"}, nil
	}
	d, err := probeTypesDescriptor(measurement)
	return probeservices.Descriptor{Measurement: d.Measurement, TaskKind: d.TaskKind, Point: d.Point, Capability: d.Capability}, err
}

func probeServiceContext(value *probeservices.ServiceContext) (*observationtrust.Context, error) {
	return nativeexecution.ProbeServiceContext(value)
}

func probeServiceSelection(value *observationtrust.Context) *probeservices.Selection {
	return nativeexecution.ProbeServiceSelection(value)
}

func sameProbeServiceSelection(a, b *probeservices.Selection) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}

func (runner *Runner) probeServicesCurrentLocked(session *registeredProbe) bool {
	return !runner.options.ProbeEcho && session.echo == nil && runner.options.ProbeServices && runner.options.ProbeIngress && runner.options.ProbeExecution && runner.options.ProbeRegistration &&
		runner.probeRegistration == session && runner.probeCurrentLocked(session) && !session.typesPending && session.types == nil &&
		session.services != nil && runner.scheduler().Now().Before(session.services.until) && !session.services.until.After(session.until)
}

// This qualifies the original Gate once, instead of qualifying or polling the v2 family as well.
func (runner *Runner) qualifyProbeServices(ctx context.Context, session *registeredProbe) error {
	runner.mutex.Lock()
	current := !runner.options.ProbeEcho && session.echo == nil && runner.options.ProbeServices && runner.options.ProbeIngress && runner.probeRegistration == session && runner.probeCurrentLocked(session) &&
		session.typesPending && session.types == nil && session.services == nil && runner.hello.Policy.MaxClockSkewSeconds <= 2
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
		machine, err := runner.probeServicesMachine(session)
		if err != nil {
			return err
		}
		request, raw, err := nativeexecution.EncodeProbeServicesQualification(machine, action, probeServicesMeasurements())
		if err != nil {
			return err
		}
		raw, started, err := runner.probeDeliveryExchange(ctx, session, "/agent/v3/probe/services/instance", request)
		if err != nil {
			return err
		}
		ack, err := nativeexecution.DecodeProbeServicesQualification(request, raw)
		if err != nil {
			return err
		}
		server, err := nativeexecution.ParseProbeWireTime(ack.ServerTime)
		if err != nil || session.guard.ValidateServerTime(server) != nil || server.Before(session.originalServerAt) {
			return probe.ErrDenied
		}
		runner.mutex.Lock()
		current = runner.options.ProbeServices && runner.probeRegistration == session && runner.probeCurrentLocked(session) &&
			session.typesPending && session.types == nil && session.services == nil
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
			!session.typesPending || session.types != nil || session.services != nil || !runner.scheduler().Now().Before(until) {
			runner.mutex.Unlock()
			return probe.ErrDenied
		}
		session.services = &qualifiedProbeServices{qualifiedAt: qualified, expiresAt: expires, until: until}
		session.typesPending = false
		runner.mutex.Unlock()
	}
	return nil
}
