package main

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
	"errors"
	"math/big"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/relay"
	"github.com/tunex/vnext/agent/internal/relaycontracts"
	"github.com/tunex/vnext/agent/internal/state"
)

type fixtureRelayCompleteCA struct {
	key   *ecdsa.PrivateKey
	leaf  *x509.Certificate
	roots *x509.CertPool
	path  string
}

func fixtureRelayCAComplete(t *testing.T) fixtureRelayCompleteCA {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	template := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "native fixture CA"}, NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour), IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign}
	raw, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	leaf, err := x509.ParseCertificate(raw)
	if err != nil {
		t.Fatal(err)
	}
	roots := x509.NewCertPool()
	roots.AddCert(leaf)
	path := filepath.Join(t.TempDir(), "ca.pem")
	if err := os.WriteFile(path, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: raw}), 0600); err != nil {
		t.Fatal(err)
	}
	return fixtureRelayCompleteCA{key, leaf, roots, path}
}
func (c fixtureRelayCompleteCA) issue(t *testing.T, node string, machine bool) (tls.Certificate, string, string) {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	uri, err := url.Parse("urn:tunex:node:" + node)
	if err != nil {
		t.Fatal(err)
	}
	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 100))
	if err != nil {
		t.Fatal(err)
	}
	usage := []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth}
	if machine {
		usage = usage[:1]
	}
	template := &x509.Certificate{SerialNumber: serial, Subject: pkix.Name{CommonName: node}, NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour), BasicConstraintsValid: true, KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: usage, URIs: []*url.URL{uri}}
	raw, err := x509.CreateCertificate(rand.Reader, template, c.leaf, &key.PublicKey, c.key)
	if err != nil {
		t.Fatal(err)
	}
	keyRaw, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	certificatePEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: raw})
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: keyRaw})
	certificate, err := tls.X509KeyPair(certificatePEM, keyPEM)
	if err != nil {
		t.Fatal(err)
	}
	certificate.Leaf, err = x509.ParseCertificate(raw)
	if err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	certificatePath, keyPath := filepath.Join(root, "leaf.pem"), filepath.Join(root, "key.pem")
	if err := os.WriteFile(certificatePath, certificatePEM, 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(keyPath, keyPEM, 0600); err != nil {
		t.Fatal(err)
	}
	return certificate, certificatePath, keyPath
}
func fixtureRelayOpenComplete(t *testing.T) (relaycontracts.Open, string) {
	t.Helper()
	open := relaycontracts.Open{WireVersion: 1, Type: "open", Action: "probe", RequestId: "current-probe", Binding: relaycontracts.Binding{ScopeId: "scope", ForwardId: "forward", IngressNodeId: "ingress", EgressNodeId: "egress", IngressAssignmentId: "ingress-assignment", EgressAssignmentId: "egress-assignment", ProfileId: "profile", ForwardRevision: 2, DeploymentGeneration: 3, IngressSessionEpoch: 4, EgressSessionEpoch: 5, IngressFence: 6, EgressFence: 7, ProfileRevision: 8, ProfileDigest: "sha256:" + strings.Repeat("a", 64)}}
	raw, err := json.Marshal(open)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "open.json")
	if err := os.WriteFile(path, raw, 0600); err != nil {
		t.Fatal(err)
	}
	return open, path
}

