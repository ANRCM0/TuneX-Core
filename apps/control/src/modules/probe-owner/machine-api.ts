import type {
    ProbeNegotiationRequest, ProbeNegotiationResponse, ProbeInstanceRequest, ProbeInstanceResponse,
    ProbeClaimRequest, ProbeClaimResponse, ProbePollRequest, ProbePollResponse, ProbeStatusRequest, ProbeStatusResponse,
    ProbeResultRequest, ProbeResultResponse, ProbeTypesQualificationRequest, ProbeTypesQualificationResponse,
    ProbeServicesQualificationRequest, ProbeServicesQualificationResponse,
    ProbeTypesPollRequest, ProbeTypesPollResponse, ProbeTypesClaimRequest, ProbeTypesClaimResponse,
    ProbeTypesStatusRequest, ProbeTypesStatusResponse, ProbeTypesResultRequest, ProbeTypesResultResponse,
    ProbeServicesPollRequest, ProbeServicesPollResponse, ProbeServicesClaimRequest, ProbeServicesClaimResponse,
    ProbeServicesStatusRequest, ProbeServicesStatusResponse, ProbeServicesResultRequest, ProbeServicesResultResponse,
} from '../../compatibility/public.ts';

export const PROBE_MACHINE_API_INTERFACE_VERSION=1 as const;

export interface ProbeNegotiationApi {
    hello(nodeId:string,fingerprint:string,epoch:number,input:ProbeNegotiationRequest):Promise<ProbeNegotiationResponse>;
}
export interface ProbeInstanceApi {
    handle(nodeId:string,fingerprint:string,epoch:number,input:ProbeInstanceRequest):Promise<ProbeInstanceResponse>;
}
export interface ProbeClaimApi {
    handle(node:string,fingerprint:string,epoch:number,input:ProbeClaimRequest):Promise<ProbeClaimResponse>;
}
export interface ProbeDeliveryApi {
    poll(node:string,fingerprint:string,epoch:number,input:ProbePollRequest):Promise<ProbePollResponse>;
    status(node:string,fingerprint:string,epoch:number,input:ProbeStatusRequest):Promise<ProbeStatusResponse>;
}
export interface ProbeResultApi {
    handle(node:string,fingerprint:string,epoch:number,input:ProbeResultRequest):Promise<ProbeResultResponse>;
}
export interface ProbeTypeRegistryApi {
    handle(node:string,fingerprint:string,epoch:number,input:ProbeTypesQualificationRequest):Promise<ProbeTypesQualificationResponse>;
}
export interface ProbeServiceRegistryApi {
    handle(node:string,fingerprint:string,epoch:number,input:ProbeServicesQualificationRequest):Promise<ProbeServicesQualificationResponse>;
}
export interface ProbeTypesApi {
    poll(node:string,fingerprint:string,epoch:number,input:ProbeTypesPollRequest):Promise<ProbeTypesPollResponse>;
    claim(node:string,fingerprint:string,epoch:number,input:ProbeTypesClaimRequest):Promise<ProbeTypesClaimResponse>;
    status(node:string,fingerprint:string,epoch:number,input:ProbeTypesStatusRequest):Promise<ProbeTypesStatusResponse>;
    result(node:string,fingerprint:string,epoch:number,input:ProbeTypesResultRequest):Promise<ProbeTypesResultResponse>;
}
export interface ProbeServicesApi {
    poll(node:string,fingerprint:string,epoch:number,input:ProbeServicesPollRequest):Promise<ProbeServicesPollResponse>;
    claim(node:string,fingerprint:string,epoch:number,input:ProbeServicesClaimRequest):Promise<ProbeServicesClaimResponse>;
    status(node:string,fingerprint:string,epoch:number,input:ProbeServicesStatusRequest):Promise<ProbeServicesStatusResponse>;
    result(node:string,fingerprint:string,epoch:number,input:ProbeServicesResultRequest):Promise<ProbeServicesResultResponse>;
}
