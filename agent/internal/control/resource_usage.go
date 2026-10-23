package control

import (
	"context"
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
	"github.com/tunex/vnext/agent/internal/observationwire"
	"github.com/tunex/vnext/agent/internal/state"
)

// Optional observational extension. A missing old-Control endpoint or dropped
// sample cannot fail the accepted Runtime report, renew a lease or change a debit.
func (runner *Runner) sendResourceUsage(ctx context.Context, report adp3.ReportRequest) {
	if runner.runtimeState.ResourceBudgets == nil || report.AcceptedSnapshotGeneration == 0 { return }
	generation, records, err := state.ReadRuntimePayloadUsage(runner.options.Journal, runner.key, runner.options.NodeID)
	if err != nil || generation != report.AcceptedSnapshotGeneration || len(records) == 0 { return }
	raw, err := observationwire.EncodeResourceUsage(report.NodeId, report.BootId, report.SessionEpoch, report.ReportSequence, generation, records)
	if err != nil { return }
	bounded, cancel := runner.scheduler().WithTimeout(ctx, time.Second)
	defer cancel()
	_, _ = runner.request(bounded, "POST", "/agent/v3/resource-usage", raw, true)
}
