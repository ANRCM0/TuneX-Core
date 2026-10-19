package agentenrollment

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"errors"

	"io"
	"log"
	"math/big"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/executionenrollment"
	"github.com/tunex/vnext/agent/internal/state"
)

var _ executionenrollment.Platform[*x509.CertPool] = Platform{}
var _ executionenrollment.Channel[*x509.CertPool, *http.Client, *http.Response] = Channel{}
var _ func() executionenrollment.Host[*x509.CertPool, *http.Client, *http.Response] = Native

type enrollmentCompleteBody struct {
	raw          []byte
	read, closed int
	failure      error
}

func (b *enrollmentCompleteBody) Read(p []byte) (int, error) {
	if len(b.raw) == 0 {
		if b.failure != nil {
			return 0, b.failure
		}
		return 0, io.EOF
	}
	n := copy(p, b.raw)
	b.raw = b.raw[n:]
	b.read += n
	if b.failure != nil {
		return n, b.failure
	}
	return n, nil
}
func (b *enrollmentCompleteBody) Close() error {
	b.closed++
	return errors.New("ignored native reply close")
}

type enrollmentCompleteTransport func(*http.Request) (*http.Response, error)

func (f enrollmentCompleteTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func enrollmentCompletePKI(t *testing.T, node string, usages []x509.ExtKeyUsage, expired bool) (string, string, []byte, *x509.CertPool) {
	t.Helper()
	now := time.Now()
	caKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	ca := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "configured enrollment CA"}, IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign, NotBefore: now.Add(-time.Hour), NotAfter: now.Add(time.Hour)}
	caDER, err := x509.CreateCertificate(rand.Reader, ca, ca, &caKey.PublicKey, caKey)
	if err != nil {
		t.Fatal(err)
	}
	ca, err = x509.ParseCertificate(caDER)
	if err != nil {
		t.Fatal(err)
	}
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	encoded, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	until := now.Add(time.Hour)
	if expired {
		until = now.Add(-time.Minute)
	}
	leaf := &x509.Certificate{SerialNumber: big.NewInt(2), Subject: pkix.Name{CommonName: node}, NotBefore: now.Add(-time.Hour), NotAfter: until, KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: usages}
	der, err := x509.CreateCertificate(rand.Reader, leaf, ca, &key.PublicKey, caKey)
	if err != nil {
		t.Fatal(err)
	}
	roots := x509.NewCertPool()
	roots.AddCert(ca)
	return string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})), string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: encoded})), pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: caDER}), roots
}

