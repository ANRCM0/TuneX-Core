import { deepFreeze, isCounter, isId } from '@tunex/core';
import { invalid } from '../../framework/public.ts';
import type { PathTemplateConfig } from './template-contracts.ts';
export type { PathTemplateConfig } from './template-contracts.ts';
function object(input: unknown, fields: string[]): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
        Object.keys(input).sort().join(',') !== fields.sort().join(',')) invalid('Closed PathTemplate fields required');
    return input as Record<string, unknown>;
}
export function parsePathTemplate(input: unknown): PathTemplateConfig {
    const value = object(input, ['version', 'protocols', 'nodes', 'endpoints', 'transport']);
    if (value.version !== 1 || !Array.isArray(value.protocols) || !value.protocols.length || value.protocols.length > 2 ||
        value.protocols.some(p => !['tcp', 'udp'].includes(p)) || new Set(value.protocols).size !== value.protocols.length ||
        !Array.isArray(value.nodes) || value.nodes.length < 2 || value.nodes.length > 8 ||
        value.nodes.some(node => !isId(node)) || new Set(value.nodes).size !== value.nodes.length ||
        !Array.isArray(value.endpoints) || value.endpoints.length !== value.nodes.length - 1)
        invalid('A native template requires two to eight distinct ordered Nodes and bounded protocols');
    const endpoints = value.endpoints.map((input, index) => {
        const endpoint = object(input, ['nodeId', 'revision']);
        if (endpoint.nodeId !== (value.nodes as unknown[])[index + 1] || !isCounter(endpoint.revision))
            invalid('Exact ordered downstream Endpoint revisions required');
        return { nodeId: endpoint.nodeId as string, revision: endpoint.revision as number };
    });
    const profile = object(value.transport, ['profileId', 'configRevision']);
    if (!isId(profile.profileId) || !isCounter(profile.configRevision)) invalid('Locked native Transport Profile required');
    return deepFreeze({ version: 1, protocols: (['tcp', 'udp'] as const).filter(p => (value.protocols as unknown[]).includes(p)),
        nodes: [...value.nodes as string[]], endpoints,
        transport: { profileId: profile.profileId, configRevision: profile.configRevision } });
}
export function pathRequirements(config: PathTemplateConfig) {
    return ['adp.3', 'native.relay.v1', 'relay.wire.1', ...(config.nodes.length > 2 ?
        ['adp.execution.1', 'native.multihop.v1', 'multihop.wire.1'] : []), ...config.protocols];
}
