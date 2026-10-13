package control

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"math/big"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/relay"
	"github.com/tunex/vnext/agent/internal/state"
)

func relayTestCA(t *testing.T) (*x509.Certificate, *ecdsa.PrivateKey, *x509.CertPool) {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	ca := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "Relay test CA"}, NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour), IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign}
	raw, err := x509.CreateCertificate(rand.Reader, ca, ca, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	ca, err = x509.ParseCertificate(raw)
	if err != nil {
		t.Fatal(err)
	}
	roots := x509.NewCertPool()
	roots.AddCert(ca)
	return ca, key, roots
}

func signRelayTest(t *testing.T, ca *x509.Certificate, key *ecdsa.PrivateKey, request rotationRequest, node string, purposes []x509.ExtKeyUsage) relayCredentialBundle {
	t.Helper()
	block, _ := pem.Decode([]byte(request.CSR))
	csr, err := x509.ParseCertificateRequest(block.Bytes)
	if err != nil || csr.CheckSignature() != nil {
		t.Fatal("invalid request", err)
	}
	uri, _ := url.Parse("urn:tunex:node:" + node)
	leaf := &x509.Certificate{SerialNumber: big.NewInt(2), Subject: pkix.Name{CommonName: node}, NotBefore: time.Now().Add(-time.Minute), NotAfter: time.Now().Add(time.Hour).Truncate(time.Second), URIs: []*url.URL{uri}, KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: purposes, BasicConstraintsValid: true}
	raw, err := x509.CreateCertificate(rand.Reader, leaf, ca, csr.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	leaf, err = x509.ParseCertificate(raw)
	if err != nil {
		t.Fatal(err)
	}
	return relayCredentialBundle{NodeID: node, Certificate: string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: raw})), PrivateKey: request.PrivateKey, Fingerprint: relay.Fingerprint(leaf), ValidUntil: time.Now().Add(30 * time.Minute).UTC().Format(time.RFC3339Nano), CertificateNotAfter: leaf.NotAfter.UTC().Format(time.RFC3339Nano)}
}

