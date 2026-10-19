package nativeexecution

import (
	"encoding/json"
	"fmt"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/adp3relay"
	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/executiondriver"
)

// The native direct engine retains its private config and original ADP/3 conversion.
func DirectAssignment(a adp3.Assignment) (contracts.Assignment, error) {
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

func directPolicy(p adp3.Policy) (contracts.Policy, error) {
	raw, err := json.Marshal(p)
	if err != nil {
		return contracts.Policy{}, err
	}
	var policy contracts.Policy
	if err := json.Unmarshal(raw, &policy); err != nil {
		return contracts.Policy{}, err
	}
	return policy, nil
}

// Call only after the original peer-identity lookup; decoding is not authority.
func relayAssignment(host executiondriver.Host, a adp3.Assignment) (adp3relay.Assignment, error) {
	raw, err := json.Marshal(a)
	if err != nil {
		return adp3relay.Assignment{}, err
	}
	var body map[string]json.RawMessage
	if err := json.Unmarshal(raw, &body); err != nil {
		return adp3relay.Assignment{}, err
	}
	body["protocolVersion"] = json.RawMessage("3")
	body["nodeId"], _ = json.Marshal(host.NodeID)
	body["sessionEpoch"], _ = json.Marshal(host.SessionEpoch)
	raw, err = json.Marshal(body)
	if err != nil {
		return adp3relay.Assignment{}, err
	}
	var assignment adp3relay.Assignment
	if err := adp3relay.Parse("Assignment", raw, &assignment); err != nil {
		return adp3relay.Assignment{}, err
	}
	assignment.Phase = "prepared"
	return assignment, nil
}
