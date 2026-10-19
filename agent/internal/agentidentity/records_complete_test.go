package agentidentity

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"

	"github.com/tunex/vnext/agent/internal/executionidentity"
)

// These independent declarations pin the pre-extraction private record layout.
type bLegacyCredential struct {
	Certificate string `json:"certificate"`
	PrivateKey string `json:"privateKey"`
}
type bLegacyRotation struct {
	RequestID string `json:"requestId"`
	CSR string `json:"csr"`
	PrivateKey string `json:"privateKey"`
}
type bLegacyResponse struct {
	NodeID string `json:"nodeId"`
	Certificate string `json:"certificate"`
	CA string `json:"ca"`
	Fingerprint string `json:"fingerprint"`
	ValidUntil string `json:"validUntil"`
	CertificateNotAfter string `json:"certificateNotAfter"`
	OverlapUntil *string `json:"overlapUntil"`
}
type bLegacyRelay struct {
	NodeID string `json:"nodeId"`
	Certificate string `json:"certificate"`
	PrivateKey string `json:"privateKey"`
	Fingerprint string `json:"fingerprint"`
	ValidUntil string `json:"validUntil"`
	CertificateNotAfter string `json:"certificateNotAfter"`
	RenewAfter string `json:"renewAfter,omitempty"`
	RequestID string `json:"requestId,omitempty"`
}

func TestCredentialRecordCompleteLayoutAndEightProjections(t *testing.T) {
	if InterfaceVersion != 2 || executionidentity.InterfaceVersion != 2 {
		t.Fatal("identity interface versions changed")
	}
	cases := []struct {
		native, lower, legacy any
		toFacts, fromFacts func(any) any
	}{
		{CredentialBundle{}, executionidentity.CredentialBundle{}, bLegacyCredential{},
			func(v any) any { return CredentialBundleFacts(v.(CredentialBundle)) },
			func(v any) any { return CredentialBundleFromFacts(v.(executionidentity.CredentialBundle)) }},
		{RotationRequest{}, executionidentity.RotationRequest{}, bLegacyRotation{},
			func(v any) any { return RotationRequestFacts(v.(RotationRequest)) },
			func(v any) any { return RotationRequestFromFacts(v.(executionidentity.RotationRequest)) }},
		{RelayResponse{}, executionidentity.RelayResponse{}, bLegacyResponse{},
			func(v any) any { return RelayResponseFacts(v.(RelayResponse)) },
			func(v any) any { return RelayResponseFromFacts(v.(executionidentity.RelayResponse)) }},
		{RelayBundle{}, executionidentity.RelayBundle{}, bLegacyRelay{},
			func(v any) any { return RelayBundleFacts(v.(RelayBundle)) },
			func(v any) any { return RelayBundleFromFacts(v.(executionidentity.RelayBundle)) }},
	}
	for _, c := range cases {
		t.Run(reflect.TypeOf(c.native).Name(), func(t *testing.T) {
			nativeType, lowerType, legacyType := reflect.TypeOf(c.native), reflect.TypeOf(c.lower), reflect.TypeOf(c.legacy)
			if nativeType.PkgPath() != "github.com/tunex/vnext/agent/internal/agentidentity" || lowerType.PkgPath() != "github.com/tunex/vnext/agent/internal/executionidentity" || nativeType == lowerType {
				t.Fatal("canonical native and lower owners collapsed")
			}
			if nativeType.NumField() != legacyType.NumField() || lowerType.NumField() != legacyType.NumField() { t.Fatal("field count changed") }
			for i := 0; i < legacyType.NumField(); i++ {
				n, l, old := nativeType.Field(i), lowerType.Field(i), legacyType.Field(i)
				if n.Name != old.Name || n.Type != old.Type || n.Tag != old.Tag || n.Anonymous != old.Anonymous || l.Name != old.Name || l.Type != old.Type || l.Tag != "" {
					t.Fatalf("field %d native=%v lower=%v legacy=%v", i, n, l, old)
				}
			}
			// Test each field independently in both directions, including zero values.
			for field := -1; field < nativeType.NumField(); field++ {
				native, lower := reflect.New(nativeType).Elem(), reflect.New(lowerType).Elem()
				if field >= 0 {
					value := reflect.ValueOf("sentinel:" + nativeType.Field(field).Name)
					if native.Field(field).Kind() == reflect.Pointer { p := value.Interface().(string); value = reflect.ValueOf(&p) }
					native.Field(field).Set(value)
					lower.Field(field).Set(value)
				}
				facts, record := c.toFacts(native.Interface()), c.fromFacts(lower.Interface())
				if !reflect.DeepEqual(facts, lower.Interface()) || !reflect.DeepEqual(record, native.Interface()) { t.Fatalf("field %d projection changed", field) }
				for _, v := range []any{facts, record} {
					if field >= 0 && native.Field(field).Kind() == reflect.Pointer && reflect.ValueOf(v).Field(field).Pointer() != native.Field(field).Pointer() { t.Fatal("OverlapUntil pointer cloned") }
				}
				legacy := reflect.New(legacyType).Elem()
				for i := 0; i < legacy.NumField(); i++ { legacy.Field(i).Set(native.Field(i)) }
				got, err := json.Marshal(record); if err != nil { t.Fatal(err) }
				want, err := json.Marshal(legacy.Interface()); if err != nil { t.Fatal(err) }
				if string(got) != string(want) { t.Fatalf("private fixture bytes differ: %s / %s", got, want) }
				lowerJSON, err := json.Marshal(facts); if err != nil { t.Fatal(err) }
				if string(lowerJSON) == string(got) { t.Fatal("lower direct JSON silently became native") }
			}
		})
	}
	if reflect.TypeOf(credentialBundle{}) != reflect.TypeOf(CredentialBundle{}) || reflect.TypeOf(rotationRequest{}) != reflect.TypeOf(RotationRequest{}) || reflect.TypeOf(relayCredentialBundle{}) != reflect.TypeOf(RelayBundle{}) { t.Fatal("private fixture aliases lost native identity") }
}

func TestRelayRecordOptionalFieldsAreIndependent(t *testing.T) {
	for _, fields := range []struct { renew, request string }{{"", ""}, {"renew", ""}, {"", "request"}, {"renew", "request"}} {
		record := RelayBundle{RenewAfter: fields.renew, RequestID: fields.request}
		raw, err := json.Marshal(RelayBundleFromFacts(RelayBundleFacts(record)))
		if err != nil { t.Fatal(err) }
		if strings.Contains(string(raw), `"renewAfter":`) != (fields.renew != "") || strings.Contains(string(raw), `"requestId":`) != (fields.request != "") { t.Fatalf("independent omitempty changed: %s", raw) }
	}
}
