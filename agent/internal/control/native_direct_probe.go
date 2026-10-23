package control

import (
	"context"
	"time"

	"github.com/tunex/vnext/agent/internal/nativeexecution"
	"github.com/tunex/vnext/agent/internal/observationtrust"
	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/probeecho"
)

func (runner *Runner) probeTargetForMeasurementLocked(binding probe.Binding, measurement string) (probe.Target, error) {
	switch measurement {
	case "", probe.MeasurementEgress:
		return runner.probeTargetLocked(binding)
	case probe.MeasurementIngress:
		return runner.probeIngressTargetLocked(binding)
	default:
		return probe.Target{}, probe.ErrDenied
	}
}

func (runner *Runner) probeInstanceLocked(binding probe.Binding) execution {
	for _, current := range runner.instances {
		if current.assignment.AssignmentId == binding.AssignmentID {
			return current.stream
		}
	}
	return nil
}

func (runner *Runner) probeTargetForReceiptLocked(receipt probeClaimReceipt) (probe.Target, error) {
	var target probe.Target
	var err error
	if receipt.echo {
		target, err = runner.probeEchoTargetLocked(receipt.binding, receipt.measurement, receipt.service, receipt.echoInput)
	} else if receipt.services {
		target, err = runner.probeServicesTargetLocked(receipt.binding, receipt.measurement, receipt.service)
	} else {
		target, err = runner.probeTargetForMeasurementLocked(receipt.binding, receipt.measurement)
	}
	if err != nil {
		return probe.Target{}, err
	}
	if (receipt.measurement == probe.MeasurementIngress || receipt.measurement == probe.MeasurementIngressTLS || probeecho.IsEcho(receipt.measurement)) &&
		(receipt.instance == nil || runner.probeInstanceLocked(receipt.binding) != receipt.instance) {
		return probe.Target{}, probe.ErrDenied
	}
	return target, nil
}

func (runner *Runner) probeServicesTargetLocked(binding probe.Binding, measurement string, service *observationtrust.Context) (probe.Target, error) {
	if !runner.options.ProbeServices {
		return probe.Target{}, probe.ErrDenied
	}
	if measurement != probe.MeasurementIngressTLS {
		if service != nil {
			return probe.Target{}, probe.ErrDenied
		}
		return runner.probeTargetForMeasurementLocked(binding, measurement)
	}
	if service == nil {
		return probe.Target{}, probe.ErrDenied
	}
	trust, err := observationtrust.New(*service, runner.scheduler().Now())
	if err != nil {
		return probe.Target{}, probe.ErrDenied
	}
	// The registered service may identify only the original numeric business target, never override it.
	business, err := runner.probeTargetLocked(binding)
	if err != nil || !nativeexecution.ProbeServiceDestinationAllowed(business.Host, business.Port, business.AllowedDestinationCIDRs,
		service.Config.Endpoint.Address, service.Config.Endpoint.Port) {
		return probe.Target{}, probe.ErrDenied
	}
	target, err := runner.probeIngressTargetLocked(binding)
	if err != nil {
		return probe.Target{}, err
	}
	copy := trust.Context()
	target.Service, target.Measurement = &copy, probe.MeasurementIngressTLS
	target.ExecutionUntil = minProbeDeadline(target.ExecutionUntil, trust.ValidUntil())
	return target, nil
}

func (runner *Runner) resolveProbeServiceTarget(ctx context.Context, binding probe.Binding, service observationtrust.Context) (probe.Target, error) {
	if ctx.Err() != nil {
		return probe.Target{}, ctx.Err()
	}
	runner.mutex.Lock()
	target, err := runner.probeServicesTargetLocked(binding, probe.MeasurementIngressTLS, &service)
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
		current, err := runner.probeServicesTargetLocked(binding, probe.MeasurementIngressTLS, &service)
		if err != nil {
			return err
		}
		if current.Host != target.Host || current.Port != target.Port || current.Service == nil || *current.Service != service {
			return probe.ErrDenied
		}
		return nil
	}
	return target, nil
}

func (runner *Runner) resolveProbeIngressTarget(ctx context.Context, binding probe.Binding) (probe.Target, error) {
	if ctx.Err() != nil {
		return probe.Target{}, ctx.Err()
	}
	runner.mutex.Lock()
	target, err := runner.probeIngressTargetLocked(binding)
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
		current, err := runner.probeIngressTargetLocked(binding)
		if err != nil {
			return err
		}
		if current.Host != target.Host || current.Port != target.Port {
			return probe.ErrDenied
		}
		return nil
	}
	return target, nil
}

