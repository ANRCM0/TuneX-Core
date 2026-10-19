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

const forwardTelemetryLimit = observationwire.ForwardTelemetryLimit

type forwardTelemetrySample = observationwire.ForwardTelemetrySample

// This exporter has no retry queue and never shares execution's HTTP connection pool.
func (runner *Runner) maintainForwardTelemetry(ctx context.Context, started time.Time) {
	client, closeClient, ok := runner.auxiliary().CloneTelemetry(runner.client, "Forward telemetry redirects are forbidden")
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
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C():
			if sequence >= contracts.MaxCounter {
				return
			}
			sequence++
			page := runner.captureForwardCounterPage(false, forwardTelemetryLimit)
			sample := forwardTelemetrySample{
				ForwardTelemetryVersion: 1, Kind: "forward-telemetry-sample",
				NodeID: page.nodeID, BootID: page.bootID, SessionEpoch: page.sessionEpoch,
				SampleEpoch: epoch, Sequence: sequence, CapturedAt: page.CapturedAt,
				UptimeMs: runner.scheduler().Since(started).Milliseconds(), SnapshotGeneration: page.SnapshotGeneration,
				DroppedSamples: observationwire.Uint64Text(dropped), Coverage: page.Coverage, Items: page.Items,
			}
			if err := sendForwardTelemetryWith(ctx, client, runner.options.URL, sample, runner.scheduler(), runner.auxiliary()); err != nil {
				incrementForwardCounter(&dropped)
			}
		}
	}
}

func sendForwardTelemetry(ctx context.Context, client *http.Client, baseURL string, sample forwardTelemetrySample) error {
	return sendForwardTelemetryWith(ctx, client, baseURL, sample, platformruntime.Schedule{}, controlchannel.Native{})
}
func sendForwardTelemetryWith(ctx context.Context, client *http.Client, baseURL string, sample forwardTelemetrySample, schedule runtimeplatform.Scheduler, channel executionchannel.Auxiliary[*http.Client]) error {
	raw, err := observationwire.EncodeForwardTelemetrySample(sample)
	if err != nil {
		return err
	}
	requestContext, cancel := schedule.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	response, err := channel.PostTelemetry(requestContext, client, baseURL, "/agent/v3/forward-telemetry", raw, sample.SessionEpoch)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	body, err := observationwire.ReadAckBody(response.Body)
	if err != nil || response.StatusCode != http.StatusOK || len(body) > 4096 {
		return fmt.Errorf("Forward telemetry response unavailable")
	}
	return observationwire.CheckForwardTelemetryAck(sample, body)
}
