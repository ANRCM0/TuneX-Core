import type { ProbeResultBody } from '@tunex/contracts';

export interface ProbeResultRecord {
    readonly body: ProbeResultBody;
    readonly resultDigest: string;
    readonly acceptedAt: number;
}
/** One result per retained permit, serialized by the existing permit budget lock. */
export interface ProbeResultStore<Tx> {
    result(tx: Tx, permitId: string): Promise<ProbeResultRecord | undefined>;
    recordResult(tx: Tx, record: ProbeResultRecord): Promise<void>;
}