func (runner *Runner) probeIngressTargetLocked(binding probe.Binding) (probe.Target, error) {
	if !runner.options.ProbeIngress || !runner.options.ProbeExecution || !runner.options.ProbeRegistration {
		return probe.Target{}, probe.ErrDenied
	}
	// Preserve every original current binding/ticket/policy check without resolving the business target.
	target, err := runner.probeTargetLocked(binding)
	if err != nil {
		return probe.Target{}, err
	}
	for _, current := range runner.instances {
		if current.assignment.AssignmentId != binding.AssignmentID {
			continue
		}
		driver, err := builtinExecutionDrivers.resolve(current.assignment, runner.executionFeatures())
		if err != nil || driver.probeIngress == nil {
			return probe.Target{}, probe.ErrDenied
		}
		observed, err := driver.probeIngress(current.stream)
		if err != nil || observed.check == nil || observed.check() != nil {
			return probe.Target{}, probe.ErrDenied
		}
		host, port, valid := nativeexecution.ProbeIngressEndpoint(current.assignment.Resource.Address, current.assignment.Resource.Port,
			observed.address, observed.port, target.AllowedDestinationCIDRs)
		if !valid {
			return probe.Target{}, probe.ErrDenied
		}
		target.Host, target.Port, target.Measurement = host, port, probe.MeasurementIngress
		return target, nil
	}
	return probe.Target{}, probe.ErrDenied
}

// Deliberately not wired to a machine endpoint: remote permits need their own
// authenticated protocol and issuer. The host remains the sole execution reader.
func (runner *Runner) probeDirect(ctx context.Context, permit probe.Permit, timeout time.Duration) (probe.Result, error) {
	executor, err := probe.New(runner.resolveProbeTarget)
	if err != nil {
		return probe.Result{}, err
	}
	return executor.Run(ctx, permit, timeout)
}

func (runner *Runner) resolveProbeTarget(ctx context.Context, binding probe.Binding) (probe.Target, error) {
	if ctx.Err() != nil {
		return probe.Target{}, ctx.Err()
	}
	runner.mutex.Lock()
	target, err := runner.probeTargetLocked(binding)
	runner.mutex.Unlock()
	if err != nil {
		return probe.Target{}, err
	}
	target.Check = func() error {
		runner.mutex.Lock()
		defer runner.mutex.Unlock()
		_, err := runner.probeTargetLocked(binding)
		return err
	}
	return target, nil
}

func (runner *Runner) probeTargetLocked(binding probe.Binding) (probe.Target, error) {
	return runner.probeBusinessTargetLocked(binding, "tcp")
}

func (runner *Runner) probeBoundInstanceLocked(binding probe.Binding) (running, error) {
	if !binding.Valid() || binding.NodeID != runner.options.NodeID || binding.BootID != runner.options.BootID ||
		binding.SessionEpoch != runner.hello.SessionEpoch || binding.SnapshotGeneration != runner.journal.Generation ||
		runner.guard == nil || runner.ticket == nil || runner.guard.Check() != nil || runner.ticket.Allow() != nil {
		return running{}, probe.ErrDenied
	}
	// Runner indexes live instances by physical protocol/port, not assignment ID.
	var instance running
	matches := 0
	for _, current := range runner.instances {
		if current.assignment.AssignmentId == binding.AssignmentID {
			instance = current
			matches++
		}
	}
	a := instance.assignment
	if matches != 1 || instance.ticket == nil || instance.ticket.Allow() != nil || instance.stream == nil ||
		a.AssignmentId != binding.AssignmentID || a.ForwardId != binding.ForwardID ||
		a.ForwardRevision != binding.ForwardRevision || a.DeploymentGeneration != binding.DeploymentGeneration ||
		a.BindingFence != binding.BindingFence || a.Driver.ConfigDigest != binding.ConfigDigest {
		return running{}, probe.ErrDenied
	}
	return instance, nil
}

func (runner *Runner) probeBusinessTargetLocked(binding probe.Binding, protocol string) (probe.Target, error) {
	if protocol != "tcp" && protocol != "udp" { return probe.Target{}, probe.ErrDenied }
	instance, err := runner.probeBoundInstanceLocked(binding)
	if err != nil { return probe.Target{}, err }
	a := instance.assignment
	destination, err := nativeexecution.DirectProbeDestination(a, protocol, binding.ConfigDigest, binding.EgressPolicyRevision)
	if err != nil {
		return probe.Target{}, probe.ErrDenied
	}
	until := instance.ticket.Deadline()
	if runner.ticket.Deadline().Before(until) {
		until = runner.ticket.Deadline()
	}
	return probe.Target{Binding: binding, Host: destination.Host, Port: destination.Port,
		AllowedDestinationCIDRs: append([]string(nil), destination.AllowedDestinationCIDRs...),
		ExecutionUntil:          until}, nil
}
