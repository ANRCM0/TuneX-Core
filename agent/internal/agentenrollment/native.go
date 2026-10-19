// Package agentenrollment retains the native effects of the original CLI enrollment.
package agentenrollment

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/executionenrollment"
	"github.com/tunex/vnext/agent/internal/state"
)

const InterfaceVersion uint64 = 1

type Platform struct{}
type Channel struct{}

func Native() executionenrollment.Host[*x509.CertPool, *http.Client, *http.Response] {
	return executionenrollment.Host[*x509.CertPool, *http.Client, *http.Response]{Platform: Platform{}, Channel: Channel{}}
}

func (Platform) RefuseExisting(certificatePath, journalPath, keyPath string) error {
	for _, path := range []string{certificatePath, journalPath, keyPath} {
		if _, err := os.Stat(path); err == nil {
			return fmt.Errorf("Enrollment state exists; reinstallation requires Node retirement")
		}
	}
	return nil
}

func (Platform) PrepareDirectories(root, keyPath string) error {
	if err := os.MkdirAll(root, 0700); err != nil {
		return err
	}
	return os.MkdirAll(filepath.Dir(keyPath), 0700)
}

func (Platform) PrepareCSR(root, node, privatePath string) ([]byte, error) {
	var key *ecdsa.PrivateKey
	if raw, err := os.ReadFile(privatePath); err == nil {
		block, _ := pem.Decode(raw)
		if block == nil {
			return nil, fmt.Errorf("Invalid enrollment private key")
		}
		parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
		if err != nil {
			return nil, err
		}
		var ok bool
		key, ok = parsed.(*ecdsa.PrivateKey)
		if !ok {
			return nil, fmt.Errorf("ECDSA enrollment key required")
		}
	} else {
		generated, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		if err != nil {
			return nil, err
		}
		key = generated
		raw, err := x509.MarshalPKCS8PrivateKey(key)
		if err != nil {
			return nil, err
		}
		if err := state.AtomicWrite(privatePath, pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: raw})); err != nil {
			return nil, err
		}
	}
	csrPath := filepath.Join(root, "enrollment.csr")
	csr, csrErr := os.ReadFile(csrPath)
	if csrErr != nil {
		if !os.IsNotExist(csrErr) {
			return nil, csrErr
		}
		request, err := x509.CreateCertificateRequest(rand.Reader, &x509.CertificateRequest{Subject: pkix.Name{CommonName: node}}, key)
		if err != nil {
			return nil, err
		}
		csr = pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE REQUEST", Bytes: request})
		if err := state.AtomicWrite(csrPath, csr); err != nil {
			return nil, err
		}
	}
	return csr, nil
}

func (Platform) ReadRoots(path string) (*x509.CertPool, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM(raw) {
		return nil, fmt.Errorf("Invalid trusted CA")
	}
	return roots, nil
}

func (Platform) ValidateCertificate(node, privatePath string, roots *x509.CertPool, certificate string) error {
	certBlock, _ := pem.Decode([]byte(certificate))
	if certBlock == nil {
		return fmt.Errorf("Invalid Node certificate")
	}
	leaf, err := x509.ParseCertificate(certBlock.Bytes)
	if err != nil {
		return err
	}
	if leaf.Subject.CommonName != node {
		return fmt.Errorf("Certificate Node identity mismatch")
	}
	if _, err := leaf.Verify(x509.VerifyOptions{Roots: roots, KeyUsages: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth}}); err != nil {
		return err
	}
	privateRaw, _ := os.ReadFile(privatePath)
	_, err = tls.X509KeyPair([]byte(certificate), privateRaw)
	return err
}

func (Platform) ProtectionKey() ([]byte, error) {
	protection := make([]byte, 32)
	if _, err := rand.Read(protection); err != nil {
		return nil, err
	}
	return protection, nil
}
func (Platform) AtomicWrite(path string, raw []byte) error { return state.AtomicWrite(path, raw) }
func (Platform) InitializeJournal(path string, key []byte, node string) error {
	return state.InitializeRuntimeJournal(path, key, node)
}

func (Channel) EncodeRequest(node, token string, csr []byte) []byte {
	body, _ := json.Marshal(map[string]string{"nodeId": node, "token": token, "csr": string(csr)})
	return body
}
func (Channel) Open(roots *x509.CertPool) *http.Client {
	return &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{RootCAs: roots, MinVersion: tls.VersionTLS13}},
		Timeout: 10 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return fmt.Errorf("Enrollment redirects are forbidden") }}
}
func (Channel) Post(client *http.Client, url string, body []byte) (*http.Response, error) {
	return client.Post(strings.TrimRight(url, "/")+"/enrollment/v1", "application/json", bytes.NewReader(body))
}
func (Channel) Decode(reply *http.Response) (executionenrollment.Credential, error) {
	raw, err := io.ReadAll(io.LimitReader(reply.Body, 32769))
	if err != nil {
		return executionenrollment.Credential{}, err
	}
	if reply.StatusCode != 200 {
		return executionenrollment.Credential{}, fmt.Errorf("Enrollment rejected with HTTP %d", reply.StatusCode)
	}
	if _, err := contracts.ParseJSON(raw, 32768); err != nil {
		return executionenrollment.Credential{}, err
	}
	var result struct {
		Certificate string `json:"certificate"`
		CA          string `json:"ca"`
	}
	if err := json.Unmarshal(raw, &result); err != nil {
		return executionenrollment.Credential{}, err
	}
	return executionenrollment.Credential{Certificate: result.Certificate, CA: result.CA}, nil
}
func (Channel) CloseReply(reply *http.Response) error    { return reply.Body.Close() }
func (Channel) CloseIdleConnections(client *http.Client) { client.CloseIdleConnections() }
