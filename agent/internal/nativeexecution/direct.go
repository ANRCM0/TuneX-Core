// Package nativeexecution owns native engine/config adapters, not execution authority.
package nativeexecution

import (
	"fmt"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/executiondriver"
	"github.com/tunex/vnext/agent/internal/executionhost"
	"github.com/tunex/vnext/agent/internal/forward"
)

const InterfaceVersion uint64 = 3

func Direct() executiondriver.Driver {
	return executiondriver.Driver{
		Descriptor: executiondriver.Descriptor{
			ID: "native.direct.v1", HostVersion: 1, SchemaVersion: 1,
			Platforms: []string{"linux", "windows"},
			Roles:     []string{"direct"}, Phases: []string{"active"}, Protocols: []string{"tcp", "udp"},
			Capabilities:      []string{"native.direct.v1", "tcp", "udp", "shared-resource-limits.v1"},
			ProbeCapabilities: []string{"probe.tcp-connect.v1", "probe.tcp-ingress-connect.v1"},
		},
		Start: func(host executiondriver.Host, assignment adp3.Assignment, check func() error) (executiondriver.Instance, error) {
			return StartDirectMetered(assignment, host.Policy, check, host.Payload)
		},
		Replace: ReplaceDirect,
		Phase: func(_ executiondriver.Instance, phase string) error {
			if phase != "active" {
				return fmt.Errorf("UNSUPPORTED_CAPABILITY")
			}
			return nil
		},
		Classify: func(error) (string, bool) { return "PORT_IN_USE", true },
		ProbeIngress: func(instance executiondriver.Instance) (executiondriver.ProbeTarget, error) {
			stream, ok := instance.(*forward.TCP)
			if !ok {
				return executiondriver.ProbeTarget{}, fmt.Errorf("UNSUPPORTED_CAPABILITY: Direct TCP listener required")
			}
			value, err := stream.ObserveIngress()
			if err != nil {
				return executiondriver.ProbeTarget{}, err
			}
			return executiondriver.ProbeTarget{Address: value.Address, Port: value.Port, Check: value.Check}, nil
		},
		ProbeUDPIngress: func(instance executiondriver.Instance) (executiondriver.ProbeTarget, error) {
			stream, ok := instance.(*forward.UDP)
			if !ok {
				return executiondriver.ProbeTarget{}, fmt.Errorf("UNSUPPORTED_CAPABILITY: Direct UDP listener required")
			}
			value, err := stream.ObserveIngress()
			if err != nil {
				return executiondriver.ProbeTarget{}, err
			}
			return executiondriver.ProbeTarget{Address: value.Address, Port: value.Port, Check: value.Check}, nil
		},
	}
}

func StartDirect(a adp3.Assignment, p adp3.Policy, check func() error) (executiondriver.Instance, error) {
	return StartDirectMetered(a, p, check, nil)
}

// StartDirectMetered projects native inputs while retaining the original host's
// immutable payload gate. The legacy StartDirect path explicitly supplies nil.
func StartDirectMetered(a adp3.Assignment, p adp3.Policy, check func() error, gate executionhost.PayloadGate) (executiondriver.Instance, error) {
	direct, err := DirectAssignment(a)
	if err != nil {
		return nil, err
	}
	policy, err := directPolicy(p)
	if err != nil {
		return nil, err
	}
	switch a.Protocol {
	case "tcp":
		return forward.StartAuthorizedMetered(direct, policy, check, gate)
	case "udp":
		return forward.StartUDPAuthorizedMetered(direct, policy, check, gate)
	default:
		return nil, fmt.Errorf("UNSUPPORTED_CAPABILITY")
	}
}

func ReplaceDirect(old executiondriver.Instance, a adp3.Assignment, check func() error) (executiondriver.Instance, error) {
	direct, err := DirectAssignment(a)
	if err != nil {
		return nil, err
	}
	switch stream := old.(type) {
	case *forward.TCP:
		return stream.ReplaceAuthorized(direct, check)
	case *forward.UDP:
		return stream.ReplaceAuthorized(direct, check)
	default:
		return nil, fmt.Errorf("UNSUPPORTED_CAPABILITY")
	}
}
