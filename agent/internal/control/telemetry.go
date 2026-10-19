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

type telemetryProcess = observationwire.TelemetryProcess
type telemetryRuntime = observationwire.TelemetryRuntime
type telemetrySample = observationwire.TelemetrySample

func optionalTelemetryCounter(value *int64) *string { return observationwire.OptionalCounter(value) }

// Samples have their own epoch and transport; failure cannot change execution state.
func (runner *Runner) maintainTelemetry(ctx context.Context, started time.Time) {
	client, closeClient, ok := runner.auxiliary().CloneTelemetry(runner.client, "Telemetry redirects are forbidden")
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
			sample := runner.captureTelemetry(started, epoch, sequence, dropped)
			if err := sendTelemetryWith(ctx, client, runner.options.URL, sample, runner.scheduler(), runner.auxiliary()); err != nil {
				dropped++
			}
		}
	}
}

func (runner *Runner) captureTelemetry(started time.Time, epoch string, sequence, dropped uint64) telemetrySample {
	// Copy bounded execution references only; stream locks and OS probes stay outside Runner's lock.
	runner.mutex.Lock()
	node, boot, session := runner.options.NodeID, runner.options.BootID, runner.hello.SessionEpoch
	generation, ticket := runner.journal.Generation, runner.ticket
	drainCount := len(runner.drains)
	instances := make([]running, 0, len(runner.instances)+drainCount)
	for _, instance := range runner.instances {
		instances = append(instances, instance)
	}
	for _, drain := range runner.drains {
		instances = append(instances, drain.instance)
	}
	runner.mutex.Unlock()
	tcp, udp := uint64(0), uint64(0)
	type instanceIdentity struct {
		assignment        string
		generation, fence uint64
	}
	seen := make(map[instanceIdentity]bool, len(instances))
	for _, instance := range instances {
		a := instance.assignment
		key := instanceIdentity{a.AssignmentId, a.DeploymentGeneration, a.BindingFence}
		if seen[key] {
			continue
		}
		seen[key] = true
		count := instance.stream.Remaining()
		if a.Protocol == "tcp" {
			tcp += count
		} else {
			udp += count
		}
	}
	memory := runner.observer().Memory()
	process := runner.observer().Process()
	cpu, rss, descriptors := process.CPUTimeNanos, process.MaxRSSBytes, process.OpenFileDescriptors
	now := runner.scheduler().Now()
	return telemetrySample{
		TelemetryVersion: 1, Kind: "telemetry-sample", NodeID: node, BootID: boot,
		SessionEpoch: session, SampleEpoch: epoch, Sequence: sequence,
		CapturedAt: observationwire.UTCTimeText(now), UptimeMs: now.Sub(started).Milliseconds(), Platform: runner.observer().Platform(),
		Process: telemetryProcess{Goroutines: runner.observer().Goroutines(), HeapAllocBytes: observationwire.Uint64Text(memory.HeapAllocBytes),
			RuntimeBytes: observationwire.Uint64Text(memory.RuntimeBytes), CPUTimeNanos: optionalTelemetryCounter(cpu),
			MaxRSSBytes: optionalTelemetryCounter(rss), OpenFileDescriptors: descriptors},
		Runtime: telemetryRuntime{SnapshotGeneration: generation, AuthorizationActive: ticket != nil && ticket.Allow() == nil,
			TCPStreams: observationwire.Uint64Text(tcp), UDPAssociations: observationwire.Uint64Text(udp), DrainingInstances: drainCount},
		DroppedSamples: observationwire.Uint64Text(dropped),
	}
}

func sendTelemetry(ctx context.Context, client *http.Client, baseURL string, sample telemetrySample) error {
	return sendTelemetryWith(ctx, client, baseURL, sample, platformruntime.Schedule{}, controlchannel.Native{})
}
func sendTelemetryWith(ctx context.Context, client *http.Client, baseURL string, sample telemetrySample, schedule runtimeplatform.Scheduler, channel executionchannel.Auxiliary[*http.Client]) error {
	raw, err := observationwire.EncodeTelemetrySample(sample)
	if err != nil {
		return err
	}
	requestContext, cancel := schedule.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	response, err := channel.PostTelemetry(requestContext, client, baseURL, "/agent/v3/telemetry", raw, sample.SessionEpoch)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	body, err := observationwire.ReadAckBody(response.Body)
	if err != nil || response.StatusCode != http.StatusOK || len(body) > 4096 {
		return fmt.Errorf("Telemetry response unavailable")
	}
	return observationwire.CheckTelemetryAck(sample, body)
}
