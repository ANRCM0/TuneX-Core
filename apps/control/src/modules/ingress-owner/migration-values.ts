import { deepFreeze, isCounter, isId, parseForwardSpec } from '@tunex/core';
import { nativeValueDigest as digest, jsonUtf8Bytes } from '../../compatibility/public.ts';
import { invalid } from '../../framework/public.ts';
import { parseIngressGroup, parseIngressSelection } from './values.ts';
import { parsePathSelection } from '../path-owner/public.ts';
import { parsePublicationState, publicationHash } from '../path-owner/public.ts';
import type { IngressDefinitionChange, IngressLineage, IngressMigrationAction, IngressMigrationInput, IngressMigrationItem, IngressMigrationPlan, IngressOriginRef } from './migration-contracts.ts';
import type { IngressGroupSelection } from './contracts.ts';
import type { PathSelection } from '../path-owner/public.ts';
import { INGRESS_MIGRATION_LIMITS } from './limits.ts';
export { INGRESS_MIGRATION_LIMITS } from './limits.ts';

function closed(input: unknown, keys: string): Record<string,unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype,null].includes(Object.getPrototypeOf(input)) || Object.keys(input).sort().join(',') !== keys)
        invalid('Closed ingress migration object required');
    return input as Record<string,unknown>;
}
const same = (a: unknown, b: unknown) => digest(a) === digest(b);
const bounded = (v: unknown, max = 8): v is number => isCounter(v) && v <= max;
function array(input: unknown, maximum: number, name: string): unknown[] {
    if (!Array.isArray(input) || !input.length || input.length > maximum) invalid(`Bounded nonempty ${name} required`);
    return input;
}
function groups(source: unknown, target: unknown): { sourceGroup: IngressGroupSelection; targetGroup: IngressGroupSelection } {
    const sourceGroup = parseIngressSelection(source), targetGroup = parseIngressSelection(target);
    if (sourceGroup.groupId !== targetGroup.groupId || sourceGroup.revision === targetGroup.revision) invalid('Migration requires different exact revisions of one ingress group');
    return { sourceGroup, targetGroup };
}
function uniqueRefs(refs: readonly IngressOriginRef[]): void {
    if (new Set(refs.map(ref => digest(ref))).size !== refs.length) invalid('Ingress migration origin references must be distinct');
}
export function parseIngressOriginRef(input: unknown): IngressOriginRef {
    const value = closed(input, 'batchId,kind,phase,position');
    if (!['deployment','migration'].includes(value.kind as string) || !isId(value.batchId) || !bounded(value.position) ||
        !['apply','compensate'].includes(value.phase as string) || value.kind === 'deployment' && value.phase !== 'apply') invalid('Exact retained ingress origin required');
    return deepFreeze({ kind: value.kind as IngressOriginRef['kind'], batchId: value.batchId, position: value.position, phase: value.phase as IngressOriginRef['phase'] });
}
export function parseIngressLineage(input: unknown): IngressLineage {
    const value = closed(input, 'group,memberId,ref,state,template'), ref = parseIngressOriginRef(value.ref), group = parseIngressSelection(value.group);
    const template = parsePathSelection(value.template), state = parsePublicationState(value.state);
    if (!isId(value.memberId) || !state.path || !same(template, { templateId: state.path.templateId, revision: state.path.revision, configDigest: state.path.configDigest }))
        invalid('Ingress origin must retain its exact original path provenance');
    return deepFreeze({ ref, group, memberId: value.memberId, template, state });
}
function actions(input: unknown, sourceCount: number): IngressMigrationAction[] {
    const used = new Set<number>(), members = new Set<string>();
    return array(input, INGRESS_MIGRATION_LIMITS.itemsPerBatch, 'migration actions').map(raw => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) invalid('Explicit migration action required');
        const kind = (raw as Record<string,unknown>).kind;
        if (kind === 'add') {
            const value = closed(raw, 'enabled,kind,listen,memberId,target');
            if (!isId(value.memberId) || members.has(value.memberId) || typeof value.enabled !== 'boolean') invalid('Distinct target member and explicit enabled intent required');
            const parsed = parseForwardSpec({ enabled: value.enabled, protocols: ['tcp'], ingress: { nodeId: 'ingress-migration-input', listen: value.listen }, target: value.target });
            if (!parsed.ok) invalid('Valid explicit listener and target required');
            members.add(value.memberId);
            return { kind: 'add', memberId: value.memberId, enabled: value.enabled, target: parsed.value.target, listen: parsed.value.ingress.listen };
        }
        if (kind !== 'update' && kind !== 'remove') invalid('Explicit add, update or remove action required');
        const value = closed(raw, kind === 'update' ? 'kind,memberId,source' : 'kind,source');
        if (!bounded(value.source, sourceCount) || used.has(value.source)) invalid('Each exact source may be used at most once');
        used.add(value.source);
        if (kind === 'remove') return { kind, source: value.source };
        if (!isId(value.memberId) || members.has(value.memberId)) invalid('Each target member may be used at most once');
        members.add(value.memberId);
        return { kind, memberId: value.memberId, source: value.source };
    });
}
export function parseIngressMigrationInput(input: unknown): IngressMigrationInput {
    const value = closed(input, 'items,schemaVersion,sourceGroup,sources,targetGroup');
    if (value.schemaVersion !== 1) invalid('Versioned ingress migration required');
    const selections = groups(value.sourceGroup,value.targetGroup), sources = array(value.sources, INGRESS_MIGRATION_LIMITS.sourcesPerBatch, 'migration origins').map(parseIngressOriginRef);
    uniqueRefs(sources);
    return deepFreeze({ schemaVersion: 1, ...selections, sources, items: actions(value.items,sources.length) });
}
function nullablePath(value: unknown): PathSelection | null { return value === null ? null : parsePathSelection(value); }
function parseChanges(input: unknown, source: IngressMigrationPlan['sourceDefinition'], target: IngressMigrationPlan['targetDefinition']): IngressDefinitionChange[] {
    const ids = [...new Set([...source.members,...target.members].map(member => member.memberId))].sort();
    if (!Array.isArray(input) || input.length !== ids.length || input.length > 16) invalid('Complete sorted ingress definition diff required');
    const changes = input.map((raw,index) => {
        const value = closed(raw, 'kind,memberId,sourceIngress,sourceTemplate,targetIngress,targetTemplate');
        if (value.memberId !== ids[index]) invalid('Ingress definition diff must cover the complete sorted member union');
        const sourceMember = source.members.find(member => member.memberId === value.memberId), targetMember = target.members.find(member => member.memberId === value.memberId);
        const sourceTemplate = nullablePath(value.sourceTemplate), targetTemplate = nullablePath(value.targetTemplate);
        if (!same(sourceTemplate,sourceMember?.template ?? null) || !same(targetTemplate,targetMember?.template ?? null) ||
            (sourceMember ? !isId(value.sourceIngress) : value.sourceIngress !== null) || (targetMember ? !isId(value.targetIngress) : value.targetIngress !== null)) invalid('Ingress definition diff references differ from immutable definitions');
        const kind: IngressDefinitionChange['kind'] = sourceTemplate === null ? 'added' : targetTemplate === null ? 'removed' :
            value.sourceIngress !== value.targetIngress ? 'ingress-changed' : same(sourceTemplate,targetTemplate) ? 'unchanged' : 'reference-changed';
        if (value.kind !== kind || sourceTemplate !== null && targetTemplate !== null && same(sourceTemplate,targetTemplate) && value.sourceIngress !== value.targetIngress)
            invalid('Ingress definition diff classification is inconsistent');
        return { memberId: value.memberId as string, kind, sourceTemplate, targetTemplate, sourceIngress: value.sourceIngress as string | null, targetIngress: value.targetIngress as string | null };
    });
    for (const key of ['sourceIngress','targetIngress'] as const) {
        const nodes = changes.map(change => change[key]).filter(node => node !== null);
        if (new Set(nodes).size !== nodes.length) invalid('Ingress definition Nodes must be distinct');
    }
    return changes;
}
export function parseIngressMigrationPlan(input: unknown): IngressMigrationPlan {
    const value = closed(input, 'changes,items,schemaVersion,sourceDefinition,sourceGroup,sources,targetDefinition,targetGroup');
    if (value.schemaVersion !== 1) invalid('Versioned immutable ingress migration plan required');
    const selections = groups(value.sourceGroup,value.targetGroup), sourceDefinition = parseIngressGroup(value.sourceDefinition), targetDefinition = parseIngressGroup(value.targetDefinition);
    if (digest(sourceDefinition) !== selections.sourceGroup.configDigest || digest(targetDefinition) !== selections.targetGroup.configDigest) invalid('Ingress group definitions do not match their exact selected digests');
    const changes = parseChanges(value.changes,sourceDefinition,targetDefinition), sources = array(value.sources, INGRESS_MIGRATION_LIMITS.sourcesPerBatch, 'migration source lineage').map(parseIngressLineage);
    uniqueRefs(sources.map(source => source.ref));
    if (new Set(sources.map(source => source.state.forwardId)).size !== sources.length || new Set(sources.map(source => source.memberId)).size !== sources.length) invalid('Migration sources require distinct Forward and member IDs');
    for (const source of sources) {
        const definition = sourceDefinition.members.find(member => member.memberId === source.memberId), change = changes.find(item => item.memberId === source.memberId);
        if (!same(source.group,selections.sourceGroup) || !definition || !same(source.template,definition.template) || source.state.spec.ingress.nodeId !== change?.sourceIngress) invalid('Source lineage differs from the selected immutable source definition');
    }
    if (sources.some(source => !same(source.state.spec.protocols,sources[0]!.state.spec.protocols))) invalid('Source lineage business protocols differ');
    const used = new Set<number>(), targets = new Set<string>();
    const items: IngressMigrationItem[] = array(value.items, INGRESS_MIGRATION_LIMITS.itemsPerBatch, 'migration plan items').map((raw,index) => {
        const row = closed(raw, 'kind,memberId,position,source,spec,specDigest,template');
        if (row.position !== index + 1 || !['add','update','remove'].includes(row.kind as string) || !isId(row.memberId)) invalid('Ordered explicit migration plan item required');
        const kind = row.kind as IngressMigrationItem['kind'];
        let source: number | null = null;
        if (kind === 'add') { if (row.source !== null) invalid('Add actions cannot consume an existing source'); }
        else {
            if (!bounded(row.source,sources.length) || used.has(row.source)) invalid('Migration plan reuses or omits an exact source');
            source = row.source; used.add(source);
            if (sources[source - 1]!.memberId !== row.memberId) invalid('Migration source member cannot be renamed');
        }
        if (kind === 'remove') {
            if (row.template !== null || row.spec !== null || row.specDigest !== null) invalid('Remove actions cannot carry replacement fields');
            return { position: index + 1, kind, memberId: row.memberId, source, template: null, spec: null, specDigest: null };
        }
        if (targets.has(row.memberId)) invalid('Migration target members may be used at most once');
        targets.add(row.memberId);
        const member = targetDefinition.members.find(item => item.memberId === row.memberId), change = changes.find(item => item.memberId === row.memberId);
        const template = parsePathSelection(row.template), spec = parseForwardSpec(row.spec);
        if (!member || !same(member.template,template) || !spec.ok || !spec.value.path || spec.value.path.via.length > 7 || !publicationHash(row.specDigest) || row.specDigest !== digest(spec.value) || spec.value.ingress.nodeId !== change?.targetIngress)
            invalid('Exact native target spec must match its target member and ingress');
        if (kind === 'update') {
            const previous = sources[source! - 1]!.state.spec;
            if (previous.ingress.nodeId !== spec.value.ingress.nodeId || !same(previous.protocols,spec.value.protocols) ||
                digest({ ...previous, path: spec.value.path, transport: spec.value.transport }) !== row.specDigest) invalid('Migration updates may change only path and Profile, never ingress or business intent');
        }
        return { position: index + 1, kind, memberId: row.memberId, source, template, spec: spec.value, specDigest: row.specDigest };
    });
    const targetItems = items.filter(item => item.kind !== 'remove');
    if (targetItems.some(item => !same(item.spec!.protocols,targetItems[0]!.spec!.protocols))) invalid('Target migration business protocols differ');
    for (const item of items) if (item.kind === 'add') {
        const sourceIndex = sources.findIndex(source => source.memberId === item.memberId);
        if (sourceIndex >= 0) {
            if (!items.some(action => action.kind === 'remove' && action.source === sourceIndex + 1)) invalid('Replacing a selected member requires an explicit source removal, never a duplicate add');
        }
    }
    const plan: IngressMigrationPlan = { schemaVersion: 1, ...selections, sourceDefinition, targetDefinition, sources, changes, items };
    if (jsonUtf8Bytes(plan) > INGRESS_MIGRATION_LIMITS.maxPlanBytes) invalid('Ingress migration plan exceeds bounded storage');
    return deepFreeze(plan);
}
