import { isId } from '@tunex/core';
import type { RuntimeAssignmentValue, RuntimeResourceLimitBucketValue } from '@tunex/contracts/execution-values';
import { ControlError, invalid, notFound } from '../../framework/public.ts';
import type { RuntimePayloadPolicy, OfflinePayloadPolicy, SharedResourceLimitRecord } from '../../framework/public.ts';
import type { SharedResourceLimitInput, SharedResourceLimitOptions, SharedResourceLimitView, SharedResourceLimitPublicationOptions } from './contracts.ts';

function denied():never {throw new ControlError('AUTHORIZATION_DENIED',403,'Shared Node governance or personal grant required');}
function corrupt():never {throw new ControlError('INTEGRITY_FAILURE',409,'Invalid shared resource limit ownership or history');}
function conflict():never {throw new ControlError('REVISION_CONFLICT',409,'Shared resource limit revision changed');}
const nonnegative=(value:unknown):value is number=>Number.isSafeInteger(value)&&(value as number)>=0;
const nullableLimit=(value:unknown):value is number|null=>value===null||nonnegative(value);
function validateRecord(record:SharedResourceLimitRecord,scope:string,node:string,actor:string):void {
    if(!isId(record.bucketId)||record.scopeId!==scope||record.nodeId!==node||record.actorId!==actor||
        !Number.isSafeInteger(record.revision)||record.revision<1||
        !nonnegative(record.startsAt)||!nonnegative(record.endsAt)||record.endsAt<=record.startsAt||
        !nullableLimit(record.bytesPerSecond)||!nullableLimit(record.byteLimit)||
        record.bytesPerSecond===null&&record.byteLimit===null||
        !Number.isSafeInteger(record.burstBytes)||record.burstBytes<1||record.burstBytes>65536)corrupt();
}
function validateHistory(history:readonly SharedResourceLimitRecord[],head:SharedResourceLimitRecord|undefined,scope:string,node:string,actor:string):void {
    if(history.length>1024)throw new ControlError('RESOURCE_LIMIT',429,'Protected resource limit history capacity exceeded');
    const ordered=[...history].sort((a,b)=>a.startsAt-b.startsAt),ids=new Set<string>();
    for(let index=0;index<ordered.length;index++){
        const record=ordered[index]!;
        validateRecord(record,scope,node,actor);
        if(ids.has(record.bucketId)||index>0&&ordered[index-1]!.endsAt>record.startsAt)corrupt();
        ids.add(record.bucketId);
        if(!head||record.revision>head.revision)corrupt();
    }
    if(head){
        validateRecord(head,scope,node,actor);
        const stored=history.find(record=>record.bucketId===head.bucketId);
        if(!stored||stored.revision!==head.revision||stored.startsAt!==head.startsAt||stored.endsAt!==head.endsAt||
            stored.bytesPerSecond!==head.bytesPerSecond||stored.burstBytes!==head.burstBytes||stored.byteLimit!==head.byteLimit)corrupt();
    }else if(history.length)corrupt();
}

/** Product policy only; publication keeps the original Runtime transaction and ledger. */
export class SharedResourceLimits<Tx> implements RuntimePayloadPolicy<Tx> {
    private readonly options:SharedResourceLimitOptions<Tx>;
    constructor(options:SharedResourceLimitOptions<Tx>) {
        this.options=options;
    }

