package nativeexecution

import (
	"encoding/json"

	"github.com/tunex/vnext/agent/internal/adp3"
)

// These codecs preserve the existing ADP/3 representation. Identity, freshness,
// protected history and execution decisions remain with the Runner owner.
func EncodeRunnerHello(hello adp3.HelloRequest) ([]byte, error) {
	return json.Marshal(hello)
}

func DecodeRunnerHello(raw []byte) (adp3.HelloResponse, error) {
	value, err := adp3.Parse("HelloResponse", raw)
	if err != nil {
		return adp3.HelloResponse{}, err
	}
	return value.(adp3.HelloResponse), nil
}

func DecodeRunnerSnapshot(raw []byte) (adp3.Snapshot, error) {
	value, err := adp3.Parse("Snapshot", raw)
	if err != nil {
		return adp3.Snapshot{}, err
	}
	return value.(adp3.Snapshot), nil
}

// Retained bytes were authenticated by the original Journal owner. Keep its
// original JSON-only recovery path distinct from live strict wire parsing.
func DecodeRetainedRunnerSnapshot(raw []byte) (adp3.Snapshot, error) {
	var snapshot adp3.Snapshot
	err := json.Unmarshal(raw, &snapshot)
	return snapshot, err
}

func EncodeRunnerReport(report adp3.ReportRequest) ([]byte, error) {
	if report.Observations == nil {
		report.Observations = []adp3.Observation{}
	}
	return json.Marshal(report)
}

func DecodeRunnerReportAck(raw []byte) (adp3.ReportAck, error) {
	value, err := adp3.Parse("ReportAck", raw)
	if err != nil {
		return adp3.ReportAck{}, err
	}
	return value.(adp3.ReportAck), nil
}

// Pending reports are locally encoded, not new wire input. Retain the old
// best-effort projection, including partially decoded fields on a JSON error.
func DecodePendingRunnerReport(raw []byte) adp3.ReportRequest {
	var report adp3.ReportRequest
	_ = json.Unmarshal(raw, &report)
	return report
}
