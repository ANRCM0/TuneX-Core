import { deepFreeze, isCounter, isId, parseForwardSpec } from '@tunex/core';
import { nativeValueDigest as digest, jsonUtf8Bytes } from '../../compatibility/public.ts';
import { ControlError, invalid } from '../../framework/public.ts';
import { parsePathGroupSelection } from './group-values.ts';
import { parsePathSelection } from './binding-values.ts';
import type { PathPublicationInput, PathPublicationPlan, PublicationForwardState } from './publication-contracts.ts';
import { PATH_PUBLICATION_LIMITS } from './limits.ts';
export { PATH_PUBLICATION_LIMITS } from './limits.ts';

export const PATH_PUBLICATION_REJECTIONS = new Set([
    'REVISION_CONFLICT', 'AUTHORIZATION_DENIED', 'GROUP_ARCHIVED', 'TEMPLATE_ARCHIVED', 'RESOURCE_LIMIT',
    'PORT_RESERVED', 'UNSUPPORTED_CAPABILITY', 'REVISION_EXHAUSTED', 'PUBLICATION_STATE_CHANGED', 'NOT_FOUND', 'RESOURCE_CONFLICT',
]);
export const publicationHash = (value: unknown): value is string => typeof value === 'string' && value.length === 71 && /^sha256:[a-f0-9]{64}$/.test(value);
function closed(input: unknown, keys: string): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(input)) || Object.keys(input).sort().join(',') !== keys)
        invalid('Closed path publication object required');
    return input as Record<string, unknown>;
}
export function parsePathPublicationInput(input: unknown): PathPublicationInput {
    const value = closed(input, 'group,items,schemaVersion');
    if (value.schemaVersion !== 1 || !Array.isArray(value.items) || !value.items.length || value.items.length > PATH_PUBLICATION_LIMITS.itemsPerBatch)
        invalid('One to ten explicit Forward references required');
    const group = parsePathGroupSelection(value.group), items = value.items.map(item => {
        const row = closed(item, 'expectedRevision,forwardId');
        if (!isId(row.forwardId) || !isCounter(row.expectedRevision)) invalid('Exact Forward ID and expectedRevision required');
        return { forwardId: row.forwardId, expectedRevision: row.expectedRevision };
    });
    if (new Set(items.map(item => item.forwardId)).size !== items.length) invalid('Publication Forward IDs must be distinct');
    return deepFreeze({ schemaVersion: 1, group, items });
}
export function parsePublicationState(input: unknown): PublicationForwardState {
    const value = closed(input, 'forwardId,group,path,revision,spec,specDigest');
    const spec = parseForwardSpec(value.spec);
    if (!isId(value.forwardId) || !isCounter(value.revision) || !spec.ok || !publicationHash(value.specDigest) ||
        value.specDigest !== digest(spec.value) || (spec.value.path?.via.length ?? 0) > 7) invalid('Bounded original Forward state required');
    let path: PublicationForwardState['path'] = null, group: PublicationForwardState['group'] = null;
    if (value.path !== null) {
        const raw = closed(value.path, 'configDigest,forwardRevision,revision,sequence,templateId');
        const selection = parsePathSelection({ templateId: raw.templateId, revision: raw.revision, configDigest: raw.configDigest });
        if (!isCounter(raw.sequence) || raw.sequence > 64 || !isCounter(raw.forwardRevision) || raw.forwardRevision > value.revision)
            invalid('Exact path provenance guard required');
        path = { ...selection, sequence: raw.sequence, forwardRevision: raw.forwardRevision };
    }
    if (value.group !== null) {
        const raw = closed(value.group, 'candidateId,configDigest,forwardRevision,groupId,pathBindingSequence,revision,sequence');
        const selection = parsePathGroupSelection({ groupId: raw.groupId, revision: raw.revision, configDigest: raw.configDigest, candidateId: raw.candidateId });
        if (!path || !isCounter(raw.sequence) || raw.sequence > 64 || raw.pathBindingSequence !== path.sequence ||
            !isCounter(raw.forwardRevision) || raw.forwardRevision > value.revision) invalid('Exact group provenance guard required');
        group = { ...selection, sequence: raw.sequence, pathBindingSequence: path.sequence, forwardRevision: raw.forwardRevision };
    }
    if (path && !spec.value.path) invalid('Path provenance requires a native path');
    return deepFreeze({ forwardId: value.forwardId, revision: value.revision, spec: spec.value, specDigest: value.specDigest, path, group });
}
export function parsePathPublicationPlan(input: unknown): PathPublicationPlan {
    const value = closed(input, 'group,items,schemaVersion');
    if (value.schemaVersion !== 1 || !Array.isArray(value.items) || !value.items.length || value.items.length > PATH_PUBLICATION_LIMITS.itemsPerBatch)
        invalid('Bounded immutable publication plan required');
    const group = parsePathGroupSelection(value.group), items = value.items.map((item, index) => {
        const row = closed(item, 'position,proposedDigest,proposedSpec,source,template'), source = parsePublicationState(row.source);
        const spec = parseForwardSpec(row.proposedSpec), template = parsePathSelection(row.template);
        if (row.position !== index + 1 || !spec.ok || !publicationHash(row.proposedDigest) || row.proposedDigest !== digest(spec.value) ||
            !spec.value.path || spec.value.path.via.length > 7 ||
            digest({ ...source.spec, path: spec.value.path, transport: spec.value.transport }) !== row.proposedDigest)
            invalid('Publication may replace only the exact native path and Profile');
        return { position: index + 1, source, template, proposedSpec: spec.value, proposedDigest: row.proposedDigest };
    });
    if (new Set(items.map(item => item.source.forwardId)).size !== items.length) invalid('Immutable plan repeats a Forward');
    const plan: PathPublicationPlan = { schemaVersion: 1, group, items };
    if (jsonUtf8Bytes(plan) > PATH_PUBLICATION_LIMITS.maxPlanBytes) invalid('Publication plan exceeds bounded storage');
    return deepFreeze(plan);
}
export function checkedPublicationPlan(input: unknown): PathPublicationPlan {
    try { return parsePathPublicationPlan(input); }
    catch { throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid persisted path publication plan'); }
}
