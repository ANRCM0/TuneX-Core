package executiontime

import (
	"errors"
	"reflect"
	"testing"
	"time"
)

func TestSynchronizationProviderFailurePrecedence(t *testing.T) {
	for _, stage := range []string{"before", "evidence", "after"} {
		t.Run(stage, func(t *testing.T) {
			events := []string{}
			failure := errors.New("specific-provider-error")
			calls := 0
			clock := SynchronizedClock(time.Second, SynchronizationSources{
				Sample: func() (Sample, error) {
					calls++
					events = append(events, "sample")
					if stage == "before" || stage == "after" && calls == 2 {
						return Sample{}, failure
					}
					return Sample{Uptime: time.Second}, nil
				},
				Evidence: func() (SyncStatus, error) {
					events = append(events, "evidence")
					if stage == "evidence" {
						return SyncStatus{}, failure
					}
					return SyncStatus{}, nil
				},
				Host:   func() (string, error) { t.Error("host ran after failed sample/evidence"); return "", nil },
				Source: func() string { t.Error("source ran after failed sample/evidence"); return "" },
			})
			_, err := clock()
			want := []string{"sample"}
			if stage != "before" {
				want = append(want, "evidence")
			}
			if stage == "after" {
				want = append(want, "sample")
			}
			if !errors.Is(err, failure) || !reflect.DeepEqual(events, want) {
				t.Fatalf("precedence %v %v, want %v", events, err, want)
			}
		})
	}
}

func TestSynchronizationBlockedEvidenceUsesSecondSample(t *testing.T) {
	entered := make(chan struct{})
	release := make(chan struct{})
	done := make(chan error, 1)
	origin := time.Date(2026, 10, 19, 0, 0, 0, 0, time.UTC)
	sampleCalls := 0
	clock := SynchronizedClock(time.Second, SynchronizationSources{
		Sample: func() (Sample, error) {
			sampleCalls++
			if sampleCalls == 1 {
				return Sample{Wall: origin, Uptime: time.Second}, nil
			}
			return Sample{Wall: origin.Add(31 * time.Second), Uptime: 32 * time.Second}, nil
		},
		Evidence: func() (SyncStatus, error) {
			close(entered)
			<-release
			return SyncStatus{Host: "host", Source: "pure", Synchronized: true, ObservedAt: origin, ObservationValid: true, SourceAccepted: true}, nil
		},
		Host:   func() (string, error) { return "host", nil },
		Source: func() string { return "pure" },
	})
	go func() { _, err := clock(); done <- err }()
	select {
	case <-entered:
	case <-time.After(5 * time.Second):
		t.Fatal("provider did not enter")
	}
	close(release)
	select {
	case err := <-done:
		if err == nil || sampleCalls != 2 {
			t.Fatalf("blocked provider reused first freshness sample: %d %v", sampleCalls, err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("provider did not finish")
	}
}

func TestSynchronizationFutureAndNegativeErrorBounds(t *testing.T) {
	now := time.Date(2026, 10, 19, 0, 0, 0, 0, time.UTC)
	base := SyncStatus{Synchronized: true, SourceAccepted: true, ObservationValid: true, ObservedAt: now}
	for _, vector := range []struct {
		name     string
		observed time.Time
		bound    int64
		accepted bool
	}{
		{"future-at-skew", now.Add(time.Second), 0, true},
		{"future-over-skew", now.Add(time.Second + time.Nanosecond), 0, false},
		{"negative-error", now, -1, false},
		{"error-at-skew", now, int64(time.Second), true},
		{"error-over-skew", now, int64(time.Second) + 1, false},
	} {
		t.Run(vector.name, func(t *testing.T) {
			value := base
			value.ObservedAt = vector.observed
			value.MaxErrorNanos = vector.bound
			err := ValidateSynchronization(value, now, time.Second)
			if (err == nil) != vector.accepted {
				t.Fatalf("boundary accepted=%v: %v", vector.accepted, err)
			}
		})
	}
}
