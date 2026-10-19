import { deepFreeze, isCounter, isId } from '@tunex/core';
import { ControlError } from '../../framework/public.ts';
import { nativeIsoTime } from '../../compatibility/public.ts';
import type { AgentReportProvenance, NodeReportEvidence } from '../../framework/public.ts';
import type { NodeObservationPolicy, NodeReportObservation, ObservationReason } from './contracts.ts';

function timestamp(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000;
}
function invalidEvidence(): never {
    throw new ControlError('OBSERVATION_INVALID_RESULT', 503, 'Observation source returned invalid evidence', true);
}

/** Fresh persisted evidence is not an independent connectivity or application-health measurement. */
export function observeNodeReport(evidence: NodeReportEvidence, scopeId: string, nodeId: string,
    now: number, policy: NodeObservationPolicy): NodeReportObservation {
    if (!evidence || evidence.nodeId !== nodeId || evidence.scopeId !== scopeId ||
        typeof evidence.revoked !== 'boolean' || typeof evidence.invalidReport !== 'boolean' ||
        !isCounter(evidence.sessionEpoch, true) || !isCounter(evidence.snapshotGeneration, true) ||
        evidence.bootId !== null && !isId(evidence.bootId) ||
        evidence.credentialUntil !== null && !timestamp(evidence.credentialUntil) ||
        evidence.snapshotValidUntil !== null && !timestamp(evidence.snapshotValidUntil)) invalidEvidence();
    const report = evidence.report;
    if (report !== null && (!report || !isId(report.nodeId) || !isId(report.bootId) ||
        !isCounter(report.sessionEpoch) || !isCounter(report.reportSequence) || !isCounter(report.snapshotGeneration, true) ||
        !timestamp(report.observedAt) || !timestamp(report.receivedAt) ||
        !Number.isSafeInteger(report.assignmentCount) || report.assignmentCount < 0 || report.assignmentCount > 10000))
        invalidEvidence();
    // Copy only the bounded, public provenance fields; never expose a source-owned object or report body.
    const provenance: AgentReportProvenance | null = report === null ? null : {
        nodeId: report.nodeId, bootId: report.bootId, sessionEpoch: report.sessionEpoch,
        reportSequence: report.reportSequence, snapshotGeneration: report.snapshotGeneration,
        observedAt: report.observedAt, receivedAt: report.receivedAt, assignmentCount: report.assignmentCount,
    };
    let reason: ObservationReason = 'recent-report', status: NodeReportObservation['status'] = 'observed';
    const expires = report && evidence.snapshotValidUntil !== null && evidence.credentialUntil !== null ?
        Math.max(0, Math.min(Math.min(report.receivedAt, report.observedAt) + policy.freshnessMs,
            evidence.snapshotValidUntil - policy.clockSkewMs, evidence.credentialUntil)) : null;
    if (evidence.revoked) reason = 'node-revoked';
    else if (evidence.credentialUntil === null || evidence.credentialUntil <= now) reason = 'credential-expired';
    else if (evidence.invalidReport) reason = 'invalid-report';
    else if (!report) reason = 'missing-report';
    else if (report.nodeId !== nodeId || report.bootId !== evidence.bootId || report.sessionEpoch !== evidence.sessionEpoch)
        reason = 'session-mismatch';
    else if (report.snapshotGeneration !== evidence.snapshotGeneration || report.snapshotGeneration === 0)
        reason = 'snapshot-mismatch';
    else if (report.receivedAt > now || report.observedAt > now + policy.clockSkewMs) reason = 'clock-skew';
    else if (evidence.snapshotValidUntil === null || evidence.snapshotValidUntil - policy.clockSkewMs <= now)
        reason = 'snapshot-expired';
    else if (expires === null || expires <= now) reason = 'report-expired';
    if (reason === 'report-expired' || reason === 'snapshot-expired') status = 'stale';
    else if (reason !== 'recent-report') status = 'unknown';
    return deepFreeze({
        version: 1, source: 'persisted-agent-report', independentProbe: false, health: 'unknown',
        scopeId, nodeId, capturedAt: nativeIsoTime(now), status, reason,
        receivedAt: report ? nativeIsoTime(report.receivedAt) : null,
        expiresAt: expires === null ? null : nativeIsoTime(expires), provenance,
    });
}