func TestEnrollmentNativeCompleteCSRGenerationReuseAndOriginalReadErrors(t *testing.T) {
	p := Platform{}
	root := t.TempDir()
	private := filepath.Join(root, "private.pem")
	csr, err := p.PrepareCSR(root, "node-original", private)
	if err != nil {
		t.Fatal(err)
	}
	block, _ := pem.Decode(csr)
	if block == nil {
		t.Fatal("CSR missing PEM")
	}
	request, err := x509.ParseCertificateRequest(block.Bytes)
	if err != nil || request.Subject.CommonName != "node-original" || request.CheckSignature() != nil {
		t.Fatal("generated CSR CN/signature changed", err)
	}
	raw, err := os.ReadFile(private)
	if err != nil {
		t.Fatal(err)
	}
	keyBlock, _ := pem.Decode(raw)
	key, err := x509.ParsePKCS8PrivateKey(keyBlock.Bytes)
	if err != nil {
		t.Fatal(err)
	}
	ec, ok := key.(*ecdsa.PrivateKey)
	if !ok || ec.Curve != elliptic.P256() {
		t.Fatal("native key type/curve changed")
	}
	again, err := p.PrepareCSR(root, "changed-node", private)
	after, _ := os.ReadFile(private)
	if err != nil || !bytes.Equal(again, csr) || !bytes.Equal(after, raw) {
		t.Fatal("existing CSR/private key replaced or revalidated")
	}
	opaque := []byte("original opaque existing CSR bytes\x00")
	if err := os.WriteFile(filepath.Join(root, "enrollment.csr"), opaque, 0600); err != nil {
		t.Fatal(err)
	}
	again, err = p.PrepareCSR(root, "other-node", private)
	if err != nil || !bytes.Equal(again, opaque) {
		t.Fatal("old CSR reuse acquired new hardening", err)
	}
	if err := os.Remove(filepath.Join(root, "enrollment.csr")); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(root, "enrollment.csr"), 0700); err != nil {
		t.Fatal(err)
	}
	if got, err := p.PrepareCSR(root, "node", private); got != nil || err == nil || os.IsNotExist(err) {
		t.Fatal("CSR other-read-error generated replacement", err)
	}
	for _, bad := range []struct {
		name string
		raw  []byte
		want string
	}{{"missing PEM", []byte("not PEM"), "Invalid enrollment private key"}, {"bad PKCS8", pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: []byte{1}}), ""}} {
		path := filepath.Join(t.TempDir(), "private")
		if err := os.WriteFile(path, bad.raw, 0600); err != nil {
			t.Fatal(err)
		}
		if got, err := p.PrepareCSR(filepath.Dir(path), "node", path); got != nil || err == nil || bad.want != "" && err.Error() != bad.want {
			t.Fatal("existing private-key refusal changed", bad.name, err)
		}
	}
	rsaKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	rsaDER, err := x509.MarshalPKCS8PrivateKey(rsaKey)
	if err != nil {
		t.Fatal(err)
	}
	rsaPath := filepath.Join(t.TempDir(), "private")
	if err := os.WriteFile(rsaPath, pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: rsaDER}), 0600); err != nil {
		t.Fatal(err)
	}
	if got, err := p.PrepareCSR(filepath.Dir(rsaPath), "node", rsaPath); got != nil || err == nil || err.Error() != "ECDSA enrollment key required" {
		t.Fatal("non-ECDSA PKCS8 accepted", err)
	}
	// Original private read errors enter generation (including a directory read),
	// unlike CSR non-ENOENT errors. The original exclusive atomic writer then refuses.
	directoryPrivate := t.TempDir()
	if got, err := p.PrepareCSR(t.TempDir(), "node", directoryPrivate); got != nil || err == nil {
		t.Fatal("private nonmissing read-error behavior changed")
	}
	dirs := t.TempDir()
	if err := p.PrepareDirectories(filepath.Join(dirs, "state"), filepath.Join(dirs, "keys", "journal.key")); err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS != "windows" {
		for _, path := range []string{filepath.Join(dirs, "state"), filepath.Join(dirs, "keys")} {
			info, err := os.Stat(path)
			if err != nil || info.Mode().Perm() != 0700 {
				t.Fatal("native directory mode", path, info, err)
			}
		}
	}
	for _, path := range []string{filepath.Join(dirs, "absent"), "bad\x00path"} {
		if err := p.RefuseExisting(path, path, path); err != nil {
			t.Fatal("original Stat-error branch changed", err)
		}
	}
	if err := p.RefuseExisting(filepath.Join(dirs, "state"), "missing", "missing"); err == nil || err.Error() != "Enrollment state exists; reinstallation requires Node retirement" {
		t.Fatal("protected existing state accepted", err)
	}
}

