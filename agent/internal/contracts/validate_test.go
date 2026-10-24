package contracts

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func loadJSON(t *testing.T, path string, target any) {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(raw, target); err != nil {
		t.Fatal(err)
	}
}
func TestAuthoritativeFixture(t *testing.T) {
	type fixtureCase struct {
		Name    string
		Schema  string
		Payload json.RawMessage
	}
	var fixture struct {
		Valid   []fixtureCase
		Invalid []fixtureCase
	}
	loadJSON(t, "../../../packages/contracts/fixtures/adp-v2-direct.json", &fixture)
	for _, item := range fixture.Valid {
		t.Run("valid/"+item.Name, func(t *testing.T) {
			if err := ValidateStructure(item.Schema, item.Payload); err != nil {
				t.Fatal(err)
			}
			if _, err := ParseMessage(item.Schema, item.Payload); err != nil {
				t.Fatal(err)
			}
		})
	}
	for _, item := range fixture.Invalid {
		t.Run("invalid/"+item.Name, func(t *testing.T) {
			if err := ValidateStructure(item.Schema, item.Payload); err == nil {
				t.Fatal("structurally invalid message accepted")
			}
			if _, err := ParseMessage(item.Schema, item.Payload); err == nil {
				t.Fatal("invalid message parsed")
			}
		})
	}
}
func TestSharedConformance(t *testing.T) {
	var fixture struct {
		Cases []struct {
			Name       string
			Schema     string
			Raw        string
			Structural bool
			Semantic   bool
		}
	}
	loadJSON(t, "../../../packages/contracts/test/fixtures/conformance.json", &fixture)
	for _, item := range fixture.Cases {
		t.Run(item.Name, func(t *testing.T) {
			structural := ValidateStructure(item.Schema, []byte(item.Raw))
			if (structural == nil) != item.Structural {
				t.Fatalf("structural expected %v, got %v", item.Structural, structural)
			}
			_, semantic := ParseMessage(item.Schema, []byte(item.Raw))
			if (semantic == nil) != item.Semantic {
				t.Fatalf("semantic expected %v, got %v", item.Semantic, semantic)
			}
		})
	}
}
func TestRFC8785Vectors(t *testing.T) {
	cases := []struct {
		Raw       string
		Canonical string
	}{
		{`{"numbers":[333333333.33333329,1E30,4.50,2e-3,1e-27]}`, `{"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27]}`},
		{`{"דּ":7,"😀":6,"\u0080":3,"€":5,"1":2,"\r":1,"ö":4}`, "{\"\\r\":1,\"1\":2,\"\u0080\":3,\"ö\":4,\"€\":5,\"😀\":6,\"דּ\":7}"},
	}
	for _, item := range cases {
		var value any
		decoder := json.NewDecoder(strings.NewReader(item.Raw))
		decoder.UseNumber()
		if err := decoder.Decode(&value); err != nil {
			t.Fatal(err)
		}
		digest, err := ComputeDigest(value)
		if err != nil {
			t.Fatal(err)
		}
		sum := sha256.Sum256([]byte(item.Canonical))
		expected := "sha256:" + hex.EncodeToString(sum[:])
		if digest != expected {
			t.Fatalf("digest %s != %s", digest, expected)
		}
	}
}
func TestBoundedJSON(t *testing.T) {
	if _, err := ParseJSON([]byte("[]"), 1); err == nil {
		t.Fatal("oversized input accepted")
	}
	if _, err := ParseJSON([]byte(strings.Repeat("[", 66)+"0"+strings.Repeat("]", 66)), 1024); err == nil {
		t.Fatal("deep input accepted")
	}
	if _, err := ParseJSON([]byte{'"', 255, '"'}, 1024); err == nil {
		t.Fatal("invalid UTF-8 accepted")
	}
}
func TestPreciseTimes(t *testing.T) {
	result, err := compareTimes("2026-10-12T08:00:00.000000001Z", "2026-10-12T08:00:00.000000002Z")
	if err != nil || result != -1 {
		t.Fatalf("fractional comparison: %v, %v", result, err)
	}
	if _, err := compareTimes("2025-12-31T23:59:60Z", "2026-01-01T00:00:00Z"); err == nil {
		t.Fatal("unrepresentable leap second accepted")
	}
}
