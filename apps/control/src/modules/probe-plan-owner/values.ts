import { deepFreeze, isCounter, isId } from '@tunex/core';
import { nativeValueDigest as digest, parseProbeServiceSelection, nativeParseTime, nativeIsoTime,
    jsonUtf8Bytes } from '../../compatibility/public.ts';
import { parseProbeServiceReference } from '../observation-service-owner/public.ts';
import { invalid } from '../../framework/public.ts';
import { validProbeBinding } from '../probe-owner/public.ts';
import type { AnyProbeAcceptance } from '../probe-owner/public.ts';
import type { ProbePlanCode, ProbePlanConfig, ProbePlanDecision, ProbePlanHead, ProbePlanLosses } from './contracts.ts';

import { PROBE_PLAN_LIMITS } from './policy.ts';
export { PROBE_PLAN_LIMITS } from './policy.ts';
export const PROBE_PLAN_STATES = ['active','completed','cancelled','expired','suspended'] as const;
export const PROBE_PLAN_REJECTIONS = ['PROBE_DISABLED','PROBE_UNAVAILABLE','PROBE_PERMIT_UNAVAILABLE','PROBE_PERMIT_LIMIT',
    'AUTHORIZATION_DENIED','NOT_FOUND','REVISION_CONFLICT','UNSUPPORTED_CAPABILITY','SESSION_SUPERSEDED'] as const;
