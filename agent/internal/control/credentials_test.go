package control

import (
	"crypto/x509"
	"encoding/pem"
	"os"
	"path/filepath"
	"testing"
)

func TestRotationRequestSurvivesRetryWithoutNewKeyOrCSR(t *testing.T) {
	path := filepath.Join(t.TempDir(), "rotation.json")
	first, err := prepareRotation(path, "node-a")
	if err != nil {
		t.Fatal(err)
	}
	second, err := prepareRotation(path, "node-a")
	if err != nil || first != second {
		t.Fatal("retry changed request", err)
	}
	block, _ := pem.Decode([]byte(first.CSR))
	if block == nil {
		t.Fatal("missing CSR")
	}
	csr, err := x509.ParseCertificateRequest(block.Bytes)
	if err != nil || csr.CheckSignature() != nil || csr.Subject.CommonName != "node-a" {
		t.Fatal("invalid CSR", err)
	}
	key, _ := pem.Decode([]byte(first.PrivateKey))
	if key == nil {
		t.Fatal("missing key")
	}
	if _, err := x509.ParsePKCS8PrivateKey(key.Bytes); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(`{"requestId":"a","requestId":"b"}`), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := prepareRotation(path, "node-a"); err == nil {
		t.Fatal("corrupt persisted rotation accepted")
	}
}
func TestCorruptAtomicCredentialBundleNeverFallsBack(t *testing.T) {
	directory := t.TempDir()
	options := Options{Certificate: filepath.Join(directory, "node.pem"), PrivateKey: filepath.Join(directory, "private.pem")}
	if err := os.WriteFile(filepath.Join(directory, "credential.json"), []byte(`{"certificate":"invalid","privateKey":"invalid"}`), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := loadCredential(options); err == nil {
		t.Fatal("corrupt bundle accepted")
	}
	if err := os.WriteFile(filepath.Join(directory, "credential.json"), []byte(`{"certificate":"a","certificate":"b"}`), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := loadCredential(options); err == nil {
		t.Fatal("duplicate fields accepted")
	}
}
