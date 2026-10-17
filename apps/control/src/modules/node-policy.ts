import { deepFreeze, isCounter, isPort, normalizeIp } from '@tunex/core';
import { validCidr } from '@tunex/contracts';
import { invalid } from '../application/errors.ts';
import type { NodeManagementCommand, NodePolicy } from './node-management-ports.ts';

export function validatePolicy(policy: NodePolicy): void {
    if (!policy || typeof policy !== 'object' || Array.isArray(policy) || Object.keys(policy).sort().join(',') !== ['allowedDestinationCidrs', 'allowedListenerAddresses', 'allowedPorts', 'allowMetadataTargets', 'egressPolicyRevision'].sort().join(',') || !Array.isArray(policy.allowedListenerAddresses) || policy.allowedListenerAddresses.length === 0 || policy.allowedListenerAddresses.length > 256 || policy.allowedListenerAddresses.some(a => typeof a !== 'string' || normalizeIp(a) !== a) || new Set(policy.allowedListenerAddresses).size !== policy.allowedListenerAddresses.length || !Array.isArray(policy.allowedPorts) || policy.allowedPorts.length === 0 || policy.allowedPorts.length > 65535 || policy.allowedPorts.some(p => !isPort(p)) || new Set(policy.allowedPorts).size !== policy.allowedPorts.length || !isCounter(policy.egressPolicyRevision) || !Array.isArray(policy.allowedDestinationCidrs) || policy.allowedDestinationCidrs.length === 0 || policy.allowedDestinationCidrs.length > 256 || policy.allowedDestinationCidrs.some(c => typeof c !== 'string' || !validCidr(c)) || new Set(policy.allowedDestinationCidrs).size !== policy.allowedDestinationCidrs.length || typeof policy.allowMetadataTargets !== 'boolean')
        invalid('Invalid Node policy');
}

export function snapshotNodeCommand(input: NodeManagementCommand): NodeManagementCommand {
    if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('Valid Node management command required');
    if (input.kind === 'revoke' && Object.keys(input).join(',') === 'kind') return Object.freeze({ kind: 'revoke' });
    if (input.kind !== 'policy' || Object.keys(input).sort().join(',') !== 'expectedRevision,kind,policy' ||
        !isCounter(input.expectedRevision)) invalid('Valid Node policy command required');
    validatePolicy(input.policy);
    return deepFreeze({ kind: 'policy', expectedRevision: input.expectedRevision, policy: {
        ...input.policy, allowedListenerAddresses: [...input.policy.allowedListenerAddresses],
        allowedPorts: [...input.policy.allowedPorts], allowedDestinationCidrs: [...input.policy.allowedDestinationCidrs],
    } });
}
