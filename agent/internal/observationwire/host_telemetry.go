package observationwire

import (
	"bytes"
	"encoding/json"
	"fmt"
	"regexp"
	"time"

	"github.com/tunex/vnext/agent/internal/contracts"
)

var hostTelemetryTimestamp = regexp.MustCompile(`^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,9})?Z$`)

type HostTelemetrySample struct {
	HostTelemetryVersion int           `json:"hostTelemetryVersion"`
	Kind                 string        `json:"kind"`
	NodeID               string        `json:"nodeId"`
	BootID               string        `json:"bootId"`
	SessionEpoch         uint64        `json:"sessionEpoch"`
	SampleEpoch          string        `json:"sampleEpoch"`
	Sequence             uint64        `json:"sequence"`
	CapturedAt           string        `json:"capturedAt"`
	UptimeMs             int64         `json:"uptimeMs"`
	Platform             string        `json:"platform"`
	DroppedSamples       string        `json:"droppedSamples"`
	Host                 HostResources `json:"host"`
}

func EncodeHostTelemetrySample(sample HostTelemetrySample) ([]byte, error) {
	raw, err := json.Marshal(sample)
	if err != nil || len(raw) > 8192 {
		return nil, fmt.Errorf("Host telemetry sample exceeds limit")
	}
	return raw, nil
}

func CheckHostTelemetryAck(sample HostTelemetrySample, body []byte) error {
	if _, err := contracts.ParseJSON(body, 4096); err != nil {
		return err
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(body, &fields); err != nil || len(fields) != 11 {
		return fmt.Errorf("Host telemetry ACK fields rejected")
	}
	for _, key := range []string{"hostTelemetryVersion", "kind", "nodeId", "bootId", "sessionEpoch", "sampleEpoch", "sequence", "stored", "receivedAt", "source", "executionAuthorized"} {
		value, exists := fields[key]
		if !exists || bytes.Equal(bytes.TrimSpace(value), []byte("null")) {
			return fmt.Errorf("Host telemetry ACK field missing")
		}
	}
	var ack struct {
		HostTelemetryVersion int    `json:"hostTelemetryVersion"`
		Kind                 string `json:"kind"`
		NodeID               string `json:"nodeId"`
		BootID               string `json:"bootId"`
		SessionEpoch         uint64 `json:"sessionEpoch"`
		SampleEpoch          string `json:"sampleEpoch"`
		Sequence             uint64 `json:"sequence"`
		Stored               bool   `json:"stored"`
		ReceivedAt           string `json:"receivedAt"`
		Source               string `json:"source"`
		ExecutionAuthorized  bool   `json:"executionAuthorized"`
	}
	if err := json.Unmarshal(body, &ack); err != nil {
		return err
	}
	received, timeErr := time.Parse(time.RFC3339Nano, ack.ReceivedAt)
	if ack.HostTelemetryVersion != 1 || ack.Kind != "host-telemetry-ack" || ack.NodeID != sample.NodeID ||
		ack.BootID != sample.BootID || ack.SessionEpoch != sample.SessionEpoch || ack.SampleEpoch != sample.SampleEpoch ||
		ack.Sequence != sample.Sequence || !ack.Stored || ack.Source != "agent-reported" || ack.ExecutionAuthorized ||
		timeErr != nil || !hostTelemetryTimestamp.MatchString(ack.ReceivedAt) || received.Before(time.Unix(0, 0)) {
		return fmt.Errorf("Host telemetry ACK identity or provenance rejected")
	}
	return nil
}
