package nativeexecution

import (
	"time"

	"github.com/tunex/vnext/agent/internal/adp3"
)

// Keep the original validity-before-issuance parse order, after the Runner's
// identity/history checks and its existing poll clock sample.
func RunnerSnapshotWindow(snapshot adp3.Snapshot) (issued, valid time.Time, err error) {
	valid, err = ParseWireTime(snapshot.ValidUntil)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	issued, err = ParseWireTime(snapshot.IssuedAt)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	return issued, valid, nil
}

// The Runner supplies its existing drain decision and timestamps; this adapter
// does not inspect the stream, ticket, deadline policy or current clock.
func RunnerDrain(assignment adp3.Assignment, started, deadline time.Time, remaining uint64, condition string) adp3.Drain {
	return adp3.Drain{AssignmentId: assignment.AssignmentId, DeploymentGeneration: assignment.DeploymentGeneration,
		BindingFence: assignment.BindingFence, StartedAt: started.UTC().Format(time.RFC3339Nano),
		Deadline: deadline.UTC().Format(time.RFC3339Nano), RemainingConnections: remaining, Condition: condition}
}

func EncodeRunnerReportAt(node, boot string, epoch, sequence uint64, observedAt time.Time, generation uint64,
	observations []adp3.Observation, drains []adp3.Drain) ([]byte, error) {
	report := adp3.ReportRequest{ProtocolVersion: 3, NodeId: node, BootId: boot, SessionEpoch: epoch,
		ReportSequence: sequence, ObservedAt: observedAt.UTC().Format(time.RFC3339Nano),
		AcceptedSnapshotGeneration: generation, Observations: observations, Drains: drains}
	return EncodeRunnerReport(report)
}
