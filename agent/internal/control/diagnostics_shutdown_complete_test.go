package control

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"net/http"
	"reflect"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/authorization"
	"github.com/tunex/vnext/agent/internal/executionchannel"
	"github.com/tunex/vnext/agent/internal/executionidentity"
	"github.com/tunex/vnext/agent/internal/platformruntime"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

type diagnosticShutdownCompleteTrace struct { mutex sync.Mutex; values []string }
func (s *diagnosticShutdownCompleteTrace) add(value string) { s.mutex.Lock(); defer s.mutex.Unlock(); s.values = append(s.values, value) }
func (s *diagnosticShutdownCompleteTrace) read() []string { s.mutex.Lock(); defer s.mutex.Unlock(); return append([]string(nil), s.values...) }
type diagnosticShutdownCompleteStream struct { execution; closed atomic.Bool; trace *diagnosticShutdownCompleteTrace }
func (s *diagnosticShutdownCompleteStream) Remaining() uint64 { return 0 }
func (s *diagnosticShutdownCompleteStream) Close() { s.closed.Store(true); s.trace.add("execution-close") }
type diagnosticShutdownCompleteSchedule struct { platformruntime.Schedule; now time.Time; diagnostic, counters, guard *exporterCompleteTicker; ready chan time.Duration }
func (s diagnosticShutdownCompleteSchedule) Now() time.Time { return s.now }
func (s diagnosticShutdownCompleteSchedule) Until(deadline time.Time) time.Duration { return deadline.Sub(s.now) }
func (s diagnosticShutdownCompleteSchedule) NewTicker(interval time.Duration) runtimeplatform.Ticker { var ticker *exporterCompleteTicker; switch interval { case 500*time.Millisecond: ticker = s.diagnostic; case 10*time.Second: ticker = s.counters; case 100*time.Millisecond: ticker = s.guard; default: panic("unexpected shutdown ticker") }; s.ready <- interval; return ticker }
type diagnosticShutdownCompleteIdentity struct { executionidentity.Provider[tls.Certificate, *x509.CertPool]; entered, release chan struct{}; failure error }
func (p diagnosticShutdownCompleteIdentity) Locations(string, string, string) executionidentity.Locations { return executionidentity.Locations{} }
func (p diagnosticShutdownCompleteIdentity) LoadMachine(executionidentity.Locations, string, *x509.CertPool) (executionidentity.MachineIdentity[tls.Certificate], error) { close(p.entered); <-p.release; return executionidentity.MachineIdentity[tls.Certificate]{}, p.failure }
type diagnosticShutdownCompleteChannel struct { executionchannel.Provider[*http.Client, *x509.CertPool, tls.Certificate]; hello []byte; trace *diagnosticShutdownCompleteTrace }
func (c diagnosticShutdownCompleteChannel) Request(_ context.Context, _ *http.Client, _, method, path string, _ []byte, epoch bool, _ uint64) ([]byte, error) { if method != "POST" || path != "/agent/v3/hello" || epoch { panic("unexpected shutdown request") }; return c.hello, nil }
func (c diagnosticShutdownCompleteChannel) CloseIdleConnections(*http.Client) { c.trace.add("close-idle") }
type diagnosticShutdownCompleteFiles struct { runner *Runner; stream *diagnosticShutdownCompleteStream; trace *diagnosticShutdownCompleteTrace; failure error }
func (f diagnosticShutdownCompleteFiles) write(kind, path string, raw []byte) error {
	if path != "local/custom-status.json" { panic("diagnostics configured path changed") }
	var value map[string]any; if json.Unmarshal(raw, &value) != nil { panic("diagnostics encoding failed") }
	if f.stream.closed.Load() { if len(f.runner.instances) != 0 { panic("final measurement before execution cleanup") }; if kind == "diagnostics" && value["authorizationActive"] != false { panic("final diagnostics still authoritative") }; f.trace.add("final-"+kind); return nil }
	f.trace.add("periodic-"+kind); return f.failure
}
func (f diagnosticShutdownCompleteFiles) WriteDiagnostics(path string, raw []byte) error { return f.write("diagnostics", path, raw) }
func (f diagnosticShutdownCompleteFiles) WriteForwardCounters(path string, raw []byte) error { return f.write("counters", path, raw) }
type diagnosticShutdownCompleteLog struct { trace *diagnosticShutdownCompleteTrace; warnings chan []any }
func (l diagnosticShutdownCompleteLog) Warn(values ...any) { l.trace.add("warning"); l.warnings <- append([]any(nil), values...) }

