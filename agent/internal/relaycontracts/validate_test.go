package relaycontracts

import (
	"encoding/json"
	"os"
	"testing"
)

func TestSharedContract(t *testing.T) {
	raw, err := os.ReadFile("../../../docs/protocol/fixtures/native-relay-v1.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Cases []struct {
			Name   string
			Schema string
			Raw    string
			Valid  bool
		}
	}
	if err := json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}
	for _, item := range fixture.Cases {
		t.Run(item.Name, func(t *testing.T) {
			var decoded any
			err := Parse(item.Schema, []byte(item.Raw), &decoded)
			if (err == nil) != item.Valid {
				t.Fatalf("valid=%v: %v", item.Valid, err)
			}
		})
	}
}
func TestTypedControlMessage(t *testing.T) {
	raw := []byte(`{"wireVersion":1,"type":"accepted","requestId":"request-a","bindingDigest":"sha256:1111111111111111111111111111111111111111111111111111111111111111"}`)
	var accepted Accept
	if err := Parse("Accept", raw, &accepted); err != nil {
		t.Fatal(err)
	}
	if accepted.WireVersion != 1 {
		t.Fatal("typed decode failed")
	}
}

func TestTypedOpenAcceptsExactExponentCounter(t *testing.T) {
	raw, err := os.ReadFile("../../../docs/protocol/fixtures/native-relay-v1.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Cases []struct {
			Name string
			Raw  string
		}
	}
	if err := json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}
	for _, item := range fixture.Cases {
		if item.Name == "exact-exponent-counter" {
			var open Open
			if err := Parse("Open", []byte(item.Raw), &open); err != nil {
				t.Fatal(err)
			}
			if open.Binding.IngressFence != 4 {
				t.Fatal("exponent counter not normalized")
			}
			return
		}
	}
	t.Fatal("shared typed exponent case absent")
}
