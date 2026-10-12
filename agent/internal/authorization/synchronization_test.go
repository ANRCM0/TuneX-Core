package authorization

import (
	"bytes"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

const windowsStatus = "Leap indicator: 0(no warning)\nStratum: 5\nPrecision: -23\nRoot delay: 0.0831891s\nRoot dispersion: 4.3827594s\nReference ID: 0x34E772B7\nLast sync: 2026/10/12 20:39:57\nSource: time.windows.com,0x9\nPoll interval: 10\n\nPhase offset: -0.0000522s\nClockRate: 0.0156249s\nState machine: 2\nSource flags: 0\nServer role: 0\nLast error: 0\nTime since last good sync: 12.0s\n"

func TestWindowsSynchronizationUsesErrorBoundAndServiceState(t *testing.T) {
	now := time.Now().UTC()
	status, err := ParseWindowsTimeStatus(windowsStatus, now)
	if err != nil {
		t.Fatal(err)
	}
	if !status.Synchronized || status.MaxErrorNanos < 4430406150 || status.MaxErrorNanos > 4430406151 {
		t.Fatalf("unexpected status %#v", status)
	}
	if err := ValidateSynchronization(status, now, 5*time.Second); err != nil {
		t.Fatal(err)
	}
	localized := strings.ReplaceAll(windowsStatus, "Root dispersion:", "Translated label:")
	if parsed, err := ParseWindowsTimeStatus(localized, now); err != nil || parsed != status {
		t.Fatal("translated field label changed semantics", err)
	}
	for _, text := range []string{strings.Replace(windowsStatus, "Leap indicator: 0", "Leap indicator: 3", 1), strings.Replace(windowsStatus, "State machine: 2", "State machine: 0", 1), strings.Replace(windowsStatus, "0x34E772B7", "0x4C4F434C", 1)} {
		bad, err := ParseWindowsTimeStatus(text, now)
		if err == nil && bad.Synchronized {
			t.Fatal("unsynchronized/local clock accepted")
		}
	}
	if _, err := ParseWindowsTimeStatus("State machine: 2", now); err == nil {
		t.Fatal("truncated provider output accepted")
	}
	stale, err := ParseWindowsTimeStatus(strings.Replace(windowsStatus, "12.0s", "28284.1962466s", 1), now)
	if err != nil {
		t.Fatal(err)
	}
	if ValidateSynchronization(stale, now, 5*time.Second) == nil {
		t.Fatal("stale service status hid holdover drift")
	}
	failed, err := ParseWindowsTimeStatus(strings.Replace(windowsStatus, "Last error: 0", "Last error: 2", 1), now)
	if err == nil && failed.Synchronized {
		t.Fatal("service synchronization failure accepted")
	}
}
func TestSyncProofRejectsForgeryUnknownFieldsAndStaleEvidence(t *testing.T) {
	directory := t.TempDir()
	path := filepath.Join(directory, "status.json")
	keyPath := filepath.Join(directory, "key")
	key := bytes.Repeat([]byte{7}, 32)
	if err := os.WriteFile(keyPath, key, 0600); err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	status := SyncStatus{Source: "linux-adjtimex", Synchronized: true, MaxErrorNanos: 1000000, ObservedAt: now.Format(time.RFC3339Nano)}
	if err := WriteProof(path, key, status); err != nil {
		t.Fatal(err)
	}
	actual, err := ReadProof(path, keyPath)
	if err != nil || actual != status {
		t.Fatal("valid proof rejected", err)
	}
	if err := ValidateSynchronization(status, now.Add(31*time.Second), 5*time.Second); err == nil {
		t.Fatal("stale proof accepted")
	}
	status.MaxErrorNanos = 5e9
	if err := ValidateSynchronization(status, now.Add(time.Second), 5*time.Second); err == nil {
		t.Fatal("holdover uncertainty not counted")
	}
	status.Source = "self-declared"
	if err := ValidateSynchronization(status, now, 5*time.Second); err == nil {
		t.Fatal("unknown source accepted")
	}
	raw, _ := os.ReadFile(path)
	os.WriteFile(path, bytes.Replace(raw, []byte("1000000"), []byte("0"), 1), 0600)
	if _, err := ReadProof(path, keyPath); err == nil {
		t.Fatal("forged proof accepted")
	}
	os.WriteFile(path, []byte(strings.Repeat("x", 8193)), 0600)
	if _, err := ReadProof(path, keyPath); err == nil {
		t.Fatal("oversize proof accepted")
	}
	os.Remove(keyPath)
	if _, err := ReadProof(path, keyPath); err == nil {
		t.Fatal("missing protected key accepted")
	}
}
func TestProofKeyStaysOutsideWritableBoundaries(t *testing.T) {
	root := t.TempDir()
	status := filepath.Join(root, "status", "proof.json")
	state := filepath.Join(root, "agent")
	for _, key := range []string{filepath.Join(root, "status", "key"), filepath.Join(root, "status", "nested", "key"), filepath.Join(state, "key")} {
		if err := ValidateProofBoundary(status, key, state); err == nil {
			t.Fatal("untrusted-boundary key accepted", key)
		}
	}
	if err := ValidateProofBoundary(status, filepath.Join(root, "secrets", "key"), state); err != nil {
		t.Fatal(err)
	}
}
func TestUnsynchronizedProofCannotInitializeGuard(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "proof.json")
	keyPath := filepath.Join(root, "key")
	key := bytes.Repeat([]byte{9}, 32)
	os.WriteFile(keyPath, key, 0600)
	WriteProof(path, key, SyncStatus{Source: "linux-adjtimex", Synchronized: false, ObservedAt: time.Now().UTC().Format(time.RFC3339Nano)})
	clock := SynchronizedClock(5*time.Second, ProofOptions{Path: path, KeyPath: keyPath})
	if _, err := New(clock, 5*time.Second, 300*time.Second, time.Now().Add(time.Hour)); err == nil {
		t.Fatal("unsynchronized evidence granted execution")
	}
}
func TestSynchronizationProofMustBelongToSameHostAndPlatform(t *testing.T) {
	directory := t.TempDir()
	path := filepath.Join(directory, "status.json")
	keyPath := filepath.Join(directory, "key")
	key := bytes.Repeat([]byte{4}, 32)
	os.WriteFile(keyPath, key, 0600)
	host, err := os.Hostname()
	if err != nil {
		t.Fatal(err)
	}
	source := "linux-adjtimex"
	if runtime.GOOS == "windows" {
		source = "windows-w32time"
	}
	status := SyncStatus{Host: host, Source: source, Synchronized: true, MaxErrorNanos: 1000000, ObservedAt: time.Now().UTC().Format(time.RFC3339Nano)}
	for _, invalid := range []SyncStatus{{Host: "foreign-host", Source: source, Synchronized: true, ObservedAt: status.ObservedAt}, {Host: host, Source: "foreign-platform", Synchronized: true, ObservedAt: status.ObservedAt}} {
		WriteProof(path, key, invalid)
		clock := SynchronizedClock(5*time.Second, ProofOptions{Path: path, KeyPath: keyPath})
		if _, err := New(clock, 5*time.Second, 300*time.Second, time.Now().Add(time.Hour)); err == nil {
			t.Fatal("foreign evidence granted execution")
		}
	}
	if err := WriteProof(path, key, status); err != nil {
		t.Fatal(err)
	}
	clock := SynchronizedClock(5*time.Second, ProofOptions{Path: path, KeyPath: keyPath})
	if _, err := New(clock, 5*time.Second, 300*time.Second, time.Now().Add(time.Hour)); err != nil {
		t.Fatal("authenticated matching proof rejected", err)
	}
}
