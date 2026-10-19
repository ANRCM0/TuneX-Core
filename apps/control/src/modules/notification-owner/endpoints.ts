import { deepFreeze, isCounter, isId } from '@tunex/core';
import { nativeValueDigest as digest, nativeMonotonicNow, nativeWallClockSource, jsonUtf8Bytes, nativeModuleId as randomUUID } from '../../compatibility/public.ts';
import { ControlError, invalid, notFound } from '../../framework/public.ts';
import { nativeCommandRequest as requestIdentity } from '../../compatibility/public.ts';
import type { IdempotentRequests, ScopeAuthorization, TransactionBoundary } from '../../framework/public.ts';
import type { NotificationEndpoint, NotificationEndpointReceipt, NotificationEndpointStore, NotificationSecrets } from './endpoint-contracts.ts';
import type { StationAlertStore } from '../station-alert-owner/public.ts';
import type { NotificationEndpointsApi } from './api.ts';
import { parseStationAlertPolicy } from '../station-alert-owner/public.ts';
import { NOTIFICATION_ENDPOINT_LIMITS } from './policy.ts';
import { notificationHash, notificationObject, notificationTime, parseNotificationDestination,
    parseNotificationEndpoint, parseNotificationEndpointAudit, parseNotificationEndpointConfig, publicNotificationEndpoint } from './endpoint-values.ts';

const corrupt: () => never = () => { throw new ControlError('INTEGRITY_FAILURE',409,'Invalid protected notification metadata'); };
function stored<T>(parse: (value: unknown)=>T, value: unknown): T { try { return parse(value); } catch { return corrupt(); } }
function identities(actor: string, scope: string, id?: string) {
    if (!isId(actor)||!isId(scope)||id!==undefined&&!isId(id)) invalid('Valid notification identities required');
}
function next(value: number) { if (!isCounter(value+1)) throw new ControlError('REVISION_EXHAUSTED',409,'Notification revision exhausted'); return value+1; }
function receipt(value: NotificationEndpointReceipt, id: string): NotificationEndpointReceipt {
    try {
        const v=notificationObject(value,['status','body']), body=notificationObject(v.body,['endpointId','revision','changed']);
        if (body.endpointId!==id || !isCounter(body.revision) || typeof body.changed!=='boolean' || v.status!==(body.changed?202:200)) corrupt();
        return {status:body.changed?202:200,body:{endpointId:id,revision:body.revision,changed:body.changed}};
    } catch { return corrupt(); }
}

