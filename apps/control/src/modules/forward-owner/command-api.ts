import type { PathBindingReceipt } from '../path-owner/public.ts';
import type { PathGroupBindingReceipt } from '../path-owner/public.ts';

export const FORWARD_COMMAND_INTERFACE_VERSION=2 as const;

export interface ForwardAccepted {
    status:200|202;
    body:{forwardId:string;revision:number;operationId:string|null;sourceOperationId?:string;pathBinding?:PathBindingReceipt;pathGroupBinding?:PathGroupBindingReceipt};
}
export interface ForwardOwnerClassified {
    status:200;
    body:{forwardId:string;revision:number;ownerActorId:string;classified:true;operationId:null};
}
export interface ForwardCommandApi {
    classifyOwner(actorId:string,scopeId:string,id:string,key:string|undefined,expectedRevision:number,ownerActorId:string):Promise<ForwardOwnerClassified>;
    create(actorId:string,scopeId:string,key:string|undefined,input:unknown):Promise<ForwardAccepted>;
    update(actorId:string,scopeId:string,id:string,key:string|undefined,expectedRevision:number,input:unknown):Promise<ForwardAccepted>;
    remove(actorId:string,scopeId:string,id:string,key:string|undefined,expectedRevision:number):Promise<ForwardAccepted>;
    retry(actorId:string,scopeId:string,key:string|undefined,sourceOperationId:string,expectedRevision:number):Promise<ForwardAccepted>;
}
export interface ForwardBindingApi {
    applyPath(actorId:string,scopeId:string,id:string,key:string|undefined,expectedRevision:number,input:unknown):Promise<ForwardAccepted>;
    applyGroup(actorId:string,scopeId:string,id:string,key:string|undefined,expectedRevision:number,input:unknown):Promise<ForwardAccepted>;
}
