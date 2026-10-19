import { deepFreeze, isCounter, isId } from '@tunex/core';
import { nativeValueDigest as digest, nativeModuleId as randomUUID, nativeCommandRequest as requestIdentity, nativeWallClockSource, nativeIsoTime } from '../../compatibility/public.ts';

import { pageWindow as consolePage } from '../../framework/public.ts';

import { ControlError, invalid, notFound } from '../../framework/public.ts';
import type { IdempotentRequests, ScopeAuthorization, TransactionBoundary } from '../../framework/public.ts';
import { checkedPublicationPlan, parsePathPublicationInput, parsePublicationState, PATH_PUBLICATION_LIMITS, PATH_PUBLICATION_REJECTIONS, publicationHash } from './publication-values.ts';
import type { PathPublicationAttempt, PathPublicationForwardPort, PathPublicationHead, PathPublicationInput, PathPublicationPlan, PathPublicationRecord, PathPublicationStore, PublicationForwardResult } from './publication-contracts.ts';
import type { PathPublicationApi, PathPublicationCreated as Created, PathPublicationActed as Acted, PathPublicationCancelled as Cancelled } from './publication-api.ts';

const flags = { source: 'persisted-control-state', reserved: false, executionAuthorized: false, fullPlanAuthorization: false,
    health: 'unknown', automaticExecution: false, atomicAcrossForwards: false } as const;
