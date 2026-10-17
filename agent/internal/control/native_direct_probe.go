package control

import (
	"context"
	"time"

	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/probe"
)

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
	if !binding.Valid() || binding.NodeID != runner.options.NodeID || binding.BootID != runner.options.BootID ||
		binding.SessionEpoch != runner.hello.SessionEpoch || binding.SnapshotGeneration != runner.journal.Generation ||
		runner.guard == nil || runner.ticket == nil || runner.guard.Check() != nil || runner.ticket.Allow() != nil {
		return probe.Target{}, probe.ErrDenied
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
		a.BindingFence != binding.BindingFence || a.Driver.ConfigDigest != binding.ConfigDigest ||
		a.Phase != "active" || a.Protocol != "tcp" || a.Driver.SchemaVersion != 1 {
		return probe.Target{}, probe.ErrDenied
	}
	digest, err := contracts.ComputeDigest(a.Driver.Config)
	if err != nil || digest != binding.ConfigDigest {
		return probe.Target{}, probe.ErrDenied
	}
	direct, err := directExecution(a)
	if err != nil || direct.Driver.Config.EgressPolicyRevision != binding.EgressPolicyRevision {
		return probe.Target{}, probe.ErrDenied
	}
	config := direct.Driver.Config
	if config.Target.Port < 1 || config.Target.Port > 65535 {
		return probe.Target{}, probe.ErrDenied
	}
	until := instance.ticket.Deadline()
	if runner.ticket.Deadline().Before(until) {
		until = runner.ticket.Deadline()
	}
	return probe.Target{Binding: binding, Host: config.Target.Host, Port: int(config.Target.Port),
		AllowedDestinationCIDRs: append([]string(nil), config.AllowedDestinationCidrs...),
		ExecutionUntil:          until}, nil
}
