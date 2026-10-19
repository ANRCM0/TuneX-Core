import type { TransportGrantState } from './contracts.ts';

export const TRANSPORT_GRANT_INTERFACE_VERSION=1 as const;

export interface TransportGrantResponse {status:200|202;body:TransportGrantState&{operationIds:string[]}}
export interface TransportGrantApi {
    change(actorId:string,scopeId:string,profileId:string,subject:string,key:string|undefined,expectedRevision:number,allowed:boolean):Promise<TransportGrantResponse>;
}
