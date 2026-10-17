package control

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/adp3relay"
	"github.com/tunex/vnext/agent/internal/relay"
)

func nativeRelayDriver() executionDriver {
	return executionDriver{
		descriptor: executionDescriptor{
			id: "native.relay.v1", schemaVersion: 1,
			roles: []string{"relay-ingress", "relay-egress"}, phases: []string{"prepared", "active", "draining"}, protocols: []string{"tcp", "udp"},
			capabilities: []string{"native.relay.v1", "relay.wire.1"}, requiresRelay: true,
		},
		start: startRelayExecution, phase: relayExecutionPhase, classify: relayExecutionError,
	}
}

func nativeMultihopDriver() executionDriver {
	return executionDriver{
		descriptor: executionDescriptor{
			id: "native.multihop.v1", schemaVersion: 1,
			roles: []string{"multihop-ingress", "multihop-transit", "multihop-egress"}, phases: []string{"prepared", "active", "draining"}, protocols: []string{"tcp", "udp"},
			capabilities: []string{"adp.execution.1", "native.multihop.v1", "multihop.wire.1"}, requiresRelay: true, requiresMultihop: true,
		},
		start: startMultihopExecution, phase: relayExecutionPhase, classify: relayExecutionError,
	}
}

func relayMaximum(host executionHost, assignment adp3.Assignment) int {
	maximum := host.policy.MaxTcpConnectionsPerAssignment
	if assignment.Protocol == "udp" {
		maximum = host.policy.MaxUdpSessionsPerAssignment
	}
	return int(min(maximum, 4096))
}

func startRelayExecution(host executionHost, a adp3.Assignment, check func() error) (execution, error) {
	identity, _, err := host.peerIdentity()
	if err != nil {
		return nil, err
	}
	raw, err := json.Marshal(a)
	if err != nil {
		return nil, err
	}
	var body map[string]json.RawMessage
	if err := json.Unmarshal(raw, &body); err != nil {
		return nil, err
	}
	body["protocolVersion"] = json.RawMessage("3")
	body["nodeId"], _ = json.Marshal(host.nodeID)
	body["sessionEpoch"], _ = json.Marshal(host.sessionEpoch)
	raw, err = json.Marshal(body)
	if err != nil {
		return nil, err
	}
	var assignment adp3relay.Assignment
	if err := adp3relay.Parse("Assignment", raw, &assignment); err != nil {
		return nil, err
	}
	assignment.Phase = "prepared"
	engine, err := relay.Prepare(assignment, identity, relayMaximum(host, a), check)
	if err != nil {
		return nil, err
	}
	return finishRelayStart(engine, a.Phase)
}

func startMultihopExecution(host executionHost, a adp3.Assignment, check func() error) (execution, error) {
	identity, _, err := host.peerIdentity()
	if err != nil {
		return nil, err
	}
	engine, err := relay.PrepareMultihop(a, identity, relayMaximum(host, a), check)
	if err != nil {
		return nil, err
	}
	return finishRelayStart(engine, a.Phase)
}

func finishRelayStart(engine *relay.Engine, phase string) (execution, error) {
	if err := relayExecutionPhase(engine, phase); err != nil {
		engine.Close()
		return nil, err
	}
	return engine, nil
}

func relayExecutionPhase(instance execution, phase string) error {
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

func relayExecutionError(err error) (string, bool) {
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
