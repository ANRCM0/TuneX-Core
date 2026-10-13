package adp3

import (
	"encoding/json"
	"os"
	"testing"
)

func TestSharedRuntimeFixture(t *testing.T) {
	raw, err := os.ReadFile("../../../docs/protocol/fixtures/adp-v3-runtime.json")
	if err != nil {
		t.Fatal(err)
	}
	var f struct {
		Cases []struct {
			Name, Schema, Raw string
			Valid             bool
		}
	}
	if err := json.Unmarshal(raw, &f); err != nil {
		t.Fatal(err)
	}
	for _, item := range f.Cases {
		t.Run(item.Name, func(t *testing.T) {
			_, err := Parse(item.Schema, []byte(item.Raw))
			if (err == nil) != item.Valid {
				t.Fatalf("valid=%v err=%v", item.Valid, err)
			}
		})
	}
}
