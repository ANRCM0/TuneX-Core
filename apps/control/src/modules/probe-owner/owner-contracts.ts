import type { ProbeResultRequest, ProbeTypesResultRequest, ProbeServicesResultRequest, ProbeServiceSelection,
    ProbeEchoResultRequest, ProbeEchoChallenge } from '../../compatibility/public.ts';
import type { ProbePermitRecord } from './permit-contracts.ts';
import type { ProbeResultRecord } from './result-contracts.ts';
import type { ProbeBinding } from './plan-contracts.ts';
import type { ProbeMeasurement, ProbeMeasurementDescription } from './measurement-contracts.ts';

export const PROBE_OWNER_INTERFACE_VERSION=3 as const;

// Match the original shallow spread projections, not a deep-readonly wire/store view.
type ShallowMutable<T>={-readonly [K in keyof T]:T[K]};
type ResultBodyView<T>=T extends unknown?ShallowMutable<Omit<T,'binding'>>&{binding:ShallowMutable<ProbeBinding>}:never;

export type ProbePermitView=ShallowMutable<Omit<ProbePermitRecord,'fingerprint'|'binding'>>&{
    binding:ShallowMutable<ProbeBinding>;executionEnabled:false;dispatch:'not-implemented';
};
export type ProbePermitManagementView=Omit<ProbePermitView,'serviceContext'>&{service?:ProbeServiceSelection};
export type ProbePermitRevocation=ProbePermitManagementView|(ProbePermitManagementView&{withdrawnAt:number});
export interface ProbeHistoricalResult {
    body:ResultBodyView<ProbeResultRecord['body']>;resultDigest:string;acceptedAt:number;historical:true;expired:boolean;
}
export interface ProbePermitInspectionFields {
    probeId:string;forwardId:string;state:ProbePermitRecord['state'];service?:ProbeServiceSelection;
    issuedAt:string;expiresAt:string;expired:boolean;withdrawnAt:string|null;
    executionEnabled:false;health:'unknown';result:ProbeHistoricalResult|null;
}
export type ProbePermitInspection=ProbePermitInspectionFields&Partial<ProbeMeasurementDescription>;
export interface ProbePermitOfferFields {
    permitId:string;instanceId:string;instanceGeneration:number;binding:ShallowMutable<ProbeBinding>;
    timeoutMs:number;issuedAt:number;expiresAt:number;serviceContext?:Exclude<ProbePermitRecord['serviceContext'],undefined>|null;
    echoChallenge?:ProbeEchoChallenge|null;
}
export interface ProbePermitOffer {
    observedAt:number;executionEnabled:false;offer:(ProbePermitOfferFields&Partial<ProbeMeasurementDescription>)|null;
}
export interface ProbeResultAcceptance {resultDigest:string;acceptedAt:number;checkedAt:number;duplicate:boolean}

/** Only the original permit owner mutates its records and budget in the original transactions. */
export interface ProbePermitOwner<Tx> {
    issue(actor:string,scope:string,forward:string,input:unknown):Promise<ProbePermitView>;
    issueCurrentIn(tx:Tx,actor:string,scope:string,forward:string,input:unknown,notAfter?:number):Promise<ProbePermitView>;
    inspect(actor:string,scope:string,id:string):Promise<ProbePermitInspection>;
    revoke(actor:string,scope:string,id:string):Promise<ProbePermitRevocation>;
    consume(node:string,fingerprint:string,epoch:number,input:unknown,measurement?:ProbeMeasurement,typed?:boolean|'services'|'echo',service?:ProbeServiceSelection|null,challenge?:ProbeEchoChallenge|null):Promise<ProbePermitView>;
    offer(node:string,fingerprint:string,epoch:number,input:unknown,typed?:boolean|'services'|'echo'):Promise<ProbePermitOffer>;
    check(node:string,fingerprint:string,epoch:number,input:unknown,measurement?:ProbeMeasurement,typed?:boolean|'services'|'echo',service?:ProbeServiceSelection|null,challenge?:ProbeEchoChallenge|null):Promise<ProbePermitView&{checkedAt:number}>;
    receiveResult(node:string,fingerprint:string,epoch:number,input:ProbeResultRequest|ProbeTypesResultRequest|ProbeServicesResultRequest|ProbeEchoResultRequest):Promise<ProbeResultAcceptance>;
}
