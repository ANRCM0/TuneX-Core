package executionenrollment

import (
	"errors"
	"reflect"
	"testing"
)

type bStageEnrollmentPorts struct {
	t       *testing.T
	events  []string
	fail    string
	failure error
}

func (p *bStageEnrollmentPorts) step(name string) error {
	p.events = append(p.events, name)
	if p.fail == name {
		return p.failure
	}
	return nil
}
func (p *bStageEnrollmentPorts) RefuseExisting(cert, journal, key string) error {
	if cert != "certificate-path" || journal != "journal-path" || key != "key-path" {
		p.t.Fatal("protected paths changed")
	}
	return p.step("refuse")
}
func (p *bStageEnrollmentPorts) PrepareDirectories(root, key string) error {
	if root != "root" || key != "key-path" {
		p.t.Fatal("directory arguments changed")
	}
	return p.step("directories")
}
func (p *bStageEnrollmentPorts) PrepareCSR(root, node, private string) ([]byte, error) {
	if root != "root" || node != "node" || private != "private-path" {
		p.t.Fatal("CSR arguments changed")
	}
	return []byte("csr"), p.step("csr")
}
func (p *bStageEnrollmentPorts) ReadRoots(path string) (string, error) {
	if path != "configured-ca" {
		p.t.Fatal("configured CA path changed")
	}
	return "configured-roots", p.step("roots")
}
func (p *bStageEnrollmentPorts) ValidateCertificate(node, private, roots, cert string) error {
	if node != "node" || private != "private-path" || roots != "configured-roots" || cert != "certificate" {
		p.t.Fatal("validation used response CA or wrong identity")
	}
	return p.step("validate")
}
func (p *bStageEnrollmentPorts) ProtectionKey() ([]byte, error) {
	return []byte("protected-key"), p.step("key")
}
func (p *bStageEnrollmentPorts) AtomicWrite(path string, raw []byte) error {
	if path == "key-path" && string(raw) == "protected-key" {
		return p.step("save-key")
	}
	if path == "certificate-path" && string(raw) == "certificate" {
		return p.step("save-certificate")
	}
	p.t.Fatalf("unexpected write %s %q", path, raw)
	return nil
}
func (p *bStageEnrollmentPorts) InitializeJournal(path string, key []byte, node string) error {
	if path != "journal-path" || string(key) != "protected-key" || node != "node" {
		p.t.Fatal("journal owner arguments changed")
	}
	return p.step("journal")
}
func (p *bStageEnrollmentPorts) EncodeRequest(node, token string, csr []byte) []byte {
	if node != "node" || token != "token" || string(csr) != "csr" {
		p.t.Fatal("request inputs changed")
	}
	_ = p.step("encode")
	return []byte("request")
}
func (p *bStageEnrollmentPorts) Open(roots string) string {
	if roots != "configured-roots" {
		p.t.Fatal("wrong trust roots")
	}
	_ = p.step("open")
	return "client"
}
func (p *bStageEnrollmentPorts) Post(client, url string, body []byte) (string, error) {
	if client != "client" || url != "url" || string(body) != "request" {
		p.t.Fatal("POST arguments changed")
	}
	return "reply", p.step("post")
}
func (p *bStageEnrollmentPorts) Decode(reply string) (Credential, error) {
	if reply != "reply" {
		p.t.Fatal("reply changed")
	}
	return Credential{Certificate: "certificate", CA: "untrusted-response-ca"}, p.step("decode")
}
func (p *bStageEnrollmentPorts) CloseReply(reply string) error {
	if reply != "reply" {
		p.t.Fatal("close reply changed")
	}
	_ = p.step("close-reply")
	return errors.New("ignored-close-error")
}
func (p *bStageEnrollmentPorts) CloseIdleConnections(client string) {
	if client != "client" {
		p.t.Fatal("idle client changed")
	}
	_ = p.step("close-idle")
}

func TestEnrollmentEveryFailurePreservesOrderAndCleanup(t *testing.T) {
	full := []string{"refuse", "directories", "csr", "encode", "roots", "open", "post", "decode", "validate", "key", "save-key", "journal", "save-certificate", "completed"}
	for _, stage := range []string{"token", "refuse", "directories", "csr", "roots", "post", "decode", "validate", "key", "save-key", "journal", "save-certificate", "success"} {
		t.Run(stage, func(t *testing.T) {
			failure := errors.New("original-enrollment-failure")
			ports := &bStageEnrollmentPorts{t: t, fail: stage, failure: failure}
			host := Host[string, string, string]{Platform: ports, Channel: ports, Completed: func() { _ = ports.step("completed") }}
			token := "token"
			if stage == "token" {
				token = ""
			}
			err := host.Enroll(Options{URL: "url", NodeID: "node", CA: "configured-ca", Root: "root", KeyPath: "key-path", CertificatePath: "certificate-path", PrivatePath: "private-path", JournalPath: "journal-path"}, token)
			want := []string{}
			if stage != "token" {
				for _, event := range full {
					want = append(want, event)
					if event == stage {
						break
					}
				}
				opened, posted := false, false
				for _, event := range want {
					opened = opened || event == "open"
					posted = posted || event == "decode"
				}
				if posted {
					want = append(want, "close-reply")
				}
				if opened {
					want = append(want, "close-idle")
				}
			}
			if len(ports.events) != len(want) || len(want) > 0 && !reflect.DeepEqual(ports.events, want) {
				t.Fatalf("stage %s effects=%v, want %v", stage, ports.events, want)
			}
			if stage == "success" {
				if err != nil {
					t.Fatalf("ignored cleanup error replaced success: %v", err)
				}
			} else if stage == "token" {
				if err == nil || err.Error() != "TUNEX_ENROLLMENT_TOKEN required" {
					t.Fatalf("missing token error %v", err)
				}
			} else if !errors.Is(err, failure) {
				t.Fatalf("cleanup replaced original error: %v", err)
			}
		})
	}
}
