import { deepFreeze, isCounter, isId } from '@tunex/core';
import { nativeValueDigest as digest, nativeParseJson as parseJson, nativeMonotonicNow, nativeWallClockSource, jsonUtf8Bytes, nativeModuleId as randomUUID, nativeJsonBase64Url, nativeBase64UrlText } from '../../compatibility/public.ts';
import { parseProbeServiceContext } from '../../compatibility/public.ts';
import { ControlError, invalid, notFound } from '../../framework/public.ts';
import { nativeCommandRequest as requestIdentity } from '../../compatibility/public.ts';
import type { IdempotentRequests, ScopeAuthorization, TransactionBoundary } from '../../framework/public.ts';
import { validProbeBinding } from '../probe-owner/public.ts';
import type { ProbePlanConfig, ProbePlanDecision, ProbePlanHead, ProbePlanHeader, ProbePlanIssuer, ProbePlanQuery, ProbePlanStore } from './contracts.ts';
import type { ProbePlansApi, ProbePlanReceipt } from './api.ts';
export type { ProbePlanReceipt } from './api.ts';
import { PROBE_PLAN_LIMITS as limits } from './policy.ts';
import { parseProbePlanDecision, parseProbePlanHead, parseProbePlanInput, parseProbePlanLosses, parseProbePlanReceipt, probePlanHash,
    probePlanIso, probePlanObject, probePlanTime, PROBE_PLAN_STATES, PROBE_PLAN_TRANSIENT, publicProbePlan } from './values.ts';

const corrupt:()=>never=()=>{throw new ControlError('INTEGRITY_FAILURE',409,'Invalid finite Probe plan state');};
function stored<T>(parse:(value:unknown)=>T,value:unknown):T {try{return parse(value);}catch{return corrupt();}}
function identities(actor:string,scope:string,id?:string) {if(!isId(actor)||!isId(scope)||id!==undefined&&!isId(id))invalid('Valid Probe plan identities required');}
function next(value:number):number {if(!isCounter(value+1))throw new ControlError('REVISION_EXHAUSTED',409,'Probe plan revision exhausted');return value+1;}
function receipt(input:unknown,id?:string,action:'create'|'run'|'cancel'='create',expectedRevision?:number):ProbePlanReceipt {
    return stored(value=>{
        const raw=probePlanObject(value,['status','body']),body=probePlanObject(raw.body,['planId','revision','state','changed','decision']);
        if(!isId(body.planId)||id!==undefined&&body.planId!==id||!isCounter(body.revision)||!PROBE_PLAN_STATES.includes(body.state as ProbePlanHead['state'])||
            typeof body.changed!=='boolean'||raw.status!==(body.changed?202:200))corrupt();
        const decision=body.decision===null?null:parseProbePlanDecision(body.decision);
        if(action==='create'&&(body.revision!==1||body.state!=='active'||body.changed!==true||decision!==null)||
            action!=='create'&&(expectedRevision===undefined||body.revision!==expectedRevision+Number(body.changed))||
            action==='run'&&(body.changed!==true||decision===null||decision.source!=='manual')||
            action==='cancel'&&(decision!==null||body.changed===true&&body.state!=='cancelled'||body.changed===false&&body.state==='active'))corrupt();
        return {status:raw.status,body:{...body,decision}} as ProbePlanReceipt;
    },input);
}
function encodeCursor(queryDigest:string,position:{createdAt:number;id:string}):string {
    return nativeJsonBase64Url({version:1,queryDigest,position},true);
}

