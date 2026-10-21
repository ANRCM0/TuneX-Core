import { deepFreeze, isCounter, isId, parseForwardSpec } from '@tunex/core';
import type { Forward, ForwardSpec } from '@tunex/core';
import { nativeValueDigest as digest, nativeIsoTime, nativeWallClockSource, nativeReadProjectionValues } from '../../compatibility/public.ts';
import { pageWindow as consolePage } from '../../framework/public.ts';
import { ControlError, invalid, notFound } from '../../framework/public.ts';
import type { ScopeAuthorization, TransactionBoundary, ResourceReadAccess } from '../../framework/public.ts';
import { validateTemplateHead, validateTemplateRevision } from './template-state.ts';
import { expandPath, parsePathSelection } from './binding-values.ts';
import type { ForwardPathBindings, PathBindingPreview, PathBindingRecord, PathBindingWriter, PathSelection } from './binding-contracts.ts';
import type { PathTemplateReader, PathTemplateReferences } from './template-contracts.ts';
import type { PathTemplateConfig } from './template-contracts.ts';
import type { PathBindingApi } from './binding-api.ts';
import type { ForwardWriter } from '../forward-owner/public.ts';

const sameSelection = (a: PathSelection, b: PathSelection) => a.templateId === b.templateId && a.revision === b.revision && a.configDigest === b.configDigest;
const topology = (forward: Forward) => ({ ingressNode: forward.spec.ingress.nodeId, protocols: forward.spec.protocols, path: forward.spec.path ?? null, transport: forward.spec.transport ?? null });
const sameTopology = (a: Forward, b: Forward) => digest(topology(a)) === digest(topology(b));
const flags = { source: 'persisted-control-state', reserved: false, executionAuthorized: false, fullPlanAuthorization: false } as const;

