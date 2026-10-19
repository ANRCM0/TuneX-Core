import type { ProbeServiceSelection } from '../../compatibility/public.ts';
import type { ForwardProbePlan } from './plan-contracts.ts';
import type { ProbePermitInspection, ProbePermitRevocation } from './owner-contracts.ts';

export const FORWARD_PROBE_API_INTERFACE_VERSION=1 as const;

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
export type AnyProbeAcceptance=ProbeAcceptance|IngressProbeAcceptance|ServiceProbeAcceptance;

export interface ForwardProbePlanApi {plan(actor:string,scopeId:string,id:string,input:unknown):Promise<ForwardProbePlan>}
export interface ForwardProbeApi {
    create(actor:string,scope:string,forward:string,key:string|undefined,input:unknown):Promise<AnyProbeAcceptance>;
    inspect(actor:string,scope:string,id:string):Promise<ProbePermitInspection>;
    revoke(actor:string,scope:string,id:string):Promise<ProbePermitRevocation>;
}