func TestEnrollmentNativeCompleteChannelConfigurationBoundedDecodeAndErrorOrder(t *testing.T) {
	ch := Channel{}
	roots := x509.NewCertPool()
	client := ch.Open(roots)
	transport := client.Transport.(*http.Transport)
	if client.Timeout != 10*time.Second || transport.TLSClientConfig.RootCAs != roots || transport.TLSClientConfig.MinVersion != tls.VersionTLS13 || transport.TLSClientConfig.InsecureSkipVerify {
		t.Fatal("native enrollment TLS/timeout/trust changed")
	}
	if err := client.CheckRedirect(nil, nil); err == nil || err.Error() != "Enrollment redirects are forbidden" {
		t.Fatal("redirect policy changed")
	}
	body := ch.EncodeRequest("node", "opaque token", []byte{0, 255, 'x'})
	var request map[string]string
	if err := json.Unmarshal(body, &request); err != nil || request["nodeId"] != "node" || request["token"] != "opaque token" || request["csr"] != "\x00\ufffdx" || len(request) != 3 {
		t.Fatal("native request JSON projection changed", string(body), err)
	}
	calls := 0
	sentinel := errors.New("original transport failure")
	client.Transport = enrollmentCompleteTransport(func(r *http.Request) (*http.Response, error) {
		calls++
		raw, _ := io.ReadAll(r.Body)
		if r.Method != "POST" || r.URL.String() != "https://control.invalid/base/enrollment/v1" || r.Header.Get("Content-Type") != "application/json" || !bytes.Equal(raw, body) {
			t.Fatal("native POST shape changed")
		}
		return nil, sentinel
	})
	if reply, err := ch.Post(client, "https://control.invalid/base///", body); reply != nil || !errors.Is(err, sentinel) || calls != 1 {
		t.Fatal("POST retry/error changed", err, calls)
	}
	for _, v := range []struct {
		name    string
		status  int
		raw     []byte
		failure error
		want    string
		count   int
	}{
		{"read-before-status", 403, []byte("partial"), sentinel, "", 7}, {"status-before-json", 403, []byte("{"), nil, "Enrollment rejected with HTTP 403", 1}, {"duplicate", 200, []byte(`{"certificate":"a","certificate":"b"}`), nil, "", 37}, {"type-after-IJSON", 200, []byte(`{"certificate":17}`), nil, "", 18}, {"oversize", 200, append([]byte(`{"certificate":"`), append(bytes.Repeat([]byte{'a'}, 32769), []byte(`"}`)...)...), nil, "", 32769},
	} {
		t.Run(v.name, func(t *testing.T) {
			reader := &enrollmentCompleteBody{raw: v.raw, failure: v.failure}
			got, err := ch.Decode(&http.Response{StatusCode: v.status, Body: reader})
			if err == nil || got != (executionenrollment.Credential{}) || reader.closed != 0 {
				t.Fatal("decode accepted/closed early", got, err)
			}
			if v.failure != nil && err != v.failure || v.want != "" && err.Error() != v.want {
				t.Fatal("original read/status precedence", err)
			}
			if v.name == "oversize" && reader.read != 32769 {
				t.Fatal("read bound is not 32769", reader.read)
			}
			if v.name == "duplicate" {
				_, want := contracts.ParseJSON(v.raw, 32768)
				if want == nil || err.Error() != want.Error() {
					t.Fatal("typed decode preceded IJSON", err, want)
				}
			}
		})
	}
	prefix, suffix := `{"certificate":"`, `","ca":"ignored response CA","other":true}`
	exact := []byte(prefix + strings.Repeat("a", 32768-len(prefix)-len(suffix)) + suffix)
	reader := &enrollmentCompleteBody{raw: exact}
	credential, err := ch.Decode(&http.Response{StatusCode: 200, Body: reader})
	if err != nil || reader.read != 32768 || credential.CA != "ignored response CA" || reader.closed != 0 {
		t.Fatal("exact parse cap/native unknown/response CA projection changed", err)
	}
	if err := ch.CloseReply(&http.Response{Body: reader}); err == nil || reader.closed != 1 {
		t.Fatal("native CloseReply error/result changed")
	}
}

