// Package relay implements authenticated TLS peer primitives. It is not advertised by the Agent until runtime cutover.
package relay

import (
	"crypto/sha256"
	"crypto/subtle"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"fmt"
	"regexp"
	"slices"
	"time"
)

const ALPN = "tunex-relay/1"

var nodeID = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`)
var fingerprintPattern = regexp.MustCompile(`^sha256:[0-9a-f]{64}$`)

func Fingerprint(leaf *x509.Certificate) string {
	sum := sha256.Sum256(leaf.Raw)
	return "sha256:" + hex.EncodeToString(sum[:])
}
func VerifyPeer(state tls.ConnectionState, roots *x509.CertPool, node string, fingerprints []string, usage x509.ExtKeyUsage, now time.Time) error {
	return verifyPeerProtocol(state, roots, node, fingerprints, usage, now, ALPN)
}
func verifyPeerProtocol(state tls.ConnectionState, roots *x509.CertPool, node string, fingerprints []string, usage x509.ExtKeyUsage, now time.Time, protocol string) error {
	if roots == nil || !nodeID.MatchString(node) || len(fingerprints) < 1 || len(fingerprints) > 2 || state.Version != tls.VersionTLS13 || state.NegotiatedProtocol != protocol || len(state.PeerCertificates) < 1 {
		return fmt.Errorf("AUTHENTICATION_FAILED: Required TLS peer contract missing")
	}
	leaf := state.PeerCertificates[0]
	if leaf.IsCA || !slices.Contains(leaf.ExtKeyUsage, x509.ExtKeyUsageClientAuth) || !slices.Contains(leaf.ExtKeyUsage, x509.ExtKeyUsageServerAuth) {
		return fmt.Errorf("AUTHENTICATION_FAILED: Dedicated dual-purpose peer leaf required")
	}
	intermediates := x509.NewCertPool()
	for _, cert := range state.PeerCertificates[1:] {
		intermediates.AddCert(cert)
	}
	if _, err := leaf.Verify(x509.VerifyOptions{Roots: roots, Intermediates: intermediates, CurrentTime: now, KeyUsages: []x509.ExtKeyUsage{usage}}); err != nil {
		return fmt.Errorf("AUTHENTICATION_FAILED: Chain, expiry or purpose refused")
	}
	wanted := "urn:tunex:node:" + node
	if len(leaf.URIs) != 1 || leaf.URIs[0].String() != wanted {
		return fmt.Errorf("AUTHENTICATION_FAILED: Exact Node URI required")
	}
	actual := Fingerprint(leaf)
	allowed := 0
	for _, fp := range fingerprints {
		if !fingerprintPattern.MatchString(fp) {
			return fmt.Errorf("INVALID_CONFIG: Exact peer fingerprint required")
		}
		allowed |= subtle.ConstantTimeCompare([]byte(actual), []byte(fp))
	}
	if allowed != 1 {
		return fmt.Errorf("AUTHENTICATION_FAILED: Peer fingerprint refused")
	}
	return nil
}
func TLSConfig(certificate tls.Certificate, roots *x509.CertPool, peerNode string, fingerprints []string, server bool) (*tls.Config, error) {
	return tlsConfigProtocol(certificate, roots, peerNode, fingerprints, server, ALPN)
}
func tlsConfigProtocol(certificate tls.Certificate, roots *x509.CertPool, peerNode string, fingerprints []string, server bool, protocol string) (*tls.Config, error) {
	if roots == nil || !nodeID.MatchString(peerNode) || len(fingerprints) < 1 || len(fingerprints) > 2 || len(certificate.Certificate) == 0 {
		return nil, fmt.Errorf("INVALID_CONFIG: Bound Relay identity required")
	}
	for _, fp := range fingerprints {
		if !fingerprintPattern.MatchString(fp) {
			return nil, fmt.Errorf("INVALID_CONFIG: Invalid peer fingerprint")
		}
	}
	roots = roots.Clone()
	copyFingerprints := append([]string(nil), fingerprints...)
	config := &tls.Config{Certificates: []tls.Certificate{certificate}, MinVersion: tls.VersionTLS13, MaxVersion: tls.VersionTLS13, NextProtos: []string{protocol}, SessionTicketsDisabled: true}
	usage := x509.ExtKeyUsageServerAuth
	if server {
		config.ClientAuth = tls.RequireAndVerifyClientCert
		config.ClientCAs = roots
		usage = x509.ExtKeyUsageClientAuth
	} else {
		// Node identity is URI SAN, not DNS. Built-in DNS verification is replaced by the complete chain/purpose/URI/pin check below.
		config.InsecureSkipVerify = true
	}
	config.VerifyConnection = func(state tls.ConnectionState) error {
		return verifyPeerProtocol(state, roots, peerNode, copyFingerprints, usage, time.Now(), protocol)
	}
	return config, nil
}
