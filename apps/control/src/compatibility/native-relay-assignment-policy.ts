import type { RuntimeAssignment, RelayConfig, MultihopConfig } from '@tunex/contracts/runtime';
import type { RuntimeRelayAssignmentPolicy, RuntimeMultihopAssignmentPolicy } from '../framework/public.ts';

/** Retain original references and unchecked access timing; the host owns policy decisions. */
export function nativeRelayAssignmentPolicy(assignment:RuntimeAssignment):RuntimeRelayAssignmentPolicy {
    return assignment.driver.config as RelayConfig;
}
export function nativeMultihopAssignmentPolicy(assignment:RuntimeAssignment):RuntimeMultihopAssignmentPolicy {
    return (assignment.driver.config as MultihopConfig).hop;
}
