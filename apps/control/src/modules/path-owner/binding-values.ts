import { deepFreeze, isCounter, isId, parseForwardSpec } from '@tunex/core';
import type { ForwardSpec } from '@tunex/core';
import { ControlError, invalid } from '../../framework/public.ts';
import type { PathTemplateConfig } from './template-contracts.ts';
import type { PathSelection } from './binding-contracts.ts';

export function parsePathSelection(input: unknown): PathSelection {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
        Object.keys(input).sort().join(',') !== 'configDigest,revision,templateId') invalid('Exact closed PathTemplate selection required');
    const value = input as Record<string, unknown>;
    if (!isId(value.templateId) || !isCounter(value.revision) || value.revision > 64 ||
        typeof value.configDigest !== 'string' || value.configDigest.length !== 71 || !/^sha256:[a-f0-9]{64}$/.test(value.configDigest))
        invalid('Exact PathTemplate ID, revision and digest required');
    return deepFreeze({ templateId: value.templateId, revision: value.revision, configDigest: value.configDigest });
}

/** A path switch preserves business intent and cannot move the physical ingress. */
export function expandPath(spec: ForwardSpec, config: PathTemplateConfig): ForwardSpec {
    if (spec.ingress.nodeId !== config.nodes[0] || spec.protocols.length !== config.protocols.length ||
        spec.protocols.some(p => !config.protocols.includes(p)))
        throw new ControlError('UNSUPPORTED_CAPABILITY', 422, 'Path switching requires the same ingress Node and business protocol set');
    const parsed = parseForwardSpec({ ...spec, path: { via: config.nodes.slice(1) }, transport: { ...config.transport } });
    if (!parsed.ok) throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid expanded native path');
    return parsed.value;
}
