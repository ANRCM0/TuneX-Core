package control

import (
	"context"
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
	"github.com/tunex/vnext/agent/internal/state"
)

type credentialBundle struct {
	Certificate string `json:"certificate"`
	PrivateKey  string `json:"privateKey"`
}
type rotationRequest struct {
	RequestID  string `json:"requestId"`
	CSR        string `json:"csr"`
	PrivateKey string `json:"privateKey"`
}

func loadCredential(options Options) (tls.Certificate, error) {
	path := filepath.Join(filepath.Dir(options.Certificate), "credential.json")
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
	return tls.LoadX509KeyPair(options.Certificate, options.PrivateKey)
}
func prepareRotation(path, nodeID string) (rotationRequest, error) {
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
func (runner *Runner) reloadCredential() error {
	certificate, err := loadCredential(runner.options)
	if err != nil {
		return err
	}
	leaf, err := x509.ParseCertificate(certificate.Certificate[0])
	if err != nil {
		return err
	}
	if leaf.Subject.CommonName != runner.options.NodeID {
		return fmt.Errorf("AUTHORIZATION_DENIED: credential Node mismatch")
	}
	if _, err := leaf.Verify(x509.VerifyOptions{Roots: runner.roots, KeyUsages: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth}}); err != nil {
		return err
	}
	hash := sha256.Sum256(leaf.Raw)
	runner.mutex.Lock()
	changed := runner.credentialFingerprint != hash
	runner.certificate = certificate
	runner.credentialUntil = leaf.NotAfter
	runner.credentialFingerprint = hash
	runner.mutex.Unlock()
	if changed && runner.client != nil {
		runner.client.CloseIdleConnections()
	}
	return nil
}
func (runner *Runner) rotate(ctx context.Context) error {
	path := filepath.Join(filepath.Dir(runner.options.Certificate), "rotation-request.json")
	request, err := prepareRotation(path, runner.options.NodeID)
	if err != nil {
		return err
	}
	body, _ := json.Marshal(map[string]string{"requestId": request.RequestID, "csr": request.CSR})
	raw, err := runner.request(ctx, "POST", "/agent/v2/credentials/rotate", body, true)
	if err != nil {
		return err
	}
	if _, err := contracts.ParseJSON(raw, 32768); err != nil {
		return err
	}
	var response struct {
		Certificate        string `json:"certificate"`
		CA                 string `json:"ca"`
		Fingerprint        string `json:"fingerprint"`
		ValidUntil         string `json:"validUntil"`
		OldCredentialUntil string `json:"oldCredentialUntil"`
	}
	if err := json.Unmarshal(raw, &response); err != nil {
		return err
	}
	certificate, err := tls.X509KeyPair([]byte(response.Certificate), []byte(request.PrivateKey))
	if err != nil {
		return err
	}
	leaf, err := x509.ParseCertificate(certificate.Certificate[0])
	if err != nil {
		return err
	}
	trusted, err := os.ReadFile(runner.options.CA)
	if err != nil {
		return err
	}
	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM(trusted) {
		return fmt.Errorf("Invalid Control CA")
	}
	if leaf.Subject.CommonName != runner.options.NodeID {
		return fmt.Errorf("AUTHORIZATION_DENIED: rotated Node mismatch")
	}
	hash := sha256.Sum256(leaf.Raw)
	if response.Fingerprint != hex.EncodeToString(hash[:]) {
		return fmt.Errorf("INTEGRITY_FAILURE: rotation fingerprint mismatch")
	}
	until, err := time.Parse(time.RFC3339Nano, response.ValidUntil)
	if err != nil || !until.Equal(leaf.NotAfter) {
		return fmt.Errorf("INTEGRITY_FAILURE: rotation certificate expiry mismatch")
	}
	oldUntil, err := time.Parse(time.RFC3339Nano, response.OldCredentialUntil)
	if err != nil || oldUntil.After(time.Now().Add(300*time.Second)) {
		return fmt.Errorf("INTEGRITY_FAILURE: unbounded credential overlap")
	}
	if _, err := leaf.Verify(x509.VerifyOptions{Roots: roots, KeyUsages: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth}}); err != nil {
		return err
	}
	if time.Now().After(leaf.NotAfter) {
		return fmt.Errorf("AUTHORIZATION_DENIED: expired rotated credential")
	}
	bundle, _ := json.Marshal(credentialBundle{Certificate: response.Certificate, PrivateKey: request.PrivateKey})
	if err := state.AtomicWrite(filepath.Join(filepath.Dir(runner.options.Certificate), "credential.json"), bundle); err != nil {
		return err
	}
	if err := runner.reloadCredential(); err != nil {
		return err
	}
	// Bundle is atomic; a crash before cleanup keeps the same request body for a safe replay.
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
