import { deepFreeze, isCounter, isId } from '@tunex/core';
import { nativeValueDigest as digest, nativeCommandRequest as requestIdentity, nativeWallClockSource, nativeIsoTime } from '../../compatibility/public.ts';
import { pageWindow as consolePage } from '../../framework/public.ts';
import { ControlError, invalid, notFound } from '../../framework/public.ts';
import { validateTemplateHead, validateTemplateRevision } from '../path-owner/public.ts';
import type { IdempotentRequests, ScopeAuthorization, TransactionBoundary } from '../../framework/public.ts';
import { INGRESS_LIMITS, parseIngressGroup, parseIngressSelection } from './values.ts';
import type { IngressGroupConfig, IngressGroupHead, IngressGroupRevision, IngressGroupSelection, IngressGroupStore, IngressGroupMember as Member, IngressGroupResolver } from './contracts.ts';
import type { PathTemplateReader, PathTemplateReferences } from '../path-owner/public.ts';
import type { IngressGroupApi, IngressGroupResponse as GroupResponse } from './group-api.ts';

const flags = { source: 'persisted-control-state', reserved: false, executionAuthorized: false, fullPlanAuthorization: false,
    health: 'unknown', physicalConnectionSharing: false, referenceAuthorization: 'not-rechecked-by-this-query' } as const;
const time = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 8640000000000000;
function corrupt(message: string): never { throw new ControlError('INTEGRITY_FAILURE', 409, message); }
function identity(actor: string, scope: string, id?: string): void {
    if (![actor,scope,...(id === undefined ? [] : [id])].every(isId)) invalid('Valid ingress group identity required');
}
function head(value: IngressGroupHead, id: string): IngressGroupHead {
    if (!value || value.groupId !== id || !isId(id) || !isCounter(value.currentRevision) || value.currentRevision > INGRESS_LIMITS.revisionsPerGroup || typeof value.archived !== 'boolean') corrupt('Invalid ingress group head');
    return { ...value };
}
function revision(value: IngressGroupRevision, expected: number): IngressGroupRevision {
    let config: IngressGroupConfig;
    try { config = parseIngressGroup(value.config); } catch { return corrupt('Invalid immutable ingress group configuration'); }
    if (!isCounter(expected) || expected > INGRESS_LIMITS.revisionsPerGroup || value.revision !== expected || value.configDigest !== digest(config) || !isId(value.createdBy) || !time(value.createdAt)) corrupt('Invalid immutable ingress group revision');
    return { ...value, config };
}

