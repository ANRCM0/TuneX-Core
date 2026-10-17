import { RelayEndpoints } from '../modules/relay-endpoints.ts';
import { Transport } from '../modules/transport.ts';
import { randomUUID } from 'node:crypto';
import { parseForwardSpec } from '@tunex/core';
import type { Forward } from '@tunex/core';
import type { Policy } from '@tunex/contracts';
import { ControlError, invalid } from './errors.ts';
import type { MySqlUnitOfWork, Transaction } from '../infrastructure/mysql.ts';
import type { Identity } from '../modules/identity.ts';
import type { Nodes } from '../modules/nodes.ts';
import { Forwarding } from '../modules/forwarding.ts';
import { Idempotency } from '../modules/idempotency.ts';
import type { Accepted } from '../modules/idempotency.ts';
import { RuntimeLedger } from '../modules/runtime/ledger.ts';
import { RelayCoordinator } from '../modules/runtime/relay-coordinator.ts';
import type { NodeManagementCommand } from '../modules/node-management-ports.ts';
import { ConsoleQueries } from './console-queries.ts';
import { MySqlConsoleReadModels } from '../infrastructure/mysql-console-read.ts';
import { TransportGrantCommands } from './transport-grants.ts';
import { ProfileGrantReconciler } from '../modules/runtime/profile-grants.ts';
import { AccessCommands } from './access-commands.ts';
import { AccessChangeReconciler } from '../modules/runtime/access-changes.ts';
import type { ForwardAuthorizationExecution } from '../modules/runtime/authorization-ports.ts';
import type { MemberChangeInput } from '../modules/identity-ports.ts';
import type { MemberChangeResponse, NodeGrantResponse } from './access-commands.ts';
import { NodeManagementCommands } from './node-management.ts';
import type { NodeChangeResponse } from './node-management.ts';
import { NodeChangeReconciler } from '../modules/runtime/node-changes.ts';
import { ForwardCommands } from './forward-commands.ts';
import { ForwardCommandExecutor } from '../modules/runtime/forward-commands.ts';
import { SnapshotAssignmentRegistry } from '../modules/runtime/snapshot-assignments.ts';
import { RelayAssignmentSource } from '../modules/runtime/relay-assignment-source.ts';
import { DEFAULT_POLICY } from '@tunex/contracts';
import { NodeObservations } from './node-observations.ts';
import { MySqlNodeObservationReader } from '../infrastructure/mysql-node-observation.ts';
import { ForwardProbePlans } from './forward-probe-plans.ts';
import { MySqlProbeReader } from '../infrastructure/mysql-probe-read.ts';
import { ProbeNegotiator } from './probe-negotiation.ts';
import { MySqlProbeMachineReader } from '../infrastructure/mysql-probe-machine.ts';
import { ProbeInstances } from './probe-instances.ts';
import { MySqlProbeInstances } from '../infrastructure/mysql-probe-instances.ts';
import { ProbeInstanceRegistry } from './probe-instance-registry.ts';
import { ProbePermits } from './probe-permits.ts';
import { ProbeClaims } from './probe-claims.ts';
import { ProbeDelivery } from './probe-delivery.ts';
import { ProbeResults } from './probe-results.ts';
import { MySqlProbePermits } from '../infrastructure/mysql-probe-permits.ts';
import { MySqlProbePermitIntents } from '../infrastructure/mysql-probe-permit-intents.ts';
import { ForwardProbes } from './forward-probes.ts';
import { NativeDrivers } from './native-drivers.ts';
import { TransportQueries } from './transport-queries.ts';
import { MySqlTransportReader } from '../infrastructure/mysql-transport-read.ts';
/** Coordinates owner-owned commands inside one durable acceptance transaction. */
export class ControlApplication {
    readonly forwarding = new Forwarding();
    readonly transport:Transport;
    readonly relayEndpoints:RelayEndpoints;
    readonly ledger: RuntimeLedger;
    readonly idempotency = new Idempotency();
    readonly db: MySqlUnitOfWork;
    readonly identity: Identity;
    readonly nodes: Nodes;
    readonly relay: RelayCoordinator;
    readonly queries: ConsoleQueries<Transaction>;
    readonly nativeDrivers: NativeDrivers<Transaction>;
    readonly transportQueries: TransportQueries<Transaction>;
    readonly observations: NodeObservations;
    readonly probePlans: ForwardProbePlans<Transaction>;
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
    constructor(db: MySqlUnitOfWork, identity: Identity, nodes: Nodes, policy?: Policy, multihopEnabled=false, probeExecutionEnabled=false) {
        this.db=db;this.identity=identity;this.nodes=nodes;
        this.queries=new ConsoleQueries(db,identity,new MySqlConsoleReadModels());
        this.nativeDrivers=new NativeDrivers(db,identity,multihopEnabled,probeExecutionEnabled);
        const observationPolicy=policy??DEFAULT_POLICY;
        this.observations=new NodeObservations(new MySqlNodeObservationReader(db,identity),{
            freshnessMs:observationPolicy.observationFreshnessSeconds*1000,
            clockSkewMs:observationPolicy.maxClockSkewSeconds*1000,
        });
        this.probePlans=new ForwardProbePlans(db,identity,this.forwarding,nodes,new MySqlProbeReader(),
            observationPolicy.maxClockSkewSeconds*1000);
        this.probeNegotiation=new ProbeNegotiator(db,new MySqlProbeMachineReader());
        this.probeInstances=new ProbeInstances(db,new MySqlProbeMachineReader(),new MySqlProbeInstances());
        this.probeRegistry=new ProbeInstanceRegistry(this.probeInstances);
        this.probePermits=new ProbePermits(db,identity,
            new ForwardProbePlans(db,identity,new MySqlProbePermitIntents(),nodes,new MySqlProbeReader(true),
                observationPolicy.maxClockSkewSeconds*1000),
            new MySqlProbeMachineReader(),new MySqlProbeInstances(),new MySqlProbePermits());
        this.probeClaims=new ProbeClaims(this.probePermits);
        this.probeDelivery=new ProbeDelivery(this.probePermits);
        this.probeResults=new ProbeResults(this.probePermits);
        this.probes=new ForwardProbes(db,identity,this.idempotency,this.probePermits,probeExecutionEnabled);
        // Sources are declared now and read only after the complete host/Relay assembly returns.
        const assignments=new SnapshotAssignmentRegistry<Transaction>([
            new RelayAssignmentSource({assignments:(tx,nodeId,includeAccepted)=>this.relay.assignments(tx,nodeId,includeAccepted)}),
        ]);
        this.ledger=new RuntimeLedger(policy,nodes,assignments);
        this.transport=new Transport(db,identity,this.idempotency,this.forwarding);
        this.transportQueries=new TransportQueries(db,identity,new MySqlTransportReader(),this.transport);
        this.relayEndpoints=new RelayEndpoints(db,identity,nodes,this.idempotency,this.forwarding);
        this.relay=new RelayCoordinator(nodes,this.forwarding,this.transport,this.relayEndpoints,this.ledger,policy,multihopEnabled);
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
            },execution),randomUUID);
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
    }
    async planRelay(actorId:string,scopeId:string,input:unknown){
        const parsed=parseForwardSpec(input);if(!parsed.ok)invalid('Valid Forward spec required');const spec=parsed.value;if(!spec.path||!spec.transport)throw new ControlError('UNSUPPORTED_CAPABILITY',422,'Path and locked Transport Profile required');
        return this.db.transaction(async tx=>{await this.identity.scope(tx,actorId,scopeId,true);return this.relay.preview(tx,actorId,{id:'preview',scopeId,revision:1,spec:{...spec,enabled:true}});});
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
