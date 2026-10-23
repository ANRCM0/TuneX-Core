import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import type { Hono } from 'hono';
import type { HttpBindings } from '@hono/node-server';
import type * as Domain from '@tunex/core';
import type * as Contracts from '@tunex/contracts';
import type * as Observation from '@tunex/contracts/execution-observation';
import type * as Values from '@tunex/contracts/execution-values';
import type * as Runtime from '@tunex/contracts/runtime';
import type * as Adp2 from '@tunex/contracts/legacy/adp2';
import type * as Framework from '../src/framework/public.ts';
import type * as Native from '../src/compatibility/public.ts';
import type * as Node from '../src/modules/node-owner/public.ts';
import type * as NodeLeaf from '../src/modules/node-owner/management-contracts.ts';
import type * as GrantLeaf from '../src/modules/node-owner/grant-contracts.ts';
import type * as OldNode from '../src/modules/node-management-ports.ts';
import type * as OldGrant from '../src/modules/node-grant-ports.ts';
import type * as OldPlanner from '../src/modules/runtime/planner.ts';
import type * as OldSources from '../src/modules/runtime/snapshot-assignment-ports.ts';
import type * as Transport from '../src/modules/transport-owner/public.ts';
import type * as OldTransport from '../src/modules/transport-ports.ts';
import type * as Endpoint from '../src/modules/relay-endpoint-owner/public.ts';
import type * as OldMultihop from '../src/modules/runtime/multihop-plan.ts';
import type * as Transit from '../src/modules/transit-owner/public.ts';
import type * as Api from '../src/api/public.ts';
import type * as OldApi from '../src/api/application-ports.ts';
import type * as NativeHttp from '../src/compatibility/control-http/public.ts';
import type * as Identity from '../src/modules/identity-owner/public.ts';
import type * as Forward from '../src/modules/forward-owner/public.ts';
import type * as RelayPlan from '../src/modules/relay-plan-owner/public.ts';
import type * as ControlQueries from '../src/modules/control-query-owner/public.ts';
import type * as ConsoleQueries from '../src/modules/console-query-owner/public.ts';
import type * as NativeDriver from '../src/modules/native-driver-owner/public.ts';
import type * as TunnelQueries from '../src/modules/tunnel-query-owner/public.ts';
import type * as Path from '../src/modules/path-owner/public.ts';
import type * as NativeTunnel from '../src/modules/native-tunnel-owner/public.ts';
import type * as Ingress from '../src/modules/ingress-owner/public.ts';
import type * as NodeObservations from '../src/modules/node-observation-owner/public.ts';
import type * as Probe from '../src/modules/probe-owner/public.ts';
import type * as Telemetry from '../src/modules/telemetry-owner/public.ts';
import type * as Diagnostics from '../src/modules/forward-diagnostic-owner/public.ts';
import type * as Audit from '../src/modules/audit-owner/public.ts';
import type * as Alerts from '../src/modules/station-alert-owner/public.ts';
import type * as Notification from '../src/modules/notification-owner/public.ts';
import type * as ProbeHistory from '../src/modules/probe-history-owner/public.ts';
import type * as ProbePlans from '../src/modules/probe-plan-owner/public.ts';
import type * as ObservationServices from '../src/modules/observation-service-owner/public.ts';
import type * as ResourceLimits from '../src/modules/resource-limit-owner/public.ts';
import { createApp, createControlApp } from '../src/api/public.ts';
import { createApp as oldCreateApp, createControlApp as oldCreateControlApp } from '../src/api/app.ts';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Same<T extends true> = T;
type Flat<T> = { [K in keyof T]: T[K] };
type RequiredKeys<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? never : K }[keyof T];
type OptionalKeys<T> = Exclude<keyof T, RequiredKeys<T>>;
type MutableKeys<T> = { [K in keyof T]-?: Equal<{ [P in K]: T[P] }, { -readonly [P in K]: T[P] }> extends true ? K : never }[keyof T];
type ReadonlyKeys<T> = Exclude<keyof T, MutableKeys<T>>;
type Tx = { readonly contractTransaction: unique symbol };

// 117: independent complete declarations, rather than comparing two equally widened aliases.
type ExpectedFacts = {
    readonly nodeId: string; readonly scopeId: string; readonly capabilities: readonly string[];
    readonly allowedListenerAddresses: readonly string[]; readonly allowedPorts: readonly number[];
    readonly egressPolicyRevision: number; readonly allowedDestinationCidrs: readonly string[]; readonly allowMetadataTargets: boolean;
};
type ExpectedNodePolicy = Omit<ExpectedFacts, 'nodeId' | 'scopeId' | 'capabilities'>;
type ExpectedNodeCommand = { readonly kind: 'policy'; readonly expectedRevision: number; readonly policy: ExpectedNodePolicy } | { readonly kind: 'revoke' } | { readonly kind:'classify'; readonly expectedRevision:number; readonly source:'private'|'admin-shared'; readonly ownerActorId:string|null; readonly legacyGrants:'discard'|'retain' };
type ExpectedNodeChange = { readonly nodeId: string; readonly kind: 'policy' | 'revoke' | 'classify'; readonly facts: ExpectedFacts; readonly resource?: Framework.NodeResourceClaim };
type ExpectedNodeAudit = { policyRevision: number; operationIds: string[]; latestAuthorizationUntil: number | null };
type ExpectedGrantState = { readonly nodeId: string; readonly actorId: string; readonly revision: number; readonly allowed: boolean; readonly changed: boolean; readonly allowedRoles:readonly Framework.NodeUseRole[]|null; readonly portLimits:Node.NodeGrantPortLimits|null };
type ExpectedManagementWriter = {
    applyManagement(tx: Tx, actor: string, scopeId: string, nodeId: string, command: ExpectedNodeCommand): Promise<ExpectedNodeChange>;
    audit(tx: Tx, nodeId: string, actor: string, kind: 'policy_update' | 'node_revocation', details: ExpectedNodeAudit): Promise<void>;
};
type ExpectedGrantWriter = {
    changeGrant(tx: Tx, owner: string, scopeId: string, nodeId: string, subject: string, expectedRevision: number, allowed: boolean, allowedRoles?:readonly Framework.NodeUseRole[]|null, portLimits?:Node.NodeGrantPortLimits|null): Promise<ExpectedGrantState>;
};
export type NodeManagementGrantCompleteTypes117 = [
    Same<Equal<Framework.AuthorizedNodeFacts, ExpectedFacts>>, Same<Equal<NodeLeaf.AuthorizedNodeFacts, ExpectedFacts>>,
    Same<Equal<OldNode.AuthorizedNodeFacts, ExpectedFacts>>, Same<Equal<OldPlanner.AuthorizedNodeFacts, ExpectedFacts>>,
    Same<Equal<Node.NodePolicy, ExpectedNodePolicy>>, Same<Equal<Node.NodeManagementCommand, ExpectedNodeCommand>>,
    Same<Equal<Node.NodeManagementChange, ExpectedNodeChange>>, Same<Equal<Node.NodeManagementAudit, ExpectedNodeAudit>>,
    Same<Equal<Node.NodeGrantState, ExpectedGrantState>>, Same<Equal<Node.NodeManagementWriter<Tx>, ExpectedManagementWriter>>,
    Same<Equal<Node.NodeGrantWriter<Tx>, ExpectedGrantWriter>>,
    Same<Equal<OldNode.NodePolicy, Node.NodePolicy>>, Same<Equal<OldNode.NodeManagementCommand, Node.NodeManagementCommand>>,
    Same<Equal<OldNode.NodeManagementChange, Node.NodeManagementChange>>, Same<Equal<OldNode.NodeManagementAudit, Node.NodeManagementAudit>>,
    Same<Equal<OldNode.NodeManagementWriter<Tx>, Node.NodeManagementWriter<Tx>>>,
    Same<Equal<OldGrant.NodeGrantState, Node.NodeGrantState>>, Same<Equal<OldGrant.NodeGrantWriter<Tx>, Node.NodeGrantWriter<Tx>>>,
    Same<Equal<GrantLeaf.NodeGrantState, Node.NodeGrantState>>, Same<Equal<GrantLeaf.NodeGrantWriter<Tx>, ExpectedGrantWriter>>,
    Same<Equal<MutableKeys<Node.NodePolicy>, never>>, Same<Equal<MutableKeys<Node.NodeManagementChange>, never>>,
    Same<Equal<MutableKeys<Node.NodeManagementAudit>, 'policyRevision' | 'operationIds' | 'latestAuthorizationUntil'>>,
    Same<Equal<MutableKeys<Node.NodeGrantState>, never>>,
    Same<Equal<RequiredKeys<Node.NodeManagementAudit>, 'policyRevision' | 'operationIds' | 'latestAuthorizationUntil'>>,
    Same<Equal<Parameters<Node.NodeManagementWriter<Tx>['audit']>[3], 'policy_update' | 'node_revocation'>>,
    Same<Equal<Node.NodeChangeResponse, { status: 202; body: { nodeId: string; policyRevision: number; resourceRevision?:number; operationIds: string[]; latestAuthorizationUntil: string | null } }>>,
    Same<Equal<Parameters<Node.NodeManagementApi['change']>, [actorId: string, scopeId: string, nodeId: string, key: string | undefined, input: ExpectedNodeCommand]>>,
    Same<Equal<ReturnType<Node.NodeManagementApi['change']>, Promise<Node.NodeChangeResponse>>>,
];

