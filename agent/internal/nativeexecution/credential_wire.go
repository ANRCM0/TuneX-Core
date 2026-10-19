package nativeexecution

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/tunex/vnext/agent/internal/agentidentity"
	"github.com/tunex/vnext/agent/internal/executionidentity"
)

// Both original online requests send only requestId and CSR, never the key.
func EncodeCredentialRotation(request executionidentity.RotationRequest) ([]byte, error) {
	return json.Marshal(map[string]string{"requestId": request.RequestID, "csr": request.CSR})
}

func RelayCredentialResponseBundle(response agentidentity.RelayResponse, request executionidentity.RotationRequest) executionidentity.RelayBundle {
	return executionidentity.RelayBundle{NodeID: response.NodeID, Certificate: response.Certificate,
		PrivateKey: request.PrivateKey, Fingerprint: "sha256:" + response.Fingerprint, ValidUntil: response.ValidUntil,
		CertificateNotAfter: response.CertificateNotAfter, RequestID: request.RequestID}
}

// Retained schedule format checks precede the original provider's certificate
// validation. No current time or live credential authority is inferred here.
func RelayCredentialSchedule(validUntil, renewal string) (time.Time, time.Time, error) {
	var renewAfter time.Time
	effectiveUntil, err := ParseWireTime(validUntil)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("INTEGRITY_FAILURE: Relay effective expiry differs")
	}
	if renewal != "" {
		renewAfter, err = ParseWireTime(renewal)
		if err != nil || !renewAfter.Before(effectiveUntil) {
			return time.Time{}, time.Time{}, fmt.Errorf("INTEGRITY_FAILURE: Relay renewal schedule differs")
		}
	}
	return effectiveUntil, renewAfter, nil
}

func RelayCredentialWithRenewal(bundle executionidentity.RelayBundle, renewAfter time.Time) executionidentity.RelayBundle {
	bundle.RenewAfter = renewAfter.UTC().Format(time.RFC3339Nano)
	return bundle
}