export const PROBE_PLAN_TRANSIENT = ['PROBE_UNAVAILABLE','PROBE_PERMIT_UNAVAILABLE','PROBE_PERMIT_LIMIT','SESSION_SUPERSEDED'] as const;
export const PROBE_PLAN_CODES:readonly ProbePlanCode[] = ['PERMIT_ACCEPTED','PLAN_CANCELLED','PLAN_EXPIRED','AUTHORIZATION_REVOKED','RECOVERY_SUSPENDED',...PROBE_PLAN_REJECTIONS];
export const probePlanTime = (value:unknown):value is number => typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=253402300799999;
export const probePlanHash = (value:unknown):value is string => typeof value==='string'&&/^sha256:[a-f0-9]{64}$(?![\s\S])/.test(value);
export function probePlanObject(input:unknown,keys:readonly string[]):Record<string,unknown> {
    if(!input||typeof input!=='object'||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input))||
        Object.keys(input).sort().join(',')!==[...keys].sort().join(','))invalid('Closed Probe plan object required');
    return input as Record<string,unknown>;
}
export function probePlanIso(value:unknown):number {
    if(typeof value!=='string')invalid('Canonical UTC Probe plan time required');const at=nativeParseTime(value);
    if(!probePlanTime(at)||nativeIsoTime(at)!==value)invalid('Canonical UTC Probe plan time required');return at;
}
const configKeys=['version','kind','forwardId','expectedForwardRevision','timeoutMs','mode','intervalSeconds','maxRuns','expiresAt'];
export function parseProbePlanConfig(input:unknown):ProbePlanConfig {
    const tls=input!==null&&typeof input==='object'&&'kind' in input&&input.kind==='tcp-ingress-tls';
    const value=probePlanObject(input,[...configKeys,...(tls?['service']:[])]);
    if(value.version!==1||!['tcp-connect','tcp-ingress-connect','tcp-ingress-tls'].includes(value.kind as string)||!isId(value.forwardId)||!isCounter(value.expectedForwardRevision)||
        !isCounter(value.timeoutMs)||value.timeoutMs<100||value.timeoutMs>2000||!['manual','scheduled'].includes(value.mode as string)||
        !isCounter(value.maxRuns)||value.maxRuns>PROBE_PLAN_LIMITS.decisionsPerPlan||!probePlanTime(value.expiresAt)||
        (value.mode==='manual'?value.intervalSeconds!==null:!isCounter(value.intervalSeconds)||value.intervalSeconds<30||value.intervalSeconds>3600))
        invalid('Bounded existing Direct TCP Probe plan required');
    return deepFreeze({...value,...(tls?{service:parseProbeServiceReference(value.service)}:{})} as unknown as ProbePlanConfig);
}
export function parseProbePlanInput(input:unknown):ProbePlanConfig {
    const tls=input!==null&&typeof input==='object'&&'kind' in input&&input.kind==='tcp-ingress-tls';
    const value=probePlanObject(input,[...configKeys,...(tls?['service']:[])]);return parseProbePlanConfig({...value,expiresAt:probePlanIso(value.expiresAt)});
}
export function parseProbePlanHead(input:unknown):ProbePlanHead {
    const value=probePlanObject(input,['id','scopeId','createdBy','createdAt','config','configDigest','originBinding','revision','state','decisionCount','acceptedCount',
        'nextRunAt','updatedAt','cancelledBy','cancelledAt','lastCode','recoverySuspended']),config=parseProbePlanConfig(value.config);
    if(![value.id,value.scopeId,value.createdBy].every(isId)||!probePlanTime(value.createdAt)||!probePlanTime(value.updatedAt)||value.updatedAt<value.createdAt||
        config.expiresAt<=value.createdAt||config.expiresAt-value.createdAt>PROBE_PLAN_LIMITS.maxLifetimeMs||!probePlanHash(value.configDigest)||value.configDigest!==digest(config)||
        !validProbeBinding(value.originBinding)||value.originBinding.forwardId!==config.forwardId||value.originBinding.forwardRevision!==config.expectedForwardRevision||
        !isCounter(value.revision)||!PROBE_PLAN_STATES.includes(value.state as ProbePlanHead['state'])||!isCounter(value.decisionCount,true)||value.decisionCount>config.maxRuns||
        !isCounter(value.acceptedCount,true)||value.acceptedCount>value.decisionCount||!probePlanTime(value.nextRunAt)||typeof value.recoverySuspended!=='boolean'||
        value.lastCode!==null&&!PROBE_PLAN_CODES.includes(value.lastCode as ProbePlanCode)||
        (value.cancelledBy===null)!==(value.cancelledAt===null)||value.cancelledBy!==null&&(!isId(value.cancelledBy)||!probePlanTime(value.cancelledAt)||value.cancelledAt<value.createdAt||value.cancelledAt>value.updatedAt)||
        (value.state==='cancelled')!==(value.cancelledAt!==null)||value.state==='active'&&(value.recoverySuspended||value.decisionCount>=config.maxRuns)||
        (value.state==='active'&&config.mode==='scheduled'?value.nextRunAt<=0:value.nextRunAt!==0)||
        value.state==='completed'&&value.decisionCount!==config.maxRuns||value.state==='expired'&&value.updatedAt<config.expiresAt||
        value.state==='cancelled'&&value.lastCode!=='PLAN_CANCELLED')invalid('Invalid persisted Probe plan');
    const head={...value,config,originBinding:{...value.originBinding}} as unknown as ProbePlanHead;
    if(jsonUtf8Bytes(head)>PROBE_PLAN_LIMITS.maxPlanBytes)invalid('Bounded Probe plan head required');return deepFreeze(head);
}
export function parseProbePlanReceipt(input:unknown,config:ProbePlanConfig|undefined,at:number,scope?:string):AnyProbeAcceptance {
    const value=probePlanObject(input,['status','body']);
    const ingress=value.body!==null&&typeof value.body==='object'&&Object.hasOwn(value.body,'probeVersion');
    const tls=ingress&&(value.body as Record<string,unknown>).probeVersion===3;
    const body=probePlanObject(value.body,['probeId','forwardId','issuedAt','expiresAt','dispatch','executionEnabled',...(ingress?['probeVersion','measurement','taskKind','point','capability']:[]),...(tls?['service']:[])]);
    const kind=tls?'tcp-ingress-tls':ingress?'tcp-ingress-connect':'tcp-connect';
    if(config!==undefined&&config.kind!==kind||ingress&&(body.probeVersion!==(tls?3:2)||body.measurement!==`${kind}-v1`||
        body.taskKind!==kind||body.point!=='agent-local-direct-ingress'||body.capability!==`probe.${kind}.v1`))invalid('Probe plan receipt measurement differs');
    const service=tls?parseProbeServiceSelection(body.service):undefined;
    if(service&&scope!==undefined&&service.scopeId!==scope)invalid('Probe plan receipt service Scope differs');
    if(service&&config!==undefined&&(!config.service||service.serviceId!==config.service.serviceId||service.revision!==config.service.revision||
        service.configRevision!==config.service.configRevision||service.configDigest!==config.service.configDigest))invalid('Probe plan receipt service differs');
    const issued=probePlanIso(body.issuedAt),expires=probePlanIso(body.expiresAt);
    if(value.status!==202||!isId(body.probeId)||!isId(body.forwardId)||config!==undefined&&body.forwardId!==config.forwardId||body.dispatch!=='agent-poll'||body.executionEnabled!==false||
        expires<=issued||expires-issued>2000||config!==undefined&&expires>config.expiresAt||issued>at)invalid('Invalid original Probe acceptance in plan');
    return deepFreeze({status:202,body:{probeId:body.probeId,forwardId:body.forwardId as string,issuedAt:body.issuedAt as string,expiresAt:body.expiresAt as string,
        dispatch:'agent-poll',executionEnabled:false,...(tls?{probeVersion:3,measurement:'tcp-ingress-tls-v1',taskKind:'tcp-ingress-tls',point:'agent-local-direct-ingress',capability:'probe.tcp-ingress-tls.v1',service}:
        ingress?{probeVersion:2,measurement:'tcp-ingress-connect-v1',taskKind:'tcp-ingress-connect',point:'agent-local-direct-ingress',capability:'probe.tcp-ingress-connect.v1'}:{})}} as AnyProbeAcceptance);
}
export function parseProbePlanDecision(input:unknown,config?:ProbePlanConfig,scope?:string):ProbePlanDecision {
    const value=probePlanObject(input,['position','actorId','source','decidedAt','outcome']);
    if(!isCounter(value.position)||value.position>16||!isId(value.actorId)||!['manual','scheduled'].includes(value.source as string)||!probePlanTime(value.decidedAt))
        invalid('Invalid Probe plan decision');
    const raw=value.outcome as {accepted?:unknown}|null;
    if(!raw||typeof raw.accepted!=='boolean')invalid('Closed Probe plan outcome required');
    let outcome:ProbePlanDecision['outcome'];
    if(raw.accepted) {
        const accepted=probePlanObject(raw,['accepted','receipt']);
        outcome={accepted:true,receipt:parseProbePlanReceipt(accepted.receipt,config,value.decidedAt,scope)};
    } else {
        const rejected=probePlanObject(raw,['accepted','error']),error=probePlanObject(rejected.error,['code','status']);
        if(!PROBE_PLAN_REJECTIONS.includes(error.code as typeof PROBE_PLAN_REJECTIONS[number])||![403,404,409,422,429].includes(error.status as number))invalid('Invalid Probe plan rejection');
        outcome={accepted:false,error:{code:error.code as ProbePlanCode,status:error.status as 403|404|409|422|429}};
    }
    const decision={...value,outcome} as unknown as ProbePlanDecision;
    if(config!==undefined&&(decision.position>config.maxRuns||decision.source!==config.mode)||
        jsonUtf8Bytes(decision)>PROBE_PLAN_LIMITS.maxDecisionBytes)invalid('Bounded exact Probe plan decision required');
    return deepFreeze(decision);
}
export function parseProbePlanLosses(input:unknown):ProbePlanLosses {
    const value=probePlanObject(input,['rowsExpired','rowsEvicted','decisionsEvicted']);
    if(Object.values(value).some(v=>!isCounter(v,true)))invalid('Invalid Probe plan loss counters');return deepFreeze(value as unknown as ProbePlanLosses);
}
export function probePlanImmutable(value:ProbePlanHead):string {
    return digest({id:value.id,scopeId:value.scopeId,createdBy:value.createdBy,createdAt:value.createdAt,config:value.config,configDigest:value.configDigest,originBinding:value.originBinding});
}
export function publicProbePlan(value:ProbePlanHead,now:number) {
    return deepFreeze({...value,expired:now>=value.config.expiresAt,remainingRuns:value.config.maxRuns-value.decisionCount,
        health:'unknown',executionAuthorized:false,originBindingCurrent:'not-evaluated',configStoredOnly:true,contentDigest:digest(value)});
}
