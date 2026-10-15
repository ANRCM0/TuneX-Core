package adp3

import (
	"encoding/json"
	"fmt"
	"net/netip"
	"slices"

	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/relaycontracts"
)

func HopPathDigest(h HopConfig) (string, error) {
	return contracts.ComputeDigest(map[string]any{
		"scopeId": h.ScopeId, "forwardId": h.ForwardId, "forwardRevision": h.ForwardRevision,
		"deploymentGeneration": h.DeploymentGeneration, "profileId": h.ProfileId,
		"profileRevision": h.ProfileRevision, "profileDigest": h.ProfileDigest,
		"protocol": h.Protocol, "path": h.Path, "target": h.Target,
	})
}

func ValidateMultihopAssignment(a Assignment, node string, epoch uint64, extension *uint64) error {
	h := a.Driver.Config.Hop
	if extension == nil || *extension != 1 || a.Driver.Id != "native.multihop.v1" || h == nil || len(h.Path) < 3 || len(h.Path) > 8 || h.HopIndex >= uint64(len(h.Path)) {
		return fmt.Errorf("UNSUPPORTED_CAPABILITY: Explicit complete multi-hop extension required")
	}
	nodes, ids, pins := map[string]bool{}, map[string]bool{}, map[string]bool{}
	for _, n := range h.Path {
		ip, err := netip.ParseAddr(n.ListenAddress)
		if err != nil || ip.Zone() != "" || ip.String() != n.ListenAddress || nodes[n.NodeId] || ids[n.AssignmentId] || pins[n.PeerFingerprint] {
			return fmt.Errorf("INVALID_CONFIG: Canonical distinct multi-hop path required")
		}
		if !contracts.CanonicalHost(n.Host) {
			return fmt.Errorf("INVALID_CONFIG: Multi-hop host")
		}
		nodes[n.NodeId] = true
		ids[n.AssignmentId] = true
		pins[n.PeerFingerprint] = true
	}
	hash, err := HopPathDigest(*h)
	if err != nil || hash != h.PathDigest {
		return fmt.Errorf("INTEGRITY_FAILURE: Multi-hop path digest differs")
	}
	hash, err = contracts.ComputeDigest(h.Profile)
	if err != nil || hash != h.ProfileDigest {
		return fmt.Errorf("INTEGRITY_FAILURE: Multi-hop Profile digest differs")
	}
	// The nested Profile is the existing independently validated bounded wire Profile.
	raw, err := json.Marshal(h.Profile)
	if err != nil {
		return err
	}
	if err = relaycontracts.Parse("ProfileConfig", raw, nil); err != nil {
		return err
	}
	if !contracts.CanonicalHost(h.Target.Host) || !slices.Contains(h.Profile.Protocols, h.Protocol) {
		return fmt.Errorf("INVALID_CONFIG: Multi-hop target or Profile protocol differs")
	}
	for i, cidr := range h.AllowedDestinationCidrs {
		if !contracts.ValidCIDR(cidr) || i > 0 && h.AllowedDestinationCidrs[i-1] >= cidr {
			return fmt.Errorf("INVALID_CONFIG: Canonical multi-hop CIDR policy required")
		}
	}
	n := h.Path[h.HopIndex]
	role, physical := "multihop-transit", "tcp"
	if h.HopIndex == 0 {
		role = "multihop-ingress"
		physical = h.Protocol
	} else if h.HopIndex == uint64(len(h.Path)-1) {
		role = "multihop-egress"
	}
	hash, err = contracts.ComputeDigest(a.Driver.Config)
	if err != nil || hash != a.Driver.ConfigDigest || a.Role != role || n.NodeId != node || n.SessionEpoch != epoch || n.AssignmentId != a.AssignmentId ||
		n.BindingFence != a.BindingFence || a.ForwardId != h.ForwardId || a.ForwardRevision != h.ForwardRevision || a.DeploymentGeneration != h.DeploymentGeneration ||
		a.Protocol != h.Protocol || a.Resource.Protocol != physical || a.Resource.Port != n.Port || a.Resource.Address != n.ListenAddress {
		return fmt.Errorf("AUTHORIZATION_DENIED: Multi-hop execution binding differs")
	}
	return nil
}
