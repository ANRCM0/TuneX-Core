import { deepFreeze, isCounter, isId } from '@tunex/core';
import { nativeValueDigest as digest, nativeModuleId as randomUUID, nativeCommandRequest as requestIdentity, nativeWallClockSource, nativeIsoTime } from '../../compatibility/public.ts';
import { pageWindow as consolePage } from '../../framework/public.ts';
import { ControlError, invalid, notFound } from '../../framework/public.ts';
import type { IngressGroupResolver } from './contracts.ts';
import type { IngressMigrationApi, IngressMigrationCreated as Created, IngressMigrationActed as Acted, IngressMigrationCancelled as Cancelled } from './migration-api.ts';
import type { IdempotentRequests, ResourceReadAccess, ScopeAuthorization, TransactionBoundary } from '../../framework/public.ts';
import { INGRESS_MIGRATION_LIMITS, parseIngressLineage, parseIngressMigrationInput, parseIngressMigrationPlan, parseIngressOriginRef } from './migration-values.ts';
import { parsePublicationState, PATH_PUBLICATION_REJECTIONS, publicationHash } from '../path-owner/public.ts';
import type { IngressDefinitionChange, IngressLineage, IngressMigrationAttempt, IngressMigrationForwardPort, IngressMigrationInput, IngressMigrationPlan, IngressMigrationRecord, IngressMigrationStore, IngressOriginRef, IngressOrigins } from './migration-contracts.ts';
import type { IngressDeploymentHead, IngressRemovalResult } from './contracts.ts';
import type { PublicationForwardResult, PublicationForwardState } from '../path-owner/public.ts';

const flags = { source: 'persisted-control-state', reserved: false, executionAuthorized: false, fullPlanAuthorization: false,
    health: 'unknown', automaticExecution: false, atomicAcrossForwards: false, physicalConnectionSharing: false } as const;
