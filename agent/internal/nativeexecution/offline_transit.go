package nativeexecution

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/json"

	"github.com/tunex/vnext/agent/internal/adp3transit"
	"github.com/tunex/vnext/agent/internal/executionhost"
	"github.com/tunex/vnext/agent/internal/transit"
)

const OfflineTransitAdapterVersion uint64 = 1

type OfflineTransitCertificate = tls.Certificate
type OfflineTransitRoots = x509.CertPool
type OfflineTransitIdentity = transit.Identity

func OfflineTransitIdentityAvailable(certificate OfflineTransitCertificate, roots *OfflineTransitRoots) bool {
	return roots != nil && len(certificate.Certificate) != 0
}

func OfflineTransitPeerIdentity(certificate OfflineTransitCertificate, roots *OfflineTransitRoots) OfflineTransitIdentity {
	return OfflineTransitIdentity{Certificate: certificate, Roots: roots.Clone()}
}

func EncodeOfflineTransitIntent(assignment adp3transit.Assignment) ([]byte, error) {
	return json.Marshal(assignment.Driver.Config.Intent)
}

func PrepareOfflineTransit(raw []byte, identity OfflineTransitIdentity, allow func() error) (executionhost.PreparedInstance, error) {
	engine, err := transit.Prepare(raw, identity, allow)
	// A typed-nil interface would incorrectly enter the caller's Close branch.
	if engine == nil {
		return nil, err
	}
	return engine, err
}

func OfflineTransitErrorCode(err error) string {
	if err == nil {
		return ""
	}
	text := err.Error()
	for i, char := range text {
		if char == ':' || char == ' ' {
			if i > 0 {
				return text[:i]
			}
			break
		}
	}
	return "DOWNSTREAM_UNAVAILABLE"
}
