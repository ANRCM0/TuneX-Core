package nativeexecution

import (
	"encoding/json"
	"reflect"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
)

func TestWireTimeCompleteRawResultsAndQualificationPairs(t *testing.T) {
	texts := []string{"", "invalid", "0000-01-01T00:00:00Z", "0001-01-01T00:00:00Z", "2026-10-19T01:02:03Z", "2026-10-19T01:02:03.123456789+08:00", "2026-10-19T01:02:03.123456789123Z", "2026-10-19t01:02:03Z", "2026-02-30T00:00:00Z", "2026-10-19T01:02:03-07:30"}
	for _, text := range texts {
		want, wantErr := time.Parse(time.RFC3339Nano, text)
		for _, parse := range []func(string) (time.Time, error){ParseWireTime, ParseProbeWireTime} {
			got, err := parse(text)
			if !reflect.DeepEqual(got, want) || !reflect.DeepEqual(err, wantErr) {
				t.Fatalf("raw result/error for %q: %v %v; want %v %v", text, got, err, want, wantErr)
			}
		}
		for _, second := range texts {
			other, otherErr := time.Parse(time.RFC3339Nano, second)
			first, last, ok := ParseProbeQualificationTimes(text, second)
			if !reflect.DeepEqual(first, want) || !reflect.DeepEqual(last, other) || ok != (wantErr == nil && otherErr == nil) {
				t.Fatalf("qualification pair %q/%q: %v %v %v", text, second, first, last, ok)
			}
		}
	}
}

func TestRunnerSnapshotCompleteValidityFirstRawError(t *testing.T) {
	valid := "2026-10-19T01:02:03.123456789+08:00"
	for _, pair := range [][2]string{{"invalid-issued", "invalid-validity"}, {"invalid-issued", valid}, {valid, "invalid-validity"}, {valid, valid}, {"0001-01-01T00:00:00Z", valid}} {
		wantValid, wantErr := time.Parse(time.RFC3339Nano, pair[1])
		var wantIssued time.Time
		if wantErr == nil { wantIssued, wantErr = time.Parse(time.RFC3339Nano, pair[0]) }
		if wantErr != nil { wantIssued, wantValid = time.Time{}, time.Time{} }
		issued, until, err := RunnerSnapshotWindow(adp3.Snapshot{IssuedAt: pair[0], ValidUntil: pair[1]})
		if !reflect.DeepEqual(issued, wantIssued) || !reflect.DeepEqual(until, wantValid) || !reflect.DeepEqual(err, wantErr) {
			t.Fatalf("snapshot parse order for %q: %v %v %v; want %v", pair, issued, until, err, wantErr)
		}
	}
}

func TestRunnerDrainReportCompleteUTCFieldsAndNilShapes(t *testing.T) {
	assignment := adp3.Assignment{AssignmentId: "assignment", DeploymentGeneration: ^uint64(0), BindingFence: 7}
	for _, stamp := range []time.Time{{}, time.Date(2026, 10, 19, 1, 2, 3, 123456789, time.FixedZone("offset", 8*3600))} {
		deadline := stamp.Add(time.Nanosecond)
		drain := RunnerDrain(assignment, stamp, deadline, ^uint64(0), "draining")
		want := adp3.Drain{AssignmentId: "assignment", DeploymentGeneration: ^uint64(0), BindingFence: 7, StartedAt: stamp.UTC().Format(time.RFC3339Nano), Deadline: deadline.UTC().Format(time.RFC3339Nano), RemainingConnections: ^uint64(0), Condition: "draining"}
		if !reflect.DeepEqual(drain, want) { t.Fatal("drain changed fields/UTC/nanoseconds", drain, want) }
		for _, drains := range [][]adp3.Drain{nil, {}, {drain}} {
			for _, observations := range [][]adp3.Observation{nil, {}, {{AssignmentId: "assignment", Phase: "active", Condition: "ready"}}} {
				raw, err := EncodeRunnerReportAt("node", "boot", 2, 3, stamp, 4, observations, drains)
				wantObservations := observations
				if wantObservations == nil { wantObservations = []adp3.Observation{} }
				expected, marshalErr := json.Marshal(adp3.ReportRequest{ProtocolVersion: 3, NodeId: "node", BootId: "boot", SessionEpoch: 2, ReportSequence: 3, ObservedAt: stamp.UTC().Format(time.RFC3339Nano), AcceptedSnapshotGeneration: 4, Observations: wantObservations, Drains: drains})
				if err != nil || marshalErr != nil || string(raw) != string(expected) { t.Fatalf("report bytes: %s %v; want %s", raw, err, expected) }
			}
		}
	}
}
