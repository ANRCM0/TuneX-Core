package control

import (
	"encoding/json"
	"fmt"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/forward"
)

func nativeDirectDriver() executionDriver {
	return executionDriver{
		descriptor: executionDescriptor{
			id: "native.direct.v1", schemaVersion: 1,
			roles: []string{"direct"}, phases: []string{"active"}, protocols: []string{"tcp", "udp"},
			capabilities: []string{"native.direct.v1", "tcp", "udp"},
		},
		start: func(host executionHost, assignment adp3.Assignment, check func() error) (execution, error) {
			return startExecution(assignment, host.policy, check)
		},
		replace: replaceExecution,
		phase: func(_ execution, phase string) error {
			if phase != "active" {
				return fmt.Errorf("UNSUPPORTED_CAPABILITY")
			}
			return nil
		},
		classify: func(error) (string, bool) { return "PORT_IN_USE", true },
	}
}

// The direct engine uses private config structs; wire messages are parsed as ADP/3 first.
func directExecution(a adp3.Assignment) (contracts.Assignment, error) {
	if a.Role != "direct" || a.Driver.Id != "native.direct.v1" || a.Resource.Protocol != a.Protocol {
		return contracts.Assignment{}, fmt.Errorf("UNSUPPORTED_CAPABILITY")
	}
	raw, err := json.Marshal(a.Driver.Config)
	if err != nil {
		return contracts.Assignment{}, err
	}
	var config contracts.DirectConfig
	if err := json.Unmarshal(raw, &config); err != nil {
		return contracts.Assignment{}, err
	}
	return contracts.Assignment{AssignmentId: a.AssignmentId, ForwardId: a.ForwardId, ForwardRevision: a.ForwardRevision, DeploymentGeneration: a.DeploymentGeneration, BindingFence: a.BindingFence, Role: "direct", Protocol: a.Protocol, Phase: a.Phase, Listener: contracts.Listen{Address: a.Resource.Address, Port: a.Resource.Port}, Driver: contracts.Driver{Id: "native.direct.v1", SchemaVersion: 1, ConfigDigest: a.Driver.ConfigDigest, Config: config}, DrainTimeoutSeconds: a.DrainTimeoutSeconds}, nil
}

func startExecution(a adp3.Assignment, p adp3.Policy, check func() error) (execution, error) {
	direct, err := directExecution(a)
	if err != nil {
		return nil, err
	}
	raw, err := json.Marshal(p)
	if err != nil {
		return nil, err
	}
	var policy contracts.Policy
	if err := json.Unmarshal(raw, &policy); err != nil {
		return nil, err
	}
	switch a.Protocol {
	case "tcp":
		return forward.StartAuthorized(direct, policy, check)
	case "udp":
		return forward.StartUDPAuthorized(direct, policy, check)
	default:
		return nil, fmt.Errorf("UNSUPPORTED_CAPABILITY")
	}
}

func replaceExecution(old execution, a adp3.Assignment, check func() error) (execution, error) {
	direct, err := directExecution(a)
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
