// Common Runtime parameters; native defaults and validation belong to their providers.
export const RUNTIME_POLICY_INTERFACE_VERSION=1 as const;
export interface Policy {
  pollIntervalSeconds: number; leaseSeconds: number; renewalLeadSeconds: number; maxClockSkewSeconds: number;
  observationFreshnessSeconds: number; drainTimeoutSeconds: number; connectTimeoutSeconds: number;
  udpIdleTimeoutSeconds: number; maxTcpConnectionsPerAssignment: number; maxUdpSessionsPerAssignment: number;
  maxSnapshotBytes: number; maxReportBytes: number; maxAssignmentsPerNode: number;
}
