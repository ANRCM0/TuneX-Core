package observationwire

import (
	"bytes"
	"encoding/json"
	"fmt"
	"regexp"
	"time"

	"github.com/tunex/vnext/agent/internal/contracts"
)

const ForwardTelemetryLimit = 32

var forwardTelemetryTimestamp = regexp.MustCompile(`^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,9})?Z$`)

type ForwardTelemetrySample struct {
	ForwardTelemetryVersion int                    `json:"forwardTelemetryVersion"`
	Kind                    string                 `json:"kind"`
	NodeID                  string                 `json:"nodeId"`
	BootID                  string                 `json:"bootId"`
	SessionEpoch            uint64                 `json:"sessionEpoch"`
	SampleEpoch             string                 `json:"sampleEpoch"`
	Sequence                uint64                 `json:"sequence"`
	CapturedAt              string                 `json:"capturedAt"`
	UptimeMs                int64                  `json:"uptimeMs"`
	SnapshotGeneration      uint64                 `json:"snapshotGeneration"`
	DroppedSamples          string                 `json:"droppedSamples"`
	Coverage                ForwardCounterCoverage `json:"coverage"`
	Items                   []ForwardCounterPoint  `json:"items"`
}

func EncodeForwardTelemetrySample(sample ForwardTelemetrySample) ([]byte, error) {
	if len(sample.Items) > ForwardTelemetryLimit {
		return nil, fmt.Errorf("Forward telemetry page exceeds limit")
	}
	for _, item := range sample.Items {
		identity := item.Identity
		if identity.NodeID != sample.NodeID || identity.BootID != sample.BootID || identity.SessionEpoch != sample.SessionEpoch {
			return nil, fmt.Errorf("Forward telemetry point identity differs")
		}
		point, err := json.Marshal(item)
		if err != nil || len(point) > 4096 {
			return nil, fmt.Errorf("Forward telemetry point exceeds limit")
		}
	}
	raw, err := json.Marshal(sample)
	if err != nil || len(raw) > 65536 {
		return nil, fmt.Errorf("Forward telemetry sample exceeds limit")
	}
	return raw, nil
}

func CheckForwardTelemetryAck(sample ForwardTelemetrySample, body []byte) error {
	if _, err := contracts.ParseJSON(body, 4096); err != nil {
		return err
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(body, &fields); err != nil || len(fields) != 13 {
		return fmt.Errorf("Forward telemetry ACK fields rejected")
	}
	for _, key := range []string{"forwardTelemetryVersion", "kind", "nodeId", "bootId", "sessionEpoch", "sampleEpoch", "sequence", "receivedAt", "stored", "acceptedPoints", "rejectedPoints", "source", "executionAuthorized"} {
		value, exists := fields[key]
		if !exists || bytes.Equal(bytes.TrimSpace(value), []byte("null")) {
			return fmt.Errorf("Forward telemetry ACK field missing")
		}
	}
	var ack struct {
		ForwardTelemetryVersion int    `json:"forwardTelemetryVersion"`
		Kind                    string `json:"kind"`
		NodeID                  string `json:"nodeId"`
		BootID                  string `json:"bootId"`
		SessionEpoch            uint64 `json:"sessionEpoch"`
		SampleEpoch             string `json:"sampleEpoch"`
		Sequence                uint64 `json:"sequence"`
		ReceivedAt              string `json:"receivedAt"`
		Stored                  bool   `json:"stored"`
		AcceptedPoints          int    `json:"acceptedPoints"`
		RejectedPoints          int    `json:"rejectedPoints"`
		Source                  string `json:"source"`
		ExecutionAuthorized     bool   `json:"executionAuthorized"`
	}
	if err := json.Unmarshal(body, &ack); err != nil {
		return err
	}
	received, timeErr := time.Parse(time.RFC3339Nano, ack.ReceivedAt)
	if ack.ForwardTelemetryVersion != 1 || ack.Kind != "forward-telemetry-ack" || ack.NodeID != sample.NodeID ||
		ack.BootID != sample.BootID || ack.SessionEpoch != sample.SessionEpoch || ack.SampleEpoch != sample.SampleEpoch ||
		ack.Sequence != sample.Sequence || !ack.Stored || ack.AcceptedPoints < 0 || ack.AcceptedPoints > ForwardTelemetryLimit ||
		ack.RejectedPoints < 0 || ack.RejectedPoints > ForwardTelemetryLimit || ack.AcceptedPoints+ack.RejectedPoints != len(sample.Items) ||
		ack.Source != "agent-reported" || ack.ExecutionAuthorized || timeErr != nil ||
		!forwardTelemetryTimestamp.MatchString(ack.ReceivedAt) || received.Before(time.Unix(0, 0)) {
		return fmt.Errorf("Forward telemetry ACK identity or provenance rejected")
	}
	if ack.RejectedPoints != 0 {
		return fmt.Errorf("Forward telemetry points rejected")
	}
	return nil
}
