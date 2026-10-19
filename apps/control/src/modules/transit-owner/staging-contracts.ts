import type { Forward } from '@tunex/core';
import type { TransactionBoundary, RuntimeRelayNodes, TransitStagingStorage, RuntimeReservationReleaseAccess } from '../../framework/public.ts';
import type { ForwardStateOwner } from '../forward-owner/public.ts';
import type { TransportProfileResolver } from '../transport-owner/public.ts';
import type { RelayEndpointResolver } from '../relay-endpoint-owner/public.ts';
import type { TransitResource, ReservedTransitResource, TransitPreparation } from './preparation-contracts.ts';

export interface TransitReservationAccess<Tx> {
    reserve(tx:Tx,forward:Forward,resources:readonly TransitResource[],generation:number):Promise<readonly ReservedTransitResource[]>;
}
export interface TransitStagingApi {
    stage(actor:string,scopeId:string,forwardId:string,expectedRevision:number):Promise<TransitPreparation>;
    abort(actor:string,scopeId:string,forwardId:string,generation:number):Promise<boolean>;
}
export interface TransitStagingOptions<Tx> {
    readonly db:TransactionBoundary<Tx>;
    readonly store:TransitStagingStorage<Tx>;
    readonly nodes:Pick<RuntimeRelayNodes<Tx>,'authorizedRelayNode'|'facts'|'relayCredentialFacts'>;
    readonly forwarding:Pick<ForwardStateOwner<Tx>,'currentForUpdate'|'authorizer'>;
    readonly transport:TransportProfileResolver<Tx>;
    readonly endpoints:RelayEndpointResolver<Tx>;
    readonly reservations:TransitReservationAccess<Tx>;
    readonly release:RuntimeReservationReleaseAccess<Tx>;
}
