import { ControlError } from './errors.ts';
import type { ProbeMachineEvidence } from '../modules/probe-negotiation-ports.ts';

/** Evidence must be read/locked in the same transaction as the caller's decision. */
export function requireProbeMachine(current: ProbeMachineEvidence | undefined, nodeId: string,
    bootId: string, epoch: number, now: number, directCapability = true): ProbeMachineEvidence {
    if (!current || current.nodeId !== nodeId || current.sessionEpoch !== epoch || current.bootId !== bootId)
        throw new ControlError('SESSION_SUPERSEDED', 409, 'Current ADP/3 boot/session required');
    if (current.revoked || current.credentialRevoked ||
        !Number.isSafeInteger(current.nodeCredentialUntil) || current.nodeCredentialUntil <= now ||
        !Number.isSafeInteger(current.credentialUntil) || current.credentialUntil <= now ||
        current.retireAfter !== null && (!Number.isSafeInteger(current.retireAfter) || current.retireAfter <= now))
        throw new ControlError('AUTHORIZATION_DENIED', 403, 'Current machine credential required');
    if (directCapability && ['adp.3', 'native.direct.v1', 'tcp'].some(c => !current.capabilities.includes(c)))
        throw new ControlError('UNSUPPORTED_CAPABILITY', 409, 'Current Direct TCP capability required');
    return current;
}
