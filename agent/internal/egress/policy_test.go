package egress

import (
	"net/netip"
	"testing"
)

func TestAllowedLiteralPolicy(t *testing.T) {
	for _, tc := range []struct {
		host              string
		cidrs             []string
		metadata, allowed bool
	}{
		{"127.0.0.1", []string{"127.0.0.0/8"}, false, true},
		{"::ffff:127.0.0.1", []string{"127.0.0.0/8"}, false, true},
		{"127.0.0.1", []string{"::/0", "invalid"}, false, false},
		{"0.0.0.0", []string{"0.0.0.0/0"}, true, false},
		{"::", []string{"::/0"}, true, false},
		{"224.0.0.1", []string{"0.0.0.0/0"}, true, false},
		{"ff02::1", []string{"::/0"}, true, false},
		{"169.254.169.254", []string{"0.0.0.0/0"}, false, false},
		{"::ffff:169.254.169.254", []string{"0.0.0.0/0"}, false, false},
		{"169.254.169.254", []string{"0.0.0.0/0"}, true, true},
		{"100.100.100.200", []string{"0.0.0.0/0"}, false, false},
		{"fd00:ec2::254", []string{"::/0"}, false, false},
		{"fe80::1", []string{"::/0"}, false, false},
	} {
		if got := Allowed(netip.MustParseAddr(tc.host), tc.cidrs, tc.metadata); got != tc.allowed {
			t.Fatalf("%s: allowed=%v, want=%v", tc.host, got, tc.allowed)
		}
	}
	if Allowed(netip.Addr{}, []string{"0.0.0.0/0"}, true) {
		t.Fatal("invalid literal accepted")
	}
}
