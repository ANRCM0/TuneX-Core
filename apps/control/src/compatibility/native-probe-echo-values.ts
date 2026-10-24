import type { ProbeClaimBinding, ProbeServiceContext } from '@tunex/contracts/probe';
import type { ProbeEchoInvocation, ProbeEchoServiceContext } from '@tunex/contracts/staged/probe-echo';
import { probeEchoServiceSelection } from './native-observability-codecs.ts';
import { nativeIsoTime } from './native-module-values.ts';
import { randomBytes } from 'node:crypto';
export const nativeProbeEchoNonce=():string=>randomBytes(32).toString('base64');

export interface NativeProbeEchoInvocationSource {
    readonly id:string; readonly measurement?:string; readonly binding:ProbeClaimBinding;
    readonly instanceId:string; readonly instanceGeneration:number; readonly timeoutMs:number;
    readonly issuedAt:number; readonly expiresAt:number;
}

/** Format existing facts only; product admission and proof decisions remain with the caller. */
export function nativeProbeEchoInvocation(source:NativeProbeEchoInvocationSource,
    context:()=>ProbeServiceContext|ProbeEchoServiceContext,nonce:()=>string):ProbeEchoInvocation {
    return {domain:'tunex.probe.echo.invocation.v1',probeVersion:4,measurement:source.measurement as ProbeEchoInvocation['measurement'],permitId:source.id,
        binding:source.binding,instanceId:source.instanceId,instanceGeneration:source.instanceGeneration,timeoutMs:source.timeoutMs,
        issuedAt:nativeIsoTime(source.issuedAt),expiresAt:nativeIsoTime(source.expiresAt),
        service:probeEchoServiceSelection(context()),nonce:nonce()};
}
