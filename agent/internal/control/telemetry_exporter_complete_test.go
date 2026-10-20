package control

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/executionchannel"
	"github.com/tunex/vnext/agent/internal/observationwire"
	"github.com/tunex/vnext/agent/internal/platformobservation"
	"github.com/tunex/vnext/agent/internal/platformruntime"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

type exporterCompleteTicker struct { ticks chan time.Time; stopped atomic.Int32 }
func (t *exporterCompleteTicker) C() <-chan time.Time { return t.ticks }
func (t *exporterCompleteTicker) Stop() { t.stopped.Add(1) }
type exporterCompleteTimer struct { ticks chan time.Time }
func (t *exporterCompleteTimer) C() <-chan time.Time { return t.ticks }
func (t *exporterCompleteTimer) Stop() bool { return true }
type exporterCompleteSchedule struct { platformruntime.Schedule; ticker *exporterCompleteTicker; ready chan struct{}; timers chan *exporterCompleteTimer; durations chan time.Duration; now time.Time }
func (s *exporterCompleteSchedule) NewTicker(interval time.Duration) runtimeplatform.Ticker { if interval != 10*time.Second { panic("exporter interval changed") }; close(s.ready); return s.ticker }
func (s *exporterCompleteSchedule) Now() time.Time { return s.now }
func (s *exporterCompleteSchedule) Since(start time.Time) time.Duration { return s.now.Sub(start) }
func (s *exporterCompleteSchedule) Until(deadline time.Time) time.Duration { return deadline.Sub(s.now) }
func (s *exporterCompleteSchedule) NewTimer(duration time.Duration) runtimeplatform.Timer { timer := &exporterCompleteTimer{ticks: make(chan time.Time, 1)}; if s.durations != nil { s.durations <- duration }; if s.timers != nil { s.timers <- timer }; return timer }
type exporterCompleteEntropy struct { calls, size int; seed byte; err error; short bool }
func (e *exporterCompleteEntropy) ReadRandom(raw []byte) (int, error) { e.calls++; e.size = len(raw); for i := range raw { raw[i] = e.seed+byte(i) }; if e.err != nil { return 0, e.err }; if e.short { return 1, nil }; return len(raw), nil }
type exporterCompleteChannel struct { executionchannel.Auxiliary[*http.Client]; clone func(string) (*http.Client, func(), bool); post func(context.Context, string, []byte, uint64) (executionchannel.Reply, error) }
func (c exporterCompleteChannel) CloneTelemetry(_ *http.Client, message string) (*http.Client, func(), bool) { return c.clone(message) }
func (c exporterCompleteChannel) PostTelemetry(ctx context.Context, _ *http.Client, _ string, path string, raw []byte, epoch uint64) (executionchannel.Reply, error) { return c.post(ctx, path, raw, epoch) }
func exporterCompleteRun(runner *Runner, family string, ctx context.Context, started time.Time) { switch family { case "process": runner.maintainTelemetry(ctx, started); case "host": runner.maintainHostTelemetry(ctx, started); case "forward": runner.maintainForwardTelemetry(ctx, started); case "probe": runner.maintainProbeTelemetry(ctx, started) } }

func TestTelemetryCompleteFourIndependentEpochsAndEntropyFailure(t *testing.T) {
	seen := map[string]bool{}
	for index, family := range []string{"process", "host", "forward", "probe"} {
		for _, failure := range []bool{true, false} {
			t.Run(family+map[bool]string{true: "/entropy-error", false: "/short-count-no-error"}[failure], func(t *testing.T) {
				now := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
				ticker := &exporterCompleteTicker{ticks: make(chan time.Time, 1)}; ticker.ticks <- now
				schedule := &exporterCompleteSchedule{ticker: ticker, ready: make(chan struct{}), now: now}
				entropy := &exporterCompleteEntropy{seed: byte(index*32), short: true}; if failure { entropy.err = errors.New("secure random unavailable") }
				ctx, cancel := context.WithCancel(context.Background()); defer cancel()
				cloned, closed, posted := 0, 0, 0
				channel := exporterCompleteChannel{clone: func(message string) (*http.Client, func(), bool) { cloned++; prefix := "Telemetry"; if family != "process" { prefix = strings.ToUpper(family[:1])+family[1:]+" telemetry" }; if message != prefix+" redirects are forbidden" { t.Fatalf("redirect %q", message) }; return &http.Client{}, func() { closed++ }, true }, post: func(_ context.Context, _ string, raw []byte, _ uint64) (executionchannel.Reply, error) {
					posted++; var sample map[string]any; if err := json.Unmarshal(raw, &sample); err != nil { t.Fatal(err) }; epoch, ok := sample["sampleEpoch"].(string); if !ok { t.Fatal("epoch missing") }
					want := make([]byte, 16); for i := range want { want[i] = byte(index*32+i) }; if epoch != hex.EncodeToString(want) || epoch != strings.ToLower(epoch) || seen[epoch] { t.Fatalf("epoch reuse/encoding: %q", epoch) }; seen[epoch] = true
					cancel(); return executionchannel.Reply{StatusCode: 503, Body: io.NopCloser(strings.NewReader("failure"))}, nil
				}}
				runner := &Runner{effects: Effects{Schedule: schedule, Auxiliary: channel}, local: LocalServices{Observation: platformobservation.Native{}, Entropy: entropy}}
				exporterCompleteRun(runner, family, ctx, now.Add(-time.Second))
				if entropy.calls != 1 || entropy.size != 16 || cloned != 1 || closed != 1 { t.Fatalf("entropy/pool lifecycle: %+v %d %d", entropy, cloned, closed) }
				if failure { if posted != 0 || ticker.stopped.Load() != 0 { t.Fatal("entropy error reached ticker/HTTP") }; select { case <-schedule.ready: t.Fatal("entropy error created ticker"); default: } } else if posted != 1 || ticker.stopped.Load() != 1 { t.Fatal("exporter retried or ticker not closed") }
			})
		}
	}
	if len(seen) != 4 { t.Fatal("four exporter epochs not independent") }
}