// 125: public-source-closure already pins both complete fact shapes. Here the
// missing required/mutable contracts, phase relationships and every report alias are explicit.
type ObservationKeys = 'assignmentId' | 'deploymentGeneration' | 'bindingFence' | 'phase' | 'condition' | 'errorCode' | 'retryable';
type DrainKeys = 'assignmentId' | 'deploymentGeneration' | 'bindingFence' | 'startedAt' | 'deadline' | 'remainingConnections' | 'condition';
export type ObservationDrainReportCompleteTypes125 = [
    Same<Equal<RequiredKeys<Observation.Observation>, ObservationKeys>>, Same<Equal<MutableKeys<Observation.Observation>, ObservationKeys>>,
    Same<Equal<RequiredKeys<Observation.Drain>, DrainKeys>>, Same<Equal<MutableKeys<Observation.Drain>, DrainKeys>>,
    Same<Equal<Observation.ExecutionPhase, 'prepared' | 'active' | 'draining'>>,
    Same<Equal<Observation.Condition, 'pending' | 'prepared' | 'ready' | 'degraded' | 'error' | 'draining' | 'removed'>>,
    Same<Equal<Observation.Observation['phase'], Observation.ExecutionPhase | 'absent'>>,
    Same<Equal<Observation.Observation['errorCode'], string | null>>, Same<Equal<Observation.Drain['condition'], 'draining' | 'removed'>>,
    Same<Equal<Adp2.Assignment['phase'], Observation.ExecutionPhase>>, Same<Equal<Runtime.RuntimeAssignment['phase'], Observation.ExecutionPhase>>,
    Same<Equal<Framework.ExecutionPhase, Observation.ExecutionPhase>>, Same<Equal<Framework.Condition, Observation.Condition>>,
    Same<Equal<Framework.Observation, Observation.Observation>>, Same<Equal<Framework.Drain, Observation.Drain>>,
    Same<Equal<Contracts.Observation, Observation.Observation>>, Same<Equal<Contracts.Drain, Observation.Drain>>, Same<Equal<Contracts.Condition, Observation.Condition>>,
    Same<Equal<Runtime.Observation, Observation.Observation>>, Same<Equal<Runtime.Drain, Observation.Drain>>, Same<Equal<Runtime.Condition, Observation.Condition>>,
    Same<Equal<Adp2.Observation, Observation.Observation>>, Same<Equal<Adp2.Drain, Observation.Drain>>, Same<Equal<Adp2.Condition, Observation.Condition>>,
    Same<Equal<Contracts.ReportRequest['observations'], Observation.Observation[]>>, Same<Equal<Contracts.ReportRequest['drains'], Observation.Drain[]>>,
    Same<Equal<Adp2.ReportRequest['observations'], Observation.Observation[]>>, Same<Equal<Adp2.ReportRequest['drains'], Observation.Drain[]>>,
    Same<Equal<Runtime.RuntimeMessages['ReportRequest']['observations'], Observation.Observation[]>>,
    Same<Equal<Runtime.RuntimeMessages['ReportRequest']['drains'], Observation.Drain[]>>,
    Same<Equal<Values.RuntimeReportRequestValue['observations'], Observation.Observation[]>>,
    Same<Equal<Values.RuntimeReportRequestValue['drains'], Observation.Drain[]>>,
    Same<Equal<Extract<RequiredKeys<Contracts.ReportRequest>, 'observations' | 'drains'>, 'observations' | 'drains'>>,
    Same<Equal<Extract<MutableKeys<Contracts.ReportRequest>, 'observations' | 'drains'>, 'observations' | 'drains'>>,
];

