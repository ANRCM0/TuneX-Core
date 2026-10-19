import type { ObservationServiceReference } from '../observation-service-owner/public.ts';
import type { ProbeServiceContext } from '../../compatibility/public.ts';
import type { ProbeEchoServiceContext } from '../../compatibility/public.ts';

export interface ProbeServiceReference extends ObservationServiceReference {}
/** Caller-owned transaction, exact current declaration only; not an independent permit issuer. */
export interface ProbeServiceResolver<Tx> {
    resolve(tx: Tx, actor: string, scope: string, reference: ProbeServiceReference): Promise<ProbeServiceContext>;
}
export interface ProbeEchoServiceResolver<Tx> {
    resolveEcho(tx: Tx, actor: string, scope: string, reference: ProbeServiceReference, protocol: 'tcp'|'udp'): Promise<ProbeEchoServiceContext>;
}
