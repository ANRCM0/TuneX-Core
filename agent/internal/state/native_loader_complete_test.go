package state

import (
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/executionstate"
)

func nativeLoaderEmpty() RuntimeJournal {
	return NativeRuntimeJournal("node", Journal{Snapshot: json.RawMessage(`null`), Fences: map[string]uint64{}, Retired: map[string]uint64{}})
}
func nativeLoaderWrite(t *testing.T, path string, key []byte, value RuntimeJournal, change func(*Journal)) {
	t.Helper()
	raw, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	outer := Journal{Snapshot: raw, Generation: value.Journal.Generation, Digest: value.Journal.Digest, Fences: value.Journal.Fences, Retired: value.Journal.Retired}
	if change != nil {
		change(&outer)
	}
	if err = Save(path, key, outer); err != nil {
		t.Fatal(err)
	}
}

func TestJournalNativeLoaderCompleteEnvelopeAuthenticationAndRepresentativeFirstErrors(t *testing.T) {
	key := bytes.Repeat([]byte{6}, 32)
	for _, vector := range []struct {
		name string
		raw  []byte
		want string
	}{
		{"syntax-before-mac", []byte(`{broken`), "INTEGRITY_FAILURE: invalid journal"},
		{"hex-before-body", []byte(`{"payload":null,"mac":"zz"}`), "INTEGRITY_FAILURE: invalid MAC"},
		{"mac-before-body", []byte(`{"payload":null,"mac":"00"}`), "INTEGRITY_FAILURE: journal MAC mismatch"},
		{"authenticated-null-body", nativeFormatEnvelope(t, key, `null`), "INTEGRITY_FAILURE: invalid journal body"},
		{"authenticated-nil-maps", nativeFormatEnvelope(t, key, `{"snapshot":null,"generation":0,"digest":"","fences":null,"retired":null}`), "INTEGRITY_FAILURE: invalid journal body"},
	} {
		t.Run(vector.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "journal")
			if err := os.WriteFile(path, vector.raw, 0600); err != nil {
				t.Fatal(err)
			}
			_, err := Load(path, key)
			if err == nil || err.Error() != vector.want {
				t.Fatalf("first error %v want %s", err, vector.want)
			}
		})
	}
	path := filepath.Join(t.TempDir(), "runtime")
	if _, err := LoadRuntimeJournal(path, key[:31], "node"); err == nil || err.Error() != "INTEGRITY_FAILURE: Runtime journal key required" {
		t.Fatal("key guard moved after file read", err)
	}
	// I-JSON traverses nested objects before authentication. A duplicate in the
	// inner native record is therefore an outer-envelope failure, not a later
	// unreachable inner-parser error.
	duplicate := `{"payload":{"snapshot":{"protocolVersion":3,"nodeId":"node","nodeId":"other"}},"mac":"zz"}`
	if err := os.WriteFile(path, []byte(duplicate), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadRuntimeJournal(path, key, "node"); err == nil || !strings.HasPrefix(err.Error(), "INTEGRITY_FAILURE: invalid Runtime journal envelope:") {
		t.Fatal("I-JSON did not precede MAC", err)
	}
}

