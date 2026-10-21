import { deepFreeze, isCounter, isId } from '@tunex/core';
import { nativeValueDigest as digest, nativeParseJson as parseJson, nativeParseTime, nativeIsoTime, nativeMonotonicNow, nativeWallClockSource, jsonUtf8Bytes, nativeJsonBase64Url, nativeBase64UrlText, nativeHexBytes } from '../../compatibility/public.ts';
import { ControlError, invalid, notFound } from '../../framework/public.ts';
import type { ScopeAuthorization, ScopeOwnerAuthorization, TransactionBoundary } from '../../framework/public.ts';
import type { NotificationEndpoint, NotificationEndpointStore, NotificationSecretLease, NotificationSecrets, NotificationSender } from './endpoint-contracts.ts';
import type { NotificationDelivery, NotificationDeliveryAttempt, NotificationDeliveryCode, NotificationDeliveryHeader, NotificationDeliveryQuery,
    NotificationDeliveryStore, StationEventHandoff } from './delivery-contracts.ts';
import type { StationAlertPolicy, StationAlertStore } from '../station-alert-owner/public.ts';
import type { NotificationDeliveriesApi } from './api.ts';
import { parseStationAlertEvent, parseStationAlertPolicy } from '../station-alert-owner/public.ts';
import { notificationHash, notificationObject as object, notificationTime as time, parseNotificationDestination, parseNotificationEndpoint } from './endpoint-values.ts';
import { NOTIFICATION_DELIVERY_LIMITS as limits } from './policy.ts';
import { NOTIFICATION_DELIVERY_STATUSES, notificationAttemptId, notificationDeliveryId, notificationPayload,
    notificationWireBody, parseNotificationDelivery, parseNotificationDeliveryAttempt, parseNotificationDeliveryLosses, publicNotificationDelivery } from './delivery-values.ts';

interface Options<Tx> {
    db: TransactionBoundary<Tx>; auth: ScopeAuthorization<Tx> & ScopeOwnerAuthorization<Tx>; store: NotificationDeliveryStore<Tx>; endpoints: NotificationEndpointStore<Tx>;
    policies: Pick<StationAlertStore<Tx>,'policy'|'lockScope'>; secrets: NotificationSecrets | undefined; sender: NotificationSender;
    authorityBinding: ()=>Promise<string>; enabled: boolean; clock?: ()=>number; clockSkewMs?: number;
}
interface RecordedResult { outcome: 'delivered'|'rejected'|'unknown'; code: NotificationDeliveryCode; statusCode: number|null }
interface Locked { row: NotificationDelivery; endpoint: NotificationEndpoint|null; policy: StationAlertPolicy|null; authorized: boolean }
const corrupt=():never=>{throw new ControlError('INTEGRITY_FAILURE',409,'Invalid bounded notification state');};
function stored<T>(parse:(input:unknown)=>T,input:unknown):T {try{return parse(input);}catch{return corrupt();}}
function next(n:number) {if(!isCounter(n+1))throw new ControlError('REVISION_EXHAUSTED',409,'Notification state revision exhausted');return n+1;}
const terminal=(status:string)=>['delivered','dead-letter','cancelled'].includes(status);
const backoff=(attempt:number)=>Math.min(300000,30000*2**Math.max(0,attempt-1));
function identities(actor:string,scope:string,id?:string) {if(!isId(actor)||!isId(scope)||id!==undefined&&!isId(id))invalid('Valid notification query identities required');}
function canonicalTime(input:string) {const value=nativeParseTime(input);if(!time(value)||nativeIsoTime(value)!==input)invalid('Canonical UTC notification bounds required');return value;}
function cursor(hash:string,position:{createdAt:number;id:string}) {return nativeJsonBase64Url({version:1,queryDigest:hash,position});}

