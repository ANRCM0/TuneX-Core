import type { ConsolePaging } from '../console-query-owner/public.ts';
import type { PathBindingEvidence } from '../path-owner/public.ts';
import type { IngressGroupHead, IngressGroupMember, IngressGroupRevision } from './contracts.ts';

export const INGRESS_GROUP_API_INTERFACE_VERSION=2 as const;

export interface IngressGroupQuery {page?:string|undefined;limit?:string|undefined;prefix?:string|undefined}
export interface IngressGroupEvidence extends PathBindingEvidence {health:'unknown';physicalConnectionSharing:false;referenceAuthorization:'not-rechecked-by-this-query'}
export interface IngressGroupPage extends ConsolePaging,IngressGroupEvidence {total:number;items:IngressGroupHead[]}
export interface IngressGroupView extends IngressGroupHead,Omit<IngressGroupRevision,'createdAt'>,IngressGroupEvidence {createdAt:string;members:IngressGroupMember[]}
export interface IngressGroupResponse {status:200|202;body:{groupId:string;revision:number;configDigest:string;archived:boolean;changed:boolean}}
export interface IngressGroupApi {
    classifyOwner(actor:string,scope:string,id:string,key:string|undefined,expectedRevision:number,ownerActorId:string):Promise<{status:200;body:{groupId:string;revision:number;ownerActorId:string;classified:true}}>;
    list(actor:string,scope:string,input?:IngressGroupQuery):Promise<IngressGroupPage>;
    get(actor:string,scope:string,id:string,requestedRevision?:number):Promise<IngressGroupView>;
    publish(actor:string,scope:string,id:string,key:string|undefined,expectedRevision:number,input:unknown):Promise<IngressGroupResponse>;
    archive(actor:string,scope:string,id:string,key:string|undefined,expectedRevision:number):Promise<IngressGroupResponse>;
}
