import type { ForwardProbePlan } from '../probe-owner/public.ts';
import type { ProbePlanConfig, ProbePlanDecision, ProbePlanHead, ProbePlanLosses } from './contracts.ts';
import type { PROBE_PLAN_LIMITS } from './policy.ts';

export interface ProbePlanView extends ProbePlanHead {
    expired:boolean;remainingRuns:number;health:string;executionAuthorized:boolean;originBindingCurrent:string;configStoredOnly:boolean;contentDigest:string;
}
export interface ProbePlanReceipt {
    status:200|202;body:{planId:string;revision:number;state:ProbePlanHead['state'];changed:boolean;decision:ProbePlanDecision|null};
}
export interface ProbePlanEnvelope {
    probePlansVersion:number;scopeId:string;capturedAt:number;source:string;readOnly:boolean;executionAuthorized:boolean;health:string;
    networkCheck:string;consistency:string;historyComplete:boolean;executionEnabled:boolean;scheduleEnabled:boolean;
    ingressExecutionEnabled:boolean;servicesExecutionEnabled:boolean;workerState:string;limits:typeof PROBE_PLAN_LIMITS;
}
export interface ProbePlanPreview extends ProbePlanEnvelope {
    config:ProbePlanConfig;preflight:ForwardProbePlan;previewDigest:string;configStoredOnly:boolean;
}
export interface ProbePlanDetail extends ProbePlanEnvelope {plan:ProbePlanView;decisions:ProbePlanDecision[];losses:ProbePlanLosses|null}
export interface ProbePlanHistory extends ProbePlanEnvelope {
    window:{from:number;to:number};filters:{forwardId:string|null;mode:string|null;state:string|null};limit:number;
    items:ProbePlanView[];hasMore:boolean;nextCursor:string|null;losses:ProbePlanLosses|null;
}
export interface ProbePlansApi {
    admitRequest<T>(action:()=>Promise<T>):Promise<T>;
    preview(actor:string,scope:string,input:unknown):Promise<ProbePlanPreview>;
    create(actor:string,scope:string,key:string|undefined,input:unknown):Promise<ProbePlanReceipt>;
    get(actor:string,scope:string,id:string):Promise<ProbePlanDetail>;
    history(actor:string,scope:string,input?:Record<string,string>):Promise<ProbePlanHistory>;
    command(actor:string,scope:string,id:string,key:string|undefined,action:'run'|'cancel',input:unknown):Promise<ProbePlanReceipt>;
}