func TestNetworkFixtureCompleteActualRelayNegativeTLSCurrentOpenAndProtectedPriorBundle(t *testing.T) {
	ca := fixtureRelayCAComplete(t)
	serverIdentity, _, _ := ca.issue(t, "egress", false)
	client, clientPath, keyPath := ca.issue(t, "ingress", false)
	old, oldPath, oldKey := ca.issue(t, "ingress", false)
	_, machinePath, machineKey := ca.issue(t, "ingress", true)
	open, openPath := fixtureRelayOpenComplete(t)
	for _, mode := range []string{"application-reject", "machine-only", "old-tls", "protected-old-peer", "accepted-is-failure", "reply-binding-refusal"} {
		t.Run(mode, func(t *testing.T) {
			certificatePath, privatePath := clientPath, keyPath
			bundlePath, protectionPath := "", ""
			expectedPin := relay.Fingerprint(client.Leaf)
			oldTLS := mode == "old-tls"
			if mode == "machine-only" {
				certificatePath, privatePath = machinePath, machineKey
			}
			var protectedBefore []byte
			if mode == "protected-old-peer" {
				certificatePath, privatePath = "intentionally-unused", "intentionally-unused"
				bundlePath = filepath.Join(t.TempDir(), "old-relay.bundle")
				protectionPath = filepath.Join(t.TempDir(), "mac.key")
				protection := bytes.Repeat([]byte{23}, 32)
				if err := os.WriteFile(protectionPath, protection, 0600); err != nil {
					t.Fatal(err)
				}
				certificatePEM, err := os.ReadFile(oldPath)
				if err != nil {
					t.Fatal(err)
				}
				privatePEM, err := os.ReadFile(oldKey)
				if err != nil {
					t.Fatal(err)
				}
				snapshot, err := json.Marshal(map[string]string{"certificate": string(certificatePEM), "privateKey": string(privatePEM)})
				if err != nil {
					t.Fatal(err)
				}
				if err := state.Save(bundlePath, protection, state.Journal{Snapshot: snapshot, Generation: 19, Digest: "retained", Fences: map[string]uint64{"retained": 17}, Retired: map[string]uint64{"prior": 18}}); err != nil {
					t.Fatal(err)
				}
				protectedBefore, err = os.ReadFile(bundlePath)
				if err != nil {
					t.Fatal(err)
				}
				if relay.Fingerprint(old.Leaf) == expectedPin {
					t.Fatal("old credential fixture not distinct")
				}
			}
			serverConfig, err := relay.TLSConfig(serverIdentity, ca.roots, "ingress", []string{expectedPin}, true)
			if err != nil {
				t.Fatal(err)
			}
			listener, err := net.Listen("tcp4", "127.0.0.1:0")
			if err != nil {
				t.Fatal(err)
			}
			defer listener.Close()
			serverDone := make(chan error, 1)
			received := make(chan relaycontracts.Open, 1)
			go func() {
				socket, err := listener.Accept()
				if err != nil {
					serverDone <- err
					return
				}
				defer socket.Close()
				socket.SetDeadline(time.Now().Add(4 * time.Second))
				secured := tls.Server(socket, serverConfig)
				if err := secured.Handshake(); err != nil {
					serverDone <- err
					return
				}
				var actual relaycontracts.Open
				if err := relay.ReadControl(secured, "Open", &actual); err != nil {
					serverDone <- err
					return
				}
				received <- actual
				digest, err := contracts.ComputeDigest(actual.Binding)
				if err != nil {
					serverDone <- err
					return
				}
				if mode == "accepted-is-failure" || mode == "reply-binding-refusal" {
					if mode == "reply-binding-refusal" {
						digest = "sha256:" + strings.Repeat("b", 64)
					}
					err = relay.WriteControl(secured, "Accept", relaycontracts.Accept{WireVersion: 1, Type: "accepted", RequestId: actual.RequestId, BindingDigest: digest})
				} else {
					err = relay.WriteControl(secured, "Reject", relaycontracts.Reject{WireVersion: 1, Type: "rejected", RequestId: actual.RequestId, Code: "AUTHORIZATION_DENIED", Retryable: false})
				}
				serverDone <- err
			}()
			err, records := fixtureCaptureComplete(t, func() error {
				return relayNegative("127.0.0.1", listener.Addr().(*net.TCPAddr).Port, ca.path, certificatePath, privatePath, "egress", relay.Fingerprint(serverIdentity.Leaf), openPath, bundlePath, protectionPath, oldTLS)
			})
			if mode == "accepted-is-failure" {
				if err == nil || err.Error() != "Invalid identity/protocol accepted a real deployment probe" || len(records) != 0 {
					t.Fatal("fixture credited accepted negative probe", err, records)
				}
			} else if err != nil || len(records) != 1 || records[0]["rejected"] != true || records[0]["currentBinding"] != true || records[0]["oldTLS"] != oldTLS {
				t.Fatal("native negative fixture result", mode, err, records)
			}
			select {
			case serverErr := <-serverDone:
				negativeTLS := mode == "machine-only" || mode == "old-tls" || mode == "protected-old-peer"
				if negativeTLS == (serverErr == nil) {
					t.Fatal("native TLS prerequisite did not distinguish rejection stage", mode, serverErr)
				}
				if !negativeTLS {
					select {
					case actual := <-received:
						if !reflect.DeepEqual(actual, open) {
							t.Fatal("negative probe did not send exact current binding", actual, open)
						}
					default:
						t.Fatal("application rejection credited without actual current Open")
					}
				}
			case <-time.After(5 * time.Second):
				t.Fatal("native fixture peer did not terminate")
			}
			if bundlePath != "" {
				after, err := os.ReadFile(bundlePath)
				if err != nil || !bytes.Equal(after, protectedBefore) {
					t.Fatal("negative fixture mutated protected prior bundle", err)
				}
			}
		})
	}
}

