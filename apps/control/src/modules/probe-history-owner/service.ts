import { deepFreeze, isCounter, isId } from '@tunex/core';
import { nativeValueDigest as digest, nativeParseJson as parseJson, nativeParseTime, nativeIsoTime, nativeMonotonicNow, nativeWallClockSource, jsonUtf8Bytes, nativeJsonBase64Url, nativeBase64UrlText } from '../../compatibility/public.ts';
import { ControlError, invalid, notFound } from '../../framework/public.ts';
import type { ScopeAuthorization, TransactionBoundary } from '../../framework/public.ts';
import type { ProbeRunCapture, ProbeRunQuery, ProbeRunRecord, ProbeRunRecorder, ProbeRunStore } from './contracts.ts';
import type { ProbeRunsApi } from './api.ts';
import { PROBE_RUN_LIMITS as limits } from './policy.ts';
import { parseProbeRunLosses, parseProbeRunPermit, parseProbeRunRecord, parseProbeRunResult, probeRunImmutable, probeRunObject,
    probeRunTime, PROBE_RUN_STATES, publicProbeRun } from './values.ts';

const corrupt:()=>never=()=>{throw new ControlError('INTEGRITY_FAILURE',409,'Invalid bounded Probe run history');};
function stored<T>(parse:(input:unknown)=>T,input:unknown):T {try{return parse(input);}catch{return corrupt();}}
function advance(value:number):number {if(!isCounter(value+1))throw new ControlError('REVISION_EXHAUSTED',409,'Probe history revision exhausted');return value+1;}

/** Captures the original owner's decisions, never creates, consumes or extends an execution permit. */
export class ProbeRunHistoryRecorder<Tx> implements ProbeRunRecorder<Tx> {
    private readonly store:ProbeRunStore<Tx>;
    constructor(store:ProbeRunStore<Tx>) {this.store=store;}
    async recordIn(tx:Tx,input:ProbeRunCapture):Promise<void> {
        const capture=probeRunObject(input,['kind','permit','at','result']),permit=stored(parseProbeRunPermit,capture.permit),at=capture.at;
        if(!['issued','consumed','revoked','withdrawn','result'].includes(capture.kind as string)||!probeRunTime(at)||at<permit.issuedAt||
            permit.closedAt!==null&&at<permit.closedAt)corrupt();
        const result=capture.kind==='result'?stored(v=>parseProbeRunResult(v,permit),capture.result):null;
        if(capture.kind!=='result'&&capture.result!==null ||
            capture.kind==='issued'&&(permit.state!=='issued'||at!==permit.issuedAt) ||
            capture.kind==='consumed'&&(permit.state!=='consumed'||permit.closedAt!==at) ||
            capture.kind==='revoked'&&(permit.state!=='revoked'||permit.closedAt!==at) ||
            ['withdrawn','result'].includes(capture.kind as string)&&permit.state!=='consumed' ||
            result!==null&&result.acceptedAt!==at)corrupt();
        await this.store.lockScope(tx,permit.scopeId);
        const raw=await this.store.get(tx,permit.scopeId,permit.probeId,true);
        if(!raw) {
            if(capture.kind!=='issued') {await this.store.missingUpdate(tx,permit.scopeId);return;}
            await this.store.insert(tx,stored(parseProbeRunRecord,{...permit,revision:1,updatedAt:at,withdrawnAt:null,result:null,recoverySuspended:false}),at);
            return;
        }
        const previous=stored(parseProbeRunRecord,raw);
        if(probeRunImmutable(previous)!==probeRunImmutable(permit))corrupt();
        if(capture.kind==='issued')return;
        if(previous.recoverySuspended||at<previous.updatedAt)corrupt();
        let value:ProbeRunRecord;
        if(capture.kind==='consumed'||capture.kind==='revoked') {
            if(previous.state!=='issued'||previous.closedAt!==null||previous.withdrawnAt!==null||previous.result!==null)corrupt();
            value={...previous,state:permit.state,closedAt:permit.closedAt};
        } else {
            if(previous.state!=='consumed'||previous.closedAt!==permit.closedAt)corrupt();
            if(capture.kind==='withdrawn') {
                if(previous.withdrawnAt!==null) {if(previous.withdrawnAt!==at)corrupt();return;}
                value={...previous,withdrawnAt:at};
            } else {
                if(previous.withdrawnAt!==null||result===null)corrupt();
                if(previous.result!==null) {if(digest(previous.result)!==digest(result))corrupt();return;}
                value={...previous,result};
            }
        }
        await this.store.put(tx,stored(parseProbeRunRecord,{...value,revision:advance(previous.revision),updatedAt:at}));
    }
}

