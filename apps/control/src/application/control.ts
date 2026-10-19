import { RelayEndpoints } from '../modules/relay-endpoints.ts';
import { Transport } from '../modules/transport.ts';
import type { TransportOwner } from '../modules/transport-owner/public.ts';
import type { RelayEndpointOwner } from '../modules/relay-endpoint-owner/public.ts';
import { randomUUID } from 'node:crypto';
import type { Forward } from '@tunex/core';
import type { Policy } from '@tunex/contracts/policy';
import { ControlError } from '../framework/public.ts';
import type { RuntimeResourceAccess } from '../framework/public.ts';
import type { MySqlUnitOfWork, Transaction } from '../infrastructure/mysql.ts';
import type { IdentityOwner } from '../modules/identity-owner/public.ts';
import type { Nodes } from '../modules/nodes.ts';
import { Forwarding } from '../modules/forwarding.ts';
import type { ForwardStateOwner } from '../modules/forward-owner/public.ts';
import type { IdempotencyService } from '../framework/public.ts';
import { Idempotency } from '../modules/idempotency.ts';
import type { ForwardAccepted as Accepted } from '../modules/forward-owner/public.ts';
import { RuntimeLedger } from '../modules/runtime/ledger.ts';
import { RelayCoordinator } from '../modules/runtime/relay-coordinator.ts';
import type { NodeManagementCommand } from '../modules/node-owner/public.ts';
import { ConsoleQueries, ConsoleReadModels, validateConsoleFilters } from '../modules/console-query-owner/public.ts';
import { TransportReferenceReadModels } from '../modules/transport-owner/public.ts';
import { TunnelReadModels } from '../modules/tunnel-query-owner/public.ts';
import { nativeReadProjectionValues } from '../compatibility/public.ts';
import { MySqlManagementReadStore, MySqlProfileReferenceReadStore, MySqlTunnelMetadataReadStore } from '../infrastructure/mysql-management-read.ts';
import { TransportGrantCommands } from '../modules/transport-owner/public.ts';
import { ProfileGrantReconciler } from '../modules/transport-owner/public.ts';
import { AccessCommands } from '../modules/identity-owner/public.ts';
import { AccessChangeReconciler } from '../modules/identity-owner/public.ts';
import type { ForwardAuthorizationExecution } from '../modules/forward-owner/public.ts';
import type { MemberChangeInput } from '../modules/identity-owner/public.ts';
import type { MemberChangeResponse, NodeGrantResponse } from '../modules/identity-owner/public.ts';
import { NodeManagementCommands } from '../modules/node-owner/public.ts';
import type { NodeChangeResponse } from '../modules/node-owner/public.ts';
import { NodeChangeReconciler } from '../modules/node-owner/public.ts';
import { ForwardCommands } from '../modules/forward-owner/public.ts';
import { ForwardCommandExecutor } from '../modules/forward-owner/public.ts';
import { SnapshotAssignmentRegistry, RelayAssignmentSource } from '../modules/forward-owner/public.ts';
import { DEFAULT_POLICY } from '@tunex/contracts/shared';
import { NodeObservations } from '../modules/node-observation-owner/public.ts';
import { RelayPlans } from '../modules/relay-plan-owner/public.ts';
import { MySqlNodeObservationReader } from '../infrastructure/mysql-node-observation.ts';
import { ForwardProbePlans } from '../modules/probe-owner/public.ts';
import { MySqlProbeReader } from '../infrastructure/mysql-probe-read.ts';
import { ProbeNegotiator } from '../modules/probe-owner/public.ts';
import { MySqlProbeMachineReader } from '../infrastructure/mysql-probe-machine.ts';
import { ProbeInstances } from '../modules/probe-owner/public.ts';
import { MySqlProbeInstanceStore } from '../infrastructure/mysql-probe-instance-store.ts';
import { probeInstanceStorageValues } from '../modules/probe-owner/public.ts';
import { ProbeInstanceRegistry } from '../modules/probe-owner/public.ts';
import { ProbePermits } from '../modules/probe-owner/public.ts';
import { ProbeClaims } from '../modules/probe-owner/public.ts';
import { ProbeDelivery } from '../modules/probe-owner/public.ts';
import { ProbeResults } from '../modules/probe-owner/public.ts';
import { MySqlProbePermitStore } from '../infrastructure/mysql-probe-permit-store.ts';
import { probePermitStorageValues } from '../modules/probe-owner/public.ts';
import { MySqlProbePermitIntents } from '../infrastructure/mysql-probe-permit-intents.ts';
import { ProbeRunHistoryRecorder } from '../modules/probe-history-owner/public.ts';
import { MySqlProbeHistoryStore } from '../infrastructure/mysql-probe-history-store.ts';
import { probeRunStorageValues } from '../modules/probe-history-owner/public.ts';
import { MySqlProbeQualificationStore } from '../infrastructure/mysql-probe-qualification-store.ts';
import { probeQualificationStorageValues } from '../modules/probe-owner/public.ts';
import { ProbeTypeRegistry, ProbeServiceRegistry } from '../modules/probe-owner/public.ts';
import { ProbeTypes } from '../modules/probe-owner/public.ts';
import { ProbeServices } from '../modules/probe-owner/public.ts';
import { ProbeObservationServices } from '../modules/probe-owner/public.ts';
import { MySqlObservationServiceStore } from '../infrastructure/mysql-observation-service-store.ts';
import { observationServiceStorageValues } from '../modules/observation-service-owner/public.ts';
import { ForwardProbes } from '../modules/probe-owner/public.ts';
import { NativeDrivers } from '../modules/native-driver-owner/public.ts';
import { TransportQueries } from '../modules/transport-owner/public.ts';
import { TunnelQueries } from '../modules/tunnel-query-owner/public.ts';
import { PathTemplateCommands, PathTemplateQueries } from '../modules/path-owner/public.ts';
import { MySqlPathTemplateStore } from '../infrastructure/mysql-path-template-store.ts';
import type { PathTemplateConfig, PathGroupConfig } from '../modules/path-owner/public.ts';
import { NativePathReferences } from '../modules/path-owner/public.ts';
import { PathBindings } from '../modules/path-owner/public.ts';
import { MySqlPathBindingStore } from '../infrastructure/mysql-path-binding-store.ts';
import { NativeTunnels } from '../modules/native-tunnel-owner/public.ts';
import { PathGroups } from '../modules/path-owner/public.ts';
import { MySqlPathGroupStore, MySqlPathGroupBindingStore } from '../infrastructure/mysql-path-group-store.ts';
import { PathPublications } from '../modules/path-owner/public.ts';
import { MySqlPathPublicationStore } from '../infrastructure/mysql-publication-store.ts';
import { pathPublicationStorageValues } from '../modules/path-owner/public.ts';
import type { PathPublicationPlan, PathPublicationAttempt, PathPublicationFailure } from '../modules/path-owner/public.ts';
import { IngressGroups, IngressDeployments, IngressMigrations } from '../modules/ingress-owner/public.ts';
import { MySqlIngressGroupStore } from '../infrastructure/mysql-ingress-group-store.ts';
import type { IngressGroupConfig, IngressPlan, IngressAttempt, IngressMigrationPlan, IngressMigrationAttempt } from '../modules/ingress-owner/public.ts';
import { ingressDeploymentStorageValues, ingressMigrationStorageValues } from '../modules/ingress-owner/public.ts';
import { MySqlIngressDeploymentStore } from '../infrastructure/mysql-ingress-deployment-store.ts';
import { MySqlIngressMigrationStore } from '../infrastructure/mysql-ingress-migration-store.ts';
import { ControlQueries } from '../modules/control-query-owner/public.ts';
import { MySqlRuntimeStatusStore } from '../infrastructure/mysql-runtime-status-store.ts';
import { RuntimeStatusQueries } from '../modules/runtime-status-owner/public.ts';
import { nativeRuntimeStatusCodec } from '../compatibility/public.ts';
import { TransitNegotiationService } from '../modules/transit-owner/public.ts';
import type { TransitNegotiationApi } from '../modules/transit-owner/public.ts';
import { MySqlTransitMachineReader } from '../infrastructure/mysql-transit-machine.ts';
import { TransitPreviewDelivery } from '../modules/transit-owner/public.ts';
import { TransitCoordinationService } from '../modules/transit-owner/public.ts';
import type { TransitCoordinationPhase } from '../modules/transit-owner/public.ts';
import { MySqlTransitCoordinationStore } from '../infrastructure/mysql-transit-coordination-store.ts';
import { MySqlTransitDeliveryStore } from '../infrastructure/mysql-transit-delivery-store.ts';
import type { RelayPlanApi } from '../modules/relay-plan-owner/public.ts';
/** Coordinates owner-owned commands inside one durable acceptance transaction. */
export class ControlApplication implements RelayPlanApi {
    readonly forwarding:ForwardStateOwner<Transaction> = new Forwarding();
    readonly transport:TransportOwner<Transaction>;
    readonly relayEndpoints:RelayEndpointOwner<Transaction>;
    readonly ledger: RuntimeLedger;
    readonly idempotency:IdempotencyService<Transaction,Accepted> = new Idempotency();
    readonly db: MySqlUnitOfWork;
    readonly identity: IdentityOwner<Transaction>;
    readonly nodes: Nodes;
    readonly relay: RelayCoordinator;
    readonly relayPlans: RelayPlans<Transaction>;
    readonly queries: ConsoleQueries<Transaction>;
    readonly details:ControlQueries<Transaction>;
    readonly transitNegotiation:TransitNegotiationApi;
    readonly transitDelivery:TransitPreviewDelivery<Transaction>;
    readonly nativeDrivers: NativeDrivers<Transaction>;
    readonly transportQueries: TransportQueries<Transaction>;
    readonly tunnelQueries: TunnelQueries<Transaction>;
    readonly pathTemplates: PathTemplateCommands<Transaction>;
    readonly pathTemplateQueries: PathTemplateQueries<Transaction>;
    readonly pathBindings: PathBindings<Transaction>;
    readonly tunnels: NativeTunnels<Transaction>;
    readonly pathGroups: PathGroups<Transaction>;
    readonly pathPublications: PathPublications<Transaction>;
    readonly ingressGroups: IngressGroups<Transaction>;
    readonly ingressDeployments: IngressDeployments<Transaction>;
    readonly ingressMigrations: IngressMigrations<Transaction>;
    readonly observations: NodeObservations;
    readonly probePlans: ForwardProbePlans<Transaction>;
    readonly probeTypeRegistry:ProbeTypeRegistry<Transaction>;
    readonly probeTypes:ProbeTypes<Transaction>;
    readonly probeServiceRegistry:ProbeServiceRegistry<Transaction>;
    readonly probeServices:ProbeServices<Transaction>;
    readonly probeNegotiation: ProbeNegotiator<Transaction>;
    readonly probeInstances: ProbeInstances<Transaction>;
    readonly probeRegistry: ProbeInstanceRegistry<Transaction>;
    readonly probePermits: ProbePermits<Transaction>;
    readonly probeClaims: ProbeClaims<Transaction>;
    readonly probeDelivery: ProbeDelivery<Transaction>;
    readonly probeResults: ProbeResults<Transaction>;
    readonly probes: ForwardProbes<Transaction>;
    readonly profileGrants: TransportGrantCommands<Transaction>;
    readonly access: AccessCommands<Transaction>;
    readonly nodeManagement: NodeManagementCommands<Transaction>;
    readonly forwards: ForwardCommands<Transaction>;
    constructor(db: MySqlUnitOfWork, identity: IdentityOwner<Transaction>, nodes: Nodes, policy?: Policy, multihopEnabled=false, probeExecutionEnabled=false,probeIngressEnabled=false,probeServicesEnabled=false,
        resources?:RuntimeResourceAccess<Transaction>) {
        this.db=db;this.identity=identity;this.nodes=nodes;
        this.queries=new ConsoleQueries(db,identity,new ConsoleReadModels(
            new MySqlManagementReadStore({now:nativeReadProjectionValues.now,validateFilters:validateConsoleFilters}),nativeReadProjectionValues));
        this.transitNegotiation=new TransitNegotiationService(db,new MySqlTransitMachineReader());
        this.transitDelivery=new TransitPreviewDelivery(db,new MySqlTransitDeliveryStore(),
            new TransitCoordinationService(db,new MySqlTransitCoordinationStore<TransitCoordinationPhase>()));
        this.nativeDrivers=new NativeDrivers(db,identity,multihopEnabled,probeExecutionEnabled);
        this.tunnelQueries=new TunnelQueries(db,identity,new TunnelReadModels(new MySqlTunnelMetadataReadStore(),nativeReadProjectionValues));
        const observationPolicy=policy??DEFAULT_POLICY;
        this.observations=new NodeObservations(new MySqlNodeObservationReader(db,identity),{
            freshnessMs:observationPolicy.observationFreshnessSeconds*1000,
            clockSkewMs:observationPolicy.maxClockSkewSeconds*1000,
        });
        const probeObservationServices=new ProbeObservationServices(identity,new MySqlObservationServiceStore(observationServiceStorageValues));
        this.probePlans=new ForwardProbePlans(db,identity,this.forwarding,nodes,new MySqlProbeReader(),
            observationPolicy.maxClockSkewSeconds*1000,probeObservationServices);
        this.probeNegotiation=new ProbeNegotiator(db,new MySqlProbeMachineReader());
        this.probeInstances=new ProbeInstances(db,new MySqlProbeMachineReader(),new MySqlProbeInstanceStore(probeInstanceStorageValues));
        this.probeRegistry=new ProbeInstanceRegistry(this.probeInstances);
        const probeTypes=new MySqlProbeQualificationStore(probeQualificationStorageValues);
        this.probeTypeRegistry=new ProbeTypeRegistry(db,new MySqlProbeMachineReader(),new MySqlProbeInstanceStore(probeInstanceStorageValues),probeTypes);
        this.probeServiceRegistry=new ProbeServiceRegistry(db,new MySqlProbeMachineReader(),new MySqlProbeInstanceStore(probeInstanceStorageValues),probeTypes);
        this.probePermits=new ProbePermits(db,identity,
            new ForwardProbePlans(db,identity,new MySqlProbePermitIntents(),nodes,new MySqlProbeReader(true),
                observationPolicy.maxClockSkewSeconds*1000,probeObservationServices),
            new MySqlProbeMachineReader(),new MySqlProbeInstanceStore(probeInstanceStorageValues),new MySqlProbePermitStore(probePermitStorageValues),Date.now,new ProbeRunHistoryRecorder(new MySqlProbeHistoryStore(probeRunStorageValues)),probeTypes);
        this.probeClaims=new ProbeClaims(this.probePermits);
        this.probeDelivery=new ProbeDelivery(this.probePermits);
        this.probeResults=new ProbeResults(this.probePermits);
        this.probeTypes=new ProbeTypes(this.probePermits);
        this.probeServices=new ProbeServices(this.probePermits);
        this.probes=new ForwardProbes(db,identity,this.idempotency,this.probePermits,probeExecutionEnabled,probeIngressEnabled,probeServicesEnabled);
        // Sources are declared now and read only after the complete host/Relay assembly returns.
        const assignments=new SnapshotAssignmentRegistry<Transaction>([
            new RelayAssignmentSource({assignments:(tx,nodeId,includeAccepted)=>this.relay.assignments(tx,nodeId,includeAccepted)}),
        ]);
        this.ledger=new RuntimeLedger(policy,nodes,assignments,resources);
        this.transport=new Transport(db,identity,this.idempotency,this.forwarding);
        this.transportQueries=new TransportQueries(db,identity,new TransportReferenceReadModels(new MySqlProfileReferenceReadStore(),nativeReadProjectionValues),this.transport);
        this.relayEndpoints=new RelayEndpoints(db,identity,nodes,this.idempotency,this.forwarding);
        const pathStore=new MySqlPathTemplateStore<PathTemplateConfig>();
        const pathReferences=new NativePathReferences(nodes,this.transport,this.relayEndpoints);
        this.pathTemplates=new PathTemplateCommands(db,identity,this.idempotency,pathStore,pathReferences);
        this.pathTemplateQueries=new PathTemplateQueries(db,identity,pathStore);
        const bindingStore=new MySqlPathBindingStore();
        this.pathBindings=new PathBindings(db,identity,pathStore,pathReferences,bindingStore,this.forwarding);
        this.pathGroups=new PathGroups(db,identity,this.idempotency,new MySqlPathGroupStore<PathGroupConfig>(),pathStore,pathReferences,
            new MySqlPathGroupBindingStore(),this.forwarding,this.pathBindings,bindingStore);
        this.relay=new RelayCoordinator(nodes,this.forwarding,this.transport,this.relayEndpoints,this.ledger,policy,multihopEnabled);
        this.relayPlans=new RelayPlans(db,identity,this.relay);
        const execution:ForwardAuthorizationExecution<Transaction>={
            lock:(tx,forward)=>this.lockExecution(tx,forward),
            allowed:(tx,actor,forward)=>this.executionAllowed(tx,actor,forward),
            transition:(tx,actor,forward)=>this.transitionExecution(tx,actor,forward),
            accept:(tx,forward,request,kind)=>this.ledger.accept(tx,forward,request,kind),
            assertCapacity:(tx,forward)=>this.assertExecutionCapacity(tx,forward),
        };
        this.forwards=new ForwardCommands(db,identity,this.idempotency,this.forwarding,this.ledger,
            new ForwardCommandExecutor(nodes,this.ledger,{
                lockNodes:(tx,forward)=>this.relay.lockNodes(tx,forward),
                canExecute:(tx,actor,forward)=>this.relay.canExecute(tx,actor,forward),
                acceptPlan:async(tx,actor,forward)=>{await this.relay.acceptPlan(tx,actor,forward);},
            },execution),randomUUID,this.pathBindings,this.pathGroups,{
                current:async(tx,forward)=>({path:await this.pathBindings.currentIn(tx,forward),group:await this.pathGroups.currentIn(tx,forward)}),
                detachPath:(tx,forward)=>this.pathBindings.detachIn(tx,forward),
                authorizeRestoration:async(tx,actor,forward)=>{
                    if(!await this.executionAllowed(tx,actor,forward))throw new ControlError('AUTHORIZATION_DENIED',403,'Original restoration path is no longer authorized');
                },
            });
        this.pathPublications=new PathPublications(db,identity,this.idempotency,new MySqlPathPublicationStore<PathPublicationPlan,PathPublicationAttempt['outcome'],PathPublicationFailure>(pathPublicationStorageValues),this.forwards);
        this.ingressGroups=new IngressGroups(db,identity,this.idempotency,new MySqlIngressGroupStore<IngressGroupConfig>(),pathStore,pathReferences);
        this.ingressDeployments=new IngressDeployments(db,identity,this.idempotency,new MySqlIngressDeploymentStore<IngressPlan,IngressAttempt['outcome'],PathPublicationFailure>(ingressDeploymentStorageValues),this.ingressGroups,this.forwards);
        this.ingressMigrations=new IngressMigrations(db,identity,this.idempotency,new MySqlIngressMigrationStore<IngressMigrationPlan,IngressMigrationAttempt['outcome'],PathPublicationFailure>(ingressMigrationStorageValues),this.ingressGroups,{
            resolveIn:(tx,actor,scope,ref)=>ref.kind==='deployment'?this.ingressDeployments.originIn(tx,actor,scope,ref):this.ingressMigrations.originIn(tx,actor,scope,ref),
        },this.forwards);
        this.tunnels=new NativeTunnels(this.pathTemplateQueries,this.pathTemplates,this.pathBindings,this.forwards);
        this.profileGrants=new TransportGrantCommands(db,identity,this.idempotency,this.transport,
            new ProfileGrantReconciler(this.forwarding,execution));
        this.access=new AccessCommands(db,identity,nodes,this.idempotency,
            new AccessChangeReconciler(this.forwarding,{
                ...execution,
                nodeIDs:(tx,forward)=>this.relay.nodeIDs(tx,forward),
                maximumAuthorization:(tx,nodeId)=>this.ledger.maximumAuthorization(tx,nodeId),
                validateNode:async(tx,nodeId,scopeId,capacity)=>{
                    const facts=await nodes.cleanupFacts(tx,nodeId,scopeId);
                    if(capacity)await this.ledger.assertCapacity(tx,this.forwarding,facts);
                },
            }));
        this.nodeManagement=new NodeManagementCommands(db,identity,this.idempotency,nodes,
            new NodeChangeReconciler(this.forwarding,{
                ...execution,
                nodeIDs:(tx,forward)=>this.relay.nodeIDs(tx,forward),
                maximumAuthorization:(tx,nodeId)=>this.ledger.maximumAuthorization(tx,nodeId),
                denyIntent:(tx,operationId)=>this.ledger.denyIntent(tx,operationId),
                assertNodeCapacity:(tx,facts)=>this.ledger.assertCapacity(tx,this.forwarding,facts),
            }));
        this.details=new ControlQueries(db,identity,this.forwarding,new RuntimeStatusQueries(new MySqlRuntimeStatusStore(),nativeRuntimeStatusCodec,observationPolicy),this.ledger,this.relay,{
            multihopEnabled:this.relay.multihopEnabled,maxPathNodes:8,executionExtension:1,probeIssuanceEnabled:this.probes.enabled,
            probeIngressIssuanceEnabled:this.probes.ingressEnabled,probeServicesIssuanceEnabled:this.probes.servicesEnabled});
    }
    async planRelay(actorId:string,scopeId:string,input:unknown){
        return this.relayPlans.planRelay(actorId,scopeId,input);
    }
    private async executionAllowed(tx:Transaction,actor:string,forward:Forward):Promise<boolean>{return forward.spec.path?this.relay.canExecute(tx,actor,forward):this.nodes.canExecute(tx,actor,forward);}
    private async transitionExecution(tx:Transaction,actor:string,forward:Forward):Promise<void>{if(forward.spec.path)await this.relay.acceptPlan(tx,actor,forward);else await this.ledger.transition(tx,forward,forward);}
    private async lockExecution(tx:Transaction,forward:Forward):Promise<void>{await this.relay.lockNodes(tx,forward);}
    private async assertExecutionCapacity(tx:Transaction,forward:Forward):Promise<void>{
        for(const nodeId of await this.relay.nodeIDs(tx,forward))
            await this.ledger.assertCapacity(tx,this.forwarding,await this.nodes.cleanupFacts(tx,nodeId,forward.scopeId));
    }
    async create(actorId: string, scopeId: string, key: string | undefined, input: unknown): Promise<Accepted> {
        return this.forwards.create(actorId, scopeId, key, input);
    }
    async update(actorId: string, scopeId: string, id: string, key: string | undefined, expectedRevision: number, input: unknown): Promise<Accepted> {
        return this.forwards.update(actorId, scopeId, id, key, expectedRevision, input);
    }
    async remove(actorId: string, scopeId: string, id: string, key: string | undefined, expectedRevision: number): Promise<Accepted> {
        return this.forwards.remove(actorId, scopeId, id, key, expectedRevision);
    }
    async retry(actorId: string, scopeId: string, key: string | undefined, sourceOperationId: string, expectedRevision: number): Promise<Accepted> {
        return this.forwards.retry(actorId, scopeId, key, sourceOperationId, expectedRevision);
    }
    async changeNode(actorId: string, scopeId: string, nodeId: string, key: string | undefined,
        command: NodeManagementCommand): Promise<NodeChangeResponse> {
        return this.nodeManagement.change(actorId, scopeId, nodeId, key, command);
    }
    async changeMember(actorId: string, scopeId: string, subject: string, key: string | undefined,
        input: MemberChangeInput): Promise<MemberChangeResponse> {
        return this.access.changeMember(actorId, scopeId, subject, key, input);
    }
    async changeNodeGrant(actorId: string, scopeId: string, nodeId: string, subject: string, key: string | undefined,
        expectedRevision: number, allowed: boolean): Promise<NodeGrantResponse> {
        return this.access.changeNodeGrant(actorId, scopeId, nodeId, subject, key, expectedRevision, allowed);
    }
}
