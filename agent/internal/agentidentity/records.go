package agentidentity

import "github.com/tunex/vnext/agent/internal/executionidentity"

type CredentialBundle struct {
	Certificate string `json:"certificate"`
	PrivateKey  string `json:"privateKey"`
}

type RotationRequest struct {
	RequestID  string `json:"requestId"`
	CSR        string `json:"csr"`
	PrivateKey string `json:"privateKey"`
}

type RelayResponse struct {
	NodeID              string  `json:"nodeId"`
	Certificate         string  `json:"certificate"`
	CA                  string  `json:"ca"`
	Fingerprint         string  `json:"fingerprint"`
	ValidUntil          string  `json:"validUntil"`
	CertificateNotAfter string  `json:"certificateNotAfter"`
	OverlapUntil        *string `json:"overlapUntil"`
}

type RelayBundle struct {
	NodeID              string `json:"nodeId"`
	Certificate         string `json:"certificate"`
	PrivateKey          string `json:"privateKey"`
	Fingerprint         string `json:"fingerprint"`
	ValidUntil          string `json:"validUntil"`
	CertificateNotAfter string `json:"certificateNotAfter"`
	RenewAfter          string `json:"renewAfter,omitempty"`
	RequestID           string `json:"requestId,omitempty"`
}

func CredentialBundleFacts(value CredentialBundle) executionidentity.CredentialBundle {
	return executionidentity.CredentialBundle{Certificate: value.Certificate, PrivateKey: value.PrivateKey}
}

func CredentialBundleFromFacts(value executionidentity.CredentialBundle) CredentialBundle {
	return CredentialBundle{Certificate: value.Certificate, PrivateKey: value.PrivateKey}
}

func RotationRequestFacts(value RotationRequest) executionidentity.RotationRequest {
	return executionidentity.RotationRequest{RequestID: value.RequestID, CSR: value.CSR, PrivateKey: value.PrivateKey}
}

func RotationRequestFromFacts(value executionidentity.RotationRequest) RotationRequest {
	return RotationRequest{RequestID: value.RequestID, CSR: value.CSR, PrivateKey: value.PrivateKey}
}

func RelayResponseFacts(value RelayResponse) executionidentity.RelayResponse {
	return executionidentity.RelayResponse{NodeID: value.NodeID, Certificate: value.Certificate, CA: value.CA,
		Fingerprint: value.Fingerprint, ValidUntil: value.ValidUntil, CertificateNotAfter: value.CertificateNotAfter,
		OverlapUntil: value.OverlapUntil}
}

func RelayResponseFromFacts(value executionidentity.RelayResponse) RelayResponse {
	return RelayResponse{NodeID: value.NodeID, Certificate: value.Certificate, CA: value.CA,
		Fingerprint: value.Fingerprint, ValidUntil: value.ValidUntil, CertificateNotAfter: value.CertificateNotAfter,
		OverlapUntil: value.OverlapUntil}
}

func RelayBundleFacts(value RelayBundle) executionidentity.RelayBundle {
	return executionidentity.RelayBundle{NodeID: value.NodeID, Certificate: value.Certificate, PrivateKey: value.PrivateKey,
		Fingerprint: value.Fingerprint, ValidUntil: value.ValidUntil, CertificateNotAfter: value.CertificateNotAfter,
		RenewAfter: value.RenewAfter, RequestID: value.RequestID}
}

func RelayBundleFromFacts(value executionidentity.RelayBundle) RelayBundle {
	return RelayBundle{NodeID: value.NodeID, Certificate: value.Certificate, PrivateKey: value.PrivateKey,
		Fingerprint: value.Fingerprint, ValidUntil: value.ValidUntil, CertificateNotAfter: value.CertificateNotAfter,
		RenewAfter: value.RenewAfter, RequestID: value.RequestID}
}
