// Package transit is a standalone, non-Runner-wired data-plane prototype.
// It grants no ADP/3 authority and must not accept an untrusted TransitIntent.
package transit

import (
	"crypto/subtle"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"slices"
	"time"

	"github.com/tunex/vnext/agent/internal/relay"
)

const ALPN = "tunex-transit/1"

type Identity struct {
	Certificate tls.Certificate
	Roots       *x509.CertPool
}

func verifyLeaf(cert *x509.Certificate, roots *x509.CertPool, node, pin string, purpose x509.ExtKeyUsage) error {
	if cert == nil || cert.IsCA || roots == nil || len(cert.URIs) != 1 ||
		cert.URIs[0].String() != "urn:tunex:node:"+node ||
		!slices.Contains(cert.ExtKeyUsage, x509.ExtKeyUsageClientAuth) ||
		!slices.Contains(cert.ExtKeyUsage, x509.ExtKeyUsageServerAuth) ||
		subtle.ConstantTimeCompare([]byte(relay.Fingerprint(cert)), []byte(pin)) != 1 {
		return fmt.Errorf("AUTHENTICATION_FAILED: Exact Transit Node, purpose and certificate pin required")
	}
	if _, err := cert.Verify(x509.VerifyOptions{Roots: roots, CurrentTime: time.Now(), KeyUsages: []x509.ExtKeyUsage{purpose}}); err != nil {
		return fmt.Errorf("AUTHENTICATION_FAILED: Untrusted, expired or unauthorized Transit certificate: %w", err)
	}
	return nil
}

func tlsConfig(id Identity, peerNode, fingerprint string, server bool) (*tls.Config, error) {
	if id.Roots == nil || len(id.Certificate.Certificate) == 0 || peerNode == "" || fingerprint == "" {
		return nil, fmt.Errorf("INVALID_CONFIG: Bound Transit identity required")
	}
	leaf := id.Certificate.Leaf
	var err error
	if leaf == nil {
		leaf, err = x509.ParseCertificate(id.Certificate.Certificate[0])
		if err != nil {
			return nil, err
		}
	}
	if leaf == nil || leaf.IsCA || !time.Now().Before(leaf.NotAfter) {
		return nil, fmt.Errorf("AUTHENTICATION_FAILED: Valid local Transit leaf required")
	}
	roots := id.Roots.Clone()
	cfg := &tls.Config{
		Certificates: []tls.Certificate{id.Certificate},
		MinVersion:   tls.VersionTLS13, MaxVersion: tls.VersionTLS13,
		NextProtos: []string{ALPN}, SessionTicketsDisabled: true,
	}
	purpose := x509.ExtKeyUsageServerAuth
	if server {
		cfg.ClientAuth = tls.RequireAndVerifyClientCert
		cfg.ClientCAs = roots
		purpose = x509.ExtKeyUsageClientAuth
	} else {
		// URI SAN identity cannot use hostname verification. VerifyConnection below
		// checks chain, purpose, exact URI and SHA256 leaf pin in addition to ALPN.
		cfg.InsecureSkipVerify = true
	}
	cfg.VerifyConnection = func(state tls.ConnectionState) error {
		if state.Version != tls.VersionTLS13 || state.NegotiatedProtocol != ALPN || len(state.PeerCertificates) != 1 {
			return fmt.Errorf("AUTHENTICATION_FAILED: Transit TLS 1.3 ALPN or peer chain missing")
		}
		// Accept properly chained intermediates rather than silently bypassing CA.
		cert := state.PeerCertificates[0]
		opts := x509.VerifyOptions{Roots: roots, CurrentTime: time.Now(), KeyUsages: []x509.ExtKeyUsage{purpose}, Intermediates: x509.NewCertPool()}
		for _, intermediate := range state.PeerCertificates[1:] {
			opts.Intermediates.AddCert(intermediate)
		}
		if _, err := cert.Verify(opts); err != nil {
			return fmt.Errorf("AUTHENTICATION_FAILED: %w", err)
		}
		return verifyLeaf(cert, roots, peerNode, fingerprint, purpose)
	}
	return cfg, nil
}
