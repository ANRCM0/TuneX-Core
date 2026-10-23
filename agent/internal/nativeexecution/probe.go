package nativeexecution

import (
	"fmt"
	"net/netip"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/egress"
	"github.com/tunex/vnext/agent/internal/observationtrust"
)

// ProbeDestination is decoded native configuration, not proof of a current binding
// or an execution permit. The caller still owns all live instance/ticket checks.
type ProbeDestination struct {
	Host                    string
	Port                    int
	AllowedDestinationCIDRs []string
}

// The caller pins the original instance/tickets; the Relay engine owns final egress policy.
func PathProbeDestination(a adp3.Assignment, protocol, digest string, revision uint64, host string, port int) (ProbeDestination, error) {
    denied := fmt.Errorf("AUTHORIZATION_DENIED: Active native forwarding ingress required")
    if a.Phase != "active" || (protocol != "tcp" && protocol != "udp") || a.Protocol != protocol ||
        a.Resource.Protocol != protocol || a.Driver.SchemaVersion != 1 || port < 1 || port > 65535 || !observationtrust.AddressAllowed(host) {
        return ProbeDestination{}, denied
    }
    actual, err := contracts.ComputeDigest(a.Driver.Config)
    if err != nil || actual != digest || actual != a.Driver.ConfigDigest { return ProbeDestination{}, denied }
    var allowed []string
    if a.Role == "relay-ingress" && a.Driver.Id == "native.relay.v1" {
        config := a.Driver.Config
        if config.Role == nil || *config.Role != "relay-ingress" || config.EgressPolicyRevision == nil ||
            *config.EgressPolicyRevision != revision || config.AllowedDestinationCidrs == nil { return ProbeDestination{}, denied }
        allowed = *config.AllowedDestinationCidrs
    } else if a.Role == "multihop-ingress" && a.Driver.Id == "native.multihop.v1" {
        config := a.Driver.Config.Hop
        if config == nil || config.HopIndex != 0 || config.EgressPolicyRevision != revision ||
            config.Target.Host != host || config.Target.Port != uint64(port) { return ProbeDestination{}, denied }
        allowed = config.AllowedDestinationCidrs
    } else { return ProbeDestination{}, denied }
    return ProbeDestination{Host:host,Port:port,AllowedDestinationCIDRs:append([]string(nil),allowed...)}, nil
}

func DirectProbeDestination(assignment adp3.Assignment, protocol, configDigest string, policyRevision uint64) (ProbeDestination, error) {
	if assignment.Phase != "active" || assignment.Protocol != protocol || assignment.Resource.Protocol != protocol || assignment.Driver.SchemaVersion != 1 {
		return ProbeDestination{}, fmt.Errorf("AUTHORIZATION_DENIED: Native Probe configuration unavailable")
	}
	digest, err := contracts.ComputeDigest(assignment.Driver.Config)
	if err != nil || digest != configDigest {
		return ProbeDestination{}, fmt.Errorf("AUTHORIZATION_DENIED: Native Probe configuration unavailable")
	}
	direct, err := DirectAssignment(assignment)
	if err != nil || direct.Driver.Config.EgressPolicyRevision != policyRevision {
		return ProbeDestination{}, fmt.Errorf("AUTHORIZATION_DENIED: Native Probe configuration unavailable")
	}
	config := direct.Driver.Config
	if config.Target.Port < 1 || config.Target.Port > 65535 {
		return ProbeDestination{}, fmt.Errorf("AUTHORIZATION_DENIED: Native Probe configuration unavailable")
	}
	return ProbeDestination{Host: config.Target.Host, Port: int(config.Target.Port), AllowedDestinationCIDRs: config.AllowedDestinationCidrs}, nil
}

// Only the existing numeric business destination can match a declared TLS service.
func ProbeServiceDestinationAllowed(host string, port int, allowed []string, serviceHost string, servicePort uint64) bool {
	if host != serviceHost || uint64(port) != servicePort || !observationtrust.AddressAllowed(host) {
		return false
	}
	endpoint, err := netip.ParseAddr(host)
	return err == nil && egress.Allowed(endpoint, allowed, false)
}

// The driver has already checked the actual current instance. This function only
// compares native endpoint representation and the original address/policy bounds.
func ProbeIngressEndpoint(configuredAddress string, configuredPort uint64, observedAddress string, observedPort uint64, allowed []string) (string, int, bool) {
	configured, err := netip.ParseAddr(configuredAddress)
	actual, e := netip.ParseAddr(observedAddress)
	if err != nil || e != nil || configured.Zone() != "" || actual.Zone() != "" ||
		configured.Unmap() != actual.Unmap() || configuredPort != observedPort ||
		actual.IsUnspecified() || actual.IsMulticast() || actual.IsLinkLocalUnicast() || actual.IsLinkLocalMulticast() ||
		actual.Is4() && actual.As4()[0] >= 224 || !egress.Allowed(actual.Unmap(), allowed, false) || observedPort < 1 || observedPort > 65535 {
		return "", 0, false
	}
	return actual.Unmap().String(), int(observedPort), true
}

// Call after the owner's exact business endpoint and public address checks.
func ProbeEchoBusinessDestinationAllowed(host string, allowed []string) bool {
	business, err := netip.ParseAddr(host)
	return err == nil && egress.Allowed(business, allowed, false)
}

// Echo retains its own original address/protocol/policy/port check order. The
// caller already observed and rechecked the original current driver instance.
func ProbeEchoIngressEndpoint(configuredAddress string, configuredPort uint64, configuredProtocol string,
	observedAddress string, observedPort uint64, protocol string, allowed []string) (string, int, bool) {
	configured, e1 := netip.ParseAddr(configuredAddress)
	actual, e2 := netip.ParseAddr(observedAddress)
	if e1 != nil || e2 != nil || configured.Zone() != "" || actual.Zone() != "" ||
		configured.Unmap() != actual.Unmap() || configuredPort != observedPort ||
		configuredProtocol != protocol || !observationtrust.AddressAllowed(actual.Unmap().String()) ||
		!egress.Allowed(actual.Unmap(), allowed, false) || observedPort < 1 || observedPort > 65535 {
		return "", 0, false
	}
	return actual.Unmap().String(), int(observedPort), true
}
