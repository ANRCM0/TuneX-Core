import type { Forward } from '@tunex/core';
import type { RuntimeValueFamily, RuntimeAssignmentFor } from '@tunex/contracts/execution-values';
import type { Policy } from '@tunex/contracts/policy';
import type { AuthorizedNodeFacts } from './node-facts.ts';
import type { RequestIdentity } from './application-ports.ts';
import type { RuntimeLedgerForwards, RuntimeOperation } from './runtime-ledger-ports.ts';
import type { RelayResource, ReservedRelayResource, RuntimeSlotKey } from './runtime-resource-ports.ts';

export const RUNTIME_RELAY_INTERFACE_VERSION=5 as const;

export interface RuntimeAssignmentNetworkPolicy {
    readonly egressPolicyRevision:number;
    readonly allowMetadataTargets:boolean;
    readonly allowedDestinationCidrs:readonly string[];
}
export interface RuntimeRelayAssignmentPolicy extends RuntimeAssignmentNetworkPolicy {
    readonly binding:{readonly ingressNodeId:string;readonly egressNodeId:string};
    readonly peerFingerprints:readonly string[];
}
export interface RuntimeMultihopAssignmentPolicy extends RuntimeAssignmentNetworkPolicy {
    readonly path:readonly {readonly nodeId:string;readonly peerFingerprint:string}[];
}

