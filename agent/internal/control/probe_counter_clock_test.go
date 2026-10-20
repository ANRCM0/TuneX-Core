package control

import (
	"errors"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/observationwire"
	"github.com/tunex/vnext/agent/internal/probe"
	"github.com/tunex/vnext/agent/internal/probeecho"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

type pointClock struct {
	runtimeplatform.Scheduler
	now   time.Time
	calls int
}

func (c *pointClock) Now() time.Time { c.calls++; return c.now }

func TestProbeCounterPointSamplesEveryPointAndPreservesTerminalOffset(t *testing.T) {
	clock := &pointClock{now: time.Date(2026, 10, 19, 1, 2, 3, 123, time.FixedZone("native", 8*3600))}
	ended := clock.now.Add(-time.Hour)
	for _, available := range []bool{false, true} {
		for _, terminal := range []bool{false, true} {
			values := probe.CounterSnapshot{Available: available, Epoch: "epoch", Attempted: ^uint64(0), Overflowed: true}
			if terminal {
				values.EndedAt = ended
			}
			before := clock.calls
			point := probeCounterPointWith(probeCounterIdentity{InstanceID: "instance"}, values, clock)
			if clock.calls != before+1 {
				t.Fatal("terminal or unavailable skipped native Now")
			}
			if terminal {
				if point.State != "terminal" || point.CapturedAt != ended.Format(time.RFC3339Nano) || point.EndedAt == nil || *point.EndedAt != point.CapturedAt {
					t.Fatalf("terminal offset lost: %#v", point)
				}
			} else if point.State != "current" || point.EndedAt != nil || point.CapturedAt != clock.now.UTC().Format(time.RFC3339Nano) {
				t.Fatalf("current point not UTC: %#v", point)
			}
			if available {
				if point.Counters == nil || point.Counters.Attempted != "18446744073709551615" || point.CounterEpoch == nil || *point.CounterEpoch != "epoch" || point.Overflowed == nil || !*point.Overflowed {
					t.Fatalf("available values truncated: %#v", point)
				}
			} else if point.Availability != "unavailable" || point.CounterEpoch != nil || point.Counters != nil || point.Overflowed != nil {
				t.Fatal("unavailable point invented counters")
			}
		}
	}
}

func TestEchoContextDecodeRefusalStillSamplesOwnerClock(t *testing.T) {
	clock := &pointClock{}
	runner := &Runner{options: Options{ProbeEcho: true, ProbeServices: true, ProbeIngress: true, ProbeExecution: true, ProbeRegistration: true}, effects: Effects{Schedule: clock}}
	echo := &probeecho.Execution{Invocation: probeecho.Invocation{Measurement: probe.MeasurementIngressTCPEcho}}
	_, err := runner.probeEchoTargetLocked(probe.Binding{}, probe.MeasurementIngressTCPEcho, nil, echo)
	if !errors.Is(err, probe.ErrDenied) || clock.calls != 1 {
		t.Fatalf("decode failure clock stage changed: %d %v", clock.calls, err)
	}
	if !sameProbeEchoInput(nil, nil) || sameProbeEchoInput(nil, echo) || sameProbeEchoInput(echo, nil) {
		t.Fatal("nil Echo input equality changed")
	}
}

func TestForwardCounterEmbeddingKeepsPromotedNativeFields(t *testing.T) {
	value := forwardCounterSnapshot{ForwardCounterSnapshot: observationwire.ForwardCounterSnapshot{CounterVersion: 1, Kind: "forward-counters"}}
	if value.CounterVersion != 1 || value.Kind != "forward-counters" {
		t.Fatal("native field promotion lost")
	}
	encoded, err := observationwire.EncodeValue(value)
	native, nativeErr := observationwire.EncodeValue(value.ForwardCounterSnapshot)
	if err != nil || nativeErr != nil || string(encoded) != string(native) {
		t.Fatalf("embedded native snapshot no longer flattens: %s vs %s", encoded, native)
	}
}