type ExpectedRole = 'direct' | 'relay-ingress' | 'relay-egress' | 'multihop-ingress' | 'multihop-transit' | 'multihop-egress';
type ExpectedResource = { address: string; port: number; protocol: 'tcp' | 'udp' };
type ExpectedDriver = { id: string; configDigest: string };
type ExpectedAssignment<Driver = ExpectedDriver> = {
    assignmentId: string; forwardId: string; forwardRevision: number; deploymentGeneration: number; bindingFence: number;
    role: ExpectedRole; protocol: 'tcp' | 'udp'; phase: 'prepared' | 'active' | 'draining'; resource: ExpectedResource;
    driver: Driver; drainTimeoutSeconds: number;
};
type ExpectedTombstone = {
    assignmentId: string; forwardId: string; role: ExpectedRole; protocol: 'tcp' | 'udp'; physicalProtocol: 'tcp' | 'udp';
    port: number; bindingFence: number; retirementGeneration: number;
};
type ExpectedSnapshot<Assignment = ExpectedAssignment> = {
    nodeId: string; sessionEpoch: number; snapshotGeneration: number; complete: true; issuedAt: string; validUntil: string;
    snapshotDigest: string; assignments: Assignment[]; tombstones: ExpectedTombstone[]; resourceLimits?: Values.RuntimeResourceLimitsValue;
};
type ExpectedHello = { nodeId: string; bootId: string; agentBuild: string; capabilities: string[]; lastStoredSnapshotGeneration: number };
type ExpectedHelloResponse = { nodeId: string; bootId: string; sessionEpoch: number; serverTime: string; policy: Framework.Policy };
type ExpectedReport = {
    nodeId: string; bootId: string; sessionEpoch: number; reportSequence: number; observedAt: string; acceptedSnapshotGeneration: number;
    observations: Observation.Observation[]; drains: Observation.Drain[];
};
type ExpectedAck = { nodeId: string; bootId: string; sessionEpoch: number; reportSequence: number; status: 'accepted' | 'duplicate' };
type ExpectedSourceDriver = { readonly id: string; readonly schemaVersion: number; readonly roles: readonly Exclude<ExpectedRole, 'direct'>[] };
type ExpectedFamily = {
    readonly relayProfile: unknown; readonly driver: ExpectedDriver; readonly sourceDriver: ExpectedSourceDriver;
    readonly helloRequest: object; readonly helloResponse: object; readonly snapshot: object; readonly reportRequest: object; readonly reportAck: object;
};
type ExpectedNativeDriver = {
    id: 'native.direct.v1' | 'native.relay.v1' | 'native.multihop.v1'; schemaVersion: 1; configDigest: string;
    config: Runtime.DirectConfig | Runtime.RelayConfig | Runtime.MultihopConfig;
};
type ExpectedLegacyAssignment = {
    assignmentId: string; forwardId: string; forwardRevision: number; deploymentGeneration: number; bindingFence: number;
    role: 'direct'; protocol: 'tcp' | 'udp'; phase: Observation.ExecutionPhase; listener: Domain.ListenEndpoint;
    driver: { id: 'native.direct.v1'; schemaVersion: 1; configDigest: string; config: Runtime.DirectConfig }; drainTimeoutSeconds: number;
};
type ExpectedLegacyTombstone = { assignmentId: string; forwardId: string; protocol: 'tcp' | 'udp'; port: number; bindingFence: number; retirementGeneration: number };
export type ExecutionValuesCompleteTypes127 = [
    Same<Equal<Values.ExecutionRole, ExpectedRole>>, Same<Equal<Values.RuntimeResourceValue, ExpectedResource>>,
    Same<Equal<Values.RuntimeDriverValue, ExpectedDriver>>, Same<Equal<Values.RuntimeAssignmentValue, ExpectedAssignment>>,
    Same<Equal<Values.RuntimeTombstoneValue, ExpectedTombstone>>, Same<Equal<Values.RuntimeSnapshotValue, ExpectedSnapshot>>,
    Same<Equal<Values.RuntimeHelloRequestValue, ExpectedHello>>, Same<Equal<Values.RuntimeHelloResponseValue, ExpectedHelloResponse>>,
    Same<Equal<Values.RuntimeReportRequestValue, ExpectedReport>>, Same<Equal<Values.RuntimeReportAckValue, ExpectedAck>>,
    Same<Equal<Values.RuntimeAssignmentSourceDriverValue, ExpectedSourceDriver>>, Same<Equal<Values.RuntimeValueFamily, ExpectedFamily>>,
    Same<Equal<MutableKeys<Values.RuntimeAssignmentValue>, keyof ExpectedAssignment>>,
    Same<Equal<RequiredKeys<Values.RuntimeAssignmentValue>, keyof ExpectedAssignment>>,
    Same<Equal<MutableKeys<Values.RuntimeSnapshotValue>, keyof ExpectedSnapshot>>,
    Same<Equal<RequiredKeys<Values.RuntimeSnapshotValue>, Exclude<keyof ExpectedSnapshot,'resourceLimits'>>>,
    Same<Equal<MutableKeys<Values.RuntimeAssignmentSourceDriverValue>, never>>,
    Same<Equal<Values.RuntimeAssignmentFor['driver'], ExpectedDriver>>,
    Same<Equal<Extract<keyof Values.RuntimeAssignmentFor['driver'], 'schemaVersion' | 'config'>, never>>,
    Same<Equal<Extract<keyof Values.RuntimeSnapshotFor, 'protocolVersion' | 'executionExtension'>, never>>,
    Same<Equal<Extract<keyof Values.RuntimeMessagesFor['HelloRequest'], 'protocolVersion'>, never>>,
    Same<Equal<Extract<keyof Values.RuntimeMessagesFor['ReportRequest'], 'protocolVersion'>, never>>,
    Same<Equal<keyof Values.RuntimeMessagesFor, 'HelloRequest' | 'HelloResponse' | 'Snapshot' | 'ReportRequest' | 'ReportAck'>>,
    Same<Equal<Runtime.RuntimeAssignment['driver'], ExpectedNativeDriver>>,
    Same<Equal<Flat<Runtime.RuntimeAssignment>, ExpectedAssignment<ExpectedNativeDriver>>>,
    Same<Equal<Runtime.RuntimeTombstone, ExpectedTombstone>>,
    Same<Equal<Flat<Runtime.RuntimeSnapshot>, Flat<ExpectedSnapshot<Runtime.RuntimeAssignment> & { protocolVersion: 3; executionExtension?: 1 }>>>,
    Same<Equal<OptionalKeys<Runtime.RuntimeSnapshot>, 'executionExtension' | 'resourceLimits'>>,
    Same<Equal<Runtime.RuntimeMessages['HelloRequest'], ExpectedHello & { protocolVersion: 3 }>>,
    Same<Equal<Runtime.RuntimeMessages['HelloResponse'], ExpectedHelloResponse & { protocolVersion: 3 }>>,
    Same<Equal<Runtime.RuntimeMessages['ReportRequest'], ExpectedReport & { protocolVersion: 3 }>>,
    Same<Equal<Runtime.RuntimeMessages['ReportAck'], ExpectedAck & { protocolVersion: 3 }>>,
    Same<Equal<Flat<Adp2.HelloRequest>, Flat<ExpectedHello & { protocolVersion: 2 }>>>,
    Same<Equal<Flat<Adp2.HelloResponse>, Flat<ExpectedHelloResponse & { protocolVersion: 2 }>>>,
    Same<Equal<Flat<Adp2.ReportRequest>, Flat<ExpectedReport & { protocolVersion: 2 }>>>,
    Same<Equal<Flat<Adp2.ReportAck>, Flat<ExpectedAck & { protocolVersion: 2 }>>>,
    Same<Equal<Adp2.Assignment, ExpectedLegacyAssignment>>, Same<Equal<Adp2.Tombstone, ExpectedLegacyTombstone>>,
    Same<Equal<Adp2.Snapshot, { protocolVersion: 2; nodeId: string; sessionEpoch: number; snapshotGeneration: number; complete: true;
        issuedAt: string; validUntil: string; snapshotDigest: string; assignments: ExpectedLegacyAssignment[]; tombstones: ExpectedLegacyTombstone[] }>>,
    Same<Equal<Contracts.RuntimeAssignment, Runtime.RuntimeAssignment>>, Same<Equal<Contracts.RuntimeSnapshot, Runtime.RuntimeSnapshot>>,
    Same<Equal<Contracts.RuntimeTombstone, Runtime.RuntimeTombstone>>, Same<Equal<Contracts.RuntimeMessages, Runtime.RuntimeMessages>>,
    Same<Equal<Framework.RuntimeResourceValue, Values.RuntimeResourceValue>>, Same<Equal<Framework.RuntimeDriverValue, Values.RuntimeDriverValue>>,
    Same<Equal<Framework.RuntimeAssignmentValue, Values.RuntimeAssignmentValue>>, Same<Equal<Framework.RuntimeTombstoneValue, Values.RuntimeTombstoneValue>>,
    Same<Equal<Framework.RuntimeSnapshotValue, Values.RuntimeSnapshotValue>>, Same<Equal<Framework.RuntimeValueFamily, Values.RuntimeValueFamily>>,
    Same<Equal<Native.NativeRuntimeFamily['sourceDriver'], ExpectedSourceDriver & { readonly id: 'native.relay.v1' | 'native.multihop.v1'; readonly schemaVersion: 1 }>>,
];

