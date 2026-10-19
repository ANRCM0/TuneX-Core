package relay

import (
	"encoding/json"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/adp3relay"
	"github.com/tunex/vnext/agent/internal/contracts"
)

// projectMultihop owns only the original immutable native configuration conversion.
// The caller validates assignment and local identity before invoking it.
func projectMultihop(a adp3.Assignment, h *adp3.HopConfig) (adp3relay.Assignment, *adp3.HopConfig, error) {
	// Retain a private immutable configuration across lease-only renewals.
	rawHop, err := json.Marshal(h)
	if err != nil {
		return adp3relay.Assignment{}, nil, err
	}
	var owned adp3.HopConfig
	if err = json.Unmarshal(rawHop, &owned); err != nil {
		return adp3relay.Assignment{}, nil, err
	}
	h = &owned
	local := h.Path[h.HopIndex]
	edge := int(h.HopIndex) - 1
	role := "relay-egress"
	if h.HopIndex == 0 {
		edge = 0
		role = "relay-ingress"
	}
	var profile adp3relay.ProfileConfig
	raw, err := json.Marshal(h.Profile)
	if err != nil {
		return adp3relay.Assignment{}, nil, err
	}
	if err = json.Unmarshal(raw, &profile); err != nil {
		return adp3relay.Assignment{}, nil, err
	}
	binding := hopBinding(*h, edge)
	peer := h.Path[edge]
	config := adp3relay.RelayConfig{Role: role, Binding: binding, Profile: profile, PeerFingerprints: []string{peer.PeerFingerprint},
		EgressPolicyRevision: h.EgressPolicyRevision, AllowMetadataTargets: h.AllowMetadataTargets, AllowedDestinationCidrs: append([]string(nil), h.AllowedDestinationCidrs...)}
	if h.HopIndex == 0 {
		peer = h.Path[1]
		config.PeerFingerprints = []string{peer.PeerFingerprint}
		config.PeerEndpoint = &adp3relay.Target{Host: peer.Host, Port: peer.Port}
	} else {
		config.Target = &adp3relay.Target{Host: h.Target.Host, Port: h.Target.Port}
	}
	hash, err := contracts.ComputeDigest(config)
	if err != nil {
		return adp3relay.Assignment{}, nil, err
	}
	synthetic := adp3relay.Assignment{ProtocolVersion: 3, NodeId: local.NodeId, SessionEpoch: local.SessionEpoch,
		AssignmentId: a.AssignmentId, ForwardId: a.ForwardId, ForwardRevision: a.ForwardRevision, DeploymentGeneration: a.DeploymentGeneration,
		BindingFence: a.BindingFence, Role: role, Protocol: a.Protocol, Phase: "prepared", Resource: adp3relay.Resource{Address: a.Resource.Address, Port: a.Resource.Port, Protocol: a.Resource.Protocol},
		Driver: adp3relay.RelayDriver{Id: "native.relay.v1", SchemaVersion: 1, ConfigDigest: hash, Config: config}, DrainTimeoutSeconds: a.DrainTimeoutSeconds}
	return synthetic, h, nil
}
