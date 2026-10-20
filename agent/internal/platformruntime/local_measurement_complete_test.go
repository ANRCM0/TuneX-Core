package platformruntime

import (
	"bytes"
	"errors"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestLocalMeasurementCompleteConfiguredSiblingModesAndFailure(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "private", "measurements", "custom.json")
	diagnostics, counters := []byte{0, 255, 'd'}, []byte{128, 0, 'c'}
	local := Local{}
	if err := local.WriteDiagnostics(path, diagnostics); err != nil { t.Fatal(err) }
	if err := local.WriteForwardCounters(path, counters); err != nil { t.Fatal(err) }
	for file, want := range map[string][]byte{path: diagnostics, filepath.Join(filepath.Dir(path), "forward-counters.json"): counters} {
		got, err := os.ReadFile(file); if err != nil || !bytes.Equal(got, want) { t.Fatalf("native file %s: %x %v", file, got, err) }
		if info, err := os.Stat(file); err != nil || runtime.GOOS != "windows" && info.Mode().Perm() != 0600 { t.Fatalf("private file mode %s: %v %v", file, info, err) }
	}
	if runtime.GOOS != "windows" { for _, directory := range []string{filepath.Join(root, "private"), filepath.Dir(path)} { info, err := os.Stat(directory); if err != nil || info.Mode().Perm() != 0700 { t.Fatalf("private directory mode: %v %v", info, err) } } }
	if entries, err := os.ReadDir(filepath.Dir(path)); err != nil || len(entries) != 2 { t.Fatalf("atomic temporary files leaked: %v %v", entries, err) }
	blocker := filepath.Join(root, "blocker")
	if err := os.WriteFile(blocker, []byte("history"), 0600); err != nil { t.Fatal(err) }
	for _, write := range []func() error{func() error { return local.WriteDiagnostics(filepath.Join(blocker, "status"), nil) }, func() error { return local.WriteForwardCounters(filepath.Join(blocker, "status"), nil) }} {
		var pathError *os.PathError; if err := write(); !errors.As(err, &pathError) { t.Fatalf("mkdir native error lost: %v", err) }
	}
	if got, err := os.ReadFile(blocker); err != nil || string(got) != "history" { t.Fatal("failed mkdir replaced history") }
	// A directory at the final target refuses rename; its contents and temp cleanup survive.
	target := filepath.Join(root, "rename-target")
	if err := os.Mkdir(target, 0700); err != nil { t.Fatal(err) }
	if err := os.WriteFile(filepath.Join(target, "history"), []byte("retained"), 0600); err != nil { t.Fatal(err) }
	if err := local.WriteDiagnostics(target, []byte("replacement")); err == nil { t.Fatal("rename target directory accepted") }
	if got, err := os.ReadFile(filepath.Join(target, "history")); err != nil || string(got) != "retained" { t.Fatal("failed rename removed history") }
	entries, err := os.ReadDir(root); if err != nil { t.Fatal(err) }; for _, entry := range entries { if len(entry.Name()) >= 7 && entry.Name()[:7] == ".state-" { t.Fatal("failed rename leaked temp") } }
}

func TestLocalMeasurementCompleteWarningUsesOriginalStderrArguments(t *testing.T) {
	reader, writer, err := os.Pipe(); if err != nil { t.Fatal(err) }
	original := os.Stderr
	os.Stderr = writer
	defer func() { os.Stderr = original; reader.Close(); writer.Close() }()
	problem := errors.New("same original error")
	Local{}.Warn("Agent authorization ended:", problem)
	Local{}.Warn("Local diagnostics unavailable")
	if err := writer.Close(); err != nil { t.Fatal(err) }
	os.Stderr = original
	raw, err := io.ReadAll(reader)
	if err != nil || string(raw) != "Agent authorization ended: same original error\nLocal diagnostics unavailable\n" { t.Fatalf("stderr argument/newline placement: %q %v", raw, err) }
}
