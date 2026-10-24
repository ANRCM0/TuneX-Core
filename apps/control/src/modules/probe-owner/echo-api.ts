import type { ProbeEchoQualificationResponse, ProbeEchoPollResponse, ProbeEchoClaimResponse,
    ProbeEchoStatusResponse, ProbeEchoResultResponse } from '../../compatibility/public.ts';
export interface ProbeEchoRegistryApi {
    handle(node:string,fingerprint:string,epoch:number,input:unknown):Promise<ProbeEchoQualificationResponse>;
}
export interface ProbeEchoApi {
    poll(node:string,fingerprint:string,epoch:number,input:unknown):Promise<ProbeEchoPollResponse>;
    claim(node:string,fingerprint:string,epoch:number,input:unknown):Promise<ProbeEchoClaimResponse>;
    status(node:string,fingerprint:string,epoch:number,input:unknown):Promise<ProbeEchoStatusResponse>;
    result(node:string,fingerprint:string,epoch:number,input:unknown):Promise<ProbeEchoResultResponse>;
}
