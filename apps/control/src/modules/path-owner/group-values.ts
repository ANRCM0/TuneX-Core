import { deepFreeze, isCounter, isId } from '@tunex/core';
import { invalid } from '../../framework/public.ts';
import { parsePathSelection } from './binding-values.ts';
import type { PathGroupConfig, PathGroupSelection } from './group-contracts.ts';
import { PATH_GROUP_LIMITS } from './limits.ts';
export type { PathGroupConfig, PathGroupSelection } from './group-contracts.ts';
export { PATH_GROUP_LIMITS } from './limits.ts';

function closed(input: unknown, keys: string): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(input)) || Object.keys(input).sort().join(',') !== keys)
        invalid('Closed native path group object required');
    return input as Record<string, unknown>;
}
export function parsePathGroupConfig(input: unknown): PathGroupConfig {
    const value = closed(input, 'candidates,kind,schemaVersion');
    if (value.schemaVersion !== 1 || !['egress-candidates', 'backup-paths'].includes(value.kind as string) ||
        !Array.isArray(value.candidates) || !value.candidates.length || value.candidates.length > PATH_GROUP_LIMITS.candidatesPerGroup)
        invalid('Versioned group with one to eight ordered complete paths required');
    const candidates = value.candidates.map(item => {
        const candidate = closed(item, 'candidateId,template');
        if (!isId(candidate.candidateId)) invalid('Valid unique candidate ID required');
        return { candidateId: candidate.candidateId, template: parsePathSelection(candidate.template) };
    });
    if (new Set(candidates.map(item => item.candidateId)).size !== candidates.length ||
        new Set(candidates.map(item => item.template.configDigest)).size !== candidates.length)
        invalid('Candidate IDs and complete path digests must be distinct');
    return deepFreeze({ schemaVersion: 1, kind: value.kind as PathGroupConfig['kind'], candidates });
}
export function parsePathGroupSelection(input: unknown): PathGroupSelection {
    const value = closed(input, 'candidateId,configDigest,groupId,revision');
    if (!isId(value.groupId) || !isId(value.candidateId) || !isCounter(value.revision) ||
        value.revision > PATH_GROUP_LIMITS.revisionsPerGroup || typeof value.configDigest !== 'string' || value.configDigest.length !== 71 ||
        !/^sha256:[a-f0-9]{64}$/.test(value.configDigest)) invalid('Exact group, revision, digest and explicit candidate required');
    return deepFreeze({ groupId: value.groupId, revision: value.revision, configDigest: value.configDigest, candidateId: value.candidateId });
}
