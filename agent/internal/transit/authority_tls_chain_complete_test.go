package transit

import (
	"crypto/tls"
	"crypto/x509"
	"testing"

	"github.com/tunex/vnext/agent/internal/relay"
)

// The original callback deliberately refuses every peer-chain length other than
// one before its intermediate loop. These are native callback vectors, not TLS
// replacements; nil entries would panic if intermediate iteration moved earlier.
func TestTransitAuthorityTLSChainCompleteNativeFirstRefusal(t *testing.T) {
	ca := newCA(t)
	local := ca.node(t, "node-b")
	peer := ca.node(t, "node-c")
	const refusal = "AUTHENTICATION_FAILED: Transit TLS 1.3 ALPN or peer chain missing"
	for _, server := range []bool{false, true} {
		config, err := tlsConfig(Identity{Certificate: local, Roots: ca.roots}, "node-c", relay.Fingerprint(peer.Leaf), server)
		if err != nil {
			t.Fatal(err)
		}
		baseline := tls.ConnectionState{Version: tls.VersionTLS13, NegotiatedProtocol: ALPN, PeerCertificates: []*x509.Certificate{peer.Leaf}}
		if err := config.VerifyConnection(baseline); err != nil {
			t.Fatal("valid single native peer leaf refused", server, err)
		}
		vectors := []struct {
			name  string
			chain []*x509.Certificate
		}{
			{"missing", nil},
			{"empty", []*x509.Certificate{}},
			{"trusted-root-appended", []*x509.Certificate{peer.Leaf, ca.leaf}},
			{"nil-intermediate", []*x509.Certificate{peer.Leaf, nil}},
			{"nil-leaf-before-intermediate", []*x509.Certificate{nil, ca.leaf}},
			{"multiple-nil-intermediates", []*x509.Certificate{peer.Leaf, nil, nil}},
		}
		for _, vector := range vectors {
			t.Run(vector.name+map[bool]string{false: "/client", true: "/server"}[server], func(t *testing.T) {
				candidate := baseline
				candidate.PeerCertificates = vector.chain
				if err := config.VerifyConnection(candidate); err == nil || err.Error() != refusal {
					t.Fatal("native chain-length first refusal changed", err)
				}
			})
		}
		for _, version := range []uint16{0, tls.VersionTLS12} {
			candidate := baseline
			candidate.Version = version
			if err := config.VerifyConnection(candidate); err == nil || err.Error() != refusal {
				t.Fatal("native TLS version refusal changed", server, version, err)
			}
		}
		for _, alpn := range []string{"", "tunex-relay/1"} {
			candidate := baseline
			candidate.NegotiatedProtocol = alpn
			if err := config.VerifyConnection(candidate); err == nil || err.Error() != refusal {
				t.Fatal("native ALPN refusal changed", server, alpn, err)
			}
		}
	}
}
