import type { ListenEndpoint, NetworkProtocol, TargetEndpoint } from '@tunex/core';
import type { Policy } from './policy.ts';
export type { Policy } from './policy.ts';
import type { ExecutionPhase } from './execution-observation.ts';
export type { Condition, Observation, Drain } from './execution-observation.ts';
import type { RuntimeHelloRequestValue, RuntimeHelloResponseValue, RuntimeReportRequestValue, RuntimeReportAckValue } from './execution-values.ts';
export interface HelloRequest extends RuntimeHelloRequestValue {protocolVersion:2}
export interface HelloResponse extends RuntimeHelloResponseValue {protocolVersion:2}
export interface DirectConfig { target: TargetEndpoint; egressPolicyRevision: number; allowedDestinationCidrs: string[]; allowMetadataTargets: boolean }
export interface Assignment {
  assignmentId: string; forwardId: string; forwardRevision: number; deploymentGeneration: number; bindingFence: number;
  role: 'direct'; protocol: NetworkProtocol; phase: ExecutionPhase; listener: ListenEndpoint;
  driver: { id: 'native.direct.v1'; schemaVersion: 1; configDigest: string; config: DirectConfig };
  drainTimeoutSeconds: number;
}
export interface Tombstone { assignmentId: string; forwardId: string; protocol: NetworkProtocol; port: number; bindingFence: number; retirementGeneration: number }
export interface Snapshot {
  protocolVersion: 2; nodeId: string; sessionEpoch: number; snapshotGeneration: number; complete: true;
  issuedAt: string; validUntil: string; snapshotDigest: string; assignments: Assignment[]; tombstones: Tombstone[];
}
export interface ReportRequest extends RuntimeReportRequestValue {protocolVersion:2}
export interface ReportAck extends RuntimeReportAckValue {protocolVersion:2}
export interface ErrorResponse { code: string; message: string; retryable: boolean; retryAfterSeconds?: number; requestId: string }
export interface Messages { HelloRequest: HelloRequest; HelloResponse: HelloResponse; Snapshot: Snapshot; ReportRequest: ReportRequest; ReportAck: ReportAck; ErrorResponse: ErrorResponse }
export const DEFAULT_POLICY: Readonly<Policy> = Object.freeze({
  pollIntervalSeconds: 10, leaseSeconds: 300, renewalLeadSeconds: 120, maxClockSkewSeconds: 5,
  observationFreshnessSeconds: 30, drainTimeoutSeconds: 30, connectTimeoutSeconds: 10,
  udpIdleTimeoutSeconds: 60, maxTcpConnectionsPerAssignment: 1024, maxUdpSessionsPerAssignment: 4096,
  maxSnapshotBytes: 4194304, maxReportBytes: 1048576, maxAssignmentsPerNode: 1000,
});
