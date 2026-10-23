import type { ScopeAuthorization, ScopeOwnerAuthorization } from './application-ports.ts';
import type { NodeSecrets } from './node-authority-ports.ts';

export const IDENTITY_ACCESS_INTERFACE_VERSION=2 as const;

export interface IdentityMembershipRecord { revision:number; active:number; canManage:number }
export interface IdentityListedMember extends IdentityMembershipRecord { actorId:string; ownerId:string }
export interface IdentityScopeContextWindow { readonly after:string|null; readonly limit:number }
export interface IdentityScopeContextRecord {
    readonly scopeId:string;
    readonly ownerId:string;
    readonly membership:({readonly actorId:string}&IdentityMembershipRecord)|null;
}

/** Storage effects only; each locked read/mutation uses the caller's transaction. */
export interface IdentityAccessStore<Tx> {
    recoveryAccounts(tx:Tx):Promise<{id:string;owner:number}[]>;
    replaceToken(tx:Tx,actorId:string,hash:string):Promise<void>;
    deactivateNonOwners(tx:Tx):Promise<void>;
    insertAccount(tx:Tx,actorId:string,hash:string):Promise<void>;
    insertMemberAccount(tx:Tx,actorId:string,hash:string):Promise<void>;
    createScope(tx:Tx,scopeId:string,owner:string):Promise<void>;
    addOwner(tx:Tx,scopeId:string,owner:string):Promise<void>;
    accountByToken(tx:Tx,hash:string):Promise<{id:string}|undefined>;
    activeMembership(tx:Tx,scopeId:string,actor:string):Promise<{canManage:number}|undefined>;
    ownerForShare(tx:Tx,scopeId:string):Promise<{ownerId:string}|undefined>;
    ownerForUpdate(tx:Tx,scopeId:string):Promise<{ownerId:string}|undefined>;
    executionMembershipCount(tx:Tx,scopeId:string,actor:string):Promise<number>;
    memberForUpdate(tx:Tx,scopeId:string,actor:string):Promise<IdentityMembershipRecord|undefined>;
    accountForShare(tx:Tx,actor:string):Promise<{tokenHash:string}|undefined>;
    saveMember(tx:Tx,scopeId:string,actor:string,manage:boolean,active:boolean,revision:number):Promise<void>;
    audit(tx:Tx,id:string,scopeId:string,actor:string,subject:string,kind:string,revision:number,at:number,details:unknown):Promise<void>;
    listMembers(tx:Tx,scopeId:string):Promise<IdentityListedMember[]>;
    /** Current actor membership or owned Scopes, binary ID order, at most limit + 1 records. */
    scopeContext(tx:Tx,actorId:string,window:IdentityScopeContextWindow):Promise<IdentityScopeContextRecord[]>;
}

/** The existing pool-backed bearer lookup is separate from transaction operations. */
export interface IdentityAccountLookup { byToken(hash:string):Promise<{id:string}|undefined> }

export interface IdentityValueCodec {
    bearer(header:string|undefined):string|undefined;
    validBearer(value:unknown):value is string;
    isId(value:unknown):boolean;
    isCounter(value:unknown,allowZero?:boolean):boolean;
    readonly maxRevision:number;
}

export interface IdentityAccess<Tx> extends ScopeAuthorization<Tx>, ScopeOwnerAuthorization<Tx> {
    authenticate(header:string|undefined):Promise<string>;
    authenticateIn(tx:Tx,header:string|undefined):Promise<string>;
    executing(tx:Tx,actor:string,scopeId:string):Promise<boolean>;
}

export interface IdentityAccessOptions<Tx> {
    readonly store:IdentityAccessStore<Tx>;
    readonly accounts:IdentityAccountLookup;
    readonly secrets:NodeSecrets;
    readonly codec:IdentityValueCodec;
}
