import type { ReadPrincipal } from '../framework/public.ts';
import { isId } from '@tunex/core';
import { ControlError, invalid } from '../framework/public.ts';
import type { ProbePlanStoredHead, ProbePlanStoredDecision, ProbePlanStoredFailure, ProbePlanStoredHeader, ProbePlanStoredLosses,
    ProbePlanStoredQuery, ProbePlanStorageValues, ProbePlanStorage } from '../framework/public.ts';
import { json, rows, write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

type Row=Record<string,unknown>;
const maximum=9007199254740991;
const fields='scope_id,plan_id,created_by,created_at,config,config_digest,origin_binding,forward_id,mode,expires_at,revision,state,decision_count,accepted_count,next_run_at,updated_at,cancelled_by,cancelled_at,last_code,recovery_suspended';
const projection=fields.replace(',config,',',IF(OCTET_LENGTH(config)<=2048,config,NULL) config,').replace(',origin_binding,',',IF(OCTET_LENGTH(origin_binding)<=2048,origin_binding,NULL) origin_binding,');
function corrupt():never {throw new ControlError('INTEGRITY_FAILURE',409,'Invalid bounded Probe plan storage');}
function integer(value:unknown):number {
    const n=typeof value==='string'&&/^(0|[1-9][0-9]{0,15})$(?![\s\S])/.test(value)?Number(value):value;
    if(typeof n!=='number'||!Number.isSafeInteger(n)||n<0)corrupt();return n;
}
function flag(value:unknown):boolean {if(value===1||value===true)return true;if(value===0||value===false)return false;return corrupt();}
function parsed<Head extends ProbePlanStoredHead,Decision,Failure>(input:unknown,values:ProbePlanStorageValues<Head,Decision,Failure>):Head {try{return values.head(input);}catch{return corrupt();}}
function decision<Head extends ProbePlanStoredHead,Decision,Failure>(input:unknown,values:ProbePlanStorageValues<Head,Decision,Failure>):Decision {try{return values.decision(input);}catch{return corrupt();}}
function boundedJson(value:unknown):unknown {try{const body=json(value);if(Buffer.byteLength(JSON.stringify(body),'utf8')>2048)corrupt();return body;}catch{return corrupt();}}
function head<Head extends ProbePlanStoredHead,Decision,Failure>(row:Row,values:ProbePlanStorageValues<Head,Decision,Failure>):Head {
    const value=parsed({id:row.plan_id,scopeId:row.scope_id,createdBy:row.created_by,createdAt:integer(row.created_at),config:boundedJson(row.config),
        configDigest:row.config_digest,originBinding:boundedJson(row.origin_binding),revision:integer(row.revision),state:row.state,
        decisionCount:integer(row.decision_count),acceptedCount:integer(row.accepted_count),nextRunAt:integer(row.next_run_at),updatedAt:integer(row.updated_at),
        cancelledBy:row.cancelled_by,cancelledAt:row.cancelled_at===null?null:integer(row.cancelled_at),lastCode:row.last_code,recoverySuspended:flag(row.recovery_suspended)},values);
    if(value.config.forwardId!==row.forward_id||value.config.mode!==row.mode||value.config.expiresAt!==integer(row.expires_at))corrupt();return value;
}

/** Own bounded intent/history only; original permit and idempotency owners remain authoritative. */
export class MySqlProbePlanStore<Head extends ProbePlanStoredHead,Decision extends ProbePlanStoredDecision,Failure extends ProbePlanStoredFailure> implements ProbePlanStorage<Transaction,Head,Decision,Failure> {
    private readonly values:ProbePlanStorageValues<Head,Decision,Failure>;
    constructor(values:ProbePlanStorageValues<Head,Decision,Failure>) {this.values=values;}
    async lockScope(tx:Transaction,scope:string):Promise<void> {
        if(!isId(scope))corrupt();
        await write(tx,'INSERT INTO probe_plan_scopes(scope_id) VALUES(?) ON DUPLICATE KEY UPDATE scope_id=VALUES(scope_id)',[scope]);
        await rows(tx,'SELECT scope_id FROM probe_plan_scopes WHERE scope_id=? FOR UPDATE',[scope]);
    }
    async losses(tx:Transaction,scope:string):Promise<ProbePlanStoredLosses> {
        const [r]=await rows<Row>(tx,'SELECT rows_expired,rows_evicted,decisions_evicted FROM probe_plan_scopes WHERE scope_id=?',[scope]);
        return r?{rowsExpired:integer(r.rows_expired),rowsEvicted:integer(r.rows_evicted),decisionsEvicted:integer(r.decisions_evicted)}:{rowsExpired:0,rowsEvicted:0,decisionsEvicted:0};
    }
    private async loss(tx:Transaction,scope:string,column:'rows_expired'|'rows_evicted'|'decisions_evicted',count:number):Promise<void> {
        integer(count);if(!count)return;
        if(await write(tx,`UPDATE probe_plan_scopes SET ${column}=${column}+? WHERE scope_id=? AND ${column}<=?`,[count,scope,maximum-count])!==1)corrupt();
    }
    private async remove(tx:Transaction,scope:string,id:string,kind:'rows_expired'|'rows_evicted'):Promise<void> {
        const [r]=await rows<Row>(tx,'SELECT COUNT(*) n FROM probe_plan_decisions WHERE scope_id=? AND plan_id=?',[scope,id]);
        const count=integer(r?.n);if(count>16)corrupt();
        if(await write(tx,"DELETE FROM probe_plans WHERE scope_id=? AND plan_id=? AND state<>'active'",[scope,id])!==1)corrupt();
        await this.loss(tx,scope,kind,1);await this.loss(tx,scope,'decisions_evicted',count);
    }
    async create(tx:Transaction,input:Head,now:number):Promise<void> {
        return this.createUsing(tx,input,now,{lockScope:(tx,scope)=>this.lockScope(tx,scope),put:(tx,head)=>this.put(tx,head)});
    }
    /** Only the original public lock/put override points, never a nested transaction. */
    async createUsing(tx:Transaction,input:Head,now:number,hooks:{lockScope:(tx:Transaction,scope:string)=>Promise<void>;put:(tx:Transaction,head:Head)=>Promise<void>}):Promise<void> {
        const value=parsed(input,this.values);integer(now);
        await hooks.lockScope(tx,value.scopeId);
        const existing=await rows<Row>(tx,`SELECT ${projection} FROM probe_plans WHERE scope_id=? ORDER BY created_at,plan_id LIMIT 33 FOR UPDATE`,[value.scopeId]);
        if(existing.length>32)corrupt();
        for(const row of existing){const old=head(row,this.values),transition=this.values.expired(old,now);if(transition)
            await hooks.put(tx,transition);}
        const expired=await rows<Row>(tx,"SELECT plan_id FROM probe_plans WHERE scope_id=? AND state<>'active' AND created_at<? ORDER BY created_at,plan_id LIMIT 16",[value.scopeId,Math.max(0,now-604800000)]);
        for(const row of expired)await this.remove(tx,value.scopeId,row.plan_id as string,'rows_expired');
        const [count]=await rows<Row>(tx,'SELECT COUNT(*) n FROM probe_plans WHERE scope_id=?',[value.scopeId]);const n=integer(count?.n);if(n>32)corrupt();
        if(n===32){const [old]=await rows<Row>(tx,"SELECT plan_id FROM probe_plans WHERE scope_id=? AND state<>'active' ORDER BY created_at,plan_id LIMIT 1",[value.scopeId]);
            if(!old)throw new ControlError('RESOURCE_LIMIT',429,'Scope bounded Probe plan capacity exhausted');
            await this.remove(tx,value.scopeId,old.plan_id as string,'rows_evicted');}
        await write(tx,`INSERT INTO probe_plans(${fields}) VALUES(${Array.from({length:20},()=>'?').join(',')})`,
            [value.scopeId,value.id,value.createdBy,value.createdAt,JSON.stringify(value.config),value.configDigest,JSON.stringify(value.originBinding),value.config.forwardId,value.config.mode,value.config.expiresAt,
                value.revision,value.state,value.decisionCount,value.acceptedCount,value.nextRunAt,value.updatedAt,value.cancelledBy,value.cancelledAt,value.lastCode,value.recoverySuspended]);
    }
    async get(tx:Transaction,scope:string,id:string,lock:boolean|'share'=false):Promise<Head|null> {
        const [row]=await rows<Row>(tx,`SELECT ${projection} FROM probe_plans WHERE scope_id=? AND plan_id=?${lock==='share'?' FOR SHARE':lock?' FOR UPDATE':''}`,[scope,id]);return row?head(row,this.values):null;
    }
    async put(tx:Transaction,input:Head):Promise<void> {
        return this.putUsingCurrent(tx,input,(tx,scope,id)=>this.get(tx,scope,id));
    }
    async putUsingCurrent(tx:Transaction,input:Head,get:(tx:Transaction,scope:string,id:string)=>Promise<Head|null>):Promise<void> {
        const value=parsed(input,this.values),old=await get(tx,value.scopeId,value.id);
        if(!old||this.values.immutable(old)!==this.values.immutable(value)||value.revision!==old.revision+1||value.updatedAt<old.updatedAt)corrupt();
        if(await write(tx,'UPDATE probe_plans SET revision=?,state=?,decision_count=?,accepted_count=?,next_run_at=?,updated_at=?,cancelled_by=?,cancelled_at=?,last_code=?,recovery_suspended=? WHERE scope_id=? AND plan_id=? AND revision=?',
            [value.revision,value.state,value.decisionCount,value.acceptedCount,value.nextRunAt,value.updatedAt,value.cancelledBy,value.cancelledAt,value.lastCode,value.recoverySuspended,value.scopeId,value.id,old.revision])!==1)
            throw new ControlError('REVISION_CONFLICT',409,'Probe plan changed');
    }
    async append(tx:Transaction,scope:string,id:string,input:Decision):Promise<void> {
        return this.appendUsingCurrent(tx,scope,id,input,(tx,scope,id)=>this.get(tx,scope,id));
    }
    async appendUsingCurrent(tx:Transaction,scope:string,id:string,input:Decision,get:(tx:Transaction,scope:string,id:string)=>Promise<Head|null>):Promise<void> {
        const owner=await get(tx,scope,id);if(!owner)corrupt();
        let value:Decision;try{value=this.values.decision(input,owner.config);}catch{return corrupt();}
        await write(tx,'INSERT INTO probe_plan_decisions(scope_id,plan_id,position,actor_id,source,decided_at,outcome) VALUES(?,?,?,?,?,?,?)',
            [scope,id,value.position,value.actorId,value.source,value.decidedAt,JSON.stringify(value.outcome)]);
    }
    async decisions(tx:Transaction,scope:string,id:string):Promise<Decision[]> {
        return (await rows<Row>(tx,'SELECT position,actor_id,source,decided_at,IF(OCTET_LENGTH(outcome)<=2048,outcome,NULL) outcome FROM probe_plan_decisions WHERE scope_id=? AND plan_id=? ORDER BY position LIMIT 17',[scope,id]))
            .map(r=>decision({position:integer(r.position),actorId:r.actor_id,source:r.source,decidedAt:integer(r.decided_at),outcome:boundedJson(r.outcome)},this.values));
    }
    async history(tx:Transaction,scope:string,principal:ReadPrincipal,query:ProbePlanStoredQuery<Head['state'],Head['config']['mode']>):Promise<Head[]> {
        if(!Number.isSafeInteger(query.limit)||query.limit<1||query.limit>50)invalid('Bounded Probe plan history page required');
        const filters=['scope_id=?','created_at>=?','created_at<?'],args:unknown[]=[scope,query.from,query.to];
        if (!principal.governance) { filters.push('created_by=?'); args.push(principal.actorId); }
        for(const [key,column]of [['forwardId','forward_id'],['mode','mode'],['state','state']]as const)if(query[key]!==undefined){filters.push(`CAST(${column} AS BINARY)=CAST(? AS BINARY)`);args.push(query[key]);}
        if(query.before){filters.push('(created_at<? OR (created_at=? AND CAST(plan_id AS BINARY)<CAST(? AS BINARY)))');args.push(query.before.createdAt,query.before.createdAt,query.before.id);}
        return(await rows<Row>(tx,`SELECT ${projection} FROM probe_plans WHERE ${filters.join(' AND ')} ORDER BY created_at DESC,CAST(plan_id AS BINARY) DESC LIMIT ${query.limit+1}`,args)).map(row=>head(row,this.values));
    }
    async due(tx:Transaction,now:number):Promise<ProbePlanStoredHeader|null> {
        integer(now);const [row]=await rows<Row>(tx,"SELECT scope_id,plan_id,revision FROM probe_plans WHERE state='active' AND mode='scheduled' AND recovery_suspended=FALSE AND next_run_at<=? ORDER BY next_run_at,scope_id,plan_id LIMIT 1",[now]);
        if(!row)return null;if(!isId(row.scope_id)||!isId(row.plan_id))corrupt();return{scopeId:row.scope_id,id:row.plan_id,revision:integer(row.revision)};
    }
    async defer(tx:Transaction,header:ProbePlanStoredHeader,cutoff:number,retryAt:number):Promise<void> {
        integer(cutoff);integer(retryAt);if(retryAt<=cutoff||retryAt-cutoff>300000)corrupt();
        await write(tx,"UPDATE probe_plans SET next_run_at=? WHERE scope_id=? AND plan_id=? AND revision=? AND state='active' AND mode='scheduled' AND recovery_suspended=FALSE AND next_run_at<=?",[retryAt,header.scopeId,header.id,header.revision,cutoff]);
    }
    async isolate<T>(tx:Transaction,action:()=>Promise<T>):Promise<{accepted:true;value:T}|{accepted:false;error:Failure}> {
        await tx.query('SAVEPOINT probe_plan_issue');let value:T;
        try{value=await action();}catch(error){
            const failure=this.values.failure(error);if(!failure)throw error;
            await tx.query('ROLLBACK TO SAVEPOINT probe_plan_issue');await tx.query('RELEASE SAVEPOINT probe_plan_issue');
            return{accepted:false,error:failure};
        }
        await tx.query('RELEASE SAVEPOINT probe_plan_issue');return{accepted:true,value};
    }
    static async quarantineRecovery(tx:Transaction):Promise<void> {
        await write(tx,"UPDATE probe_plans SET last_code=IF(state='active','RECOVERY_SUSPENDED',last_code),state=IF(state='active','suspended',state),next_run_at=0,recovery_suspended=TRUE,revision=revision+1 WHERE recovery_suspended=FALSE");
    }
}
