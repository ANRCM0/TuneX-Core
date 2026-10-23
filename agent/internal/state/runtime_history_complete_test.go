package state

import (
	"bytes"
	"encoding/json"
	"reflect"
	"testing"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/executionstate"
)

var _ executionstate.RuntimeStore = runtimeFileStore{}
var _ executionstate.SnapshotCodec = runtimeSnapshotCodec{}
var _ executionstate.SnapshotInput = runtimeSnapshotInput{}

func TestRuntimeCompleteNativeHistoryProjectionEveryComparedField(t *testing.T) {
	extension := uint64(1)
	snapshot := adp3.Snapshot{
		NodeId: "history-node", SessionEpoch: 17, SnapshotGeneration: 23, SnapshotDigest: "history-digest", ExecutionExtension: &extension,
		Assignments: []adp3.Assignment{{AssignmentId: "assignment", ForwardId: "forward", DeploymentGeneration: 29, BindingFence: 31,
			Role: "egress", Protocol: "udp", Phase: "draining", Driver: adp3.Driver{Id: "native-driver", ConfigDigest: "configuration"},
			Resource: adp3.Resource{Address: "127.0.0.7", Port: 32004, Protocol: "tcp"}}},
		Tombstones: []adp3.Tombstone{{PhysicalProtocol: "udp", Port: 32005, BindingFence: 37}},
	}
	want := executionstate.SnapshotHistory{
		NodeId: "history-node", SessionEpoch: 17, SnapshotGeneration: 23, SnapshotDigest: "history-digest", ExecutionExtension: &extension,
		Assignments: []executionstate.ExecutionIdentity{{AssignmentId: "assignment", ForwardId: "forward", DeploymentGeneration: 29, BindingFence: 31,
			Role: "egress", Protocol: "udp", Phase: "draining", Driver: executionstate.DriverIdentity{Id: "native-driver", ConfigDigest: "configuration"},
			Resource: executionstate.PhysicalResource{Address: "127.0.0.7", Port: 32004, Protocol: "tcp"}}},
		Tombstones: []executionstate.PhysicalRetirement{{PhysicalProtocol: "udp", Port: 32005, BindingFence: 37}},
	}
	actual, err := runtimeSnapshotHistory(snapshot)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(actual, want) || actual.ExecutionExtension != snapshot.ExecutionExtension {
		t.Fatalf("history projection omitted/changed native identity: %#v", actual)
	}
	raw, err := json.Marshal(snapshot)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := (runtimeSnapshotCodec{}).DecodePrevious(raw)
	if err != nil || !reflect.DeepEqual(decoded, want) {
		t.Fatalf("native prior decode: %#v %v", decoded, err)
	}
	if empty, err := runtimeSnapshotHistory(adp3.Snapshot{}); err != nil || !reflect.DeepEqual(empty, executionstate.SnapshotHistory{}) {
		t.Fatalf("empty history gained defaults: %#v", empty)
	}
	fixture := runtimeFixture(t)
	expectedRaw, err := json.Marshal(fixture)
	if err != nil {
		t.Fatal(err)
	}
	view, encoded, err := (runtimeSnapshotInput{snapshot: fixture}).EncodeValidated()
	expectedView, projectionErr := runtimeSnapshotHistory(fixture)
	if err != nil || projectionErr != nil || !bytes.Equal(encoded, expectedRaw) || !reflect.DeepEqual(view, expectedView) {
		t.Fatalf("validated native input reconstructed bytes from history: %x %v", encoded, err)
	}
	// The view deliberately lacks complete wire fields. The exact output above
	// therefore cannot be a serialization of this decision-only projection.
	viewRaw, err := json.Marshal(view)
	if err != nil || bytes.Equal(viewRaw, encoded) {
		t.Fatal("decision view became native wire authority")
	}
}

func TestRuntimeCompletePublicProviderMethodSets(t *testing.T) {
	for _, vector := range []struct {
		actual  reflect.Type
		methods map[string]reflect.Type
	}{
		{reflect.TypeOf((*executionstate.RuntimeStore)(nil)).Elem(), map[string]reflect.Type{
			"AcquireLock": reflect.TypeOf((func() (func(), error))(nil)),
			"Load":        reflect.TypeOf((func(string) (executionstate.RuntimeJournal, error))(nil)),
			"Save":        reflect.TypeOf((func(executionstate.RuntimeJournal) error)(nil)),
		}},
		{reflect.TypeOf((*executionstate.SnapshotCodec)(nil)).Elem(), map[string]reflect.Type{
			"DecodePrevious":   reflect.TypeOf((func([]byte) (executionstate.SnapshotHistory, error))(nil)),
			"SupportsProtocol": reflect.TypeOf((func(uint64) bool)(nil)),
			"PhysicalSlotKey":  reflect.TypeOf((func(string, uint64) string)(nil)),
		}},
		{reflect.TypeOf((*executionstate.SnapshotInput)(nil)).Elem(), map[string]reflect.Type{
			"EncodeValidated": reflect.TypeOf((func() (executionstate.SnapshotHistory, []byte, error))(nil)),
		}},
	} {
		if vector.actual.NumMethod() != len(vector.methods) {
			t.Fatalf("%v method count changed", vector.actual)
		}
		for name, expected := range vector.methods {
			method, ok := vector.actual.MethodByName(name)
			if !ok || method.Type != expected {
				t.Fatalf("%v.%s changed: %v", vector.actual, name, method.Type)
			}
		}
	}
	if executionstate.InterfaceVersion != 4 {
		t.Fatalf("executionstate public version changed: %d", executionstate.InterfaceVersion)
	}
}