// Two incompatible non-native families exercise the complete carrier relation.
// A native-only default, widened driver or dropped extension cannot satisfy these witnesses.
interface FamilyA extends Values.RuntimeValueFamily {
    readonly driver: { id: 'contract.a'; configDigest: string; schemaVersion: 7; config: { valueA: string } };
    readonly sourceDriver: ExpectedSourceDriver & { readonly id: 'contract.a'; readonly schemaVersion: 7 };
    readonly relayProfile: { readonly profileA: string };
    readonly helloRequest: { protocolA: 'hello-a' }; readonly helloResponse: { protocolA: 'hello-response-a' };
    readonly snapshot: { protocolA: 'snapshot-a'; optionalA?: number }; readonly reportRequest: { protocolA: 'report-a' }; readonly reportAck: { protocolA: 'ack-a' };
}
interface FamilyB extends Values.RuntimeValueFamily {
    readonly driver: { id: 'contract.b'; configDigest: string; schemaVersion: 8; config: { valueB: number } };
    readonly sourceDriver: ExpectedSourceDriver & { readonly id: 'contract.b'; readonly schemaVersion: 8 };
    readonly relayProfile: { readonly profileB: number };
    readonly helloRequest: { protocolB: 1 }; readonly helloResponse: { protocolB: 2 };
    readonly snapshot: { protocolB: 3 }; readonly reportRequest: { protocolB: 4 }; readonly reportAck: { protocolB: 5 };
}
type FamilyPorts<F extends Values.RuntimeValueFamily> = {
    assignment: Flat<Values.RuntimeAssignmentFor<F>>;
    snapshot: Flat<Values.RuntimeSnapshotFor<F>>;
    hello: Flat<Values.RuntimeHelloRequestFor<F>>; helloResponse: Flat<Values.RuntimeHelloResponseFor<F>>;
    report: Flat<Values.RuntimeReportRequestFor<F>>; ack: Flat<Values.RuntimeReportAckFor<F>>;
    inputAssignments: Framework.RuntimeSnapshotInput<F>['assignments']; inputTombstones: Framework.RuntimeSnapshotInput<F>['tombstones'];
    storeSnapshot: Awaited<ReturnType<Framework.RuntimeStateStore<Tx, F>['snapshot']>>;
    storeSaveSnapshot: Parameters<Framework.RuntimeStateStore<Tx, F>['saveSnapshot']>;
    storeSaveReport: Parameters<Framework.RuntimeStateStore<Tx, F>['saveReport']>[1];
    storeFailureAssignment: Parameters<Framework.RuntimeStateStore<Tx, F>['failExecution']>[1];
    compilerSnapshot: ReturnType<Framework.RuntimeCodec<F>['compileSnapshot']>;
    compilerHello: Parameters<Framework.RuntimeCodec<F>['checkHelloProtocol']>[0];
    compilerAck: ReturnType<Framework.RuntimeCodec<F>['reportAck']>;
    machineHello: Parameters<Framework.RuntimeMachinePort<F>['hello']>[1];
    machineSnapshot: Awaited<ReturnType<Framework.RuntimeMachinePort<F>['snapshot']>>;
    ledgerAssignments: Awaited<ReturnType<Framework.RuntimeExecutionLedger<Tx, F>['assignments']>>;
    ledgerRetirePrevious: Parameters<Framework.RuntimeExecutionLedger<Tx, F>['retireChanged']>[2];
    ledgerRetireNext: Parameters<Framework.RuntimeExecutionLedger<Tx, F>['retireChanged']>[3];
    ledgerLease: Parameters<Framework.RuntimeExecutionLedger<Tx, F>['recordLeases']>[1];
    ledgerCompleteReport: Parameters<Framework.RuntimeExecutionLedger<Tx, F>['complete']>[2];
    ledgerCompleteSnapshot: Parameters<Framework.RuntimeExecutionLedger<Tx, F>['complete']>[3];
    ledgerStoreAssignment: Parameters<Framework.RuntimeLedgerStore<Tx, F>['retireAssignment']>[2];
    ledgerCompilerAssignments: ReturnType<Framework.RuntimeLedgerCompiler<F>['direct']>;
    ledgerCompilerSnapshot: ReturnType<Framework.RuntimeLedgerCompiler<F>['snapshot']>;
    ledgerCompilerInput: Parameters<Framework.RuntimeLedgerCompiler<F>['snapshot']>[0];
    sourceDriver: Framework.AssignmentDriverDeclaration<F>;
    sourceDrivers: Framework.SnapshotAssignmentSource<Tx, F>['drivers'];
    sourceCollect: Awaited<ReturnType<Framework.SnapshotAssignmentSource<Tx, F>['collect']>>;
    collectorInput: Parameters<Framework.SnapshotAssignmentCollector<Tx, F>['merge']>[2];
    collectorOutput: Awaited<ReturnType<Framework.SnapshotAssignmentCollector<Tx, F>['merge']>>;
    relayAssignments: Awaited<ReturnType<Framework.RelayAssignmentReader<Tx, F>['assignments']>>;
    relayPlanAssignments: Framework.RuntimeRelayPlan<F>['nodes'][number]['assignments'];
    evidenceSnapshot: Framework.PublishedRuntimeEvidence<F>['snapshot'];
};
type ExpectedFamilyPorts<F extends Values.RuntimeValueFamily> = {
    assignment: ExpectedAssignment<F['driver']>;
    snapshot: Flat<ExpectedSnapshot<Values.RuntimeAssignmentFor<F>> & F['snapshot']>;
    hello: Flat<ExpectedHello & F['helloRequest']>; helloResponse: Flat<ExpectedHelloResponse & F['helloResponse']>;
    report: Flat<ExpectedReport & F['reportRequest']>; ack: Flat<ExpectedAck & F['reportAck']>;
    inputAssignments: readonly Values.RuntimeAssignmentFor<F>[]; inputTombstones: ExpectedTombstone[];
    storeSnapshot: Values.RuntimeSnapshotFor<F> | undefined;
    storeSaveSnapshot: [tx: Tx, snapshot: Values.RuntimeSnapshotFor<F>];
    storeSaveReport: Values.RuntimeReportRequestFor<F>; storeFailureAssignment: Values.RuntimeAssignmentFor<F>;
    compilerSnapshot: Values.RuntimeSnapshotFor<F>; compilerHello: Values.RuntimeHelloRequestFor<F>; compilerAck: Values.RuntimeReportAckFor<F>;
    machineHello: Values.RuntimeHelloRequestFor<F>; machineSnapshot: Values.RuntimeSnapshotFor<F>;
    ledgerAssignments: Values.RuntimeAssignmentFor<F>[];
    ledgerRetirePrevious: Values.RuntimeSnapshotFor<F> | undefined; ledgerRetireNext: readonly Values.RuntimeAssignmentFor<F>[];
    ledgerLease: Values.RuntimeSnapshotFor<F>; ledgerCompleteReport: Values.RuntimeReportRequestFor<F> | undefined;
    ledgerCompleteSnapshot: Values.RuntimeSnapshotFor<F> | undefined; ledgerStoreAssignment: Values.RuntimeAssignmentFor<F>;
    ledgerCompilerAssignments: readonly Values.RuntimeAssignmentFor<F>[]; ledgerCompilerSnapshot: Values.RuntimeSnapshotFor<F>;
    ledgerCompilerInput: Framework.RuntimeSnapshotInput<F>;
    sourceDriver: F['sourceDriver']; sourceDrivers: readonly F['sourceDriver'][];
    sourceCollect: { readonly nodeId: string; readonly assignments: readonly Values.RuntimeAssignmentFor<F>[] };
    collectorInput: readonly Values.RuntimeAssignmentFor<F>[]; collectorOutput: Values.RuntimeAssignmentFor<F>[];
    relayAssignments: Values.RuntimeAssignmentFor<F>[]; relayPlanAssignments: Values.RuntimeAssignmentFor<F>[];
    evidenceSnapshot: Values.RuntimeSnapshotFor<F>;
};
export type ExecutionFamilyCorrelationCompleteTypes127 = [
    Same<Equal<FamilyPorts<FamilyA>, ExpectedFamilyPorts<FamilyA>>>, Same<Equal<FamilyPorts<FamilyB>, ExpectedFamilyPorts<FamilyB>>>,
    Same<Equal<FamilyPorts<Native.NativeRuntimeFamily>, ExpectedFamilyPorts<Native.NativeRuntimeFamily>>>,
    Same<Equal<Values.RuntimeSnapshotFor<FamilyA> extends Values.RuntimeSnapshotFor<FamilyB> ? true : false, false>>,
    Same<Equal<Values.RuntimeSnapshotFor<FamilyB> extends Values.RuntimeSnapshotFor<FamilyA> ? true : false, false>>,
    Same<Equal<Native.NativeRuntimeSnapshotInput, Framework.RuntimeSnapshotInput<Native.NativeRuntimeFamily>>>,
    Same<Equal<Native.NativeAssignmentDriverDeclaration, Framework.AssignmentDriverDeclaration<Native.NativeRuntimeFamily>>>,
    Same<Equal<Native.NativeSnapshotContribution, Framework.SnapshotContribution<Native.NativeRuntimeFamily>>>,
    Same<Equal<Native.NativeSnapshotAssignmentSource<Tx>, Framework.SnapshotAssignmentSource<Tx, Native.NativeRuntimeFamily>>>,
    Same<Equal<Native.NativeSnapshotAssignmentCollector<Tx>, Framework.SnapshotAssignmentCollector<Tx, Native.NativeRuntimeFamily>>>,
    Same<Equal<Native.NativeRelayAssignmentReader<Tx>, Framework.RelayAssignmentReader<Tx, Native.NativeRuntimeFamily>>>,
    Same<Equal<OldSources.AssignmentDriverDeclaration, Native.NativeAssignmentDriverDeclaration>>,
    Same<Equal<OldSources.SnapshotContribution, Native.NativeSnapshotContribution>>,
    Same<Equal<OldSources.SnapshotAssignmentSource<Tx>, Native.NativeSnapshotAssignmentSource<Tx>>>,
    Same<Equal<OldSources.SnapshotAssignmentCollector<Tx>, Native.NativeSnapshotAssignmentCollector<Tx>>>,
    Same<Equal<OldSources.RelayAssignmentReader<Tx>, Native.NativeRelayAssignmentReader<Tx>>>,
    Same<Equal<OldPlanner.SnapshotInput, Native.NativeRuntimeSnapshotInput>>,
];