/** Bounded intent and decisions; only the original Probe owner can mint each short-lived permit. */
export class ProbePlans<Tx> implements ProbePlansApi {
    private readonly db:TransactionBoundary<Tx>;private readonly auth:ScopeAuthorization<Tx>;private readonly requests:IdempotentRequests<Tx>;
    private readonly store:ProbePlanStore<Tx>;private readonly issuer:ProbePlanIssuer<Tx>;private readonly clock:()=>number;private readonly skew:number;
    readonly executionEnabled:boolean;readonly scheduleEnabled:boolean;readonly ingressExecutionEnabled:boolean;readonly servicesExecutionEnabled:boolean;
    private active=0;private admittedRequests=0;private stopping=false;private running:Promise<void>|null=null;
    private readonly actors=new Map<string,{active:boolean;until:number}>();
    constructor(options:{db:TransactionBoundary<Tx>;auth:ScopeAuthorization<Tx>;requests:IdempotentRequests<Tx>;store:ProbePlanStore<Tx>;
        issuer:ProbePlanIssuer<Tx>;executionEnabled:boolean;scheduleEnabled:boolean;ingressExecutionEnabled?:boolean;servicesExecutionEnabled?:boolean;clock?:()=>number;clockSkewMs?:number}) {
        this.db=options.db;this.auth=options.auth;this.requests=options.requests;this.store=options.store;this.issuer=options.issuer;
        this.executionEnabled=options.executionEnabled;this.scheduleEnabled=options.scheduleEnabled;this.clock=options.clock??nativeWallClockSource();this.skew=options.clockSkewMs??1000;
        this.ingressExecutionEnabled=this.executionEnabled&&options.ingressExecutionEnabled===true;
        this.servicesExecutionEnabled=this.ingressExecutionEnabled&&options.servicesExecutionEnabled===true;
        if(!isCounter(this.skew,true)||this.skew>300000||this.scheduleEnabled&&!this.executionEnabled)throw new Error('Probe schedule requires bounded clock and original Probe execution');
    }
    private now():number {const now=this.clock();if(!probePlanTime(now))corrupt();return now;}
    private bounded<T>(value:T):T {if(jsonUtf8Bytes(value)>limits.maxResponseBytes)corrupt();return deepFreeze(value);}
    private checked(raw:unknown,scope:string,id?:string):ProbePlanHead {
        const value=stored(parseProbePlanHead,raw);if(value.scopeId!==scope||id!==undefined&&value.id!==id)corrupt();return value;
    }
    private envelope(scopeId:string,capturedAt:number) {
        return {probePlansVersion:1,scopeId,capturedAt,source:'persisted-probe-plans',readOnly:true,executionAuthorized:false,health:'unknown',
            networkCheck:'not-performed-by-read',consistency:'read-committed-not-global-snapshot',historyComplete:false,executionEnabled:this.executionEnabled,
            scheduleEnabled:this.scheduleEnabled,ingressExecutionEnabled:this.ingressExecutionEnabled,servicesExecutionEnabled:this.servicesExecutionEnabled,workerState:this.scheduleEnabled?'configured-not-liveness-proof':'disabled',limits};
    }
    async admitRequest<T>(action:()=>Promise<T>):Promise<T> {
        if(this.admittedRequests>=2)throw new ControlError('PROBE_PLAN_BUSY',429,'Probe plan request capacity unavailable',true);
        this.admittedRequests++;try{return await action();}finally{this.admittedRequests--;}
    }
    private async admitted<T>(actor:string,action:()=>Promise<T>):Promise<T> {
        const now=nativeMonotonicNow();for(const [id,value]of this.actors)if(!value.active&&value.until<=now)this.actors.delete(id);
        if(this.active>=2||this.actors.has(actor)||this.actors.size>=128)throw new ControlError('PROBE_PLAN_BUSY',429,'Probe plan capacity or cooldown unavailable',true);
        this.active++;this.actors.set(actor,{active:true,until:Infinity});
        try{return await action();}finally{this.active--;this.actors.set(actor,{active:false,until:nativeMonotonicNow()+1000});}
    }
    private window(config:ProbePlanConfig,now:number) {
        if(config.expiresAt<=now+1000||config.expiresAt-now>limits.maxLifetimeMs||
            config.mode==='scheduled'&&now+config.intervalSeconds!*1000>=config.expiresAt)invalid('Probe plan requires a future finite window and at least one scheduled slot');
    }
    private async preflight(tx:Tx,actor:string,scope:string,config:ProbePlanConfig) {
        const preflight=await this.issuer.previewIn(tx,actor,scope,config);
        if(preflight.scopeId!==scope||!validProbeBinding(preflight.binding)||preflight.binding.forwardId!==config.forwardId||preflight.binding.forwardRevision!==config.expectedForwardRevision||
            preflight.kind!==config.kind||preflight.point!==(config.kind==='tcp-connect'?'agent-direct-egress':'agent-local-direct-ingress')||
            preflight.timeoutMs!==config.timeoutMs||preflight.executable!==false||!probePlanHash(preflight.binding.configDigest))corrupt();
        if(config.kind==='tcp-ingress-tls') {
            if(preflight.kind!=='tcp-ingress-tls'||!config.service)corrupt();
            const context=stored(parseProbeServiceContext,preflight.serviceContext);
            if(context.scopeId!==scope||context.serviceId!==config.service.serviceId||context.revision!==config.service.revision||
                context.configRevision!==config.service.configRevision||context.configDigest!==config.service.configDigest)corrupt();
        }
        return {preflight,previewDigest:digest({config,originDriverDigest:preflight.binding.configDigest})};
    }
    async preview(actor:string,scope:string,input:unknown) {
        identities(actor,scope);const config=parseProbePlanInput(input);
        return this.admitted(actor,()=>this.db.transaction(async tx=>{
            await this.auth.scope(tx,actor,scope,true);this.window(config,this.now());const value=await this.preflight(tx,actor,scope,config),now=this.now();this.window(config,now);
            return this.bounded({...this.envelope(scope,now),config,...value,configStoredOnly:true,executionAuthorized:false});
        }));
    }
    async create(actor:string,scope:string,key:string|undefined,input:unknown):Promise<ProbePlanReceipt> {
        identities(actor,scope);const body=probePlanObject(input,['config','previewDigest']),config=parseProbePlanInput(body.config);
        if(!probePlanHash(body.previewDigest))invalid('Probe plan preview digest required');
        const request=requestIdentity(actor,scope,key,'POST',`/api/v1/scopes/${scope}/probe-plans`,{config,previewDigest:body.previewDigest});
        return this.admitted(actor,()=>this.db.transaction(async tx=>{
            await this.auth.scope(tx,actor,scope,true);const replay=await this.requests.claim<ProbePlanReceipt>(tx,request);if(replay)return this.bounded(receipt(replay));
            this.window(config,this.now());const current=await this.preflight(tx,actor,scope,config);
            if(current.previewDigest!==body.previewDigest)throw new ControlError('REVISION_CONFLICT',409,'Fresh Probe plan preview required');
            await this.store.lockScope(tx,scope);const now=this.now();this.window(config,now);
            const head=stored(parseProbePlanHead,{id:randomUUID(),scopeId:scope,createdBy:actor,createdAt:now,config,configDigest:digest(config),originBinding:current.preflight.binding,
                revision:1,state:'active',decisionCount:0,acceptedCount:0,nextRunAt:config.mode==='scheduled'?now+config.intervalSeconds!*1000:0,updatedAt:now,
                cancelledBy:null,cancelledAt:null,lastCode:null,recoverySuspended:false});
            await this.store.create(tx,head,now);const result:ProbePlanReceipt={status:202,body:{planId:head.id,revision:1,state:'active',changed:true,decision:null}};
            await this.requests.respond(tx,request,result);return this.bounded(result);
        }));
    }
    private async creator(tx:Tx,head:ProbePlanHead) {
        try{await this.auth.scope(tx,head.createdBy,head.scopeId,true);}catch(error){
            if(error instanceof ControlError&&(error.status===403||error.status===404))throw new ControlError('AUTHORIZATION_DENIED',403,'Probe plan delegation is no longer authorized');throw error;
        }
    }
    private async decide(tx:Tx,head:ProbePlanHead,actor:string):Promise<{head:ProbePlanHead;decision:ProbePlanDecision}> {
        const before=this.now();if(before<head.updatedAt)throw new ControlError('CLOCK_UNCERTAIN',409,'Probe plan clock moved behind its state');
        if(before>=head.config.expiresAt)throw new ControlError('PROBE_PLAN_EXPIRED',409,'Probe plan has expired');
        const isolated=await this.store.isolate(tx,async()=>{
            await this.creator(tx,head);return this.issuer.issueIn(tx,actor,head.scopeId,head.config);
        }),now=this.now();
        if(now<before||now<head.updatedAt)throw new ControlError('CLOCK_UNCERTAIN',409,'Probe plan decision clock moved backwards');
        const decision=stored(v=>parseProbePlanDecision(v,head.config,head.scopeId),{position:head.decisionCount+1,actorId:actor,source:head.config.mode,decidedAt:now,
            outcome:isolated.accepted?{accepted:true,receipt:stored(v=>parseProbePlanReceipt(v,head.config,now,head.scopeId),isolated.value)}:{accepted:false,error:isolated.error}});
        const permanent=!decision.outcome.accepted&&!PROBE_PLAN_TRANSIENT.includes(decision.outcome.error.code as typeof PROBE_PLAN_TRANSIENT[number]);
        const count=head.decisionCount+1,state=count===head.config.maxRuns?'completed':permanent?'suspended':now>=head.config.expiresAt?'expired':'active';
        const value=stored(parseProbePlanHead,{...head,revision:next(head.revision),state,decisionCount:count,acceptedCount:head.acceptedCount+(decision.outcome.accepted?1:0),
            nextRunAt:state==='active'&&head.config.mode==='scheduled'?Math.min(now+head.config.intervalSeconds!*1000,head.config.expiresAt):0,updatedAt:now,
            lastCode:decision.outcome.accepted?'PERMIT_ACCEPTED':decision.outcome.error.code});
        await this.store.append(tx,head.scopeId,head.id,decision);await this.store.put(tx,value);return {head:value,decision};
    }
    async command(actor:string,scope:string,id:string,key:string|undefined,action:'run'|'cancel',input:unknown):Promise<ProbePlanReceipt> {
        identities(actor,scope,id);const body=probePlanObject(input,['expectedRevision']);if(!isCounter(body.expectedRevision))invalid('Probe plan CAS required');
        const expectedRevision=body.expectedRevision;
        const request=requestIdentity(actor,scope,key,'POST',`/api/v1/scopes/${scope}/probe-plans/${id}/${action}`,body);
        return this.admitted(actor,()=>this.db.transaction(async tx=>{
            await this.auth.scope(tx,actor,scope,true);const replay=await this.requests.claim<ProbePlanReceipt>(tx,request);if(replay)return this.bounded(receipt(replay,id,action,expectedRevision));
            await this.store.lockScope(tx,scope);const raw=await this.store.get(tx,scope,id,true);if(!raw)notFound();let head=this.checked(raw,scope,id);
            if(head.revision!==expectedRevision)throw new ControlError('REVISION_CONFLICT',409,'Probe plan revision conflict');
            const now=this.now();if(now<head.updatedAt)throw new ControlError('CLOCK_UNCERTAIN',409,'Probe plan clock moved behind its state');
            if(head.createdAt<Math.max(0,now-limits.retentionMs))notFound();
            let decision:ProbePlanDecision|null=null,changed=false;
            if(action==='cancel') {
                if(head.state==='active') {head=stored(parseProbePlanHead,{...head,revision:next(head.revision),state:'cancelled',nextRunAt:0,updatedAt:now,
                    cancelledBy:actor,cancelledAt:now,lastCode:'PLAN_CANCELLED'});await this.store.put(tx,head);changed=true;}
            } else {
                if(head.config.mode!=='manual'||head.state!=='active'||head.recoverySuspended)throw new ControlError('PROBE_PLAN_INACTIVE',409,'Only an active manual Probe plan can be stepped');
                const result=await this.decide(tx,head,actor);head=result.head;decision=result.decision;changed=true;
            }
            const result:ProbePlanReceipt={status:changed?202:200,body:{planId:id,revision:head.revision,state:head.state,changed,decision}};
            await this.requests.respond(tx,request,result);return this.bounded(result);
        }));
    }
    async get(actor:string,scope:string,id:string) {
        identities(actor,scope,id);return this.admitted(actor,()=>this.db.transaction(async tx=>{
            await this.auth.scope(tx,actor,scope,true);const raw=await this.store.get(tx,scope,id,'share');if(!raw)notFound();const head=this.checked(raw,scope,id),now=this.now();
            if(head.createdAt<Math.max(0,now-limits.retentionMs))notFound();const rawDecisions=await this.store.decisions(tx,scope,id);
            if(!Array.isArray(rawDecisions)||rawDecisions.length!==head.decisionCount)corrupt();
            const decisions=rawDecisions.map(v=>stored(x=>parseProbePlanDecision(x,head.config,head.scopeId),v)),probes=new Set<string>();
            if(decisions.some((v,i)=>v.position!==i+1||v.decidedAt<head.createdAt||v.decidedAt>head.updatedAt||i>0&&v.decidedAt<decisions[i-1]!.decidedAt||
                v.source==='scheduled'&&v.actorId!==head.createdBy)||decisions.filter(v=>v.outcome.accepted).length!==head.acceptedCount)corrupt();
            for(const value of decisions)if(value.outcome.accepted){const probe=value.outcome.receipt.body.probeId;if(probes.has(probe))corrupt();probes.add(probe);}
            return this.bounded({...this.envelope(scope,now),plan:publicProbePlan(head,now),decisions,losses:stored(parseProbePlanLosses,await this.store.losses(tx,scope))});
        }));
    }
    async history(actor:string,scope:string,input:Record<string,string>={}) {
        identities(actor,scope);if(Object.keys(input).some(k=>!['from','to','limit','cursor','forwardId','mode','state'].includes(k))||Object.values(input).some(v=>typeof v!=='string'))invalid('Closed Probe plan query required');
        const now=this.now(),from=input.from===undefined?Math.max(0,now-86400000):probePlanIso(input.from),to=input.to===undefined?now:probePlanIso(input.to);
        if(from<Math.max(0,now-limits.retentionMs)||to<=from||to-from>limits.retentionMs||to>now+this.skew||input.cursor!==undefined&&(input.from===undefined||input.to===undefined))invalid('Fixed retained Probe plan window required');
        const limit=input.limit===undefined?limits.defaultPageSize:Number(input.limit);if(!isCounter(limit)||limit>limits.maxPageSize||input.limit!==undefined&&String(limit)!==input.limit)invalid('Bounded Probe plan page required');
        const filters={forwardId:input.forwardId??null,mode:input.mode??null,state:input.state??null};
        if(filters.forwardId!==null&&!isId(filters.forwardId)||filters.mode!==null&&!['manual','scheduled'].includes(filters.mode)||filters.state!==null&&!PROBE_PLAN_STATES.includes(filters.state as ProbePlanHead['state']))invalid('Invalid Probe plan filter');
        const queryDigest=digest({scope,from,to,limit,filters});let before:ProbePlanQuery['before']=null;
        if(input.cursor!==undefined)try {
            if(!input.cursor||input.cursor.length>1024||!/^[A-Za-z0-9_-]+$(?![\s\S])/.test(input.cursor))invalid('Invalid Probe plan cursor');
            const value=probePlanObject(parseJson(nativeBase64UrlText(input.cursor),1024),['version','queryDigest','position']),position=probePlanObject(value.position,['createdAt','id']);
            if(value.version!==1||value.queryDigest!==queryDigest||!probePlanTime(position.createdAt)||position.createdAt<from||position.createdAt>=to||!isId(position.id))invalid('Invalid Probe plan cursor');
            before={createdAt:position.createdAt,id:position.id};if(encodeCursor(queryDigest,before)!==input.cursor)invalid('Invalid Probe plan cursor');
        }catch{invalid('Invalid Probe plan cursor');}
        const query:ProbePlanQuery={from,to,limit,before,...(filters.forwardId===null?{}:{forwardId:filters.forwardId}),
            ...(filters.mode===null?{}:{mode:filters.mode as ProbePlanConfig['mode']}),...(filters.state===null?{}:{state:filters.state as ProbePlanHead['state']})};
        return this.admitted(actor,()=>this.db.transaction(async tx=>{
            await this.auth.scope(tx,actor,scope,true);const raw=await this.store.history(tx,scope,query);if(!Array.isArray(raw)||raw.length>limit+1)corrupt();const values=raw.map(v=>this.checked(v,scope));
            if(new Set(values.map(v=>v.id)).size!==values.length||values.some((v,i)=>v.createdAt<from||v.createdAt>=to||filters.forwardId!==null&&v.config.forwardId!==filters.forwardId||
                filters.mode!==null&&v.config.mode!==filters.mode||filters.state!==null&&v.state!==filters.state||
                before!==null&&(v.createdAt>before.createdAt||v.createdAt===before.createdAt&&v.id>=before.id)||i>0&&(values[i-1]!.createdAt<v.createdAt||values[i-1]!.createdAt===v.createdAt&&values[i-1]!.id<=v.id)))corrupt();
            const items=values.slice(0,limit),hasMore=values.length>limit,last=items[items.length-1];
            return this.bounded({...this.envelope(scope,now),window:{from,to},filters,limit,items:items.map(v=>publicProbePlan(v,now)),hasMore,
                nextCursor:hasMore&&last?encodeCursor(queryDigest,{createdAt:last.createdAt,id:last.id}):null,losses:stored(parseProbePlanLosses,await this.store.losses(tx,scope))});
        }));
    }
    tick():Promise<void> {
        if(this.stopping||!this.scheduleEnabled||!this.executionEnabled)return Promise.resolve();if(this.running)return this.running;
        this.running=this.step().finally(()=>{this.running=null;});return this.running;
    }
    private async step():Promise<void> {
        const cutoff=this.now();let candidate:ProbePlanHeader|null=null;
        try {
            await this.db.transaction(async tx=>{
                candidate=await this.store.due(tx,cutoff);if(!candidate)return;
                const header=candidate,raw=await this.store.get(tx,header.scopeId,header.id);if(!raw)return;const initial=this.checked(raw,header.scopeId,header.id);
                let revoked=false;try{await this.creator(tx,initial);}catch(error){if(error instanceof ControlError&&error.code==='AUTHORIZATION_DENIED')revoked=true;else throw error;}
                await this.store.lockScope(tx,header.scopeId);const locked=await this.store.get(tx,header.scopeId,header.id,true);if(!locked)return;
                const head=this.checked(locked,header.scopeId,header.id),now=this.now();
                if(head.revision!==header.revision||head.state!=='active'||head.config.mode!=='scheduled'||head.nextRunAt>cutoff||head.recoverySuspended)return;
                if(now<head.updatedAt||now<cutoff)throw new ControlError('CLOCK_UNCERTAIN',409,'Probe schedule clock moved backwards');
                if(now>=head.config.expiresAt||revoked) {
                    await this.store.put(tx,stored(parseProbePlanHead,{...head,revision:next(head.revision),state:now>=head.config.expiresAt?'expired':'suspended',
                        nextRunAt:0,updatedAt:now,lastCode:now>=head.config.expiresAt?'PLAN_EXPIRED':'AUTHORIZATION_REVOKED'}));return;
                }
                await this.decide(tx,head,head.createdBy);
            });
        } catch(error) {
            // A conditional header deferral cannot replace a decision, extend expiry or retry an uncertain issuance.
            const header=candidate as ProbePlanHeader|null;if(header)try{await this.db.transaction(tx=>this.store.defer(tx,header,cutoff,cutoff+300000));}catch{}
            throw error;
        }
    }
    async close():Promise<void> {this.stopping=true;if(this.running)await this.running.catch(()=>undefined);}
}
