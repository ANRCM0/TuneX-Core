import type { ListenEndpoint, NetworkProtocol, TargetEndpoint } from '@tunex/core';
export interface Policy {
  pollIntervalSeconds: number; leaseSeconds: number; renewalLeadSeconds: number; maxClockSkewSeconds: number;
  observationFreshnessSeconds: number; drainTimeoutSeconds: number; connectTimeoutSeconds: number;
  udpIdleTimeoutSeconds: number; maxTcpConnectionsPerAssignment: number; maxUdpSessionsPerAssignment: number;
  maxSnapshotBytes: number; maxReportBytes: number; maxAssignmentsPerNode: number;
}
export interface HelloRequest {
  protocolVersion: 2; nodeId: string; bootId: string; agentBuild: string; capabilities: string[]; lastStoredSnapshotGeneration: number;
}
export interface HelloResponse { protocolVersion: 2; nodeId: string; bootId: string; sessionEpoch: number; serverTime: string; policy: Policy }
export interface DirectConfig { target: TargetEndpoint; egressPolicyRevision: number; allowedDestinationCidrs: string[]; allowMetadataTargets: boolean }
export interface Assignment {
  assignmentId: string; forwardId: string; forwardRevision: number; deploymentGeneration: number; bindingFence: number;
  role: 'direct'; protocol: NetworkProtocol; phase: 'prepared' | 'active' | 'draining'; listener: ListenEndpoint;
  driver: { id: 'native.direct.v1'; schemaVersion: 1; configDigest: string; config: DirectConfig };
  drainTimeoutSeconds: number;
}
export interface Tombstone { assignmentId: string; forwardId: string; protocol: NetworkProtocol; port: number; bindingFence: number; retirementGeneration: number }
export interface Snapshot {
  protocolVersion: 2; nodeId: string; sessionEpoch: number; snapshotGeneration: number; complete: true;
  issuedAt: string; validUntil: string; snapshotDigest: string; assignments: Assignment[]; tombstones: Tombstone[];
}
export type Condition = 'pending' | 'prepared' | 'ready' | 'degraded' | 'error' | 'draining' | 'removed';
export interface Observation {
  assignmentId: string; deploymentGeneration: number; bindingFence: number;
  phase: Assignment['phase'] | 'absent'; condition: Condition; errorCode: string | null; retryable: boolean;
}
export interface Drain {
  assignmentId: string; deploymentGeneration: number; bindingFence: number; startedAt: string;
  deadline: string; remainingConnections: number; condition: 'draining' | 'removed';
}
export interface ReportRequest {
  protocolVersion: 2; nodeId: string; bootId: string; sessionEpoch: number; reportSequence: number;
  observedAt: string; acceptedSnapshotGeneration: number; observations: Observation[]; drains: Drain[];
}
export interface ReportAck { protocolVersion: 2; nodeId: string; bootId: string; sessionEpoch: number; reportSequence: number; status: 'accepted' | 'duplicate' }
export interface ErrorResponse { code: string; message: string; retryable: boolean; retryAfterSeconds?: number; requestId: string }
export interface Messages { HelloRequest: HelloRequest; HelloResponse: HelloResponse; Snapshot: Snapshot; ReportRequest: ReportRequest; ReportAck: ReportAck; ErrorResponse: ErrorResponse }
export const DEFAULT_POLICY: Readonly<Policy> = Object.freeze({
  pollIntervalSeconds: 10, leaseSeconds: 300, renewalLeadSeconds: 120, maxClockSkewSeconds: 5,
  observationFreshnessSeconds: 30, drainTimeoutSeconds: 30, connectTimeoutSeconds: 10,
  udpIdleTimeoutSeconds: 60, maxTcpConnectionsPerAssignment: 1024, maxUdpSessionsPerAssignment: 4096,
  maxSnapshotBytes: 4194304, maxReportBytes: 1048576, maxAssignmentsPerNode: 1000,
});
