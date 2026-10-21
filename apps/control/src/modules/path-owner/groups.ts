import { deepFreeze, isCounter, isId, parseForwardSpec } from '@tunex/core';
import type { Forward } from '@tunex/core';
import { nativeValueDigest as digest, nativeCommandRequest as requestIdentity, nativeIsoTime, nativeWallClockSource } from '../../compatibility/public.ts';
import { pageWindow as consolePage } from '../../framework/public.ts';
import { ControlError, invalid, notFound } from '../../framework/public.ts';
import { validateTemplateHead, validateTemplateRevision } from './template-state.ts';
import type { IdempotentRequests, ScopeAuthorization, ScopeOwnerAuthorization, TransactionBoundary, ResourceReadAccess } from '../../framework/public.ts';
import { expandPath } from './binding-values.ts';
import { PATH_GROUP_LIMITS, parsePathGroupConfig, parsePathGroupSelection } from './group-values.ts';
import type { PathGroupConfig, PathGroupSelection } from './group-contracts.ts';
import type { ForwardPathGroups, PathGroupBindingRecord, PathGroupBindingWriter, PathGroupHead, PathGroupOriginalPaths, PathGroupPathPreview, PathGroupRevision, PathGroupWriter } from './group-contracts.ts';
import type { PathBindingReceipt, PathSelection } from './binding-contracts.ts';
import type { PathTemplateReader, PathTemplateReferences } from './template-contracts.ts';
import type { ForwardWriter } from '../forward-owner/public.ts';
import type { PathGroupApi, PathGroupOwnerClassified, PathGroupResponse as GroupResponse } from './group-api.ts';

const flags = { source: 'persisted-control-state', reserved: false, executionAuthorized: false, fullPlanAuthorization: false } as const;
const hash = (v: unknown): v is string => typeof v === 'string' && v.length === 71 && /^sha256:[a-f0-9]{64}$/.test(v);
const time = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 8640000000000000;
const topology = (f: Forward) => ({ ingressNode: f.spec.ingress.nodeId, protocols: f.spec.protocols, path: f.spec.path ?? null, transport: f.spec.transport ?? null });
const sameTopology = (a: Forward, b: Forward) => digest(topology(a)) === digest(topology(b));
const samePath = (a: PathSelection, b: PathSelection) => a.templateId === b.templateId && a.revision === b.revision && a.configDigest === b.configDigest;
const sameGroup = (a: PathGroupSelection, b: PathGroupSelection) => a.groupId === b.groupId && a.revision === b.revision && a.configDigest === b.configDigest && a.candidateId === b.candidateId;
function corrupt(message: string): never { throw new ControlError('INTEGRITY_FAILURE', 409, message); }
function identity(actor: string, scope: string, id?: string): void {
    if (![actor,scope,...(id === undefined ? [] : [id])].every(isId)) invalid('Valid path group identity required');
}
function head(record: PathGroupHead, id: string): PathGroupHead {
    if (!record || record.groupId !== id || !isId(id) || !isCounter(record.currentRevision) || record.currentRevision > PATH_GROUP_LIMITS.revisionsPerGroup || typeof record.archived !== 'boolean' || record.ownerActorId !== null && !isId(record.ownerActorId)) corrupt('Invalid path group head');
    return { ...record };
}
function revision(record: PathGroupRevision, expected: number): PathGroupRevision {
    let config: PathGroupConfig;
    try { config = parsePathGroupConfig(record.config); } catch { return corrupt('Invalid immutable path group configuration'); }
    if (record.revision !== expected || !isCounter(expected) || expected > PATH_GROUP_LIMITS.revisionsPerGroup || !hash(record.configDigest) || record.configDigest !== digest(config) || !isId(record.createdBy) || !time(record.createdAt)) corrupt('Invalid immutable path group revision');
    return { ...record, config };
}

