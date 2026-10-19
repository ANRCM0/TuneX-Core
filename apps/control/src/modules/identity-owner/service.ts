import { IdentityAccessHost, ControlError, invalid } from '../../framework/public.ts';
import type { IdentityModuleOptions, IdentityOwner, IdentityMemberView, IdentityMemberChange, RecoveryIdentity } from './contracts.ts';

/** The original identity owner, with storage/native effects supplied by composition. */
export class IdentityService<Tx> extends IdentityAccessHost<Tx> implements IdentityOwner<Tx> {
    private readonly db:IdentityModuleOptions<Tx>['db'];
    private readonly now:IdentityModuleOptions<Tx>['now'];
    constructor(options:IdentityModuleOptions<Tx>) {super(options);this.db=options.db;this.now=options.now;}
    async quarantineRecovery(tx:Tx):Promise<RecoveryIdentity[]> {
        const accounts=await this.store.recoveryAccounts(tx),credentials:RecoveryIdentity[]=[];
        for(const account of accounts){const token=this.secrets.newToken();await this.store.replaceToken(tx,account.id,this.secrets.tokenHash(token));credentials.push({actorId:account.id,token,owner:Boolean(account.owner)});}
        await this.store.deactivateNonOwners(tx);return credentials;
    }
    async bootstrap(scopeId:string,actorId:string,token:string):Promise<void> {
        if(!this.codec.isId(scopeId)||!this.codec.isId(actorId)||!this.codec.validBearer(token))throw new Error('Bootstrap requires valid IDs and a random bearer token');
        await this.db.transaction(async tx=>{
            await this.store.insertAccount(tx,actorId,this.secrets.tokenHash(token));
            await this.store.createScope(tx,scopeId,actorId);
            await this.store.addOwner(tx,scopeId,actorId);
        });
    }
    async changeMember(tx:Tx,owner:string,scopeId:string,subject:string,expectedRevision:number,role:'manager'|'viewer'|'removed',token?:string):Promise<IdentityMemberChange> {
        if(!this.codec.isId(subject)||!this.codec.isCounter(expectedRevision,true)||!['manager','viewer','removed'].includes(role)||token!==undefined&&!this.codec.validBearer(token))
            invalid('Valid member ID, expectedRevision, role and optional bearer token required');
        await this.owner(tx,owner,scopeId);
        const scope=(await this.store.ownerForUpdate(tx,scopeId))!;
        if(subject===scope.ownerId)throw new ControlError('OWNER_PROTECTED',409,'The scope owner cannot be removed or demoted');
        const current=await this.store.memberForUpdate(tx,scopeId,subject);
        if((current?.revision??0)!==expectedRevision)throw new ControlError('REVISION_CONFLICT',409,'Member revision conflict');
        const account=await this.store.accountForShare(tx,subject);
        if(!account){
            if(!token||role==='removed')invalid('New accounts require a bearer token and active role');
            await this.store.insertMemberAccount(tx,subject,this.secrets.tokenHash(token));
        }else if(token&&account.tokenHash!==this.secrets.tokenHash(token))throw new ControlError('ACCOUNT_CONFLICT',409,'Existing account credential cannot be replaced by a membership command');
        const active=role!=='removed',manage=role==='manager';
        const changed=!current||Boolean(current.active)!==active||Boolean(current.canManage)!==manage;
        const revision=changed?expectedRevision+1:expectedRevision;
        if(revision>this.codec.maxRevision)throw new ControlError('REVISION_EXHAUSTED',409,'Member revision exhausted');
        if(changed){
            await this.store.saveMember(tx,scopeId,subject,manage,active,revision);
            await this.audit(tx,scopeId,owner,subject,'member_change',revision,{role});
        }
        return {actorId:subject,revision,role,active,changed};
    }
    async audit(tx:Tx,scopeId:string,actor:string,subject:string,kind:'member_change'|'node_grant_change',revision:number,details:unknown):Promise<void> {
        await this.store.audit(tx,this.secrets.newID(),scopeId,actor,subject,kind,revision,this.now(),details);
    }
    async listMembers(actor:string,scopeId:string):Promise<{members:IdentityMemberView[]}> {
        return this.db.transaction(async tx=>{
            await this.owner(tx,actor,scopeId);
            const members=await this.store.listMembers(tx,scopeId);
            return {members:members.map(m=>({actorId:m.actorId,revision:m.revision,active:Boolean(m.active),role:m.actorId===m.ownerId?'owner':!m.active?'removed':m.canManage?'manager':'viewer'}))};
        });
    }
}
