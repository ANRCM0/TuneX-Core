package control

import (
	"context"
	"time"

	"github.com/tunex/vnext/agent/internal/nativeexecution"
	"github.com/tunex/vnext/agent/internal/observationtrust"
	"github.com/tunex/vnext/agent/internal/probe"
	probenative "github.com/tunex/vnext/agent/internal/probe/native"
	"github.com/tunex/vnext/agent/internal/probeecho"
)

func sameProbeEchoInput(a, b *probeecho.Execution) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return probenative.SameEchoExecution(*a, *b)
}

func (runner *Runner) probeEchoTargetLocked(binding probe.Binding, measurement string, service *observationtrust.Context, echo *probeecho.Execution) (probe.Target, error) {
	if !runner.options.ProbeEcho || !runner.options.ProbeServices || !runner.options.ProbeIngress ||
		!runner.options.ProbeExecution || !runner.options.ProbeRegistration {
		return probe.Target{}, probe.ErrDenied
	}
	if !probeecho.IsEcho(measurement) {
		if echo != nil {
			return probe.Target{}, probe.ErrDenied
		}
		return runner.probeServicesTargetLocked(binding, measurement, service)
	}
	if echo == nil || service != nil || echo.Invocation.Measurement != measurement || probeTypesBinding(echo.Invocation.Binding) != binding {
		return probe.Target{}, probe.ErrDenied
	}
	raw, err := probenative.EncodeEchoContext(echo.Context)
	if err != nil {
		return probe.Target{}, probe.ErrDenied
	}
	declared, err := probenative.DecodeEchoContext(raw)
	now := runner.scheduler().Now()
	if err != nil || declared.Config.Version != 2 || declared.Config.Purpose != "controlled-nonce-echo" ||
		now.UnixMilli() < 0 || uint64(now.UnixMilli()) < declared.Config.ValidFrom || uint64(now.UnixMilli()) >= declared.Config.ValidUntil ||
		echo.Invocation.Service != declared.Selection || echo.Invocation.Nonce != echo.Challenge.Nonce {
		return probe.Target{}, probe.ErrDenied
	}
	digest, err := probeecho.InvocationDigest(echo.Invocation)
	if err != nil || digest != echo.Challenge.InvocationDigest {
		return probe.Target{}, probe.ErrDenied
	}
	protocol := "tcp"
	if measurement == probe.MeasurementIngressUDPEcho {
		protocol = "udp"
	}
	allowed := false
	for _, value := range declared.Config.Endpoint.Protocols {
		if value == protocol {
			allowed = true
		}
	}
	if !allowed {
		return probe.Target{}, probe.ErrDenied
	}
	// The original business target remains immutable. The client will dial only its actual ingress below.
	target, err := runner.probeBusinessTargetLocked(binding, protocol)
	if err != nil || target.Host != declared.Config.Endpoint.Address || uint64(target.Port) != declared.Config.Endpoint.Port ||
		!observationtrust.AddressAllowed(target.Host) {
		return probe.Target{}, probe.ErrDenied
	}
	if !nativeexecution.ProbeEchoBusinessDestinationAllowed(target.Host, target.AllowedDestinationCIDRs) {
		return probe.Target{}, probe.ErrDenied
	}
	for _, current := range runner.instances {
		if current.assignment.AssignmentId != binding.AssignmentID {
			continue
		}
		driver, err := builtinExecutionDrivers.resolve(current.assignment, runner.executionFeatures())
		if err != nil {
			return probe.Target{}, probe.ErrDenied
		}
		observe := driver.probeIngress
		if protocol == "udp" {
			observe = driver.probeUDPIngress
		}
		if observe == nil {
			return probe.Target{}, probe.ErrDenied
		}
		observed, err := observe(current.stream)
		if err != nil || observed.check == nil || observed.check() != nil {
			return probe.Target{}, probe.ErrDenied
		}
		host, port, valid := nativeexecution.ProbeEchoIngressEndpoint(current.assignment.Resource.Address, current.assignment.Resource.Port,
			current.assignment.Resource.Protocol, observed.address, observed.port, protocol, target.AllowedDestinationCIDRs)
		if !valid {
			return probe.Target{}, probe.ErrDenied
		}
		copy := probeecho.CloneExecution(*echo)
		target.Host, target.Port, target.Measurement, target.Echo = host, port, measurement, &copy
		target.ExecutionUntil = minProbeDeadline(target.ExecutionUntil, time.UnixMilli(int64(declared.Config.ValidUntil)))
		return target, nil
	}
	return probe.Target{}, probe.ErrDenied
}

func (runner *Runner) resolveProbeEchoTarget(ctx context.Context, binding probe.Binding, echo probeecho.Execution) (probe.Target, error) {
	if ctx.Err() != nil {
		return probe.Target{}, ctx.Err()
	}
	copy := probeecho.CloneExecution(echo)
	runner.mutex.Lock()
	target, err := runner.probeEchoTargetLocked(binding, copy.Invocation.Measurement, nil, &copy)
	instance := runner.probeInstanceLocked(binding)
	runner.mutex.Unlock()
	if err != nil {
		return probe.Target{}, err
	}
	target.Check = func() error {
		runner.mutex.Lock()
		defer runner.mutex.Unlock()
		if instance == nil || runner.probeInstanceLocked(binding) != instance {
			return probe.ErrDenied
		}
		current, err := runner.probeEchoTargetLocked(binding, copy.Invocation.Measurement, nil, &copy)
		if err != nil {
			return err
		}
		if current.Host != target.Host || current.Port != target.Port || !sameProbeEchoInput(current.Echo, &copy) {
			return probe.ErrDenied
		}
		return nil
	}
	return target, nil
}
