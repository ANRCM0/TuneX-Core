import { TransitStagingService, TransitReservations } from '../transit-owner/public.ts';
import type { TransitPreparation } from '../transit-owner/public.ts';
import type { MySqlUnitOfWork, Transaction } from '../../infrastructure/mysql.ts';
import { MySqlTransitStagingStore } from '../../infrastructure/mysql-transit-staging-store.ts';
import { createMySqlExclusiveReservations, createMySqlReservationRelease, MySqlRuntimeResourceStore } from '../../infrastructure/mysql-runtime-resources.ts';
import { MySqlNodeAuthorityStore } from '../../infrastructure/mysql-node-authority.ts';
import { NodePortLimitPolicy } from '../node-owner/public.ts';
import { SharedResourceLimitPublicationPolicy } from '../resource-limit-owner/public.ts';
import { MySqlSharedResourceLimitStore } from '../../infrastructure/mysql-resource-limits.ts';
import { nativeIsoTime } from '../../compatibility/public.ts';
import type { Nodes } from '../nodes.ts';
import type { ForwardStateOwner } from '../forward-owner/public.ts';
import type { TransportProfileResolver } from '../transport-owner/public.ts';
import type { RelayEndpointResolver } from '../relay-endpoint-owner/public.ts';
import type { TransitStoredStage } from '../../framework/public.ts';

export interface TransitStageRow extends TransitStoredStage {}
export { verifyTransitStage } from '../transit-owner/public.ts';

/** Legacy five-argument construction over the one offline staging owner. */
export class TransitStagingCoordinator {
  private readonly db:MySqlUnitOfWork;
  private readonly nodes:Nodes;
  private readonly forwarding:ForwardStateOwner<Transaction>;
  private readonly transport:TransportProfileResolver<Transaction>;
  private readonly endpoints:RelayEndpointResolver<Transaction>;
  private readonly staging:TransitStagingService<Transaction>;
  constructor(db:MySqlUnitOfWork,nodes:Nodes,forwarding:ForwardStateOwner<Transaction>,
    transport:TransportProfileResolver<Transaction>,endpoints:RelayEndpointResolver<Transaction>) {
    this.db=db;this.nodes=nodes;this.forwarding=forwarding;
    this.transport=transport;this.endpoints=endpoints;
    this.staging=new TransitStagingService<Transaction>({
      db:{transaction:action=>this.db.transaction(action)},
      store:new MySqlTransitStagingStore(),
      nodes:{
        authorizedRelayNode:(tx,actor,scope,node,role,forward)=>this.nodes.authorizedRelayNode(tx,actor,scope,node,role,forward),
        reservationPorts:(tx,actor,scope,node,ports)=>this.nodes.reservationPorts(tx,actor,scope,node,ports),
        facts:(tx,node)=>this.nodes.facts(tx,node),
        relayCredentialFacts:(tx,node,currentOnly)=>this.nodes.relayCredentialFacts(tx,node,currentOnly)},
      forwarding:{
        currentForUpdate:(tx,scope,forward)=>this.forwarding.currentForUpdate(tx,scope,forward),
        authorizer:(tx,forward)=>this.forwarding.authorizer(tx,forward)},
      transport:{resolve:(tx,actor,scope,profile,revision)=>this.transport.resolve(tx,actor,scope,profile,revision)},
      endpoints:{resolve:(tx,node)=>this.endpoints.resolve(tx,node)},
      reservations:new TransitReservations(createMySqlExclusiveReservations(new NodePortLimitPolicy(new MySqlNodeAuthorityStore(),new MySqlRuntimeResourceStore()))),
      release:createMySqlReservationRelease(),
      payloadPolicy:new SharedResourceLimitPublicationPolicy({nodes:new MySqlNodeAuthorityStore(),owners:new MySqlRuntimeResourceStore(),
        store:new MySqlSharedResourceLimitStore(),codec:{formatTime:nativeIsoTime}})});
  }
  async stage(actor:string,scopeId:string,forwardId:string,expectedRevision:number):Promise<TransitPreparation> {
    return this.staging.stage(actor,scopeId,forwardId,expectedRevision);
  }
  async abort(actor:string,scopeId:string,forwardId:string,generation:number):Promise<boolean> {
    return this.staging.abort(actor,scopeId,forwardId,generation);
  }
}
