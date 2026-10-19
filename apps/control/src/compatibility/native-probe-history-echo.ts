import type { ProbeClaimBinding, ProbeServiceSelection } from '@tunex/contracts/probe';
import type { ProbeEchoChallenge, ProbeEchoInvocation } from '@tunex/contracts/staged/probe-echo';
import { nativeIsoTime } from './native-module-values.ts';

export interface NativeProbeHistoryEchoSource {
    readonly probeId:string;readonly measurement?:string;readonly binding:ProbeClaimBinding;
    readonly instanceId:string;readonly instanceGeneration:number;readonly timeoutMs:number;
    readonly issuedAt:number;readonly expiresAt:number;
    readonly service?:ProbeServiceSelection;readonly echoChallenge?:ProbeEchoChallenge;
}

/** Original retained selection/challenge projection; no live context resolution or admission. */
export function nativeProbeHistoryEchoInvocation(value:NativeProbeHistoryEchoSource):ProbeEchoInvocation {
    return {domain:'tunex.probe.echo.invocation.v1',probeVersion:4,measurement:value.measurement as 'tcp-ingress-echo-v1'|'udp-ingress-echo-v1',
        permitId:value.probeId,binding:value.binding,instanceId:value.instanceId,instanceGeneration:value.instanceGeneration,
        timeoutMs:value.timeoutMs,issuedAt:nativeIsoTime(value.issuedAt),expiresAt:nativeIsoTime(value.expiresAt),
        service:value.service!,nonce:value.echoChallenge!.nonce};
}
