package adp3relay

import (
	"encoding/json"
	"os"
	"testing"
)

func TestSharedFixture(t *testing.T) {
	raw, err := os.ReadFile("../../../docs/protocol/fixtures/adp-v3-relay.json")
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
			err := Parse(item.Schema, []byte(item.Raw), nil)
			if (err == nil) != item.Valid {
				t.Fatalf("valid=%v err=%v", item.Valid, err)
			}
		})
	}
}
