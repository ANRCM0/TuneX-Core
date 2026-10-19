import type { OBSERVATION_SERVICE_LIMITS, OBSERVATION_SERVICE_ALPN, ObservationServiceAudit,
    ObservationServiceHead, ObservationServiceReceipt, ObservationServiceRevision } from './contracts.ts';

export const OBSERVATION_SERVICE_API_INTERFACE_VERSION=1 as const;

export type ObservationServiceTrust=
    {mode:'ed25519-echo-v1';algorithm:'Ed25519';fingerprint:string;keyUsage:'fixed-nonce-echo-only';
        serverName?:undefined;serviceIdentity?:undefined;alpn?:undefined;certificateNotBefore?:undefined;certificateNotAfter?:undefined;chainValidation?:undefined} |
    {mode:'pinned-leaf-v1';fingerprint:string;serverName:string;serviceIdentity:string;alpn:typeof OBSERVATION_SERVICE_ALPN;
        certificateNotBefore:number;certificateNotAfter:number;chainValidation:'not-used-exact-leaf-pin';algorithm?:undefined;keyUsage?:undefined};
export interface ObservationServiceEnvelope {
    observationServicesVersion:1;scopeId:string;capturedAt:number;source:'manager-declared-observation-services';readOnly:true;
    executionAuthorized:false;health:'unknown';ownership:'not-verified';networkCheck:'not-performed';measurementAvailable:boolean;echoAvailable:boolean;
    consistency:'read-committed-not-global-snapshot';limits:typeof OBSERVATION_SERVICE_LIMITS;
}
export interface ObservationServiceList extends ObservationServiceEnvelope {items:ObservationServiceHead[];auditEvicted:number}
export interface ObservationServiceDetail extends ObservationServiceEnvelope {
    head:ObservationServiceHead;revision:ObservationServiceRevision;trust:ObservationServiceTrust;
    lifecycle:string;
    audit:{items:ObservationServiceAudit[];truncated:boolean};auditEvicted:number;
}
export interface ObservationServicesApi {
    admitRequest<T>(action:()=>Promise<T>):Promise<T>;
    list(actor:string,scope:string):Promise<ObservationServiceList>;
    get(actor:string,scope:string,id:string,configRevision?:number):Promise<ObservationServiceDetail>;
    publish(actor:string,scope:string,id:string,key:string|undefined,expectedRevision:number,input:unknown):Promise<ObservationServiceReceipt>;
    archive(actor:string,scope:string,id:string,key:string|undefined,expectedRevision:number):Promise<ObservationServiceReceipt>;
}