func TestEnrollmentNativeCompleteConfiguredTrustAndCertificateRefusals(t *testing.T) {
	p := Platform{}
	certificate, private, ca, roots := enrollmentCompletePKI(t, "node", []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth}, false)
	path := filepath.Join(t.TempDir(), "private")
	if err := os.WriteFile(path, []byte(private), 0600); err != nil {
		t.Fatal(err)
	}
	if err := p.ValidateCertificate("node", path, roots, certificate); err != nil {
		t.Fatal("native configured trust baseline", err)
	}
	for _, v := range []struct {
		name, node, certificate string
		roots                   *x509.CertPool
	}{{"missing", "node", "", roots}, {"wrong-node", "other", certificate, roots}, {"untrusted", "node", certificate, x509.NewCertPool()}} {
		if err := p.ValidateCertificate(v.node, path, v.roots, v.certificate); err == nil {
			t.Fatal("native certificate refusal relaxed", v.name)
		}
	}
	for _, v := range []struct {
		usage   x509.ExtKeyUsage
		expired bool
	}{{x509.ExtKeyUsageServerAuth, false}, {x509.ExtKeyUsageClientAuth, true}} {
		cert, key, _, trusted := enrollmentCompletePKI(t, "node", []x509.ExtKeyUsage{v.usage}, v.expired)
		if err := os.WriteFile(path, []byte(key), 0600); err != nil {
			t.Fatal(err)
		}
		if err := p.ValidateCertificate("node", path, trusted, cert); err == nil {
			t.Fatal("EKU/expiry refusal relaxed")
		}
	}
	if err := os.WriteFile(path, []byte(private), 0600); err != nil {
		t.Fatal(err)
	}
	other, _, _, otherRoots := enrollmentCompletePKI(t, "node", []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth}, false)
	if err := p.ValidateCertificate("node", path, otherRoots, other); err == nil {
		t.Fatal("key-pair mismatch accepted")
	}
	caPath := filepath.Join(t.TempDir(), "ca.pem")
	if err := os.WriteFile(caPath, ca, 0600); err != nil {
		t.Fatal(err)
	}
	if got, err := p.ReadRoots(caPath); err != nil || !got.Equal(roots) {
		t.Fatal("configured CA provider changed", err)
	}
	if err := os.WriteFile(caPath, []byte("invalid CA"), 0600); err != nil {
		t.Fatal(err)
	}
	if got, err := p.ReadRoots(caPath); got != nil || err == nil || err.Error() != "Invalid trusted CA" {
		t.Fatal("invalid CA fallback", err)
	}
	protection, err := p.ProtectionKey()
	if err != nil || len(protection) != 32 {
		t.Fatal("native protection entropy size", err)
	}
	if reflect.TypeOf(Native().Platform) != reflect.TypeOf(Platform{}) || reflect.TypeOf(Native().Channel) != reflect.TypeOf(Channel{}) || Native().Completed != nil {
		t.Fatal("native generic binding changed")
	}

}

type enrollmentCompletePlatform struct {
	Platform
	fail    string
	failure error
	trace   *[]string
}

func (p enrollmentCompletePlatform) AtomicWrite(path string, raw []byte) error {
	stage := "certificate"
	if filepath.Ext(path) == ".key" {
		stage = "mac"
	}
	*p.trace = append(*p.trace, stage)
	if p.fail == stage {
		return p.failure
	}
	return p.Platform.AtomicWrite(path, raw)
}
func (p enrollmentCompletePlatform) InitializeJournal(path string, key []byte, node string) error {
	*p.trace = append(*p.trace, "journal")
	if p.fail == "journal" {
		return p.failure
	}
	return p.Platform.InitializeJournal(path, key, node)
}

type enrollmentCompleteChannel struct {
	Channel
	trace *[]string
	body  *enrollmentCompleteBody
	opens int
}

func (c *enrollmentCompleteChannel) Open(roots *x509.CertPool) *http.Client {
	c.opens++
	*c.trace = append(*c.trace, "open")
	return c.Channel.Open(roots)
}
func (c *enrollmentCompleteChannel) Post(*http.Client, string, []byte) (*http.Response, error) {
	*c.trace = append(*c.trace, "post")
	return &http.Response{StatusCode: 200, Body: c.body}, nil
}
func (c *enrollmentCompleteChannel) CloseReply(reply *http.Response) error {
	*c.trace = append(*c.trace, "reply-close")
	return c.Channel.CloseReply(reply)
}
func (c *enrollmentCompleteChannel) CloseIdleConnections(client *http.Client) {
	*c.trace = append(*c.trace, "idle-close")
	c.Channel.CloseIdleConnections(client)
}

