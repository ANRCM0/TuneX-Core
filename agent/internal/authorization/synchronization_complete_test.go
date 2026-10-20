package authorization

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/executiontime"
	"github.com/tunex/vnext/agent/internal/platformclock"
)

var (
	_ func(SyncStatus, time.Time, time.Duration) error = ValidateSynchronization
	_ func(time.Duration, ProofOptions) Clock = SynchronizedClock
	_ func(string, string) (SyncStatus, error) = ReadProof
	_ func(string, []byte, SyncStatus) error = WriteProof
	_ func() (SyncStatus, error) = ReadSystemSynchronization
	_ func(string, time.Time) (SyncStatus, error) = ParseWindowsTimeStatus
)

func TestSynchronizationCompleteNativeAliasesAndTaglessFacts(t *testing.T) {
	if executiontime.InterfaceVersion != 2 || platformclock.InterfaceVersion != 2 {
		t.Fatal("timing interface versions changed")
	}
	if reflect.TypeOf(SyncStatus{}) != reflect.TypeOf(platformclock.SyncStatus{}) || reflect.TypeOf(ProofOptions{}) != reflect.TypeOf(executiontime.ProofOptions{}) || reflect.TypeOf(Sample{}) != reflect.TypeOf(executiontime.Sample{}) || reflect.TypeOf(Clock(nil)) != reflect.TypeOf(executiontime.Clock(nil)) {
		t.Fatal("old timing aliases changed identity")
	}
	type field struct { name string; typ reflect.Type }
	lower := reflect.TypeOf(executiontime.SyncStatus{})
	want := []field{{"Host", reflect.TypeOf("")}, {"Source", reflect.TypeOf("")}, {"Synchronized", reflect.TypeOf(false)}, {"MaxErrorNanos", reflect.TypeOf(int64(0))}, {"ObservedAt", reflect.TypeOf(time.Time{})}, {"ObservationValid", reflect.TypeOf(false)}, {"SourceAccepted", reflect.TypeOf(false)}}
	if lower.NumField() != len(want) { t.Fatal("lower fact field count changed") }
	for i, expected := range want {
		actual := lower.Field(i)
		if actual.Name != expected.name || actual.Type != expected.typ || actual.Tag != "" { t.Fatalf("lower field %d changed: %v", i, actual) }
	}
	nativeType := reflect.TypeOf(platformclock.SyncStatus{})
	names := []string{"Host", "Source", "Synchronized", "MaxErrorNanos", "ObservedAt"}
	tags := []string{"host", "source", "synchronized", "maxErrorNanos", "observedAt"}
	if nativeType.NumField() != len(names) { t.Fatal("native field count changed") }
	for i, name := range names {
		f := nativeType.Field(i)
		expectedType := want[i].typ
		if name == "ObservedAt" { expectedType = reflect.TypeOf("") }
		if f.Name != name || f.Type != expectedType || string(f.Tag) != `json:"`+tags[i]+`"` { t.Fatalf("native field %d changed: %v", i, f) }
	}
	native := SyncStatus{Host: "host", Source: "windows-w32time", Synchronized: true, MaxErrorNanos: 42, ObservedAt: "2026-10-19T01:02:03.123456789+08:00"}
	facts := platformclock.SynchronizationFacts(native)
	raw, err := json.Marshal(facts)
	if err != nil { t.Fatal(err) }
	wantJSON := `{"Host":"host","Source":"windows-w32time","Synchronized":true,"MaxErrorNanos":42,"ObservedAt":"2026-10-19T01:02:03.123456789+08:00","ObservationValid":true,"SourceAccepted":true}`
	if string(raw) != wantJSON { t.Fatalf("lower direct serializer changed: %s", raw) }
	if lower == nativeType || lower.PkgPath() != "github.com/tunex/vnext/agent/internal/executiontime" || nativeType.PkgPath() != "github.com/tunex/vnext/agent/internal/platformclock" { t.Fatal("native/lower canonical ownership changed") }
	// Conversion is explicit; an invalid native timestamp stays an invalid fact.
	native.ObservedAt = "invalid"
	facts = platformclock.SynchronizationFacts(native)
	if facts.ObservationValid || !facts.ObservedAt.IsZero() || !facts.SourceAccepted || facts.Host != native.Host || facts.MaxErrorNanos != native.MaxErrorNanos { t.Fatal("invalid native text moved rejection into the adapter") }
}

func TestSynchronizationCompleteProofBytesMACAndProviderErrors(t *testing.T) {
	root := t.TempDir()
	path, keyPath := filepath.Join(root, "proof.json"), filepath.Join(root, "key")
	key := bytes.Repeat([]byte{7}, 32)
	if err := os.WriteFile(keyPath, key, 0600); err != nil { t.Fatal(err) }
	status := SyncStatus{Host: "host", Source: "linux-adjtimex", Synchronized: true, MaxErrorNanos: 42, ObservedAt: "2026-10-19T01:02:03.123456789+08:00"}
	const payload = `{"host":"host","source":"linux-adjtimex","synchronized":true,"maxErrorNanos":42,"observedAt":"2026-10-19T01:02:03.123456789+08:00"}`
	// The independent literal pins the authenticated bytes, including field order.
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write([]byte(payload))
	want := `{"payload":` + payload + `,"mac":"` + hex.EncodeToString(mac.Sum(nil)) + `"}`
	if err := WriteProof(path, key, status); err != nil { t.Fatal(err) }
	raw, err := os.ReadFile(path)
	if err != nil || string(raw) != want { t.Fatalf("proof envelope/MAC changed: %s, %v", raw, err) }
	got, err := ReadProof(path, keyPath)
	if err != nil || got != status { t.Fatalf("native proof round trip changed: %#v %v", got, err) }
	for _, size := range []int{0, 31, 33} {
		if err := WriteProof(path, make([]byte, size), status); err == nil || err.Error() != "invalid time-proof key" { t.Fatalf("write key size %d: %v", size, err) }
		unchanged, err := os.ReadFile(path)
		if err != nil || !bytes.Equal(unchanged, raw) { t.Fatal("invalid key changed existing proof") }
	}
	missing := filepath.Join(root, "missing")
	if _, err := ReadProof(path, missing); err == nil || err.Error() != "invalid time-proof key" { t.Fatalf("missing key error changed: %v", err) }
	if err := os.WriteFile(keyPath, make([]byte, 31), 0600); err != nil { t.Fatal(err) }
	if _, err := ReadProof(path, keyPath); err == nil || err.Error() != "invalid time-proof key" { t.Fatalf("short key error changed: %v", err) }
	if err := os.WriteFile(keyPath, key, 0600); err != nil { t.Fatal(err) }
	_, direct := ReadProof(missing, keyPath)
	var directPath *os.PathError
	if !errors.As(direct, &directPath) || directPath.Path != missing || !errors.Is(direct, os.ErrNotExist) { t.Fatalf("proof native error lost: %v", direct) }
	_, wrapped := SynchronizedClock(time.Second, ProofOptions{Path: missing, KeyPath: keyPath})()
	var wrappedPath *os.PathError
	if !errors.As(wrapped, &wrappedPath) || wrappedPath.Path != missing || !errors.Is(wrapped, os.ErrNotExist) || !strings.HasPrefix(wrapped.Error(), "CLOCK_UNCERTAIN: synchronization provider unavailable: ") { t.Fatalf("proof provider selection/error wrapping changed: %v", wrapped) }
}