const time = (value: number) => Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000;
const corrupt: () => never = () => { throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid immutable path publication state'); };
const same = (left: unknown, right: unknown) => digest(left) === digest(right);
const selectedPath = (value: NonNullable<ReturnType<typeof parsePublicationState>['path']>) => ({ templateId: value.templateId, revision: value.revision, configDigest: value.configDigest });
const selectedGroup = (value: NonNullable<ReturnType<typeof parsePublicationState>['group']>) => ({ groupId: value.groupId, revision: value.revision, configDigest: value.configDigest, candidateId: value.candidateId });
function identity(actor: string, scope: string, id?: string) {
    if (![actor, scope, ...(id === undefined ? [] : [id])].every(isId)) invalid('Valid path publication identity required');
}
function checkedHead(head: PathPublicationHead) {
    if (!head || !isId(head.batchId) || !isCounter(head.revision) || head.revision > PATH_PUBLICATION_LIMITS.maxBatchRevision ||
        !isId(head.createdBy) || !time(head.createdAt) || !publicationHash(head.planDigest) || typeof head.cancelled !== 'boolean' || typeof head.recoveryInvalidated !== 'boolean') corrupt();
    return { ...head };
}
function checkedResult(value: PublicationForwardResult, record: Pick<PathPublicationRecord, 'plan' | 'attempts'>, position: number, kind: PathPublicationAttempt['kind']) {
    const row = record.plan.items[position - 1]; if (!row) corrupt();
    let state;
    try { state = parsePublicationState(value.state); } catch { return corrupt(); }
    const receipt = value.accepted;
    let previous = row.source;
    if (kind === 'compensate') {
        const apply = record.attempts.find(item => item.position === position && item.kind === 'apply');
        if (!apply?.outcome.accepted) corrupt();
        previous = apply.outcome.result.state;
    }
    const desiredDigest = kind === 'apply' ? row.proposedDigest : row.source.specDigest, body = receipt?.body;
    const changed = previous.specDigest !== desiredDigest;
    if (!body || state.forwardId !== row.source.forwardId || state.specDigest !== desiredDigest ||
        state.revision !== previous.revision + (changed ? 1 : 0) || body.forwardId !== state.forwardId || body.revision !== state.revision ||
        receipt.status !== (changed ? 202 : 200) || (changed ? !isId(body.operationId) : body.operationId !== null)) corrupt();
    if (state.path) {
        const path = body.pathBinding;
        if (!path || typeof path.changed !== 'boolean' || !same({ ...state.path, changed: path.changed }, path)) corrupt();
    } else if (body.pathBinding !== undefined) corrupt();
    if (state.group) {
        const group = body.pathGroupBinding;
        if (!group || typeof group.changed !== 'boolean' || !same({ ...state.group, changed: group.changed }, group)) corrupt();
    } else if (body.pathGroupBinding !== undefined) corrupt();
    if (kind === 'apply') {
        if (!state.path || !state.group || !same(selectedPath(state.path), row.template) || !same(selectedGroup(state.group), record.plan.group)) corrupt();
    } else if ((state.path === null) !== (row.source.path === null) || (state.group === null) !== (row.source.group === null) ||
        state.path && row.source.path && !same(selectedPath(state.path), selectedPath(row.source.path)) ||
        state.group && row.source.group && !same(selectedGroup(state.group), selectedGroup(row.source.group))) corrupt();
    return { accepted: { status: receipt.status, body: { ...body } }, state };
}
function checkedRecord(input: PathPublicationRecord, id: string): PathPublicationRecord {
    const head = checkedHead(input.head), plan = checkedPublicationPlan(input.plan);
    if (head.batchId !== id || head.planDigest !== digest(plan) || !Array.isArray(input.attempts) || input.attempts.length > plan.items.length * 2 ||
        head.revision !== 1 + input.attempts.length + Number(head.cancelled) + Number(head.recoveryInvalidated)) corrupt();
    const seen = new Set<string>(), attempts: PathPublicationAttempt[] = [];
    for (const item of [...input.attempts].sort((a, b) => a.position - b.position || (a.kind === 'apply' ? -1 : 1))) {
        if (!Number.isSafeInteger(item.position) || item.position < 1 || item.position > plan.items.length || !['apply', 'compensate'].includes(item.kind) ||
            item.actorId !== head.createdBy || !time(item.createdAt) || typeof item.requestKey !== 'string' || !item.requestKey.length || item.requestKey.length > 128 ||
            /[^\x21-\x7e]/.test(item.requestKey) || !publicationHash(item.requestDigest) || seen.has(item.position + ':' + item.kind)) corrupt();
        seen.add(item.position + ':' + item.kind);
        const apply = attempts.find(prior => prior.position === item.position && prior.kind === 'apply');
        if (item.kind === 'compensate' && !apply?.outcome.accepted) corrupt();
        if (item.outcome.accepted === true) checkedResult(item.outcome.result, { plan, attempts }, item.position, item.kind);
        else if (item.outcome.accepted !== false || !PATH_PUBLICATION_REJECTIONS.has(item.outcome.error.code) ||
            ![403, 404, 409, 422, 429].includes(item.outcome.error.status)) corrupt();
        attempts.push(item);
    }
    return deepFreeze({ head, plan, attempts });
}
const attemptView = (item: PathPublicationAttempt) => ({ ...item, createdAt: nativeIsoTime(item.createdAt) });

/** Durable manual coordination; Forwarding alone accepts each execution intent. */
export class PathPublications<Tx> implements PathPublicationApi {
    private readonly db: TransactionBoundary<Tx>;
    private readonly auth: ScopeAuthorization<Tx>;
    private readonly requests: IdempotentRequests<Tx>;
    private readonly store: PathPublicationStore<Tx>;
    private readonly forwards: PathPublicationForwardPort<Tx>;
    private readonly clock: () => number;
    private readonly newId: () => string;
    constructor(db: TransactionBoundary<Tx>, auth: ScopeAuthorization<Tx>, requests: IdempotentRequests<Tx>, store: PathPublicationStore<Tx>,
        forwards: PathPublicationForwardPort<Tx>, clock: () => number = nativeWallClockSource(), newId: () => string = randomUUID) {
        this.db = db; this.auth = auth; this.requests = requests; this.store = store; this.forwards = forwards; this.clock = clock; this.newId = newId;
    }
    private now() { const at = this.clock(); if (!time(at)) corrupt(); return at; }
    private async plan(tx: Tx, actor: string, scope: string, input: PathPublicationInput): Promise<PathPublicationPlan> {
        const rows = [];
        for (const item of [...input.items].sort((a, b) => a.forwardId < b.forwardId ? -1 : a.forwardId > b.forwardId ? 1 : 0)) {
            const row = await this.forwards.previewPublicationIn(tx, actor, scope, item.forwardId, item.expectedRevision, input.group);
            rows.push({ ...row, position: input.items.findIndex(source => source.forwardId === item.forwardId) + 1 });
        }
        return checkedPublicationPlan({ schemaVersion: 1, group: input.group, items: rows.sort((a, b) => a.position - b.position) });
    }
    async preview(actor: string, scope: string, input: unknown) {
        identity(actor, scope); const selection = parsePathPublicationInput(input);
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope, true);
            const plan = await this.plan(tx, actor, scope, selection);
            return deepFreeze({ ...plan, previewDigest: digest(plan), ...flags, limits: PATH_PUBLICATION_LIMITS,
                interruption: 'possible-same-listener-replacement', tcp: 'bounded-drain-or-authorization-deadline', udp: 'associations-may-reset-and-lose-datagrams' });
        });
    }
    async create(actor: string, scope: string, key: string | undefined, input: unknown, previewDigest: unknown) {
        identity(actor, scope); const selection = parsePathPublicationInput(input);
        if (!publicationHash(previewDigest)) invalid('Exact publication preview digest required');
        const request = requestIdentity(actor, scope, key, 'POST', `/api/v1/scopes/${scope}/path-publications`, { ...selection, previewDigest });
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope, true);
            const replay = await this.requests.claim<Created>(tx, request); if (replay) return replay;
            await this.store.lockScope(tx, scope);
            const count = await this.store.count(tx, scope);
            if (!Number.isSafeInteger(count) || count < 0 || count > PATH_PUBLICATION_LIMITS.batchesPerScope) corrupt();
            if (count >= PATH_PUBLICATION_LIMITS.batchesPerScope) throw new ControlError('RESOURCE_LIMIT', 429, 'Scope durable publication limit reached, including terminal and restored batches');
            const plan = await this.plan(tx, actor, scope, selection);
            if (digest(plan) !== previewDigest) throw new ControlError('PUBLICATION_STATE_CHANGED', 409, 'Source intent or provenance changed; explicitly preview again');
            const batchId = this.newId(); if (!isId(batchId)) corrupt();
            await this.store.create(tx, scope, { batchId, revision: 1, createdBy: actor, createdAt: this.now(), planDigest: previewDigest, cancelled: false, recoveryInvalidated: false }, plan);
            const response: Created = { status: 202, body: { batchId, revision: 1, planDigest: previewDigest, changed: true, reserved: false, executionAuthorized: false } };
            await this.requests.respond(tx, request, response); return response;
        });
    }
    async list(actor: string, scope: string, input: { page?: string; limit?: string } = {}) {
        identity(actor, scope);
        if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input)) || Object.keys(input).some(key => !['page', 'limit'].includes(key)) ||
            input.page !== undefined && typeof input.page !== 'string' || input.limit !== undefined && typeof input.limit !== 'string') invalid('Bounded publication list required');
        const paging = Object.freeze(consolePage(input.page, input.limit));
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope);
            const page = await this.store.list(tx, scope, paging);
            if (!Number.isSafeInteger(page.total) || page.total < 0 || page.total > PATH_PUBLICATION_LIMITS.batchesPerScope || !Array.isArray(page.items) || page.items.length > paging.limit || new Set(page.items.map(item => item.batchId)).size !== page.items.length) corrupt();
            return deepFreeze({ ...paging, total: page.total, items: page.items.map(item => ({ ...checkedHead(item), createdAt: nativeIsoTime(item.createdAt) })), ...flags });
        });
    }
    private async read(tx: Tx, scope: string, id: string, lock = false) {
        const record = await this.store.read(tx, scope, id, lock); if (!record) notFound();
        try { return checkedRecord(record, id); } catch { return corrupt(); }
    }
    async get(actor: string, scope: string, id: string) {
        identity(actor, scope, id);
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope);
            const record = await this.read(tx, scope, id), references = record.attempts.flatMap(item => item.outcome.accepted && item.outcome.result.accepted.body.operationId ? [item.outcome.result.accepted.body] : []);
            const ids = [...new Set(references.map(item => item.operationId!))], operations = ids.length ? await this.store.operations(tx, scope, ids) : [];
            if (operations.length > ids.length || new Set(operations.map(item => item.operationId)).size !== operations.length || operations.some(item =>
                !references.some(reference => reference.operationId === item.operationId && reference.forwardId === item.forwardId && reference.revision === item.targetRevision) ||
                !['accepted', 'running', 'succeeded', 'failed', 'superseded'].includes(item.status) || typeof item.cleanupPending !== 'boolean' || typeof item.recoveryInvalidated !== 'boolean')) corrupt();
            return deepFreeze({ ...record.head, createdAt: nativeIsoTime(record.head.createdAt), plan: record.plan, attempts: record.attempts.map(attemptView),
                items: record.plan.items.map(item => {
                    const apply = record.attempts.find(attempt => attempt.position === item.position && attempt.kind === 'apply'), compensation = record.attempts.find(attempt => attempt.position === item.position && attempt.kind === 'compensate');
                    return { position: item.position, state: apply ? apply.outcome.accepted ? 'accepted' : 'rejected' : record.head.recoveryInvalidated ? 'suspended' : record.head.cancelled ? 'cancelled' : 'pending',
                        apply: apply ? attemptView(apply) : null, compensation: compensation ? attemptView(compensation) : null };
                }), operations, ...flags, consistency: 'read-committed-not-global-snapshot' });
        });
    }
    async act(actor: string, scope: string, id: string, key: string | undefined, expectedRevision: number, kind: 'apply' | 'compensate', position: number) {
        identity(actor, scope, id);
        if (!isCounter(expectedRevision) || expectedRevision > PATH_PUBLICATION_LIMITS.maxBatchRevision || !['apply', 'compensate'].includes(kind) || !Number.isSafeInteger(position) || position < 1 || position > PATH_PUBLICATION_LIMITS.itemsPerBatch) invalid('Exact batch CAS and item required');
        const request = requestIdentity(actor, scope, key, 'POST', `/api/v1/scopes/${scope}/path-publications/${id}/items/${position}/${kind}`, { expectedRevision });
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope, true);
            const record = await this.read(tx, scope, id, true);
            if (record.head.createdBy !== actor) throw new ControlError('AUTHORIZATION_DENIED', 403, 'Only the original current manager can advance this publication');
            if (record.head.recoveryInvalidated) throw new ControlError('RECOVERY_REPLAY_REQUIRES_REVIEW', 409, 'Restored publications cannot execute or compensate');
            const replay = await this.requests.claim<Acted>(tx, request); if (replay) return replay;
            if (record.head.revision !== expectedRevision) throw new ControlError('REVISION_CONFLICT', 409, 'Publication changed; explicitly reload');
            const row = record.plan.items[position - 1]; if (!row) notFound();
            if (record.attempts.some(item => item.position === position && item.kind === kind)) throw new ControlError('PUBLICATION_ITEM_ATTEMPTED', 409, 'This explicit item action already has a durable decision');
            if (kind === 'apply' && record.head.cancelled) throw new ControlError('PUBLICATION_CANCELLED', 409, 'Pending items were cancelled');
            const apply = record.attempts.find(item => item.position === position && item.kind === 'apply');
            if (kind === 'compensate' && !apply?.outcome.accepted) throw new ControlError('PUBLICATION_NOT_COMPENSATABLE', 409, 'Only accepted items can be conditionally compensated');
            const result = await this.store.isolate(tx, async () => {
                const value = kind === 'apply' ? await this.forwards.applyPublicationIn(tx, request, row.source, record.plan.group) :
                    await this.forwards.compensatePublicationIn(tx, request, apply!.outcome.accepted ? apply!.outcome.result.state : corrupt(), row.source);
                return checkedResult(value, record, position, kind);
            });
            const attempt: PathPublicationAttempt = { position, kind, actorId: actor, createdAt: this.now(), requestKey: request.key, requestDigest: request.digest,
                outcome: result.accepted ? { accepted: true, result: result.value } : { accepted: false, error: result.error } };
            await this.store.append(tx, scope, id, expectedRevision, attempt);
            const response: Acted = { status: 202, body: { batchId: id, revision: expectedRevision + 1, position, kind, attempt: attemptView(attempt), atomicAcrossForwards: false } };
            await this.requests.respond(tx, request, response); return response;
        });
    }
    async cancel(actor: string, scope: string, id: string, key: string | undefined, expectedRevision: number) {
        identity(actor, scope, id);
        if (!isCounter(expectedRevision) || expectedRevision > PATH_PUBLICATION_LIMITS.maxBatchRevision) invalid('Exact batch CAS required');
        const request = requestIdentity(actor, scope, key, 'POST', `/api/v1/scopes/${scope}/path-publications/${id}/cancel`, { expectedRevision });
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope, true);
            const record = await this.read(tx, scope, id, true);
            if (record.head.createdBy !== actor) throw new ControlError('AUTHORIZATION_DENIED', 403, 'Only the original current manager can cancel this publication');
            if (record.head.recoveryInvalidated) throw new ControlError('RECOVERY_REPLAY_REQUIRES_REVIEW', 409, 'Restored publications remain suspended');
            const replay = await this.requests.claim<Cancelled>(tx, request); if (replay) return replay;
            if (record.head.revision !== expectedRevision) throw new ControlError('REVISION_CONFLICT', 409, 'Publication changed; explicitly reload');
            const changed = !record.head.cancelled;
            if (changed) await this.store.cancel(tx, scope, id, expectedRevision, actor, this.now());
            const response: Cancelled = { status: changed ? 202 : 200, body: { batchId: id, revision: expectedRevision + Number(changed), cancelled: true, changed } };
            await this.requests.respond(tx, request, response); return response;
        });
    }
}
