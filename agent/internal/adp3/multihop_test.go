package adp3

import (
	"encoding/json"
	"os"
	"testing"
)

func TestMultihopSharedExecutionConformance(t *testing.T) {
	raw, err := os.ReadFile("../../../docs/protocol/fixtures/adp-v3-execution.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Cases []struct {
			Name, Raw string
			Valid     bool
		}
	}
	if err = json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}
	for _, item := range fixture.Cases {
		t.Run(item.Name, func(t *testing.T) {
			_, err := Parse("Snapshot", []byte(item.Raw))
			if (err == nil) != item.Valid {
				t.Fatalf("accepted=%v want=%v: %v", err == nil, item.Valid, err)
			}
		})
	}
}