func TestRelayCredentialPersistsRetryAndRejectsCorruptStoredBundle(t *testing.T) {
	ca, key, roots := relayTestCA(t)
	directory := t.TempDir()
	pending := filepath.Join(directory, "relay-request.json")
	rotation, err := prepareRotation(pending, "node-a")
	if err != nil {
		t.Fatal(err)
	}
	bundle := signRelayTest(t, ca, key, rotation, "node-a", []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth})
	attempt := 0
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/agent/v3/relay-credential" || r.Header.Get("X-TuneX-Session-Epoch") != "2" {
			t.Error("request is not session bound")
			w.WriteHeader(400)
			return
		}
		var input struct {
			RequestID string `json:"requestId"`
			CSR       string `json:"csr"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			t.Error(err)
		}
		if input.RequestID != rotation.RequestID || input.CSR != rotation.CSR {
			t.Error("retry changed CSR or key")
		}
		attempt++
		if attempt == 1 {
			w.WriteHeader(503)
			return
		}
		json.NewEncoder(w).Encode(relayCredentialResponse{NodeID: bundle.NodeID, Certificate: bundle.Certificate, Fingerprint: strings.TrimPrefix(bundle.Fingerprint, "sha256:"), ValidUntil: bundle.ValidUntil, CertificateNotAfter: bundle.CertificateNotAfter})
	}))
	defer server.Close()
	runner := &Runner{options: Options{URL: server.URL, NodeID: "node-a", Relay: true, Certificate: filepath.Join(directory, "node.pem")}, hello: adp3.HelloResponse{SessionEpoch: 2}, client: server.Client(), roots: roots, key: bytes.Repeat([]byte{9}, 32)}
	if err := runner.ensureRelayCredential(context.Background()); err == nil {
		t.Fatal("failed issuance accepted")
	}
	if err := runner.ensureRelayCredential(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(pending); !os.IsNotExist(err) {
		t.Fatal("request not removed after durable bundle")
	}
	if _, until, err := runner.relayIdentity(); err != nil || until.IsZero() {
		t.Fatal("Relay identity not loaded", err)
	}
	if err := runner.ensureRelayCredential(context.Background()); err != nil || attempt != 2 {
		t.Fatal("restart issued another identity", err)
	}
	path := filepath.Join(directory, "relay-credential.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	altered := bytes.ReplaceAll(raw, []byte(bundle.ValidUntil), []byte(time.Now().Add(50*time.Minute).UTC().Format(time.RFC3339Nano)))
	if err := os.WriteFile(path, altered, 0600); err != nil {
		t.Fatal(err)
	}
	if err := runner.ensureRelayCredential(context.Background()); err == nil || attempt != 2 {
		t.Fatal("modified effective expiry accepted or reissued")
	}
	if err := os.WriteFile(path, []byte(`{"certificate":"bad","certificate":"other"}`), 0600); err != nil {
		t.Fatal(err)
	}
	if err := runner.ensureRelayCredential(context.Background()); err == nil || attempt != 2 {
		t.Fatal("corrupt state replaced through issuance")
	}
}

func TestRelayCredentialChecksNodePurposeKeyPinsAndEffectiveExpiry(t *testing.T) {
	ca, key, roots := relayTestCA(t)
	request, err := prepareRotation(filepath.Join(t.TempDir(), "request.json"), "node-a")
	if err != nil {
		t.Fatal(err)
	}
	bundle := signRelayTest(t, ca, key, request, "node-a", []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth})
	if _, _, err := validateRelayBundle(bundle, "node-a", roots); err != nil {
		t.Fatal(err)
	}
	for _, change := range []func(*relayCredentialBundle){
		func(b *relayCredentialBundle) { b.NodeID = "node-b" },
		func(b *relayCredentialBundle) { b.Fingerprint = "sha256:" + strings.Repeat("f", 64) },
		func(b *relayCredentialBundle) { b.PrivateKey = "wrong-key" },
		func(b *relayCredentialBundle) {
			b.ValidUntil = time.Now().Add(-time.Second).UTC().Format(time.RFC3339Nano)
		},
		func(b *relayCredentialBundle) {
			b.ValidUntil = time.Now().Add(2 * time.Hour).UTC().Format(time.RFC3339Nano)
		},
		func(b *relayCredentialBundle) {
			b.CertificateNotAfter = time.Now().Add(2 * time.Hour).UTC().Format(time.RFC3339Nano)
		},
	} {
		changed := bundle
		change(&changed)
		if _, _, err := validateRelayBundle(changed, "node-a", roots); err == nil {
			t.Fatal("invalid peer bundle accepted")
		}
	}
	clientOnly := signRelayTest(t, ca, key, request, "node-a", []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth})
	if _, _, err := validateRelayBundle(clientOnly, "node-a", roots); err == nil {
		t.Fatal("machine-only leaf accepted as Relay")
	}
}

func TestRelayRenewalPreservesOldIdentityUntilDurableRetryAndCleansCrashRequest(t *testing.T) {
	ca, key, roots := relayTestCA(t)
	directory := t.TempDir()
	oldRequest, err := prepareRotation(filepath.Join(directory, "old-request.json"), "node-a")
	if err != nil {
		t.Fatal(err)
	}
	old := signRelayTest(t, ca, key, oldRequest, "node-a", []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth})
	old.ValidUntil = time.Now().Add(45 * time.Second).UTC().Format(time.RFC3339Nano)
	raw, _ := json.Marshal(old)
	protection := bytes.Repeat([]byte{8}, 32)
	path := filepath.Join(directory, "relay-credential.json")
	if err := state.Save(path, protection, state.Journal{Snapshot: raw, Fences: map[string]uint64{}, Retired: map[string]uint64{}}); err != nil {
		t.Fatal(err)
	}
	var requestID, csr string
	var response relayCredentialResponse
	attempts := 0
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var input struct {
			RequestID string `json:"requestId"`
			CSR       string `json:"csr"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			t.Error(err)
		}
		attempts++
		if attempts == 1 {
			requestID, csr = input.RequestID, input.CSR
			request, err := prepareRotation(filepath.Join(directory, "relay-request.json"), "node-a")
			if err != nil {
				t.Error(err)
				w.WriteHeader(500)
				return
			}
			next := signRelayTest(t, ca, key, request, "node-a", []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth})
			overlap := time.Now().Add(30 * time.Second).UTC().Format(time.RFC3339Nano)
			response = relayCredentialResponse{NodeID: next.NodeID, Certificate: next.Certificate, Fingerprint: strings.TrimPrefix(next.Fingerprint, "sha256:"), ValidUntil: next.ValidUntil, CertificateNotAfter: next.CertificateNotAfter, OverlapUntil: &overlap}
			w.WriteHeader(503)
			return
		}
		if input.RequestID != requestID || input.CSR != csr {
			t.Error("retry changed durable CSR")
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()
	runner := &Runner{options: Options{URL: server.URL, NodeID: "node-a", Relay: true, Certificate: filepath.Join(directory, "node.pem")}, hello: adp3.HelloResponse{SessionEpoch: 2}, client: server.Client(), roots: roots, key: protection}
	if err := runner.ensureRelayCredential(context.Background()); err != nil {
		t.Fatal(err)
	}
	if !runner.relayRenewalDue() {
		t.Fatal("near expiry did not schedule renewal")
	}
	if err := runner.renewRelayCredential(context.Background()); err == nil {
		t.Fatal("lost response accepted")
	}
	if runner.relayCertificate.Leaf == nil || relay.Fingerprint(runner.relayCertificate.Leaf) != old.Fingerprint {
		t.Fatal("failed renewal replaced live identity")
	}
	if err := runner.ensureRelayCredential(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := runner.renewRelayCredential(context.Background()); err != nil {
		t.Fatal(err)
	}
	if relay.Fingerprint(runner.relayCertificate.Leaf) == old.Fingerprint || attempts != 2 {
		t.Fatal("new identity was not persisted after exact retry")
	}
	stored, err := state.Load(path, protection)
	if err != nil {
		t.Fatal(err)
	}
	var bundle relayCredentialBundle
	if err := decodeProtectedJSON(stored.Snapshot, &bundle); err != nil {
		t.Fatal(err)
	}
	if bundle.RequestID != requestID || bundle.RenewAfter == "" {
		t.Fatal("durable renewal/cooldown facts missing")
	}
	runner.relayUntil = time.Now().Add(20 * time.Second)
	if runner.relayRenewalDue() {
		t.Fatal("overlap capacity ignored")
	}
	// Reproduce only the persistent facts of a crash after save, before unlink.
	pending, _ := json.Marshal(rotationRequest{RequestID: requestID, CSR: csr, PrivateKey: bundle.PrivateKey})
	if err := state.AtomicWrite(filepath.Join(directory, "relay-request.json"), pending); err != nil {
		t.Fatal(err)
	}
	if err := runner.ensureRelayCredential(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(directory, "relay-request.json")); !os.IsNotExist(err) {
		t.Fatal("committed request not reclaimed")
	}
	if attempts != 2 {
		t.Fatal("crash recovery reissued predecessor")
	}
}

func TestExpiredProtectedRelayBundleRequiresFreshOnlineAuthority(t *testing.T) {
	ca, key, roots := relayTestCA(t)
	directory := t.TempDir()
	oldRequest, err := prepareRotation(filepath.Join(directory, "old-request.json"), "node-a")
	if err != nil {
		t.Fatal(err)
	}
	bundle := signRelayTest(t, ca, key, oldRequest, "node-a", []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth})
	bundle.ValidUntil = time.Now().Add(-time.Second).UTC().Format(time.RFC3339Nano)
	raw, _ := json.Marshal(bundle)
	protection := bytes.Repeat([]byte{6}, 32)
	path := filepath.Join(directory, "relay-credential.json")
	if err := state.Save(path, protection, state.Journal{Snapshot: raw, Fences: map[string]uint64{}, Retired: map[string]uint64{}}); err != nil {
		t.Fatal(err)
	}
	available := false
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !available {
			w.WriteHeader(503)
			return
		}
		pending, err := prepareRotation(filepath.Join(directory, "relay-request.json"), "node-a")
		if err != nil {
			t.Error(err)
			w.WriteHeader(500)
			return
		}
		fresh := signRelayTest(t, ca, key, pending, "node-a", []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth})
		json.NewEncoder(w).Encode(relayCredentialResponse{NodeID: fresh.NodeID, Certificate: fresh.Certificate, Fingerprint: strings.TrimPrefix(fresh.Fingerprint, "sha256:"), ValidUntil: fresh.ValidUntil, CertificateNotAfter: fresh.CertificateNotAfter})
	}))
	defer server.Close()
	runner := &Runner{options: Options{URL: server.URL, NodeID: "node-a", Relay: true, Certificate: filepath.Join(directory, "node.pem")}, hello: adp3.HelloResponse{SessionEpoch: 3}, client: server.Client(), roots: roots, key: protection}
	if err := runner.ensureRelayCredential(context.Background()); err == nil {
		t.Fatal("expired cache restored offline authority")
	}
	if _, _, err := runner.relayIdentity(); err == nil {
		t.Fatal("expired key became executable")
	}
	available = true
	if err := runner.ensureRelayCredential(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, until, err := runner.relayIdentity(); err != nil || !until.After(time.Now()) {
		t.Fatal("fresh online identity not restored", err)
	}
}

