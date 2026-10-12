package main

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"time"

	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/control"
	"github.com/tunex/vnext/agent/internal/state"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
func run() error {
	url := flag.String("control", "", "Trusted HTTPS Control URL")
	node := flag.String("node", "", "Node ID")
	ca := flag.String("ca", "", "Trusted Control CA")
	directory := flag.String("state", "", "Protected Agent state directory")
	journalKey := flag.String("journal-key", "", "Protected journal MAC key path, outside state directory")
	enroll := flag.Bool("enroll", false, "Exchange TUNEX_ENROLLMENT_TOKEN, then initialize state")
	rotate := flag.Bool("rotate", false, "Rotate Node key/certificate after online Hello without resetting execution state")
	flag.Parse()
	if *url == "" || *node == "" || *ca == "" || *directory == "" || *journalKey == "" || !strings.HasPrefix(*url, "https://") {
		return fmt.Errorf("control, node, ca, state and journal-key are required")
	}
	root, err := filepath.Abs(*directory)
	if err != nil {
		return err
	}
	keyPath, err := filepath.Abs(*journalKey)
	if err != nil {
		return err
	}
	if rel, err := filepath.Rel(root, keyPath); err == nil && (rel == "." || !strings.HasPrefix(rel, ".."+string(os.PathSeparator))) {
		return fmt.Errorf("Journal MAC key must be outside the state directory")
	}
	certificate := filepath.Join(root, "node.pem")
	privateKey := filepath.Join(root, "private.pem")
	journal := filepath.Join(root, "journal.json")
	if *enroll {
		return enrollment(*url, *node, *ca, root, keyPath, certificate, privateKey, journal)
	}
	release, err := state.AcquireLock(filepath.Join(root, "instance.lock"))
	if err != nil {
		return err
	}
	defer release()
	boot := make([]byte, 16)
	if _, err := rand.Read(boot); err != nil {
		return err
	}
	runner, err := control.New(control.Options{URL: *url, NodeID: *node, BootID: hex.EncodeToString(boot), CA: *ca, Certificate: certificate, PrivateKey: privateKey, Journal: journal, JournalKey: keyPath, Rotate: *rotate})
	if err != nil {
		return err
	}
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()
	return runner.Run(ctx)
}
func enrollment(url, node, ca, root, keyPath, certificatePath, privatePath, journalPath string) error {
	token := os.Getenv("TUNEX_ENROLLMENT_TOKEN")
	if token == "" {
		return fmt.Errorf("TUNEX_ENROLLMENT_TOKEN required")
	}
	for _, path := range []string{certificatePath, journalPath, keyPath} {
		if _, err := os.Stat(path); err == nil {
			return fmt.Errorf("Enrollment state exists; reinstallation requires Node retirement")
		}
	}
	if err := os.MkdirAll(root, 0700); err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(keyPath), 0700); err != nil {
		return err
	}
	var key *ecdsa.PrivateKey
	if raw, err := os.ReadFile(privatePath); err == nil {
		block, _ := pem.Decode(raw)
		if block == nil {
			return fmt.Errorf("Invalid enrollment private key")
		}
		parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
		if err != nil {
			return err
		}
		var ok bool
		key, ok = parsed.(*ecdsa.PrivateKey)
		if !ok {
			return fmt.Errorf("ECDSA enrollment key required")
		}
	} else {
		generated, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		if err != nil {
			return err
		}
		key = generated
		raw, err := x509.MarshalPKCS8PrivateKey(key)
		if err != nil {
			return err
		}
		if err := state.AtomicWrite(privatePath, pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: raw})); err != nil {
			return err
		}
	}
	csrPath := filepath.Join(root, "enrollment.csr")
	csr, csrErr := os.ReadFile(csrPath)
	if csrErr != nil {
		if !os.IsNotExist(csrErr) {
			return csrErr
		}
		request, err := x509.CreateCertificateRequest(rand.Reader, &x509.CertificateRequest{Subject: pkix.Name{CommonName: node}}, key)
		if err != nil {
			return err
		}
		csr = pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE REQUEST", Bytes: request})
		if err := state.AtomicWrite(csrPath, csr); err != nil {
			return err
		}
	}
	body, _ := json.Marshal(map[string]string{"nodeId": node, "token": token, "csr": string(csr)})
	caBytes, err := os.ReadFile(ca)
	if err != nil {
		return err
	}
	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM(caBytes) {
		return fmt.Errorf("Invalid trusted CA")
	}
	client := &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{RootCAs: roots, MinVersion: tls.VersionTLS13}}, Timeout: 10 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return fmt.Errorf("Enrollment redirects are forbidden") }}
	defer client.CloseIdleConnections()
	response, err := client.Post(strings.TrimRight(url, "/")+"/enrollment/v1", "application/json", bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer response.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(response.Body, 32769))
	if err != nil {
		return err
	}
	if response.StatusCode != 200 {
		return fmt.Errorf("Enrollment rejected with HTTP %d", response.StatusCode)
	}
	if _, err := contracts.ParseJSON(raw, 32768); err != nil {
		return err
	}
	var result struct {
		Certificate string `json:"certificate"`
		CA          string `json:"ca"`
	}
	if err := json.Unmarshal(raw, &result); err != nil {
		return err
	}
	certBlock, _ := pem.Decode([]byte(result.Certificate))
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
	if _, err := tls.X509KeyPair([]byte(result.Certificate), privateRaw); err != nil {
		return err
	}
	protection := make([]byte, 32)
	if _, err := rand.Read(protection); err != nil {
		return err
	}
	if err := state.AtomicWrite(keyPath, protection); err != nil {
		return err
	}
	if err := state.Save(journalPath, protection, state.Journal{Fences: make(map[string]uint64), Retired: make(map[string]uint64)}); err != nil {
		return err
	}
	if err := state.AtomicWrite(certificatePath, []byte(result.Certificate)); err != nil {
		return err
	}
	fmt.Println("Node enrolled; journal initialized without execution authorization")
	return nil
}
