package platformclock

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/executiontime"
)

func TestNativeSynchronizationStatusEncodingAndFacts(t *testing.T) {
	native := SyncStatus{Host: "host", Source: "linux-adjtimex", Synchronized: true,
		MaxErrorNanos: 1000, ObservedAt: "2026-10-19T01:02:03.123456789+08:00"}
	raw, err := json.Marshal(native)
	if err != nil || string(raw) != `{"host":"host","source":"linux-adjtimex","synchronized":true,"maxErrorNanos":1000,"observedAt":"2026-10-19T01:02:03.123456789+08:00"}` {
		t.Fatalf("native encoding changed: %s, %v", raw, err)
	}
	facts := SynchronizationFacts(native)
	if !facts.ObservationValid || !facts.SourceAccepted || facts.Host != native.Host || facts.Source != native.Source ||
		facts.Synchronized != native.Synchronized || facts.MaxErrorNanos != native.MaxErrorNanos ||
		facts.ObservedAt.Format(time.RFC3339Nano) != native.ObservedAt {
		t.Fatalf("projection lost native values: %#v", facts)
	}
	if err := executiontime.ValidateSynchronization(facts, facts.ObservedAt, time.Second); err != nil {
		t.Fatal(err)
	}
}

func TestSynchronizationProjectionKeepsInvalidFactsForDecision(t *testing.T) {
	now := time.Date(2026, 10, 19, 1, 2, 3, 0, time.UTC)
	for _, native := range []SyncStatus{
		{Source: "linux-adjtimex", Synchronized: true, ObservedAt: "invalid"},
		{Source: "unrecognized", Synchronized: true, ObservedAt: now.Format(time.RFC3339Nano)},
		{Source: "windows-w32time", Synchronized: false, ObservedAt: now.Format(time.RFC3339Nano)},
	} {
		facts := SynchronizationFacts(native)
		if facts.Host != native.Host || facts.Source != native.Source || facts.Synchronized != native.Synchronized {
			t.Fatalf("projection substituted failed native identity: %#v", facts)
		}
		if err := executiontime.ValidateSynchronization(facts, now, time.Second); err == nil {
			t.Fatalf("invalid native evidence accepted: %#v", native)
		}
	}
	windows := SynchronizationFacts(SyncStatus{Source: "windows-w32time", ObservedAt: now.Format(time.RFC3339Nano)})
	if !windows.SourceAccepted || !windows.ObservationValid {
		t.Fatal("native Windows source spelling refused")
	}
}