func TestNetworkFixtureCompleteRelayNegativeNativePrerequisiteErrorOrder(t *testing.T) {
	ca := fixtureRelayCAComplete(t)
	_, certificate, key := ca.issue(t, "ingress", false)
	_, open := fixtureRelayOpenComplete(t)
	missing := filepath.Join(t.TempDir(), "absent")
	invalidCA := filepath.Join(t.TempDir(), "ca")
	if err := os.WriteFile(invalidCA, []byte("invalid CA"), 0600); err != nil {
		t.Fatal(err)
	}
	for _, mode := range []string{"missing-ca", "invalid-ca", "short-protection-key", "unavailable-journal", "invalid-keypair", "missing-open", "strict-open", "bad-node", "bad-pin", "no-live-listener"} {
		t.Run(mode, func(t *testing.T) {
			caPath, certPath, keyPath, openPath := ca.path, certificate, key, open
			bundle, protection := "", ""
			node, pin := "egress", "sha256:"+strings.Repeat("a", 64)
			want := ""
			switch mode {
			case "missing-ca":
				caPath = missing
			case "invalid-ca":
				caPath = invalidCA
				want = "Trusted CA required"
			case "short-protection-key":
				bundle = missing
				protection = filepath.Join(t.TempDir(), "short")
				if err := os.WriteFile(protection, make([]byte, 31), 0600); err != nil {
					t.Fatal(err)
				}
				want = "Protected old Relay key required"
			case "unavailable-journal":
				bundle = missing
				protection = filepath.Join(t.TempDir(), "key")
				if err := os.WriteFile(protection, make([]byte, 32), 0600); err != nil {
					t.Fatal(err)
				}
				want = "INTEGRITY_FAILURE:"
			case "invalid-keypair":
				certPath = missing
				want = "Fixture keypair unavailable"
			case "missing-open":
				openPath = missing
			case "strict-open":
				openPath = filepath.Join(t.TempDir(), "malformed")
				if err := os.WriteFile(openPath, []byte("{\"wireVersion\":1,\"wireVersion\":1}"), 0600); err != nil {
					t.Fatal(err)
				}
				want = "INTEGRITY_FAILURE: Duplicate JSON key"
			case "bad-node":
				node = "invalid\n"
				want = "INVALID_CONFIG: Bound Relay identity required"
			case "bad-pin":
				pin = "invalid"
				want = "INVALID_CONFIG: Invalid peer fingerprint"
			case "no-live-listener":
				want = "Live internal Relay listener required"
			}
			err, records := fixtureCaptureComplete(t, func() error {
				return relayNegative("127.0.0.1", 0, caPath, certPath, keyPath, node, pin, openPath, bundle, protection, false)
			})
			if err == nil || len(records) != 0 {
				t.Fatal("native prerequisite was credited as live rejection", mode, err, records)
			}
			if want != "" && !strings.HasPrefix(err.Error(), want) {
				t.Fatal("original prerequisite error priority", mode, err, want)
			}
			if mode == "strict-open" && err.Error() != want {
				t.Fatal("canonical strict JSON error changed", err, want)
			}
			if mode == "missing-ca" || mode == "missing-open" {
				var path *os.PathError
				if !errors.As(err, &path) || path.Path != missing {
					t.Fatal("native path error identity lost", err)
				}
			}
		})
	}
}

func TestNetworkFixtureCompleteProtectedPriorBundleStrictSnapshotAndKeypair(t *testing.T) {
	ca := fixtureRelayCAComplete(t)
	protection := bytes.Repeat([]byte{3}, 32)
	keyPath := filepath.Join(t.TempDir(), "key")
	if err := os.WriteFile(keyPath, protection, 0600); err != nil {
		t.Fatal(err)
	}
	for _, mode := range []string{"bad-mac", "duplicate-snapshot", "typed-snapshot", "bad-keypair"} {
		t.Run(mode, func(t *testing.T) {
			bundlePath := filepath.Join(t.TempDir(), "bundle")
			raw := json.RawMessage(`{"certificate":"opaque","privateKey":"opaque"}`)
			want := "Fixture keypair unavailable"
			switch mode {
			case "duplicate-snapshot":
				raw = json.RawMessage(`{"certificate":"first","certificate":"second"}`)
				want = "INTEGRITY_FAILURE: Duplicate JSON key"
			case "typed-snapshot":
				raw = json.RawMessage(`{"certificate":3,"privateKey":"opaque"}`)
				want = "json:"
			}
			if err := state.Save(bundlePath, protection, state.Journal{Snapshot: raw, Fences: map[string]uint64{}, Retired: map[string]uint64{}}); err != nil {
				t.Fatal(err)
			}
			if mode == "bad-mac" {
				if err := os.WriteFile(keyPath, bytes.Repeat([]byte{4}, 32), 0600); err != nil {
					t.Fatal(err)
				}
				defer os.WriteFile(keyPath, protection, 0600)
				want = "INTEGRITY_FAILURE: journal MAC mismatch"
			}
			err, records := fixtureCaptureComplete(t, func() error {
				return relayNegative("127.0.0.1", 0, ca.path, "unused", "unused", "egress", "sha256:"+strings.Repeat("a", 64), "unused", bundlePath, keyPath, false)
			})
			if err == nil || len(records) != 0 || !strings.HasPrefix(err.Error(), want) {
				t.Fatal("protected snapshot validation/refusal order", mode, err, records)
			}
			if mode == "duplicate-snapshot" && err.Error() != want {
				t.Fatal("canonical protected strict JSON error changed", err, want)
			}
		})
	}
}
