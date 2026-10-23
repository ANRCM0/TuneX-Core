package control

import (
    "github.com/tunex/vnext/agent/internal/nativeexecution"
    "github.com/tunex/vnext/agent/internal/probe"
)

func (runner *Runner) probePathTargetLocked(binding probe.Binding, protocol, host string, port int) (probe.Target, error) {
    if !runner.options.ProbePathEcho || !runner.options.Relay { return probe.Target{}, probe.ErrDenied }
    instance, err := runner.probeBoundInstanceLocked(binding)
    if err != nil { return probe.Target{}, err }
    destination, err := nativeexecution.PathProbeDestination(instance.assignment, protocol, binding.ConfigDigest, binding.EgressPolicyRevision, host, port)
    if err != nil { return probe.Target{}, probe.ErrDenied }
    until := instance.ticket.Deadline()
    if runner.ticket.Deadline().Before(until) { until = runner.ticket.Deadline() }
    return probe.Target{Binding: binding, Host: destination.Host, Port: destination.Port,
        AllowedDestinationCIDRs: append([]string(nil), destination.AllowedDestinationCIDRs...), ExecutionUntil: until}, nil
}
