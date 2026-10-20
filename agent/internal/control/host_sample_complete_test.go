package control

import (
	"context"
	"net/http"
	"reflect"
	"sync/atomic"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/executionchannel"
	"github.com/tunex/vnext/agent/internal/platformobservation"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

func TestHostCompleteNativeCaptureKeepsResourcesAndOnlyReadsNowPlatform(t *testing.T) {
	trace := []string{}
	runner := &Runner{options: Options{NodeID: "node", BootID: "boot"}}
	observer := &observationReadsComplete{runner: runner, trace: &trace}
	now := time.Date(2026, 1, 2, 3, 4, 5, 123, time.FixedZone("offset", -3600))
	runner.local.Observation = observer; runner.effects.Schedule = observationReadsCompleteSchedule{observer: observer, now: now}
	count, ticks := 4, "18446744073709551615"
	resources := platformobservation.EmptyHostResources("available")
	resources.CPU.LogicalProcessors, resources.CPU.TotalTicks = &count, &ticks
	resources.Network.Interfaces = []hostNetworkInterface{{Name: "eth0", RXBytes: "0", TXBytes: "1"}}
	sample := runner.captureHostTelemetry(now.Add(-1234*time.Millisecond), "epoch", 9, 8, resources)
	if !reflect.DeepEqual(trace, []string{"now", "platform"}) || !reflect.DeepEqual(sample.Host, resources) || sample.Host.CPU.TotalTicks != &ticks || sample.Host.CPU.LogicalProcessors != &count || &sample.Host.Network.Interfaces[0] != &resources.Network.Interfaces[0] { t.Fatalf("Host capture copied/converted/probed resources: %v %+v", trace, sample) }
	if sample.CapturedAt != "2026-01-02T04:04:05.000000123Z" || sample.UptimeMs != 1234 || sample.Sequence != 9 || sample.DroppedSamples != "8" || sample.Platform != "opaque-platform" || sample.NodeID != "node" || sample.BootID != "boot" { t.Fatalf("Host capture timestamp/identity: %+v", sample) }
}

type hostCutoffCompleteSchedule struct { *exporterCompleteSchedule; calls atomic.Int32; cancel context.CancelFunc }
func (s *hostCutoffCompleteSchedule) Now() time.Time { if s.calls.Add(1) == 2 { s.cancel(); return s.now.Add(500*time.Millisecond) }; return s.now }

func TestHostCompleteResultExactlyAtCutoffIsDroppedBeforeCaptureSend(t *testing.T) {
	now := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	ticker := &exporterCompleteTicker{ticks: make(chan time.Time, 1)}; ticker.ticks <- now
	base := &exporterCompleteSchedule{ticker: ticker, ready: make(chan struct{}), durations: make(chan time.Duration, 1), now: now}
	ctx, cancel := context.WithCancel(context.Background()); defer cancel()
	schedule := &hostCutoffCompleteSchedule{exporterCompleteSchedule: base, cancel: cancel}
	channel := exporterCompleteChannel{clone: func(string) (*http.Client, func(), bool) { return &http.Client{}, func(){}, true }, post: func(context.Context, string, []byte, uint64) (executionchannel.Reply, error) { panic("cutoff Host result reached send") }}
	runner := &Runner{effects: Effects{Schedule: schedule, Auxiliary: channel}, local: LocalServices{Observation: timeOwnerObservation{}, Entropy: &exporterCompleteEntropy{}}}
	done := make(chan struct{}); go func() { defer close(done); runner.maintainHostTelemetry(ctx, now) }()
	select { case <-done: case <-time.After(5*time.Second): t.Fatal("exact cutoff did not complete") }
	if schedule.calls.Load() != 2 || ticker.stopped.Load() != 1 { t.Fatal("cutoff added capture/clock/send or did not cancel") }
	if duration := <-base.durations; duration != 500*time.Millisecond { t.Fatalf("cutoff timer %v", duration) }
}

var _ runtimeplatform.Scheduler = (*hostCutoffCompleteSchedule)(nil)
