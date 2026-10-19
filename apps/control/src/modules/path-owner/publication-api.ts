import type { ConsolePaging } from '../console-query-owner/public.ts';
import type { PathBindingEvidence } from './binding-api.ts';
import type { PathPublicationAttempt, PathPublicationHead, PathPublicationPlan, PublicationOperation } from './publication-contracts.ts';
import type { PATH_PUBLICATION_LIMITS } from './limits.ts';

export const PATH_PUBLICATION_API_INTERFACE_VERSION=1 as const;

export interface PathPublicationEvidence extends PathBindingEvidence {health:'unknown';automaticExecution:false;atomicAcrossForwards:false}
export type PathPublicationHeadView=Omit<PathPublicationHead,'createdAt'>&{createdAt:string};
export type PathPublicationAttemptView=Omit<PathPublicationAttempt,'createdAt'>&{createdAt:string};
export interface PathPublicationPreview extends PathPublicationPlan,PathPublicationEvidence {
    previewDigest:string;limits:typeof PATH_PUBLICATION_LIMITS;interruption:string;tcp:string;udp:string;
}
export interface PathPublicationPage extends ConsolePaging,PathPublicationEvidence {total:number;items:PathPublicationHeadView[]}
export interface PathPublicationView extends PathPublicationHeadView,PathPublicationEvidence {
    plan:PathPublicationPlan;attempts:PathPublicationAttemptView[];
    items:{position:number;state:string;apply:PathPublicationAttemptView|null;compensation:PathPublicationAttemptView|null}[];
    operations:PublicationOperation[];consistency:string;
}
export interface PathPublicationCreated {status:200|202;body:{batchId:string;revision:number;planDigest:string;changed:boolean;reserved:false;executionAuthorized:false}}
export interface PathPublicationActed {status:200|202;body:{batchId:string;revision:number;position:number;kind:'apply'|'compensate';attempt:PathPublicationAttemptView;atomicAcrossForwards:false}}
export interface PathPublicationCancelled {status:200|202;body:{batchId:string;revision:number;cancelled:true;changed:boolean}}
export interface PathPublicationApi {
    preview(actor:string,scope:string,input:unknown):Promise<PathPublicationPreview>;
    create(actor:string,scope:string,key:string|undefined,input:unknown,previewDigest:unknown):Promise<PathPublicationCreated>;
    get(actor:string,scope:string,id:string):Promise<PathPublicationView>;
    list(actor:string,scope:string,input?:{page?:string;limit?:string}):Promise<PathPublicationPage>;
    act(actor:string,scope:string,id:string,key:string|undefined,expectedRevision:number,kind:'apply'|'compensate',position:number):Promise<PathPublicationActed>;
    cancel(actor:string,scope:string,id:string,key:string|undefined,expectedRevision:number):Promise<PathPublicationCancelled>;
}