/** Business-owned immutable choices; all execution acceptance stays with Forwarding. */
export class PathGroups<Tx> implements ForwardPathGroups<Tx>,PathGroupApi {
    private readonly db: TransactionBoundary<Tx>;
    private readonly auth: ScopeAuthorization<Tx> & ScopeOwnerAuthorization<Tx>;
    private readonly access: ResourceReadAccess<Tx>;
    private readonly requests: IdempotentRequests<Tx>;
    private readonly store: PathGroupWriter<Tx>;
    private readonly templates: PathTemplateReader<Tx>;
    private readonly referencesOwner: PathTemplateReferences<Tx>;
    private readonly bindings: PathGroupBindingWriter<Tx>;
    private readonly forwards: Pick<ForwardWriter<Tx>, 'record'>;
    private readonly paths: PathGroupPathPreview<Tx>;
    private readonly originalPaths: PathGroupOriginalPaths<Tx>;
    private readonly clock: () => number;
    constructor(
        db: TransactionBoundary<Tx>, auth: ScopeAuthorization<Tx> & ScopeOwnerAuthorization<Tx>, access: ResourceReadAccess<Tx>, requests: IdempotentRequests<Tx>, store: PathGroupWriter<Tx>,
        templates: PathTemplateReader<Tx>, referencesOwner: PathTemplateReferences<Tx>, bindings: PathGroupBindingWriter<Tx>,
        forwards: Pick<ForwardWriter<Tx>, 'record'>, paths: PathGroupPathPreview<Tx>, originalPaths: PathGroupOriginalPaths<Tx>,
        clock: () => number = nativeWallClockSource(),
    ) {
        this.db = db; this.auth = auth; this.access = access; this.requests = requests; this.store = store; this.templates = templates;
        this.referencesOwner = referencesOwner; this.bindings = bindings; this.forwards = forwards;
        this.paths = paths; this.originalPaths = originalPaths; this.clock = clock;
    }
    private now(): number { const at = this.clock(); if (!time(at)) corrupt('Invalid path group command time'); return at; }
    async classifyOwner(actor:string,scope:string,id:string,key:string|undefined,expectedRevision:number,ownerActorId:string):Promise<PathGroupOwnerClassified> {
        identity(actor,scope,id);
        if(!isId(ownerActorId)||!isCounter(expectedRevision)||expectedRevision>PATH_GROUP_LIMITS.revisionsPerGroup)
            invalid('Exact group revision and target owner required');
        const request=requestIdentity(actor,scope,key,'POST',`/api/v1/scopes/${scope}/path-groups/${id}/classify-owner`,{expectedRevision,ownerActorId});
        return this.db.transaction(async tx=>{
            await this.auth.owner(tx,actor,scope);
            const replay=await this.requests.claim<PathGroupOwnerClassified>(tx,request);
            if(replay){
                await this.auth.scope(tx,ownerActorId,scope,true);
                await this.access.owned(tx,actor,scope,'path-group',id,true);return replay;
            }
            await this.store.lockScope(tx,scope);
            await this.auth.scope(tx,ownerActorId,scope,true);
            const found=await this.store.head(tx,scope,id,true);if(!found)notFound();
            const current=head(found,id);
            if(current.currentRevision!==expectedRevision||current.ownerActorId!==null)
                throw new ControlError('REVISION_CONFLICT',409,'Group revision changed or ownership is already classified');
            const at=this.now();
            if(await this.store.classifyOwner(tx,scope,id,expectedRevision,ownerActorId)!==1)
                throw new ControlError('REVISION_CONFLICT',409,'Group ownership classification raced');
            await this.store.auditOwnership(tx,scope,id,actor,ownerActorId,expectedRevision,at);
            const response:PathGroupOwnerClassified={status:200,body:{groupId:id,revision:expectedRevision,ownerActorId,classified:true}};
            await this.requests.respond(tx,request,response);return response;
        });
    }
    private async load(tx: Tx, scope: string, id: string, number: number, lock = false, active = false) {
        const found = await this.store.head(tx, scope, id, lock); if (!found) notFound();
        const metadata = head(found, id);
        if (active && metadata.archived) throw new ControlError('GROUP_ARCHIVED', 409, 'Archived groups cannot create bindings');
        const stored = await this.store.revision(tx, scope, id, number); if (!stored) notFound();
        const record = revision(stored, number);
        if (record.revision > metadata.currentRevision) corrupt('Group revision exceeds its current head');
        return { metadata, record };
    }
    private async candidates(tx: Tx, scope: string, config: PathGroupConfig, actor?: string) {
        const result = [];
        const ordered = config.candidates.map((candidate,index) => ({ candidate, index })).sort((a,b) =>
            a.candidate.template.templateId < b.candidate.template.templateId ? -1 : a.candidate.template.templateId > b.candidate.template.templateId ? 1 : a.candidate.template.revision - b.candidate.template.revision);
        for (const { candidate, index } of ordered) {
            if (actor !== undefined) await this.access.owned(tx, actor, scope, 'path-template', candidate.template.templateId);
            const found = await this.templates.head(tx, scope, candidate.template.templateId, actor !== undefined);
            if (!found) { if (actor === undefined) corrupt('Immutable group template head is missing'); notFound(); }
            const metadata = validateTemplateHead(found, candidate.template.templateId);
            if (actor !== undefined && metadata.archived) throw new ControlError('TEMPLATE_ARCHIVED', 409, 'Candidate templates must be active for new use');
            const stored = await this.templates.revision(tx, scope, candidate.template.templateId, candidate.template.revision);
            if (!stored) { if (actor === undefined) corrupt('Immutable group template revision is missing'); notFound(); }
            const record = validateTemplateRevision(stored, candidate.template.revision);
            if (record.revision > metadata.currentRevision) corrupt('Candidate template revision exceeds its head');
            if (record.configDigest !== candidate.template.configDigest) {
                if (actor === undefined) corrupt('Persisted candidate template digest differs');
                throw new ControlError('REVISION_CONFLICT', 409, 'Exact candidate template digest differs');
            }
            if (actor !== undefined) {
                const authorized = await this.referencesOwner.validate(tx, actor, scope, record.config);
                if (authorized.profileDigest !== record.profileDigest) corrupt('Immutable candidate Profile digest differs');
            }
            result.push({ candidateId: candidate.candidateId, priority: index + 1, template: candidate.template, config: record.config });
        }
        result.sort((a,b) => a.priority - b.priority);
        const first = result[0]!;
        if (result.some(item => item.config.nodes[0] !== first.config.nodes[0] || digest(item.config.protocols) !== digest(first.config.protocols))) {
            if (actor === undefined) corrupt('Persisted group branches differ in ingress or business protocols');
            throw new ControlError('UNSUPPORTED_CAPABILITY', 422, 'Group branches require one ingress and one business protocol set');
        }
        if (config.kind === 'egress-candidates' && new Set(result.map(item => item.config.nodes[item.config.nodes.length - 1])).size !== result.length) {
            if (actor === undefined) corrupt('Persisted egress candidates repeat a terminal Node');
            invalid('Egress candidates require distinct terminal Nodes');
        }
        return result;
    }
    private async selected(tx: Tx, current: Forward, selection: PathGroupSelection, lock: boolean) {
        const loaded = await this.load(tx, current.scopeId, selection.groupId, selection.revision, lock, true);
        if (loaded.record.configDigest !== selection.configDigest) throw new ControlError('REVISION_CONFLICT', 409, 'Exact immutable group digest differs');
        const candidates = await this.candidates(tx, current.scopeId, loaded.record.config);
        const candidate = candidates.find(item => item.candidateId === selection.candidateId);
        if (!candidate) invalid('Candidate does not belong to the selected immutable group');
        const found = await this.templates.head(tx, current.scopeId, candidate.template.templateId);
        if (!found) notFound();
        if (validateTemplateHead(found, candidate.template.templateId).archived) throw new ControlError('TEMPLATE_ARCHIVED', 409, 'Selected candidate template is archived');
        expandPath(current.spec, candidate.config);
        return candidate;
    }
    async list(actor: string, scope: string, input: { page?: string | undefined; limit?: string | undefined; prefix?: string | undefined } = {}) {
        identity(actor, scope);
        if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype,null].includes(Object.getPrototypeOf(input)) ||
            Object.keys(input).some(key => !['page','limit','prefix'].includes(key)) || input.page !== undefined && typeof input.page !== 'string' || input.limit !== undefined && typeof input.limit !== 'string' ||
            input.prefix !== undefined && (typeof input.prefix !== 'string' || input.prefix !== '' && !isId(input.prefix))) invalid('Bounded path group query required');
        const paging = Object.freeze(consolePage(input.page, input.limit)), prefix = input.prefix ?? '';
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope);
            const page = await this.store.list(tx, scope, await this.access.principal(tx, actor, scope), paging, prefix);
            if (!Number.isSafeInteger(page.total) || page.total < 0 || page.total > PATH_GROUP_LIMITS.groupsPerScope || page.items.length > paging.limit ||
                new Set(page.items.map(item => item.groupId)).size !== page.items.length || page.items.some(item => !item.groupId.startsWith(prefix))) corrupt('Invalid bounded group page');
            return deepFreeze({ ...paging, total: page.total, items: page.items.map(item => head(item, item.groupId)), ...flags, health: 'unknown', automaticSelection: false });
        });
    }
    async get(actor: string, scope: string, id: string, requestedRevision?: number) {
        identity(actor, scope, id);
        if (requestedRevision !== undefined && (!isCounter(requestedRevision) || requestedRevision > PATH_GROUP_LIMITS.revisionsPerGroup)) invalid('Exact bounded group revision required');
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope);
            await this.access.owned(tx, actor, scope, 'path-group', id, true);
            const found = await this.store.head(tx, scope, id); if (!found) notFound();
            const metadata = head(found, id), loaded = await this.load(tx, scope, id, requestedRevision ?? metadata.currentRevision);
            const candidates = await this.candidates(tx, scope, loaded.record.config);
            return deepFreeze({ ...loaded.metadata, ...loaded.record, createdAt: nativeIsoTime(loaded.record.createdAt),
                topology: { operator: 'OR', branches: candidates.map(item => ({ candidateId: item.candidateId, priority: item.priority, template: item.template, operator: 'AND', nodes: item.config.nodes, health: 'unknown' })), health: 'unknown' },
                ...flags, automaticSelection: false, referenceAuthorization: 'not-rechecked-by-this-query', bindingCreated: false });
        });
    }
    publish(actor: string, scope: string, id: string, key: string | undefined, expectedRevision: number, input: unknown) {
        return this.command(actor, scope, id, key, expectedRevision, parsePathGroupConfig(input));
    }
    archive(actor: string, scope: string, id: string, key: string | undefined, expectedRevision: number) {
        if (expectedRevision === 0) invalid('Archival requires an existing group revision');
        return this.command(actor, scope, id, key, expectedRevision, null);
    }
    private async command(actor: string, scope: string, id: string, key: string | undefined, expectedRevision: number, config: PathGroupConfig | null): Promise<GroupResponse> {
        identity(actor, scope, id);
        if (!isCounter(expectedRevision, true) || expectedRevision > PATH_GROUP_LIMITS.revisionsPerGroup) invalid('Bounded group CAS required');
        const request = requestIdentity(actor, scope, key, config ? 'PUT' : 'DELETE', `/api/v1/scopes/${scope}/path-groups/${id}`, { expectedRevision, ...(config ? { config } : {}) });
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope, true);
            const replay = await this.requests.claim<GroupResponse>(tx, request); if (replay) { await this.access.owned(tx, actor, scope, 'path-group', id, true); return deepFreeze(replay); }
            await this.store.lockScope(tx, scope);
            const found = await this.store.head(tx, scope, id, true), metadata = found ? head(found, id) : null;
            if (metadata) await this.access.owned(tx, actor, scope, 'path-group', id, config === null);
            if ((metadata?.currentRevision ?? 0) !== expectedRevision) throw new ControlError('REVISION_CONFLICT', 409, 'Path group revision conflict');
            if (!config && !metadata) notFound();
            if (config && metadata?.archived) throw new ControlError('GROUP_ARCHIVED', 409, 'Archived group identifiers cannot be reused');
            const old = metadata ? await this.store.revision(tx, scope, id, metadata.currentRevision) : null;
            if (metadata && !old) corrupt('Current group revision is missing');
            if (old) revision(old, metadata!.currentRevision);
            let changed = false, number = expectedRevision, configDigest = old?.configDigest ?? '';
            const at = this.now();
            if (config) {
                await this.candidates(tx, scope, config, actor);
                configDigest = digest(config); changed = old?.configDigest !== configDigest;
                if (changed) {
                    number++;
                    if (number > PATH_GROUP_LIMITS.revisionsPerGroup) throw new ControlError('RESOURCE_LIMIT', 429, 'Immutable group revision limit reached');
                    if (!metadata) {
                        const count = await this.store.count(tx, scope);
                        if (!Number.isSafeInteger(count) || count < 0 || count > PATH_GROUP_LIMITS.groupsPerScope) corrupt('Invalid persisted Scope group count');
                        if (count >= PATH_GROUP_LIMITS.groupsPerScope) throw new ControlError('RESOURCE_LIMIT', 429, 'Scope group limit reached, including archived identifiers');
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
    private async checked(tx: Tx, current: Forward, record: PathGroupBindingRecord, requireCurrent = true) {
        try { parsePathGroupSelection({ groupId: record.groupId, revision: record.revision, configDigest: record.configDigest, candidateId: record.candidateId }); }
        catch { return corrupt('Invalid immutable group selection in provenance'); }
        const parsed = parseForwardSpec(record.expandedSpec);
        if (!isCounter(record.sequence) || record.sequence > PATH_GROUP_LIMITS.bindingsPerForward || !isCounter(record.pathBindingSequence) || record.pathBindingSequence > 64 ||
            !isCounter(record.forwardRevision) || record.forwardRevision > current.revision || !parsed.ok || record.specDigest !== digest(parsed.value) || !isId(record.actorId) || !time(record.createdAt)) corrupt('Invalid immutable group provenance');
        const loaded = await this.load(tx, current.scopeId, record.groupId, record.revision);
        if (loaded.record.configDigest !== record.configDigest) corrupt('Group provenance digest differs');
        const candidates = await this.candidates(tx, current.scopeId, loaded.record.config), selected = candidates.find(item => item.candidateId === record.candidateId);
        if (!selected) corrupt('Group provenance candidate is missing');
        try { if (digest(expandPath(parsed.value, selected.config)) !== record.specDigest) corrupt('Expanded group provenance differs from immutable candidate'); }
        catch { return corrupt('Invalid expanded immutable group provenance'); }
        const historical = await this.originalPaths.at(tx, current.scopeId, current.id, record.pathBindingSequence);
        if (!historical) corrupt('Original immutable path binding is missing from group provenance');
        const originalSpec = parseForwardSpec(historical.expandedSpec);
        if (historical.sequence !== record.pathBindingSequence || !samePath(historical, selected.template) || !originalSpec.ok ||
            historical.specDigest !== digest(originalSpec.value) || !isCounter(historical.forwardRevision) || historical.forwardRevision > record.forwardRevision ||
            !sameTopology({ ...current, spec: parsed.value }, { ...current, spec: originalSpec.value }) || !isId(historical.actorId) || !time(historical.createdAt))
            corrupt('Original immutable path binding differs from group provenance');
        if (requireCurrent) {
            if (!sameTopology(current, { ...current, spec: parsed.value })) corrupt('Current Forward topology differs from group provenance');
            const original = await this.originalPaths.current(tx, current.scopeId, current.id);
            if (!original || original.sequence !== record.pathBindingSequence || !samePath(original, selected.template) ||
                original.forwardRevision !== historical.forwardRevision || original.specDigest !== historical.specDigest || original.actorId !== historical.actorId || original.createdAt !== historical.createdAt ||
                !sameTopology(current, { ...current, spec: original.expandedSpec }) || original.specDigest !== digest(original.expandedSpec)) corrupt('Current exact path binding differs from group provenance');
        }
        return { groupId: record.groupId, revision: record.revision, configDigest: record.configDigest, candidateId: record.candidateId,
            sequence: record.sequence, pathBindingSequence: record.pathBindingSequence, forwardRevision: record.forwardRevision };
    }
    async resolve(tx: Tx, actor: string, current: Forward, input: PathGroupSelection): Promise<PathSelection> {
        const selection = parsePathGroupSelection(input), old = await this.bindings.current(tx, current.scopeId, current.id);
        if (old) await this.checked(tx, current, old);
        identity(actor, current.scopeId, current.id);
        await this.access.owned(tx, actor, current.scopeId, 'forward', current.id);
        await this.access.owned(tx, actor, current.scopeId, 'path-group', selection.groupId);
        const selected = await this.selected(tx, current, selection, true);
        await this.access.owned(tx, actor, current.scopeId, 'path-template', selected.template.templateId);
        return selected.template;
    }
    async accept(tx: Tx, actor: string, next: Forward, input: PathGroupSelection, path: PathBindingReceipt) {
        await this.access.owned(tx, actor, next.scopeId, 'forward', next.id);
        await this.access.owned(tx, actor, next.scopeId, 'path-group', input.groupId);
        await this.access.owned(tx, actor, next.scopeId, 'path-template', path.templateId);
        const selection = parsePathGroupSelection(input), old = await this.bindings.current(tx, next.scopeId, next.id);
        if (old) await this.checked(tx, next, old, false);
        const loaded = await this.load(tx, next.scopeId, selection.groupId, selection.revision, false, true);
        if (loaded.record.configDigest !== selection.configDigest) corrupt('Accepted group digest differs');
        const candidate = loaded.record.config.candidates.find(item => item.candidateId === selection.candidateId);
        if (!candidate || !samePath(candidate.template, path) || !isCounter(path.sequence) || path.sequence > 64 || !isCounter(path.forwardRevision) || path.forwardRevision > next.revision) corrupt('Original path receipt differs from accepted group selection');
        if (old && sameGroup(old, selection) && old.pathBindingSequence === path.sequence && sameTopology(next, { ...next, spec: old.expandedSpec }))
            return deepFreeze({ ...await this.checked(tx, next, old), changed: false });
        const stored = await this.bindings.append(tx, next.scopeId, next.id, { ...selection, pathBindingSequence: path.sequence,
            forwardRevision: next.revision, expandedSpec: next.spec, specDigest: digest(next.spec), actorId: actor, createdAt: this.now() });
        return deepFreeze({ ...await this.checked(tx, next, stored), changed: true });
    }
    async preserve(tx: Tx, current: Forward, next: Forward): Promise<void> {
        const old = await this.bindings.current(tx, current.scopeId, current.id); if (!old) return;
        await this.checked(tx, current, old, false);
        if (!sameTopology(current, { ...current, spec: old.expandedSpec })) corrupt('Existing group provenance differs from current Forward');
        if (!sameTopology(current, next)) await this.bindings.detach(tx, current.scopeId, current.id);
        else await this.checked(tx, current, old);
    }
    async detach(tx: Tx, current: Forward): Promise<void> {
        const old = await this.bindings.current(tx, current.scopeId, current.id); if (!old) return;
        await this.checked(tx, current, old, false);
        if (!sameTopology(current, { ...current, spec: old.expandedSpec })) corrupt('Existing group provenance differs from current Forward');
        await this.bindings.detach(tx, current.scopeId, current.id);
    }
    async currentIn(tx: Tx, forward: Forward) {
        const binding = await this.bindings.current(tx, forward.scopeId, forward.id);
        return binding ? deepFreeze(await this.checked(tx, forward, binding)) : null;
    }
    async getBinding(actor: string, scope: string, forwardId: string) {
        identity(actor, scope, forwardId);
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope);
            await this.access.forward(tx, actor, scope, forwardId);
            const forward = await this.forwards.record(tx, scope, forwardId), binding = await this.bindings.current(tx, scope, forwardId), history = await this.bindings.history(tx, scope, forwardId);
            if (binding) await this.checked(tx, forward, binding);
            if (history.length > PATH_GROUP_LIMITS.bindingsPerForward || history.some((record,index) => record.sequence !== index + 1) || binding && !history.some(record => record.sequence === binding.sequence)) corrupt('Invalid bounded immutable group history');
            const items = [];
            for (const record of history) items.push({ ...await this.checked(tx, forward, record, record.sequence === binding?.sequence), expandedSpec: record.expandedSpec,
                specDigest: record.specDigest, actorId: record.actorId, createdAt: nativeIsoTime(record.createdAt), current: record.sequence === binding?.sequence });
            return deepFreeze({ forwardId, ownerActorId: forward.ownerActorId, revision: forward.revision, deleting: forward.deleting, recoverySuspended: forward.recoverySuspended,
                binding: binding ? items.find(item => item.sequence === binding.sequence) : null, history: items, ...flags,
                health: 'unknown', automaticSelection: false, referenceAuthorization: 'not-rechecked-by-this-query', consistency: 'read-committed-not-global-snapshot' });
        });
    }
    async references(actor: string, scope: string, id: string, input: { page?: string | undefined; limit?: string | undefined; revision?: number | undefined } = {}) {
        identity(actor, scope, id);
        if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype,null].includes(Object.getPrototypeOf(input)) || Object.keys(input).some(key => !['page','limit','revision'].includes(key)) ||
            input.page !== undefined && typeof input.page !== 'string' || input.limit !== undefined && typeof input.limit !== 'string' || input.revision !== undefined && (!isCounter(input.revision) || input.revision > PATH_GROUP_LIMITS.revisionsPerGroup)) invalid('Bounded group reference query required');
        const query = Object.freeze({ ...input }), paging = Object.freeze(consolePage(query.page, query.limit));
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope);
            await this.access.owned(tx, actor, scope, 'path-group', id, true);
            const found = await this.store.head(tx, scope, id); if (!found) notFound();
            const metadata = head(found, id), result = await this.bindings.references(tx, scope, await this.access.principal(tx, actor, scope), id, paging, query.revision);
            if (!Number.isSafeInteger(result.total) || result.total < 0 || result.items.length > paging.limit || new Set(result.items.map(item => item.forward.id)).size !== result.items.length) corrupt('Invalid bounded group reference page');
            const items = [];
            for (const item of result.items) {
                if (!isId(item.forward.id) || item.forward.scopeId !== scope || !isCounter(item.forward.revision) || !parseForwardSpec(item.forward.spec).ok || typeof item.recoverySuspended !== 'boolean' ||
                    item.binding.groupId !== id || query.revision !== undefined && item.binding.revision !== query.revision) corrupt('Invalid current group reference');
                items.push({ forwardId: item.forward.id, expectedRevision: item.forward.revision, binding: await this.checked(tx, item.forward, item.binding), spec: item.forward.spec, recoverySuspended: item.recoverySuspended });
            }
            return deepFreeze({ ...metadata, ...paging, total: result.total, referenceRevision: query.revision ?? null, items, ...flags, health: 'unknown', automaticSelection: false,
                referenceAuthorization: 'not-rechecked-by-this-query', consistency: 'read-committed-page-not-global-snapshot' });
        });
    }
    async preview(actor: string, scope: string, forwardId: string, expectedRevision: number, input: unknown) {
        identity(actor, scope, forwardId);
        if (!isCounter(expectedRevision)) invalid('Exact Forward CAS required');
        const selection = parsePathGroupSelection(input);
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope, true);
            await this.access.owned(tx, actor, scope, 'forward', forwardId);
            await this.access.owned(tx, actor, scope, 'path-group', selection.groupId);
            const current = await this.forwards.record(tx, scope, forwardId);
            if (current.revision !== expectedRevision || current.deleting || current.recoverySuspended) throw new ControlError('REVISION_CONFLICT', 409, 'Forward changed, deleting or recovery suspended');
            const old = await this.bindings.current(tx, scope, forwardId); if (old) await this.checked(tx, current, old);
            const candidate = await this.selected(tx, current, selection, false);
            await this.access.owned(tx, actor, scope, 'path-template', candidate.template.templateId);
            const preview = await this.paths.previewIn(tx, actor, scope, forwardId, expectedRevision, candidate.template);
            return deepFreeze({ ...preview, group: selection, priority: candidate.priority, automaticSelection: false, health: 'unknown' });
        });
    }
}
