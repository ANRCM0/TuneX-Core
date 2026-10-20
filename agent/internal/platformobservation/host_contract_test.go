package platformobservation

import (
	"encoding/json"
	"reflect"
	"testing"

	"github.com/tunex/vnext/agent/internal/observationwire"
	"github.com/tunex/vnext/agent/internal/runtimeobservation"
)

var _ runtimeobservation.Provider[observationwire.HostResources] = Native{}

func TestHostNativeAliasAndLowerFactsHaveDistinctSerialization(t *testing.T) {
	if reflect.TypeOf(HostResources{}) != reflect.TypeOf(observationwire.HostResources{}) || reflect.TypeOf(HostResources{}) == reflect.TypeOf(runtimeobservation.HostResources{}) {
		t.Fatal("Host native alias or lower type identity changed")
	}
	typeOfFacts := reflect.TypeOf(runtimeobservation.HostResources{})
	for index := 0; index < typeOfFacts.NumField(); index++ {
		if typeOfFacts.Field(index).Tag != "" {
			t.Fatal("native serialization tags leaked into lower facts")
		}
	}
	for _, interfaces := range [][]HostNetworkInterface{nil, {}} {
		value := HostResources{Scope: "agent-os-view", CPU: HostCPUResources{Availability: "unsupported"}, Network: HostNetworkResources{Interfaces: interfaces}}
		raw, err := json.Marshal(value)
		if err != nil {
			t.Fatal(err)
		}
		var decoded struct {
			CPU     map[string]json.RawMessage `json:"cpu"`
			Network struct {
				Interfaces json.RawMessage `json:"interfaces"`
			} `json:"network"`
		}
		if err := json.Unmarshal(raw, &decoded); err != nil {
			t.Fatal(err)
		}
		if string(decoded.CPU["logicalProcessors"]) != "null" || string(decoded.CPU["totalTicks"]) != "null" {
			t.Fatal("unsupported optional CPU values omitted or defaulted")
		}
		want := "[]"
		if interfaces == nil {
			want = "null"
		}
		if string(decoded.Network.Interfaces) != want {
			t.Fatalf("nil/empty interfaces collapsed: %s", raw)
		}
	}
}
