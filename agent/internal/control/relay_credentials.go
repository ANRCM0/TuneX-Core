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
	RenewAfter          string `json:"renewAfter,omitempty"`
	RequestID           string `json:"requestId,omitempty"`
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
	return validateRelayBundleAt(bundle, node, roots, time.Now())
}

func validateRelayBundleAt(bundle relayCredentialBundle, node string, roots *x509.CertPool, checkedAt time.Time) (tls.Certificate, time.Time, error) {
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

func (runner *Runner) ensureRelayCredential(ctx context.Context) error {
	path := filepath.Join(filepath.Dir(runner.options.Certificate), "relay-credential.json")
	raw, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return runner.renewRelayCredential(ctx)
	}
	if err != nil {
		return err
	}
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
	var bundle relayCredentialBundle
	if err := decodeProtectedJSON(protected.Snapshot, &bundle); err != nil {
		return err
	}
	var renewAfter time.Time
	effectiveUntil, err := time.Parse(time.RFC3339Nano, bundle.ValidUntil)
	if err != nil {
		return fmt.Errorf("INTEGRITY_FAILURE: Relay effective expiry differs")
	}
	if bundle.RenewAfter != "" {
		renewAfter, err = time.Parse(time.RFC3339Nano, bundle.RenewAfter)
		if err != nil || !renewAfter.Before(effectiveUntil) {
			return fmt.Errorf("INTEGRITY_FAILURE: Relay renewal schedule differs")
		}
	}
	certificate, until, err := validateRelayBundle(bundle, runner.options.NodeID, runner.roots)
	if err != nil {
		expired, parseErr := time.Parse(time.RFC3339Nano, bundle.ValidUntil)
		if parseErr != nil || expired.After(time.Now()) {
			return err
		}
		// Historical verification proves the protected expired identity was well formed.
		// It grants no runtime authority: only authenticated online issuance can restore it.
		if _, _, historyErr := validateRelayBundleAt(bundle, runner.options.NodeID, runner.roots, expired.Add(-time.Nanosecond)); historyErr != nil {
			return historyErr
		}
		return runner.renewRelayCredential(ctx)
	}
	runner.mutex.Lock()
	runner.relayCertificate, runner.relayUntil, runner.relayRenewAfter = certificate, until, renewAfter
	runner.mutex.Unlock()
	// A crash after the durable certificate save must not issue or reload its predecessor.
	pending := filepath.Join(filepath.Dir(runner.options.Certificate), "relay-request.json")
	if raw, err := os.ReadFile(pending); err == nil && bundle.RequestID != "" {
		var request rotationRequest
		if err := decodeProtectedJSON(raw, &request); err != nil {
			return err
		}
		if request.RequestID == bundle.RequestID {
			if err := os.Remove(pending); err != nil {
				return err
			}
		}
	} else if err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func (runner *Runner) credentialRenewalLead() time.Duration {
	policy := runner.hello.Policy
	return time.Duration(max(60, policy.LeaseSeconds+2*policy.MaxClockSkewSeconds+2*policy.PollIntervalSeconds)) * time.Second
}

func (runner *Runner) relayRenewalDue() bool {
	runner.mutex.Lock()
	defer runner.mutex.Unlock()
	return !time.Now().Before(runner.relayRenewAfter) && time.Until(runner.relayUntil) <= runner.credentialRenewalLead()
}

func (runner *Runner) renewRelayCredential(ctx context.Context) error {
	return runner.renewRelayCredentialAttempt(ctx, true)
}

func (runner *Runner) renewRelayCredentialAttempt(ctx context.Context, retryExpired bool) error {
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
	bundle := relayCredentialBundle{NodeID: response.NodeID, Certificate: response.Certificate, PrivateKey: request.PrivateKey, Fingerprint: "sha256:" + response.Fingerprint, ValidUntil: response.ValidUntil, CertificateNotAfter: response.CertificateNotAfter, RequestID: request.RequestID}
	certificate, until, err := validateRelayBundle(bundle, runner.options.NodeID, runner.roots)
	if err != nil {
		expiry, parseErr := time.Parse(time.RFC3339Nano, bundle.ValidUntil)
		if retryExpired && parseErr == nil && !expiry.After(time.Now()) {
			// A committed replay may have expired while this Agent was stopped.
			// Authenticate its exact CSR/keypair/Node before discarding the pending
			// request and obtaining fresh authority; no expired bundle is executed.
			if _, _, verifyErr := validateRelayBundleAt(bundle, runner.options.NodeID, runner.roots, expiry.Add(-time.Nanosecond)); verifyErr != nil {
				return verifyErr
			}
			if err := os.Remove(pending); err != nil {
				return err
			}
			return runner.renewRelayCredentialAttempt(ctx, false)
		}
		return err
	}
	var renewAfter time.Time
	if response.OverlapUntil != nil {
		overlap, err := time.Parse(time.RFC3339Nano, *response.OverlapUntil)
		if err != nil || overlap.After(time.Now().Add(300*time.Second)) || overlap.After(until) {
			return fmt.Errorf("INTEGRITY_FAILURE: Relay overlap is not bounded")
		}
		renewAfter = overlap.Add(time.Second)
		if !renewAfter.Before(until) {
			return fmt.Errorf("AUTHORIZATION_DENIED: Relay credential cannot outlive its overlap")
		}
		bundle.RenewAfter = renewAfter.UTC().Format(time.RFC3339Nano)
	}
	bytes, _ := json.Marshal(bundle)
	if len(runner.key) != 32 {
		return fmt.Errorf("INTEGRITY_FAILURE: Relay protection key required")
	}
	path := filepath.Join(filepath.Dir(runner.options.Certificate), "relay-credential.json")
	if err := state.Save(path, runner.key, state.Journal{Snapshot: bytes, Fences: map[string]uint64{}, Retired: map[string]uint64{}}); err != nil {
		return err
	}
	if err := os.Remove(pending); err != nil && !os.IsNotExist(err) {
		return err
	}
	runner.mutex.Lock()
	runner.relayCertificate, runner.relayUntil, runner.relayRenewAfter = certificate, until, renewAfter
	runner.mutex.Unlock()
	return nil
}

func (runner *Runner) relayIdentity() (relay.Identity, time.Time, error) {
	if !runner.options.Relay || runner.relayCertificate.Leaf == nil || !time.Now().Before(runner.relayUntil) {
		return relay.Identity{}, time.Time{}, fmt.Errorf("AUTHORIZATION_DENIED: Valid Relay identity required")
	}
	return relay.Identity{Certificate: runner.relayCertificate, Roots: runner.roots}, runner.relayUntil, nil
}
