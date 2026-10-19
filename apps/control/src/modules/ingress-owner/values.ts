import { deepFreeze, isCounter, isId, parseForwardSpec } from '@tunex/core';
import { nativeValueDigest as digest, jsonUtf8Bytes } from '../../compatibility/public.ts';
import { invalid } from '../../framework/public.ts';
import { parsePathSelection } from '../path-owner/public.ts';
import { publicationHash } from '../path-owner/public.ts';
import type { IngressDeploymentInput, IngressGroupConfig, IngressGroupSelection, IngressPlan } from './contracts.ts';
import { INGRESS_LIMITS } from './limits.ts';
export { INGRESS_LIMITS } from './limits.ts';

function closed(input: unknown, keys: string): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
        Object.keys(input).sort().join(',') !== keys) invalid('Closed ingress object required');
    return input as Record<string, unknown>;
}
export function parseIngressGroup(input: unknown): IngressGroupConfig {
    const value = closed(input, 'members,schemaVersion');
    if (value.schemaVersion !== 1 || !Array.isArray(value.members) || !value.members.length || value.members.length > INGRESS_LIMITS.membersPerGroup)
        invalid('One to eight explicit complete ingress members required');
    const members = value.members.map(item => {
        const member = closed(item, 'memberId,template'); if (!isId(member.memberId)) invalid('Valid ingress member ID required');
        return { memberId: member.memberId, template: parsePathSelection(member.template) };
    });
    if (new Set(members.map(item => item.memberId)).size !== members.length || new Set(members.map(item => item.template.configDigest)).size !== members.length)
        invalid('Ingress member IDs and complete paths must be distinct');
    return deepFreeze({ schemaVersion: 1, members });
}
export function parseIngressSelection(input: unknown): IngressGroupSelection {
    const value = closed(input, 'configDigest,groupId,revision');
    if (!isId(value.groupId) || !isCounter(value.revision) || value.revision > INGRESS_LIMITS.revisionsPerGroup || !publicationHash(value.configDigest))
        invalid('Exact ingress group revision and digest required');
    return deepFreeze({ groupId: value.groupId, revision: value.revision, configDigest: value.configDigest });
}
export function parseIngressInput(input: unknown): IngressDeploymentInput {
    const value = closed(input, 'enabled,group,items,schemaVersion,target');
    if (value.schemaVersion !== 1 || typeof value.enabled !== 'boolean' || !Array.isArray(value.items) || !value.items.length || value.items.length > INGRESS_LIMITS.itemsPerBatch)
        invalid('Explicit enabled intent and one to eight ingress listeners required');
    const target = closed(value.target, 'host,port'), group = parseIngressSelection(value.group);
    const items = value.items.map(item => {
        const row = closed(item, 'listen,memberId'); if (!isId(row.memberId)) invalid('Exact ingress member required');
        const listen = closed(row.listen, 'address,port');
        const parsed = parseForwardSpec({ enabled: value.enabled, protocols: ['tcp'], ingress: { nodeId: 'ingress-input', listen }, target });
        if (!parsed.ok) invalid('Valid explicit listener and target required');
        return { memberId: row.memberId, listen: parsed.value.ingress.listen };
    });
    if (new Set(items.map(item => item.memberId)).size !== items.length) invalid('Ingress member cannot expand more than once');
    const parsedTarget = parseForwardSpec({ enabled: value.enabled, protocols: ['tcp'], ingress: { nodeId: 'ingress-input', listen: items[0]!.listen }, target });
    if (!parsedTarget.ok) invalid('Valid shared target required');
    return deepFreeze({ schemaVersion: 1, group, enabled: value.enabled, target: parsedTarget.value.target, items });
}
export function parseIngressPlan(input: unknown): IngressPlan {
    const value = closed(input, 'group,items,schemaVersion');
    if (value.schemaVersion !== 1 || !Array.isArray(value.items) || !value.items.length || value.items.length > INGRESS_LIMITS.itemsPerBatch)
        invalid('Bounded immutable ingress plan required');
    const group = parseIngressSelection(value.group), items = value.items.map((item, index) => {
        const row = closed(item, 'memberId,position,spec,specDigest,template'), spec = parseForwardSpec(row.spec);
        if (row.position !== index + 1 || !isId(row.memberId) || !spec.ok || !spec.value.path || spec.value.path.via.length > 7 ||
            !publicationHash(row.specDigest) || row.specDigest !== digest(spec.value)) invalid('Exact native ingress plan item required');
        return { position: index + 1, memberId: row.memberId, template: parsePathSelection(row.template), spec: spec.value, specDigest: row.specDigest };
    });
    const first = items[0]!;
    if (new Set(items.map(item => item.memberId)).size !== items.length || new Set(items.map(item => item.spec.ingress.nodeId)).size !== items.length ||
        items.some(item => item.spec.enabled !== first.spec.enabled || digest(item.spec.target) !== digest(first.spec.target) || digest(item.spec.protocols) !== digest(first.spec.protocols)))
        invalid('Each ingress expands once with distinct Nodes, shared protocols, target and enabled intent');
    const plan: IngressPlan = { schemaVersion: 1, group, items };
    if (jsonUtf8Bytes(plan) > INGRESS_LIMITS.maxPlanBytes) invalid('Ingress plan exceeds bounded storage');
    return deepFreeze(plan);
}
