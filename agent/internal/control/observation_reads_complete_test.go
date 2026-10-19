package control

import (
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/platformobservation"
	"github.com/tunex/vnext/agent/internal/runtimeobservation"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

type observationReadsComplete struct { runner *Runner; trace *[]string; cpu, rss int64; fd int }
func (o *observationReadsComplete) read(name string) { if !o.runner.mutex.TryLock() { panic("OS observation under Runner lock: "+name) }; o.runner.mutex.Unlock(); *o.trace = append(*o.trace, name) }
func (o *observationReadsComplete) Memory() runtimeobservation.MemorySample { o.read("memory"); return runtimeobservation.MemorySample{HeapAllocBytes: 123, RuntimeBytes: 456} }
func (o *observationReadsComplete) Process() runtimeobservation.ProcessSample { o.read("process"); return runtimeobservation.ProcessSample{CPUTimeNanos: &o.cpu, MaxRSSBytes: &o.rss, OpenFileDescriptors: &o.fd} }
func (o *observationReadsComplete) ProcessID() int { o.read("pid"); return 42 }
func (o *observationReadsComplete) Platform() string { o.read("platform"); return "opaque-platform" }
func (o *observationReadsComplete) Goroutines() int { o.read("goroutines"); return 17 }
func (o *observationReadsComplete) Host() hostResources { o.read("host"); return platformobservation.EmptyHostResources("opaque") }
type observationReadsCompleteSchedule struct { runtimeplatform.Scheduler; observer *observationReadsComplete; now time.Time }
func (s observationReadsCompleteSchedule) Now() time.Time { s.observer.read("now"); return s.now }
type observationReadsCompleteStream struct { execution; runner *Runner; trace *[]string; locked bool }
func (s observationReadsCompleteStream) Remaining() uint64 {
	acquired := s.runner.mutex.TryLock(); if acquired { s.runner.mutex.Unlock() }
	if acquired == s.locked { panic("Remaining Runner lock scope changed") }
	*s.trace = append(*s.trace, "remaining"); return 7
}
type observationReadsCompleteFiles struct { runtimeplatform.MeasurementFiles; trace *[]string; path string; raw []byte; err error }
func (f *observationReadsCompleteFiles) WriteDiagnostics(path string, raw []byte) error { *f.trace = append(*f.trace, "write"); f.path = path; f.raw = append([]byte(nil), raw...); return f.err }

func TestObservationCompleteOriginalReadOrderAndRunnerLockScope(t *testing.T) {
	for _, diagnostics := range []bool{false, true} {
		trace := []string{}
		runner := &Runner{options: Options{NodeID: "node", BootID: "boot", Diagnostics: "configured/status.json"}}
		observer := &observationReadsComplete{runner: runner, trace: &trace, cpu: 1001, rss: 2002, fd: 3}
		now := time.Date(2026, 1, 2, 3, 4, 5, 600, time.FixedZone("offset", 3600))
		runner.local.Observation = observer
		runner.effects.Schedule = observationReadsCompleteSchedule{observer: observer, now: now}
		runner.instances = map[string]running{"one": {assignment: adp3.Assignment{AssignmentId: "a", Protocol: "tcp"}, stream: observationReadsCompleteStream{runner: runner, trace: &trace, locked: diagnostics}}}
		if diagnostics {
			original := errors.New("measurement failure")
			files := &observationReadsCompleteFiles{trace: &trace, err: original}; runner.local.Measurements = files
			if err := runner.writeDiagnostics(true); err != original { t.Fatalf("write error identity: %v", err) }
			if !reflect.DeepEqual(trace, []string{"memory", "remaining", "process", "now", "pid", "platform", "goroutines", "write"}) { t.Fatalf("diagnostics trace: %v", trace) }
			if files.path != "configured/status.json" { t.Fatalf("configured path %q", files.path) }
			var actual map[string]any; if err := json.Unmarshal(files.raw, &actual); err != nil { t.Fatal(err) }
			for key, want := range map[string]any{"pid": float64(42), "platform": "opaque-platform", "goroutines": float64(17), "heapAllocBytes": float64(123), "runtimeBytes": float64(456), "cpuTimeNanos": float64(1001), "maxRSSBytes": float64(2002), "openFileDescriptors": float64(3), "tcpStreams": float64(7), "authorizationActive": false, "capturedAt": "2026-01-02T02:04:05.0000006Z"} { if actual[key] != want { t.Fatalf("diagnostic %s: %v", key, actual[key]) } }
		} else {
			sample := runner.captureTelemetry(now.Add(-time.Second), "epoch", 1, 2)
			if !reflect.DeepEqual(trace, []string{"remaining", "memory", "process", "now", "platform", "goroutines"}) { t.Fatalf("telemetry trace: %v", trace) }
			if sample.UptimeMs != 1000 || sample.CapturedAt != "2026-01-02T02:04:05.0000006Z" || sample.Platform != "opaque-platform" || sample.Process.Goroutines != 17 || sample.Process.HeapAllocBytes != "123" || sample.Process.RuntimeBytes != "456" || *sample.Process.CPUTimeNanos != "1001" || *sample.Process.MaxRSSBytes != "2002" || sample.Process.OpenFileDescriptors != &observer.fd || sample.Runtime.TCPStreams != "7" || sample.DroppedSamples != "2" { t.Fatalf("telemetry values: %+v", sample) }
		}
	}
}

func TestObservationCompleteDisabledAndDefaultWrappers(t *testing.T) {
	// Nil injected ports panic if touched; disabled diagnostics must return first.
	if err := (&Runner{}).writeDiagnostics(false); err != nil { t.Fatal(err) }
	runner := &Runner{}
	if reflect.TypeOf(runner.observer()) != reflect.TypeOf(defaultLocalServices().Observation) || reflect.TypeOf(runner.entropy()) != reflect.TypeOf(defaultLocalServices().Entropy) || reflect.TypeOf(runner.measurementFiles()) != reflect.TypeOf(defaultLocalServices().Measurements) || reflect.TypeOf(runner.localLog()) != reflect.TypeOf(defaultLocalServices().Log) { t.Fatal("retained native local wrappers changed family") }
	if optionalTelemetryCounter(nil) != nil { t.Fatal("absent counter became zero") }
	zero, negative := int64(0), int64(-1)
	if got := optionalTelemetryCounter(&zero); got == nil || *got != "0" { t.Fatal("present zero absent") }
	if optionalTelemetryCounter(&negative) != nil { t.Fatal("negative process counter became unsigned") }
}
