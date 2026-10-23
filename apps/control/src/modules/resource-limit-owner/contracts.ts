import type { ScopeAuthorization, ScopeOwnerAuthorization, TransactionBoundary,
    NodeAuthorityStore, RuntimeNodeResources, RuntimePortUsageStore, SharedResourceLimitStore } from '../../framework/public.ts';

export interface SharedResourceLimitInput {
    expectedRevision:number;startsAt:string;endsAt:string;
    bytesPerSecond:number|null;burstBytes:number;byteLimit:number|null;
}
export interface SharedResourceLimitView {
    nodeId:string;scopeId:string;actorId:string;revision:number;
    policy:null|{bucketId:string;startsAt:string;endsAt:string;bytesPerSecond:number|null;burstBytes:number;byteLimit:number|null};
    consumption:{status:'unavailable';source:'agent-protected-journal';usedBytes:null;remainingBytes:null};
}
export interface SharedResourceLimitApi {
    set(actor:string,scope:string,node:string,subject:string,request:string,input:SharedResourceLimitInput):Promise<SharedResourceLimitView>;
    get(actor:string,scope:string,node:string,subject:string):Promise<SharedResourceLimitView>;
}
export interface SharedResourceLimitOptions<Tx> {
    db:TransactionBoundary<Tx>;
    identity:ScopeAuthorization<Tx>&ScopeOwnerAuthorization<Tx>;
    nodes:NodeAuthorityStore<Tx>;
    runtime:RuntimeNodeResources<Tx>;
    owners:Pick<RuntimePortUsageStore<Tx>,'forwardPortOwner'>;
    store:SharedResourceLimitStore<Tx>;
    now:()=>number;
    codec:{digest(value:unknown):string;formatTime(at:number):string;parseTime(value:string):number;newID():string};
}
export type SharedResourceLimitPublicationOptions<Tx>=Pick<SharedResourceLimitOptions<Tx>,'nodes'|'owners'|'store'>&{
    codec:Pick<SharedResourceLimitOptions<Tx>['codec'],'formatTime'>;
};
