package control

import (
	"encoding/json"
	"os"
	"reflect"
	"slices"
	"testing"
)

// The shared product catalog is declarative; it cannot register or start a driver.
func TestExecutionCatalogMatchesBuiltins(t *testing.T) {
	raw, err := os.ReadFile("../../../packages/contracts/data/native-drivers-v1.json")
	if err != nil {
		t.Fatal(err)
	}
	var catalog struct {
		Version uint64 `json:"version"`
		Drivers []struct {
			ID                     string   `json:"id"`
			SchemaVersion          uint64   `json:"assignmentSchemaVersion"`
			Roles                  []string `json:"roles"`
			Phases                 []string `json:"phases"`
			Protocols              []string `json:"businessProtocols"`
			AdvertisedCapabilities []string `json:"advertisedCapabilities"`
			AgentFlags             []string `json:"agentFlags"`
		} `json:"drivers"`
	}
	if err := json.Unmarshal(raw, &catalog); err != nil {
		t.Fatal(err)
	}
	if catalog.Version != 1 || len(catalog.Drivers) != len(builtinExecutionDrivers.ordered) {
		t.Fatal("catalog version or builtin count differs")
	}
	seen := make(map[string]bool)
	for _, item := range catalog.Drivers {
		driver, exists := builtinExecutionDrivers.byID[item.ID]
		if !exists || seen[item.ID] {
			t.Fatalf("unknown or duplicate driver: %s", item.ID)
		}
		seen[item.ID] = true
		descriptor := driver.descriptor
		if item.SchemaVersion != descriptor.schemaVersion || !reflect.DeepEqual(item.Roles, descriptor.roles) ||
			!reflect.DeepEqual(item.Phases, descriptor.phases) || !reflect.DeepEqual(item.Protocols, descriptor.protocols) ||
			!reflect.DeepEqual(item.AdvertisedCapabilities, descriptor.capabilities) ||
			slices.Contains(item.AgentFlags, "--relay") != descriptor.requiresRelay ||
			slices.Contains(item.AgentFlags, "--multihop") != descriptor.requiresMultihop {
			t.Fatalf("catalog and compiled driver declaration differ: %s", item.ID)
		}
	}
}
