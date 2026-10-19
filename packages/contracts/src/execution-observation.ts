// Current execution facts; envelopes, parsers and native driver formats stay outside.
export const EXECUTION_OBSERVATION_INTERFACE_VERSION=1 as const;
export type ExecutionPhase = 'prepared' | 'active' | 'draining';
export type Condition = 'pending' | 'prepared' | 'ready' | 'degraded' | 'error' | 'draining' | 'removed';
export interface Observation {
  assignmentId: string; deploymentGeneration: number; bindingFence: number;
  phase: ExecutionPhase | 'absent'; condition: Condition; errorCode: string | null; retryable: boolean;
}
export interface Drain {
  assignmentId: string; deploymentGeneration: number; bindingFence: number; startedAt: string;
  deadline: string; remainingConnections: number; condition: 'draining' | 'removed';
}
