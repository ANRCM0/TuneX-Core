import type { ForwardIntentStore, StoredForwardIntent, StoredForwardState, IdempotencyStore, IdempotencyKey,
    StoredIdempotency, CommandResponse } from '../framework/public.ts';
import { rows, write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

export class MySqlForwardIntentStore implements ForwardIntentStore<Transaction> {
    async revisions(tx:Transaction,id:string):Promise<{revision:number;spec:unknown}[]>{return rows(tx,'SELECT revision,spec FROM forward_revisions WHERE forward_id=? ORDER BY revision DESC LIMIT 25',[id]);}
    async quarantine(tx:Transaction):Promise<void>{await write(tx,'UPDATE forwards SET recovery_suspended=TRUE');}
    async liveProfileCount(tx:Transaction,id:string):Promise<number>{return (await rows(tx,"SELECT id FROM forwards WHERE recovery_suspended=FALSE AND deleting=FALSE AND JSON_UNQUOTE(JSON_EXTRACT(spec,'$.transport.profileId'))=? FOR SHARE",[id])).length;}
    async liveNodeCount(tx:Transaction,id:string):Promise<number>{return (await rows(tx,"SELECT id FROM forwards WHERE recovery_suspended=FALSE AND deleting=FALSE AND (JSON_UNQUOTE(JSON_EXTRACT(spec,'$.ingress.nodeId'))=? OR JSON_CONTAINS(JSON_EXTRACT(spec,'$.path.via'),JSON_QUOTE(?))) AND JSON_EXTRACT(spec,'$.transport') IS NOT NULL FOR SHARE",[id,id])).length;}
    async forNode(tx:Transaction,id:string):Promise<StoredForwardIntent[]>{return rows(tx,"SELECT * FROM forwards WHERE deleting=FALSE AND recovery_suspended=FALSE AND JSON_UNQUOTE(JSON_EXTRACT(spec,'$.ingress.nodeId'))=? ORDER BY id",[id]);}
    async forReferencedNode(tx:Transaction,id:string):Promise<StoredForwardIntent[]>{return rows(tx,"SELECT * FROM forwards WHERE deleting=FALSE AND recovery_suspended=FALSE AND (JSON_UNQUOTE(JSON_EXTRACT(spec,'$.ingress.nodeId'))=? OR JSON_CONTAINS(JSON_EXTRACT(spec,'$.path.via'),JSON_QUOTE(?))) ORDER BY id",[id,id]);}
    async forProfileActor(tx:Transaction,actor:string,id:string):Promise<StoredForwardIntent[]>{return rows(tx,"SELECT * FROM forwards WHERE authorization_actor=? AND deleting=FALSE AND recovery_suspended=FALSE AND JSON_UNQUOTE(JSON_EXTRACT(spec,'$.transport.profileId'))=? ORDER BY id",[actor,id]);}
    async insertCurrent(tx:Transaction,id:string,scope:string,revision:number,encoded:string,actor:string):Promise<void>{await write(tx,'INSERT INTO forwards(id,scope_id,revision,spec,authorization_actor) VALUES(?,?,?,?,?)',[id,scope,revision,encoded,actor]);}
    async insertRevision(tx:Transaction,id:string,revision:number,encoded:string):Promise<void>{await write(tx,'INSERT INTO forward_revisions(forward_id,revision,spec) VALUES(?,?,?)',[id,revision,encoded]);}
    async authorizer(tx:Transaction,id:string):Promise<{authorization_actor:string|null}|undefined>{return (await rows<{authorization_actor:string|null}>(tx,'SELECT authorization_actor FROM forwards WHERE id=?',[id]))[0];}
    async setAuthorizer(tx:Transaction,actor:string,id:string):Promise<void>{await write(tx,'UPDATE forwards SET authorization_actor=? WHERE id=?',[actor,id]);}
    async forActor(tx:Transaction,scope:string,actor:string):Promise<StoredForwardIntent[]>{return rows(tx,'SELECT * FROM forwards WHERE scope_id=? AND authorization_actor=? AND deleting=FALSE ORDER BY id',[scope,actor]);}
    async get(tx:Transaction,id:string,scope:string):Promise<StoredForwardIntent|undefined>{return (await rows<StoredForwardIntent>(tx,'SELECT * FROM forwards WHERE id=? AND scope_id=? AND deleting=FALSE',[id,scope]))[0];}
    async currentForUpdate(tx:Transaction,id:string,scope:string):Promise<StoredForwardIntent|undefined>{return (await rows<StoredForwardIntent>(tx,'SELECT * FROM forwards WHERE id=? AND scope_id=? AND deleting=FALSE FOR UPDATE',[id,scope]))[0];}
    async record(tx:Transaction,id:string,scope:string):Promise<StoredForwardState|undefined>{return (await rows<StoredForwardState>(tx,'SELECT * FROM forwards WHERE id=? AND scope_id=?',[id,scope]))[0];}
    async replaceCurrent(tx:Transaction,revision:number,encoded:string,id:string,expectedRevision:number):Promise<number>{return write(tx,'UPDATE forwards SET revision=?,spec=?,deleting=FALSE,recovery_suspended=FALSE WHERE id=? AND revision=? AND deleting=FALSE',[revision,encoded,id,expectedRevision]);}
    async markDeleting(tx:Transaction,revision:number,id:string,expectedRevision:number):Promise<number>{return write(tx,'UPDATE forwards SET revision=?,deleting=TRUE WHERE id=? AND revision=? AND deleting=FALSE',[revision,id,expectedRevision]);}
}

export class MySqlIdempotencyStore implements IdempotencyStore<Transaction> {
    async quarantine(tx:Transaction):Promise<void>{await write(tx,'UPDATE idempotency SET recovery_invalidated=TRUE');}
    async ensure(tx:Transaction,key:IdempotencyKey,digest:string):Promise<void>{await write(tx,'INSERT INTO idempotency(scope_id,actor_id,request_key,request_digest) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE request_key=request_key',[key.scopeId,key.actorId,key.key,digest]);}
    async currentForUpdate(tx:Transaction,key:IdempotencyKey):Promise<StoredIdempotency|undefined>{return (await rows<StoredIdempotency>(tx,'SELECT * FROM idempotency WHERE scope_id=? AND actor_id=? AND request_key=? FOR UPDATE',[key.scopeId,key.actorId,key.key]))[0];}
    async respond(tx:Transaction,status:CommandResponse['status'],encoded:string,key:IdempotencyKey):Promise<void>{await write(tx,'UPDATE idempotency SET http_status=?,response=? WHERE scope_id=? AND actor_id=? AND request_key=?',[status,encoded,key.scopeId,key.actorId,key.key]);}
}
