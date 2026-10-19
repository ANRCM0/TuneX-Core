package control

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/tunex/vnext/agent/internal/contracts"
	"github.com/tunex/vnext/agent/internal/controlchannel"
	"github.com/tunex/vnext/agent/internal/executionchannel"
	"github.com/tunex/vnext/agent/internal/observationwire"
	"github.com/tunex/vnext/agent/internal/platformruntime"
	"github.com/tunex/vnext/agent/internal/runtimeplatform"
)

type hostTelemetrySample = observationwire.HostTelemetrySample

// Host collection is independent of process/Forward telemetry and all execution state.
func (runner *Runner) maintainHostTelemetry(ctx context.Context, started time.Time) {
	client, closeClient, ok := runner.auxiliary().CloneTelemetry(runner.client, "Host telemetry redirects are forbidden")
	if !ok {
		return
	}
	defer closeClient()
	var randomEpoch [16]byte
	if _, err := runner.entropy().ReadRandom(randomEpoch[:]); err != nil {
		return
	}
	epoch := observationwire.EpochText(randomEpoch[:])
	ticker := runner.scheduler().NewTicker(10 * time.Second)
	defer ticker.Stop()
	sequence, dropped := uint64(0), uint64(0)
	var pending chan hostResources
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C():
			if ctx.Err() != nil {
				return
			}
			if sequence >= contracts.MaxCounter {
				return
			}
			sequence++
			if pending != nil {
				// A timed-out OS call may finish later, but its result never becomes a new sample.
				select {
				case <-pending:
					pending = nil
				default:
				}
				dropHostTelemetrySample(&dropped)
				continue
			}
			pending = make(chan hostResources, 1)
			deadline := runner.scheduler().Now().Add(500 * time.Millisecond)
			// Only the measurement callback and channel reach the worker, not Runner or authority.
			go func(result chan<- hostResources, capture func() hostResources) { result <- capture() }(pending, runner.observer().Host)
			timer := runner.scheduler().NewTimer(runner.scheduler().Until(deadline))
			var resources hostResources
			select {
			case <-ctx.Done():
				timer.Stop()
				return
			case <-timer.C():
				dropHostTelemetrySample(&dropped)
				continue
			case resources = <-pending:
				timer.Stop()
				pending = nil
				if ctx.Err() != nil {
					return
				}
				if !runner.scheduler().Now().Before(deadline) {
					dropHostTelemetrySample(&dropped)
					continue
				}
			}
			sample := runner.captureHostTelemetry(started, epoch, sequence, dropped, resources)
			if err := sendHostTelemetryWith(ctx, client, runner.options.URL, sample, runner.scheduler(), runner.auxiliary()); err != nil {
				dropHostTelemetrySample(&dropped)
			}
		}
	}
}

func dropHostTelemetrySample(dropped *uint64) {
	if *dropped < ^uint64(0) {
		*dropped = *dropped + 1
	}
}

func (runner *Runner) captureHostTelemetry(started time.Time, epoch string, sequence, dropped uint64, resources hostResources) hostTelemetrySample {
	runner.mutex.Lock()
	node, boot, session := runner.options.NodeID, runner.options.BootID, runner.hello.SessionEpoch
	runner.mutex.Unlock()
	now := runner.scheduler().Now()
	return hostTelemetrySample{HostTelemetryVersion: 1, Kind: "host-telemetry-sample", NodeID: node, BootID: boot,
		SessionEpoch: session, SampleEpoch: epoch, Sequence: sequence, CapturedAt: observationwire.UTCTimeText(now),
		UptimeMs: now.Sub(started).Milliseconds(), Platform: runner.observer().Platform(), DroppedSamples: observationwire.Uint64Text(dropped), Host: resources}
}

func sendHostTelemetry(ctx context.Context, client *http.Client, baseURL string, sample hostTelemetrySample) error {
	return sendHostTelemetryWith(ctx, client, baseURL, sample, platformruntime.Schedule{}, controlchannel.Native{})
}
func sendHostTelemetryWith(ctx context.Context, client *http.Client, baseURL string, sample hostTelemetrySample, schedule runtimeplatform.Scheduler, channel executionchannel.Auxiliary[*http.Client]) error {
	raw, err := observationwire.EncodeHostTelemetrySample(sample)
	if err != nil {
		return err
	}
	requestContext, cancel := schedule.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	response, err := channel.PostTelemetry(requestContext, client, baseURL, "/agent/v3/host-telemetry", raw, sample.SessionEpoch)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	body, err := observationwire.ReadAckBody(response.Body)
	if err != nil || response.StatusCode != http.StatusOK || len(body) > 4096 {
		return fmt.Errorf("Host telemetry response unavailable")
	}
	return observationwire.CheckHostTelemetryAck(sample, body)
}
