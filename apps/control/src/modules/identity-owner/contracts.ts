import type { IdentityAccess, IdentityAccessOptions, NodeScopeAuthority, TransactionBoundary } from '../../framework/public.ts';

export interface MemberChangeInput {
    readonly expectedRevision:number;
    readonly role:'manager'|'viewer'|'removed';
    readonly token?:string;
}
export interface MemberChangeState {
    readonly actorId:string;
    readonly revision:number;
    readonly role:string;
    readonly active:boolean;
    readonly changed:boolean;
}
export interface IdentityMemberChange { actorId:string;revision:number;role:string;active:boolean;changed:boolean }
export interface MemberWriter<Tx> {
    changeMember(tx:Tx,owner:string,scopeId:string,subject:string,expectedRevision:number,role:MemberChangeInput['role'],token?:string):Promise<MemberChangeState>;
}
export interface IdentityMemberView { actorId:string;revision:number;active:boolean;role:string }
export interface RecoveryIdentity { actorId:string;token:string;owner:boolean }

/** Independent user HTTP surface; it does not expose a concrete class or transaction. */
export interface IdentityQueries {
    authenticate(header:string|undefined):Promise<string>;
    listMembers(actor:string,scopeId:string):Promise<{members:IdentityMemberView[]}>;
}
export interface IdentityOwner<Tx> extends IdentityQueries, IdentityAccess<Tx>, NodeScopeAuthority<Tx>, MemberWriter<Tx> {
    bootstrap(scopeId:string,actorId:string,token:string):Promise<void>;
    quarantineRecovery(tx:Tx):Promise<RecoveryIdentity[]>;
    audit(tx:Tx,scopeId:string,actor:string,subject:string,kind:'member_change'|'node_grant_change',revision:number,details:unknown):Promise<void>;
    changeMember(tx:Tx,owner:string,scopeId:string,subject:string,expectedRevision:number,role:MemberChangeInput['role'],token?:string):Promise<IdentityMemberChange>;
}
export interface IdentityModuleOptions<Tx> extends IdentityAccessOptions<Tx> {
    readonly db:TransactionBoundary<Tx>;
    readonly now:()=>number;
}
