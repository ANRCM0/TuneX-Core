import { isCounter, isId } from '@tunex/core';
import { digest } from '@tunex/contracts/shared';
import { ControlError } from '../framework/public.ts';
import type { ObservationMetadataHead, ObservationMetadataRevision, ObservationMetadataAudit, ObservationMetadataValues, ObservationMetadataStorage } from '../framework/public.ts';
import { json, rows, write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

type Row=Record<string,unknown>;
const maximum=9007199254740991;
function corrupt():never {throw new ControlError('INTEGRITY_FAILURE',409,'Invalid bounded observation service storage');}
function integer(value:unknown,positive=false):number {
    const n=typeof value==='string'&&/^(0|[1-9][0-9]{0,15})$(?![\s\S])/.test(value)?Number(value):value;
    if(!isCounter(n,!positive))corrupt();return n;
}
function flag(value:unknown):boolean {if(value===1||value===true)return true;if(value===0||value===false)return false;return corrupt();}
function timestamp(value:unknown):number {const n=integer(value);if(n>253402300799999)corrupt();return n;}
function number(value:unknown):number {const n=integer(value,true);if(n>64)corrupt();return n;}
function config<Config,Kind extends string>(value:unknown,values:ObservationMetadataValues<Config,Kind>):Config {
    try{const body=json<unknown>(value);if(!body||typeof body!=='object'||Array.isArray(body)||Buffer.byteLength(JSON.stringify(body),'utf8')>16384)corrupt();return values.config(body);}catch{return corrupt();}
}
function head(row:Row):ObservationMetadataHead {
    if(!isId(row.service_id))corrupt();return{serviceId:row.service_id,revision:integer(row.revision,true),configRevision:number(row.config_revision),archived:flag(row.archived),recoverySuspended:flag(row.recovery_suspended)};
}
function audit<Config,Kind extends string>(row:Row,values:ObservationMetadataValues<Config,Kind>):ObservationMetadataAudit<Kind> {
    if(![row.id,row.service_id,row.actor_id].every(isId)||!values.auditKind(row.kind))corrupt();
    return{id:row.id as string,serviceId:row.service_id as string,revision:integer(row.revision,true),configRevision:number(row.config_revision),
        kind:row.kind as Kind,actorId:row.actor_id as string,createdAt:timestamp(row.created_at)};
}
const headFields='service_id,revision,config_revision,archived,recovery_suspended';

/** Supplied-transaction metadata only: no secrets, network, credentials or execution writes. */
export class MySqlObservationServiceStore<Config,Kind extends string> implements ObservationMetadataStorage<Transaction,Config,Kind> {
    private readonly values:ObservationMetadataValues<Config,Kind>;
    constructor(values:ObservationMetadataValues<Config,Kind>) {this.values=values;}
    async lockScope(tx:Transaction,scope:string):Promise<void> {
        if(!isId(scope))corrupt();
        await write(tx,'INSERT INTO observation_service_scopes(scope_id) VALUES(?) ON DUPLICATE KEY UPDATE scope_id=VALUES(scope_id)',[scope]);
        await rows(tx,'SELECT scope_id FROM observation_service_scopes WHERE scope_id=? FOR UPDATE',[scope]);
    }
    async count(tx:Transaction,scope:string):Promise<number> {
        const [row]=await rows<Row>(tx,'SELECT COUNT(*) n FROM observation_services WHERE scope_id=?',[scope]);return integer(row?.n);
    }
    async list(tx:Transaction,scope:string):Promise<ObservationMetadataHead[]> {
        return(await rows<Row>(tx,`SELECT ${headFields} FROM observation_services WHERE scope_id=? ORDER BY service_id LIMIT 33`,[scope])).map(head);
    }
    async head(tx:Transaction,scope:string,id:string,lock=false):Promise<ObservationMetadataHead|null> {
        const [row]=await rows<Row>(tx,`SELECT ${headFields} FROM observation_services WHERE scope_id=? AND service_id=?${lock?' FOR UPDATE':' FOR SHARE'}`,[scope,id]);return row?head(row):null;
    }
    async revision(tx:Transaction,scope:string,id:string,revision:number):Promise<ObservationMetadataRevision<Config>|null> {
        number(revision);const [row]=await rows<Row>(tx,'SELECT config_revision,IF(OCTET_LENGTH(config)<=16384,config,NULL) config,config_digest,created_by,created_at FROM observation_service_revisions WHERE scope_id=? AND service_id=? AND config_revision=?',[scope,id,revision]);
        if(!row)return null;const body=config(row.config,this.values);
        if(!isId(row.created_by)||typeof row.config_digest!=='string'||!/^sha256:[a-f0-9]{64}$(?![\s\S])/.test(row.config_digest)||digest(body)!==row.config_digest)corrupt();
        return{configRevision:number(row.config_revision),config:body,configDigest:row.config_digest,createdBy:row.created_by,createdAt:timestamp(row.created_at)};
    }
    async insertRevision(tx:Transaction,scope:string,id:string,value:ObservationMetadataRevision<Config>):Promise<void> {
        const body=config(value.config,this.values);if(![scope,id,value.createdBy].every(isId)||digest(body)!==value.configDigest)corrupt();
        await write(tx,'INSERT INTO observation_service_revisions(scope_id,service_id,config_revision,config,config_digest,created_by,created_at) VALUES(?,?,?,?,?,?,?)',
            [scope,id,number(value.configRevision),JSON.stringify(body),value.configDigest,value.createdBy,timestamp(value.createdAt)]);
    }
    async putHead(tx:Transaction,scope:string,value:ObservationMetadataHead):Promise<void> {
        return this.putHeadUsing(tx,scope,value,{head:(tx,scope,id)=>this.head(tx,scope,id),count:(tx,scope)=>this.count(tx,scope)});
    }
    /** Preserve old public head/count override calls on the original transaction. */
    async putHeadUsing(tx:Transaction,scope:string,value:ObservationMetadataHead,hooks:{head:(tx:Transaction,scope:string,id:string)=>Promise<ObservationMetadataHead|null>;count:(tx:Transaction,scope:string)=>Promise<number>}):Promise<void> {
        if(!isId(scope))corrupt();
        const next=head({service_id:value.serviceId,revision:value.revision,config_revision:value.configRevision,archived:value.archived,recovery_suspended:value.recoverySuspended});
        const old=await hooks.head(tx,scope,next.serviceId);
        if(!old){
            if(next.revision!==1||next.configRevision!==1||next.archived||next.recoverySuspended)corrupt();
            if(await hooks.count(tx,scope)>=32)throw new ControlError('RESOURCE_LIMIT',429,'Scope observation service quota reached');
            await write(tx,'INSERT INTO observation_services(scope_id,service_id,revision,config_revision,archived,recovery_suspended) VALUES(?,?,?,?,?,?)',
                [scope,next.serviceId,next.revision,next.configRevision,next.archived,next.recoverySuspended]);return;
        }
        if(next.revision!==old.revision+1||next.configRevision<old.configRevision||next.configRevision>old.configRevision+1||old.archived&&!next.archived)corrupt();
        if(await write(tx,'UPDATE observation_services SET revision=?,config_revision=?,archived=?,recovery_suspended=? WHERE scope_id=? AND service_id=? AND revision=?',
            [next.revision,next.configRevision,next.archived,next.recoverySuspended,scope,next.serviceId,old.revision])!==1)throw new ControlError('REVISION_CONFLICT',409,'Observation service changed');
    }
    async audit(tx:Transaction,scope:string,value:ObservationMetadataAudit<Kind>):Promise<void> {
        const entry=audit({id:value.id,service_id:value.serviceId,revision:value.revision,config_revision:value.configRevision,kind:value.kind,actor_id:value.actorId,created_at:value.createdAt},this.values);
        const [row]=await rows<Row>(tx,'SELECT COUNT(*) n FROM observation_service_events WHERE scope_id=?',[scope]);const n=integer(row?.n);if(n>256)corrupt();
        if(n===256){
            if(await write(tx,'DELETE FROM observation_service_events WHERE scope_id=? ORDER BY created_at,id LIMIT 1',[scope])!==1)corrupt();
            if(await write(tx,'UPDATE observation_service_scopes SET audit_evicted=audit_evicted+1 WHERE scope_id=? AND audit_evicted<?',[scope,maximum])!==1)corrupt();
        }
        await write(tx,'INSERT INTO observation_service_events(id,scope_id,service_id,revision,config_revision,kind,actor_id,created_at) VALUES(?,?,?,?,?,?,?,?)',
            [entry.id,scope,entry.serviceId,entry.revision,entry.configRevision,entry.kind,entry.actorId,entry.createdAt]);
    }
    async audits(tx:Transaction,scope:string,id:string):Promise<ObservationMetadataAudit<Kind>[]> {
        return(await rows<Row>(tx,'SELECT id,service_id,revision,config_revision,kind,actor_id,created_at FROM observation_service_events WHERE scope_id=? AND service_id=? ORDER BY created_at DESC,id DESC LIMIT 17',[scope,id])).map(row=>audit(row,this.values));
    }
    async auditLosses(tx:Transaction,scope:string):Promise<number> {
        const [row]=await rows<Row>(tx,'SELECT audit_evicted FROM observation_service_scopes WHERE scope_id=?',[scope]);return row?integer(row.audit_evicted):0;
    }
    static async quarantineRecovery(tx:Transaction):Promise<void> {
        await write(tx,'UPDATE observation_services SET recovery_suspended=TRUE,revision=revision+1 WHERE archived=FALSE AND recovery_suspended=FALSE');
    }
}