type ExpectedProfileConfig = {
    driver: 'native.relay.v1'; wireVersion: 1; security: 'mutual-tls13'; protocols: ('tcp' | 'udp')[];
    handshakeTimeoutSeconds: number; idleTimeoutSeconds: number; maxFrameBytes: number; maxUdpDatagramBytes: number; maxConnectionsPerNode: number;
};
type ExpectedNativeProfile = { profileId: string; revision: number; config: ExpectedProfileConfig; configDigest: string };
type ProfilePorts<F extends Values.RuntimeValueFamily> = {
    profile: Framework.RuntimeRelayProfile<F>['config']; transport: Awaited<ReturnType<Framework.RuntimeRelayTransport<Tx, F>['resolve']>>['config'];
    multihop: Framework.RuntimeMultihopInput<F>['profile']['config']; relayInput: Framework.RuntimeRelayPlanInput<F>['profile']['config'];
    resourceInput: Parameters<Framework.RuntimeRelayCompiler<F>['relayResources']>[2]['config'];
    planInput: Parameters<Framework.RuntimeRelayCompiler<F>['relayPlan']>[0]['profile']['config'];
    multihopResources: Parameters<Framework.RuntimeRelayCompiler<F>['multihopResources']>[0]['profile']['config'];
    multihopPlan: Parameters<Framework.RuntimeRelayCompiler<F>['multihopPlan']>[0]['profile']['config'];
    configuration: Framework.TransportProfileConfig<F>; codec: ReturnType<Framework.RelayConfigurationCodec<F>['profile']>;
};
type ExpectedProfilePorts<Config> = { profile: Config; transport: Config; multihop: Config; relayInput: Config; resourceInput: Config;
    planInput: Config; multihopResources: Config; multihopPlan: Config; configuration: Config; codec: Config };
