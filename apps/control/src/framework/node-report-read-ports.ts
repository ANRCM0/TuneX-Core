import type { CancellationSignal } from './cancellation-ports.ts';

export const NODE_REPORT_READ_INTERFACE_VERSION=2 as const;

/** Observation work has no deployment, lease, resource or Journal authority. */
export interface NodeObservationContext {
    readonly actorId: string;
    readonly scopeId: string;
    readonly nodeId: string;
    readonly deadlineAt: number;
    readonly signal: CancellationSignal;
}

export interface AgentReportProvenance {
    readonly nodeId: string;
    readonly bootId: string;
    readonly sessionEpoch: number;
    readonly reportSequence: number;
    readonly snapshotGeneration: number;
    readonly observedAt: number;
    readonly receivedAt: number;
    readonly assignmentCount: number;
}

export interface NodeReportEvidence {
    readonly nodeId: string;
    readonly scopeId: string;
    readonly revoked: boolean;
    readonly credentialUntil: number | null;
    readonly sessionEpoch: number;
    readonly bootId: string | null;
    readonly snapshotGeneration: number;
    readonly snapshotValidUntil: number | null;
    readonly invalidReport: boolean;
    readonly report: AgentReportProvenance | null;
}

/** Authorize scope and read the scoped Node on the same transaction.
 * Cancellation must stop owned work; no arbitrary target or active network probe is accepted.
 */
export interface AuthorizedNodeReportReader {
    read(context: NodeObservationContext): Promise<NodeReportEvidence>;
}
