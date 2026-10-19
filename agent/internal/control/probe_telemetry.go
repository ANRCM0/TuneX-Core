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

type probeTelemetrySample = observationwire.ProbeTelemetrySample

// Independent telemetry does not negotiate, claim, authorize or report execution results.
func (runner *Runner) maintainProbeTelemetry(ctx context.Context, started time.Time) {
	client, closeClient, ok := runner.auxiliary().CloneTelemetry(runner.client, "Probe telemetry redirects are forbidden")
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
			if ctx.Err() != nil || sequence >= contracts.MaxCounter {
				return
			}
			sequence++
			page := runner.captureProbeCounterPage()
			sample := probeTelemetrySample{ProbeTelemetryVersion: 1, Kind: "probe-telemetry-sample",
				NodeID: page.node, BootID: page.boot, SessionEpoch: page.sessionEpoch,
				SampleEpoch: epoch, Sequence: sequence, CapturedAt: page.capturedAt,
				UptimeMs: runner.scheduler().Since(started).Milliseconds(), DroppedSamples: observationwire.Uint64Text(dropped),
				Coverage: page.coverage, Items: page.items}
			if err := sendProbeTelemetryWith(ctx, client, runner.options.URL, sample, runner.scheduler(), runner.auxiliary()); err != nil {
				addProbeCounterLoss(&dropped, 1)
			}
		}
	}
}

func sendProbeTelemetry(ctx context.Context, client *http.Client, baseURL string, sample probeTelemetrySample) error {
	return sendProbeTelemetryWith(ctx, client, baseURL, sample, platformruntime.Schedule{}, controlchannel.Native{})
}
func sendProbeTelemetryWith(ctx context.Context, client *http.Client, baseURL string, sample probeTelemetrySample, schedule runtimeplatform.Scheduler, channel executionchannel.Auxiliary[*http.Client]) error {
	limits := observationwire.ProbeTelemetryLimits{Page: probeCounterPageLimit, Snapshot: probeCounterSnapshotLimit, Retiring: probeCounterRetiringLimit}
	raw, err := observationwire.EncodeProbeTelemetrySample(sample, limits)
	if err != nil {
		return err
	}
	requestContext, cancel := schedule.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	response, err := channel.PostTelemetry(requestContext, client, baseURL, "/agent/v3/probe-telemetry", raw, sample.SessionEpoch)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	body, err := observationwire.ReadAckBody(response.Body)
	if err != nil || response.StatusCode != http.StatusOK || len(body) > 4096 {
		return fmt.Errorf("Probe telemetry response unavailable")
	}
	return observationwire.CheckProbeTelemetryAck(sample, body, limits)
}
