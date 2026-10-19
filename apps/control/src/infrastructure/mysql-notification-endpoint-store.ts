import { ControlError } from '../framework/public.ts';
import { isCounter, isId } from '@tunex/core';
import type { NotificationEndpointRecord, NotificationEndpointAuditRecord, NotificationEndpointValues, NotificationEndpointStorage } from '../framework/public.ts';
import { json, rows, write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

type Row=Record<string,unknown>;
const fail:()=>never=()=>{throw new ControlError('INTEGRITY_FAILURE',409,'Invalid notification endpoint storage');};
function integer(value: unknown): number {
    const n=typeof value==='string'&&/^(0|[1-9][0-9]{0,15})$/.test(value)?Number(value):value;
    if (!isCounter(n,true)) fail(); return n;
}
function decode<T>(parse:(value:unknown)=>T,value:unknown):T { try{return parse(value);}catch{return fail();} }
function config(value:unknown): unknown {
    try { const parsed=json<unknown>(value); if (Buffer.byteLength(JSON.stringify(parsed),'utf8')>4096) fail();return parsed; } catch {return fail();}
}
const fields='endpoint_id,revision,credential_revision,config,config_digest,managed_by,created_at,updated_at,suspended,authority_digest,credential_ref';
function endpoint<Endpoint,Audit>(row:Row,values:NotificationEndpointValues<Endpoint,Audit>):Endpoint {
    return decode(values.endpoint,{endpointId:row.endpoint_id,revision:integer(row.revision),credentialRevision:integer(row.credential_revision),
        config:config(row.config),configDigest:row.config_digest,managedBy:row.managed_by,createdAt:integer(row.created_at),updatedAt:integer(row.updated_at),
        suspended:row.suspended,authorityDigest:row.authority_digest,credentialRef:row.credential_ref});
}
function audit<Endpoint,Audit>(row:Row,values:NotificationEndpointValues<Endpoint,Audit>):Audit {
    return decode(values.audit,{id:row.id,endpointId:row.endpoint_id,revision:integer(row.revision),kind:row.kind,actorId:row.actor_id,createdAt:integer(row.created_at)});
}
/** Supplied-transaction writes are restricted to the three notification endpoint tables. */
export class MySqlNotificationEndpointStore<Endpoint extends NotificationEndpointRecord,Audit extends NotificationEndpointAuditRecord> implements NotificationEndpointStorage<Transaction,Endpoint,Audit> {
    private readonly values:NotificationEndpointValues<Endpoint,Audit>;
    constructor(values:NotificationEndpointValues<Endpoint,Audit>) {this.values=values;}
    async lockScope(tx:Transaction,scope:string):Promise<void> {
        if (!isId(scope)) fail();
        await write(tx,'INSERT INTO notification_endpoint_scopes(scope_id) VALUES(?) ON DUPLICATE KEY UPDATE scope_id=VALUES(scope_id)',[scope]);
        await rows(tx,'SELECT scope_id FROM notification_endpoint_scopes WHERE scope_id=? FOR UPDATE',[scope]);
    }
    async count(tx:Transaction,scope:string):Promise<number> {
        const [r]=await rows<Row>(tx,'SELECT COUNT(*) n FROM notification_endpoints WHERE scope_id=?',[scope]);return integer(r?.n);
    }
    async list(tx:Transaction,scope:string):Promise<Endpoint[]> {
        const found=await rows<Row>(tx,`SELECT ${fields} FROM notification_endpoints WHERE scope_id=? ORDER BY endpoint_id LIMIT 17`,[scope]);
        if (found.length>16) fail();return found.map(row=>endpoint(row,this.values));
    }
    async get(tx:Transaction,scope:string,id:string,lock=false):Promise<Endpoint|null> {
        const [r]=await rows<Row>(tx,`SELECT ${fields} FROM notification_endpoints WHERE scope_id=? AND endpoint_id=?${lock?' FOR UPDATE':''}`,[scope,id]);
        return r?endpoint(r,this.values):null;
    }
    async put(tx:Transaction,scope:string,value:Endpoint):Promise<void> {
        return this.putUsingCount(tx,scope,value,(tx,scope)=>this.count(tx,scope));
    }
    /** Precise compatibility hook for the old public count method, not another transaction. */
    async putUsingCount(tx:Transaction,scope:string,value:Endpoint,count:(tx:Transaction,scope:string)=>Promise<number>):Promise<void> {
        const v=decode(this.values.endpoint,value);
        const [existing]=await rows<Row>(tx,'SELECT endpoint_id FROM notification_endpoints WHERE scope_id=? AND endpoint_id=?',[scope,v.endpointId]);
        if (!existing&&await count(tx,scope)>=16) throw new ControlError('RESOURCE_LIMIT',429,'Notification endpoint quota reached');
        await write(tx,`INSERT INTO notification_endpoints(scope_id,endpoint_id,revision,credential_revision,config,config_digest,enabled,managed_by,created_at,updated_at,suspended,authority_digest,credential_ref)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE revision=VALUES(revision),credential_revision=VALUES(credential_revision),config=VALUES(config),config_digest=VALUES(config_digest),
            enabled=VALUES(enabled),managed_by=VALUES(managed_by),updated_at=VALUES(updated_at),suspended=VALUES(suspended),authority_digest=VALUES(authority_digest),credential_ref=VALUES(credential_ref)`,
            [scope,v.endpointId,v.revision,v.credentialRevision,JSON.stringify(v.config),v.configDigest,v.config.enabled,v.managedBy,v.createdAt,v.updatedAt,v.suspended,v.authorityDigest,v.credentialRef]);
    }
    async audit(tx:Transaction,scope:string,value:Audit):Promise<void> {
        const v=decode(this.values.audit,value), [r]=await rows<Row>(tx,'SELECT COUNT(*) n FROM notification_endpoint_events WHERE scope_id=?',[scope]);
        const count=integer(r?.n);if (count>128) fail();
        if (count===128) {
            if (await write(tx,'DELETE FROM notification_endpoint_events WHERE scope_id=? ORDER BY created_at,id LIMIT 1',[scope])!==1) fail();
            if (await write(tx,'UPDATE notification_endpoint_scopes SET audit_evicted=audit_evicted+1 WHERE scope_id=? AND audit_evicted<9007199254740991',[scope])!==1) fail();
        }
        await write(tx,'INSERT INTO notification_endpoint_events(id,scope_id,endpoint_id,revision,kind,actor_id,created_at) VALUES(?,?,?,?,?,?,?)',
            [v.id,scope,v.endpointId,v.revision,v.kind,v.actorId,v.createdAt]);
    }
    async audits(tx:Transaction,scope:string,id:string):Promise<Audit[]> {
        return (await rows<Row>(tx,'SELECT id,endpoint_id,revision,kind,actor_id,created_at FROM notification_endpoint_events WHERE scope_id=? AND endpoint_id=? ORDER BY created_at DESC,id DESC LIMIT 17',[scope,id])).map(row=>audit(row,this.values));
    }
    async auditLosses(tx:Transaction,scope:string):Promise<number> {
        const [r]=await rows<Row>(tx,'SELECT audit_evicted FROM notification_endpoint_scopes WHERE scope_id=?',[scope]);return r?integer(r.audit_evicted):0;
    }
}