export type OpaqueNativeProfileCompleteTypes130 = [
    Same<Equal<Runtime.RelayProfileConfig, ExpectedProfileConfig>>, Same<Equal<Contracts.RelayProfileConfig, ExpectedProfileConfig>>,
    Same<Equal<MutableKeys<Runtime.RelayProfileConfig>, keyof ExpectedProfileConfig>>,
    Same<Equal<RequiredKeys<Runtime.RelayProfileConfig>, keyof ExpectedProfileConfig>>,
    Same<Equal<OptionalKeys<Runtime.RelayProfileConfig>, never>>,
    Same<Equal<Framework.RuntimeRelayProfile, { profileId: string; revision: number; config: unknown; configDigest: string }>>,
    Same<Equal<ProfilePorts<Values.RuntimeValueFamily>, ExpectedProfilePorts<unknown>>>,
    Same<Equal<ProfilePorts<FamilyA>, ExpectedProfilePorts<FamilyA['relayProfile']>>>,
    Same<Equal<ProfilePorts<FamilyB>, ExpectedProfilePorts<FamilyB['relayProfile']>>>,
    Same<Equal<ProfilePorts<Native.NativeRuntimeFamily>, ExpectedProfilePorts<ExpectedProfileConfig>>>,
    Same<Equal<Native.NativeRuntimeRelayProfile, ExpectedNativeProfile>>,
    Same<Equal<Transport.ResolvedProfile, ExpectedNativeProfile>>, Same<Equal<OldTransport.ResolvedProfile, Transport.ResolvedProfile>>,
    Same<Equal<Transport.TransportProfileResolver<Tx>, Native.NativeRuntimeRelayTransport<Tx>>>,
    Same<Equal<OldTransport.TransportProfileResolver<Tx>, Transport.TransportProfileResolver<Tx>>>,
    Same<Equal<Flat<Transport.TransportProfileView>, Flat<ExpectedNativeProfile & { currentRevision: number; createdBy: string; createdAt: string; executionSupported: boolean }>>>,
    Same<Equal<Native.NativeRuntimeMultihopInput, Framework.RuntimeMultihopInput<Native.NativeRuntimeFamily>>>,
    Same<Equal<OldMultihop.MultihopPlanInput, Native.NativeRuntimeMultihopInput>>,
    Same<Equal<Native.NativeRuntimeRelayPlanInput, Framework.RuntimeRelayPlanInput<Native.NativeRuntimeFamily>>>,
    Same<Equal<Native.NativeTransportProfileConfig, ExpectedProfileConfig>>,
    Same<Equal<Native.NativeRelayConfigurationCodec, Framework.RelayConfigurationCodec<Native.NativeRuntimeFamily>>>,
    Same<Equal<Transport.TransportOptions<Tx>['codec'], Native.NativeRelayConfigurationCodec>>,
    Same<Equal<Endpoint.RelayEndpointOptions<Tx>['codec'], Native.NativeRelayConfigurationCodec>>,
    Same<Equal<Transit.TransitInput['profile'], Transport.ResolvedProfile>>,
    Same<Equal<Transit.TransitPreparationInput['profile'], Transport.ResolvedProfile>>,
    Same<Equal<Parameters<Framework.RelayConfigurationCodec['formatTime']>, [at: number]>>,
    Same<Equal<ReturnType<Framework.RelayConfigurationCodec['formatTime']>, string>>,
    Same<Equal<RequiredKeys<Framework.RelayConfigurationCodec>, keyof Framework.RelayConfigurationCodec>>,
];

type ExpectedEnvironment = { Bindings: HttpBindings; Variables: { actor: string; node: string; requestId: string; fingerprint: string } };
type ExpectedControlApi = Forward.ForwardCommandApi & RelayPlan.RelayPlanApi & {
    readonly changeMember: Identity.AccessCommandApi['changeMember']; readonly changeNodeGrant: Identity.AccessCommandApi['changeNodeGrant'];
    readonly changeNode: Node.NodeManagementApi['change']; readonly identity: Identity.IdentityQueries; readonly nodes: Node.NodeApi;
    readonly resourceLimits: ResourceLimits.SharedResourceLimitApi;
    readonly transport: Transport.TransportApi; readonly relayEndpoints: Endpoint.RelayEndpointApi;
    readonly details: ControlQueries.ControlDetailApi; readonly queries: ConsoleQueries.ConsoleQueryApi; readonly nativeDrivers: NativeDriver.NativeDriverApi;
    readonly transportQueries: Transport.TransportQueryApi; readonly tunnelQueries: TunnelQueries.TunnelQueryApi;
    readonly pathTemplates: Path.PathTemplateCommandApi; readonly pathTemplateQueries: Path.PathTemplateQueryApi; readonly pathBindings: Path.PathBindingApi;
    readonly forwards: Forward.ForwardBindingApi; readonly tunnels: NativeTunnel.NativeTunnelApi;
    readonly pathGroups: Path.PathGroupApi; readonly pathPublications: Path.PathPublicationApi;
    readonly ingressGroups: Ingress.IngressGroupApi; readonly ingressDeployments: Ingress.IngressDeploymentApi; readonly ingressMigrations: Ingress.IngressMigrationApi;
    readonly observations: NodeObservations.NodeObservationApi; readonly profileGrants: Transport.TransportGrantApi;
    readonly probeCapabilities: Probe.ForwardProbeCapabilitiesApi; readonly probePlans: Probe.ForwardProbePlanApi; readonly probes: Probe.ForwardProbeApi; readonly probeNegotiation: Probe.ProbeNegotiationApi;
    readonly probeRegistry: Probe.ProbeInstanceApi; readonly probeClaims: Probe.ProbeClaimApi; readonly probeDelivery: Probe.ProbeDeliveryApi;
    readonly probeResults: Probe.ProbeResultApi; readonly probeTypeRegistry: Probe.ProbeTypeRegistryApi; readonly probeTypes: Probe.ProbeTypesApi;
    readonly probeServiceRegistry: Probe.ProbeServiceRegistryApi; readonly probeServices: Probe.ProbeServicesApi;
    readonly transitNegotiation: Transit.TransitNegotiationApi; readonly transitDelivery: Transit.TransitDeliveryApi;
};
type ExpectedHttpServices = {
    telemetry?: Telemetry.NodeTelemetryApi | undefined; forwardTelemetry?: Telemetry.ForwardTelemetryApi | undefined;
    authenticateObservation?: ((header: string | undefined) => Promise<string>) | undefined;
    hostTelemetry?: Telemetry.HostTelemetryApi | undefined; probeTelemetry?: Telemetry.ProbeTelemetryApi | undefined;
    telemetryRollups?: Telemetry.TelemetryRollupApi | undefined; diagnostics?: Diagnostics.ForwardDiagnosticsApi | undefined;
    audit?: Audit.AuditEventsApi | undefined; stationAlerts?: Alerts.StationAlertsApi | undefined;
    notificationEndpoints?: Notification.NotificationEndpointsApi | undefined; notificationDeliveries?: Notification.NotificationDeliveriesApi | undefined;
    probeRuns?: ProbeHistory.ProbeRunsApi | undefined; probePlans?: ProbePlans.ProbePlansApi | undefined;
    observationServices?: ObservationServices.ObservationServicesApi | undefined;
};
type ExpectedAdmission = { allow(): Promise<void>; read(): Promise<{ maintenance: boolean }> };
type ExpectedHttpOptions = { control: Api.ControlApi; runtime: Native.NativeRuntimeMachinePort; authority: ExpectedAdmission;
    services?: ExpectedHttpServices; requests?: Pick<Framework.RequestLifecycle, 'run'> };
