package observationwire

import (
	"bytes"
	"encoding/json"
	"os"
	"strings"
	"testing"
)

// Literal fixtures pin the native wire tags, field order and explicit null/empty
// representations. The schema files remain specifications, not these codecs.

func nativeWireFixtures(t *testing.T) map[string]string {
	t.Helper()
	raw, err := os.ReadFile("testdata/native-telemetry-fixtures.json")
	if err != nil { t.Fatal(err) }
	var fixtures map[string]string
	if err := json.Unmarshal(raw, &fixtures); err != nil { t.Fatal(err) }
	if len(fixtures) != 4 { t.Fatalf("expected four literal fixtures, got %d", len(fixtures)) }
	return fixtures
}

func decodeNativeFixture(t *testing.T, raw string, target any) {
	t.Helper()
	if err := json.Unmarshal([]byte(raw), target); err != nil {
		t.Fatal(err)
	}
}

func TestFourNativeTelemetryEncodersPreserveLiteralWireFixtures(t *testing.T) {
	fixtures := nativeWireFixtures(t)
	processFixture, hostFixture, forwardFixture, probeFixture := fixtures["process"], fixtures["host"], fixtures["forward"], fixtures["probe"]
	var process TelemetrySample
	var host HostTelemetrySample
	var forward ForwardTelemetrySample
	var probe ProbeTelemetrySample
	decodeNativeFixture(t, processFixture, &process)
	decodeNativeFixture(t, hostFixture, &host)
	decodeNativeFixture(t, forwardFixture, &forward)
	decodeNativeFixture(t, probeFixture, &probe)
	for _, entry := range []struct {
		name, expected string
		encode func() ([]byte, error)
	}{
		{"process", processFixture, func() ([]byte, error) { return EncodeTelemetrySample(process) }},
		{"host", hostFixture, func() ([]byte, error) { return EncodeHostTelemetrySample(host) }},
		{"forward", forwardFixture, func() ([]byte, error) { return EncodeForwardTelemetrySample(forward) }},
		{"probe", probeFixture, func() ([]byte, error) { return EncodeProbeTelemetrySample(probe, ProbeTelemetryLimits{32, 2, 8}) }},
	} {
		t.Run(entry.name, func(t *testing.T) {
			raw, err := entry.encode()
			if err != nil || string(raw) != entry.expected {
				t.Fatalf("native fixture mismatch: %v\n%s", err, raw)
			}
		})
	}
	// These codecs serialize native values; they do not silently replace unsupported
	// source states with fabricated measured zero counters.
	host.Host.Network.Interfaces = nil
	raw, err := EncodeHostTelemetrySample(host)
	if err != nil || !bytes.Contains(raw, []byte(`"interfaces":null`)) {
		t.Fatalf("nil collection representation changed: %v %s", err, raw)
	}
}

func TestFourNativeTelemetryAcknowledgementsRequireOriginalSentIdentityAndClosedReceipts(t *testing.T) {
	fixtures := nativeWireFixtures(t)
	processFixture, hostFixture, forwardFixture, probeFixture := fixtures["process"], fixtures["host"], fixtures["forward"], fixtures["probe"]
	var process TelemetrySample
	var host HostTelemetrySample
	var forward ForwardTelemetrySample
	var probe ProbeTelemetrySample
	decodeNativeFixture(t, processFixture, &process)
	decodeNativeFixture(t, hostFixture, &host)
	decodeNativeFixture(t, forwardFixture, &forward)
	decodeNativeFixture(t, probeFixture, &probe)
	for _, entry := range []struct {
		name, version string
		points bool
		check func([]byte) error
	}{
		{"telemetry", "telemetryVersion", false, func(raw []byte) error { return CheckTelemetryAck(process, raw) }},
		{"host-telemetry", "hostTelemetryVersion", false, func(raw []byte) error { return CheckHostTelemetryAck(host, raw) }},
		{"forward-telemetry", "forwardTelemetryVersion", true, func(raw []byte) error { return CheckForwardTelemetryAck(forward, raw) }},
		{"probe-telemetry", "probeTelemetryVersion", true, func(raw []byte) error { return CheckProbeTelemetryAck(probe, raw, ProbeTelemetryLimits{32, 2, 8}) }},
	} {
		t.Run(entry.name, func(t *testing.T) {
			ack := map[string]any{entry.version: 1, "kind": entry.name + "-ack", "nodeId": "node-1", "bootId": "boot-1",
				"sessionEpoch": 1, "sampleEpoch": strings.Repeat("a", 32), "sequence": 1, "stored": true,
				"receivedAt": "2026-10-19T00:00:00.123456789Z", "source": "agent-reported", "executionAuthorized": false}
			if entry.points { ack["acceptedPoints"], ack["rejectedPoints"] = 1, 0 }
			encode := func(value map[string]any) []byte { raw, err := json.Marshal(value); if err != nil { t.Fatal(err) }; return raw }
			if err := entry.check(encode(ack)); err != nil { t.Fatal(err) }
			for key, original := range ack {
				delete(ack, key)
				if entry.check(encode(ack)) == nil { t.Fatalf("missing %s accepted", key) }
				ack[key] = nil
				if entry.check(encode(ack)) == nil { t.Fatalf("null %s accepted", key) }
				ack[key] = []any{}
				if entry.check(encode(ack)) == nil { t.Fatalf("wrong type %s accepted", key) }
				ack[key] = original
			}
			mutations := map[string]any{entry.version: 2, "kind": "other", "nodeId": "other-node", "bootId": "other-boot",
				"sessionEpoch": 2, "sampleEpoch": strings.Repeat("b", 32), "sequence": 2, "stored": false,
				"receivedAt": "1969-12-31T23:59:59Z", "source": "server-trusted", "executionAuthorized": true}
			for key, value := range mutations {
				original := ack[key]; ack[key] = value
				if entry.check(encode(ack)) == nil { t.Fatalf("changed %s accepted", key) }
				ack[key] = original
			}
			for _, value := range []string{"2026-02-30T00:00:00Z", "2026-10-19T00:00:00+00:00", "2026-10-19T00:00:00Z trailing"} {
				ack["receivedAt"] = value
				if entry.check(encode(ack)) == nil { t.Fatalf("timestamp %q accepted", value) }
			}
			ack["receivedAt"] = "2026-10-19T00:00:00.123456789Z"
			ack["unknown"] = true
			if entry.check(encode(ack)) == nil { t.Fatal("extra field accepted") }
			delete(ack, "unknown")
			raw := encode(ack)
			duplicate := append([]byte(`{"nodeId":"node-1",`), raw[1:]...)
			for _, body := range [][]byte{duplicate, []byte("{} {}"), []byte("{ malformed JSON"), bytes.Repeat([]byte(" "), 4097)} {
				if entry.check(body) == nil { t.Fatal("invalid raw receipt accepted") }
			}
			if entry.points {
				for _, counts := range [][2]int{{0, 0}, {2, 0}, {0, 1}, {33, 0}, {-1, 2}} {
					ack["acceptedPoints"], ack["rejectedPoints"] = counts[0], counts[1]
					if entry.check(encode(ack)) == nil { t.Fatalf("unaccounted/rejected page accepted: %v", counts) }
				}
			}
		})
	}
}

