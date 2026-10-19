// Package executionidentity defines the trusted Agent credential provider boundary.
package executionidentity

import "time"

const InterfaceVersion uint64 = 2

type Locations struct {
	Certificate, PrivateKey, CA                              string
	MachineBundle, MachineRequest, RelayBundle, RelayRequest string
}

// Facts are not credential-file encodings; native records belong to the adapter.
type CredentialBundle struct {
	Certificate string
	PrivateKey  string
}
type RotationRequest struct {
	RequestID  string
	CSR        string
	PrivateKey string
}
type RelayResponse struct {
	NodeID              string
	Certificate         string
	CA                  string
	Fingerprint         string
	ValidUntil          string
	CertificateNotAfter string
	OverlapUntil        *string
}
type RelayBundle struct {
	NodeID              string
	Certificate         string
	PrivateKey          string
	Fingerprint         string
	ValidUntil          string
	CertificateNotAfter string
	RenewAfter          string
	RequestID           string
}
type MachineIdentity[Certificate any] struct {
	Certificate Certificate
	Until       time.Time
	Fingerprint [32]byte
}

// Provider performs native file/crypto/chain checks, not Runner authorization or publication.
// Certificate and Roots remain adapter-owned types, not source dependencies of L1.
type Provider[Certificate, Roots any] interface {
	Locations(certificate, privateKey, ca string) Locations
	LoadMachine(locations Locations, node string, roots Roots) (MachineIdentity[Certificate], error)
	PrepareRotation(path, node string) (RotationRequest, error)
	ValidateMachineRotation(locations Locations, node string, request RotationRequest, raw []byte) (CredentialBundle, error)
	SaveMachine(path string, bundle CredentialBundle) error
	ReadPending(path string) ([]byte, error)
	Missing(err error) bool
	Remove(path string, ignoreMissing bool) error
	DecodeProtected(raw []byte, destination any) error
	// Missing is true only when the initial bundle read reports absence, not a later MAC/store failure.
	LoadRelay(path string, key []byte) (RelayBundle, bool, error)
	ValidateRelay(bundle RelayBundle, node string, roots Roots) (Certificate, time.Time, error)
	ValidateRelayAt(bundle RelayBundle, node string, roots Roots, checkedAt time.Time) (Certificate, time.Time, error)
	SaveRelay(path string, key []byte, bundle RelayBundle) error
}
