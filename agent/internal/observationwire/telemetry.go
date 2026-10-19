package observationwire

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/tunex/vnext/agent/internal/contracts"
)

type TelemetryProcess struct {
	Goroutines          int     `json:"goroutines"`
	HeapAllocBytes      string  `json:"heapAllocBytes"`
	RuntimeBytes        string  `json:"runtimeBytes"`
	CPUTimeNanos        *string `json:"cpuTimeNanos"`
	MaxRSSBytes         *string `json:"maxRssBytes"`
	OpenFileDescriptors *int    `json:"openFileDescriptors"`
}

type TelemetryRuntime struct {
	SnapshotGeneration  uint64 `json:"snapshotGeneration"`
	AuthorizationActive bool   `json:"authorizationActive"`
	TCPStreams          string `json:"tcpStreams"`
	UDPAssociations     string `json:"udpAssociations"`
	DrainingInstances   int    `json:"drainingInstances"`
}

type TelemetrySample struct {
	TelemetryVersion uint64           `json:"telemetryVersion"`
	Kind             string           `json:"kind"`
	NodeID           string           `json:"nodeId"`
	BootID           string           `json:"bootId"`
	SessionEpoch     uint64           `json:"sessionEpoch"`
	SampleEpoch      string           `json:"sampleEpoch"`
	Sequence         uint64           `json:"sequence"`
	CapturedAt       string           `json:"capturedAt"`
	UptimeMs         int64            `json:"uptimeMs"`
	Platform         string           `json:"platform"`
	Process          TelemetryProcess `json:"process"`
	Runtime          TelemetryRuntime `json:"runtime"`
	DroppedSamples   string           `json:"droppedSamples"`
}

func EncodeTelemetrySample(sample TelemetrySample) ([]byte, error) {
	raw, err := json.Marshal(sample)
	if err != nil {
		return nil, err
	}
	return raw, nil
}

func CheckTelemetryAck(sample TelemetrySample, body []byte) error {
	if _, err := contracts.ParseJSON(body, 4096); err != nil {
		return err
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(body, &fields); err != nil || len(fields) != 11 {
		return fmt.Errorf("Telemetry ACK fields rejected")
	}
	for _, key := range []string{"telemetryVersion", "kind", "nodeId", "bootId", "sessionEpoch", "sampleEpoch", "sequence", "stored", "receivedAt", "source", "executionAuthorized"} {
		value, exists := fields[key]
		if !exists || bytes.Equal(bytes.TrimSpace(value), []byte("null")) {
			return fmt.Errorf("Telemetry ACK field missing")
		}
	}
	var ack struct {
		TelemetryVersion    uint64 `json:"telemetryVersion"`
		Kind                string `json:"kind"`
		NodeID              string `json:"nodeId"`
		BootID              string `json:"bootId"`
		SessionEpoch        uint64 `json:"sessionEpoch"`
		SampleEpoch         string `json:"sampleEpoch"`
		Sequence            uint64 `json:"sequence"`
		Stored              bool   `json:"stored"`
		ReceivedAt          string `json:"receivedAt"`
		Source              string `json:"source"`
		ExecutionAuthorized bool   `json:"executionAuthorized"`
	}
	if err := json.Unmarshal(body, &ack); err != nil {
		return err
	}
	received, timeErr := time.Parse(time.RFC3339Nano, ack.ReceivedAt)
	if ack.TelemetryVersion != 1 || ack.Kind != "telemetry-ack" || ack.NodeID != sample.NodeID ||
		ack.BootID != sample.BootID || ack.SessionEpoch != sample.SessionEpoch || ack.SampleEpoch != sample.SampleEpoch ||
		ack.Sequence != sample.Sequence || !ack.Stored || ack.Source != "agent-reported" || ack.ExecutionAuthorized || timeErr != nil ||
		!strings.HasSuffix(ack.ReceivedAt, "Z") || received.Before(time.Unix(0, 0)) {
		return fmt.Errorf("Telemetry ACK identity or provenance rejected")
	}
	return nil
}
