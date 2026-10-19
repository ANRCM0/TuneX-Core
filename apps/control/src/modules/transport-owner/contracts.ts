import type { RequestIdentity, TransactionBoundary, ScopeAuthorization,
    ScopeOwnerAuthorization, IdempotentRequests, TransportProfileStore } from '../../framework/public.ts';
import type { NativeRuntimeRelayProfile as RuntimeRelayProfile, NativeRuntimeRelayTransport as RuntimeRelayTransport,
    NativeRelayConfigurationCodec as RelayConfigurationCodec } from '../../compatibility/public.ts';
import type { ProfileForwardReferences } from '../forward-owner/public.ts';
export type { NativeRuntimeRelayProfile as ResolvedProfile } from '../../compatibility/public.ts';

export interface TransportProfileResolver<Tx> extends RuntimeRelayTransport<Tx> {}
export interface TransportGrantCommand {
    readonly actorId:string;readonly scopeId:string;readonly profileId:string;readonly subject:string;
    readonly expectedRevision:number;readonly allowed:boolean;
}
export interface TransportGrantState {
    readonly profileId:string;readonly actorId:string;readonly revision:number;readonly allowed:boolean;readonly changed:boolean;
}
/** Owner mutation only; the application must reconcile effects before committing. */
export interface TransportGrantWriter<Tx> { applyGrant(tx:Tx,command:TransportGrantCommand):Promise<TransportGrantState> }
export interface TransportGrantEffects<Tx> { reconcile(tx:Tx,request:RequestIdentity,grant:TransportGrantState):Promise<string[]> }

export interface TransportPublishResponse {status:200|202;body:{profileId:string;revision:number;configDigest:string;changed:boolean}}
export interface TransportProfileView extends RuntimeRelayProfile {currentRevision:number;createdBy:string;createdAt:string;executionSupported:boolean}
export interface TransportApi {
    publish(actor:string,scopeId:string,profileId:string,key:string|undefined,expectedRevision:number,input:unknown):Promise<TransportPublishResponse>;
    get(actor:string,scopeId:string,profileId:string,requestedRevision?:number):Promise<TransportProfileView>;
    list(actor:string,scopeId:string):Promise<{profiles:{profileId:string;currentRevision:number}[];executionSupported:boolean}>;
    grants(actor:string,scopeId:string,profileId:string):Promise<{profileId:string;revision:number;actorIds:string[]}>;
}
export interface TransportOwner<Tx> extends TransportApi,TransportProfileResolver<Tx>,TransportGrantWriter<Tx> {}
export interface TransportOptions<Tx> {
    readonly db:TransactionBoundary<Tx>;
    readonly identity:ScopeAuthorization<Tx>&ScopeOwnerAuthorization<Tx>;
    readonly idempotency:IdempotentRequests<Tx>;
    readonly forwarding:Pick<ProfileForwardReferences<Tx>,'hasLiveRelay'>;
    readonly store:TransportProfileStore<Tx>;
    readonly codec:RelayConfigurationCodec;
    readonly now:()=>number;
    readonly newID:()=>string;
}
