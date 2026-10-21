import type { ForwardIntent } from '../../framework/public.ts';
import type { ConsolePaging } from '../console-query-owner/public.ts';
import type { PathBindingEvidence } from './binding-api.ts';
import type { PathBindingPreview, PathSelection } from './binding-contracts.ts';
import type { PathGroupHead, PathGroupRevision, PathGroupSelection } from './group-contracts.ts';

export const PATH_GROUP_API_INTERFACE_VERSION=2 as const;

export interface PathGroupQuery {page?:string|undefined;limit?:string|undefined;prefix?:string|undefined}
export interface PathGroupReferenceQuery {page?:string|undefined;limit?:string|undefined;revision?:number|undefined}
export interface PathGroupResponse {status:200|202;body:{groupId:string;revision:number;configDigest:string;archived:boolean;changed:boolean}}
export interface PathGroupOwnerClassified {status:200;body:{groupId:string;revision:number;ownerActorId:string;classified:true}}
export interface PathGroupPage extends ConsolePaging,PathBindingEvidence {
    total:number;items:PathGroupHead[];health:string;automaticSelection:boolean;
}
export interface PathGroupView extends PathGroupHead,Omit<PathGroupRevision,'createdAt'>,PathBindingEvidence {
    createdAt:string;
    topology:{operator:string;branches:{candidateId:string;priority:number;template:PathSelection;operator:string;nodes:readonly string[];health:string}[];health:string};
    automaticSelection:boolean;referenceAuthorization:string;bindingCreated:boolean;
}
export interface PathGroupBindingPointer extends PathGroupSelection {sequence:number;pathBindingSequence:number;forwardRevision:number}
export interface PathGroupHistoryItem extends PathGroupBindingPointer {
    expandedSpec:ForwardIntent;specDigest:string;actorId:string;createdAt:string;current:boolean;
}
export interface PathGroupBindingView extends PathBindingEvidence {
    forwardId:string;ownerActorId:string|null;revision:number;deleting:boolean;recoverySuspended:boolean;
    binding:PathGroupHistoryItem|null|undefined;history:PathGroupHistoryItem[];
    health:string;automaticSelection:boolean;referenceAuthorization:string;consistency:string;
}
export interface PathGroupReferenceView extends PathGroupHead,ConsolePaging,PathBindingEvidence {
    total:number;referenceRevision:number|null;
    items:{forwardId:string;expectedRevision:number;binding:PathGroupBindingPointer;spec:ForwardIntent;recoverySuspended:boolean}[];
    health:string;automaticSelection:boolean;referenceAuthorization:string;consistency:string;
}
export interface PathGroupPreview extends PathBindingPreview {group:PathGroupSelection;priority:number;automaticSelection:boolean;health:string}
export interface PathGroupApi {
    classifyOwner(actor:string,scope:string,id:string,key:string|undefined,expectedRevision:number,ownerActorId:string):Promise<PathGroupOwnerClassified>;
    list(actor:string,scope:string,input?:PathGroupQuery):Promise<PathGroupPage>;
    get(actor:string,scope:string,id:string,requestedRevision?:number):Promise<PathGroupView>;
    publish(actor:string,scope:string,id:string,key:string|undefined,expectedRevision:number,input:unknown):Promise<PathGroupResponse>;
    archive(actor:string,scope:string,id:string,key:string|undefined,expectedRevision:number):Promise<PathGroupResponse>;
    getBinding(actor:string,scope:string,forwardId:string):Promise<PathGroupBindingView>;
    preview(actor:string,scope:string,forwardId:string,expectedRevision:number,input:unknown):Promise<PathGroupPreview>;
    references(actor:string,scope:string,id:string,input?:PathGroupReferenceQuery):Promise<PathGroupReferenceView>;
}
