package egress

import "net/netip"

var sensitivePrefixes = []string{"169.254.0.0/16", "100.100.100.200/32", "fd00:ec2::254/128", "fe80::/10"}

// Allowed checks a numeric destination; callers must dial this IP rather than resolve a hostname again.
func Allowed(addr netip.Addr, cidrs []string, allowMetadata bool) bool {
	addr = addr.Unmap()
	if !addr.IsValid() || addr.IsUnspecified() || addr.IsMulticast() {
		return false
	}
	if !allowMetadata {
		for _, text := range sensitivePrefixes {
			if netip.MustParsePrefix(text).Contains(addr) {
				return false
			}
		}
	}
	for _, text := range cidrs {
		prefix, err := netip.ParsePrefix(text)
		if err == nil && prefix.Addr().BitLen() == addr.BitLen() && prefix.Contains(addr) {
			return true
		}
	}
	return false
}