export interface RuntimeRelayProfile<F extends RuntimeValueFamily=RuntimeValueFamily> {
    profileId:string;
    revision:number;
    config:F['relayProfile'];
    configDigest:string;
}
export interface RuntimeRelayEndpointConfig {
    listenAddress:string;
    advertisedHost:string;
    allowedTcpPorts:number[];
}
export interface RuntimeRelayEndpoint {
    nodeId:string;
    revision:number;
    config:RuntimeRelayEndpointConfig;
}
export interface RuntimeRelayNodeFacts {
    facts:AuthorizedNodeFacts;
    sessionEpoch:number;
    credentialUntil:number;
    peers:readonly {fingerprint:string;validUntil:number}[];
}
export interface RuntimeRelayPlan<F extends RuntimeValueFamily=RuntimeValueFamily> {
    path?:string[];
    endpointRevisions?:Record<string,number>;
    forwardId:string;
    forwardRevision:number;
    deploymentGeneration:number;
    endpointRevision:number;
    authorizationUntil:number;
    nodes:{nodeId:string;sessionEpoch:number;assignments:RuntimeAssignmentFor<F>[]}[];
    planDigest:string;
}
export interface RuntimeMultihopInput<F extends RuntimeValueFamily=RuntimeValueFamily> {
    forward:Forward;
    nodes:readonly RuntimeRelayNodeFacts[];
    profile:RuntimeRelayProfile<F>;
    endpoints:readonly RuntimeRelayEndpoint[];
    ports:Readonly<Record<string,Partial<Record<'tcp'|'udp',number>>>>;
}
export interface RuntimeRelayPlanInput<F extends RuntimeValueFamily=RuntimeValueFamily> {
    forward:Forward;
    nodes:readonly RuntimeRelayNodeFacts[];
    profile:RuntimeRelayProfile<F>;
    endpoint:RuntimeRelayEndpoint;
    reservations:readonly ReservedRelayResource[];
    issuedAt:string;
    drainTimeoutSeconds:number;
}
export interface RuntimeRelayDeployment {
    forward_id:string;
    generation:number;
    target_revision:number;
    ingress_node_id:string;
    egress_node_id:string;
    stage:'preparing'|'egress_active'|'ingress_active'|'active'|'withdrawn';
    body:unknown;
    path_nodes?:unknown;
    prepared_count:number;
    activated_count:number;
}
export interface RuntimeRelayNodeView {
    node_id:string;
    session_epoch:number;
    snapshot_generation:number;
    last_report:unknown;
    received_at:number|null;
}
export interface RuntimeRelayIsolation {
    node_id:string;
    assignment_id:string;
    binding_fence:number;
    removed_epoch:number|null;
}
/** Only the Relay deployment owner writes these records, in the caller's transaction. */
export interface RuntimeRelayStore<Tx,F extends RuntimeValueFamily=RuntimeValueFamily> {
    quarantine(tx:Tx,at:number):Promise<void>;
    latest(tx:Tx,forwardId:string,lock:boolean):Promise<RuntimeRelayDeployment|undefined>;
    forForward(tx:Tx,forwardId:string):Promise<RuntimeRelayDeployment[]>;
    allDeployments(tx:Tx):Promise<RuntimeRelayDeployment[]>;
    forNode(tx:Tx,nodeId:string):Promise<RuntimeRelayDeployment[]>;
    insertRelay(tx:Tx,forward:Forward,generation:number,plan:RuntimeRelayPlan<F>,createdAt:number,updatedAt:number):Promise<void>;
    insertMultihop(tx:Tx,forward:Forward,generation:number,plan:RuntimeRelayPlan<F>,createdAt:number,updatedAt:number):Promise<void>;
    withdraw(tx:Tx,forwardId:string,generation:number,at:number):Promise<void>;
    touch(tx:Tx,forwardId:string,generation:number,at:number):Promise<void>;
    setStage(tx:Tx,forwardId:string,generation:number,stage:RuntimeRelayDeployment['stage'],at:number):Promise<void>;
    activate(tx:Tx,forwardId:string,generation:number,at:number):Promise<void>;
    setPreparation(tx:Tx,forwardId:string,generation:number,prepared:number,stage:RuntimeRelayDeployment['stage'],activated:number,at:number):Promise<void>;
    incrementActivation(tx:Tx,forwardId:string,generation:number,at:number):Promise<void>;
    forwardIDsForNode(tx:Tx,nodeId:string):Promise<{forward_id:string}[]>;
    pendingDeployments(tx:Tx):Promise<RuntimeRelayDeployment[]>;
}
/** Read projections only; none of these facts grants authority or publishes state. */
export interface RuntimeRelayObservations<Tx> {
    nodeSession(tx:Tx,nodeId:string):Promise<{session_epoch:number}|undefined>;
    runtimeNode(tx:Tx,nodeId:string):Promise<RuntimeRelayNodeView|undefined>;
    snapshot(tx:Tx,nodeId:string,generation:number,epoch:number):Promise<{body:unknown}|undefined>;
    latestSnapshot(tx:Tx,nodeId:string):Promise<{body:unknown;valid_until:number}|undefined>;
    portOwner(tx:Tx,nodeId:string,port:number):Promise<{owner_id:string|null}|undefined>;
    isolation(tx:Tx,forwardId:string):Promise<RuntimeRelayIsolation[]>;
    pendingRetirementCount(tx:Tx,forwardId:string):Promise<number>;
    unsafeLeaseCount(tx:Tx,forwardId:string):Promise<number>;
    leaseNodes(tx:Tx,forwardId:string):Promise<{node_id:string}[]>;
}
export interface RuntimeRelayNodes<Tx> {
    authorizedRelayNode(tx:Tx,actor:string,scopeId:string,nodeId:string):Promise<AuthorizedNodeFacts>;
    facts(tx:Tx,nodeId:string):Promise<{facts:AuthorizedNodeFacts;credentialUntil:number}>;
    cleanupFacts(tx:Tx,nodeId:string,scopeId:string):Promise<AuthorizedNodeFacts>;
    relayCredentialFacts(tx:Tx,nodeId:string,currentOnly?:boolean):Promise<{fingerprint:string;certificate:string;validUntil:number}[]>;
}
export interface RuntimeRelayTransport<Tx,F extends RuntimeValueFamily=RuntimeValueFamily> {
    resolve(tx:Tx,actor:string,scopeId:string,profileId:string,revision:number):Promise<RuntimeRelayProfile<F>>;
}
export interface RuntimeRelayEndpointResolver<Tx> {
    resolve(tx:Tx,nodeId:string):Promise<RuntimeRelayEndpoint>;
}
export interface RuntimeRelayLedger<Tx,F extends RuntimeValueFamily=RuntimeValueFamily> {
    lockNode(tx:Tx,nodeId:string,epoch?:number):Promise<void>;
    latest(tx:Tx,forwardId:string):Promise<RuntimeOperation|undefined>;
    reserveRelay(tx:Tx,forward:Forward,resources:readonly RelayResource[],generation:number):Promise<ReservedRelayResource[]>;
    sessionAuthoritySafe(tx:Tx,nodeId:string,epoch:number):Promise<boolean>;
    accept(tx:Tx,forward:Forward,request:RequestIdentity,kind?:RuntimeOperation['kind'],previousSpec?:unknown,sourceOperationId?:string|null):Promise<string>;
    assertCapacity(tx:Tx,forwarding:RuntimeLedgerForwards<Tx>,facts:AuthorizedNodeFacts):Promise<void>;
    releaseForwardSlots(tx:Tx,forwardId:string):Promise<void>;
    previousLeasesSafe(tx:Tx,forwardId:string,desired:readonly {nodeId:string;assignments:readonly RuntimeAssignmentFor<F>[]}[]):Promise<boolean>;
    retainSlots(tx:Tx,forwardId:string,desired:readonly RuntimeSlotKey[]):Promise<void>;
    recordRelayError(tx:Tx,operationId:string,error:unknown):Promise<void>;
    failRelayOperation(tx:Tx,operationId:string,error:unknown):Promise<void>;
    succeedRelayOperation(tx:Tx,operationId:string):Promise<void>;
    clearTerminalRelayCleanup(tx:Tx,forwardId:string):Promise<void>;
}
export interface RuntimeRelayCompiler<F extends RuntimeValueFamily=RuntimeValueFamily> {
    relayAssignmentPolicy(assignment:RuntimeAssignmentFor<F>):RuntimeRelayAssignmentPolicy;
    multihopAssignmentPolicy(assignment:RuntimeAssignmentFor<F>):RuntimeMultihopAssignmentPolicy;
    parseTime(text:string):number;
    formatTime(at:number):string;
    digest(value:unknown):string;
    readValue<T>(value:unknown):T;
    relayResources(forward:Forward,nodes:readonly AuthorizedNodeFacts[],profile:RuntimeRelayProfile<F>,endpoint:RuntimeRelayEndpoint,ports:Readonly<Record<'tcp'|'udp',number>>):readonly RelayResource[];
    relayPlan(input:RuntimeRelayPlanInput<F>):RuntimeRelayPlan<F>;
    multihopResources(input:RuntimeMultihopInput<F>):readonly RelayResource[];
    multihopPlan(input:RuntimeMultihopInput<F>&{reservations:readonly ReservedRelayResource[];drainTimeoutSeconds:number;issuedAt:string}):RuntimeRelayPlan<F>;
    peerPinsChanged(plan:RuntimeRelayPlan<F>,facts:readonly RuntimeRelayNodeFacts[]):boolean;
}
export interface RuntimeRelayOptions<Tx,F extends RuntimeValueFamily=RuntimeValueFamily> {
    readonly nodes:RuntimeRelayNodes<Tx>;
    readonly forwards:RuntimeLedgerForwards<Tx>;
    readonly transport:RuntimeRelayTransport<Tx,F>;
    readonly endpoints:RuntimeRelayEndpointResolver<Tx>;
    readonly ledger:RuntimeRelayLedger<Tx,F>;
    readonly policy:Policy;
    readonly multihopEnabled:boolean;
    readonly store:RuntimeRelayStore<Tx,F>;
    readonly observations:RuntimeRelayObservations<Tx>;
    readonly compiler:RuntimeRelayCompiler<F>;
    readonly now:()=>number;
}