func TestEnrollmentNativeCompleteFinalWritesRetainPartialProtectedStateAndCleanup(t *testing.T) {
	for _, stage := range []string{"ca", "mac", "journal", "certificate", "success"} {
		t.Run(stage, func(t *testing.T) {
			certificate, private, ca, _ := enrollmentCompletePKI(t, "node", []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth}, false)
			directory := t.TempDir()
			root := filepath.Join(directory, "state")
			if err := os.Mkdir(root, 0700); err != nil {
				t.Fatal(err)
			}
			options := executionenrollment.Options{URL: "https://control.invalid", NodeID: "node", Root: root, CA: filepath.Join(directory, "ca.pem"), KeyPath: filepath.Join(directory, "journal.key"), PrivatePath: filepath.Join(root, "private.pem"), CertificatePath: filepath.Join(root, "node.pem"), JournalPath: filepath.Join(root, "journal.json")}
			if err := os.WriteFile(options.PrivatePath, []byte(private), 0600); err != nil {
				t.Fatal(err)
			}
			originalCSR := []byte("pending original reusable CSR")
			if err := os.WriteFile(filepath.Join(root, "enrollment.csr"), originalCSR, 0600); err != nil {
				t.Fatal(err)
			}
			if stage == "ca" {
				ca = []byte("invalid configured CA")
			}
			if err := os.WriteFile(options.CA, ca, 0600); err != nil {
				t.Fatal(err)
			}
			var trace []string
			failure := errors.New("native final write boundary")
			p := enrollmentCompletePlatform{fail: stage, failure: failure, trace: &trace}
			reply, _ := json.Marshal(map[string]string{"certificate": certificate, "ca": "malformed response CA must be ignored"})
			body := &enrollmentCompleteBody{raw: reply}
			channel := &enrollmentCompleteChannel{trace: &trace, body: body}
			completed := 0
			host := executionenrollment.Host[*x509.CertPool, *http.Client, *http.Response]{Platform: p, Channel: channel, Completed: func() {
				trace = append(trace, "completed")
				completed++
				if body.closed != 0 {
					t.Fatal("reply closed before publication/completion")
				}
			}}
			err := host.Enroll(options, "token")
			want := []string{"open", "post", "mac", "journal", "certificate", "completed", "reply-close", "idle-close"}
			switch stage {
			case "ca":
				want = nil
				if err == nil || err.Error() != "Invalid trusted CA" || channel.opens != 0 {
					t.Fatal("CA failure reached HTTP/fallback", err)
				}
			case "mac":
				want = []string{"open", "post", "mac", "reply-close", "idle-close"}
			case "journal":
				want = []string{"open", "post", "mac", "journal", "reply-close", "idle-close"}
			case "certificate":
				want = []string{"open", "post", "mac", "journal", "certificate", "reply-close", "idle-close"}
			}
			if !reflect.DeepEqual(trace, want) || (err == nil) != (stage == "success") || stage != "ca" && stage != "success" && err != failure || completed != boolEnrollmentComplete(stage == "success") {
				t.Fatal("original final writes/cleanup error identity", trace, want, err)
			}
			for _, v := range []struct {
				path   string
				exists bool
			}{{options.KeyPath, stage == "journal" || stage == "certificate" || stage == "success"}, {options.JournalPath, stage == "certificate" || stage == "success"}, {options.CertificatePath, stage == "success"}} {
				_, readErr := os.Stat(v.path)
				if (readErr == nil) != v.exists {
					t.Fatal("native partial publication state changed", v.path, v.exists, readErr)
				}
			}
			if stage == "certificate" || stage == "success" {
				key, readErr := os.ReadFile(options.KeyPath)
				if readErr != nil || len(key) != 32 {
					t.Fatal("native MAC key publication", readErr)
				}
				journal, readErr := state.LoadRuntimeJournal(options.JournalPath, key, "node")
				if readErr != nil || journal.Journal.Generation != 0 {
					t.Fatal("original sole Runtime Journal initialization", readErr)
				}
			}
			before := append([]string(nil), trace...)
			retryErr := (Platform{}).RefuseExisting(options.CertificatePath, options.JournalPath, options.KeyPath)
			if (retryErr != nil) != (stage == "journal" || stage == "certificate" || stage == "success") {
				t.Fatal("partial protected-state retry refusal changed", retryErr)
			}
			if retryErr != nil {
				if err := host.Enroll(options, "token"); err == nil || err.Error() != "Enrollment state exists; reinstallation requires Node retirement" || !reflect.DeepEqual(trace, before) {
					t.Fatal("retry repaired protected state or performed later effects", err)
				}
			}
			csr, _ := os.ReadFile(filepath.Join(root, "enrollment.csr"))
			keyPEM, _ := os.ReadFile(options.PrivatePath)
			if !bytes.Equal(csr, originalCSR) || string(keyPEM) != private {
				t.Fatal("pending key/CSR changed by publication or refusal")
			}
		})
	}
}
func boolEnrollmentComplete(value bool) int {
	if value {
		return 1
	}
	return 0
}

