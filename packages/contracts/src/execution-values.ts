import type { NetworkProtocol } from '@tunex/core';
import type { Policy } from './policy.ts';
import type { ExecutionPhase, Observation, Drain } from './execution-observation.ts';

export const RUNTIME_VALUES_INTERFACE_VERSION=2 as const;
export type ExecutionRole='direct'|'relay-ingress'|'relay-egress'|'multihop-ingress'|'multihop-transit'|'multihop-egress';
export interface RuntimeResourceValue {address:string;port:number;protocol:NetworkProtocol}
export interface RuntimeDriverValue {id:string;configDigest:string}
export interface RuntimeAssignmentValue<Driver extends RuntimeDriverValue=RuntimeDriverValue> {
    assignmentId:string;forwardId:string;forwardRevision:number;deploymentGeneration:number;bindingFence:number;
    role:ExecutionRole;protocol:NetworkProtocol;phase:ExecutionPhase;resource:RuntimeResourceValue;
    driver:Driver;drainTimeoutSeconds:number;
}
export interface RuntimeTombstoneValue {
    assignmentId:string;forwardId:string;role:ExecutionRole;protocol:NetworkProtocol;physicalProtocol:NetworkProtocol;
    port:number;bindingFence:number;retirementGeneration:number;
}
export interface RuntimeSnapshotValue<Assignment extends RuntimeAssignmentValue=RuntimeAssignmentValue> {
    nodeId:string;sessionEpoch:number;snapshotGeneration:number;complete:true;issuedAt:string;validUntil:string;
    snapshotDigest:string;assignments:Assignment[];tombstones:RuntimeTombstoneValue[];
}
export interface RuntimeHelloRequestValue {
    nodeId:string;bootId:string;agentBuild:string;capabilities:string[];lastStoredSnapshotGeneration:number;
}
export interface RuntimeHelloResponseValue {nodeId:string;bootId:string;sessionEpoch:number;serverTime:string;policy:Policy}
export interface RuntimeReportRequestValue {
    nodeId:string;bootId:string;sessionEpoch:number;reportSequence:number;observedAt:string;
    acceptedSnapshotGeneration:number;observations:Observation[];drains:Drain[];
}
export interface RuntimeReportAckValue {
    nodeId:string;bootId:string;sessionEpoch:number;reportSequence:number;status:'accepted'|'duplicate';
}
export interface RuntimeAssignmentSourceDriverValue {
    readonly id:string;readonly schemaVersion:number;readonly roles:readonly Exclude<ExecutionRole,'direct'>[];
}

/** Erased outer-format bindings; no native protocol or driver is a lower default. */
export interface RuntimeValueFamily {
    readonly relayProfile:unknown;
    readonly driver:RuntimeDriverValue;
    readonly sourceDriver:RuntimeAssignmentSourceDriverValue;
    readonly helloRequest:object;
    readonly helloResponse:object;
    readonly snapshot:object;
    readonly reportRequest:object;
    readonly reportAck:object;
}
export type RuntimeAssignmentFor<F extends RuntimeValueFamily=RuntimeValueFamily>=RuntimeAssignmentValue<F['driver']>;
export type RuntimeSnapshotFor<F extends RuntimeValueFamily=RuntimeValueFamily>=RuntimeSnapshotValue<RuntimeAssignmentFor<F>>&F['snapshot'];
export type RuntimeHelloRequestFor<F extends RuntimeValueFamily=RuntimeValueFamily>=RuntimeHelloRequestValue&F['helloRequest'];
export type RuntimeHelloResponseFor<F extends RuntimeValueFamily=RuntimeValueFamily>=RuntimeHelloResponseValue&F['helloResponse'];
export type RuntimeReportRequestFor<F extends RuntimeValueFamily=RuntimeValueFamily>=RuntimeReportRequestValue&F['reportRequest'];
export type RuntimeReportAckFor<F extends RuntimeValueFamily=RuntimeValueFamily>=RuntimeReportAckValue&F['reportAck'];
export interface RuntimeMessagesFor<F extends RuntimeValueFamily=RuntimeValueFamily> {
    HelloRequest:RuntimeHelloRequestFor<F>;HelloResponse:RuntimeHelloResponseFor<F>;
    Snapshot:RuntimeSnapshotFor<F>;ReportRequest:RuntimeReportRequestFor<F>;ReportAck:RuntimeReportAckFor<F>;
}
