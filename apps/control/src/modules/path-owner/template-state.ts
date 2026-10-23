import { isCounter, isId } from '@tunex/core';
import { ControlError } from '../../framework/public.ts';
import { nativeValueDigest as digest } from '../../compatibility/public.ts';
import { parsePathTemplate } from './template-values.ts';
import type { PathTemplateConfig, PathTemplateHead, PathTemplateRevision } from './template-contracts.ts';

export const PATH_TEMPLATE_LIMITS = { templatesPerScope: 128, revisionsPerTemplate: 64 } as const;
export const pathTemplateHash = (value: unknown): value is string => typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);
export function validateTemplateHead(record: PathTemplateHead, id = record.templateId) {
    if (record.templateId !== id || !isId(record.templateId) || !isCounter(record.currentRevision) ||
        record.currentRevision > PATH_TEMPLATE_LIMITS.revisionsPerTemplate || typeof record.archived !== 'boolean' || record.ownerActorId !== null && !isId(record.ownerActorId))
        throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid persisted PathTemplate head');
    return { ...record };
}
export function validateTemplateRevision(record: PathTemplateRevision, number: number) {
    let config: PathTemplateConfig;
    try { config = parsePathTemplate(record.config); } catch { throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid persisted PathTemplate configuration'); }
    if (record.revision !== number || !isCounter(number) || number > PATH_TEMPLATE_LIMITS.revisionsPerTemplate ||
        !isId(record.createdBy) || !Number.isSafeInteger(record.createdAt) || record.createdAt < 0 || record.createdAt > 8640000000000000 ||
        !pathTemplateHash(record.profileDigest) || !pathTemplateHash(record.configDigest) || record.configDigest !== digest({ config, profileDigest: record.profileDigest }))
        throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid persisted immutable PathTemplate revision');
    return { ...record, config };
}
