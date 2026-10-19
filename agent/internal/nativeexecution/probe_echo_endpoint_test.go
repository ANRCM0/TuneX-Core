package nativeexecution

import "testing"

func TestEchoIngressEndpointKeepsNumericProtocolAndPolicyBounds(t *testing.T) {
	for _, vector := range []struct {
		name, configured, observed, configuredProtocol, protocol string
		port, observedPort                                       uint64
		allowed                                                  []string
		want                                                     bool
	}{
		{"public", "8.8.8.8", "8.8.8.8", "tcp", "tcp", 443, 443, []string{"8.8.8.0/24"}, true},
		{"mapped", "::ffff:8.8.8.8", "8.8.8.8", "udp", "udp", 53, 53, []string{"8.8.8.0/24"}, true},
		{"hostname", "example.org", "8.8.8.8", "tcp", "tcp", 443, 443, []string{"0.0.0.0/0"}, false},
		{"zone", "8.8.8.8", "8.8.8.8%eth0", "tcp", "tcp", 443, 443, []string{"0.0.0.0/0"}, false},
		{"different-IP", "8.8.8.8", "8.8.4.4", "tcp", "tcp", 443, 443, []string{"0.0.0.0/0"}, false},
		{"different-port", "8.8.8.8", "8.8.8.8", "tcp", "tcp", 443, 444, []string{"0.0.0.0/0"}, false},
		{"different-protocol", "8.8.8.8", "8.8.8.8", "tcp", "udp", 443, 443, []string{"0.0.0.0/0"}, false},
		{"loopback", "127.0.0.1", "127.0.0.1", "tcp", "tcp", 443, 443, []string{"0.0.0.0/0"}, true},
		{"unspecified", "0.0.0.0", "0.0.0.0", "tcp", "tcp", 443, 443, []string{"0.0.0.0/0"}, false},
		{"metadata", "169.254.169.254", "169.254.169.254", "tcp", "tcp", 443, 443, []string{"0.0.0.0/0"}, false},
		{"policy", "8.8.8.8", "8.8.8.8", "tcp", "tcp", 443, 443, []string{"1.1.1.0/24"}, false},
		{"zero-port", "8.8.8.8", "8.8.8.8", "tcp", "tcp", 0, 0, []string{"0.0.0.0/0"}, false},
		{"large-port", "8.8.8.8", "8.8.8.8", "tcp", "tcp", 65536, 65536, []string{"0.0.0.0/0"}, false},
	} {
		t.Run(vector.name, func(t *testing.T) {
			host, port, ok := ProbeEchoIngressEndpoint(vector.configured, vector.port, vector.configuredProtocol, vector.observed, vector.observedPort, vector.protocol, vector.allowed)
			wantHost := "8.8.8.8"
			if vector.name == "loopback" {
				wantHost = "127.0.0.1"
			}
			if ok != vector.want || ok && (host != wantHost || port != int(vector.port)) || !ok && (host != "" || port != 0) {
				t.Fatalf("endpoint=%s:%d valid=%v, want valid=%v", host, port, ok, vector.want)
			}
		})
	}
	if !ProbeEchoBusinessDestinationAllowed("8.8.8.8", []string{"8.8.8.0/24"}) || ProbeEchoBusinessDestinationAllowed("example.org", []string{"0.0.0.0/0"}) || ProbeEchoBusinessDestinationAllowed("8.8.8.8", nil) {
		t.Fatal("business destination bypassed numeric CIDR restrictions")
	}
}
