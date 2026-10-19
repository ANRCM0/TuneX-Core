package platformstate

import (
	"bytes"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestAtomicWriteReplacesBytesAndLeavesNoTemporaryFiles(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "protected.json")
	if err := os.WriteFile(path, []byte("original"), 0600); err != nil {
		t.Fatal(err)
	}
	want := []byte{0xff, 0, 0x80, 0x42}
	if err := AtomicWrite(path, want); err != nil {
		t.Fatal(err)
	}
	actual, err := os.ReadFile(path)
	if err != nil || !bytes.Equal(actual, want) {
		t.Fatalf("raw replacement changed: %x %v", actual, err)
	}
	entries, err := os.ReadDir(root)
	if err != nil || len(entries) != 1 || entries[0].Name() != "protected.json" {
		t.Fatalf("temporary file leaked: %v %v", entries, err)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS != "windows" && info.Mode().Perm() != 0600 {
		t.Fatalf("private mode changed: %v", info.Mode())
	}
}

func TestAtomicWriteFailedRenameCleansTempAndPreservesProtectedTarget(t *testing.T) {
	root := t.TempDir()
	target := filepath.Join(root, "protected")
	if err := os.Mkdir(target, 0700); err != nil {
		t.Fatal(err)
	}
	history := filepath.Join(target, "history")
	if err := os.WriteFile(history, []byte("retained"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := AtomicWrite(target, []byte("new")); err == nil {
		t.Fatal("rename onto nonempty directory succeeded")
	}
	raw, err := os.ReadFile(history)
	if err != nil || string(raw) != "retained" {
		t.Fatalf("failed replacement changed protected history: %q %v", raw, err)
	}
	entries, err := os.ReadDir(root)
	if err != nil || len(entries) != 1 || entries[0].Name() != "protected" {
		t.Fatalf("failed rename leaked temporary file: %v %v", entries, err)
	}
	if err := AtomicWrite(filepath.Join(root, "missing", "state"), []byte("new")); err == nil {
		t.Fatal("missing parent silently created")
	}
	if _, err := os.Stat(filepath.Join(root, "missing")); !os.IsNotExist(err) {
		t.Fatalf("failed create changed missing parent: %v", err)
	}
}
