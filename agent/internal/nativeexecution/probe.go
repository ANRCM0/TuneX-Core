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