type enrollmentCompleteEntropyFailure struct{ failure error }

func (r enrollmentCompleteEntropyFailure) Read([]byte) (int, error) { return 0, r.failure }
func TestEnrollmentNativeCompleteEntropyFailureUsesActualGoFatalBoundary(t *testing.T) {
	// Go 1.26's rand.Read never returns an error. Its irrecoverable failure is
	// isolated in a child; a fake ordinary error here would invent native behavior.
	if os.Getenv("TUNEX_ENROLLMENT_ENTROPY_FATAL") == "1" {
		rand.Reader = enrollmentCompleteEntropyFailure{errors.New("native enrollment entropy unavailable")}
		(Platform{}).ProtectionKey()
		t.Fatal("native rand.Read unexpectedly returned after entropy failure")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, os.Args[0], "-test.run=^TestEnrollmentNativeCompleteEntropyFailureUsesActualGoFatalBoundary$")
	command.Env = append(os.Environ(), "TUNEX_ENROLLMENT_ENTROPY_FATAL=1")
	raw, err := command.CombinedOutput()
	if ctx.Err() != nil || err == nil || !bytes.Contains(raw, []byte("crypto/rand: failed to read random data")) || !bytes.Contains(raw, []byte("native enrollment entropy unavailable")) {
		t.Fatal("native fatal entropy boundary changed", err, string(raw))
	}
}

func TestEnrollmentNativeCompleteActualHTTPSRootTLSNoRedirectOrRetry(t *testing.T) {
	channel := Channel{}
	var calls atomic.Int32
	var mode atomic.Value
	mode.Store("success")
	body := channel.EncodeRequest("node", "token", []byte("original CSR"))
	responder := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		raw, err := io.ReadAll(r.Body)
		if err != nil || r.Method != "POST" || r.URL.Path != "/base/enrollment/v1" || r.Header.Get("Content-Type") != "application/json" || !bytes.Equal(raw, body) || r.TLS == nil || r.TLS.Version != tls.VersionTLS13 {
			t.Error("native HTTPS request/body/TLS changed", err)
		}
		switch mode.Load().(string) {
		case "redirect":
			w.Header().Set("Location", "/unexpected")
			w.WriteHeader(http.StatusTemporaryRedirect)
		case "rejected":
			w.WriteHeader(http.StatusServiceUnavailable)
		default:
			io.WriteString(w, `{"certificate":"native certificate","ca":"ignored response CA"}`)
		}
	}))
	responder.Config.ErrorLog = log.New(io.Discard, "", 0)
	responder.TLS = &tls.Config{MinVersion: tls.VersionTLS13, MaxVersion: tls.VersionTLS13}
	responder.StartTLS()
	defer responder.Close()
	roots := x509.NewCertPool()
	roots.AddCert(responder.Certificate())
	client := channel.Open(roots)
	defer channel.CloseIdleConnections(client)
	for _, next := range []string{"success", "redirect", "rejected"} {
		mode.Store(next)
		before := calls.Load()
		reply, err := channel.Post(client, responder.URL+"/base///", body)
		if next == "redirect" {
			if err == nil || !strings.Contains(err.Error(), "Enrollment redirects are forbidden") || reply == nil || calls.Load() != before+1 {
				t.Fatal("native redirect followed/retried or changed refusal", err, calls.Load())
			}
			continue
		}
		if err != nil || reply == nil || calls.Load() != before+1 {
			t.Fatal("native HTTPS trust/request/retry changed", err, calls.Load())
		}
		credential, decodeErr := channel.Decode(reply)
		if err := channel.CloseReply(reply); err != nil {
			t.Fatal(err)
		}
		if next == "success" {
			if decodeErr != nil || credential.Certificate != "native certificate" || credential.CA != "ignored response CA" {
				t.Fatal("native HTTPS reply projection", credential, decodeErr)
			}
		} else if decodeErr == nil || decodeErr.Error() != "Enrollment rejected with HTTP 503" {
			t.Fatal("native status refusal", decodeErr)
		}
	}
	before := calls.Load()
	untrusted := channel.Open(x509.NewCertPool())
	defer channel.CloseIdleConnections(untrusted)
	if reply, err := channel.Post(untrusted, responder.URL+"/base", body); reply != nil || err == nil || calls.Load() != before {
		t.Fatal("unconfigured HTTPS CA reached native handler", err, calls.Load())
	}
	legacy := httptest.NewUnstartedServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { t.Error("native enrollment reached TLS1.2 handler") }))
	legacy.Config.ErrorLog = log.New(io.Discard, "", 0)
	legacy.TLS = &tls.Config{MinVersion: tls.VersionTLS12, MaxVersion: tls.VersionTLS12}
	legacy.StartTLS()
	defer legacy.Close()
	legacyRoots := x509.NewCertPool()
	legacyRoots.AddCert(legacy.Certificate())
	legacyClient := channel.Open(legacyRoots)
	defer channel.CloseIdleConnections(legacyClient)
	if reply, err := channel.Post(legacyClient, legacy.URL, body); reply != nil || err == nil {
		t.Fatal("native TLS1.2 enrollment was accepted", err)
	}
}

