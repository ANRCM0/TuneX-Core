package state

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/tunex/vnext/agent/internal/executionstate"
	"github.com/tunex/vnext/agent/internal/payloadbudget"
)

func TestJournalNativeFormatCompleteExactLowerAndNativeDeclarations(t *testing.T) {
	for _, vector := range []struct {
		actual reflect.Type
		names  []string
		types  []reflect.Type
		tags   []string
	}{
		{reflect.TypeOf(executionstate.Journal{}), []string{"Snapshot", "Generation", "Digest", "Fences", "Retired"}, []reflect.Type{reflect.TypeOf([]byte(nil)), reflect.TypeOf(uint64(0)), reflect.TypeOf(""), reflect.TypeOf(map[string]uint64(nil)), reflect.TypeOf(map[string]uint64(nil))}, []string{"", "", "", "", ""}},
		{reflect.TypeOf(Journal{}), []string{"Snapshot", "Generation", "Digest", "Fences", "Retired"}, []reflect.Type{reflect.TypeOf(json.RawMessage(nil)), reflect.TypeOf(uint64(0)), reflect.TypeOf(""), reflect.TypeOf(map[string]uint64(nil)), reflect.TypeOf(map[string]uint64(nil))}, []string{`json:"snapshot"`, `json:"generation"`, `json:"digest"`, `json:"fences"`, `json:"retired"`}},
		{reflect.TypeOf(executionstate.RuntimeJournal{}), []string{"FormatVersion", "NodeID", "Journal", "ExecutionExtension", "ImportedHistoryDigest", "ResourceBudgets"}, []reflect.Type{reflect.TypeOf(uint64(0)), reflect.TypeOf(""), reflect.TypeOf(executionstate.Journal{}), reflect.TypeOf((*uint64)(nil)), reflect.TypeOf(""), reflect.TypeOf((*payloadbudget.History)(nil))}, []string{"", "", "", "", "", ""}},
		{reflect.TypeOf(RuntimeJournal{}), []string{"ProtocolVersion", "NodeID", "Journal", "ExecutionExtension", "ImportedTransitDigest", "ResourceBudgets"}, []reflect.Type{reflect.TypeOf(uint64(0)), reflect.TypeOf(""), reflect.TypeOf(Journal{}), reflect.TypeOf((*uint64)(nil)), reflect.TypeOf(""), reflect.TypeOf((*ResourceBudgetHistory)(nil))}, []string{`json:"protocolVersion"`, `json:"nodeId"`, `json:"journal"`, `json:"executionExtension,omitempty"`, `json:"importedTransitDigest,omitempty"`, `json:"resourceBudgets,omitempty"`}},
	} {
		if vector.actual.NumField() != len(vector.names) {
			t.Fatalf("%v field count", vector.actual)
		}
		for index, name := range vector.names {
			field := vector.actual.Field(index)
			if field.Name != name || field.Type != vector.types[index] || string(field.Tag) != vector.tags[index] || field.Anonymous {
				t.Fatalf("%v field %d changed: %v", vector.actual, index, field)
			}
		}
	}
	if reflect.TypeOf(Journal{}) == reflect.TypeOf(executionstate.Journal{}) || reflect.TypeOf(RuntimeJournal{}) == reflect.TypeOf(executionstate.RuntimeJournal{}) {
		t.Fatal("native and lower types collapsed")
	}
	for _, kind := range []reflect.Type{reflect.TypeOf(executionstate.Journal{}), reflect.TypeOf(executionstate.RuntimeJournal{})} {
		if kind.NumMethod() != 0 || reflect.PointerTo(kind).NumMethod() != 0 {
			t.Fatalf("lower facts gained methods/native serialization fallback: %v", kind)
		}
	}
	native := NativeRuntimeJournal("node", Journal{})
	if native.ProtocolVersion != 3 || native.NodeID != "node" || native.ExecutionExtension != nil || native.ImportedTransitDigest != "" {
		t.Fatalf("native constructor defaults %#v", native)
	}
	if PhysicalSlotKey("opaque", 7) != "opaque/7" || TransitSlotKey(7) != "tcp/7" {
		t.Fatal("native slot formatting changed")
	}
}

func nativeFormatEnvelope(t *testing.T, key []byte, payload string) []byte {
	t.Helper()
	// The oracle signs independent literal bytes, never the implementation's
	// marshaled output. This pins the absence of any MAC prefix/domain wrapper.
	mac := hmac.New(sha256.New, key)
	if _, err := mac.Write([]byte(payload)); err != nil {
		t.Fatal(err)
	}
	return []byte(`{"payload":` + payload + `,"mac":"` + hex.EncodeToString(mac.Sum(nil)) + `"}`)
}

