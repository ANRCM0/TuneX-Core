package control

import (
	"context"
	"time"

	"github.com/tunex/vnext/agent/internal/nativeexecution"
	"github.com/tunex/vnext/agent/internal/platformruntime"
	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/probetypes"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

type qualifiedProbeTypes struct {
	qualifiedAt time.Time
	expiresAt   time.Time
	until       time.Time
}

func probeTypesMeasurements() []string {
	return []string{probe.MeasurementEgress, probe.MeasurementIngress}
}

func probeTypesMachine(session *registeredProbe) (probetypes.Machine, error) {
	return probeTypesMachineWith(platformruntime.Local{}, session)
}
func (runner *Runner) probeTypesMachine(session *registeredProbe) (probetypes.Machine, error) {
	return probeTypesMachineWith(runner.entropy(), session)
}
func probeTypesMachineWith(source runtimeplatform.Entropy, session *registeredProbe) (probetypes.Machine, error) {
	id, err := probeRequestIDWith(source)
	if err != nil {
		return probetypes.Machine{}, err
	}
	return nativeexecution.ProbeTypesMachine(session.node, session.boot, session.epoch, session.gate.InstanceID(), session.generation, id), nil
}

func probeTypesDescriptor(measurement string) (probetypes.Descriptor, error) {
	switch measurement {
	case probe.MeasurementEgress:
		return probetypes.Descriptor{Measurement: probe.MeasurementEgress, TaskKind: "tcp-connect", Point: "agent-direct-egress", Capability: "probe.tcp-connect.v1"}, nil
	case probe.MeasurementIngress:
		return probetypes.Descriptor{Measurement: probe.MeasurementIngress, TaskKind: "tcp-ingress-connect", Point: "agent-local-direct-ingress", Capability: "probe.tcp-ingress-connect.v1"}, nil
	default:
		return probetypes.Descriptor{}, probe.ErrDenied
	}
}

func probeTypesBinding(value probetypes.Binding) probe.Binding {
	return probe.Binding{NodeID: value.NodeId, BootID: value.BootId, SessionEpoch: value.SessionEpoch,
		SnapshotGeneration: value.SnapshotGeneration, AssignmentID: value.AssignmentId, ForwardID: value.ForwardId,
		ForwardRevision: value.ForwardRevision, DeploymentGeneration: value.DeploymentGeneration,
		BindingFence: value.BindingFence, ConfigDigest: value.ConfigDigest, EgressPolicyRevision: value.EgressPolicyRevision}
}

func typedProbeBinding(value probe.Binding) probetypes.Binding {
	return probetypes.Binding{NodeId: value.NodeID, BootId: value.BootID, SessionEpoch: value.SessionEpoch,
		SnapshotGeneration: value.SnapshotGeneration, AssignmentId: value.AssignmentID, ForwardId: value.ForwardID,
		ForwardRevision: value.ForwardRevision, DeploymentGeneration: value.DeploymentGeneration,
		BindingFence: value.BindingFence, ConfigDigest: value.ConfigDigest, EgressPolicyRevision: value.EgressPolicyRevision}
}

func (runner *Runner) probeTypesCurrentLocked(session *registeredProbe) bool {
	return !runner.options.ProbeEcho && session.echo == nil && !runner.options.ProbeServices && session.services == nil && runner.options.ProbeIngress && runner.options.ProbeExecution && runner.options.ProbeRegistration &&
		runner.probeRegistration == session && runner.probeCurrentLocked(session) && !session.typesPending && session.types != nil &&
		runner.scheduler().Now().Before(session.types.until) && session.types.until.Compare(session.until) <= 0
}

// Qualify exactly once after original registration, retaining that gate, generation and every tombstone.
func (runner *Runner) qualifyProbeTypes(ctx context.Context, session *registeredProbe) error {
	runner.mutex.Lock()
	current := !runner.options.ProbeEcho && session.echo == nil && !runner.options.ProbeServices && session.services == nil && runner.options.ProbeIngress && runner.probeRegistration == session && runner.probeCurrentLocked(session) &&
		session.typesPending && session.types == nil && runner.hello.Policy.MaxClockSkewSeconds <= 2
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
		machine, err := runner.probeTypesMachine(session)
		if err != nil {
			return err
		}
		request, raw, err := nativeexecution.EncodeProbeTypesQualification(machine, action, probeTypesMeasurements())
		if err != nil {
			return err
		}
		raw, started, err := runner.probeDeliveryExchange(ctx, session, "/agent/v3/probe/types/instance", request)
		if err != nil {
			return err
		}
		ack, err := nativeexecution.DecodeProbeTypesQualification(request, raw)
		if err != nil {
			return err
		}
		server, err := nativeexecution.ParseProbeWireTime(ack.ServerTime)
		if err != nil || session.guard.ValidateServerTime(server) != nil || server.Before(session.originalServerAt) {
			return probe.ErrDenied
		}
		runner.mutex.Lock()
		current = runner.probeRegistration == session && runner.probeCurrentLocked(session) && session.typesPending && session.types == nil
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
			!session.typesPending || session.types != nil || !runner.scheduler().Now().Before(until) {
			runner.mutex.Unlock()
			return probe.ErrDenied
		}
		session.types = &qualifiedProbeTypes{qualifiedAt: qualified, expiresAt: expires, until: until}
		session.typesPending = false
		runner.mutex.Unlock()
	}
	return nil
}