type ExpectedPositionalApp = [
    control: Api.ControlApi, runtime: Native.NativeRuntimeMachinePort, authority: ExpectedAdmission,
    telemetry?: ExpectedHttpServices['telemetry'], forwardTelemetry?: ExpectedHttpServices['forwardTelemetry'],
    telemetryAuthenticate?: ExpectedHttpServices['authenticateObservation'], hostTelemetry?: ExpectedHttpServices['hostTelemetry'],
    probeTelemetry?: ExpectedHttpServices['probeTelemetry'], telemetryRollups?: ExpectedHttpServices['telemetryRollups'],
    diagnostics?: ExpectedHttpServices['diagnostics'], audit?: ExpectedHttpServices['audit'], stationAlerts?: ExpectedHttpServices['stationAlerts'],
    notificationEndpoints?: ExpectedHttpServices['notificationEndpoints'], notificationDeliveries?: ExpectedHttpServices['notificationDeliveries'],
    probeRuns?: ExpectedHttpServices['probeRuns'], probePlans?: ExpectedHttpServices['probePlans'], observationServices?: ExpectedHttpServices['observationServices'],
];
export type NativeHonoAggregateCompleteTypes135 = [
    Same<Equal<NativeHttp.NativeControlHttpEnvironment, ExpectedEnvironment>>, Same<Equal<Api.NativeControlHttpEnvironment, ExpectedEnvironment>>,
    Same<Equal<RequiredKeys<NativeHttp.NativeControlHttpEnvironment>, 'Bindings' | 'Variables'>>,
    Same<Equal<RequiredKeys<NativeHttp.NativeControlHttpEnvironment['Variables']>, 'actor' | 'node' | 'requestId' | 'fingerprint'>>,
    Same<Equal<MutableKeys<NativeHttp.NativeControlHttpEnvironment['Variables']>, 'actor' | 'node' | 'requestId' | 'fingerprint'>>,
    Same<Equal<Api.NativeControlHttpApp, Hono<ExpectedEnvironment>>>, Same<Equal<NativeHttp.NativeControlHttpApp, Hono<ExpectedEnvironment>>>,
    Same<Equal<Flat<Api.ControlApi>, Flat<ExpectedControlApi>>>, Same<Equal<Api.AuthorityAdmission, ExpectedAdmission>>,
    Same<Equal<Api.ControlHttpServices, ExpectedHttpServices>>, Same<Equal<Api.ControlHttpOptions, ExpectedHttpOptions>>,
    Same<Equal<RequiredKeys<Api.ControlApi>, keyof ExpectedControlApi>>,
    Same<Equal<ReadonlyKeys<Api.ControlApi>, Exclude<keyof ExpectedControlApi, keyof Forward.ForwardCommandApi>>>,
    Same<Equal<RequiredKeys<Api.ControlHttpServices>, never>>, Same<Equal<MutableKeys<Api.ControlHttpServices>, keyof ExpectedHttpServices>>,
    Same<Equal<RequiredKeys<Api.ControlHttpOptions>, 'control' | 'runtime' | 'authority'>>,
    Same<Equal<OptionalKeys<Api.ControlHttpOptions>, 'services' | 'requests'>>,
    Same<Equal<MutableKeys<Api.ControlHttpOptions>, keyof ExpectedHttpOptions>>,
    Same<Equal<OldApi.ControlApi, Api.ControlApi>>, Same<Equal<OldApi.AuthorityAdmission, Api.AuthorityAdmission>>,
    Same<Equal<OldApi.ControlHttpServices, Api.ControlHttpServices>>, Same<Equal<OldApi.ControlHttpOptions, Api.ControlHttpOptions>>,
    Same<Equal<Parameters<typeof createControlApp>, [options: ExpectedHttpOptions]>>,
    Same<Equal<Parameters<typeof createApp>, ExpectedPositionalApp>>,
    Same<Equal<ReturnType<typeof createControlApp>, Hono<ExpectedEnvironment>>>, Same<Equal<ReturnType<typeof createApp>, Hono<ExpectedEnvironment>>>,
    Same<Equal<Parameters<typeof NativeHttp.nativeCreateControlHttpApp>, []>>,
    Same<Equal<ReturnType<typeof NativeHttp.nativeCreateControlHttpApp>, Hono<ExpectedEnvironment>>>,
    Same<Equal<'nativeCreateControlHttpApp' extends keyof typeof Native ? true : false, false>>,
];

const root = new URL('../../../', import.meta.url);
const cache = new Map<string, ts.SourceFile>();
function source(path: string) {
    let value = cache.get(path);
    if (!value) { value = ts.createSourceFile(path, readFileSync(new URL(path, root), 'utf8'), ts.ScriptTarget.Latest, true); cache.set(path, value); }
    return value;
}
function imports(path: string, target: string) {
    return source(path).statements.filter(ts.isImportDeclaration).filter(value => value.moduleSpecifier && ts.isStringLiteral(value.moduleSpecifier) && value.moduleSpecifier.text === target)
        .flatMap(value => value.importClause?.namedBindings && ts.isNamedImports(value.importClause.namedBindings)
            ? value.importClause.namedBindings.elements.map(entry => ({ local: entry.name.text, remote: (entry.propertyName ?? entry.name).text, typeOnly: value.importClause!.isTypeOnly || entry.isTypeOnly })) : []);
}
function files(directory: string): string[] {
    return readdirSync(new URL(directory + '/', root), { withFileTypes: true }).flatMap(entry => entry.isDirectory()
        ? files(directory + '/' + entry.name) : entry.name.endsWith('.ts') ? [directory + '/' + entry.name] : []);
}

