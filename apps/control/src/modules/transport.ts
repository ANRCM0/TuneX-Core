import { isId,isCounter,MAX_COUNTER } from '@tunex/core';
import { digest,parseRelayMessage } from '@tunex/contracts';
import type { RelayProfileConfig } from '@tunex/contracts';
import { ControlError,invalid,notFound } from '../application/errors.ts';
import { rows,write,json } from '../infrastructure/mysql.ts';
import type { MySqlUnitOfWork,Transaction } from '../infrastructure/mysql.ts';
import type { Identity } from './identity.ts';
import { Idempotency } from './idempotency.ts';
interface Revision {revision:number;config:unknown;config_digest:string;created_by:string;created_at:number}
export class Transport {
 private readonly db:MySqlUnitOfWork;private readonly identity:Identity;private readonly idempotency:Idempotency;
 constructor(db:MySqlUnitOfWork,identity:Identity,idempotency:Idempotency){this.db=db;this.identity=identity;this.idempotency=idempotency;}
 async publish(actor:string,scopeId:string,profileId:string,key:string|undefined,expectedRevision:number,input:unknown){
  if(!isId(profileId)||!isCounter(expectedRevision,true)||!key||!/^[\x21-\x7e]{1,128}$/.test(key))invalid('Valid Profile, expectedRevision and Idempotency-Key required');
  const config=parseRelayMessage('ProfileConfig',JSON.stringify(input));const configDigest=digest(config);
  const request={actorId:actor,scopeId,key,digest:digest({method:'PUT',path:`/api/v1/scopes/${scopeId}/transport-profiles/${profileId}`,expectedRevision,config})};
  return this.db.transaction(async tx=>{
   await this.identity.owner(tx,actor,scopeId);
   const replay=await this.idempotency.claim<{status:200|202;body:{profileId:string;revision:number;configDigest:string;changed:boolean}}>(tx,request);if(replay)return replay;
   await write(tx,'INSERT INTO transport_profiles(id,scope_id) VALUES(?,?) ON DUPLICATE KEY UPDATE id=id',[profileId,scopeId]);
   const current=(await rows<{current_revision:number;scope_id:string}>(tx,'SELECT scope_id,current_revision FROM transport_profiles WHERE id=? FOR UPDATE',[profileId]))[0]!;
   if(current.scope_id!==scopeId)throw new ControlError('AUTHORIZATION_DENIED',403,'Profile belongs to another scope');
   if(current.current_revision!==expectedRevision)throw new ControlError('REVISION_CONFLICT',409,'Transport Profile revision conflict');
   const old=current.current_revision>0?await this.revision(tx,profileId,current.current_revision):undefined;
   if(old){const stored=parseRelayMessage('ProfileConfig',JSON.stringify(json(old.config)));if(digest(stored)!==old.config_digest)throw new ControlError('INTEGRITY_FAILURE',409,'Stored Transport Profile differs from its digest');}
   const changed=!old||old.config_digest!==configDigest,revision=expectedRevision+(changed?1:0);
   if(revision>MAX_COUNTER)throw new ControlError('REVISION_EXHAUSTED',409,'Transport Profile revision exhausted');
   if(changed){await write(tx,'INSERT INTO transport_profile_revisions(profile_id,revision,config,config_digest,created_by,created_at) VALUES(?,?,?,?,?,?)',[profileId,revision,JSON.stringify(config),configDigest,actor,Date.now()]);await write(tx,'UPDATE transport_profiles SET current_revision=? WHERE id=?',[revision,profileId]);}
   const response={status:changed?202 as const:200 as const,body:{profileId,revision,configDigest,changed}};await this.idempotency.respond(tx,request,response);return response;
  });
 }
 private async revision(tx:Transaction,profileId:string,revision:number):Promise<Revision>{const record=(await rows<Revision>(tx,'SELECT * FROM transport_profile_revisions WHERE profile_id=? AND revision=?',[profileId,revision]))[0];if(!record)notFound();return record;}
 async get(actor:string,scopeId:string,profileId:string,requestedRevision?:number){
  if(!isId(profileId)||requestedRevision!==undefined&&!isCounter(requestedRevision))invalid('Valid Profile revision required');
  return this.db.transaction(async tx=>{await this.identity.scope(tx,actor,scopeId);const profile=(await rows<{current_revision:number}>(tx,'SELECT current_revision FROM transport_profiles WHERE id=? AND scope_id=?',[profileId,scopeId]))[0];if(!profile)notFound();const record=await this.revision(tx,profileId,requestedRevision??profile.current_revision);const config=parseRelayMessage('ProfileConfig',JSON.stringify(json<RelayProfileConfig>(record.config)));if(digest(config)!==record.config_digest)throw new ControlError('INTEGRITY_FAILURE',409,'Transport Profile digest differs');return {profileId,currentRevision:profile.current_revision,revision:record.revision,config,configDigest:record.config_digest,createdBy:record.created_by,createdAt:new Date(record.created_at).toISOString(),executionSupported:false};});
 }
 async list(actor:string,scopeId:string){return this.db.transaction(async tx=>{await this.identity.scope(tx,actor,scopeId);const profiles=await rows<{id:string;current_revision:number}>(tx,'SELECT id,current_revision FROM transport_profiles WHERE scope_id=? ORDER BY id',[scopeId]);return {profiles:profiles.map(p=>({profileId:p.id,currentRevision:p.current_revision})),executionSupported:false};});}
}
