package agentidentity

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/tunex/vnext/agent/internal/state"
)

func TestNativeCredentialRecordsKeepEncodingAndFacts(t *testing.T) {
	machine := CredentialBundle{Certificate: "certificate", PrivateKey: "private"}
	request := RotationRequest{RequestID: "request", CSR: "csr", PrivateKey: "private"}
	overlap := "overlap"
	response := RelayResponse{NodeID: "node", Certificate: "certificate", CA: "ca", Fingerprint: "fingerprint", ValidUntil: "until", CertificateNotAfter: "notAfter", OverlapUntil: &overlap}
	relay := RelayBundle{NodeID: "node", Certificate: "certificate", PrivateKey: "private", Fingerprint: "fingerprint", ValidUntil: "until", CertificateNotAfter: "notAfter"}
	for _, vector := range []struct {
		name     string
		value    any
		expected string
	}{
		{"machine", machine, `{"certificate":"certificate","privateKey":"private"}`},
		{"request", request, `{"requestId":"request","csr":"csr","privateKey":"private"}`},
		{"response", response, `{"nodeId":"node","certificate":"certificate","ca":"ca","fingerprint":"fingerprint","validUntil":"until","certificateNotAfter":"notAfter","overlapUntil":"overlap"}`},
		{"relay", relay, `{"nodeId":"node","certificate":"certificate","privateKey":"private","fingerprint":"fingerprint","validUntil":"until","certificateNotAfter":"notAfter"}`},
	} {
		t.Run(vector.name, func(t *testing.T) {
			raw, err := json.Marshal(vector.value)
			if err != nil || string(raw) != vector.expected {
				t.Fatalf("native record encoding changed: %s, %v", raw, err)
			}
		})
	}
	if CredentialBundleFromFacts(CredentialBundleFacts(machine)) != machine || RotationRequestFromFacts(RotationRequestFacts(request)) != request ||
		RelayBundleFromFacts(RelayBundleFacts(relay)) != relay {
		t.Fatal("credential facts round trip changed values")
	}
	facts := RelayResponseFacts(response)
	if facts.OverlapUntil != response.OverlapUntil || RelayResponseFromFacts(facts) != response {
		t.Fatal("response conversion copied or lost overlap pointer")
	}
	response.OverlapUntil = nil
	if RelayResponseFacts(response).OverlapUntil != nil || RelayResponseFromFacts(RelayResponseFacts(response)) != response {
		t.Fatal("nil overlap substituted")
	}
	raw, err := json.Marshal(response)
	if err != nil || !bytes.HasSuffix(raw, []byte(`"overlapUntil":null}`)) {
		t.Fatalf("required nil overlap omitted: %s, %v", raw, err)
	}
	relay.RenewAfter, relay.RequestID = "renew", "request"
	raw, err = json.Marshal(RelayBundleFromFacts(RelayBundleFacts(relay)))
	if err != nil || string(raw) != `{"nodeId":"node","certificate":"certificate","privateKey":"private","fingerprint":"fingerprint","validUntil":"until","certificateNotAfter":"notAfter","renewAfter":"renew","requestId":"request"}` {
		t.Fatalf("optional record fields changed: %s, %v", raw, err)
	}
	lower, _ := json.Marshal(CredentialBundleFacts(machine))
	if bytes.Contains(lower, []byte(`"certificate"`)) {
		t.Fatalf("lower facts silently retain native encoding: %s", lower)
	}
}

func TestNativeProviderPersistsCredentialFactsUsingNativeRecords(t *testing.T) {
	native := Native{}
	root := t.TempDir()
	machine := CredentialBundle{Certificate: "certificate", PrivateKey: "private"}
	machinePath := filepath.Join(root, "machine.json")
	if err := native.SaveMachine(machinePath, CredentialBundleFacts(machine)); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(machinePath)
	if err != nil || string(raw) != `{"certificate":"certificate","privateKey":"private"}` {
		t.Fatalf("provider persisted lower encoding: %s, %v", raw, err)
	}
	relay := RelayBundle{NodeID: "node", Certificate: "certificate", PrivateKey: "private", Fingerprint: "fingerprint", ValidUntil: "until", CertificateNotAfter: "notAfter", RenewAfter: "renew", RequestID: "request"}
	relayPath := filepath.Join(root, "relay.json")
	key := bytes.Repeat([]byte{7}, 32)
	if err := native.SaveRelay(relayPath, key, RelayBundleFacts(relay)); err != nil {
		t.Fatal(err)
	}
	protected, err := state.Load(relayPath, key)
	if err != nil {
		t.Fatal(err)
	}
	expected, _ := json.Marshal(relay)
	if !bytes.Equal(protected.Snapshot, expected) {
		t.Fatalf("protected native snapshot differs: %s", protected.Snapshot)
	}
	facts, missing, err := native.LoadRelay(relayPath, key)
	if err != nil || missing || RelayBundleFromFacts(facts) != relay {
		t.Fatalf("provider native load changed: missing=%v err=%v", missing, err)
	}
	if _, missing, err := native.LoadRelay(filepath.Join(root, "missing.json"), key); err == nil || !missing {
		t.Fatalf("initial missing was not distinguished: missing=%v err=%v", missing, err)
	}
	if _, missing, err := native.LoadRelay(relayPath, bytes.Repeat([]byte{8}, 32)); err == nil || missing {
		t.Fatalf("MAC error treated as missing: missing=%v err=%v", missing, err)
	}
	if err := os.WriteFile(relayPath, []byte(`{"payload":{},"mac":"invalid"}`), 0600); err != nil {
		t.Fatal(err)
	}
	if _, missing, err := native.LoadRelay(relayPath, key); err == nil || missing {
		t.Fatalf("corrupt protected record treated as missing: missing=%v err=%v", missing, err)
	}
}
