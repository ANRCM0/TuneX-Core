import { ControlError } from '../framework/public.ts';
import type { IdentityAccessStore, IdentityAccountLookup, IdentityMembershipRecord, IdentityListedMember,
    IdentityScopeContextRecord, IdentityScopeContextWindow } from '../framework/public.ts';
import { rows, write } from './mysql.ts';
import type { MySqlUnitOfWork, Transaction } from './mysql.ts';

/** Original identity tables and locks; no connection/transaction/retry entrypoint. */
export class MySqlIdentityStore implements IdentityAccessStore<Transaction> {
    async recoveryAccounts(tx:Transaction):Promise<{id:string;owner:number}[]> {
        return rows(tx,'SELECT a.id,EXISTS(SELECT 1 FROM scopes s WHERE s.owner_id=a.id) owner FROM accounts a ORDER BY a.id FOR UPDATE');
    }
    async replaceToken(tx:Transaction,actorId:string,hash:string):Promise<void> {
        await write(tx,'UPDATE accounts SET token_hash=? WHERE id=?',[hash,actorId]);
    }
    async deactivateNonOwners(tx:Transaction):Promise<void> {
        await write(tx,'UPDATE scope_members m JOIN scopes s ON s.id=m.scope_id SET m.active=FALSE,m.can_manage=FALSE WHERE m.actor_id<>s.owner_id');
    }
    async insertAccount(tx:Transaction,actorId:string,hash:string):Promise<void> {
        await write(tx,'INSERT INTO accounts(id,token_hash) VALUES(?,?)',[actorId,hash]);
    }
    async insertMemberAccount(tx:Transaction,actorId:string,hash:string):Promise<void> {
        try {await this.insertAccount(tx,actorId,hash);}
        catch(error){
            if((error as {code?:string}).code==='ER_DUP_ENTRY')throw new ControlError('ACCOUNT_CONFLICT',409,'Account identity or bearer credential already exists');
            throw error;
        }
    }
    async createScope(tx:Transaction,scopeId:string,owner:string):Promise<void> {
        await write(tx,'INSERT INTO scopes(id,owner_id) VALUES(?,?)',[scopeId,owner]);
    }
    async addOwner(tx:Transaction,scopeId:string,owner:string):Promise<void> {
        await write(tx,'INSERT INTO scope_members(scope_id,actor_id,can_manage) VALUES(?,?,TRUE)',[scopeId,owner]);
    }
    async accountByToken(tx:Transaction,hash:string):Promise<{id:string}|undefined> {
        return (await rows<{id:string}>(tx,'SELECT id FROM accounts WHERE token_hash=?',[hash]))[0];
    }
    async activeMembership(tx:Transaction,scopeId:string,actor:string):Promise<{canManage:number}|undefined> {
        const record=(await rows<{can_manage:number}>(tx,'SELECT can_manage FROM scope_members WHERE scope_id=? AND actor_id=? AND active=TRUE FOR SHARE',[scopeId,actor]))[0];
        return record&&{canManage:record.can_manage};
    }
    async ownerForShare(tx:Transaction,scopeId:string):Promise<{ownerId:string}|undefined> {
        const record=(await rows<{owner_id:string}>(tx,'SELECT owner_id FROM scopes WHERE id=? FOR SHARE',[scopeId]))[0];
        return record&&{ownerId:record.owner_id};
    }
    async ownerForUpdate(tx:Transaction,scopeId:string):Promise<{ownerId:string}|undefined> {
        const record=(await rows<{owner_id:string}>(tx,'SELECT owner_id FROM scopes WHERE id=? FOR UPDATE',[scopeId]))[0];
        return record&&{ownerId:record.owner_id};
    }
    async executionMembershipCount(tx:Transaction,scopeId:string,actor:string):Promise<number> {
        return (await rows(tx,'SELECT actor_id FROM scope_members WHERE scope_id=? AND actor_id=? AND active=TRUE AND can_manage=TRUE FOR SHARE',[scopeId,actor])).length;
    }
    async memberForUpdate(tx:Transaction,scopeId:string,actor:string):Promise<IdentityMembershipRecord|undefined> {
        const record=(await rows<{revision:number;active:number;can_manage:number}>(tx,'SELECT revision,active,can_manage FROM scope_members WHERE scope_id=? AND actor_id=? FOR UPDATE',[scopeId,actor]))[0];
        return record&&{revision:record.revision,active:record.active,canManage:record.can_manage};
    }
    async accountForShare(tx:Transaction,actor:string):Promise<{tokenHash:string}|undefined> {
        const record=(await rows<{token_hash:string}>(tx,'SELECT token_hash FROM accounts WHERE id=? FOR SHARE',[actor]))[0];
        return record&&{tokenHash:record.token_hash};
    }
    async saveMember(tx:Transaction,scopeId:string,actor:string,manage:boolean,active:boolean,revision:number):Promise<void> {
        await write(tx,'INSERT INTO scope_members(scope_id,actor_id,can_manage,active,revision) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE can_manage=VALUES(can_manage),active=VALUES(active),revision=VALUES(revision)',[scopeId,actor,manage,active,revision]);
    }
    async audit(tx:Transaction,id:string,scopeId:string,actor:string,subject:string,kind:string,revision:number,at:number,details:unknown):Promise<void> {
        await write(tx,'INSERT INTO access_events(id,scope_id,actor_id,subject_id,kind,revision,created_at,details) VALUES(?,?,?,?,?,?,?,?)',[id,scopeId,actor,subject,kind,revision,at,JSON.stringify(details)]);
    }
    async listMembers(tx:Transaction,scopeId:string):Promise<IdentityListedMember[]> {
        const records=await rows<{actor_id:string;can_manage:number;active:number;revision:number;owner_id:string}>(tx,'SELECT m.*,s.owner_id FROM scope_members m JOIN scopes s ON s.id=m.scope_id WHERE m.scope_id=? ORDER BY m.actor_id',[scopeId]);
        return records.map(record=>({actorId:record.actor_id,canManage:record.can_manage,active:record.active,revision:record.revision,ownerId:record.owner_id}));
    }
    async scopeContext(tx:Transaction,actorId:string,window:IdentityScopeContextWindow):Promise<IdentityScopeContextRecord[]> {
        if(!Number.isSafeInteger(window.limit)||window.limit<1||window.limit>100)
            throw new ControlError('INTEGRITY_FAILURE',409,'Invalid bounded Scope context window');
        const records=await rows<{scope_id:string;owner_id:string;actor_id:string|null;revision:number|null;active:number|null;can_manage:number|null}>(tx,
            `SELECT s.id scope_id,s.owner_id,m.actor_id,m.revision,m.active,m.can_manage
             FROM scopes s LEFT JOIN scope_members m ON m.scope_id=s.id AND m.actor_id=?
             WHERE (s.owner_id=? OR m.active=TRUE)${window.after===null?'':' AND s.id>?'}
             ORDER BY s.id COLLATE ascii_bin LIMIT ${window.limit+1}`,
            [actorId,actorId,...(window.after===null?[]:[window.after])]);
        return records.map(record=>({scopeId:record.scope_id,ownerId:record.owner_id,
            membership:record.actor_id===null?null:{actorId:record.actor_id,revision:record.revision!,active:record.active!,canManage:record.can_manage!}}));
    }
}

export class MySqlIdentityAccountLookup implements IdentityAccountLookup {
    private readonly db:Pick<MySqlUnitOfWork,'pool'>;
    constructor(db:Pick<MySqlUnitOfWork,'pool'>){this.db=db;}
    async byToken(hash:string):Promise<{id:string}|undefined> {
        return (await rows<{id:string}>(this.db.pool,'SELECT id FROM accounts WHERE token_hash=?',[hash]))[0];
    }
}
