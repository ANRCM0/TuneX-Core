import type { ConsolePaging } from '../console-query-owner/public.ts';
import type { IngressBatchEvidence, IngressBatchQuery, IngressDeploymentHeadView } from './deployment-api.ts';
import type { IngressMigrationAttempt, IngressMigrationItem, IngressMigrationPlan } from './migration-contracts.ts';
import type { PublicationOperation } from '../path-owner/public.ts';
import type { INGRESS_MIGRATION_LIMITS } from './limits.ts';

export const INGRESS_MIGRATION_API_INTERFACE_VERSION=1 as const;

export type IngressMigrationAttemptView=Omit<IngressMigrationAttempt,'createdAt'>&{createdAt:string};
export interface IngressMigrationPreview extends IngressMigrationPlan,IngressBatchEvidence {
    previewDigest:string;limits:typeof INGRESS_MIGRATION_LIMITS;impactScope:string;interruption:string;removeCompensation:boolean;
}
export interface IngressMigrationPage extends ConsolePaging,IngressBatchEvidence {total:number;items:IngressDeploymentHeadView[]}
export interface IngressMigrationView extends IngressDeploymentHeadView,IngressBatchEvidence {
    plan:IngressMigrationPlan;attempts:IngressMigrationAttemptView[];
    items:{position:number;action:IngressMigrationItem['kind'];state:string;apply:IngressMigrationAttemptView|null;compensation:IngressMigrationAttemptView|null;compensatable:boolean}[];
    operations:PublicationOperation[];impactScope:string;removeCompensation:boolean;consistency:string;
}
export interface IngressMigrationCreated {status:202;body:{batchId:string;revision:number;planDigest:string;changed:true;reserved:false;executionAuthorized:false}}
export interface IngressMigrationActed {status:202;body:{batchId:string;revision:number;position:number;kind:IngressMigrationAttempt['kind'];attempt:IngressMigrationAttemptView;atomicAcrossForwards:false}}
export interface IngressMigrationCancelled {status:200|202;body:{batchId:string;revision:number;cancelled:true;changed:boolean}}
export interface IngressMigrationApi {
    preview(actor:string,scope:string,input:unknown):Promise<IngressMigrationPreview>;
    create(actor:string,scope:string,key:string|undefined,input:unknown,previewDigest:unknown):Promise<IngressMigrationCreated>;
    get(actor:string,scope:string,id:string):Promise<IngressMigrationView>;
    list(actor:string,scope:string,input?:IngressBatchQuery):Promise<IngressMigrationPage>;
    act(actor:string,scope:string,id:string,key:string|undefined,expectedRevision:number,kind:IngressMigrationAttempt['kind'],position:number):Promise<IngressMigrationActed>;
    cancel(actor:string,scope:string,id:string,key:string|undefined,expectedRevision:number):Promise<IngressMigrationCancelled>;
}