func TestEnrollmentNativeCompleteOriginalFileFailureAndJournalDelegates(t *testing.T) {
	p := Platform{}
	root := t.TempDir()
	blocker := filepath.Join(root, "not-directory")
	if err := os.WriteFile(blocker, []byte("preserved"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := p.PrepareDirectories(filepath.Join(blocker, "state"), filepath.Join(root, "keys", "key")); err == nil {
		t.Fatal("root mkdir error ignored")
	}
	if _, err := os.Stat(filepath.Join(root, "keys")); !os.IsNotExist(err) {
		t.Fatal("key directory created after root failure", err)
	}
	stateRoot := filepath.Join(root, "state")
	if err := p.PrepareDirectories(stateRoot, filepath.Join(blocker, "key")); err == nil {
		t.Fatal("key directory error ignored")
	}
	if _, err := os.Stat(stateRoot); err != nil {
		t.Fatal("original first mkdir was rolled back", err)
	}
	if roots, err := p.ReadRoots(filepath.Join(root, "absent-ca")); roots != nil || !os.IsNotExist(err) {
		t.Fatal("native missing CA error wrapped or replaced", err)
	}
	privateRoot := t.TempDir()
	csr := []byte("existing CSR is reused after creating missing private key")
	if err := os.WriteFile(filepath.Join(privateRoot, "enrollment.csr"), csr, 0600); err != nil {
		t.Fatal(err)
	}
	private := filepath.Join(privateRoot, "private.pem")
	if got, err := p.PrepareCSR(privateRoot, "node", private); err != nil || !bytes.Equal(got, csr) {
		t.Fatal("native pending CSR/private generation order changed", err)
	}
	if _, err := os.Stat(private); err != nil {
		t.Fatal("native missing private key was not generated before CSR reuse", err)
	}
	target := filepath.Join(root, "native-atomic")
	if err := p.AtomicWrite(target, []byte("first")); err != nil {
		t.Fatal(err)
	}
	if err := p.AtomicWrite(target, []byte("replacement")); err != nil {
		t.Fatal("original atomic overwrite acquired a new refusal", err)
	}
	if got, _ := os.ReadFile(target); string(got) != "replacement" {
		t.Fatal("native state delegate bytes changed")
	}
	if err := p.AtomicWrite(t.TempDir(), []byte("refused")); err == nil {
		t.Fatal("native rename failure hidden")
	}
	protected := filepath.Join(root, "protected-journal")
	original := []byte("protected existing history")
	if err := os.WriteFile(protected, original, 0600); err != nil {
		t.Fatal(err)
	}
	if err := p.InitializeJournal(protected, bytes.Repeat([]byte{1}, 32), "node"); err == nil {
		t.Fatal("native Journal delegate reset existing history")
	}
	if got, _ := os.ReadFile(protected); !bytes.Equal(got, original) {
		t.Fatal("native Journal delegate changed protected bytes")
	}
}
