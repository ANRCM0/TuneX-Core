import type { ForwardIntent } from '../../framework/public.ts';
import type { PathBindingPreview, PathSelection } from './binding-contracts.ts';
import type { PathTemplateConfig } from './template-contracts.ts';
import type { ConsolePaging } from '../console-query-owner/public.ts';

export const PATH_BINDING_API_INTERFACE_VERSION=2 as const;
export interface PathBindingPointer extends PathSelection {sequence:number;forwardRevision:number}
export interface PathBindingHistoryItem extends PathBindingPointer {
    expandedSpec:ForwardIntent;specDigest:string;actorId:string;createdAt:string;current:boolean;
}
export interface PathBindingEvidence {
    source:'persisted-control-state';reserved:false;executionAuthorized:false;fullPlanAuthorization:false;
}
export interface PathBindingView extends PathBindingEvidence {
    forwardId:string;ownerActorId:string|null;revision:number;deleting:boolean;recoverySuspended:boolean;
    binding:PathBindingHistoryItem|null|undefined;history:PathBindingHistoryItem[];
    referenceAuthorization:string;consistency:string;
}
export interface PathBindingReferenceQuery {page?:string;limit?:string;revision?:number;targetRevision?:number}
export interface PathBindingReferenceItem {
    forwardId:string;expectedRevision:number;binding:PathBindingPointer;recoverySuspended:boolean;
    spec:ForwardIntent;proposedSpec:ForwardIntent|null;unavailableReason:string|null;changed:boolean|null;
}
export interface PathBindingReferenceView extends ConsolePaging,PathBindingEvidence {
    templateId:string;ownerActorId:string|null;currentRevision:number;archived:boolean;total:number;referenceRevision:number|null;
    target:(PathSelection&{config:PathTemplateConfig})|null;items:PathBindingReferenceItem[];
    previewOnly:boolean;consistency:string;observedAt:string;
}
export interface PathBindingApi {
    get(actor:string,scope:string,forwardId:string):Promise<PathBindingView>;
    preview(actor:string,scope:string,forwardId:string,expectedRevision:number,input:unknown):Promise<PathBindingPreview>;
    references(actor:string,scope:string,id:string,input?:PathBindingReferenceQuery):Promise<PathBindingReferenceView>;
}