    private identifiers(...values:string[]):void {
        if(values.some(value=>!isId(value)))invalid('Valid shared resource identity required');
    }
    private record(record:SharedResourceLimitRecord,scope:string,node:string,actor:string):void {
        validateRecord(record,scope,node,actor);
    }
    private view(scope:string,node:string,actor:string,record?:SharedResourceLimitRecord):SharedResourceLimitView {
        if(record)this.record(record,scope,node,actor);
        return {scopeId:scope,nodeId:node,actorId:actor,revision:record?.revision??0,
            policy:record?{bucketId:record.bucketId,startsAt:this.options.codec.formatTime(record.startsAt),
                endsAt:this.options.codec.formatTime(record.endsAt),bytesPerSecond:record.bytesPerSecond,
                burstBytes:record.burstBytes,byteLimit:record.byteLimit}:null,
            consumption:{status:'unavailable',source:'agent-protected-journal',usedBytes:null,remainingBytes:null}};
    }
    private async shared(tx:Tx,scope:string,node:string,subject:string,requireGrant:boolean):Promise<void> {
        const access=await this.options.nodes.resourceAccess(tx,node,scope,subject);
        if(!access)notFound();
        if(access.id!==node||access.scope_id!==scope||access.resource_source!=='admin-shared'||access.owner_actor_id!==null||
            !Number.isSafeInteger(access.resource_revision)||access.resource_revision<1)denied();
        if(requireGrant&&access.grant_actor_id!==subject)denied();
    }
    private input(value:SharedResourceLimitInput):{startsAt:number;endsAt:number} {
        const keys=['expectedRevision','startsAt','endsAt','bytesPerSecond','burstBytes','byteLimit'];
        if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||
            keys.some(key=>!Object.hasOwn(value,key))||!nonnegative(value.expectedRevision)||
            value.expectedRevision>=Number.MAX_SAFE_INTEGER||typeof value.startsAt!=='string'||typeof value.endsAt!=='string'||
            !nullableLimit(value.bytesPerSecond)||!nullableLimit(value.byteLimit)||
            value.bytesPerSecond===null&&value.byteLimit===null||
            !Number.isSafeInteger(value.burstBytes)||value.burstBytes<1||value.burstBytes>65536)
            invalid('Explicit revision, period, burst and at least one payload limit required');
        const startsAt=this.options.codec.parseTime(value.startsAt),endsAt=this.options.codec.parseTime(value.endsAt);
        const canonical=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
        if(!nonnegative(startsAt)||!nonnegative(endsAt)||endsAt<=startsAt||
            !canonical.test(value.startsAt)||!canonical.test(value.endsAt)||
            this.options.codec.formatTime(startsAt)!==value.startsAt||this.options.codec.formatTime(endsAt)!==value.endsAt)
            invalid('Valid increasing canonical ISO millisecond resource limit period required');
        return {startsAt,endsAt};
    }
    async set(actor:string,scope:string,node:string,subject:string,request:string,input:SharedResourceLimitInput):Promise<SharedResourceLimitView> {
        this.identifiers(actor,scope,node,subject,request);
        const period=this.input(input),o=this.options;
        const digest=o.codec.digest({kind:'shared-resource-limit.set.v1',scopeId:scope,nodeId:node,actorId:subject,
            expectedRevision:input.expectedRevision,...period,bytesPerSecond:input.bytesPerSecond,burstBytes:input.burstBytes,byteLimit:input.byteLimit});
        return o.db.transaction(async tx=>{
            await o.identity.owner(tx,actor,scope);
            await o.identity.scope(tx,subject,scope);
            await o.runtime.lockNode(tx,node);
            await this.shared(tx,scope,node,subject,true);
            await o.store.lock(tx,node,subject);
            const replay=await o.store.replay(tx,scope,actor,request);
            if(replay){
                if(replay.requestDigest!==digest)throw new ControlError('IDEMPOTENCY_CONFLICT',409,'Request identity already has different payload');
                return replay.response as SharedResourceLimitView;
            }
            const current=await o.store.current(tx,node,subject);
            if(current)this.record(current,scope,node,subject);
            if((current?.revision??0)!==input.expectedRevision)conflict();
            const sameWindow=current&&current.startsAt===period.startsAt&&current.endsAt===period.endsAt;
            const history=await o.store.history(tx,node,subject);
            validateHistory(history,current,scope,node,subject);
            if(!sameWindow&&history.length>=1024)throw new ControlError('RESOURCE_LIMIT',429,'Protected resource limit history capacity reached');
            for(const old of history){
                this.record(old,scope,node,subject);
                if(sameWindow&&old.bucketId===current.bucketId)continue;
                if(period.startsAt<old.endsAt&&old.startsAt<period.endsAt)
                    throw new ControlError('REVISION_CONFLICT',409,'Resource limit periods cannot overlap protected history');
            }
            const record:SharedResourceLimitRecord={scopeId:scope,nodeId:node,actorId:subject,
                bucketId:sameWindow?current.bucketId:o.codec.newID(),revision:input.expectedRevision+1,...period,
                bytesPerSecond:input.bytesPerSecond,burstBytes:input.burstBytes,byteLimit:input.byteLimit};
            this.record(record,scope,node,subject);
            if(!await o.store.save(tx,record,input.expectedRevision))conflict();
            const at=o.now();
            if(!nonnegative(at))corrupt();
            await o.store.audit(tx,o.codec.newID(),actor,record,at);
            const response=this.view(scope,node,subject,record);
            await o.store.receipt(tx,scope,actor,request,digest,response);
            return response;
        });
    }
    async get(actor:string,scope:string,node:string,subject:string):Promise<SharedResourceLimitView> {
        this.identifiers(actor,scope,node,subject);
        const o=this.options;
        return o.db.transaction(async tx=>{
            await o.identity.scope(tx,actor,scope);
            if(actor!==subject){
                await o.identity.owner(tx,actor,scope);
                await this.shared(tx,scope,node,subject,false);
            }else{
                try {await this.shared(tx,scope,node,subject,true);}
                catch(error){
                    if(!(error instanceof ControlError)||error.code!=='AUTHORIZATION_DENIED')throw error;
                    await o.identity.owner(tx,actor,scope);
                    await this.shared(tx,scope,node,subject,false);
                }
            }
            const record=await o.store.current(tx,node,subject),view=this.view(scope,node,subject,record);
            if(o.usage){
                if(record)view.consumption=await o.usage.consumption(tx,record);
                const history=await o.store.history(tx,node,subject);
                validateHistory(history,record,scope,node,subject);
                const at=o.now(),active=history.find(item=>item.startsAt<=at&&at<item.endsAt);
                view.activePeriod=active?{revision:active.revision,policy:this.view(scope,node,subject,active).policy!,
                    consumption:await o.usage.consumption(tx,active)}:null;
            }
            return view;
        });
    }
    async limits(tx:Tx,nodeId:string,capabilities:readonly string[],assignments:readonly RuntimeAssignmentValue[],at:number,
        previous:readonly RuntimeResourceLimitBucketValue[]=[]) {
        return new SharedResourceLimitPublicationPolicy(this.options).limits(tx,nodeId,capabilities,assignments,at,previous);
    }
    /** Original Station transaction; scope ownership cannot bypass a subject's grant. */
    async forAlertIn(tx:Tx,actor:string,scope:string,node:string,subject:string,at:number) {
        this.identifiers(actor,scope,node,subject);
        if(!nonnegative(at))invalid('Valid resource alert observation time required');
        const o=this.options;
        await o.identity.owner(tx,actor,scope);
        try {await o.identity.scope(tx,subject,scope);await this.shared(tx,scope,node,subject,true);}
        catch(error){if(error instanceof ControlError&&(error.code==='AUTHORIZATION_DENIED'||error.code==='NOT_FOUND'))return null;throw error;}
        const head=await o.store.current(tx,node,subject),history=await o.store.history(tx,node,subject);
        validateHistory(history,head,scope,node,subject);
        const policy=history.filter(record=>record.startsAt<=at).sort((a,b)=>b.startsAt-a.startsAt)[0];
        if(!policy)return null;
        return {policy:{...policy},consumption:o.usage?await o.usage.consumption(tx,policy):null};
    }
}

