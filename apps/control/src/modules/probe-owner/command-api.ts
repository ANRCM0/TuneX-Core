import type { ProbeServiceSelection, ProbeEchoChallenge } from '../../compatibility/public.ts';
import type { ForwardProbePlan } from './plan-contracts.ts';
import type { ProbePermitInspection, ProbePermitRevocation } from './owner-contracts.ts';

export const FORWARD_PROBE_API_INTERFACE_VERSION=4 as const;

export interface ProbeAcceptance {
    status: 202;
    body: { probeId: string; forwardId: string; issuedAt: string; expiresAt: string;
        dispatch: 'agent-poll'; executionEnabled: false };
}
export interface IngressProbeAcceptance {
    status:202;
    body:ProbeAcceptance['body'] & {probeVersion:2;measurement:'tcp-ingress-connect-v1';taskKind:'tcp-ingress-connect';point:'agent-local-direct-ingress';capability:'probe.tcp-ingress-connect.v1'};
}
export interface ServiceProbeAcceptance {
    status:202;
    body:ProbeAcceptance['body'] & {probeVersion:3;measurement:'tcp-ingress-tls-v1';taskKind:'tcp-ingress-tls';point:'agent-local-direct-ingress';
        capability:'probe.tcp-ingress-tls.v1';service:ProbeServiceSelection};
}
export interface EchoProbeAcceptance {
    status:202;
    body:ProbeAcceptance['body']&{probeVersion:4;measurement:'tcp-ingress-echo-v1'|'udp-ingress-echo-v1'|'tcp-path-echo-v1'|'udp-path-echo-v1';
        taskKind:'tcp-ingress-echo'|'udp-ingress-echo'|'tcp-path-echo'|'udp-path-echo';point:'agent-local-direct-ingress'|'agent-local-forward-ingress';
        capability:'probe.tcp-ingress-echo.v1'|'probe.udp-ingress-echo.v1'|'probe.tcp-path-echo.v1'|'probe.udp-path-echo.v1';businessProtocol:'tcp'|'udp';
        service:ProbeServiceSelection;challenge:ProbeEchoChallenge};
}
export type AnyProbeAcceptance=ProbeAcceptance|IngressProbeAcceptance|ServiceProbeAcceptance|EchoProbeAcceptance;

export interface ForwardProbePlanApi {plan(actor:string,scopeId:string,id:string,input:unknown):Promise<ForwardProbePlan>}
export interface ForwardProbeApi {
    create(actor:string,scope:string,forward:string,key:string|undefined,input:unknown):Promise<AnyProbeAcceptance>;
    inspect(actor:string,scope:string,id:string):Promise<ProbePermitInspection>;
    revoke(actor:string,scope:string,id:string):Promise<ProbePermitRevocation>;
}
