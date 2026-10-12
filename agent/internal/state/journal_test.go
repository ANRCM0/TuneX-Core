package state

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func TestJournalIntegrityAndPersistence(t *testing.T) {
	path := filepath.Join(t.TempDir(), "journal.json")
	key := bytes.Repeat([]byte{7}, 32)
	value := Journal{Generation: 5, Digest: "sha256:stored", Fences: map[string]uint64{"tcp/25565": 8}, Retired: map[string]uint64{"tcp/25566": 6}}
	if err := Save(path, key, value); err != nil {
		t.Fatal(err)
	}
	actual, err := Load(path, key)
	if err != nil || actual.Generation != 5 || actual.Fences["tcp/25565"] != 8 {
		t.Fatalf("persisted state: %#v %v", actual, err)
	}
	value.Generation = 6
	if err := Save(path, key, value); err != nil {
		t.Fatal(err)
	}
	actual, err = Load(path, key)
	if err != nil || actual.Generation != 6 {
		t.Fatal("replacement not persisted", err)
	}
	if _, err := Load(path, bytes.Repeat([]byte{8}, 32)); err == nil {
		t.Fatal("wrong key accepted")
	}
	raw, _ := os.ReadFile(path)
	raw = bytes.Replace(raw, []byte(`"generation":6`), []byte(`"generation":1`), 1)
	os.WriteFile(path, raw, 0600)
	if _, err := Load(path, key); err == nil {
		t.Fatal("tampered state accepted")
	}
	os.Remove(path)
	if _, err := Load(path, key); err == nil {
		t.Fatal("lost state accepted as first boot")
	}
}
