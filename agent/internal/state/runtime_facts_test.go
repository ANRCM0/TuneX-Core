package state

import (
	"encoding/json"
	"reflect"
	"testing"
)

func TestRuntimeFactsPreserveRawStorageAndReferences(t *testing.T) {
	for _, name := range []string{"nil", "empty", "invalid", "valid"} {
		t.Run(name, func(t *testing.T) {
			var raw json.RawMessage
			switch name {
			case "empty":
				raw = make([]byte, 0, 8)
			case "invalid":
				raw = make([]byte, 3, 9)
				copy(raw, []byte{0xff, 0, 0x80})
			case "valid":
				raw = make([]byte, 2, 9)
				copy(raw, []byte("{}"))
			}
			extension := uint64(17)
			original := RuntimeJournal{ProtocolVersion: 99, NodeID: "node", ExecutionExtension: &extension, ImportedTransitDigest: "imported",
				Journal: Journal{Snapshot: raw, Generation: 23, Digest: "digest", Fences: map[string]uint64{"slot": 29}, Retired: map[string]uint64{"retired": 31}}}
			facts := RuntimeJournalFacts(original)
			back := RuntimeJournalFromFacts(facts)
			if !reflect.DeepEqual(back, original) || (facts.Journal.Snapshot == nil) != (raw == nil) || len(facts.Journal.Snapshot) != len(raw) || cap(facts.Journal.Snapshot) != cap(raw) ||
				cap(back.Journal.Snapshot) != cap(raw) || facts.ExecutionExtension != &extension || back.ExecutionExtension != &extension {
				t.Fatalf("projection changed shape/metadata: %#v -> %#v -> %#v", original, facts, back)
			}
			facts.Journal.Fences["slot"] = 41
			back.Journal.Retired["retired"] = 43
			if original.Journal.Fences["slot"] != 41 || facts.Journal.Retired["retired"] != 43 {
				t.Fatal("map identity lost")
			}
			if cap(raw) > 0 {
				// Extending an empty slice also checks backing identity, not only len/cap.
				facts.Journal.Snapshot[:cap(raw)][0] = 0x7f
				if raw[:cap(raw)][0] != 0x7f || back.Journal.Snapshot[:cap(raw)][0] != 0x7f {
					t.Fatal("raw backing array copied")
				}
			}
		})
	}
	zero := RuntimeJournalFromFacts(RuntimeJournalFacts(RuntimeJournal{}))
	if !reflect.DeepEqual(zero, RuntimeJournal{}) {
		t.Fatalf("zero projection inserted defaults: %#v", zero)
	}
	nativeType := reflect.TypeOf(RuntimeJournal{})
	factsType := reflect.TypeOf(RuntimeJournalFacts(RuntimeJournal{}))
	if nativeType == factsType || factsType.Field(0).Tag != "" {
		t.Fatal("lower facts regained native identity or serialization tags")
	}
}

func TestRuntimeNativeFieldOrderAndRawJSONSemantics(t *testing.T) {
	for _, vector := range []struct {
		name     string
		raw      json.RawMessage
		expected string
		invalid  bool
	}{
		{"nil", nil, `{"protocolVersion":3,"nodeId":"node","journal":{"snapshot":null,"generation":0,"digest":"","fences":null,"retired":null}}`, false},
		{"null", json.RawMessage(`null`), `{"protocolVersion":3,"nodeId":"node","journal":{"snapshot":null,"generation":0,"digest":"","fences":null,"retired":null}}`, false},
		{"object", json.RawMessage(`{"z":1,"a":2}`), `{"protocolVersion":3,"nodeId":"node","journal":{"snapshot":{"z":1,"a":2},"generation":0,"digest":"","fences":null,"retired":null}}`, false},
		{"empty", json.RawMessage{}, "", true},
		{"invalid", json.RawMessage{0xff}, "", true},
	} {
		t.Run(vector.name, func(t *testing.T) {
			value := RuntimeJournal{ProtocolVersion: 3, NodeID: "node", Journal: Journal{Snapshot: vector.raw}}
			raw, err := json.Marshal(RuntimeJournalFromFacts(RuntimeJournalFacts(value)))
			if (err != nil) != vector.invalid || !vector.invalid && string(raw) != vector.expected {
				t.Fatalf("native JSON %s %v, want %s invalid=%v", raw, err, vector.expected, vector.invalid)
			}
		})
	}
}
