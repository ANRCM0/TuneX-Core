import type { ProbeBinding } from '../probe-owner/public.ts';
import type { ProbeServiceSelection } from '../../compatibility/public.ts';
import type { ProbeEchoChallenge, ProbeEchoProof } from '../../compatibility/public.ts';
import type { ProbeHistoryPermit, ProbeHistoryResult, ProbeHistoryMetadata, ProbeHistoryLosses, ProbeHistoryQuery, ProbeHistoryStorage } from '../../framework/public.ts';

export type ProbeRunState = 'issued' | 'consumed' | 'revoked' | 'quarantined';
export interface ProbeRunPermit extends ProbeHistoryPermit<ProbeBinding,ProbeRunState,'tcp-ingress-connect-v1'|'tcp-ingress-tls-v1'|'tcp-ingress-echo-v1'|'udp-ingress-echo-v1'|'tcp-path-echo-v1'|'udp-path-echo-v1',ProbeServiceSelection,ProbeEchoChallenge> {}
export interface ProbeRunResult extends ProbeHistoryResult<'connected'|'unreachable'|'verified'|'unverified'|'echoed',
    'tcp-connected'|'tcp-connect-failed'|'tls-handshake-verified'|'tls-handshake-failed'|'nonce-echo-verified'|'nonce-echo-rejected',
    {version:'TLSv1.3';alpn:'tunex-observation/1';leafFingerprint:string;verified:true},ProbeEchoProof> {}
export interface ProbeRunRecord extends ProbeRunPermit,ProbeHistoryMetadata<ProbeRunResult> {}
export interface ProbeRunCapture {
    kind: 'issued' | 'consumed' | 'revoked' | 'withdrawn' | 'result';
    permit: ProbeRunPermit; at: number; result: ProbeRunResult | null;
}
/** Only the existing permit owner calls this after its actual mutation, in that same transaction. */
export interface ProbeRunRecorder<Tx> { recordIn(tx: Tx, capture: ProbeRunCapture): Promise<void> }
export interface ProbeRunLosses extends ProbeHistoryLosses {}
export interface ProbeRunQuery extends ProbeHistoryQuery<ProbeRunState,ProbeRunResult['status']> {}
/** This store owns history only, with no FK or write path to the short-lived execution permit. */
export interface ProbeRunStore<Tx> extends ProbeHistoryStorage<Tx,ProbeRunRecord> {}
