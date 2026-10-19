package observationwire

import (
	"bytes"
	"encoding/json"
	"fmt"
	"regexp"
	"time"

	"github.com/tunex/vnext/agent/internal/contracts"
)

var probeTelemetryTimestamp = regexp.MustCompile(`^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,9})?Z$`)

type ProbeTelemetrySample struct {
	ProbeTelemetryVersion int                  `json:"probeTelemetryVersion"`
	Kind                  string               `json:"kind"`
	NodeID                string               `json:"nodeId"`
	BootID                string               `json:"bootId"`
	SessionEpoch          uint64               `json:"sessionEpoch"`
	SampleEpoch           string               `json:"sampleEpoch"`
	Sequence              uint64               `json:"sequence"`
	CapturedAt            string               `json:"capturedAt"`
	UptimeMs              int64                `json:"uptimeMs"`
	DroppedSamples        string               `json:"droppedSamples"`
	Coverage              ProbeCounterCoverage `json:"coverage"`
	Items                 []ProbeCounterPoint  `json:"items"`
}

func EncodeProbeTelemetrySample(sample ProbeTelemetrySample, limits ProbeTelemetryLimits) ([]byte, error) {
	coverage := sample.Coverage
	if len(sample.Items) > limits.Page || coverage.RetiringSources < 0 || coverage.RetiringSources > limits.Retiring ||
		coverage.Available < 0 || coverage.Available > 384+coverage.RetiringSources*256 ||
		coverage.Returned != len(sample.Items) || coverage.Omitted != coverage.Available-len(sample.Items) {
		return nil, fmt.Errorf("Probe telemetry page exceeds limit")
	}
	generations := make(map[uint64]bool)
	for _, item := range sample.Items {
		binding := item.Identity.Binding
		if binding.NodeId != sample.NodeID || binding.BootId != sample.BootID || binding.SessionEpoch != sample.SessionEpoch {
			return nil, fmt.Errorf("Probe telemetry point identity differs")
		}
		generations[binding.SnapshotGeneration] = true
		point, err := json.Marshal(item)
		if err != nil || len(point) > 4096 || len(generations) > limits.Snapshot {
			return nil, fmt.Errorf("Probe telemetry point exceeds limit")
		}
	}
	raw, err := json.Marshal(sample)
	if err != nil || len(raw) > 65536 {
		return nil, fmt.Errorf("Probe telemetry sample exceeds limit")
	}
	return raw, nil
}

func CheckProbeTelemetryAck(sample ProbeTelemetrySample, body []byte, limits ProbeTelemetryLimits) error {
	if _, err := contracts.ParseJSON(body, 4096); err != nil {
		return err
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(body, &fields); err != nil || len(fields) != 13 {
		return fmt.Errorf("Probe telemetry ACK fields rejected")
	}
	for _, key := range []string{"probeTelemetryVersion", "kind", "nodeId", "bootId", "sessionEpoch", "sampleEpoch", "sequence", "receivedAt", "stored", "acceptedPoints", "rejectedPoints", "source", "executionAuthorized"} {
		value, exists := fields[key]
		if !exists || bytes.Equal(bytes.TrimSpace(value), []byte("null")) {
			return fmt.Errorf("Probe telemetry ACK field missing")
		}
	}
	var ack struct {
		ProbeTelemetryVersion int    `json:"probeTelemetryVersion"`
		Kind                  string `json:"kind"`
		NodeID                string `json:"nodeId"`
		BootID                string `json:"bootId"`
		SessionEpoch          uint64 `json:"sessionEpoch"`
		SampleEpoch           string `json:"sampleEpoch"`
		Sequence              uint64 `json:"sequence"`
		ReceivedAt            string `json:"receivedAt"`
		Stored                bool   `json:"stored"`
		AcceptedPoints        int    `json:"acceptedPoints"`
		RejectedPoints        int    `json:"rejectedPoints"`
		Source                string `json:"source"`
		ExecutionAuthorized   bool   `json:"executionAuthorized"`
	}
	if err := json.Unmarshal(body, &ack); err != nil {
		return err
	}
	received, timeErr := time.Parse(time.RFC3339Nano, ack.ReceivedAt)
	if ack.ProbeTelemetryVersion != 1 || ack.Kind != "probe-telemetry-ack" || ack.NodeID != sample.NodeID ||
		ack.BootID != sample.BootID || ack.SessionEpoch != sample.SessionEpoch || ack.SampleEpoch != sample.SampleEpoch ||
		ack.Sequence != sample.Sequence || !ack.Stored || ack.AcceptedPoints < 0 || ack.AcceptedPoints > limits.Page ||
		ack.RejectedPoints < 0 || ack.RejectedPoints > limits.Page || ack.AcceptedPoints+ack.RejectedPoints != len(sample.Items) ||
		ack.Source != "agent-reported" || ack.ExecutionAuthorized || timeErr != nil ||
		!probeTelemetryTimestamp.MatchString(ack.ReceivedAt) || received.Before(time.Unix(0, 0)) {
		return fmt.Errorf("Probe telemetry ACK identity or provenance rejected")
	}
	if ack.RejectedPoints != 0 {
		return fmt.Errorf("Probe telemetry points rejected")
	}
	return nil
}