func TestJournalNativeLoaderCompleteStrictBindingExtensionFenceAndPortPrecedence(t *testing.T) {
	key := bytes.Repeat([]byte{6}, 32)
	for _, vector := range []struct {
		name, want string
		patch      func(*RuntimeJournal)
		outer      func(*Journal)
	}{
		{"binding-before-extension", "INTEGRITY_FAILURE: Runtime journal binding differs", func(value *RuntimeJournal) {
			version := uint64(2)
			value.NodeID = "foreign"
			value.ExecutionExtension = &version
		}, nil},
		{"version-before-history", "INTEGRITY_FAILURE: Runtime journal binding differs", func(value *RuntimeJournal) { value.ProtocolVersion = 2; value.Journal.Fences["bad"] = 0 }, nil},
		{"outer-inner-before-map-validation", "INTEGRITY_FAILURE: Runtime journal binding differs", func(value *RuntimeJournal) { value.Journal.Fences["bad"] = 0 }, func(outer *Journal) { outer.Generation = 1 }},
		{"extension-before-import", "UNSUPPORTED_PROTOCOL_VERSION: Runtime journal extension", func(value *RuntimeJournal) {
			version := uint64(2)
			value.ExecutionExtension = &version
			value.ImportedTransitDigest = "invalid"
		}, nil},
		{"import-before-fence", "INTEGRITY_FAILURE: Invalid Transit import", func(value *RuntimeJournal) { value.ImportedTransitDigest = "invalid"; value.Journal.Fences["bad"] = 0 }, nil},
		{"nil-inner-map-with-empty-outer", "INTEGRITY_FAILURE: Runtime journal maps missing", func(value *RuntimeJournal) { value.Journal.Fences = nil }, func(outer *Journal) { outer.Fences = map[string]uint64{} }},
		{"physical-fence-before-zero-generation", "INTEGRITY_FAILURE: Invalid physical fence record", func(value *RuntimeJournal) { value.Journal.Fences["tcp/3"] = 0; value.Journal.Digest = "nonempty" }, nil},
		{"physical-port-before-zero-generation", "INTEGRITY_FAILURE: Invalid physical port history", func(value *RuntimeJournal) { value.Journal.Fences["tcp/70000"] = 1; value.Journal.Digest = "nonempty" }, nil},
		{"zero-generation-history", "INTEGRITY_FAILURE: Zero generation with execution history", func(value *RuntimeJournal) { value.Journal.Digest = "nonempty" }, nil},
	} {
		t.Run(vector.name, func(t *testing.T) {
			value := nativeLoaderEmpty()
			vector.patch(&value)
			path := filepath.Join(t.TempDir(), "runtime")
			nativeLoaderWrite(t, path, key, value, vector.outer)
			loaded, err := LoadRuntimeJournal(path, key, "node")
			if err == nil || err.Error() != vector.want || !reflect.DeepEqual(loaded, RuntimeJournal{}) {
				t.Fatalf("first loader refusal %#v %v want %s", loaded, err, vector.want)
			}
		})
	}
	path := filepath.Join(t.TempDir(), "runtime")
	value := nativeLoaderEmpty()
	raw, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	raw = append(raw[:len(raw)-1], []byte(`,"unexpected":true}`)...)
	if err = Save(path, key, Journal{Snapshot: raw, Generation: 1, Fences: map[string]uint64{}, Retired: map[string]uint64{}}); err != nil {
		t.Fatal(err)
	}
	if _, err = LoadRuntimeJournal(path, key, "foreign"); err == nil || !strings.HasPrefix(err.Error(), "INTEGRITY_FAILURE: invalid Runtime journal body:") {
		t.Fatal("strict unknown field did not precede outer/Node binding", err)
	}
}

