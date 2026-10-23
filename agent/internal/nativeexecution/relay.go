package nativeexecution

import (
	"fmt"
	"strings"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/executiondriver"
	"github.com/tunex/vnext/agent/internal/relay"
)

func Relay() executiondriver.Driver {
	return executiondriver.Driver{
		Descriptor: executiondriver.Descriptor{
			ID: "native.relay.v1", HostVersion: 1, SchemaVersion: 1,
			Platforms: []string{"linux", "windows"},
			Roles:     []string{"relay-ingress", "relay-egress"}, Phases: []string{"prepared", "active", "draining"}, Protocols: []string{"tcp", "udp"},
			Capabilities: []string{"native.relay.v1", "relay.wire.1", "shared-resource-limits.v1"}, RequiresRelay: true,
		},
		Start: StartRelay, Phase: RelayPhase, Classify: ClassifyRelay,
	}
}

func Multihop() executiondriver.Driver {
	return executiondriver.Driver{
		Descriptor: executiondriver.Descriptor{
			ID: "native.multihop.v1", HostVersion: 1, SchemaVersion: 1,
			Platforms: []string{"linux", "windows"},
			Roles:     []string{"multihop-ingress", "multihop-transit", "multihop-egress"}, Phases: []string{"prepared", "active", "draining"}, Protocols: []string{"tcp", "udp"},
			Capabilities: []string{"adp.execution.1", "native.multihop.v1", "multihop.wire.1", "shared-resource-limits.v1"}, RequiresRelay: true, RequiresMultihop: true,
		},
		Start: StartMultihop, Phase: RelayPhase, Classify: ClassifyRelay,
	}
}

// PathProbeIngress reads an existing native Relay listener after host authorization.
// Legacy Direct Probe hooks and capability declarations retain their original meaning.
func PathProbeIngress(instance executiondriver.Instance, protocol string) (executiondriver.ProbeTarget, error) {
    engine, ok := instance.(*relay.Engine)
    if !ok { return executiondriver.ProbeTarget{}, fmt.Errorf("UNSUPPORTED_CAPABILITY: Native ingress required") }
    value, err := engine.ObserveIngress(protocol)
    if err != nil { return executiondriver.ProbeTarget{}, err }
    return executiondriver.ProbeTarget{Address:value.Address,Port:value.Port,Check:value.Check}, nil
}

func Maximum(host executiondriver.Host, assignment adp3.Assignment) int {
	maximum := host.Policy.MaxTcpConnectionsPerAssignment
	if assignment.Protocol == "udp" {
		maximum = host.Policy.MaxUdpSessionsPerAssignment
	}
	return int(min(maximum, 4096))
}

func StartRelay(host executiondriver.Host, a adp3.Assignment, check func() error) (executiondriver.Instance, error) {
	identity, _, err := host.RequirePeerIdentity()
	if err != nil {
		return nil, err
	}
	assignment, err := relayAssignment(host, a)
	if err != nil {
		return nil, err
	}
	engine, err := relay.PrepareMetered(assignment, identity, Maximum(host, a), check, host.Payload)
	if err != nil {
		return nil, err
	}
	return FinishRelayStart(engine, a.Phase)
}

func StartMultihop(host executiondriver.Host, a adp3.Assignment, check func() error) (executiondriver.Instance, error) {
	identity, _, err := host.RequirePeerIdentity()
	if err != nil {
		return nil, err
	}
	engine, err := relay.PrepareMultihopMetered(a, identity, Maximum(host, a), check, host.Payload)
	if err != nil {
		return nil, err
	}
	return FinishRelayStart(engine, a.Phase)
}

func FinishRelayStart(engine *relay.Engine, phase string) (executiondriver.Instance, error) {
	return finishRelayStartInstance(engine, phase)
}

// FinishRelayStartInstance keeps the executiondriver boundary usable by
// compatibility callers without exposing relay.Engine in their package.
func FinishRelayStartInstance(instance executiondriver.Instance, phase string) (executiondriver.Instance, error) {
	return finishRelayStartInstance(instance, phase)
}

func finishRelayStartInstance(instance executiondriver.Instance, phase string) (executiondriver.Instance, error) {
	engine, ok := instance.(*relay.Engine)
	if !ok {
		return nil, fmt.Errorf("UNSUPPORTED_CAPABILITY: Relay execution required")
	}
	if err := RelayPhase(engine, phase); err != nil {
		engine.Close()
		return nil, err
	}
	return engine, nil
}

func RelayPhase(instance executiondriver.Instance, phase string) error {
	engine, ok := instance.(*relay.Engine)
	if !ok {
		return fmt.Errorf("UNSUPPORTED_CAPABILITY: Relay execution required")
	}
	switch phase {
	case "prepared":
		return nil
	case "active":
		return engine.Activate()
	case "draining":
		engine.Drain()
		return nil
	default:
		return fmt.Errorf("UNSUPPORTED_CAPABILITY")
	}
}

func ClassifyRelay(err error) (string, bool) {
	code := strings.SplitN(err.Error(), ":", 2)[0]
	switch code {
	case "AUTHENTICATION_FAILED", "AUTHORIZATION_DENIED", "INVALID_CONFIG", "INTEGRITY_FAILURE", "UNSUPPORTED_CAPABILITY", "TARGET_REJECTED", "LEASE_EXPIRED":
		return code, false
	case "RESOURCE_LIMIT", "DOWNSTREAM_NOT_ACTIVE", "DOWNSTREAM_UNAVAILABLE", "TARGET_UNAVAILABLE":
		return code, true
	default:
		if strings.Contains(err.Error(), "bind:") {
			return "PORT_IN_USE", true
		}
		return "DOWNSTREAM_UNAVAILABLE", true
	}
}