type exporterCompleteHostObserver struct { platformobservation.Native; started chan int; release chan struct{}; calls atomic.Int32 }
func (o *exporterCompleteHostObserver) Host() hostResources { call := int(o.calls.Add(1)); o.started <- call; if call == 1 { <-o.release; return platformobservation.EmptyHostResources("late") }; return platformobservation.EmptyHostResources("fresh") }

func TestTelemetryCompleteBlockedHostCutoffNoOverlapAndLateDrain(t *testing.T) {
	now := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	ticker := &exporterCompleteTicker{ticks: make(chan time.Time)}
	schedule := &exporterCompleteSchedule{ticker: ticker, ready: make(chan struct{}), timers: make(chan *exporterCompleteTimer, 8), durations: make(chan time.Duration, 8), now: now}
	observer := &exporterCompleteHostObserver{started: make(chan int, 8), release: make(chan struct{})}
	ctx, cancel := context.WithCancel(context.Background()); defer cancel()
	posted := make(chan hostTelemetrySample, 1)
	channel := exporterCompleteChannel{clone: func(string) (*http.Client, func(), bool) { return &http.Client{}, func(){}, true }, post: func(_ context.Context, _ string, raw []byte, _ uint64) (executionchannel.Reply, error) { var sample hostTelemetrySample; if err := json.Unmarshal(raw, &sample); err != nil { panic(err) }; posted <- sample; cancel(); return executionchannel.Reply{}, errors.New("one failed attempt") }}
	runner := &Runner{effects: Effects{Schedule: schedule, Auxiliary: channel}, local: LocalServices{Observation: observer, Entropy: &exporterCompleteEntropy{}}}
	done := make(chan struct{}); go func() { defer close(done); runner.maintainHostTelemetry(ctx, now) }()
	deadline := time.After(5*time.Second)
	select { case <-schedule.ready: case <-deadline: t.Fatal("ticker not created") }
	select { case ticker.ticks <- now: case <-deadline: t.Fatal("first tick blocked") }
	select { case call := <-observer.started: if call != 1 { t.Fatal("first host call") }; case <-deadline: t.Fatal("host did not start") }
	var first *exporterCompleteTimer
	select { case first = <-schedule.timers: case <-deadline: t.Fatal("host timer missing") }
	if duration := <-schedule.durations; duration != 500*time.Millisecond { t.Fatalf("host budget %v", duration) }
	first.ticks <- now.Add(500*time.Millisecond)
	for i:=0; i<2; i++ { select { case ticker.ticks <- now: case <-deadline: t.Fatal("pending tick blocked") } }
	if observer.calls.Load() != 1 { t.Fatal("blocked provider overlapped") }
	select { case <-posted: t.Fatal("timed-out Host result sent"); default: }
	close(observer.release)
	// Send ticks until the late buffered result is drained and a fresh capture starts.
	var sample hostTelemetrySample
	for {
		select {
		case ticker.ticks <- now:
		case sample = <-posted: goto received
		case <-deadline: t.Fatal("late result not drained/fresh capture unavailable")
		}
	}
received:
	if sample.Host.CPU.Availability != "fresh" || sample.Sequence < 4 || sample.DroppedSamples != observationCounterTextComplete(sample.Sequence-1) || observer.calls.Load() != 2 { t.Fatalf("late result/drop accounting: %+v calls=%d", sample, observer.calls.Load()) }
	select { case <-done: case <-deadline: t.Fatal("host exporter failed cancellation") }
	if ticker.stopped.Load() != 1 { t.Fatal("host ticker not stopped") }
}

func observationCounterTextComplete(value uint64) string { return observationwire.Uint64Text(value) }