function identities(actor:string,scope:string,id?:string) {
    if(!isId(actor)||!isId(scope)||id!==undefined&&!isId(id))invalid('Valid Probe history identity required');
}
function canonicalTime(input:string):number {
    const value=nativeParseTime(input);if(!probeRunTime(value)||nativeIsoTime(value)!==input)invalid('Canonical UTC Probe history bounds required');return value;
}
function cursor(queryDigest:string,position:{issuedAt:number;probeId:string}):string {
    return nativeJsonBase64Url({version:1,queryDigest,position},true);
}

/** Manager history reads use the observation pool, without consulting current permits or Runtime. */
export class ProbeRuns<Tx> implements ProbeRunsApi {
    private readonly db:TransactionBoundary<Tx>;
    private readonly auth:ScopeAuthorization<Tx>;
    private readonly store:ProbeRunStore<Tx>;
    private readonly clock:()=>number;
    private readonly clockSkewMs:number;
    private active=0;
    private requests=0;
    private readonly actors=new Map<string,{active:boolean;until:number}>();
    constructor(db:TransactionBoundary<Tx>,auth:ScopeAuthorization<Tx>,store:ProbeRunStore<Tx>,clock:()=>number=nativeWallClockSource(),clockSkewMs=1000) {
        if(!isCounter(clockSkewMs,true)||clockSkewMs>300000)throw new Error('Bounded Probe history clock skew required');
        this.db=db;this.auth=auth;this.store=store;this.clock=clock;this.clockSkewMs=clockSkewMs;
    }
    private now():number {const now=this.clock();if(!probeRunTime(now))corrupt();return now;}
    private checked(raw:unknown,scope:string):ProbeRunRecord {
        const value=stored(parseProbeRunRecord,raw);if(value.scopeId!==scope)corrupt();return value;
    }
    private bounded<T>(value:T):T {
        if(jsonUtf8Bytes(value)>limits.maxResponseBytes)corrupt();return deepFreeze(value);
    }
    private envelope(scopeId:string,capturedAt:number) {
        return {probeRunsVersion:1,scopeId,capturedAt,source:'persisted-probe-run-history',coverage:'new-accepted-probes-since-history-enabled',
            historyComplete:false,readOnly:true,executionAuthorized:false,health:'unknown',networkCheck:'not-performed-by-read',
            consistency:'read-committed-not-global-snapshot',limits};
    }
    async admitReadRequest<T>(action:()=>Promise<T>):Promise<T> {
        if(this.requests>=2)throw new ControlError('PROBE_HISTORY_BUSY',429,'Probe history read capacity unavailable',true);
        this.requests++;try{return await action();}finally{this.requests--;}
    }
    private async admitted<T>(actor:string,action:()=>Promise<T>):Promise<T> {
        const now=nativeMonotonicNow();for(const [id,value]of this.actors)if(!value.active&&value.until<=now)this.actors.delete(id);
        if(this.active>=2||this.actors.has(actor)||this.actors.size>=128)throw new ControlError('PROBE_HISTORY_BUSY',429,'Probe history read capacity or cooldown unavailable',true);
        this.active++;this.actors.set(actor,{active:true,until:Infinity});
        try{return await action();}finally{this.active--;this.actors.set(actor,{active:false,until:nativeMonotonicNow()+1000});}
    }
    async get(actor:string,scope:string,id:string) {
        identities(actor,scope,id);
        return this.admitted(actor,()=>this.db.transaction(async tx=>{
            await this.auth.scope(tx,actor,scope,true);
            const now=this.now(),raw=await this.store.get(tx,scope,id);if(!raw)notFound();const value=this.checked(raw,scope);
            if(value.issuedAt<Math.max(0,now-limits.retentionMs))notFound();
            return this.bounded({...this.envelope(scope,now),run:publicProbeRun(value,now),losses:stored(parseProbeRunLosses,await this.store.losses(tx,scope))});
        }));
    }
    async history(actor:string,scope:string,input:Record<string,string>={}) {
        identities(actor,scope);
        if(Object.keys(input).some(k=>!['from','to','limit','cursor','forwardId','nodeId','probeId','state','resultStatus'].includes(k))||
            Object.values(input).some(v=>typeof v!=='string'))invalid('Closed Probe history query required');
        const now=this.now(),from=input.from===undefined?Math.max(0,now-86400000):canonicalTime(input.from),to=input.to===undefined?now:canonicalTime(input.to);
        if(!probeRunTime(from)||!probeRunTime(to)||from<Math.max(0,now-limits.retentionMs)||to<=from||to-from>limits.retentionMs||to>now+this.clockSkewMs||
            input.cursor!==undefined&&(input.from===undefined||input.to===undefined))invalid('Probe history query outside its fixed retained window');
        const limit=input.limit===undefined?limits.defaultPageSize:Number(input.limit);
        if(!isCounter(limit)||limit>limits.maxPageSize||input.limit!==undefined&&String(limit)!==input.limit)invalid('Bounded Probe history page required');
        const filters={forwardId:input.forwardId??null,nodeId:input.nodeId??null,probeId:input.probeId??null,state:input.state??null,resultStatus:input.resultStatus??null};
        if([filters.forwardId,filters.nodeId,filters.probeId].some(v=>v!==null&&!isId(v))||
            filters.state!==null&&!PROBE_RUN_STATES.includes(filters.state as ProbeRunRecord['state'])||
            filters.resultStatus!==null&&!['connected','unreachable','verified','unverified','echoed','missing'].includes(filters.resultStatus))invalid('Invalid Probe history filter');
        const queryDigest=digest({scope,from,to,limit,filters});let before:ProbeRunQuery['before']=null;
        if(input.cursor!==undefined) {
            try {
                if(!input.cursor||input.cursor.length>1024||!/^[A-Za-z0-9_-]+$(?![\s\S])/.test(input.cursor))invalid('Invalid Probe history cursor');
                const value=probeRunObject(parseJson(nativeBase64UrlText(input.cursor),1024),['version','queryDigest','position']);
                const position=probeRunObject(value.position,['issuedAt','probeId']);
                if(value.version!==1||value.queryDigest!==queryDigest||!probeRunTime(position.issuedAt)||position.issuedAt<from||position.issuedAt>=to||!isId(position.probeId))invalid('Invalid Probe history cursor');
                before={issuedAt:position.issuedAt,probeId:position.probeId};if(cursor(queryDigest,before)!==input.cursor)invalid('Invalid Probe history cursor');
            } catch {invalid('Invalid Probe history cursor');}
        }
        const query:ProbeRunQuery={from,to,limit,before,...(filters.forwardId===null?{}:{forwardId:filters.forwardId}),
            ...(filters.nodeId===null?{}:{nodeId:filters.nodeId}),...(filters.probeId===null?{}:{probeId:filters.probeId}),
            ...(filters.state===null?{}:{state:filters.state as ProbeRunRecord['state']}),
            ...(filters.resultStatus===null?{}:{resultStatus:filters.resultStatus as NonNullable<ProbeRunQuery['resultStatus']>})};
        return this.admitted(actor,()=>this.db.transaction(async tx=>{
            await this.auth.scope(tx,actor,scope,true);
            const raw=await this.store.history(tx,scope,query);if(!Array.isArray(raw)||raw.length>limit+1)corrupt();const values=raw.map(v=>this.checked(v,scope));
            if(new Set(values.map(v=>v.probeId)).size!==values.length||values.some((v,i)=>v.issuedAt<from||v.issuedAt>=to||
                filters.forwardId!==null&&v.binding.forwardId!==filters.forwardId||filters.nodeId!==null&&v.binding.nodeId!==filters.nodeId||
                filters.probeId!==null&&v.probeId!==filters.probeId||filters.state!==null&&v.state!==filters.state||
                filters.resultStatus!==null&&(filters.resultStatus==='missing'?v.result!==null:v.result?.status!==filters.resultStatus)||
                before!==null&&(v.issuedAt>before.issuedAt||v.issuedAt===before.issuedAt&&v.probeId>=before.probeId)||
                i>0&&(values[i-1]!.issuedAt<v.issuedAt||values[i-1]!.issuedAt===v.issuedAt&&values[i-1]!.probeId<=v.probeId)))corrupt();
            const items=values.slice(0,limit),hasMore=values.length>limit;
            return this.bounded({...this.envelope(scope,now),window:{from,to},filters,limit,items:items.map(v=>publicProbeRun(v,now)),hasMore,
                nextCursor:hasMore?cursor(queryDigest,{issuedAt:items[items.length-1]!.issuedAt,probeId:items[items.length-1]!.probeId}):null,
                losses:stored(parseProbeRunLosses,await this.store.losses(tx,scope))});
        }));
    }
}
