package executiontime

import (
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestSynchronizationMissingProvidersDoNotSample(t *testing.T) {
	calls := 0
	complete := SynchronizationSources{
		Sample:   func() (Sample, error) { calls++; return Sample{}, nil },
		Evidence: func() (SyncStatus, error) { calls++; return SyncStatus{}, nil },
		Host:     func() (string, error) { calls++; return "", nil },
		Source:   func() string { calls++; return "" },
	}
	for _, omit := range []string{"sample", "evidence", "host", "source"} {
		sources := complete
		switch omit {
		case "sample":
			sources.Sample = nil
		case "evidence":
			sources.Evidence = nil
		case "host":
			sources.Host = nil
		case "source":
			sources.Source = nil
		}
		if _, err := SynchronizedClock(time.Second, sources)(); err == nil || calls != 0 {
			t.Fatalf("missing %s ran providers or succeeded: calls=%d err=%v", omit, calls, err)
		}
	}
}

func TestSynchronizationSampleHostSourceAndInvalidEvidenceOrder(t *testing.T) {
	for _, fail := range []string{"second-sample", "host", "source", "evidence"} {
		t.Run(fail, func(t *testing.T) {
			now := time.Date(2026, 10, 19, 0, 0, 0, 0, time.UTC)
			events := []string{}
			samples := 0
			sampleErr := errors.New("second sample failed")
			sources := SynchronizationSources{
				Sample: func() (Sample, error) {
					samples++
					events = append(events, "sample")
					if samples == 2 && fail == "second-sample" {
						return Sample{}, sampleErr
					}
					return Sample{Wall: now, Uptime: time.Second}, nil
				},
				Evidence: func() (SyncStatus, error) {
					events = append(events, "evidence")
					return SyncStatus{Host: "host", Source: "source", Synchronized: true}, nil
				},
				Host: func() (string, error) {
					events = append(events, "host")
					if fail == "host" {
						return "different", nil
					}
					return "host", nil
				},
				Source: func() string {
					events = append(events, "source")
					if fail == "source" {
						return "different"
					}
					return "source"
				},
			}
			_, err := SynchronizedClock(time.Second, sources)()
			expected := []string{"sample", "evidence", "sample"}
			switch fail {
			case "second-sample":
				if !errors.Is(err, sampleErr) {
					t.Fatalf("sample error changed: %v", err)
				}
			case "host":
				expected = append(expected, "host")
				if err == nil || !strings.Contains(err.Error(), "another host") {
					t.Fatalf("host refusal order changed: %v", err)
				}
			case "source":
				expected = append(expected, "host", "source")
				if err == nil || !strings.Contains(err.Error(), "another platform") {
					t.Fatalf("source refusal order changed: %v", err)
				}
			case "evidence":
				expected = append(expected, "host", "source")
				if err == nil || !strings.Contains(err.Error(), "fresh bounded") {
					t.Fatalf("invalid evidence accepted: %v", err)
				}
			}
			if !reflect.DeepEqual(events, expected) {
				t.Fatalf("provider order %v, want %v", events, expected)
			}
		})
	}
}

func TestSynchronizationCachesUntilTwoSecondsAndRefreshesRollback(t *testing.T) {
	origin := time.Date(2026, 10, 19, 0, 0, 0, 0, time.UTC)
	uptime := time.Second
	samples, evidence := 0, 0
	sources := SynchronizationSources{
		Sample: func() (Sample, error) { samples++; return Sample{Wall: origin.Add(uptime), Uptime: uptime}, nil },
		Evidence: func() (SyncStatus, error) {
			evidence++
			return SyncStatus{Host: "host", Source: "opaque", Synchronized: true, ObservedAt: origin.Add(uptime), ObservationValid: true, SourceAccepted: true}, nil
		},
		Host: func() (string, error) { return "host", nil }, Source: func() string { return "opaque" },
	}
	clock := SynchronizedClock(time.Second, sources)
	for index, point := range []time.Duration{time.Second, 3*time.Second - time.Nanosecond, 3 * time.Second, time.Second} {
		uptime = point
		if _, err := clock(); err != nil {
			t.Fatal(err)
		}
		want := []int{1, 1, 2, 3}[index]
		if evidence != want || samples != 2*(index+1) {
			t.Fatalf("sample/cache stages: samples=%d evidence=%d", samples, evidence)
		}
	}
}

func TestSynchronizationFreshnessAndHoldoverEdges(t *testing.T) {
	observed := time.Date(2026, 10, 19, 0, 0, 0, 0, time.UTC)
	status := SyncStatus{Synchronized: true, ObservedAt: observed, ObservationValid: true, SourceAccepted: true}
	if err := ValidateSynchronization(status, observed.Add(30*time.Second), time.Second); err != nil {
		t.Fatal(err)
	}
	if err := ValidateSynchronization(status, observed.Add(30*time.Second+time.Nanosecond), time.Second); err == nil {
		t.Fatal("stale evidence accepted")
	}
	status.MaxErrorNanos = int64(time.Second - time.Millisecond/2)
	if err := ValidateSynchronization(status, observed.Add(time.Second), time.Second); err != nil {
		t.Fatal(err)
	}
	status.MaxErrorNanos++
	if err := ValidateSynchronization(status, observed.Add(time.Second), time.Second); err == nil {
		t.Fatal("holdover over budget accepted")
	}
}
