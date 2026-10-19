import { ControlError, notFound } from './errors.ts';
import type { IdentityAccess, IdentityAccessOptions } from './identity-access-ports.ts';

/** Common bearer/Scope checks; membership command policy remains with its owner. */
export class IdentityAccessHost<Tx> implements IdentityAccess<Tx> {
    protected readonly store:IdentityAccessOptions<Tx>['store'];
    protected readonly accounts:IdentityAccessOptions<Tx>['accounts'];
    protected readonly secrets:IdentityAccessOptions<Tx>['secrets'];
    protected readonly codec:IdentityAccessOptions<Tx>['codec'];
    constructor(options:IdentityAccessOptions<Tx>) {
        this.store=options.store;this.accounts=options.accounts;this.secrets=options.secrets;this.codec=options.codec;
    }
    async authenticate(header:string|undefined):Promise<string> {
        return this.authenticateUsing(header,hash=>this.accounts.byToken(hash));
    }
    async authenticateIn(tx:Tx,header:string|undefined):Promise<string> {
        return this.authenticateUsing(header,hash=>this.store.accountByToken(tx,hash));
    }
    private async authenticateUsing(header:string|undefined,lookup:(hash:string)=>Promise<{id:string}|undefined>):Promise<string> {
        const token=this.codec.bearer(header);
        const account=token?await lookup(this.secrets.tokenHash(token)):undefined;
        if(!account)throw new ControlError('UNAUTHENTICATED',401,'Valid bearer identity required');
        return account.id;
    }
    async scope(tx:Tx,actorId:string,scopeId:string,manage=false):Promise<void> {
        const member=await this.store.activeMembership(tx,scopeId,actorId);
        if(!member)notFound();
        if(manage&&!member.canManage)throw new ControlError('AUTHORIZATION_DENIED',403,'Scope management permission required');
    }
    async owner(tx:Tx,actorId:string,scopeId:string):Promise<void> {
        await this.scope(tx,actorId,scopeId,true);
        const scope=await this.store.ownerForShare(tx,scopeId);
        if(scope?.ownerId!==actorId)throw new ControlError('AUTHORIZATION_DENIED',403,'Scope owner permission required');
    }
    async executing(tx:Tx,actorId:string,scopeId:string):Promise<boolean> {
        return await this.store.executionMembershipCount(tx,scopeId,actorId)===1;
    }
}
