import type { TargetEndpoint } from '@tunex/core';

export const FORWARD_DIAGNOSTIC_STORAGE_INTERFACE_VERSION=1 as const;

export interface DiagnosticStoragePage<T> { items: T[]; truncated: boolean }
export interface DiagnosticStorageForward {
    id: string; scopeId: string; revision: number; spec: unknown; deleting: boolean; recoverySuspended: boolean;
}
export interface DiagnosticStorageOperation {
    id: string; forwardId: string; targetRevision: number; kind: string; status: string;
    createdAt: number; updatedAt: number; executionDeadline: number;
    cleanupPending: boolean; recoveryInvalidated: boolean; sourceOperationId: string | null;
    errorCode: string | null; errorRetryable: boolean | null;
}
export interface DiagnosticStorageNode {
    nodeId: string; scopeId: string; revoked: boolean; credentialUntil: number | null;
    bootId: string | null; sessionEpoch: number; snapshotGeneration: number;
    lastReportSequence: number; receivedAt: number | null;
    snapshot: { nodeId: string; sessionEpoch: number; generation: number; issuedAt: string; validUntil: string; digest: string } | null;
    report: { nodeId: string; bootId: string; sessionEpoch: number; sequence: number; snapshotGeneration: number; observedAt: string } | null;
    invalidSnapshot: boolean; invalidReport: boolean;
}
export interface DiagnosticStorageReportContext {
    nodeId: string; bootId: string; sessionEpoch: number; sequence: number; snapshotGeneration: number;
    observedAt: string; receivedAt: number;
}
export interface DiagnosticStorageObservation {
    phase: string; condition: string; errorCode: string | null; retryable: boolean;
    report: DiagnosticStorageReportContext;
}
export interface DiagnosticStorageDrain {
    startedAt: string; deadline: string; remainingConnections: number; condition: string;
    report: DiagnosticStorageReportContext;
}
export interface DiagnosticStorageAssignment {
    nodeId: string; sessionEpoch: number; snapshotGeneration: number;
    assignmentId: string; forwardId: string; forwardRevision: number; deploymentGeneration: number; bindingFence: number;
    role: string; protocol: 'tcp' | 'udp'; phase: string; resource: { address: string; port: number; protocol: 'tcp' | 'udp' };
    driverId: string; driverSchemaVersion: number; configDigest: string;
    target: TargetEndpoint | null; peerEndpoint: TargetEndpoint | null;
    linkDigest: string | null; linkKind: 'none' | 'relay-binding' | 'hop-path';
    observation: DiagnosticStorageObservation | null; drain: DiagnosticStorageDrain | null;
}
export interface DiagnosticStorageDeployment {
    forwardId: string; generation: number; targetRevision: number; stage: string;
    createdAt: number; updatedAt: number; authorizationUntil: number; planDigest: string;
}
export interface DiagnosticStorageSlot { nodeId: string; protocol: 'tcp' | 'udp'; port: number; fence: number; deploymentGeneration: number }
export interface DiagnosticStorageRetirement {
    nodeId: string; assignmentId: string; deploymentGeneration: number; bindingFence: number;
    operationId: string; removedEpoch: number | null; retirementGeneration: number | null; safe: boolean;
}
export interface DiagnosticStorageLease {
    nodeId: string; assignmentId: string; deploymentGeneration: number; bindingFence: number; sessionEpoch: number; validUntil: number;
}
export interface DiagnosticStorageProbe {
    /** Bounded original trust context is internal only; DTOs expose compact selection, never certificate DER. */
    measurement: string; serviceContext: unknown | null;
    permitId: string; binding: unknown; state: string; issuedAt: number; expiresAt: number; closedAt: number | null;
    withdrawnAt: number | null; result: { body: unknown; digest: string; acceptedAt: number } | null;
}

/** Supplied-transaction, SELECT-only facts; no Runtime methods or credentials; bounded trust context stays internal. */
export interface ForwardDiagnosticStorage<Tx> {
    forward(tx: Tx, scope: string, id: string): Promise<DiagnosticStorageForward | null>;
    operations(tx: Tx, scope: string, id: string): Promise<DiagnosticStoragePage<DiagnosticStorageOperation>>;
    nodes(tx: Tx, scope: string, nodeIds: string[]): Promise<DiagnosticStorageNode[]>;
    assignments(tx: Tx, scope: string, id: string, nodeIds: string[]): Promise<DiagnosticStoragePage<DiagnosticStorageAssignment>>;
    deployment(tx: Tx, scope: string, id: string): Promise<DiagnosticStorageDeployment | null>;
    slots(tx: Tx, scope: string, id: string): Promise<DiagnosticStoragePage<DiagnosticStorageSlot>>;
    retirements(tx: Tx, scope: string, id: string): Promise<DiagnosticStoragePage<DiagnosticStorageRetirement>>;
    leases(tx: Tx, scope: string, id: string): Promise<DiagnosticStoragePage<DiagnosticStorageLease>>;
    probes(tx: Tx, scope: string, id: string): Promise<DiagnosticStoragePage<DiagnosticStorageProbe>>;
}
