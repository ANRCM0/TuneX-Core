package control

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"sync/atomic"
	"testing"
	"time"

	"github.com/tunex/vnext/agent/internal/executionchannel"
	"github.com/tunex/vnext/agent/internal/platformobservation"
)

func TestTelemetryCompleteFailuresDropUntilNextTickWithoutRetryQueue(t *testing.T) {
	for _, family := range []string{"process", "host", "forward", "probe"} {
		t.Run(family, func(t *testing.T) {
			now := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
			ticker := &exporterCompleteTicker{ticks: make(chan time.Time)}
			schedule := &exporterCompleteSchedule{ticker: ticker, ready: make(chan struct{}), now: now}
			entropy := &exporterCompleteEntropy{seed: 71}
			ctx, cancel := context.WithCancel(context.Background()); defer cancel()
			samples := make(chan map[string]any, 4)
			var attempts atomic.Int32
			channel := exporterCompleteChannel{clone: func(string) (*http.Client, func(), bool) { return &http.Client{}, func(){}, true }, post: func(_ context.Context, _ string, raw []byte, _ uint64) (executionchannel.Reply, error) {
				var sample map[string]any; if err := json.Unmarshal(raw, &sample); err != nil { panic(err) }
				count := attempts.Add(1); samples <- sample; if count == 2 { cancel() }; return executionchannel.Reply{}, errors.New("sample lost")
			}}
			runner := &Runner{effects: Effects{Schedule: schedule, Auxiliary: channel}, local: LocalServices{Entropy: entropy, Observation: platformobservation.Native{}}}
			done := make(chan struct{}); go func() { defer close(done); exporterCompleteRun(runner, family, ctx, now) }()
			deadline := time.After(5*time.Second)
			select { case <-schedule.ready: case <-deadline: t.Fatal("exporter ticker unavailable") }
			var epoch string
			for sequence:=1; sequence<=2; sequence++ {
				select { case ticker.ticks <- now.Add(time.Duration(sequence)*time.Hour): case <-deadline: t.Fatal("next sample did not wait for tick") }
				select { case sample := <-samples:
					if sample["sequence"] != float64(sequence) || sample["droppedSamples"] != observationCounterTextComplete(uint64(sequence-1)) { t.Fatalf("drop/sequence: %+v", sample) }
					if sequence == 1 { epoch, _ = sample["sampleEpoch"].(string) } else if sample["sampleEpoch"] != epoch { t.Fatal("epoch regenerated per tick") }
				case <-deadline: t.Fatal("sample unavailable") }
			}
			select { case <-done: case <-deadline: t.Fatal("exporter failed cancellation") }
			if attempts.Load() != 2 || entropy.calls != 1 || ticker.stopped.Load() != 1 { t.Fatal("retry/catch-up/entropy read added") }
			select { case extra := <-samples: t.Fatalf("extra queued sample: %+v", extra); default: }
		})
	}
	for _, increment := range []func(*uint64){dropHostTelemetrySample, incrementForwardCounter, func(value *uint64) { addProbeCounterLoss(value, 1) }} {
		value := ^uint64(0)-1; increment(&value); increment(&value); if value != ^uint64(0) { t.Fatal("drop saturation wrapped") }
	}
}