/** Notification intent/outcomes only: never commands Forward, Runtime, Probe or Agent. */
export class NotificationDeliveries<Tx> implements StationEventHandoff<Tx>, NotificationDeliveriesApi {
    readonly enabled:boolean;
    private readonly options:Options<Tx>;
    private readonly clock:()=>number;
    private running:Promise<void>|null=null;
    private stopping=false;
    private active=0;
    private admittedRequests=0;
    private readonly actors=new Map<string,{active:boolean;until:number}>();
    constructor(options:Options<Tx>) {
        if (!isCounter(options.clockSkewMs??1000,true)||(options.clockSkewMs??1000)>300000)throw new Error('Bounded notification clock skew required');
        if(options.enabled&&!options.secrets)throw new ControlError('NOTIFICATION_SECRETS_UNAVAILABLE',503,'Webhook delivery requires protected notification storage');
        this.options=options;this.enabled=options.enabled;this.clock=options.clock??nativeWallClockSource();
    }
    private now() {const now=this.clock();if(!time(now))corrupt();return now;}
    private row(input:unknown,scope:string) {const value=stored(parseNotificationDelivery,input);if(value.payload.scopeId!==scope)corrupt();return value;}
    private bounded<T>(value:T):T {if(jsonUtf8Bytes(value)>limits.responseBytes)corrupt();return deepFreeze(value);}
    private envelope(scopeId:string) {
        return {notificationDeliveriesVersion:1,scopeId,capturedAt:this.now(),deliveryEnabled:this.enabled,workerState:this.enabled?'configured-not-liveness-proof':'disabled',
            source:'persisted-notification-deliveries',readOnly:true,executionAuthorized:false,health:'unknown',networkCheck:'not-performed-by-read',
            consistency:'read-committed-not-global-snapshot',limits};
    }
    async admitRequest<T>(action:()=>Promise<T>):Promise<T> {
        if(this.admittedRequests>=2)throw new ControlError('NOTIFICATION_BUSY',429,'Notification read capacity unavailable',true);
        this.admittedRequests++;try{return await action();}finally{this.admittedRequests--;}
    }
    private async admitted<T>(actor:string,action:()=>Promise<T>):Promise<T> {
        const now=nativeMonotonicNow();for(const [id,v]of this.actors)if(!v.active&&v.until<=now)this.actors.delete(id);
        if(this.active>=2||this.actors.has(actor)||this.actors.size>=128)throw new ControlError('NOTIFICATION_BUSY',429,'Notification read capacity or cooldown unavailable',true);
        this.active++;this.actors.set(actor,{active:true,until:Infinity});
        try{return await action();}finally{this.active--;this.actors.set(actor,{active:false,until:nativeMonotonicNow()+1000});}
    }
    async enqueueIn(tx:Tx,scope:string,policyInput:StationAlertPolicy,eventInput:Parameters<StationEventHandoff<Tx>['enqueueIn']>[3],now:number):Promise<void> {
        if(!isId(scope)||!time(now))corrupt();
        const policy=stored(parseStationAlertPolicy,policyInput),event=stored(parseStationAlertEvent,eventInput);
        if(event.policyId!==policy.policyId||event.configRevision!==policy.configRevision||event.configDigest!==policy.configDigest||event.occurredAt!==now)corrupt();
        // Station scope/policy are already held by the source owner. Route reads never acquire execution authority.
        await this.options.endpoints.lockScope(tx,scope);
        let routes:NotificationEndpoint[];
        try {
            const found=await this.options.endpoints.list(tx,scope);
            if(!Array.isArray(found)||found.length>16)corrupt();routes=found.map(v=>stored(parseNotificationEndpoint,v));
            if(new Set(routes.map(v=>v.endpointId)).size!==routes.length)corrupt();
        } catch(error) {
            if(!(error instanceof ControlError)||error.code!=='INTEGRITY_FAILURE')throw error;
            await this.options.store.lockScope(tx,scope);await this.options.store.loss(tx,scope,'routingRejected',1);return;
        }
        const selected=routes.filter(v=>v.config.enabled&&v.suspended==='none'&&v.config.policyIds.includes(event.policyId)&&v.config.kinds.includes(event.kind));
        if(!selected.length)return;
        await this.options.store.lockScope(tx,scope);
        if(!this.enabled) {await this.options.store.loss(tx,scope,'disabledSuppressed',selected.length);return;}
        if(event.silenced||event.recoverySuspended) {await this.options.store.loss(tx,scope,'silenceSuppressed',selected.length);return;}
        for(const route of selected) {
            const id=notificationDeliveryId(scope,event.id,route.endpointId),payload=notificationPayload(scope,id,event);
            const value=this.row({id,eventId:event.id,policyId:event.policyId,endpointId:route.endpointId,policyConfigRevision:event.configRevision,
                endpointRevision:route.revision,credentialRevision:route.credentialRevision,policyManagedBy:policy.managedBy,endpointManagedBy:route.managedBy,
                authorityDigest:route.authorityDigest,payload,payloadDigest:digest(payload),revision:1,status:'queued',attemptCount:0,fence:0,claimedAt:null,claimUntil:null,
                createdAt:now,updatedAt:now,nextAttemptAt:now,expiresAt:now+limits.eventLifetimeMs,lastCode:null,lastOutcome:'none',lastStatusCode:null,recoverySuspended:false},scope);
            await this.options.store.insert(tx,scope,value,now);
        }
    }
    private async authorized(tx:Tx,scope:string,row:NotificationDelivery):Promise<boolean> {
        for(const actor of [...new Set([row.policyManagedBy,row.endpointManagedBy])].sort()) {
            try {await this.options.auth.owner(tx,actor,scope);}
            catch(error) {if(error instanceof ControlError&&[403,404].includes(error.status))return false;throw error;}
        }
        return true;
    }
    private async locked(tx:Tx,scope:string,candidate:NotificationDelivery):Promise<Locked|null> {
        const authorized=await this.authorized(tx,scope,candidate);
        await this.options.policies.lockScope(tx,scope);
        const rawPolicy=await this.options.policies.policy(tx,scope,candidate.policyId,true),policy=rawPolicy?stored(parseStationAlertPolicy,rawPolicy):null;
        await this.options.endpoints.lockScope(tx,scope);
        const rawEndpoint=await this.options.endpoints.get(tx,scope,candidate.endpointId,true),endpoint=rawEndpoint?stored(parseNotificationEndpoint,rawEndpoint):null;
        await this.options.store.lockScope(tx,scope);
        const raw=await this.options.store.get(tx,scope,candidate.id,true);if(!raw)return null;
        const row=this.row(raw,scope);if(row.revision!==candidate.revision)return null;
        return {row,policy,endpoint,authorized};
    }
    private async denial(value:Locked,now:number):Promise<NotificationDeliveryCode|null> {
        const {row,policy,endpoint}=value;
        if(row.recoverySuspended||policy?.suspended==='recovery'||endpoint?.suspended==='recovery')return 'RECOVERY_SUSPENDED';
        if(!value.authorized)return 'AUTHORIZATION_REVOKED';
        if(!policy||policy.policyId!==row.policyId||!policy.config.enabled||policy.suspended!=='none'||policy.configRevision!==row.policyConfigRevision||policy.managedBy!==row.policyManagedBy)return 'POLICY_CHANGED';
        if(!endpoint||endpoint.endpointId!==row.endpointId||!endpoint.config.enabled||endpoint.revision!==row.endpointRevision||endpoint.credentialRevision!==row.credentialRevision||
            endpoint.managedBy!==row.endpointManagedBy||endpoint.authorityDigest!==row.authorityDigest||!endpoint.config.policyIds.includes(row.policyId)||!endpoint.config.kinds.includes(row.payload.event.kind))return 'ENDPOINT_CHANGED';
        if(policy.silencedUntil!==null&&policy.silencedUntil>now)return 'CURRENT_SILENCE';
        const binding=await this.options.authorityBinding();if(!notificationHash(binding))corrupt();
        return binding===row.authorityDigest?null:'RECOVERY_SUSPENDED';
    }
    private async save(tx:Tx,scope:string,value:NotificationDelivery) {await this.options.store.put(tx,scope,this.row(value,scope));}
    private completed(row:NotificationDelivery,status:'cancelled'|'dead-letter',code:NotificationDeliveryCode,now:number):NotificationDelivery {
        return {...row,revision:next(row.revision),status,lastCode:code,lastStatusCode:null,updatedAt:now,nextAttemptAt:0,claimedAt:null,claimUntil:null};
    }
    private attempt(row:NotificationDelivery,result:RecordedResult|null,now:number):NotificationDeliveryAttempt {
        if(row.claimedAt===null)corrupt();
        return stored(parseNotificationDeliveryAttempt,{id:notificationAttemptId(row.id,row.fence),deliveryId:row.id,ordinal:row.attemptCount,fence:row.fence,
            startedAt:row.claimedAt,finishedAt:result?now:null,outcome:result?.outcome??'pending',code:result?.code??null,statusCode:result?.statusCode??null});
    }
    private async claim(observed:(header:NotificationDeliveryHeader,cutoff:number)=>void):Promise<{scope:string;row:NotificationDelivery;endpoint:NotificationEndpoint}|null> {
        return this.options.db.transaction(async tx=>{
            const now=this.now(),header=await this.options.store.due(tx,now);if(!header)return null;
            if(!isId(header.scopeId)||!isId(header.id)||!isCounter(header.revision))corrupt();observed(header,now);
            const raw=await this.options.store.get(tx,header.scopeId,header.id);if(!raw)return null;
            const candidate=this.row(raw,header.scopeId),value=await this.locked(tx,header.scopeId,candidate);if(!value)return null;
            const {row}=value,scope=header.scopeId;
            if(terminal(row.status)||row.nextAttemptAt>now)return null;
            if(now<row.updatedAt)throw new ControlError('CLOCK_UNCERTAIN',409,'Notification clock moved behind recorded state');
            if(row.status==='claimed') {
                if(row.claimUntil===null||row.claimUntil>now)return null;
                const expired:RecordedResult={outcome:'unknown',code:'ATTEMPT_EXPIRED',statusCode:null};
                await this.options.store.finishAttempt(tx,scope,row.id,this.attempt(row,expired,now));
                const failed={...row,revision:next(row.revision),status:row.attemptCount>=6?'dead-letter':'retry-wait',claimedAt:null,claimUntil:null,
                    updatedAt:now,nextAttemptAt:row.attemptCount>=6?0:now+backoff(row.attemptCount),lastCode:'ATTEMPT_EXPIRED',lastOutcome:'unknown',lastStatusCode:null} as NotificationDelivery;
                await this.save(tx,scope,failed);return null;
            }
            if(now>=row.expiresAt) {await this.save(tx,scope,this.completed(row,'dead-letter','EVENT_TOO_OLD',now));return null;}
            const denied=await this.denial(value,now);if(denied) {await this.save(tx,scope,this.completed(row,'cancelled',denied,now));return null;}
            if(row.attemptCount>=6) {await this.save(tx,scope,this.completed(row,'dead-letter',row.lastCode??'ATTEMPT_EXPIRED',now));return null;}
            if(await this.options.store.activeCount(tx,scope,now)>=limits.activePerScope) {
                await this.save(tx,scope,{...row,revision:next(row.revision),updatedAt:now,nextAttemptAt:now+1000,lastCode:'CAPACITY_WAIT'});return null;
            }
            const rate=await this.options.store.reserveRate(tx,scope,row.endpointId,now,value.endpoint!.config.minimumIntervalSeconds*1000);
            if(!time(rate)||rate<now)corrupt();
            if(rate>now) {await this.save(tx,scope,{...row,revision:next(row.revision),updatedAt:now,nextAttemptAt:rate,lastCode:'RATE_WAIT'});return null;}
            const claimed=this.row({...row,revision:next(row.revision),status:'claimed',attemptCount:next(row.attemptCount),fence:next(row.fence),
                claimedAt:now,claimUntil:now+limits.claimMs,updatedAt:now,nextAttemptAt:now+limits.claimMs},scope);
            await this.save(tx,scope,claimed);await this.options.store.appendAttempt(tx,scope,this.attempt(claimed,null,now));
            return {scope,row:claimed,endpoint:value.endpoint!};
        });
    }
    private async preflight(scope:string,claim:NotificationDelivery):Promise<boolean> {
        if(this.stopping||!this.enabled)return false;
        return this.options.db.transaction(async tx=>{
            const value=await this.locked(tx,scope,claim);if(!value)return false;
            const now=this.now(),row=value.row;
            if(row.status!=='claimed'||row.fence!==claim.fence||row.claimUntil===null||now<row.updatedAt||now+5000>row.claimUntil||now>=row.expiresAt)return false;
            return await this.denial(value,now)===null;
        });
    }
    private async finish(scope:string,claim:NotificationDelivery,result:RecordedResult):Promise<void> {
        await this.options.db.transaction(async tx=>{
            await this.options.store.lockScope(tx,scope);
            const raw=await this.options.store.get(tx,scope,claim.id,true);if(!raw)return;
            const row=this.row(raw,scope),now=this.now();
            if(row.status!=='claimed'||row.fence!==claim.fence||row.revision!==claim.revision||row.claimUntil===null||now>=row.claimUntil||now<row.updatedAt)return;
            await this.options.store.finishAttempt(tx,scope,row.id,this.attempt(row,result,now));
            const retryable=['DNS_FAILED','DNS_TIMEOUT','GUARD_FAILED','CAPACITY_UNAVAILABLE','ABORTED','DEADLINE','RESPONSE_LIMIT','NETWORK_UNKNOWN'].includes(result.code)||
                result.code==='HTTP_REJECTED'&&(result.statusCode===408||result.statusCode===429||result.statusCode!==null&&result.statusCode>=500);
            const retry=result.outcome!=='delivered'&&retryable&&row.attemptCount<6&&now+backoff(row.attemptCount)<row.expiresAt;
            const status=result.outcome==='delivered'?'delivered':result.code==='DISPATCH_DENIED'?'cancelled':retry?'retry-wait':'dead-letter';
            await this.save(tx,scope,{...row,revision:next(row.revision),status,claimedAt:null,claimUntil:null,updatedAt:now,nextAttemptAt:retry?now+backoff(row.attemptCount):0,
                lastOutcome:result.outcome,lastCode:result.code,lastStatusCode:result.statusCode});
        });
    }
    tick():Promise<void> {
        if(!this.enabled||this.stopping||this.running)return Promise.resolve();
        const action=this.run();this.running=action;
        return action.finally(()=>{if(this.running===action)this.running=null;});
    }
    private async run():Promise<void> {
        let attempted:{header:NotificationDeliveryHeader;cutoff:number}|null=null,lease:NotificationSecretLease|undefined;
        try {
            const selected=await this.claim((header,cutoff)=>{attempted={header,cutoff};});if(!selected)return;
            const {scope,row,endpoint}=selected;
            let material;
            try {
                lease=await this.options.secrets!.acquire({scopeId:scope,endpointId:row.endpointId,credentialRevision:row.credentialRevision,authorityDigest:row.authorityDigest},endpoint.credentialRef);
                material=parseNotificationDestination(lease.destination);
            } catch {
                const allowed=await this.preflight(scope,row);
                await this.finish(scope,row,{outcome:'rejected',code:allowed?'CREDENTIAL_UNAVAILABLE':'DISPATCH_DENIED',statusCode:null});return;
            }
            const key=nativeHexBytes(material.signingKey);
            try {
                const result=await this.options.sender.send({destination:material.url,deliveryId:row.id,body:notificationWireBody(row.payload),secret:key,
                    beforeDispatch:()=>this.preflight(scope,row)});
                await this.finish(scope,row,result);
            } finally {key.fill(0);}
        } catch(error) {
            const failed=attempted as {header:NotificationDeliveryHeader;cutoff:number}|null;
            if(failed)try {await this.options.db.transaction(async tx=>{await this.options.store.lockScope(tx,failed.header.scopeId);await this.options.store.defer(tx,failed.header,failed.cutoff,this.now()+300000);});}catch{}
            throw error;
        } finally {
            // A timeout result is not physical completion of noncancelable DNS, a guard, or a socket.
            try {await this.options.sender.idle();}finally{lease?.release();}
        }
    }
    async close():Promise<void> {this.stopping=true;await this.options.sender.close();await this.running?.catch(()=>{});}
    async get(actor:string,scope:string,id:string) {
        identities(actor,scope,id);
        return this.admitted(actor,()=>this.options.db.transaction(async tx=>{
            await this.options.auth.owner(tx,actor,scope);
            // Freeze this module's head while reading its attempt tail; no Runtime/resource locks or writes.
            const raw=await this.options.store.get(tx,scope,id,'share');if(!raw)notFound();const value=this.row(raw,scope);
            const rawAttempts=await this.options.store.attempts(tx,scope,id);if(!Array.isArray(rawAttempts)||rawAttempts.length>17)corrupt();
            const items=rawAttempts.map(v=>stored(parseNotificationDeliveryAttempt,v));
            if(items.some((v,i)=>v.deliveryId!==id||v.ordinal>value.attemptCount||i>0&&items[i-1]!.ordinal<=v.ordinal)||new Set(items.map(v=>v.id)).size!==items.length)corrupt();
            return this.bounded({...this.envelope(scope),delivery:publicNotificationDelivery(value),attempts:{items:items.slice(0,16),truncated:items.length>16},
                losses:stored(parseNotificationDeliveryLosses,await this.options.store.losses(tx,scope))});
        }));
    }
    async history(actor:string,scope:string,input:Record<string,string>={}) {
        identities(actor,scope);
        if(Object.keys(input).some(k=>!['from','to','limit','cursor','endpointId','eventId','status'].includes(k))||Object.values(input).some(v=>typeof v!=='string'))invalid('Closed notification history query required');
        const now=this.now(),from=input.from===undefined?now-86400000:canonicalTime(input.from),to=input.to===undefined?now:canonicalTime(input.to);
        if(!time(from)||!time(to)||from<Math.max(0,now-limits.retentionMs)||to<=from||to-from>limits.retentionMs||to>now+(this.options.clockSkewMs??1000)||
            input.cursor!==undefined&&(input.from===undefined||input.to===undefined))invalid('Notification query outside its retained fixed window');
        const limit=input.limit===undefined?25:Number(input.limit);
        if(!isCounter(limit)||limit>50||input.limit!==undefined&&String(limit)!==input.limit)invalid('Bounded notification page required');
        const filters={endpointId:input.endpointId??null,eventId:input.eventId??null,status:input.status??null};
        if(filters.endpointId!==null&&!isId(filters.endpointId)||filters.eventId!==null&&!isId(filters.eventId)||filters.status!==null&&!NOTIFICATION_DELIVERY_STATUSES.includes(filters.status as NotificationDelivery['status']))invalid('Invalid notification history filter');
        const queryDigest=digest({scope,from,to,limit,filters});let before:NotificationDeliveryQuery['before']=null;
        if(input.cursor!==undefined) {
            try {
                if(!input.cursor||input.cursor.length>1024||!/^[A-Za-z0-9_-]+$/.test(input.cursor))invalid('Invalid notification cursor');
                const c=object(parseJson(nativeBase64UrlText(input.cursor),1024),['version','queryDigest','position']),p=object(c.position,['createdAt','id']);
                if(c.version!==1||c.queryDigest!==queryDigest||!time(p.createdAt)||p.createdAt<from||p.createdAt>=to||!isId(p.id))invalid('Invalid notification cursor');
                before={createdAt:p.createdAt,id:p.id};if(cursor(queryDigest,before)!==input.cursor)invalid('Invalid notification cursor');
            } catch {invalid('Invalid notification cursor');}
        }
        const query:NotificationDeliveryQuery={from,to,limit,before,...(filters.endpointId===null?{}:{endpointId:filters.endpointId}),
            ...(filters.eventId===null?{}:{eventId:filters.eventId}),...(filters.status===null?{}:{status:filters.status as NotificationDelivery['status']})};
        return this.admitted(actor,()=>this.options.db.transaction(async tx=>{
            await this.options.auth.owner(tx,actor,scope);
            const raw=await this.options.store.history(tx,scope,query);if(!Array.isArray(raw)||raw.length>limit+1)corrupt();const values=raw.map(v=>this.row(v,scope));
            if(new Set(values.map(v=>v.id)).size!==values.length||values.some((v,i)=>v.createdAt<from||v.createdAt>=to||
                filters.endpointId!==null&&v.endpointId!==filters.endpointId||filters.eventId!==null&&v.eventId!==filters.eventId||filters.status!==null&&v.status!==filters.status||
                i>0&&(values[i-1]!.createdAt<v.createdAt||values[i-1]!.createdAt===v.createdAt&&values[i-1]!.id<=v.id)))corrupt();
            const items=values.slice(0,limit),hasMore=values.length>limit;
            return this.bounded({...this.envelope(scope),window:{from,to},filters,limit,items:items.map(publicNotificationDelivery),hasMore,
                nextCursor:hasMore?cursor(queryDigest,{createdAt:items[items.length-1]!.createdAt,id:items[items.length-1]!.id}):null,
                losses:stored(parseNotificationDeliveryLosses,await this.options.store.losses(tx,scope))});
        }));
    }
}
