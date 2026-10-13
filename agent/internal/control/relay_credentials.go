package control

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/relay"
	"github.com/tunex/vnext/agent/internal/state"
)

type relayCredentialResponse struct {
	NodeID              string  `json:"nodeId"`
	Certificate         string  `json:"certificate"`
	CA                  string  `json:"ca"`
	Fingerprint         string  `json:"fingerprint"`
	ValidUntil          string  `json:"validUntil"`
	CertificateNotAfter string  `json:"certificateNotAfter"`
	OverlapUntil        *string `json:"overlapUntil"`
}
type relayCredentialBundle struct {
	NodeID              string `json:"nodeId"`
	Certificate         string `json:"certificate"`
	PrivateKey          string `json:"privateKey"`
	Fingerprint         string `json:"fingerprint"`
	ValidUntil          string `json:"validUntil"`
	CertificateNotAfter string `json:"certificateNotAfter"`
}

func decodeProtectedJSON(raw []byte, destination any) error {
	if _, err := contracts.ParseJSON(raw, 32768); err != nil {
		return err
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	return decoder.Decode(destination)
}

func validateRelayBundle(bundle relayCredentialBundle, node string, roots *x509.CertPool) (tls.Certificate, time.Time, error) {
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
	if err := relay.VerifyPeer(state, roots, node, []string{bundle.Fingerprint}, x509.ExtKeyUsageServerAuth, time.Now()); err != nil {
		return tls.Certificate{}, time.Time{}, err
	}
	until, err := time.Parse(time.RFC3339Nano, bundle.ValidUntil)
	if err != nil || !until.After(time.Now()) || until.After(leaf.NotAfter) {
		return tls.Certificate{}, time.Time{}, fmt.Errorf("AUTHORIZATION_DENIED: Relay execution validity refused")
	}
	notAfter, err := time.Parse(time.RFC3339Nano, bundle.CertificateNotAfter)
	if err != nil || !notAfter.Equal(leaf.NotAfter) {
		return tls.Certificate{}, time.Time{}, fmt.Errorf("INTEGRITY_FAILURE: Relay leaf expiry differs")
	}
	certificate.Leaf = leaf
	return certificate, until, nil
}

func (runner *Runner) ensureRelayCredential(ctx context.Context) error {
	path := filepath.Join(filepath.Dir(runner.options.Certificate), "relay-credential.json")
	raw, err := os.ReadFile(path)
	var bundle relayCredentialBundle
	if err == nil {
		if _, err := contracts.ParseJSON(raw, 65536); err != nil {
			return err
		}
		if len(runner.key) != 32 {
			return fmt.Errorf("INTEGRITY_FAILURE: Relay protection key required")
		}
		protected, err := state.Load(path, runner.key)
		if err != nil {
			return err
		}
		if protected.Generation != 0 || protected.Digest != "" || len(protected.Fences) != 0 || len(protected.Retired) != 0 {
			return fmt.Errorf("INTEGRITY_FAILURE: Unexpected Relay credential envelope")
		}
		if err := decodeProtectedJSON(protected.Snapshot, &bundle); err != nil {
			return err
		}
	} else {
		if !os.IsNotExist(err) {
			return err
		}
		pending := filepath.Join(filepath.Dir(runner.options.Certificate), "relay-request.json")
		request, err := prepareRotation(pending, runner.options.NodeID)
		if err != nil {
			return err
		}
		body, _ := json.Marshal(map[string]string{"requestId": request.RequestID, "csr": request.CSR})
		raw, err := runner.request(ctx, "POST", "/agent/v3/relay-credential", body, true)
		if err != nil {
			return err
		}
		var response relayCredentialResponse
		if err := decodeProtectedJSON(raw, &response); err != nil {
			return err
		}
		bundle = relayCredentialBundle{NodeID: response.NodeID, Certificate: response.Certificate, PrivateKey: request.PrivateKey, Fingerprint: "sha256:" + response.Fingerprint, ValidUntil: response.ValidUntil, CertificateNotAfter: response.CertificateNotAfter}
		if _, _, err := validateRelayBundle(bundle, runner.options.NodeID, runner.roots); err != nil {
			return err
		}
		if response.OverlapUntil != nil {
			overlap, err := time.Parse(time.RFC3339Nano, *response.OverlapUntil)
			if err != nil || overlap.After(time.Now().Add(300*time.Second)) || !overlap.After(time.Now()) {
				return fmt.Errorf("INTEGRITY_FAILURE: Relay overlap is not bounded")
			}
		}
		bytes, _ := json.Marshal(bundle)
		if len(runner.key) != 32 {
			return fmt.Errorf("INTEGRITY_FAILURE: Relay protection key required")
		}
		if err := state.Save(path, runner.key, state.Journal{Snapshot: bytes, Fences: map[string]uint64{}, Retired: map[string]uint64{}}); err != nil {
			return err
		}
		if err := os.Remove(pending); err != nil && !os.IsNotExist(err) {
			return err
		}
	}
	certificate, until, err := validateRelayBundle(bundle, runner.options.NodeID, runner.roots)
	if err != nil {
		return err
	}
	runner.mutex.Lock()
	runner.relayCertificate = certificate
	runner.relayUntil = until
	runner.mutex.Unlock()
	return nil
}

func (runner *Runner) relayIdentity() (relay.Identity, time.Time, error) {
	if !runner.options.Relay || runner.relayCertificate.Leaf == nil || !time.Now().Before(runner.relayUntil) {
		return relay.Identity{}, time.Time{}, fmt.Errorf("AUTHORIZATION_DENIED: Valid Relay identity required")
	}
	return relay.Identity{Certificate: runner.relayCertificate, Roots: runner.roots}, runner.relayUntil, nil
}
