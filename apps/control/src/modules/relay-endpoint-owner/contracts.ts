import type { RuntimeRelayEndpoint, RuntimeRelayEndpointResolver, TransactionBoundary, ScopeAuthorization,
    ScopeOwnerAuthorization, IdempotentRequests, RelayEndpointStore } from '../../framework/public.ts';
import type { NativeRelayConfigurationCodec as RelayConfigurationCodec } from '../../compatibility/public.ts';
import type { RelayEndpointNodeAccess } from '../node-owner/public.ts';
import type { RelayForwardReferences } from '../forward-owner/public.ts';
export type { RuntimeRelayEndpointConfig as RelayEndpoint, RuntimeRelayEndpoint as ResolvedEndpoint } from '../../framework/public.ts';

export interface RelayEndpointResolver<Tx> extends RuntimeRelayEndpointResolver<Tx> {}
export interface RelayEndpointResponse {status:200|202;body:{nodeId:string;revision:number;changed:boolean}}
export interface RelayEndpointView extends RuntimeRelayEndpoint {executionSupported:boolean}
export interface RelayEndpointApi {
    change(actor:string,scopeId:string,nodeId:string,key:string|undefined,expectedRevision:number,input:unknown):Promise<RelayEndpointResponse>;
    get(actor:string,scopeId:string,nodeId:string):Promise<RelayEndpointView>;
}
export interface RelayEndpointOwner<Tx> extends RelayEndpointApi,RelayEndpointResolver<Tx> {}
export interface RelayEndpointOptions<Tx> {
    readonly db:TransactionBoundary<Tx>;
    readonly identity:ScopeAuthorization<Tx>&ScopeOwnerAuthorization<Tx>;
    readonly nodes:RelayEndpointNodeAccess<Tx>;
    readonly idempotency:IdempotentRequests<Tx>;
    readonly forwarding:RelayForwardReferences<Tx>;
    readonly store:RelayEndpointStore<Tx>;
    readonly codec:RelayConfigurationCodec;
    readonly now:()=>number;
}
