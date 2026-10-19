import type { AgentReportProvenance } from '../../framework/public.ts';

export interface NodeObservationPolicy {
    readonly freshnessMs: number;
    readonly clockSkewMs: number;
}

export type ObservationReason = 'recent-report' | 'missing-report' | 'invalid-report' |
    'node-revoked' | 'credential-expired' | 'session-mismatch' | 'snapshot-mismatch' |
    'clock-skew' | 'report-expired' | 'snapshot-expired';

export interface NodeReportObservation {
    readonly version: 1;
    readonly source: 'persisted-agent-report';
    readonly independentProbe: false;
    readonly health: 'unknown';
    readonly scopeId: string;
    readonly nodeId: string;
    readonly capturedAt: string;
    readonly status: 'observed' | 'stale' | 'unknown';
    readonly reason: ObservationReason;
    readonly receivedAt: string | null;
    readonly expiresAt: string | null;
    readonly provenance: AgentReportProvenance | null;
}
