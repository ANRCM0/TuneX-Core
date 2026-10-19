package agentidentity

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/executionidentity"
	"github.com/tunex/vnext/agent/internal/relay"
	"github.com/tunex/vnext/agent/internal/state"
)

const InterfaceVersion uint64 = 2

type credentialBundle = CredentialBundle
type rotationRequest = RotationRequest
type relayCredentialBundle = RelayBundle

type Native struct{}

func LoadCredential(certificatePath, privateKeyPath string) (tls.Certificate, error) {
	path := filepath.Join(filepath.Dir(certificatePath), "credential.json")
	raw, err := os.ReadFile(path)
	if err == nil {
		if _, err := contracts.ParseJSON(raw, 32768); err != nil {
			return tls.Certificate{}, err
		}
		var bundle credentialBundle
		if err := json.Unmarshal(raw, &bundle); err != nil {
			return tls.Certificate{}, err
		}
		return tls.X509KeyPair([]byte(bundle.Certificate), []byte(bundle.PrivateKey))
	}
	if !os.IsNotExist(err) {
		return tls.Certificate{}, err
	}
	return tls.LoadX509KeyPair(certificatePath, privateKeyPath)
}
func PrepareRotation(path, nodeID string) (rotationRequest, error) {
	raw, err := os.ReadFile(path)
	if err == nil {
		if _, err := contracts.ParseJSON(raw, 32768); err != nil {
			return rotationRequest{}, err
		}
		var request rotationRequest
		if err := json.Unmarshal(raw, &request); err != nil {
			return rotationRequest{}, err
		}
		if request.RequestID == "" || request.CSR == "" || request.PrivateKey == "" {
			return rotationRequest{}, fmt.Errorf("INTEGRITY_FAILURE: incomplete credential rotation")
		}
		return request, nil
	}
	if !os.IsNotExist(err) {
		return rotationRequest{}, err
	}
	private, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return rotationRequest{}, err
	}
	key, err := x509.MarshalPKCS8PrivateKey(private)
	if err != nil {
		return rotationRequest{}, err
	}
	csr, err := x509.CreateCertificateRequest(rand.Reader, &x509.CertificateRequest{Subject: pkix.Name{CommonName: nodeID}}, private)
	if err != nil {
		return rotationRequest{}, err
	}
	id := make([]byte, 16)
	if _, err := rand.Read(id); err != nil {
		return rotationRequest{}, err
	}
	request := rotationRequest{RequestID: hex.EncodeToString(id), CSR: string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE REQUEST", Bytes: csr})), PrivateKey: string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: key}))}
	raw, err = json.Marshal(request)
	if err != nil {
		return rotationRequest{}, err
	}
	if err := state.AtomicWrite(path, raw); err != nil {
		return rotationRequest{}, err
	}
	return request, nil
}
func DecodeProtectedJSON(raw []byte, destination any) error {
	if _, err := contracts.ParseJSON(raw, 32768); err != nil {
		return err
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	return decoder.Decode(destination)
}

func ValidateRelayBundle(bundle relayCredentialBundle, node string, roots *x509.CertPool) (tls.Certificate, time.Time, error) {
	return ValidateRelayBundleAt(bundle, node, roots, time.Now())
}

func ValidateRelayBundleAt(bundle relayCredentialBundle, node string, roots *x509.CertPool, checkedAt time.Time) (tls.Certificate, time.Time, error) {
	if bundle.NodeID != node {
		return tls.Certificate{}, time.Time{}, fmt.Errorf("AUTHORIZATION_DENIED: Relay credential Node differs")
	}
	certificate, err := tls.X509KeyPair([]byte(bundle.Certificate), []byte(bundle.PrivateKey))
	if err != nil || len(certificate.Certificate) == 0 {
		return tls.Certificate{}, time.Time{}, fmt.Errorf("INTEGRITY_FAILURE: Relay credential keypair differs")
	}
	leaf, err := x509.ParseCertificate(certificate.Certificate[0])
	if err != nil {
		return tls.Certificate{}, time.Time{}, err
	}
	state := tls.ConnectionState{Version: tls.VersionTLS13, NegotiatedProtocol: relay.ALPN, PeerCertificates: []*x509.Certificate{leaf}}
	if err := relay.VerifyPeer(state, roots, node, []string{bundle.Fingerprint}, x509.ExtKeyUsageServerAuth, checkedAt); err != nil {
		return tls.Certificate{}, time.Time{}, err
	}
	until, err := time.Parse(time.RFC3339Nano, bundle.ValidUntil)
	if err != nil || !until.After(checkedAt) || until.After(leaf.NotAfter) {
		return tls.Certificate{}, time.Time{}, fmt.Errorf("AUTHORIZATION_DENIED: Relay execution validity refused")
	}
	notAfter, err := time.Parse(time.RFC3339Nano, bundle.CertificateNotAfter)
	if err != nil || !notAfter.Equal(leaf.NotAfter) {
		return tls.Certificate{}, time.Time{}, fmt.Errorf("INTEGRITY_FAILURE: Relay leaf expiry differs")
	}
	certificate.Leaf = leaf
	return certificate, until, nil
}

func (Native) Locations(certificate, privateKey, ca string) executionidentity.Locations {
	root := filepath.Dir(certificate)
	return executionidentity.Locations{Certificate: certificate, PrivateKey: privateKey, CA: ca,
		MachineBundle: filepath.Join(root, "credential.json"), MachineRequest: filepath.Join(root, "rotation-request.json"),
		RelayBundle: filepath.Join(root, "relay-credential.json"), RelayRequest: filepath.Join(root, "relay-request.json")}
}
func (Native) LoadMachine(locations executionidentity.Locations, node string, roots *x509.CertPool) (executionidentity.MachineIdentity[tls.Certificate], error) {
	certificate, err := LoadCredential(locations.Certificate, locations.PrivateKey)
	if err != nil {
		return executionidentity.MachineIdentity[tls.Certificate]{}, err
	}
	leaf, err := x509.ParseCertificate(certificate.Certificate[0])
	if err != nil {
		return executionidentity.MachineIdentity[tls.Certificate]{}, err
	}
	if leaf.Subject.CommonName != node {
		return executionidentity.MachineIdentity[tls.Certificate]{}, fmt.Errorf("AUTHORIZATION_DENIED: credential Node mismatch")
	}
	if _, err := leaf.Verify(x509.VerifyOptions{Roots: roots, KeyUsages: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth}}); err != nil {
		return executionidentity.MachineIdentity[tls.Certificate]{}, err
	}
	return executionidentity.MachineIdentity[tls.Certificate]{Certificate: certificate, Until: leaf.NotAfter, Fingerprint: sha256.Sum256(leaf.Raw)}, nil
}
func (Native) PrepareRotation(path, node string) (executionidentity.RotationRequest, error) {
	value, err := PrepareRotation(path, node)
	return RotationRequestFacts(value), err
}
func (Native) ValidateMachineRotation(locations executionidentity.Locations, node string, request executionidentity.RotationRequest, raw []byte) (executionidentity.CredentialBundle, error) {
	value, err := validateMachineRotation(locations, node, RotationRequestFromFacts(request), raw)
	return CredentialBundleFacts(value), err
}
func validateMachineRotation(locations executionidentity.Locations, node string, request rotationRequest, raw []byte) (credentialBundle, error) {
	if _, err := contracts.ParseJSON(raw, 32768); err != nil {
		return credentialBundle{}, err
	}
	var response struct {
		Certificate        string `json:"certificate"`
		CA                 string `json:"ca"`
		Fingerprint        string `json:"fingerprint"`
		ValidUntil         string `json:"validUntil"`
		OldCredentialUntil string `json:"oldCredentialUntil"`
	}
	if err := json.Unmarshal(raw, &response); err != nil {
		return credentialBundle{}, err
	}
	certificate, err := tls.X509KeyPair([]byte(response.Certificate), []byte(request.PrivateKey))
	if err != nil {
		return credentialBundle{}, err
	}
	leaf, err := x509.ParseCertificate(certificate.Certificate[0])
	if err != nil {
		return credentialBundle{}, err
	}
	trusted, err := os.ReadFile(locations.CA)
	if err != nil {
		return credentialBundle{}, err
	}
	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM(trusted) {
		return credentialBundle{}, fmt.Errorf("Invalid Control CA")
	}
	if leaf.Subject.CommonName != node {
		return credentialBundle{}, fmt.Errorf("AUTHORIZATION_DENIED: rotated Node mismatch")
	}
	hash := sha256.Sum256(leaf.Raw)
	if response.Fingerprint != hex.EncodeToString(hash[:]) {
		return credentialBundle{}, fmt.Errorf("INTEGRITY_FAILURE: rotation fingerprint mismatch")
	}
	until, err := time.Parse(time.RFC3339Nano, response.ValidUntil)
	if err != nil || !until.Equal(leaf.NotAfter) {
		return credentialBundle{}, fmt.Errorf("INTEGRITY_FAILURE: rotation certificate expiry mismatch")
	}
	oldUntil, err := time.Parse(time.RFC3339Nano, response.OldCredentialUntil)
	if err != nil || oldUntil.After(time.Now().Add(300*time.Second)) {
		return credentialBundle{}, fmt.Errorf("INTEGRITY_FAILURE: unbounded credential overlap")
	}
	if _, err := leaf.Verify(x509.VerifyOptions{Roots: roots, KeyUsages: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth}}); err != nil {
		return credentialBundle{}, err
	}
	if time.Now().After(leaf.NotAfter) {
		return credentialBundle{}, fmt.Errorf("AUTHORIZATION_DENIED: expired rotated credential")
	}
	return credentialBundle{Certificate: response.Certificate, PrivateKey: request.PrivateKey}, nil
}
func (Native) SaveMachine(path string, bundle executionidentity.CredentialBundle) error {
	raw, _ := json.Marshal(CredentialBundleFromFacts(bundle))
	return state.AtomicWrite(path, raw)
}
func (Native) ReadPending(path string) ([]byte, error) { return os.ReadFile(path) }
func (Native) Missing(err error) bool                  { return os.IsNotExist(err) }
func (Native) Remove(path string, ignoreMissing bool) error {
	err := os.Remove(path)
	if ignoreMissing && os.IsNotExist(err) {
		return nil
	}
	return err
}
func (Native) DecodeProtected(raw []byte, destination any) error {
	return DecodeProtectedJSON(raw, destination)
}
func (Native) LoadRelay(path string, key []byte) (executionidentity.RelayBundle, bool, error) {
	value, missing, err := loadRelay(path, key)
	return RelayBundleFacts(value), missing, err
}
func loadRelay(path string, key []byte) (relayCredentialBundle, bool, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return relayCredentialBundle{}, os.IsNotExist(err), err
	}
	if _, err := contracts.ParseJSON(raw, 65536); err != nil {
		return relayCredentialBundle{}, false, err
	}
	if len(key) != 32 {
		return relayCredentialBundle{}, false, fmt.Errorf("INTEGRITY_FAILURE: Relay protection key required")
	}
	protected, err := state.Load(path, key)
	if err != nil {
		return relayCredentialBundle{}, false, err
	}
	if protected.Generation != 0 || protected.Digest != "" || len(protected.Fences) != 0 || len(protected.Retired) != 0 {
		return relayCredentialBundle{}, false, fmt.Errorf("INTEGRITY_FAILURE: Unexpected Relay credential envelope")
	}
	var bundle relayCredentialBundle
	if err := DecodeProtectedJSON(protected.Snapshot, &bundle); err != nil {
		return relayCredentialBundle{}, false, err
	}
	return bundle, false, nil
}
func (Native) ValidateRelay(bundle executionidentity.RelayBundle, node string, roots *x509.CertPool) (tls.Certificate, time.Time, error) {
	return ValidateRelayBundle(RelayBundleFromFacts(bundle), node, roots)
}
func (Native) ValidateRelayAt(bundle executionidentity.RelayBundle, node string, roots *x509.CertPool, checkedAt time.Time) (tls.Certificate, time.Time, error) {
	return ValidateRelayBundleAt(RelayBundleFromFacts(bundle), node, roots, checkedAt)
}
func (Native) SaveRelay(path string, key []byte, bundle executionidentity.RelayBundle) error {
	raw, _ := json.Marshal(RelayBundleFromFacts(bundle))
	if len(key) != 32 {
		return fmt.Errorf("INTEGRITY_FAILURE: Relay protection key required")
	}
	return state.Save(path, key, state.Journal{Snapshot: raw, Fences: map[string]uint64{}, Retired: map[string]uint64{}})
}
