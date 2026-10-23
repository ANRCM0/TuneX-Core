import type { NodeGrantPortLimits } from '../node-owner/public.ts';
import type { MemberChangeInput, MemberChangeState } from './contracts.ts';
import type { NodeUseRole } from '../../framework/public.ts';

export const ACCESS_COMMAND_INTERFACE_VERSION=3 as const;

export interface MemberChangeResponse {
    status:200|202;
    body:Omit<MemberChangeState,'changed'>&{operationIds:string[];latestAuthorizationUntil:string|null};
}
export interface NodeGrantResponse {
    status:200|202;
    body:{nodeId:string;actorId:string;revision:number;allowed:boolean;allowedRoles:readonly NodeUseRole[]|null;portLimits:NodeGrantPortLimits|null;operationIds:string[];latestAuthorizationUntil:string|null};
}
export interface AccessCommandApi {
    changeMember(actorId:string,scopeId:string,subject:string,key:string|undefined,input:MemberChangeInput):Promise<MemberChangeResponse>;
    changeNodeGrant(actorId:string,scopeId:string,nodeId:string,subject:string,key:string|undefined,expectedRevision:number,allowed:boolean,allowedRoles?:readonly NodeUseRole[]|null,portLimits?:NodeGrantPortLimits|null):Promise<NodeGrantResponse>;
}