/** Stores notification intent only. No GET or endpoint command may send or test a destination. */
export class NotificationEndpoints<Tx> implements NotificationEndpointsApi {
    private active=0;
    private admittedRequests=0;
    private readonly actors=new Map<string,{active:boolean;until:number}>();
    private readonly db: TransactionBoundary<Tx>;
    private readonly auth: ScopeAuthorization<Tx>;
    private readonly requests: IdempotentRequests<Tx>;
    private readonly store: NotificationEndpointStore<Tx>;
    private readonly policies: Pick<StationAlertStore<Tx>,'policy'>;
    private readonly secrets: NotificationSecrets | undefined;
    private readonly authorityBinding: ()=>Promise<string>;
    private readonly clock: ()=>number;
    private readonly deliveryEnabled: boolean;
    constructor(db: TransactionBoundary<Tx>, auth: ScopeAuthorization<Tx>, requests: IdempotentRequests<Tx>, store: NotificationEndpointStore<Tx>,
        policies: Pick<StationAlertStore<Tx>,'policy'>, secrets: NotificationSecrets | undefined, authorityBinding: ()=>Promise<string>, clock: ()=>number=nativeWallClockSource(), deliveryEnabled=false) {
        this.db=db;this.auth=auth;this.requests=requests;this.store=store;this.policies=policies;this.secrets=secrets;
        this.authorityBinding=authorityBinding;this.clock=clock;this.deliveryEnabled=deliveryEnabled;
    }
    private now() { const now=this.clock(); if (!notificationTime(now)) corrupt(); return now; }
    private envelope(scopeId: string) {
        return {notificationEndpointsVersion:1,scopeId,capturedAt:this.now(),secretsConfigured:!!this.secrets,deliveryAvailable:this.deliveryEnabled,
            source:'persisted-notification-endpoints',readOnly:true,executionAuthorized:false,health:'unknown',networkCheck:'not-performed',
            consistency:'read-committed-not-global-snapshot',limits:NOTIFICATION_ENDPOINT_LIMITS};
    }
    private bounded<T>(result: T): T {
        if (jsonUtf8Bytes(result)>NOTIFICATION_ENDPOINT_LIMITS.responseBytes) corrupt();
        return deepFreeze(result);
    }
    async admitRequest<T>(action: ()=>Promise<T>): Promise<T> {
        if (this.admittedRequests>=2) throw new ControlError('NOTIFICATION_BUSY',429,'Notification request capacity unavailable',true);
        this.admittedRequests++;
        try { return await action(); } finally { this.admittedRequests--; }
    }
    private async admitted<T>(actor: string, action: ()=>Promise<T>): Promise<T> {
        const now=nativeMonotonicNow();
        for (const [key,value] of this.actors) if (!value.active&&value.until<=now) this.actors.delete(key);
        if (this.active>=2||this.actors.has(actor)||this.actors.size>=128) throw new ControlError('NOTIFICATION_BUSY',429,'Notification capacity or cooldown unavailable',true);
        this.active++;this.actors.set(actor,{active:true,until:Infinity});
        try { return await action(); }
        finally { this.active--;this.actors.set(actor,{active:false,until:nativeMonotonicNow()+1000}); }
    }
    async list(actor: string, scope: string) {
        identities(actor,scope);
        return this.admitted(actor,()=>this.db.transaction(async tx=>{
            await this.auth.scope(tx,actor,scope,true);
            const raw=await this.store.list(tx,scope);
            if (!Array.isArray(raw)||raw.length>16) corrupt();
            const items=raw.map(item=>stored(parseNotificationEndpoint,item));
            if (new Set(items.map(item=>item.endpointId)).size!==items.length) corrupt();
            return this.bounded({...this.envelope(scope),items:items.map(publicNotificationEndpoint),auditEvicted:await this.losses(tx,scope)});
        }));
    }
    private async losses(tx: Tx, scope: string) {
        const count=await this.store.auditLosses(tx,scope); if (!isCounter(count,true)) corrupt(); return count;
    }
    async get(actor: string, scope: string, id: string) {
        identities(actor,scope,id);
        return this.admitted(actor,()=>this.db.transaction(async tx=>{
            await this.auth.scope(tx,actor,scope,true);
            const raw=await this.store.get(tx,scope,id); if (!raw) notFound();
            const value=stored(parseNotificationEndpoint,raw); if (value.endpointId!==id) corrupt();
            const rawAudit=await this.store.audits(tx,scope,id);
            if (!Array.isArray(rawAudit)||rawAudit.length>17) corrupt();
            const audit=rawAudit.map(item=>stored(parseNotificationEndpointAudit,item));
            if (audit.some(item=>item.endpointId!==id)||new Set(audit.map(item=>item.id)).size!==audit.length) corrupt();
            return this.bounded({...this.envelope(scope),endpoint:publicNotificationEndpoint(value),
                audit:{items:audit.slice(0,16),truncated:audit.length>16},auditEvicted:await this.losses(tx,scope)});
        }));
    }
    async publish(actor: string, scope: string, id: string, key: string | undefined, expectedRevision: number, input: unknown, destinationInput: unknown): Promise<NotificationEndpointReceipt> {
        identities(actor,scope,id);
        if (!isCounter(expectedRevision,true)) invalid('Valid notification endpoint CAS required');
        const config=parseNotificationEndpointConfig(input), destination=parseNotificationDestination(destinationInput);
        const request=requestIdentity(actor,scope,key,'PUT',`/api/v1/scopes/${scope}/notification-endpoints/${id}`,{expectedRevision,config,destination});
        return this.admitted(actor,()=>this.db.transaction(async tx=>{
            await this.auth.scope(tx,actor,scope,true);
            const replay=await this.requests.claim<NotificationEndpointReceipt>(tx,request); if (replay) return this.bounded(receipt(replay,id));
            if (!this.secrets) throw new ControlError('NOTIFICATION_SECRETS_UNAVAILABLE',503,'Protected notification store is not configured');
            await this.store.lockScope(tx,scope);
            const raw=await this.store.get(tx,scope,id,true), old=raw?stored(parseNotificationEndpoint,raw):null;
            if ((old?.revision??0)!==expectedRevision) throw new ControlError('REVISION_CONFLICT',409,'Notification endpoint revision conflict');
            if (old&&old.endpointId!==id) corrupt();
            if (!old) {
                const count=await this.store.count(tx,scope); if (!isCounter(count,true)||count>16) corrupt();
                if (count===16) throw new ControlError('RESOURCE_LIMIT',429,'Notification endpoint quota includes disabled identities');
            }
            for (const policyId of config.policyIds) {
                const found=await this.policies.policy(tx,scope,policyId); if (!found) notFound();
                if (stored(parseStationAlertPolicy,found).policyId!==policyId) corrupt();
            }
            const now=this.now(); if (old&&now<old.updatedAt) throw new ControlError('CLOCK_UNCERTAIN',409,'Notification clock moved behind its update');
            const authorityDigest=await this.authorityBinding(); if (!notificationHash(authorityDigest)) corrupt();
            const revision=next(expectedRevision), credentialRevision=next(old?.credentialRevision??0);
            // A durable immutable vault file precedes SQL publication; rollback leaves a bounded, unreferenced orphan.
            const credentialRef=await this.secrets.stage({scopeId:scope,endpointId:id,credentialRevision,authorityDigest},request.digest,destination,old?.credentialRef??null);
            const value: NotificationEndpoint=stored(parseNotificationEndpoint,{endpointId:id,revision,credentialRevision,config,configDigest:digest(config),
                managedBy:actor,createdAt:old?.createdAt??now,updatedAt:now,suspended:'none',authorityDigest,credentialRef});
            await this.store.put(tx,scope,value);
            await this.store.audit(tx,scope,{id:randomUUID(),endpointId:id,revision,kind:'publish',actorId:actor,createdAt:now});
            const result: NotificationEndpointReceipt={status:202,body:{endpointId:id,revision,changed:true}};
            await this.requests.respond(tx,request,result); return this.bounded(result);
        }));
    }
    async disable(actor: string, scope: string, id: string, key: string | undefined, expectedRevision: number): Promise<NotificationEndpointReceipt> {
        identities(actor,scope,id); if (!isCounter(expectedRevision)) invalid('Valid notification disable CAS required');
        const request=requestIdentity(actor,scope,key,'POST',`/api/v1/scopes/${scope}/notification-endpoints/${id}/disable`,{expectedRevision});
        return this.admitted(actor,()=>this.db.transaction(async tx=>{
            await this.auth.scope(tx,actor,scope,true);
            const replay=await this.requests.claim<NotificationEndpointReceipt>(tx,request); if (replay) return this.bounded(receipt(replay,id));
            await this.store.lockScope(tx,scope);
            const raw=await this.store.get(tx,scope,id,true); if (!raw) notFound();
            const old=stored(parseNotificationEndpoint,raw); if (old.endpointId!==id) corrupt();
            if (old.revision!==expectedRevision) throw new ControlError('REVISION_CONFLICT',409,'Notification endpoint revision conflict');
            const changed=old.config.enabled, revision=changed?next(expectedRevision):expectedRevision, now=this.now();
            if (now<old.updatedAt) throw new ControlError('CLOCK_UNCERTAIN',409,'Notification clock moved behind its update');
            if (changed) {
                const config={...old.config,enabled:false};
                await this.store.put(tx,scope,stored(parseNotificationEndpoint,{...old,revision,config,configDigest:digest(config),updatedAt:now}));
                await this.store.audit(tx,scope,{id:randomUUID(),endpointId:id,revision,kind:'disable',actorId:actor,createdAt:now});
            }
            const result: NotificationEndpointReceipt={status:changed?202:200,body:{endpointId:id,revision,changed}};
            await this.requests.respond(tx,request,result); return this.bounded(result);
        }));
    }
}
