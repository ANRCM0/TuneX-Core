import type { ConsolePaging } from '../console-query-owner/public.ts';
import type { PathTemplateHead, PathTemplateRevision } from './template-contracts.ts';

export const PATH_TEMPLATE_API_INTERFACE_VERSION=2 as const;
export interface PathTemplateQuery {page?:string|undefined;limit?:string|undefined;prefix?:string|undefined}
export interface PathTemplatePage extends ConsolePaging {total:number;items:PathTemplateHead[];source:string;executionAuthorized:boolean}
export interface PathTemplateView extends PathTemplateHead,Omit<PathTemplateRevision,'createdAt'> {
    createdAt:string;capabilityRequirements:string[];source:string;referenceAuthorization:string;
    executionAuthorized:boolean;reserved:boolean;bindingCreated:boolean;
}
export interface TemplateResponse {status:200|202;body:{templateId:string;revision:number;configDigest:string;archived:boolean;changed:boolean}}
export interface TemplateOwnerClassified {status:200;body:{templateId:string;revision:number;ownerActorId:string;classified:true}}
export interface PathTemplateQueryApi {
    list(actor:string,scope:string,input?:PathTemplateQuery):Promise<PathTemplatePage>;
    get(actor:string,scope:string,id:string,requestedRevision?:number):Promise<PathTemplateView>;
}
export interface PathTemplateCommandApi {
    classifyOwner(actor:string,scope:string,id:string,key:string|undefined,expectedRevision:number,ownerActorId:string):Promise<TemplateOwnerClassified>;
    publish(actor:string,scope:string,id:string,key:string|undefined,expectedRevision:number,input:unknown):Promise<TemplateResponse>;
    archive(actor:string,scope:string,id:string,key:string|undefined,expectedRevision:number):Promise<TemplateResponse>;
}
