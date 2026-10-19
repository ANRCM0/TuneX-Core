import type { ProbeResultBody, ProbeTypesResultBody, ProbeServicesResultBody, ProbeEchoResultBody } from '../../compatibility/public.ts';

export interface ProbeResultRecord {
    readonly body: ProbeResultBody | ProbeTypesResultBody | ProbeServicesResultBody | ProbeEchoResultBody;
    readonly resultDigest: string;
    readonly acceptedAt: number;
}
/** One result per retained permit, serialized by the existing permit budget lock. */
export interface ProbeResultStore<Tx> {
    result(tx: Tx, permitId: string): Promise<ProbeResultRecord | undefined>;
    recordResult(tx: Tx, record: ProbeResultRecord): Promise<void>;
}