/** Metadata joins the original Forward command transaction, never owns execution. */
export class PathBindings<Tx> implements ForwardPathBindings<Tx>,PathBindingApi {
    private readonly db: TransactionBoundary<Tx>;
    private readonly auth: ScopeAuthorization<Tx>;
    private readonly access: ResourceReadAccess<Tx>;
    private readonly templates: PathTemplateReader<Tx>;
    private readonly referencesOwner: PathTemplateReferences<Tx>;
    private readonly store: PathBindingWriter<Tx>;
    private readonly forwards: Pick<ForwardWriter<Tx>, 'record'>;
    private readonly clock: () => number;
    constructor(db: TransactionBoundary<Tx>, auth: ScopeAuthorization<Tx>, access: ResourceReadAccess<Tx>, templates: PathTemplateReader<Tx>,
        references: PathTemplateReferences<Tx>, store: PathBindingWriter<Tx>, forwards: Pick<ForwardWriter<Tx>, 'record'>, clock: () => number = nativeWallClockSource()) {
        this.db = db; this.auth = auth; this.access = access; this.templates = templates; this.referencesOwner = references;
        this.store = store; this.forwards = forwards; this.clock = clock;
    }
    private async template(tx: Tx, scope: string, selection: PathSelection, lock: boolean, requireActive: boolean) {
        const found = await this.templates.head(tx, scope, selection.templateId, lock); if (!found) notFound();
        const head = validateTemplateHead(found, selection.templateId);
        if (requireActive && head.archived) throw new ControlError('TEMPLATE_ARCHIVED', 409, 'New bindings cannot use archived templates');
        const stored = await this.templates.revision(tx, scope, selection.templateId, selection.revision); if (!stored) notFound();
        const record = validateTemplateRevision(stored, selection.revision);
        if (record.revision > head.currentRevision || record.configDigest !== selection.configDigest)
            throw new ControlError('REVISION_CONFLICT', 409, 'Exact immutable template digest differs');
        return record;
    }
    async resolve(tx: Tx, actor: string, current: Forward, selection: PathSelection) {
        await this.access.owned(tx, actor, current.scopeId, 'forward', current.id);
        await this.access.owned(tx, actor, current.scopeId, 'path-template', selection.templateId);
        const old = await this.store.current(tx, current.scopeId, current.id);
        if (old) await this.checked(tx, current, old);
        const record = await this.template(tx, current.scopeId, selection, true, true);
        const resolved = await this.referencesOwner.validate(tx, actor, current.scopeId, record.config);
        if (resolved.profileDigest !== record.profileDigest) throw new ControlError('INTEGRITY_FAILURE', 409, 'Immutable Profile digest differs');
        return expandPath(current.spec, record.config);
    }
    async resolveCreateIn(tx: Tx, actor: string, scope: string, input: ForwardSpec, selectionInput: PathSelection): Promise<ForwardSpec> {
        if (![actor,scope].every(isId)) invalid('Valid native creation identity required');
        const spec = parseForwardSpec(input); if (!spec.ok) invalid('Valid native creation spec required');
        const selection = parsePathSelection(selectionInput);
        await this.access.owned(tx, actor, scope, 'path-template', selection.templateId);
        const record = await this.template(tx, scope, selection, true, true);
        const resolved = await this.referencesOwner.validate(tx, actor, scope, record.config);
        if (resolved.profileDigest !== record.profileDigest) throw new ControlError('INTEGRITY_FAILURE', 409, 'Immutable Profile digest differs');
        return expandPath(spec.value, record.config);
    }
    private async checked(tx: Tx, current: Forward, binding: PathBindingRecord, requireCurrent = true) {
        try { parsePathSelection({ templateId: binding.templateId, revision: binding.revision, configDigest: binding.configDigest }); }
        catch { throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid immutable template selection in provenance'); }
        const parsed = parseForwardSpec(binding.expandedSpec);
        if (!isCounter(binding.sequence) || binding.sequence > 64 || !isCounter(binding.forwardRevision) || binding.forwardRevision > current.revision ||
            !isId(binding.actorId) || !Number.isSafeInteger(binding.createdAt) || binding.createdAt < 0 || binding.createdAt > 8640000000000000 ||
            !parsed.ok || binding.specDigest !== digest(parsed.value)) throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid immutable path provenance');
        const template = await this.template(tx, current.scopeId, binding, false, false);
        let expandedDigest: string;
        try { expandedDigest = digest(expandPath(parsed.value, template.config)); }
        catch { throw new ControlError('INTEGRITY_FAILURE', 409, 'Persisted expanded path is incompatible with immutable template'); }
        if (expandedDigest !== binding.specDigest ||
            requireCurrent && !sameTopology(current, { ...current, spec: parsed.value }))
            throw new ControlError('INTEGRITY_FAILURE', 409, 'Current path differs from immutable provenance');
        return { templateId: binding.templateId, revision: binding.revision, configDigest: binding.configDigest,
            sequence: binding.sequence, forwardRevision: binding.forwardRevision };
    }
    async accept(tx: Tx, actor: string, next: Forward, selection: PathSelection) {
        await this.access.owned(tx, actor, next.scopeId, 'forward', next.id);
        await this.access.owned(tx, actor, next.scopeId, 'path-template', selection.templateId);
        const old = await this.store.current(tx, next.scopeId, next.id);
        if (old && sameSelection(old, selection) && sameTopology(next, { ...next, spec: old.expandedSpec })) {
            return { ...await this.checked(tx, next, old), changed: false };
        }
        const createdAt = this.clock();
        if (!Number.isSafeInteger(createdAt) || createdAt < 0 || createdAt > 8640000000000000)
            throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid path binding command time');
        const record = await this.store.append(tx, next.scopeId, next.id, { ...selection, forwardRevision: next.revision,
            expandedSpec: next.spec, specDigest: digest(next.spec), actorId: actor, createdAt });
        return { ...await this.checked(tx, next, record), changed: true };
    }
    async preserve(tx: Tx, current: Forward, next: Forward) {
        const binding = await this.store.current(tx, current.scopeId, current.id); if (!binding) return;
        await this.checked(tx, current, binding);
        if (!sameTopology(current, next)) await this.store.detach(tx, current.scopeId, current.id);
    }
    async currentIn(tx: Tx, forward: Forward) {
        const binding = await this.store.current(tx, forward.scopeId, forward.id);
        return binding ? deepFreeze(await this.checked(tx, forward, binding)) : null;
    }
    async detachIn(tx: Tx, forward: Forward): Promise<void> {
        const binding = await this.store.current(tx, forward.scopeId, forward.id); if (!binding) return;
        await this.checked(tx, forward, binding);
        await this.store.detach(tx, forward.scopeId, forward.id);
    }
    async get(actor: string, scope: string, forwardId: string) {
        if (![actor, scope, forwardId].every(isId)) invalid('Valid Forward identity required');
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope);
            await this.access.forward(tx, actor, scope, forwardId);
            const forward = await this.forwards.record(tx, scope, forwardId), binding = await this.store.current(tx, scope, forwardId);
            if (binding) await this.checked(tx, forward, binding);
            const history = await this.store.history(tx, scope, forwardId);
            if (history.length > 64 || history.some((record, index) => record.sequence !== index + 1))
                throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid bounded immutable path history');
            const checkedHistory = [];
            for (const item of history) {
                const validated = await this.checked(tx, forward, item, item.sequence === binding?.sequence);
                checkedHistory.push({ ...validated, expandedSpec: item.expandedSpec, specDigest: item.specDigest,
                    actorId: item.actorId, createdAt: nativeIsoTime(item.createdAt), current: item.sequence === binding?.sequence });
            }
            if (binding && !history.some(item => item.sequence === binding.sequence))
                throw new ControlError('INTEGRITY_FAILURE', 409, 'Current path pointer is not present in immutable history');
            return deepFreeze({ forwardId, ownerActorId: forward.ownerActorId, revision: forward.revision, deleting: forward.deleting, recoverySuspended: forward.recoverySuspended,
                binding: binding ? checkedHistory.find(item => item.sequence === binding.sequence) : null, history: checkedHistory,
                ...flags, referenceAuthorization: 'not-rechecked-by-this-query', consistency: 'read-committed-not-global-snapshot' });
        });
    }
    async preview(actor: string, scope: string, forwardId: string, expectedRevision: number, input: unknown) {
        const selection = parsePathSelection(input);
        if (![actor, scope, forwardId].every(isId) || !isCounter(expectedRevision)) invalid('Exact Forward identity and CAS required');
        return this.db.transaction(tx => this.previewIn(tx, actor, scope, forwardId, expectedRevision, selection));
    }
    async previewIn(tx: Tx, actor: string, scope: string, forwardId: string, expectedRevision: number, input: PathSelection): Promise<PathBindingPreview> {
        const selection = parsePathSelection(input);
        if (![actor, scope, forwardId].every(isId) || !isCounter(expectedRevision)) invalid('Exact Forward identity and CAS required');
        await this.auth.scope(tx, actor, scope, true);
        await this.access.owned(tx, actor, scope, 'forward', forwardId);
        await this.access.owned(tx, actor, scope, 'path-template', selection.templateId);
        const current = await this.forwards.record(tx, scope, forwardId);
        if (current.deleting || current.recoverySuspended || current.revision !== expectedRevision)
            throw new ControlError('REVISION_CONFLICT', 409, 'Current Forward changed, is deleting or recovery suspended');
        const target = await this.template(tx, scope, selection, false, true);
        const resolved = await this.referencesOwner.validate(tx, actor, scope, target.config);
        if (resolved.profileDigest !== target.profileDigest) throw new ControlError('INTEGRITY_FAILURE', 409, 'Immutable Profile digest differs');
        const proposedSpec = expandPath(current.spec, target.config);
        return deepFreeze({ forwardId, expectedRevision, template: selection, spec: current.spec, proposedSpec,
            changed: digest(current.spec) !== digest(proposedSpec), ...flags, previewOnly: true,
            interruption: 'possible-same-listener-replacement', tcp: 'bounded-drain-or-authorization-deadline', udp: 'associations-may-reset-and-lose-datagrams' });
    }
    async references(actor: string, scope: string, id: string, input: { page?: string; limit?: string; revision?: number; targetRevision?: number } = {}) {
        if (![actor, scope, id].every(isId) || !input || typeof input !== 'object' || Array.isArray(input) ||
            ![Object.prototype, null].includes(Object.getPrototypeOf(input)) || Object.keys(input).some(k => !['page', 'limit', 'revision', 'targetRevision'].includes(k)) ||
            input.page !== undefined && typeof input.page !== 'string' || input.limit !== undefined && typeof input.limit !== 'string' ||
            input.revision !== undefined && (!isCounter(input.revision) || input.revision > 64) ||
            input.targetRevision !== undefined && (!isCounter(input.targetRevision) || input.targetRevision > 64)) invalid('Bounded PathTemplate reference query required');
        const query = Object.freeze({ ...input }), paging = Object.freeze(consolePage(query.page, query.limit));
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope, query.targetRevision !== undefined);
            await this.access.owned(tx, actor, scope, 'path-template', id, query.targetRevision === undefined);
            const principal = await this.access.principal(tx, actor, scope);
            const found = await this.templates.head(tx, scope, id); if (!found) notFound();
            const head = validateTemplateHead(found, id);
            let target: (PathSelection & { config: PathTemplateConfig }) | null = null;
            if (query.targetRevision !== undefined) {
                const stored = await this.templates.revision(tx, scope, id, query.targetRevision); if (!stored) notFound();
                const record = validateTemplateRevision(stored, query.targetRevision);
                if (record.revision > head.currentRevision) throw new ControlError('INTEGRITY_FAILURE', 409, 'Target exceeds persisted template head');
                target = { templateId: id, revision: record.revision, configDigest: record.configDigest, config: record.config };
                if (!head.archived) {
                    const resolved = await this.referencesOwner.validate(tx, actor, scope, target.config);
                    if (resolved.profileDigest !== record.profileDigest) throw new ControlError('INTEGRITY_FAILURE', 409, 'Immutable Profile digest differs');
                }
            }
            const result = await this.store.references(tx, scope, principal, id, paging, query.revision);
            if (!Number.isSafeInteger(result.total) || result.total < 0 || result.items.length > paging.limit ||
                new Set(result.items.map(item => item.forward.id)).size !== result.items.length) throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid path reference page');
            const items = [];
            for (const item of result.items) {
                if (!isId(item.forward.id) || item.forward.scopeId !== scope || !isCounter(item.forward.revision) ||
                    !parseForwardSpec(item.forward.spec).ok || typeof item.recoverySuspended !== 'boolean' || item.binding.templateId !== id ||
                    query.revision !== undefined && item.binding.revision !== query.revision) throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid current path reference');
                const binding = await this.checked(tx, item.forward, item.binding);
                let proposedSpec = null, unavailableReason: string | null = null;
                if (target) {
                    if (head.archived) unavailableReason = 'TEMPLATE_ARCHIVED';
                    else if (item.recoverySuspended) unavailableReason = 'RECOVERY_SUSPENDED';
                    else try { proposedSpec = expandPath(item.forward.spec, target.config); }
                    catch (error) { if (!(error instanceof ControlError) || error.code !== 'UNSUPPORTED_CAPABILITY') throw error; unavailableReason = error.code; }
                }
                items.push({ forwardId: item.forward.id, expectedRevision: item.forward.revision, binding, recoverySuspended: item.recoverySuspended,
                    spec: item.forward.spec, proposedSpec, unavailableReason, changed: proposedSpec ? digest(proposedSpec) !== digest(item.forward.spec) || !sameSelection(binding, target!) : null });
            }
            return deepFreeze({ templateId: id, ownerActorId: head.ownerActorId, currentRevision: head.currentRevision, archived: head.archived, ...paging, total: result.total,
                referenceRevision: query.revision ?? null, target, items, ...flags, previewOnly: true,
                consistency: 'read-committed-page-not-global-snapshot', observedAt: nativeReadProjectionValues.currentIso() });
        });
    }
}
