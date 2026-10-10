package securelink

import (
	"crypto/tls"
	"crypto/x509"
	"strings"
)

type Identity struct {
	CertificatePEM string `json:"certificate_pem"`
	PrivateKeyPEM  string `json:"private_key_pem"`
	CAPEM          string `json:"ca_pem"`
	PeerURI        string `json:"peer_uri"`
	OwnURI         string `json:"own_uri,omitempty"`
}

// TLSConfig performs ordinary certificate-chain verification and then checks
// the exact control-plane peer URI. InsecureSkipVerify is never enabled.
func TLSConfig(identity Identity) (*tls.Config, error) {
	cert, err := tls.X509KeyPair([]byte(identity.CertificatePEM), []byte(identity.PrivateKeyPEM))
	if err != nil || len(cert.Certificate) == 0 {
		return nil, ErrIdentity
	}
	leaf, err := x509.ParseCertificate(cert.Certificate[0])
	if err != nil {
		return nil, ErrIdentity
	}
	if identity.OwnURI != "" && !hasURI(leaf, identity.OwnURI) {
		return nil, ErrIdentity
	}
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM([]byte(identity.CAPEM)) {
		return nil, ErrIdentity
	}
	peer := strings.Split(identity.PeerURI, ":")
	// urn:tunex:tst:w:1:l:2:n:3:r:egress
	if len(peer) != 11 || peer[0] != "urn" || peer[1] != "tunex" || peer[2] != "tst" ||
		peer[3] != "w" || peer[5] != "l" || peer[7] != "n" || peer[9] != "r" ||
		(peer[10] != "ingress" && peer[10] != "egress") {
		return nil, ErrIdentity
	}
	for _, index := range []int{4, 6, 8} {
		if len(peer[index]) == 0 || len(peer[index]) > 10 || peer[index][0] == '0' {
			return nil, ErrIdentity
		}
		for _, ch := range peer[index] {
			if ch < '0' || ch > '9' {
				return nil, ErrIdentity
			}
		}
	}
	cfg := &tls.Config{
		MinVersion: tls.VersionTLS13, MaxVersion: tls.VersionTLS13,
		Certificates: []tls.Certificate{cert}, RootCAs: pool, ClientCAs: pool,
		ClientAuth: tls.RequireAndVerifyClientCert,
		NextProtos: []string{ALPN}, ServerName: "tst-node-" + peer[8] + ".tunex.invalid",
		SessionTicketsDisabled: true,
	}
	cfg.VerifyConnection = func(state tls.ConnectionState) error {
		if state.Version != tls.VersionTLS13 || state.NegotiatedProtocol != ALPN || len(state.VerifiedChains) == 0 ||
			len(state.PeerCertificates) == 0 || !hasURI(state.PeerCertificates[0], identity.PeerURI) {
			return ErrIdentity
		}
		return nil
	}
	return cfg, nil
}

func hasURI(certificate *x509.Certificate, expected string) bool {
	return len(certificate.URIs) == 1 && certificate.URIs[0].String() == expected
}