test('117 actual Node canonical service command policy API effects and retained old test consumers keep their explicit local/public type sources', () => {
    const local: [string, string, string[]][] = [
        ['service', './management-contracts.ts', ['NodePolicy', 'NodeManagementCommand', 'NodeManagementChange', 'NodeManagementWriter']],
        ['service', './grant-contracts.ts', ['NodeGrantWriter']],
        ['commands', './management-contracts.ts', ['NodeManagementCommand', 'NodeManagementWriter']],
        ['commands', './command-api.ts', ['NodeChangeResponse', 'NodeManagementApi']],
        ['commands', './command-effects.ts', ['NodeManagementEffects']],
        ['policy', './management-contracts.ts', ['NodeManagementCommand']],
        ['command-api', './management-contracts.ts', ['NodeManagementCommand']],
        ['command-effects', './management-contracts.ts', ['NodeManagementChange']],
    ];
    for (const [file, target, names] of local) assert.deepEqual(imports(`apps/control/src/modules/node-owner/${file}.ts`, target),
        names.map(name => ({ local: name, remote: name, typeOnly: true })), file);
    for (const [path, target, names] of [
        ['apps/control/test/node-management-ports.test.ts', '../src/modules/node-management-ports.ts', ['AuthorizedNodeFacts', 'NodeManagementAudit', 'NodeManagementCommand', 'NodeManagementWriter', 'NodePolicy']],
        ['apps/control/test/access-command-ports.test.ts', '../src/modules/node-grant-ports.ts', ['NodeGrantWriter']],
        ['apps/control/test/planner.test.ts', '../src/modules/runtime/planner.ts', ['AuthorizedNodeFacts', 'ReservedSlot', 'SnapshotInput']],
        ['apps/control/src/api/routes.ts', '../modules/node-owner/public.ts', ['NodePolicy']],
    ] as const) {
        const values = path === 'apps/control/test/planner.test.ts' ? ['compileDirect', 'compileSnapshot'] : [];
        assert.deepEqual(imports(path, target), [
            ...values.map(name => ({ local: name, remote: name, typeOnly: false })),
            ...names.map(name => ({ local: name, remote: name, typeOnly: true })),
        ], path);
    }
});

test('117/125/127/130/135 moved public facts each have one canonical declaration and no current private-path declaration augmentation', () => {
    const canonical: [string, string[]][] = [
        ['apps/control/src/framework/node-facts.ts', ['AuthorizedNodeFacts']],
        ['apps/control/src/modules/node-owner/management-contracts.ts', ['NodePolicy', 'NodeManagementCommand', 'NodeManagementChange', 'NodeManagementAudit', 'NodeManagementWriter']],
        ['apps/control/src/modules/node-owner/grant-contracts.ts', ['NodeGrantState', 'NodeGrantWriter']],
        ['packages/contracts/src/execution-observation.ts', ['ExecutionPhase', 'Condition', 'Observation', 'Drain']],
        ['packages/contracts/src/execution-values.ts', ['ExecutionRole', 'RuntimeResourceValue', 'RuntimeDriverValue', 'RuntimeAssignmentValue', 'RuntimeTombstoneValue',
            'RuntimeSnapshotValue', 'RuntimeHelloRequestValue', 'RuntimeHelloResponseValue', 'RuntimeReportRequestValue', 'RuntimeReportAckValue',
            'RuntimeAssignmentSourceDriverValue', 'RuntimeValueFamily', 'RuntimeAssignmentFor', 'RuntimeSnapshotFor', 'RuntimeHelloRequestFor',
            'RuntimeHelloResponseFor', 'RuntimeReportRequestFor', 'RuntimeReportAckFor', 'RuntimeMessagesFor']],
        ['packages/contracts/src/relay.ts', ['RelayProfileConfig']],
        ['apps/control/src/compatibility/native-control-app.ts', ['NativeControlHttpEnvironment', 'NativeControlHttpApp']],
        ['apps/control/src/api/contracts.ts', ['ControlApi', 'AuthorityAdmission', 'ControlHttpServices', 'ControlHttpOptions']],
    ];
    const expected = new Map(canonical.flatMap(([path, names]) => names.map(name => [name, path] as const)));
    const found = new Map<string, string[]>(), augmentations: string[] = [];
    for (const path of [...files('packages/contracts/src'), ...files('apps/control/src'), ...files('examples'), ...files('scripts/ops'), ...files('scripts/phase1')]) {
        const file = source(path);
        function walk(node: ts.Node) {
            if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && expected.has(node.name.text)) {
                const records = found.get(node.name.text) ?? []; records.push(path); found.set(node.name.text, records);
            }
            if (ts.isModuleDeclaration(node) && ts.isStringLiteral(node.name) &&
                /(?:@tunex\/contracts(?:\/|$)|node-management-ports|node-grant-ports|node-owner\/(?:public|management-contracts|grant-contracts)|execution-observation|execution-values|native-runtime-family|transport-ports|transport-owner\/public|api\/(?:public|application-ports)|native-control-app)/.test(node.name.text))
                augmentations.push(`${path}:${node.name.text}`);
            ts.forEachChild(node, walk);
        }
        walk(file);
    }
    for (const [name, path] of expected) assert.deepEqual(found.get(name), [path], name);
    assert.deepEqual(augmentations, [], 'current in-repository source inventory has no augmentation consumer requiring a second declaration owner');
    const commonImports = source('packages/contracts/src/execution-values.ts').statements.filter(ts.isImportDeclaration);
    assert.deepEqual(commonImports.map(value => (value.moduleSpecifier as ts.StringLiteral).text), ['@tunex/core', './policy.ts', './execution-observation.ts']);
    assert.ok(commonImports.every(value => value.importClause?.isTypeOnly));
    assert.equal(source('packages/contracts/src/execution-observation.ts').statements.some(ts.isImportDeclaration), false);
});

test('135 public and original HTTP factories remain identical with Hono available only from the explicit native transport entry', () => {
    assert.equal(oldCreateApp, createApp); assert.equal(oldCreateControlApp, createControlApp);
    const general = source('apps/control/src/compatibility/public.ts');
    const exports = general.statements.filter(ts.isExportDeclaration).filter(value => value.exportClause && ts.isNamedExports(value.exportClause))
        .flatMap(value => (value.exportClause as ts.NamedExports).elements.map(entry => entry.name.text));
    assert.equal(exports.includes('nativeCreateControlHttpApp'), false);
    assert.equal(imports('apps/control/src/api/routes.ts', 'hono').length, 0);
    assert.equal(imports('apps/control/src/api/contracts.ts', 'hono').length, 0);
    assert.deepEqual(imports('apps/control/src/compatibility/native-control-app.ts', 'hono'), [{ local: 'Hono', remote: 'Hono', typeOnly: false }]);
    assert.deepEqual(imports('apps/control/src/api/routes.ts', '../compatibility/control-http/public.ts').map(value => value.local),
        ['nativeCreateControlHttpApp', 'nativeControlQueryString', 'nativeControlQueryParams', 'nativeControlRequestFingerprint', 'epoch', 'consoleHeaders', 'nativeControlProbeWithdrawal', 'NativeControlHttpApp']);
});