/** Ingress definitions expand to separate original Forwards, never shared execution resources. */
export class IngressGroups<Tx> implements IngressGroupApi,IngressGroupResolver<Tx> {
    private readonly db: TransactionBoundary<Tx>;
    private readonly auth: ScopeAuthorization<Tx>;
    private readonly requests: IdempotentRequests<Tx>;
    private readonly store: IngressGroupStore<Tx>;
    private readonly templates: PathTemplateReader<Tx>;
    private readonly references: PathTemplateReferences<Tx>;
    private readonly clock: () => number;
    constructor(db: TransactionBoundary<Tx>, auth: ScopeAuthorization<Tx>, requests: IdempotentRequests<Tx>, store: IngressGroupStore<Tx>,
        templates: PathTemplateReader<Tx>, references: PathTemplateReferences<Tx>, clock: () => number = nativeWallClockSource()) {
        this.db = db; this.auth = auth; this.requests = requests; this.store = store;
        this.templates = templates; this.references = references; this.clock = clock;
    }
    private now(): number { const at = this.clock(); if (!time(at)) corrupt('Invalid ingress group command time'); return at; }
    private async members(tx: Tx, scope: string, config: IngressGroupConfig, actor?: string): Promise<Member[]> {
        const resolved = new Map<string,Member>();
        const ordered = [...config.members].sort((a,b) => a.template.templateId < b.template.templateId ? -1 : a.template.templateId > b.template.templateId ? 1 : a.template.revision - b.template.revision);
        for (const member of ordered) {
            const found = await this.templates.head(tx, scope, member.template.templateId, actor !== undefined);
            if (!found) { if (actor === undefined) corrupt('Immutable ingress template head is missing'); notFound(); }
            const metadata = validateTemplateHead(found, member.template.templateId);
            if (actor !== undefined && metadata.archived) throw new ControlError('TEMPLATE_ARCHIVED', 409, 'New ingress definitions require active templates');
            const stored = await this.templates.revision(tx, scope, member.template.templateId, member.template.revision);
            if (!stored) { if (actor === undefined) corrupt('Immutable ingress template revision is missing'); notFound(); }
            const record = validateTemplateRevision(stored, member.template.revision);
            if (record.revision > metadata.currentRevision) corrupt('Ingress template revision exceeds its head');
            if (record.configDigest !== member.template.configDigest) {
                if (actor === undefined) corrupt('Persisted ingress template digest differs');
                throw new ControlError('REVISION_CONFLICT', 409, 'Exact ingress template digest differs');
            }
            if (actor !== undefined) {
                const authorized = await this.references.validate(tx, actor, scope, record.config);
                if (authorized.profileDigest !== record.profileDigest) corrupt('Immutable ingress Profile digest differs');
            }
            resolved.set(member.memberId, { memberId: member.memberId, template: member.template, config: record.config });
        }
        const result = config.members.map(member => resolved.get(member.memberId)!);
        if (new Set(result.map(member => member.config.nodes[0])).size !== result.length || result.some(member => digest(member.config.protocols) !== digest(result[0]!.config.protocols))) {
            if (actor === undefined) corrupt('Persisted ingress members require distinct Nodes and common protocols');
            invalid('Ingress members require distinct ingress Nodes and one business protocol set');
        }
        return result;
    }
    private async load(tx: Tx, scope: string, id: string, number: number, lock = false, active = false) {
        const found = await this.store.head(tx, scope, id, lock); if (!found) notFound();
        const metadata = head(found, id);
        if (active && metadata.archived) throw new ControlError('GROUP_ARCHIVED', 409, 'Archived ingress groups cannot create deployments');
        const stored = await this.store.revision(tx, scope, id, number); if (!stored) notFound();
        const record = revision(stored, number);
        if (record.revision > metadata.currentRevision) corrupt('Ingress group revision exceeds its head');
        return { metadata, record };
    }
    async list(actor: string, scope: string, input: { page?: string | undefined; limit?: string | undefined; prefix?: string | undefined } = {}) {
        identity(actor, scope);
        if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype,null].includes(Object.getPrototypeOf(input)) || Object.keys(input).some(key => !['page','limit','prefix'].includes(key)) ||
            input.page !== undefined && typeof input.page !== 'string' || input.limit !== undefined && typeof input.limit !== 'string' || input.prefix !== undefined && (typeof input.prefix !== 'string' || input.prefix !== '' && !isId(input.prefix))) invalid('Bounded ingress group query required');
        const paging = Object.freeze(consolePage(input.page, input.limit)), prefix = input.prefix ?? '';
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope);
            const result = await this.store.list(tx, scope, paging, prefix);
            if (!Number.isSafeInteger(result.total) || result.total < 0 || result.total > INGRESS_LIMITS.groupsPerScope || !Array.isArray(result.items) || result.items.length > paging.limit ||
                new Set(result.items.map(item => item.groupId)).size !== result.items.length || result.items.some(item => !item.groupId.startsWith(prefix))) corrupt('Invalid bounded ingress group page');
            return deepFreeze({ ...paging, total: result.total, items: result.items.map(item => head(item, item.groupId)), ...flags });
        });
    }
    async get(actor: string, scope: string, id: string, requestedRevision?: number) {
        identity(actor, scope, id);
        if (requestedRevision !== undefined && (!isCounter(requestedRevision) || requestedRevision > INGRESS_LIMITS.revisionsPerGroup)) invalid('Exact bounded ingress group revision required');
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope);
            const found = await this.store.head(tx, scope, id); if (!found) notFound();
            const metadata = head(found, id), loaded = await this.load(tx, scope, id, requestedRevision ?? metadata.currentRevision);
            const members = await this.members(tx, scope, loaded.record.config);
            return deepFreeze({ ...loaded.metadata, ...loaded.record, createdAt: nativeIsoTime(loaded.record.createdAt), members, ...flags });
        });
    }
    publish(actor: string, scope: string, id: string, key: string | undefined, expectedRevision: number, input: unknown) {
        return this.command(actor, scope, id, key, expectedRevision, parseIngressGroup(input));
    }
    archive(actor: string, scope: string, id: string, key: string | undefined, expectedRevision: number) {
        if (expectedRevision === 0) invalid('Archival requires an existing ingress group');
        return this.command(actor, scope, id, key, expectedRevision, null);
    }
    private async command(actor: string, scope: string, id: string, key: string | undefined, expectedRevision: number, config: IngressGroupConfig | null): Promise<GroupResponse> {
        identity(actor, scope, id);
        if (!isCounter(expectedRevision, true) || expectedRevision > INGRESS_LIMITS.revisionsPerGroup) invalid('Bounded ingress group CAS required');
        const request = requestIdentity(actor, scope, key, config ? 'PUT' : 'DELETE', `/api/v1/scopes/${scope}/ingress-groups/${id}`, { expectedRevision, ...(config ? { config } : {}) });
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope, true);
            const replay = await this.requests.claim<GroupResponse>(tx, request); if (replay) return deepFreeze(replay);
            await this.store.lockScope(tx, scope);
            const found = await this.store.head(tx, scope, id, true), metadata = found ? head(found, id) : null;
            if ((metadata?.currentRevision ?? 0) !== expectedRevision) throw new ControlError('REVISION_CONFLICT', 409, 'Ingress group revision conflict');
            if (!config && !metadata) notFound();
            if (config && metadata?.archived) throw new ControlError('GROUP_ARCHIVED', 409, 'Archived ingress identifiers cannot be reused');
            const old = metadata ? await this.store.revision(tx, scope, id, metadata.currentRevision) : null;
            if (metadata && !old) corrupt('Current ingress group revision is missing');
            if (old) revision(old, metadata!.currentRevision);
            let changed = false, number = expectedRevision, configDigest = old?.configDigest ?? '';
            const at = this.now();
            if (config) {
                await this.members(tx, scope, config, actor);
                configDigest = digest(config); changed = old?.configDigest !== configDigest;
                if (changed) {
                    number++;
                    if (number > INGRESS_LIMITS.revisionsPerGroup) throw new ControlError('RESOURCE_LIMIT', 429, 'Immutable ingress group revision limit reached');
                    if (!metadata) {
                        const count = await this.store.count(tx, scope);
                        if (!Number.isSafeInteger(count) || count < 0 || count > INGRESS_LIMITS.groupsPerScope) corrupt('Invalid Scope ingress group count');
                        if (count >= INGRESS_LIMITS.groupsPerScope) throw new ControlError('RESOURCE_LIMIT', 429, 'Scope ingress group limit reached, including archived identifiers');
                    }
                    await this.store.publish(tx, scope, id, { revision: number, config, configDigest, createdBy: actor, createdAt: at });
                }
            } else { changed = !metadata!.archived; if (changed) await this.store.archive(tx, scope, id); }
            if (changed) await this.store.audit(tx, scope, id, actor, number, config ? 'publish' : 'archive', at);
            const response: GroupResponse = { status: changed ? 202 : 200, body: { groupId: id, revision: number, configDigest, archived: !config, changed } };
            await this.requests.respond(tx, request, response);
            return deepFreeze(response);
        });
    }
    async describeIn(tx: Tx, actor: string, scope: string, input: IngressGroupSelection, active = false) {
        identity(actor, scope); const selection = parseIngressSelection(input);
        await this.auth.scope(tx, actor, scope, true);
        const loaded = await this.load(tx, scope, selection.groupId, selection.revision, true, active);
        if (loaded.record.configDigest !== selection.configDigest) throw new ControlError('REVISION_CONFLICT', 409, 'Exact ingress definition digest differs');
        return deepFreeze({ config: loaded.record.config, members: await this.members(tx, scope, loaded.record.config) });
    }
    async resolveIn(tx: Tx, actor: string, scope: string, input: IngressGroupSelection, memberIds: string[]): Promise<Member[]> {
        identity(actor, scope);
        const selection = parseIngressSelection(input);
        if (!Array.isArray(memberIds) || !memberIds.length || memberIds.length > INGRESS_LIMITS.membersPerGroup || memberIds.some(id => !isId(id)) || new Set(memberIds).size !== memberIds.length) invalid('One to eight unique explicit ingress members required');
        const requested = [...memberIds];
        await this.auth.scope(tx, actor, scope, true);
        const loaded = await this.load(tx, scope, selection.groupId, selection.revision, true, true);
        if (loaded.record.configDigest !== selection.configDigest) throw new ControlError('REVISION_CONFLICT', 409, 'Exact ingress group digest differs');
        const members = await this.members(tx, scope, loaded.record.config), byId = new Map(members.map(member => [member.memberId,member]));
        if (requested.some(id => !byId.has(id))) invalid('Requested member does not belong to the immutable ingress group');
        return deepFreeze(requested.map(id => byId.get(id)!));
    }
}