const same = (a: unknown, b: unknown) => digest(a) === digest(b);
const time = (v: number) => Number.isSafeInteger(v) && v >= 0 && v <= 8640000000000000;
const corrupt: () => never = () => { throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid immutable ingress migration'); };
const pathChoice = (v: NonNullable<PublicationForwardState['path']>) => ({ templateId: v.templateId, revision: v.revision, configDigest: v.configDigest });
const groupChoice = (v: NonNullable<PublicationForwardState['group']>) => ({ groupId: v.groupId, revision: v.revision, configDigest: v.configDigest, candidateId: v.candidateId });
function identity(actor: string, scope: string, id?: string) {
    if (![actor,scope,...(id === undefined ? [] : [id])].every(isId)) invalid('Valid ingress migration identity required');
}
function checkedHead(head: IngressDeploymentHead) {
    if (!head || !isId(head.batchId) || !isCounter(head.revision) || head.revision > INGRESS_MIGRATION_LIMITS.maxBatchRevision || !isId(head.createdBy) ||
        !time(head.createdAt) || !publicationHash(head.planDigest) || typeof head.cancelled !== 'boolean' || typeof head.recoveryInvalidated !== 'boolean') corrupt();
    return { ...head };
}
function checkedResult(value: PublicationForwardResult | IngressRemovalResult, record: Pick<IngressMigrationRecord, 'plan' | 'attempts'>, position: number, kind: IngressMigrationAttempt['kind']) {
    const row = record.plan.items[position - 1]; if (!row) corrupt();
    let state;
    try { state = parsePublicationState(value.state); } catch { return corrupt(); }
    const receipt = value.accepted, body = receipt?.body;
    if (!body || body.forwardId !== state.forwardId || body.revision !== state.revision) corrupt();
    const source = row.source === null ? null : record.plan.sources[row.source - 1]!.state;
    const applied = kind === 'compensate' ? record.attempts.find(attempt => attempt.position === position && attempt.kind === 'apply') : undefined;
    if (kind === 'compensate' && (!applied?.outcome.accepted || row.kind === 'remove')) corrupt();
    const before = kind === 'compensate' ? applied!.outcome.accepted ? applied!.outcome.result.state : corrupt() : source;
    const removing = kind === 'apply' && row.kind === 'remove' || kind === 'compensate' && row.kind === 'add';
    if (removing) {
        if (!before || !('deleting' in value) || value.deleting !== true || receipt.status !== 202 || !isId(body.operationId) ||
            state.forwardId !== before.forwardId || state.revision !== before.revision + 1 || !same({ ...state, revision: before.revision }, before) ||
            body.pathBinding !== undefined || body.pathGroupBinding !== undefined) corrupt();
        return { accepted: { status: 202 as const, body: { ...body } }, state, deleting: true as const };
    }
    if ('deleting' in value) corrupt();
    const desiredDigest = kind === 'apply' ? row.specDigest! : source!.specDigest;
    const changed = before === null || before.specDigest !== desiredDigest;
    if (state.specDigest !== desiredDigest || state.revision !== (before === null ? 1 : before.revision + Number(changed)) ||
        before !== null && state.forwardId !== before.forwardId || receipt.status !== (changed ? 202 : 200) || (changed ? !isId(body.operationId) : body.operationId !== null)) corrupt();
    if (state.path) {
        const path = body.pathBinding;
        if (!path || typeof path.changed !== 'boolean' || !same({ ...state.path, changed: path.changed }, path)) corrupt();
    } else if (body.pathBinding !== undefined) corrupt();
    if (state.group) {
        const group = body.pathGroupBinding;
        if (!group || typeof group.changed !== 'boolean' || !same({ ...state.group, changed: group.changed }, group)) corrupt();
    } else if (body.pathGroupBinding !== undefined) corrupt();
    if (kind === 'apply') {
        if (!state.path || state.group !== null || !same(pathChoice(state.path), row.template)) corrupt();
        if (row.kind === 'add' && (state.path.sequence !== 1 || state.path.forwardRevision !== 1 || body.pathBinding!.changed !== true)) corrupt();
    } else if (!source || (state.path === null) !== (source.path === null) || (state.group === null) !== (source.group === null) ||
        state.path && source.path && !same(pathChoice(state.path), pathChoice(source.path)) || state.group && source.group && !same(groupChoice(state.group), groupChoice(source.group))) corrupt();
    return { accepted: { status: receipt.status, body: { ...body } }, state };
}
function checkedRecord(input: IngressMigrationRecord, id: string): IngressMigrationRecord {
    const head = checkedHead(input.head);
    let plan: IngressMigrationPlan;
    try { plan = parseIngressMigrationPlan(input.plan); } catch { return corrupt(); }
    if (head.batchId !== id || head.planDigest !== digest(plan) || !Array.isArray(input.attempts) || input.attempts.length > plan.items.length * 2 ||
        head.revision !== 1 + input.attempts.length + Number(head.cancelled) + Number(head.recoveryInvalidated)) corrupt();
    const attempts: IngressMigrationAttempt[] = [], seen = new Set<string>(), adds = new Set<string>();
    for (const item of [...input.attempts].sort((a,b) => a.position - b.position || (a.kind === 'apply' ? -1 : 1))) {
        if (!Number.isSafeInteger(item.position) || item.position < 1 || item.position > plan.items.length || !['apply','compensate'].includes(item.kind) ||
            item.actorId !== head.createdBy || !time(item.createdAt) || typeof item.requestKey !== 'string' || !item.requestKey.length || item.requestKey.length > 128 ||
            /[^\x21-\x7e]/.test(item.requestKey) || !publicationHash(item.requestDigest) || seen.has(item.position + ':' + item.kind)) corrupt();
        seen.add(item.position + ':' + item.kind);
        if (item.kind === 'compensate' && (plan.items[item.position - 1]!.kind === 'remove' || !attempts.some(prior => prior.position === item.position && prior.kind === 'apply' && prior.outcome.accepted))) corrupt();
        if (item.outcome.accepted === true) {
            checkedResult(item.outcome.result, { plan, attempts }, item.position, item.kind);
            if (item.kind === 'apply' && plan.items[item.position - 1]!.kind === 'add') {
                const forwardId = item.outcome.result.state.forwardId;
                if (adds.has(forwardId) || plan.sources.some(source => source.state.forwardId === forwardId)) corrupt(); adds.add(forwardId);
            }
        } else if (item.outcome.accepted !== false || !PATH_PUBLICATION_REJECTIONS.has(item.outcome.error.code) || ![403,404,409,422,429].includes(item.outcome.error.status)) corrupt();
        attempts.push(item);
    }
    return deepFreeze({ head, plan, attempts });
}
const attemptView = (attempt: IngressMigrationAttempt) => ({ ...attempt, createdAt: nativeIsoTime(attempt.createdAt) });

/** Explicit bounded migration of selected origins, not a current-membership authority. */
export class IngressMigrations<Tx> implements IngressMigrationApi {
    private readonly db: TransactionBoundary<Tx>;
    private readonly auth: ScopeAuthorization<Tx>;
    private readonly requests: IdempotentRequests<Tx>;
    private readonly store: IngressMigrationStore<Tx>;
    private readonly groups: IngressGroupResolver<Tx>;
    private readonly origins: IngressOrigins<Tx>;
    private readonly forwards: IngressMigrationForwardPort<Tx>;
    private readonly clock: () => number;
    private readonly newId: () => string;
    private readonly access:ResourceReadAccess<Tx>;
    constructor(db: TransactionBoundary<Tx>, auth: ScopeAuthorization<Tx>, access: ResourceReadAccess<Tx>, requests: IdempotentRequests<Tx>, store: IngressMigrationStore<Tx>, groups: IngressGroupResolver<Tx>,
        origins: IngressOrigins<Tx>, forwards: IngressMigrationForwardPort<Tx>, clock: () => number = nativeWallClockSource(), newId: () => string = randomUUID) {
        this.access=access;

        this.db = db; this.auth = auth; this.requests = requests; this.store = store; this.groups = groups; this.origins = origins; this.forwards = forwards; this.clock = clock; this.newId = newId;
    }
    private now() { const at = this.clock(); if (!time(at)) corrupt(); return at; }
    private async lineage(tx: Tx, actor: string, scope: string, ref: IngressOriginRef) {
        const found = parseIngressLineage(await this.origins.resolveIn(tx, actor, scope, ref));
        if (!same(found.ref, ref)) corrupt(); return found;
    }
    private async plan(tx: Tx, actor: string, scope: string, input: IngressMigrationInput) {
        const resolved = new Map<string,IngressLineage>();
        const refs = [...input.sources].sort((a,b) => {
            const left = a.kind + ':' + a.batchId, right = b.kind + ':' + b.batchId; return left < right ? -1 : left > right ? 1 : a.position - b.position;
        });
        for (const ref of refs) resolved.set(digest(ref), await this.lineage(tx, actor, scope, ref));
        const sources = input.sources.map(ref => resolved.get(digest(ref))!);
        for (const source of [...sources].sort((a,b) => a.state.forwardId < b.state.forwardId ? -1 : a.state.forwardId > b.state.forwardId ? 1 : 0))
            await this.forwards.inspectIngressIn(tx, actor, scope, source.state);
        const source = await this.groups.describeIn(tx, actor, scope, input.sourceGroup), target = await this.groups.describeIn(tx, actor, scope, input.targetGroup, true);
        const ids = [...new Set([...source.members,...target.members].map(member => member.memberId))].sort();
        const changes: IngressDefinitionChange[] = ids.map(memberId => {
            const old = source.members.find(member => member.memberId === memberId), next = target.members.find(member => member.memberId === memberId);
            const sourceIngress = old?.config.nodes[0] ?? null, targetIngress = next?.config.nodes[0] ?? null;
            return { memberId, kind: !old ? 'added' : !next ? 'removed' : sourceIngress !== targetIngress ? 'ingress-changed' : same(old.template,next.template) ? 'unchanged' : 'reference-changed',
                sourceTemplate: old?.template ?? null, targetTemplate: next?.template ?? null, sourceIngress, targetIngress };
        });
        const items = [];
        for (const [index, action] of input.items.entries()) {
            if (action.kind === 'remove') {
                const old = sources[action.source - 1]!;
                items.push({ position: index + 1, kind: action.kind, memberId: old.memberId, source: action.source, template: null, spec: null, specDigest: null });
                continue;
            }
            const member = target.members.find(member => member.memberId === action.memberId); if (!member) invalid('Action target is not an immutable target member');
            if (action.kind === 'add') {
                const spec = { enabled: action.enabled, protocols: member.config.protocols, ingress: { nodeId: member.config.nodes[0]!, listen: action.listen },
                    target: action.target, path: { via: member.config.nodes.slice(1) }, transport: member.config.transport };
                const preview = await this.forwards.previewIngressIn(tx, actor, scope, spec, member.template);
                items.push({ position: index + 1, kind: action.kind, memberId: action.memberId, source: null, template: member.template, ...preview });
            } else {
                const old = sources[action.source - 1]!, desired = { ...old.state.spec, path: { via: member.config.nodes.slice(1) }, transport: member.config.transport };
                if (old.memberId !== action.memberId || old.state.spec.ingress.nodeId !== member.config.nodes[0]) invalid('Ingress or member changes require explicit add and remove actions');
                const preview = await this.forwards.previewIngressUpdateIn(tx, actor, scope, old.state, desired, member.template);
                items.push({ position: index + 1, kind: action.kind, memberId: action.memberId, source: action.source, template: member.template, spec: preview.spec, specDigest: preview.specDigest });
            }
        }
        return parseIngressMigrationPlan({ schemaVersion: 1, sourceGroup: input.sourceGroup, targetGroup: input.targetGroup,
            sourceDefinition: source.config, targetDefinition: target.config, sources, changes, items });
    }
    async preview(actor: string, scope: string, input: unknown) {
        identity(actor, scope); const selection = parseIngressMigrationInput(input);
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope, true);
            const plan = await this.plan(tx, actor, scope, selection);
            return deepFreeze({ ...plan, previewDigest: digest(plan), limits: INGRESS_MIGRATION_LIMITS, ...flags,
                impactScope: 'selected-origins-not-global-membership', interruption: 'explicit-independent-rule-actions', removeCompensation: false });
        });
    }
    async create(actor: string, scope: string, key: string | undefined, input: unknown, previewDigest: unknown) {
        identity(actor, scope); const selection = parseIngressMigrationInput(input);
        if (!publicationHash(previewDigest)) invalid('Exact ingress migration preview digest required');
        const request = requestIdentity(actor, scope, key, 'POST', `/api/v1/scopes/${scope}/ingress-migrations`, { ...selection, previewDigest });
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope, true);
            const replay = await this.requests.claim<Created>(tx, request); if (replay) return replay;
            await this.store.lockScope(tx, scope);
            const count = await this.store.count(tx, scope);
            if (!Number.isSafeInteger(count) || count < 0 || count > INGRESS_MIGRATION_LIMITS.batchesPerScope) corrupt();
            if (count >= INGRESS_MIGRATION_LIMITS.batchesPerScope) throw new ControlError('RESOURCE_LIMIT', 429, 'Ingress migration quota includes terminal and restored batches');
            const plan = await this.plan(tx, actor, scope, selection);
            if (digest(plan) !== previewDigest) throw new ControlError('PUBLICATION_STATE_CHANGED', 409, 'Origin, baseline or migration expansion changed; explicitly preview again');
            const batchId = this.newId(); if (!isId(batchId)) corrupt();
            await this.store.create(tx, scope, { batchId, revision: 1, createdBy: actor, createdAt: this.now(), planDigest: previewDigest, cancelled: false, recoveryInvalidated: false }, plan);
            const response: Created = { status: 202, body: { batchId, revision: 1, planDigest: previewDigest, changed: true, reserved: false, executionAuthorized: false } };
            await this.requests.respond(tx, request, response); return response;
        });
    }
    private async read(tx: Tx, scope: string, id: string, lock = false) {
        const record = await this.store.read(tx, scope, id, lock); if (!record) notFound();
        try { return checkedRecord(record, id); } catch { return corrupt(); }
    }
    async originIn(tx: Tx, actor: string, scope: string, input: IngressOriginRef): Promise<IngressLineage> {
        identity(actor, scope); const ref = parseIngressOriginRef(input);
        if (ref.kind !== 'migration') invalid('Exact migration origin required');
        await this.auth.scope(tx, actor, scope);
        await this.access.owned(tx, actor, scope, 'ingress-migration', ref.batchId);
        const record = await this.read(tx, scope, ref.batchId);
        if (record.head.recoveryInvalidated) throw new ControlError('RECOVERY_REPLAY_REQUIRES_REVIEW', 409, 'Restored migration origin cannot authorize new migration');
        const item = record.plan.items[ref.position - 1], applied = record.attempts.find(attempt => attempt.position === ref.position && attempt.kind === 'apply'), compensation = record.attempts.find(attempt => attempt.position === ref.position && attempt.kind === 'compensate');
        if (!item || item.kind === 'remove' || !applied?.outcome.accepted) throw new ControlError('PUBLICATION_STATE_CHANGED', 409, 'Origin has no eligible accepted live-state receipt');
        if (ref.phase === 'apply') {
            if (compensation?.outcome.accepted) throw new ControlError('PUBLICATION_STATE_CHANGED', 409, 'Origin apply was compensated; select the exact eligible restoration receipt');
            return parseIngressLineage({ ref, group: record.plan.targetGroup, memberId: item.memberId, template: item.template, state: applied.outcome.result.state });
        }
        if (item.kind !== 'update' || !compensation?.outcome.accepted) throw new ControlError('PUBLICATION_STATE_CHANGED', 409, 'Only accepted update restoration is a compensating live-state origin');
        const source = record.plan.sources[item.source! - 1]!;
        return parseIngressLineage({ ...source, ref, state: compensation.outcome.result.state });
    }
    async list(actor: string, scope: string, input: { page?: string | undefined; limit?: string | undefined; groupId?: string | undefined } = {}) {
        identity(actor, scope);
        if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype,null].includes(Object.getPrototypeOf(input)) || Object.keys(input).some(key => !['page','limit','groupId'].includes(key)) ||
            input.page !== undefined && typeof input.page !== 'string' || input.limit !== undefined && typeof input.limit !== 'string' || input.groupId !== undefined && !isId(input.groupId)) invalid('Bounded migration list required');
        const paging = Object.freeze(consolePage(input.page,input.limit)), groupId = input.groupId;
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope);
            const principal = await this.access.principal(tx, actor, scope);
            const page = await this.store.list(tx, scope, principal, paging, groupId);
            if (!Number.isSafeInteger(page.total) || page.total < 0 || page.total > INGRESS_MIGRATION_LIMITS.batchesPerScope || !Array.isArray(page.items) || page.items.length > paging.limit || new Set(page.items.map(item => item.batchId)).size !== page.items.length) corrupt();
            return deepFreeze({ ...paging, total: page.total, items: page.items.map(item => ({ ...checkedHead(item), createdAt: nativeIsoTime(item.createdAt) })), ...flags });
        });
    }
    async get(actor: string, scope: string, id: string) {
        identity(actor, scope, id);
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope);
            await this.access.owned(tx, actor, scope, 'ingress-migration', id, true);
            const record = await this.read(tx, scope, id), refs = record.attempts.flatMap(attempt => attempt.outcome.accepted && attempt.outcome.result.accepted.body.operationId ? [attempt.outcome.result.accepted.body] : []);
            const ids = [...new Set(refs.map(ref => ref.operationId!))], operations = ids.length ? await this.store.operations(tx, scope, ids) : [];
            if (operations.length > ids.length || new Set(operations.map(item => item.operationId)).size !== operations.length || operations.some(item =>
                !refs.some(ref => ref.operationId === item.operationId && ref.forwardId === item.forwardId && ref.revision === item.targetRevision) ||
                !['accepted','running','succeeded','failed','superseded'].includes(item.status) || typeof item.cleanupPending !== 'boolean' || typeof item.recoveryInvalidated !== 'boolean')) corrupt();
            return deepFreeze({ ...record.head, createdAt: nativeIsoTime(record.head.createdAt), plan: record.plan, attempts: record.attempts.map(attemptView),
                items: record.plan.items.map(item => {
                    const apply = record.attempts.find(attempt => attempt.position === item.position && attempt.kind === 'apply'), compensation = record.attempts.find(attempt => attempt.position === item.position && attempt.kind === 'compensate');
                    return { position: item.position, action: item.kind, state: apply ? apply.outcome.accepted ? 'accepted' : 'rejected' : record.head.recoveryInvalidated ? 'suspended' : record.head.cancelled ? 'cancelled' : 'pending',
                        apply: apply ? attemptView(apply) : null, compensation: compensation ? attemptView(compensation) : null, compensatable: item.kind !== 'remove' };
                }), operations, ...flags, impactScope: 'selected-origins-not-global-membership', removeCompensation: false, consistency: 'read-committed-not-global-snapshot' });
        });
    }
    async act(actor: string, scope: string, id: string, key: string | undefined, expectedRevision: number, kind: IngressMigrationAttempt['kind'], position: number) {
        identity(actor, scope, id);
        if (!isCounter(expectedRevision) || expectedRevision > INGRESS_MIGRATION_LIMITS.maxBatchRevision || !['apply','compensate'].includes(kind) || !Number.isSafeInteger(position) || position < 1 || position > INGRESS_MIGRATION_LIMITS.itemsPerBatch) invalid('Exact migration batch CAS and item required');
        const request = requestIdentity(actor, scope, key, 'POST', `/api/v1/scopes/${scope}/ingress-migrations/${id}/items/${position}/${kind}`, { expectedRevision });
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope, true);
            const record = await this.read(tx, scope, id, true);
            if (record.head.createdBy !== actor) throw new ControlError('AUTHORIZATION_DENIED', 403, 'Only original current manager can advance this migration');
            if (record.head.recoveryInvalidated) throw new ControlError('RECOVERY_REPLAY_REQUIRES_REVIEW', 409, 'Restored migrations cannot execute or compensate');
            const replay = await this.requests.claim<Acted>(tx, request); if (replay) return replay;
            if (record.head.revision !== expectedRevision) throw new ControlError('REVISION_CONFLICT', 409, 'Migration changed; explicitly reload');
            const row = record.plan.items[position - 1]; if (!row) notFound();
            if (record.attempts.some(attempt => attempt.position === position && attempt.kind === kind)) throw new ControlError('PUBLICATION_ITEM_ATTEMPTED', 409, 'This migration action already has a durable decision');
            if (kind === 'apply' && record.head.cancelled) throw new ControlError('PUBLICATION_CANCELLED', 409, 'Future migration applies were cancelled');
            const applied = record.attempts.find(attempt => attempt.position === position && attempt.kind === 'apply');
            if (kind === 'compensate' && (row.kind === 'remove' || !applied?.outcome.accepted)) throw new ControlError('PUBLICATION_NOT_COMPENSATABLE', 409, 'Remove is irreversible; only accepted add/update can be compensated');
            const result = await this.store.isolate(tx, async () => {
                let value: PublicationForwardResult | IngressRemovalResult;
                const source = row.source === null ? null : record.plan.sources[row.source - 1]!;
                if (kind === 'apply') {
                    if (source && !same(await this.lineage(tx, actor, scope, source.ref), source)) throw new ControlError('PUBLICATION_STATE_CHANGED', 409, 'Exact origin outcome changed; no silent rebase');
                    if (source) await this.forwards.inspectIngressIn(tx, actor, scope, source.state);
                    if (row.kind === 'remove') value = await this.forwards.removeIngressIn(tx, request, source!.state);
                    else {
                        const [member] = await this.groups.resolveIn(tx, actor, scope, record.plan.targetGroup, [row.memberId]);
                        if (!member || !same(member.template,row.template)) corrupt();
                        value = row.kind === 'add' ? await this.forwards.createIngressIn(tx, request, row.spec!, row.template!) :
                            await this.forwards.updateIngressIn(tx, request, source!.state, row.spec!, row.template!);
                    }
                } else {
                    const accepted = applied!.outcome.accepted ? applied!.outcome.result.state : corrupt();
                    value = row.kind === 'add' ? await this.forwards.removeIngressIn(tx, request, accepted) :
                        await this.forwards.compensatePublicationIn(tx, request, accepted, source!.state);
                }
                return checkedResult(value,record,position,kind);
            });
            const attempt: IngressMigrationAttempt = { position, kind, actorId: actor, createdAt: this.now(), requestKey: request.key, requestDigest: request.digest,
                outcome: result.accepted ? { accepted: true, result: result.value } : { accepted: false, error: result.error } };
            await this.store.append(tx, scope, id, expectedRevision, attempt);
            const response: Acted = { status: 202, body: { batchId: id, revision: expectedRevision + 1, position, kind, attempt: attemptView(attempt), atomicAcrossForwards: false } };
            await this.requests.respond(tx, request, response); return response;
        });
    }
    async cancel(actor: string, scope: string, id: string, key: string | undefined, expectedRevision: number) {
        identity(actor, scope, id);
        if (!isCounter(expectedRevision) || expectedRevision > INGRESS_MIGRATION_LIMITS.maxBatchRevision) invalid('Exact migration batch CAS required');
        const request = requestIdentity(actor, scope, key, 'POST', `/api/v1/scopes/${scope}/ingress-migrations/${id}/cancel`, { expectedRevision });
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope, true);
            const record = await this.read(tx, scope, id, true);
            if (record.head.createdBy !== actor) throw new ControlError('AUTHORIZATION_DENIED', 403, 'Only original current manager can cancel this migration');
            if (record.head.recoveryInvalidated) throw new ControlError('RECOVERY_REPLAY_REQUIRES_REVIEW', 409, 'Restored migrations remain suspended');
            const replay = await this.requests.claim<Cancelled>(tx, request); if (replay) return replay;
            if (record.head.revision !== expectedRevision) throw new ControlError('REVISION_CONFLICT', 409, 'Migration changed; explicitly reload');
            const changed = !record.head.cancelled;
            if (changed) await this.store.cancel(tx, scope, id, expectedRevision, actor, this.now());
            const response: Cancelled = { status: changed ? 202 : 200, body: { batchId: id, revision: expectedRevision + Number(changed), cancelled: true, changed } };
            await this.requests.respond(tx, request, response); return response;
        });
    }
}
