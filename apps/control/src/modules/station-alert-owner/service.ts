import { deepFreeze, isCounter, isId } from '@tunex/core';
import { nativeValueDigest as digest, nativeParseJson as parseJson, nativeParseTime, nativeIsoTime, nativeMonotonicNow, nativeWallClockSource, jsonUtf8Bytes, nativeModuleId as randomUUID, nativeJsonBase64Url, nativeBase64UrlText } from '../../compatibility/public.ts';
import { ControlError, invalid, notFound } from '../../framework/public.ts';
import { nativeCommandRequest as requestIdentity } from '../../compatibility/public.ts';
import type { StationEventHandoff } from './handoff.ts';
import type { StationAlertsApi } from './api.ts';
import type { IdempotentRequests, ScopeAuthorization, ScopeOwnerAuthorization, TransactionBoundary } from '../../framework/public.ts';
import type { StationAlertCommandResponse, StationAlertEvent, StationAlertFacts, StationAlertLosses, StationAlertPolicy,
    StationAlertPolicyAudit, StationAlertRule, StationAlertStore, StationEventQuery } from './contracts.ts';
import { STATION_ALERT_LIMITS } from './policy.ts';
import { advanceStationAlert, emptyStationAlertState, evaluateStationAlert,
    parseStationAlertConfig, parseStationAlertEvent, parseStationAlertPolicy, parseStationAlertPolicyAudit } from './values.ts';

const flags = { source: 'persisted-station-alerts', readOnly: true, executionAuthorized: false, health: 'unknown',
    networkCheck: 'not-performed', consistency: 'read-committed-not-global-snapshot' } as const;
const time = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 253402300799999;
const plain = (value: unknown): value is Record<string,unknown> => !!value && typeof value === 'object' && !Array.isArray(value) &&
    [Object.prototype,null].includes(Object.getPrototypeOf(value));
const corrupt = (): never => { throw new ControlError('INTEGRITY_FAILURE',409,'Invalid bounded station alert state'); };
const increment = (value: number) => { if (!isCounter(value + 1)) throw new ControlError('REVISION_EXHAUSTED',409,'Station alert revision exhausted'); return value + 1; };
const order = (a: {occurredAt:number;id:string}, b: {occurredAt:number;id:string}) => a.occurredAt - b.occurredAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
function identities(actor: string, scope: string, id?: string) {
    if (!isId(actor) || !isId(scope) || id !== undefined && !isId(id)) invalid('Valid station alert identity required');
}
function stored<T>(parse: (value: unknown) => T, value: unknown): T {
    try { return parse(value); } catch { return corrupt(); }
}
function policy(value: unknown) { return stored(parseStationAlertPolicy,value); }
function event(value: unknown) { return stored(parseStationAlertEvent,value); }
function accepted(value: StationAlertCommandResponse, field: 'policyId' | 'eventId', id: string): StationAlertCommandResponse {
    if (!plain(value) || Object.keys(value).sort().join(',')!=='body,status' || !plain(value.body) ||
        Object.keys(value.body).sort().join(',')!==['changed',field,'revision'].sort().join(',') || value.body[field]!==id ||
        !isCounter(value.body.revision) || typeof value.body.changed!=='boolean' || value.status!==(value.body.changed?202:200)) corrupt();
    return {status:value.status,body:{[field]:id,revision:value.body.revision,changed:value.body.changed}};
}
function losses(value: StationAlertLosses): StationAlertLosses {
    if (!plain(value) || Object.keys(value).sort().join(',') !== 'auditEvicted,eventsEvicted,eventsExpired' ||
        !Object.values(value).every(item => isCounter(item,true))) corrupt();
    return { eventsEvicted: value.eventsEvicted, eventsExpired: value.eventsExpired, auditEvicted: value.auditEvicted };
}
function canonicalTime(value: string) {
    const parsed = nativeParseTime(value);
    if (!time(parsed) || nativeIsoTime(parsed) !== value) invalid('Canonical UTC station event bounds required');
    return parsed;
}
function cursor(queryDigest: string, value: { occurredAt: number; id: string }) {
    return nativeJsonBase64Url({ version: 1, queryDigest, position: { occurredAt: value.occurredAt, id: value.id } });
}
function position(input: string | undefined, queryDigest: string, from: number, to: number): StationEventQuery['before'] {
    if (input === undefined) return null;
    if (!input || input.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(input)) invalid('Invalid station event cursor');
    try {
        const value = parseJson(nativeBase64UrlText(input),1024);
        if (!plain(value) || Object.keys(value).sort().join(',') !== 'position,queryDigest,version' || value.version !== 1 ||
            value.queryDigest !== queryDigest || !plain(value.position) || Object.keys(value.position).sort().join(',') !== 'id,occurredAt')
            invalid('Station event cursor differs from the selected query');
        const p = value.position;
        if (!time(p.occurredAt) || p.occurredAt < from || p.occurredAt >= to || !isId(p.id)) invalid('Station event cursor is outside its fixed window');
        const result = { occurredAt: p.occurredAt, id: p.id };
        if (cursor(queryDigest,result) !== input) invalid('Canonical station event cursor required');
        return result;
    } catch { return invalid('Invalid station event cursor'); }
}

