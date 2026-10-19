import { ControlError, invalid, notFound } from '../../framework/public.ts';
import type { TransportRevisionRecord } from '../../framework/public.ts';
import type { NativeTransportProfileConfig as TransportProfileConfig } from '../../compatibility/public.ts';
import type { TransportOwner, TransportOptions, ResolvedProfile, TransportGrantCommand, TransportGrantState,
    TransportPublishResponse, TransportProfileView } from './contracts.ts';

export class TransportService<Tx> implements TransportOwner<Tx> {
    private readonly db:TransportOptions<Tx>['db'];private readonly identity:TransportOptions<Tx>['identity'];
    private readonly idempotency:TransportOptions<Tx>['idempotency'];private readonly forwarding:TransportOptions<Tx>['forwarding'];
    private readonly store:TransportOptions<Tx>['store'];private readonly codec:TransportOptions<Tx>['codec'];
    private readonly now:TransportOptions<Tx>['now'];private readonly newID:TransportOptions<Tx>['newID'];
    constructor(options:TransportOptions<Tx>){
        if(typeof options.codec?.formatTime!=='function')throw new Error('Transport time formatter is required');
        this.db=options.db;this.identity=options.identity;this.idempotency=options.idempotency;
        this.forwarding=options.forwarding;this.store=options.store;this.codec=options.codec;this.now=options.now;this.newID=options.newID;}
    async publish(actor:string,scopeId:string,profileId:string,key:string|undefined,expectedRevision:number,input:unknown):Promise<TransportPublishResponse>{
        if(!this.codec.isId(profileId)||!this.codec.isCounter(expectedRevision,true)||!key||!this.codec.validRequestKey(key))invalid('Valid Profile, expectedRevision and Idempotency-Key required');
        const config=this.codec.profile(input),configDigest=this.codec.digest(config);
        const request={actorId:actor,scopeId,key,digest:this.codec.digest({method:'PUT',path:`/api/v1/scopes/${scopeId}/transport-profiles/${profileId}`,expectedRevision,config})};
        return this.db.transaction(async tx=>{
            await this.identity.owner(tx,actor,scopeId);
            const replay=await this.idempotency.claim<TransportPublishResponse>(tx,request);if(replay)return replay;
            await this.store.ensureProfile(tx,profileId,scopeId);
            const current=(await this.store.publicationForUpdate(tx,profileId))!;
            if(current.scope_id!==scopeId)throw new ControlError('AUTHORIZATION_DENIED',403,'Profile belongs to another scope');
            if(current.current_revision!==expectedRevision)throw new ControlError('REVISION_CONFLICT',409,'Transport Profile revision conflict');
            const old=current.current_revision>0?await this.revision(tx,profileId,current.current_revision):undefined;
            if(old){const stored=this.codec.profile(this.codec.readStored(old.config));if(this.codec.digest(stored)!==old.config_digest)throw new ControlError('INTEGRITY_FAILURE',409,'Stored Transport Profile differs from its digest');}
            const changed=!old||old.config_digest!==configDigest,revision=expectedRevision+(changed?1:0);
            if(revision>this.codec.maxRevision)throw new ControlError('REVISION_EXHAUSTED',409,'Transport Profile revision exhausted');
            if(changed){await this.store.publishRevision(tx,profileId,revision,this.codec.encode(config),configDigest,actor,this.now());await this.store.setCurrentRevision(tx,profileId,revision);}
            if(expectedRevision===0)await this.store.insertGrant(tx,profileId,actor);
            const response={status:changed?202 as const:200 as const,body:{profileId,revision,configDigest,changed}};
            await this.idempotency.respond(tx,request,response);return response;
        });
    }
    async resolve(tx:Tx,actor:string,scopeId:string,profileId:string,revision:number):Promise<ResolvedProfile>{
        if(!this.codec.isId(profileId)||!this.codec.isCounter(revision))invalid('Valid locked Profile reference required');
        await this.identity.scope(tx,actor,scopeId,true);
        const profile=await this.store.authorizedProfile(tx,profileId,scopeId,actor);if(!profile)notFound();
        const record=await this.revision(tx,profileId,revision),config=this.codec.profile(this.codec.readStored(record.config));
        if(this.codec.digest(config)!==record.config_digest)throw new ControlError('INTEGRITY_FAILURE',409,'Transport Profile digest differs');
        return {profileId,revision,config,configDigest:record.config_digest};
    }
    async applyGrant(tx:Tx,command:TransportGrantCommand):Promise<TransportGrantState>{
        const {actorId:actor,scopeId,profileId,subject,expectedRevision,allowed}=command;
        if(!this.codec.isId(actor)||!this.codec.isId(scopeId)||!this.codec.isId(profileId)||!this.codec.isId(subject)||!this.codec.isCounter(expectedRevision)||typeof allowed!=='boolean')invalid('Valid Profile grant command required');
        await this.identity.owner(tx,actor,scopeId);
        const profile=await this.store.grantRevisionForUpdate(tx,profileId,scopeId);if(!profile)notFound();
        if(profile.grant_revision!==expectedRevision)throw new ControlError('REVISION_CONFLICT',409,'Profile grants revision conflict');
        if(allowed)await this.identity.scope(tx,subject,scopeId,true);
        const previous=await this.store.grantCount(tx,profileId,subject)===1;
        const changed=previous!==allowed,revision=expectedRevision+(changed?1:0);
        if(revision>this.codec.maxRevision)throw new ControlError('REVISION_EXHAUSTED',409,'Profile grant revision exhausted');
        if(changed){
            await this.forwarding.hasLiveRelay(tx,profileId);
            if(allowed)await this.store.insertGrant(tx,profileId,subject);else await this.store.deleteGrant(tx,profileId,subject);
            await this.store.setGrantRevision(tx,profileId,revision);
            await this.store.grantEvent(tx,this.newID(),profileId,actor,subject,revision,this.now(),this.codec.encode({allowed}));
        }
        return {profileId,actorId:subject,revision,allowed,changed};
    }
    async grants(actor:string,scopeId:string,profileId:string):Promise<{profileId:string;revision:number;actorIds:string[]}>{
        return this.db.transaction(async tx=>{
            await this.identity.owner(tx,actor,scopeId);const profile=await this.store.grantRevision(tx,profileId,scopeId);if(!profile)notFound();
            const grants=await this.store.grantActors(tx,profileId);return {profileId,revision:profile.grant_revision,actorIds:grants.map(g=>g.actor_id)};
        });
    }
    private async revision(tx:Tx,profileId:string,revision:number):Promise<TransportRevisionRecord>{
        const record=await this.store.revision(tx,profileId,revision);if(!record)notFound();return record;
    }
    async get(actor:string,scopeId:string,profileId:string,requestedRevision?:number):Promise<TransportProfileView>{
        if(!this.codec.isId(profileId)||requestedRevision!==undefined&&!this.codec.isCounter(requestedRevision))invalid('Valid Profile revision required');
        return this.db.transaction(async tx=>{
            await this.identity.scope(tx,actor,scopeId);const profile=await this.store.currentRevision(tx,profileId,scopeId);if(!profile)notFound();
            const record=await this.revision(tx,profileId,requestedRevision??profile.current_revision);
            const config=this.codec.profile(this.codec.readStored<TransportProfileConfig>(record.config));
            if(this.codec.digest(config)!==record.config_digest)throw new ControlError('INTEGRITY_FAILURE',409,'Transport Profile digest differs');
            return {profileId,currentRevision:profile.current_revision,revision:record.revision,config,configDigest:record.config_digest,createdBy:record.created_by,createdAt:this.codec.formatTime(record.created_at),executionSupported:true};
        });
    }
    async list(actor:string,scopeId:string):Promise<{profiles:{profileId:string;currentRevision:number}[];executionSupported:boolean}>{
        return this.db.transaction(async tx=>{await this.identity.scope(tx,actor,scopeId);const profiles=await this.store.list(tx,scopeId);
            return {profiles:profiles.map(p=>({profileId:p.id,currentRevision:p.current_revision})),executionSupported:true};});
    }
}