/** Reads in the caller's locked Runtime transaction; it never creates another transaction. */
export class SharedResourceLimitPublicationPolicy<Tx> implements RuntimePayloadPolicy<Tx>,OfflinePayloadPolicy<Tx> {
    private readonly options:SharedResourceLimitPublicationOptions<Tx>;
    constructor(options:SharedResourceLimitPublicationOptions<Tx>) {
        this.options=options;
    }
    async assertUnmetered(tx:Tx,forward:{id:string;scopeId:string},nodeIds:readonly string[]):Promise<void> {
        const claim=await this.options.owners.forwardPortOwner(tx,forward.id);
        if(!claim||claim.scopeId!==forward.scopeId||!isId(claim.ownerActorId))denied();
        for(const nodeId of [...new Set(nodeIds)].sort()){
            const access=await this.options.nodes.resourceAccess(tx,nodeId,forward.scopeId,claim.ownerActorId!);
            if(!access||access.id!==nodeId||access.scope_id!==forward.scopeId)denied();
            if(access.resource_source==='private'&&access.owner_actor_id===claim.ownerActorId)continue;
            if(access.resource_source!=='admin-shared'||access.grant_actor_id!==claim.ownerActorId)denied();
            if(await this.options.store.current(tx,nodeId,claim.ownerActorId!))
                throw new ControlError('UNSUPPORTED_CAPABILITY',409,'Offline Transit cannot enforce shared resource payload limits');
        }
    }
    private async resolve(tx:Tx,nodeId:string,scopeId:string,actor:string,at:number):Promise<SharedResourceLimitRecord|null|false> {
        const access=await this.options.nodes.resourceAccess(tx,nodeId,scopeId,actor);
        if(!access||access.id!==nodeId||access.scope_id!==scopeId||
            !Number.isSafeInteger(access.resource_revision)||access.resource_revision<1)return false;
        if(access.resource_source==='private'&&access.owner_actor_id===actor)return null;
        if(access.resource_source!=='admin-shared'||access.owner_actor_id!==null||access.grant_actor_id!==actor)return false;
        const head=await this.options.store.current(tx,nodeId,actor);
        const history=await this.options.store.history(tx,nodeId,actor);
        validateHistory(history,head,scopeId,nodeId,actor);
        if(!head)return null;
        // The newest configured period need not be the period executing now.
        return history.find(record=>record.startsAt<=at&&at<record.endsAt)??false;
    }
    async limits(tx:Tx,nodeId:string,capabilities:readonly string[],assignments:readonly RuntimeAssignmentValue[],at:number,
        previous:readonly RuntimeResourceLimitBucketValue[]=[]) {
        if(!isId(nodeId))invalid('Valid Runtime Node required');
        if(!nonnegative(at))corrupt();
        const excluded=new Set<string>(),buckets=new Map<string,RuntimeResourceLimitBucketValue>();
        const claims=new Map<string,{scopeId:string;ownerActorId:string|null}|undefined>();
        const policies=new Map<string,SharedResourceLimitRecord|null|false>();
        const seen=new Set<string>();
        for(const assignment of [...assignments].sort((a,b)=>a.assignmentId.localeCompare(b.assignmentId))){
            if(!isId(assignment.assignmentId)||!isId(assignment.forwardId)||seen.has(assignment.assignmentId))corrupt();
            seen.add(assignment.assignmentId);
            if(!claims.has(assignment.forwardId))claims.set(assignment.forwardId,await this.options.owners.forwardPortOwner(tx,assignment.forwardId));
            const claim=claims.get(assignment.forwardId);
            if(!claim||!isId(claim.scopeId)||!isId(claim.ownerActorId)){excluded.add(assignment.assignmentId);continue;}
            const actor=claim.ownerActorId!;
            const key=JSON.stringify([claim.scopeId,nodeId,actor]);
            if(!policies.has(key))policies.set(key,await this.resolve(tx,nodeId,claim.scopeId,actor,at));
            const policy=policies.get(key)!;
            if(policy===null)continue;
            if(policy===false||!capabilities.includes('shared-resource-limits.v1')||
                policy.bytesPerSecond===0||policy.byteLimit===0){excluded.add(assignment.assignmentId);continue;}
            const existing=buckets.get(policy.bucketId);
            if(existing){
                if(existing.scopeId!==claim.scopeId||existing.actorId!==actor||existing.nodeId!==nodeId||existing.revision!==policy.revision)corrupt();
                existing.assignmentIds.push(assignment.assignmentId);
            }else buckets.set(policy.bucketId,{bucketId:policy.bucketId,scopeId:policy.scopeId,nodeId,actorId:actor,
                revision:policy.revision,startsAt:this.options.codec.formatTime(policy.startsAt),endsAt:this.options.codec.formatTime(policy.endsAt),
                bytesPerSecond:policy.bytesPerSecond,burstBytes:policy.burstBytes,byteLimit:policy.byteLimit,assignmentIds:[assignment.assignmentId]});
        }
        // A removed assignment can still drain under its original bounded ticket.
        // Carry policy changes for that same protected bucket without granting work.
        if(capabilities.includes('shared-resource-limits.v1'))for(const prior of previous){
            if(prior.nodeId!==nodeId||!isId(prior.scopeId)||!isId(prior.actorId)||!isId(prior.bucketId))corrupt();
            if(buckets.has(prior.bucketId))continue;
            const head=await this.options.store.current(tx,nodeId,prior.actorId);
            const history=await this.options.store.history(tx,nodeId,prior.actorId);
            validateHistory(history,head,prior.scopeId,nodeId,prior.actorId);
            const stored=history.find(record=>record.bucketId===prior.bucketId);
            if(!stored||stored.revision<prior.revision||this.options.codec.formatTime(stored.startsAt)!==prior.startsAt||
                this.options.codec.formatTime(stored.endsAt)!==prior.endsAt)corrupt();
            if(stored.startsAt<=at&&at<stored.endsAt)buckets.set(stored.bucketId,{
                bucketId:stored.bucketId,scopeId:stored.scopeId,nodeId,actorId:stored.actorId,revision:stored.revision,
                startsAt:prior.startsAt,endsAt:prior.endsAt,bytesPerSecond:stored.bytesPerSecond,
                burstBytes:stored.burstBytes,byteLimit:stored.byteLimit,assignmentIds:[]});
        }
        const values=[...buckets.values()].sort((a,b)=>a.bucketId<b.bucketId?-1:a.bucketId>b.bucketId?1:0);
        if(values.length>1000)throw new ControlError('RESOURCE_LIMIT',429,'Snapshot resource limit bucket capacity exceeded');
        for(const bucket of values)bucket.assignmentIds.sort();
        return {excludedAssignmentIds:[...excluded].sort(),...(values.length?{resourceLimits:{version:1 as const,buckets:values}}:{})};
    }
}