func TestNativeTelemetryEncodersPreserveOriginalPageIdentityAndSizeLimits(t *testing.T) {
	fixtures := nativeWireFixtures(t)
	hostFixture, forwardFixture, probeFixture := fixtures["host"], fixtures["forward"], fixtures["probe"]
	var host HostTelemetrySample
	decodeNativeFixture(t, hostFixture, &host)
	host.Host.Scope = strings.Repeat("x", 8192)
	if _, err := EncodeHostTelemetrySample(host); err == nil { t.Fatal("oversized host sample accepted") }
	for _, mutate := range []func(*ForwardTelemetrySample){
		func(s *ForwardTelemetrySample) { s.Items = make([]ForwardCounterPoint, 33) },
		func(s *ForwardTelemetrySample) { s.Items[0].Identity.NodeID = "other-node" },
		func(s *ForwardTelemetrySample) { s.Items[0].Identity.BootID = "other-boot" },
		func(s *ForwardTelemetrySample) { s.Items[0].Identity.SessionEpoch = 2 },
		func(s *ForwardTelemetrySample) { s.Items[0].Identity.ConfigDigest = strings.Repeat("x", 4096) },
		func(s *ForwardTelemetrySample) { s.Kind = strings.Repeat("x", 65536) },
	} {
		var sample ForwardTelemetrySample; decodeNativeFixture(t, forwardFixture, &sample); mutate(&sample)
		if _, err := EncodeForwardTelemetrySample(sample); err == nil { t.Fatal("invalid Forward page accepted") }
	}
	for _, mutate := range []func(*ProbeTelemetrySample){
		func(s *ProbeTelemetrySample) { s.Items = make([]ProbeCounterPoint, 33) },
		func(s *ProbeTelemetrySample) { s.Coverage.RetiringSources = 9 },
		func(s *ProbeTelemetrySample) { s.Coverage.RetiringSources = -1 },
		func(s *ProbeTelemetrySample) { s.Coverage.Available = 385 },
		func(s *ProbeTelemetrySample) { s.Coverage.Returned = 0 },
		func(s *ProbeTelemetrySample) { s.Coverage.Omitted = 1 },
		func(s *ProbeTelemetrySample) { s.Items[0].Identity.Binding.NodeId = "other-node" },
		func(s *ProbeTelemetrySample) { s.Items[0].Identity.Binding.BootId = "other-boot" },
		func(s *ProbeTelemetrySample) { s.Items[0].Identity.Binding.SessionEpoch = 2 },
		func(s *ProbeTelemetrySample) { s.Items[0].Identity.InstanceID = strings.Repeat("x", 4096) },
		func(s *ProbeTelemetrySample) { s.Kind = strings.Repeat("x", 65536) },
		func(s *ProbeTelemetrySample) {
			s.Items = append(s.Items, s.Items[0], s.Items[0]); s.Items[1].Identity.Binding.SnapshotGeneration = 2
			s.Items[2].Identity.Binding.SnapshotGeneration = 3; s.Coverage.Available = 3; s.Coverage.Returned = 3
		},
	} {
		var sample ProbeTelemetrySample; decodeNativeFixture(t, probeFixture, &sample); mutate(&sample)
		if _, err := EncodeProbeTelemetrySample(sample, ProbeTelemetryLimits{32, 2, 8}); err == nil { t.Fatal("invalid Probe page accepted") }
	}
}