func TestJournalNativeLoaderCompleteStoredSnapshotDigestIdentityAndPhysicalHistory(t *testing.T) {
	key := bytes.Repeat([]byte{6}, 32)
	for _, mode := range []string{"parse-before-identity", "identity", "physical-fence", "retired-fence"} {
		t.Run(mode, func(t *testing.T) {
			snapshot := runtimeFixture(t)
			raw, err := json.Marshal(snapshot)
			if err != nil {
				t.Fatal(err)
			}
			value := NativeRuntimeJournal(snapshot.NodeId, Journal{Snapshot: raw, Generation: snapshot.SnapshotGeneration, Digest: snapshot.SnapshotDigest, Fences: map[string]uint64{}, Retired: map[string]uint64{}})
			for _, assignment := range snapshot.Assignments {
				value.Journal.Fences[PhysicalSlotKey(assignment.Resource.Protocol, assignment.Resource.Port)] = assignment.BindingFence
			}
			want := "INTEGRITY_FAILURE: Stored physical fence differs"
			switch mode {
			case "parse-before-identity":
				value.Journal.Snapshot = json.RawMessage(`{}`)
				value.Journal.Digest = "wrong"
				want = "INTEGRITY_FAILURE: invalid persisted Snapshot:"
			case "identity":
				value.Journal.Generation++
				want = "INTEGRITY_FAILURE: Stored Snapshot differs"
			case "physical-fence":
				for slot := range value.Journal.Fences {
					value.Journal.Fences[slot] = 1
				}
				for _, assignment := range snapshot.Assignments {
					if assignment.BindingFence <= 1 {
						delete(value.Journal.Fences, PhysicalSlotKey(assignment.Resource.Protocol, assignment.Resource.Port))
					}
				}
			case "retired-fence":
				for slot, fence := range value.Journal.Fences {
					value.Journal.Retired[slot] = fence
				}
			}
			path := filepath.Join(t.TempDir(), "runtime")
			nativeLoaderWrite(t, path, key, value, nil)
			_, err = LoadRuntimeJournal(path, key, snapshot.NodeId)
			if err == nil || !strings.HasPrefix(err.Error(), want) {
				t.Fatalf("stored Snapshot %s refused at %v want %s", mode, err, want)
			}
		})
	}
	snapshot := executionFixture(t)
	raw, err := json.Marshal(snapshot)
	if err != nil {
		t.Fatal(err)
	}
	value := NativeRuntimeJournal(snapshot.NodeId, Journal{Snapshot: raw, Generation: snapshot.SnapshotGeneration, Digest: snapshot.SnapshotDigest, Fences: map[string]uint64{}, Retired: map[string]uint64{}})
	path := filepath.Join(t.TempDir(), "runtime")
	nativeLoaderWrite(t, path, key, value, nil)
	if _, err = LoadRuntimeJournal(path, key, snapshot.NodeId); err == nil || err.Error() != "INTEGRITY_FAILURE: Missing durable execution extension" {
		t.Fatal("native extension did not precede stored physical check", err)
	}
}

func TestJournalNativeLoaderCompletePreviousCodecKeepsJSONOnlyHistoryAndNativeValidationBoundary(t *testing.T) {
	codec := runtimeSnapshotCodec{}
	for _, raw := range [][]byte{[]byte(`null`), []byte(`{}`)} {
		history, err := codec.DecodePrevious(raw)
		if err != nil || !reflect.DeepEqual(history, executionstate.SnapshotHistory{}) {
			t.Fatalf("JSON-only empty prior history changed %#v %v", history, err)
		}
	}
	history, err := codec.DecodePrevious([]byte(`{"protocolVersion":2,"nodeId":"old-node","sessionEpoch":8,"snapshotGeneration":9,"snapshotDigest":"opaque","unexpected":true}`))
	if err != nil || history.NodeId != "old-node" || history.SessionEpoch != 8 || history.SnapshotGeneration != 9 || history.SnapshotDigest != "opaque" {
		t.Fatal("old JSON-only callback gained schema or protocol validation", history, err)
	}
	_, err = codec.DecodePrevious([]byte(`{broken`))
	var syntax *json.SyntaxError
	if !errors.As(err, &syntax) {
		t.Fatal("native syntax error lost its original type", err)
	}
	if codec.SupportsProtocol(2) || !codec.SupportsProtocol(3) || codec.SupportsProtocol(4) || codec.PhysicalSlotKey("opaque", 7) != "opaque/7" {
		t.Fatal("native codec predicate or slot callback changed")
	}
	actual, raw, err := (runtimeSnapshotInput{snapshot: adp3.Snapshot{}}).EncodeValidated()
	if err == nil || raw != nil || !reflect.DeepEqual(actual, executionstate.SnapshotHistory{}) {
		t.Fatal("invalid incoming Snapshot leaked history/bytes before native parser", actual, raw, err)
	}
}