func TestDiagnosticsCompletePeriodicWarningArgumentsAndFinalAfterExecutionShutdown(t *testing.T) {
	now := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	trace := &diagnosticShutdownCompleteTrace{}
	ticker := func() *exporterCompleteTicker { return &exporterCompleteTicker{ticks: make(chan time.Time)} }
	schedule := diagnosticShutdownCompleteSchedule{now: now, diagnostic: ticker(), counters: ticker(), guard: ticker(), ready: make(chan time.Duration, 3)}
	failure := errors.New("original reload failure")
	identity := diagnosticShutdownCompleteIdentity{entered: make(chan struct{}), release: make(chan struct{}), failure: failure}
	var release sync.Once; defer release.Do(func() { close(identity.release) })
	hello := adp3.HelloResponse{ProtocolVersion: 3, NodeId: "node", BootId: "boot", SessionEpoch: 2, ServerTime: now.Format(time.RFC3339Nano), Policy: timeOwnerPolicy()}
	raw, err := json.Marshal(hello); if err != nil { t.Fatal(err) }
	runner := &Runner{options: Options{NodeID: "node", BootID: "boot", Diagnostics: "local/custom-status.json"}, credentialUntil: now.Add(24*time.Hour), effects: Effects{Schedule: schedule}, providers: Providers{Identity: identity, Channel: diagnosticShutdownCompleteChannel{hello: raw, trace: trace}}}
	runner.clock = func() (authorization.Sample, error) { return authorization.Sample{Wall: now, Uptime: time.Hour}, nil }
	stream := &diagnosticShutdownCompleteStream{trace: trace}
	runner.instances = map[string]running{"active": {assignment: adp3.Assignment{Protocol: "tcp"}, stream: stream}}
	warnings := make(chan []any, 4)
	runner.local = LocalServices{Observation: timeOwnerObservation{}, Measurements: diagnosticShutdownCompleteFiles{runner: runner, stream: stream, trace: trace, failure: errors.New("measurement failure")}, Log: diagnosticShutdownCompleteLog{trace: trace, warnings: warnings}}
	finished := make(chan error, 1); go func() { finished <- runner.Run(context.Background()) }()
	deadline := time.After(5*time.Second)
	for i:=0; i<3; i++ { select { case <-schedule.ready: case <-deadline: t.Fatal("diagnostics/guard workers did not start") } }
	select { case <-identity.entered: case <-deadline: t.Fatal("Run did not reach reload") }
	for _, entry := range []struct{ ticks chan time.Time; want string }{{schedule.diagnostic.ticks, "Local diagnostics unavailable"}, {schedule.counters.ticks, "Local forward counters unavailable"}} {
		select { case entry.ticks <- now: case <-deadline: t.Fatal("periodic measurement blocked") }
		select { case args := <-warnings: if !reflect.DeepEqual(args, []any{entry.want}) { t.Fatalf("warning arguments: %#v", args) }; case <-deadline: t.Fatal("warning not delivered") }
	}
	release.Do(func() { close(identity.release) })
	select { case err := <-finished: if err != failure { t.Fatalf("measurement errors changed Run failure: %v", err) }; case <-deadline: t.Fatal("Run failed to drain workers") }
	want := []string{"periodic-diagnostics", "warning", "periodic-counters", "warning", "execution-close", "final-diagnostics", "final-counters", "close-idle"}
	if !reflect.DeepEqual(trace.read(), want) { t.Fatalf("shutdown/warning order: %v", trace.read()) }
	for _, ticker := range []*exporterCompleteTicker{schedule.diagnostic, schedule.counters, schedule.guard} { if ticker.stopped.Load() != 1 { t.Fatal("Run did not drain worker ticker") } }
}
