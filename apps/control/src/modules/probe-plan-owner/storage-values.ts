import { ControlError, freezeModuleValue } from '../../framework/public.ts';
import type { ProbePlanStorageValues } from '../../framework/public.ts';
import type { ProbePlanHead, ProbePlanDecision, ProbePlanFailure } from './contracts.ts';
import { parseProbePlanHead, parseProbePlanDecision, probePlanImmutable, PROBE_PLAN_REJECTIONS } from './values.ts';

export const probePlanStorageValues:ProbePlanStorageValues<ProbePlanHead,ProbePlanDecision,ProbePlanFailure>=freezeModuleValue({
    head:parseProbePlanHead,decision:parseProbePlanDecision,immutable:probePlanImmutable,
    expired:(head:ProbePlanHead,now:number):ProbePlanHead|null=>head.state==='active'&&head.config.expiresAt<=now?
        {...head,state:'expired',revision:head.revision+1,nextRunAt:0,lastCode:'PLAN_EXPIRED',updatedAt:Math.max(head.updatedAt,now)}:null,
    failure:(error:unknown):ProbePlanFailure|null=>{
        if(!(error instanceof ControlError)||!PROBE_PLAN_REJECTIONS.includes(error.code as typeof PROBE_PLAN_REJECTIONS[number])||![403,404,409,422,429].includes(error.status)||
            error.retryable&&!(error.code==='PROBE_PERMIT_LIMIT'&&error.status===429))return null;
        return {code:error.code as ProbePlanFailure['code'],status:error.status as ProbePlanFailure['status']};
    },
});