/** Owns derived station conditions only; no execution, lease, Probe or external notification authority. */
export class StationAlerts<Tx> implements StationAlertsApi {
    readonly enabled: boolean;
    private readonly db: TransactionBoundary<Tx>;
    private readonly auth: ScopeAuthorization<Tx> & ScopeOwnerAuthorization<Tx>;
    private readonly requests: IdempotentRequests<Tx>;
    private readonly store: StationAlertStore<Tx>;
    private readonly facts: StationAlertFacts<Tx>;
    private readonly clock: () => number;
    private readonly skewMs: number;
    private readonly handoff: StationEventHandoff<Tx> | undefined;
    private admittedRequests = 0;
    private active = 0;
    private ticking = false;
    private readonly actors = new Map<string,{active:boolean;until:number}>();
    constructor(db: TransactionBoundary<Tx>, auth: ScopeAuthorization<Tx> & ScopeOwnerAuthorization<Tx>, requests: IdempotentRequests<Tx>,
        store: StationAlertStore<Tx>, facts: StationAlertFacts<Tx>, enabled = false, clock: () => number = nativeWallClockSource(), clockSkewMs = 1000, handoff?: StationEventHandoff<Tx>) {
        if (!isCounter(clockSkewMs,true) || clockSkewMs > 300000) throw new Error('Bounded station alert clock skew required');
        this.db = db; this.auth = auth; this.requests = requests; this.store = store; this.facts = facts;
        this.enabled = enabled; this.clock = clock; this.skewMs = clockSkewMs; this.handoff=handoff;
    }
    private now() { const value = this.clock(); if (!time(value)) corrupt(); return value; }
    private envelope(scopeId: string) {
        return { stationAlertsVersion: 1, scopeId, capturedAt: this.now(), observerEnabled: this.enabled, ...flags, limits: STATION_ALERT_LIMITS };
    }
    private bounded<T>(result: T): T {
        if (jsonUtf8Bytes(result) > STATION_ALERT_LIMITS.responseBytes) corrupt();
        return deepFreeze(result);
    }
    async admitRequest<T>(action: () => Promise<T>): Promise<T> {
        if (this.admittedRequests >= STATION_ALERT_LIMITS.activeRequests) throw new ControlError('STATION_ALERT_BUSY',429,'Station alert request capacity unavailable',true);
        this.admittedRequests++;
        try { return await action(); } finally { this.admittedRequests--; }
    }
    private async admitted<T>(actor: string, action: () => Promise<T>): Promise<T> {
        const now = nativeMonotonicNow();
        for (const [key,value] of this.actors) if (!value.active && value.until <= now) this.actors.delete(key);
        if (this.active >= STATION_ALERT_LIMITS.activeRequests || this.actors.has(actor) || this.actors.size >= STATION_ALERT_LIMITS.actorKeys)
            throw new ControlError('STATION_ALERT_BUSY',429,'Station alert capacity or cooldown unavailable',true);
        this.active++; this.actors.set(actor,{active:true,until:Infinity});
        try { return await action(); }
        finally { this.active--; this.actors.set(actor,{active:false,until:nativeMonotonicNow()+STATION_ALERT_LIMITS.cooldownMs}); }
    }
    async listPolicies(actor: string, scope: string) {
        identities(actor,scope);
        return this.admitted(actor,()=>this.db.transaction(async tx=>{
            await this.auth.owner(tx,actor,scope);
            const found = await this.store.policies(tx,scope);
            if (!Array.isArray(found) || found.length > STATION_ALERT_LIMITS.policiesPerScope) corrupt();
            const values = found.map(policy);
            if (new Set(values.map(value=>value.policyId)).size !== values.length) corrupt();
            const items = values.map(value=>({ policyId:value.policyId,revision:value.revision,configRevision:value.configRevision,
                config:value.config,configDigest:value.configDigest,managedBy:value.managedBy,createdAt:value.createdAt,updatedAt:value.updatedAt,
                silencedUntil:value.silencedUntil,suspended:value.suspended,nextEvaluateAt:value.nextEvaluateAt,
                condition:value.state.condition,evaluatedAt:value.state.evaluatedAt,lastReason:value.state.last?.reason??null }));
            return this.bounded({...this.envelope(scope),items});
        }));
    }
    async getPolicy(actor: string, scope: string, id: string) {
        identities(actor,scope,id);
        return this.admitted(actor,()=>this.db.transaction(async tx=>{
            await this.auth.owner(tx,actor,scope);
            const found = await this.store.policy(tx,scope,id); if (!found) notFound();
            const value = policy(found); if (value.policyId !== id) corrupt();
            const audit = await this.store.audits(tx,scope,id);
            if (!Array.isArray(audit) || audit.length > STATION_ALERT_LIMITS.auditPage + 1) corrupt();
            const checked = audit.map(item=>stored(parseStationAlertPolicyAudit,item));
            if (checked.some(item=>item.policyId!==id) || new Set(checked.map(item=>item.id)).size !== checked.length) corrupt();
            return this.bounded({...this.envelope(scope),policy:value,audit:{items:checked.slice(0,STATION_ALERT_LIMITS.auditPage),truncated:checked.length>STATION_ALERT_LIMITS.auditPage}});
        }));
    }
    async publish(actor: string, scope: string, id: string, key: string | undefined, expectedRevision: number, input: unknown): Promise<StationAlertCommandResponse> {
        identities(actor,scope,id);
        if (!isCounter(expectedRevision,true)) invalid('Valid station policy CAS required');
        const config = parseStationAlertConfig(input), request = requestIdentity(actor,scope,key,'PUT',`/api/v1/scopes/${scope}/alert-policies/${id}`,{expectedRevision,config});
        return this.admitted(actor,()=>this.db.transaction(async tx=>{
            await this.auth.owner(tx,actor,scope);
            const replay = await this.requests.claim<StationAlertCommandResponse>(tx,request); if (replay) return this.bounded(accepted(replay,'policyId',id));
            await this.store.lockScope(tx,scope);
            const found = await this.store.policy(tx,scope,id,true), old = found ? policy(found) : null;
            if ((old?.revision??0)!==expectedRevision) throw new ControlError('REVISION_CONFLICT',409,'Station policy revision conflict');
            if (old && old.policyId !== id) corrupt();
            if (!old) {
                const count = await this.store.policyCount(tx,scope);
                if (!isCounter(count,true) || count > STATION_ALERT_LIMITS.policiesPerScope) corrupt();
                if (count === STATION_ALERT_LIMITS.policiesPerScope) throw new ControlError('RESOURCE_LIMIT',429,'Station policy limit includes disabled identifiers');
            }
            const disablingKnownTarget = !config.enabled && old?.config.target.kind===config.target.kind && old.config.target.id===config.target.id;
            if (!disablingKnownTarget) {
                const fact = await this.facts.read(tx,scope,config,actor);
                if (!fact) notFound();
                if (fact.id!==config.target.id || fact.kind!==config.target.kind) corrupt();
            }
            const configDigest = digest(config), changed = !old || old.configDigest!==configDigest || old.managedBy!==actor || old.suspended!=='none';
            const now = this.now(), revision = changed ? increment(expectedRevision) : expectedRevision;
            if (old && now<old.updatedAt) throw new ControlError('CLOCK_UNCERTAIN',409,'Station policy clock moved behind its recorded update');
            if (changed) {
                const value: StationAlertPolicy = { policyId:id,revision,configRevision:increment(old?.configRevision??0),config,configDigest,
                    managedBy:actor,createdAt:old?.createdAt??now,updatedAt:now,silencedUntil:old?.silencedUntil??null,
                    suspended:'none',nextEvaluateAt:now,state:emptyStationAlertState() };
                await this.store.putPolicy(tx,scope,policy(value));
                await this.audit(tx,scope,value,'publish',actor,now,null);
            }
            const response: StationAlertCommandResponse = { status:changed?202:200,body:{policyId:id,revision,changed} };
            await this.requests.respond(tx,request,response); return this.bounded(response);
        }));
    }
    private async audit(tx: Tx, scope: string, value: Pick<StationAlertPolicy,'policyId'|'revision'|'configRevision'|'configDigest'>,
        kind: StationAlertPolicyAudit['kind'], actorId: string, createdAt: number, eventId: string | null) {
        await this.store.audit(tx,scope,{id:randomUUID(),policyId:value.policyId,revision:value.revision,configRevision:value.configRevision,
            configDigest:value.configDigest,kind,actorId,createdAt,eventId});
    }
    async silence(actor: string, scope: string, id: string, key: string | undefined, expectedRevision: number, until: number | null): Promise<StationAlertCommandResponse> {
        identities(actor,scope,id);
        if (!isCounter(expectedRevision) || until!==null && !time(until)) invalid('Valid silence CAS and UTC deadline required');
        const request = requestIdentity(actor,scope,key,'POST',`/api/v1/scopes/${scope}/alert-policies/${id}/silence`,{expectedRevision,until});
        return this.admitted(actor,()=>this.db.transaction(async tx=>{
            await this.auth.owner(tx,actor,scope);
            const replay = await this.requests.claim<StationAlertCommandResponse>(tx,request); if (replay) return this.bounded(accepted(replay,'policyId',id));
            const now = this.now();
            // Check a new deadline after replay: an already accepted identical request remains replayable.
            if (until!==null && (until<=now || until-now>STATION_ALERT_LIMITS.silenceMaxMs)) invalid('Silence must be future and at most seven days');
            await this.store.lockScope(tx,scope);
            const found = await this.store.policy(tx,scope,id,true); if (!found) notFound();
            const old = policy(found); if (old.policyId!==id) corrupt();
            if (old.revision!==expectedRevision) throw new ControlError('REVISION_CONFLICT',409,'Station policy revision conflict');
            if (now<old.updatedAt) throw new ControlError('CLOCK_UNCERTAIN',409,'Station policy clock moved behind its recorded update');
            const changed = old.silencedUntil!==until, value = { ...old,revision:changed?increment(old.revision):old.revision,
                updatedAt:changed?now:old.updatedAt,silencedUntil:until };
            if (changed) { await this.store.putPolicy(tx,scope,policy(value)); await this.audit(tx,scope,value,'silence',actor,now,null); }
            const response: StationAlertCommandResponse = {status:changed?202:200,body:{policyId:id,revision:value.revision,changed}};
            await this.requests.respond(tx,request,response); return this.bounded(response);
        }));
    }
    async acknowledge(actor: string, scope: string, id: string, key: string | undefined, expectedRevision: number): Promise<StationAlertCommandResponse> {
        identities(actor,scope,id);
        if (!isCounter(expectedRevision)) invalid('Valid event CAS required');
        const request = requestIdentity(actor,scope,key,'POST',`/api/v1/scopes/${scope}/station-events/${id}/acknowledge`,{expectedRevision});
        return this.admitted(actor,()=>this.db.transaction(async tx=>{
            await this.auth.owner(tx,actor,scope);
            const replay = await this.requests.claim<StationAlertCommandResponse>(tx,request); if (replay) return this.bounded(accepted(replay,'eventId',id));
            await this.store.lockScope(tx,scope);
            const found = await this.store.event(tx,scope,id,true); if (!found) notFound();
            const old = event(found); if (old.id!==id) corrupt();
            if (old.revision!==expectedRevision) throw new ControlError('REVISION_CONFLICT',409,'Station event revision conflict');
            const changed = old.acknowledgedAt===null, revision = changed?increment(old.revision):old.revision, now = this.now();
            if (now<old.occurredAt) throw new ControlError('CLOCK_UNCERTAIN',409,'Station acknowledgement clock moved behind its event');
            if (changed) {
                await this.store.acknowledge(tx,scope,id,expectedRevision,now);
                await this.audit(tx,scope,{policyId:old.policyId,revision,configRevision:old.configRevision,configDigest:old.configDigest},'acknowledge',actor,now,id);
            }
            const response: StationAlertCommandResponse = {status:changed?202:200,body:{eventId:id,revision,changed}};
            await this.requests.respond(tx,request,response); return this.bounded(response);
        }));
    }
    async getEvent(actor: string, scope: string, id: string) {
        identities(actor,scope,id);
        return this.admitted(actor,()=>this.db.transaction(async tx=>{
            await this.auth.owner(tx,actor,scope);
            const found = await this.store.event(tx,scope,id); if (!found) notFound();
            const value = event(found); if (value.id!==id) corrupt();
            return this.bounded({...this.envelope(scope),event:value});
        }));
    }
    async history(actor: string, scope: string, input: Record<string,string|undefined>) {
        identities(actor,scope);
        const keys = ['from','to','limit','cursor','policyId','targetId','rule','kind','acknowledged'];
        if (!plain(input) || Object.keys(input).some(key=>!keys.includes(key)) || Object.values(input).some(value=>value!==undefined&&typeof value!=='string'))
            invalid('Closed station event query required');
        const now = this.now();
        if (input.cursor!==undefined && (input.from===undefined || input.to===undefined)) invalid('Event cursor requires its frozen explicit window');
        const to = input.to===undefined?now:canonicalTime(input.to), from = input.from===undefined?Math.max(0,to-86400000):canonicalTime(input.from);
        const limit = input.limit===undefined?25:/^[1-9][0-9]?$/.test(input.limit)&&!/\s/.test(input.limit)?Number(input.limit):NaN;
        if (from>=to || from<Math.max(0,now-STATION_ALERT_LIMITS.eventRetentionMs) || to-from>STATION_ALERT_LIMITS.eventRetentionMs ||
            to>now+this.skewMs || !Number.isSafeInteger(limit) || limit<1 || limit>STATION_ALERT_LIMITS.eventPage) invalid('Bounded current station event window required');
        const filters: Pick<StationEventQuery,'policyId'|'targetId'|'rule'|'kind'|'acknowledged'> = {};
        for (const key of ['policyId','targetId'] as const) if (input[key]!==undefined) {
            const value = input[key]; if (!isId(value)) invalid('Exact station event identity filter required'); filters[key]=value;
        }
        if (input.rule!==undefined) {
            if (!['forward-operation-failed','node-report-stale','node-credential-expiring','shared-usage-high','shared-period-ending','recent-path-probe-degraded'].includes(input.rule)) invalid('Known station alert rule required');
            filters.rule=input.rule as StationAlertRule;
        }
        if (input.kind!==undefined) {
            if (!['firing','recovered','invalidated'].includes(input.kind)) invalid('Known station event kind required');
            filters.kind=input.kind as StationAlertEvent['kind'];
        }
        if (input.acknowledged!==undefined) {
            if (!['true','false'].includes(input.acknowledged)) invalid('Canonical acknowledgement filter required');
            filters.acknowledged=input.acknowledged==='true';
        }
        const frozen = deepFreeze(filters), queryDigest = digest({scope,from,to,limit,filters:frozen});
        const query = deepFreeze({from,to,limit,before:position(input.cursor,queryDigest,from,to),...frozen});
        return this.admitted(actor,()=>this.db.transaction(async tx=>{
            await this.auth.owner(tx,actor,scope);
            const rows = await this.store.events(tx,scope,query);
            if (!Array.isArray(rows) || rows.length>limit+1) corrupt();
            const values = rows.map(event); let previous = query.before;
            for (const value of values) {
                if (value.occurredAt<from || value.occurredAt>=to || previous&&order(value,previous)>=0 ||
                    frozen.policyId!==undefined&&value.policyId!==frozen.policyId || frozen.targetId!==undefined&&value.config.target.id!==frozen.targetId ||
                    frozen.rule!==undefined&&value.config.rule!==frozen.rule || frozen.kind!==undefined&&value.kind!==frozen.kind ||
                    frozen.acknowledged!==undefined&&(value.acknowledgedAt!==null)!==frozen.acknowledged) corrupt();
                previous={occurredAt:value.occurredAt,id:value.id};
            }
            const items=values.slice(0,limit), hasMore=values.length>limit;
            return this.bounded({...this.envelope(scope),window:{from,to},filters:frozen,limit,items,hasMore,
                nextCursor:hasMore?cursor(queryDigest,items[items.length-1]!):null,losses:losses(await this.store.losses(tx,scope))});
        }));
    }
    async tick(): Promise<void> {
        if (!this.enabled || this.ticking) return;
        this.ticking=true;
        let attempted: {scopeId:string;policyId:string;revision:number;cutoff:number} | null = null;
        try {
            await this.db.transaction(async tx=>{
                const now=this.now(), due=await this.store.due(tx,now); if (!due) return;
                if (!isId(due.scopeId)||!isId(due.policyId)||!isCounter(due.revision)) corrupt();
                attempted={scopeId:due.scopeId,policyId:due.policyId,revision:due.revision,cutoff:now};
                const found=await this.store.policy(tx,due.scopeId,due.policyId); if (!found) return;
                if (isCounter(found.revision)) attempted={...due,revision:found.revision,cutoff:now};
                const candidate=policy(found); if (candidate.policyId!==due.policyId) corrupt();
                let authorized=true;
                try { await this.auth.owner(tx,candidate.managedBy,due.scopeId); }
                catch (error) { if (error instanceof ControlError&&[403,404].includes(error.status)) authorized=false; else throw error; }
                // Management and worker paths share Scope-then-policy lock order; due selection itself is unlocked.
                await this.store.lockScope(tx,due.scopeId);
                const latest=await this.store.policy(tx,due.scopeId,due.policyId,true); if (!latest) return;
                const value=policy(latest);
                if (value.revision!==candidate.revision||value.managedBy!==candidate.managedBy||!value.config.enabled||value.suspended!=='none'||value.nextEvaluateAt>now) return;
                if (!authorized) {
                    await this.store.putPolicy(tx,due.scopeId,{...value,suspended:'actor-not-authorized',nextEvaluateAt:now+STATION_ALERT_LIMITS.evaluationIntervalMs});
                    return;
                }
                const fact=await this.facts.read(tx,due.scopeId,value.config,value.managedBy);
                const evaluation=evaluateStationAlert(value.config,fact,value.state,now,this.skewMs);
                const advanced=advanceStationAlert(value.state,evaluation,now);
                if (advanced.event) {
                    const item: StationAlertEvent={id:randomUUID(),policyId:value.policyId,policyRevision:value.revision,configRevision:value.configRevision,
                        config:value.config,configDigest:value.configDigest,...advanced.event,occurredAt:now,
                        silenced:value.silencedUntil!==null&&value.silencedUntil>now,silencedUntil:value.silencedUntil,
                        revision:1,acknowledgedAt:null,recoverySuspended:false};
                    const persisted=event(item);
                    await this.store.appendEvent(tx,due.scopeId,persisted,now);
                    await this.handoff?.enqueueIn(tx,due.scopeId,value,persisted,now);
                }
                await this.store.putPolicy(tx,due.scopeId,policy({...value,state:advanced.state,nextEvaluateAt:now+STATION_ALERT_LIMITS.evaluationIntervalMs}));
            });
        } catch (error) {
            const failed = attempted as {scopeId:string;policyId:string;revision:number;cutoff:number} | null;
            if (failed) {
                try {
                    await this.db.transaction(async tx=>{
                        await this.store.lockScope(tx,failed.scopeId);
                        await this.store.defer(tx,failed.scopeId,failed.policyId,failed.revision,failed.cutoff,this.now()+300000);
                    });
                } catch { /* Storage failure leaves original state unchanged; the host applies global backoff. */ }
            }
            throw error;
        } finally { this.ticking=false; }
    }
}