func TestJournalNativeFormatCompleteLiteralAuthenticatedPayloadEnvelopeAndRawMessages(t *testing.T) {
	key := bytes.Repeat([]byte{7}, 32)
	for _, vector := range []struct {
		name    string
		raw     json.RawMessage
		payload string
		bad     bool
	}{
		{"nil", nil, `{"snapshot":null,"generation":5,"digest":"sha256:stored","fences":{"tcp/3":8,"udp/2":9},"retired":{}}`, false},
		{"null", json.RawMessage(`null`), `{"snapshot":null,"generation":5,"digest":"sha256:stored","fences":{"tcp/3":8,"udp/2":9},"retired":{}}`, false},
		{"ordered-object", json.RawMessage(` { "z" : 1, "a" : 2 } `), `{"snapshot":{"z":1,"a":2},"generation":5,"digest":"sha256:stored","fences":{"tcp/3":8,"udp/2":9},"retired":{}}`, false},
		{"empty", json.RawMessage{}, "", true}, {"invalid", json.RawMessage(`{broken`), "", true},
	} {
		t.Run(vector.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "journal")
			value := Journal{Snapshot: vector.raw, Generation: 5, Digest: "sha256:stored", Fences: map[string]uint64{"udp/2": 9, "tcp/3": 8}, Retired: map[string]uint64{}}
			err := Save(path, key, value)
			if vector.bad {
				if err == nil {
					t.Fatal("invalid native raw serialized")
				}
				if _, statErr := os.Stat(path); !os.IsNotExist(statErr) {
					t.Fatal("marshal failure reached persistence", statErr)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			raw, err := os.ReadFile(path)
			if err != nil || !bytes.Equal(raw, nativeFormatEnvelope(t, key, vector.payload)) {
				t.Fatalf("literal envelope changed: %s %v", raw, err)
			}
			loaded, err := Load(path, key)
			if err != nil || loaded.Generation != 5 || loaded.Fences["tcp/3"] != 8 {
				t.Fatal("literal authenticated payload load", err)
			}
			var envelopeFields struct {
				Payload json.RawMessage
				MAC     string
			}
			if err = json.Unmarshal(raw, &envelopeFields); err != nil || string(envelopeFields.Payload) != vector.payload || len(envelopeFields.MAC) != 64 {
				t.Fatal("MAC input or envelope layout changed", err)
			}
		})
	}
}

func TestJournalNativeFormatCompleteRuntimeOptionalFieldsAndTransitRemainNative(t *testing.T) {
	zero, one := uint64(0), uint64(1)
	base := RuntimeJournal{ProtocolVersion: 3, NodeID: "node", Journal: Journal{Snapshot: json.RawMessage(`null`), Fences: map[string]uint64{}, Retired: map[string]uint64{}}}
	for _, vector := range []struct {
		extension        *uint64
		imported, suffix string
	}{
		{nil, "", ""}, {&zero, "", `,"executionExtension":0`}, {&one, "", `,"executionExtension":1`}, {nil, "imported", `,"importedTransitDigest":"imported"`}, {&one, "imported", `,"executionExtension":1,"importedTransitDigest":"imported"`},
	} {
		value := base
		value.ExecutionExtension = vector.extension
		value.ImportedTransitDigest = vector.imported
		want := `{"protocolVersion":3,"nodeId":"node","journal":{"snapshot":null,"generation":0,"digest":"","fences":{},"retired":{}}` + vector.suffix + `}`
		raw, err := json.Marshal(value)
		if err != nil || string(raw) != want {
			t.Fatalf("native omitempty/order: %s %v", raw, err)
		}
		path := filepath.Join(t.TempDir(), "runtime")
		key := bytes.Repeat([]byte{4}, 32)
		if err = saveRuntimeJournal(path, key, value); err != nil {
			t.Fatal(err)
		}
		payload := `{"snapshot":` + want + `,"generation":0,"digest":"","fences":{},"retired":{}}`
		file, err := os.ReadFile(path)
		if err != nil || !bytes.Equal(file, nativeFormatEnvelope(t, key, payload)) {
			t.Fatalf("native nested authenticated envelope %s %v", file, err)
		}
	}
	transit := TransitJournal{ProtocolVersion: 3, ExtensionVersion: 1, NodeID: "node", Snapshot: json.RawMessage(`null`), Fences: map[string]uint64{}, Retired: map[string]uint64{}}
	want := `{"protocolVersion":3,"extensionVersion":1,"nodeId":"node","generation":0,"digest":"","snapshot":null,"fences":{},"retired":{}}`
	raw, err := json.Marshal(transit)
	if err != nil || string(raw) != want {
		t.Fatalf("offline Transit native format %s %v", raw, err)
	}
	key := bytes.Repeat([]byte{4}, 32)
	path := filepath.Join(t.TempDir(), "transit")
	if err = saveTransitJournal(path, key, transit); err != nil {
		t.Fatal(err)
	}
	file, err := os.ReadFile(path)
	if err != nil || !bytes.Equal(file, nativeFormatEnvelope(t, key, `{"snapshot":`+want+`,"generation":0,"digest":"","fences":{},"retired":{}}`)) {
		t.Fatal("Transit used a lower Runtime facts serializer", err)
	}
	loaded, err := LoadTransitJournal(path, key, "node")
	if err != nil || !reflect.DeepEqual(loaded, transit) {
		t.Fatal("Transit original codec changed", err)
	}
}
