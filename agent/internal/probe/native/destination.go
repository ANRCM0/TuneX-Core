// Package native owns Probe's native destination and bounded socket adapters.
// It holds no executor, permit, current instance, admission budget or counters.
package native

import (
	"net"
	"net/netip"
	"strconv"

	"github.com/tunex/vnext/agent/internal/egress"
)

type Destination struct {
	address netip.Addr
	port    int
}

// ParseDestination retains numeric-only parsing, zone rejection and unmapping.
func ParseDestination(host string, port int) (Destination, bool) {
	address, err := netip.ParseAddr(host)
	if err != nil || address.Zone() != "" || port < 1 || port > 65535 {
		return Destination{}, false
	}
	return Destination{address: address.Unmap(), port: port}, true
}

func (destination Destination) Allowed(cidrs []string) bool {
	return egress.Allowed(destination.address, cidrs, false) &&
		!(destination.address.Is4() && destination.address.As4()[0] >= 224)
}

func (destination Destination) Network(udp bool) string {
	if !udp {
		return "tcp"
	}
	if destination.address.Is6() {
		return "udp6"
	}
	return "udp4"
}

func (destination Destination) Address() string {
	return net.JoinHostPort(destination.address.String(), strconv.Itoa(destination.port))
}