func TestRelayExpiredIssuanceReplayCannotTrapOnlineRecovery(t *testing.T) {
	ca, key, roots := relayTestCA(t)
	directory := t.TempDir()
	var firstID string
	attempts := 0
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var input struct {
			RequestID string `json:"requestId"`
			CSR       string `json:"csr"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			t.Error(err)
		}
		pending, err := prepareRotation(filepath.Join(directory, "relay-request.json"), "node-a")
		if err != nil {
			t.Error(err)
			w.WriteHeader(500)
			return
		}
		attempts++
		if attempts == 1 {
			firstID = input.RequestID
		} else if input.RequestID == firstID {
			t.Error("expired committed request was reused")
		}
		next := signRelayTest(t, ca, key, pending, "node-a", []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth})
		if attempts == 1 {
			next.ValidUntil = time.Now().Add(-time.Second).UTC().Format(time.RFC3339Nano)
		}
		json.NewEncoder(w).Encode(relayCredentialResponse{NodeID: next.NodeID, Certificate: next.Certificate, Fingerprint: strings.TrimPrefix(next.Fingerprint, "sha256:"), ValidUntil: next.ValidUntil, CertificateNotAfter: next.CertificateNotAfter})
	}))
	defer server.Close()
	runner := &Runner{options: Options{URL: server.URL, NodeID: "node-a", Relay: true, Certificate: filepath.Join(directory, "node.pem")}, hello: adp3.HelloResponse{SessionEpoch: 3}, client: server.Client(), roots: roots, key: bytes.Repeat([]byte{7}, 32)}
	if err := runner.ensureRelayCredential(context.Background()); err != nil {
		t.Fatal(err)
	}
	if attempts != 2 {
		t.Fatal("online recovery did not replace expired signed replay")
	}
	if _, until, err := runner.relayIdentity(); err != nil || !until.After(time.Now()) {
		t.Fatal("expired replay became runtime authority", err)
	}
}
