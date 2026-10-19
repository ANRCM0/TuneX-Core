import type { ConsolePaging } from '../console-query-owner/public.ts';
import type { PathPublicationEvidence } from '../path-owner/public.ts';
import type { IngressAttempt, IngressDeploymentHead, IngressPlan } from './contracts.ts';
import type { PublicationOperation } from '../path-owner/public.ts';
import type { INGRESS_LIMITS } from './limits.ts';

export const INGRESS_DEPLOYMENT_API_INTERFACE_VERSION=1 as const;

export interface IngressBatchQuery {page?:string|undefined;limit?:string|undefined;groupId?:string|undefined}
export interface IngressBatchEvidence extends PathPublicationEvidence {physicalConnectionSharing:false}
export type IngressDeploymentHeadView=Omit<IngressDeploymentHead,'createdAt'>&{createdAt:string};
export type IngressAttemptView=Omit<IngressAttempt,'createdAt'>&{createdAt:string};
export interface IngressDeploymentPreview extends IngressPlan,IngressBatchEvidence {previewDigest:string;limits:typeof INGRESS_LIMITS;interruption:string}
export interface IngressDeploymentPage extends ConsolePaging,IngressBatchEvidence {total:number;items:IngressDeploymentHeadView[]}
export interface IngressDeploymentView extends IngressDeploymentHeadView,IngressBatchEvidence {
    plan:IngressPlan;attempts:IngressAttemptView[];
    items:{position:number;state:string;create:IngressAttemptView|null;compensation:IngressAttemptView|null}[];
    operations:PublicationOperation[];consistency:string;
}
export interface IngressDeploymentCreated {status:202;body:{batchId:string;revision:number;planDigest:string;changed:true;reserved:false;executionAuthorized:false}}
export interface IngressDeploymentActed {status:202;body:{batchId:string;revision:number;position:number;kind:IngressAttempt['kind'];attempt:IngressAttemptView;atomicAcrossForwards:false}}
export interface IngressDeploymentCancelled {status:200|202;body:{batchId:string;revision:number;cancelled:true;changed:boolean}}
export interface IngressDeploymentApi {
    preview(actor:string,scope:string,input:unknown):Promise<IngressDeploymentPreview>;
    create(actor:string,scope:string,key:string|undefined,input:unknown,previewDigest:unknown):Promise<IngressDeploymentCreated>;
    get(actor:string,scope:string,id:string):Promise<IngressDeploymentView>;
    list(actor:string,scope:string,input?:IngressBatchQuery):Promise<IngressDeploymentPage>;
    act(actor:string,scope:string,id:string,key:string|undefined,expectedRevision:number,kind:IngressAttempt['kind'],position:number):Promise<IngressDeploymentActed>;
    cancel(actor:string,scope:string,id:string,key:string|undefined,expectedRevision:number):Promise<IngressDeploymentCancelled>;
}
