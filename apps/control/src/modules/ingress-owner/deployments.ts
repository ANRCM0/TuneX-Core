import { deepFreeze, isCounter, isId } from '@tunex/core';
import { nativeValueDigest as digest, nativeModuleId as randomUUID, nativeCommandRequest as requestIdentity, nativeWallClockSource, nativeIsoTime } from '../../compatibility/public.ts';

import { pageWindow as consolePage } from '../../framework/public.ts';

import { ControlError, invalid, notFound } from '../../framework/public.ts';
import type { IngressGroupResolver } from './contracts.ts';
import type { IngressDeploymentApi, IngressDeploymentCreated as Created, IngressDeploymentActed as Acted, IngressDeploymentCancelled as Cancelled } from './deployment-api.ts';
import type { IdempotentRequests, ScopeAuthorization, TransactionBoundary } from '../../framework/public.ts';
import { INGRESS_LIMITS, parseIngressInput, parseIngressPlan } from './values.ts';
import { parsePublicationState, PATH_PUBLICATION_REJECTIONS, publicationHash } from '../path-owner/public.ts';
import type { IngressAttempt, IngressDeploymentHead, IngressDeploymentInput, IngressDeploymentRecord, IngressDeploymentStore, IngressForwardPort, IngressPlan, IngressRemovalResult } from './contracts.ts';
import type { PublicationForwardResult } from '../path-owner/public.ts';
import type { IngressLineage, IngressOriginRef } from './migration-contracts.ts';
import { parseIngressOriginRef } from './migration-values.ts';

const flags = { source: 'persisted-control-state', reserved: false, executionAuthorized: false, fullPlanAuthorization: false,
    health: 'unknown', automaticExecution: false, atomicAcrossForwards: false, physicalConnectionSharing: false } as const;
const same = (a: unknown, b: unknown) => digest(a) === digest(b);
const time = (value: number) => Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000;
const corrupt: () => never = () => { throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid immutable ingress deployment'); };
function identity(actor: string, scope: string, id?: string) {
    if (![actor,scope,...(id === undefined ? [] : [id])].every(isId)) invalid('Valid ingress identity required');
}
function checkedHead(head: IngressDeploymentHead) {
    if (!head || !isId(head.batchId) || !isCounter(head.revision) || head.revision > INGRESS_LIMITS.maxBatchRevision || !isId(head.createdBy) ||
        !time(head.createdAt) || !publicationHash(head.planDigest) || typeof head.cancelled !== 'boolean' || typeof head.recoveryInvalidated !== 'boolean') corrupt();
    return { ...head };
}
function checkedResult(value: PublicationForwardResult | IngressRemovalResult, record: Pick<IngressDeploymentRecord, 'plan' | 'attempts'>, position: number, kind: IngressAttempt['kind']) {
    const item = record.plan.items[position - 1]; if (!item) corrupt();
    let state;
    try { state = parsePublicationState(value.state); } catch { return corrupt(); }
    const receipt = value.accepted, body = receipt?.body;
    if (!body || receipt.status !== 202 || body.forwardId !== state.forwardId || body.revision !== state.revision || !isId(body.operationId)) corrupt();
    if (kind === 'create') {
        if ('deleting' in value || state.revision !== 1 || state.specDigest !== item.specDigest || state.group !== null || !state.path ||
            state.path.sequence !== 1 || state.path.forwardRevision !== 1 || !same(item.template, { templateId: state.path.templateId, revision: state.path.revision, configDigest: state.path.configDigest }) ||
            !same({ ...state.path, changed: true }, body.pathBinding) || body.pathGroupBinding !== undefined) corrupt();
        return { accepted: { status: 202 as const, body: { ...body } }, state };
    }
    const created = record.attempts.find(attempt => attempt.position === position && attempt.kind === 'create');
    if (!created?.outcome.accepted) corrupt();
    const original = created.outcome.result;
    if (!('deleting' in value) || value.deleting !== true || state.forwardId !== original.state.forwardId || state.revision !== original.state.revision + 1 ||
        !same({ ...state, revision: original.state.revision }, original.state) || body.operationId === original.accepted.body.operationId ||
        body.pathBinding !== undefined || body.pathGroupBinding !== undefined) corrupt();
    return { accepted: { status: 202 as const, body: { ...body } }, state, deleting: true as const };
}
function checkedRecord(input: IngressDeploymentRecord, id: string) {
    const head = checkedHead(input.head);
    let plan: IngressPlan;
    try { plan = parseIngressPlan(input.plan); } catch { return corrupt(); }
    if (head.batchId !== id || head.planDigest !== digest(plan) || !Array.isArray(input.attempts) || input.attempts.length > plan.items.length * 2 ||
        head.revision !== 1 + input.attempts.length + Number(head.cancelled) + Number(head.recoveryInvalidated)) corrupt();
    const attempts: IngressAttempt[] = [], seen = new Set<string>(), createdIds = new Set<string>();
    for (const item of [...input.attempts].sort((a,b) => a.position - b.position || (a.kind === 'create' ? -1 : 1))) {
        if (!Number.isSafeInteger(item.position) || item.position < 1 || item.position > plan.items.length || !['create','compensate'].includes(item.kind) ||
            item.actorId !== head.createdBy || !time(item.createdAt) || typeof item.requestKey !== 'string' || !item.requestKey.length || item.requestKey.length > 128 ||
            /[^\x21-\x7e]/.test(item.requestKey) || !publicationHash(item.requestDigest) || seen.has(item.position + ':' + item.kind)) corrupt();
        seen.add(item.position + ':' + item.kind);
        if (item.kind === 'compensate' && !attempts.some(prior => prior.position === item.position && prior.kind === 'create' && prior.outcome.accepted)) corrupt();
        if (item.outcome.accepted === true) {
            checkedResult(item.outcome.result, { plan, attempts }, item.position, item.kind);
            if (item.kind === 'create') {
                const forwardId = item.outcome.result.state.forwardId;
                if (createdIds.has(forwardId)) corrupt(); createdIds.add(forwardId);
            }
        } else if (item.outcome.accepted !== false || !PATH_PUBLICATION_REJECTIONS.has(item.outcome.error.code) || ![403,404,409,422,429].includes(item.outcome.error.status)) corrupt();
        attempts.push(item);
    }
    return deepFreeze({ head, plan, attempts });
}
const attemptView = (attempt: IngressAttempt) => ({ ...attempt, createdAt: nativeIsoTime(attempt.createdAt) });

/** Coordinates independent ingress creation; it does not own Forward or Runtime writes. */
export class IngressDeployments<Tx> implements IngressDeploymentApi {
    private readonly db: TransactionBoundary<Tx>;
    private readonly auth: ScopeAuthorization<Tx>;
    private readonly requests: IdempotentRequests<Tx>;
    private readonly store: IngressDeploymentStore<Tx>;
    private readonly groups: Pick<IngressGroupResolver<Tx>,'resolveIn'>;
    private readonly forwards: IngressForwardPort<Tx>;
    private readonly clock: () => number;
    private readonly newId: () => string;
    constructor(db: TransactionBoundary<Tx>, auth: ScopeAuthorization<Tx>, requests: IdempotentRequests<Tx>, store: IngressDeploymentStore<Tx>,
        groups: Pick<IngressGroupResolver<Tx>,'resolveIn'>, forwards: IngressForwardPort<Tx>, clock: () => number = nativeWallClockSource(), newId: () => string = randomUUID) {
        this.db = db; this.auth = auth; this.requests = requests; this.store = store; this.groups = groups; this.forwards = forwards; this.clock = clock; this.newId = newId;
    }
    private now() { const at = this.clock(); if (!time(at)) corrupt(); return at; }
    private async plan(tx: Tx, actor: string, scope: string, input: IngressDeploymentInput) {
        const members = await this.groups.resolveIn(tx, actor, scope, input.group, input.items.map(item => item.memberId)), items = [];
        for (const [index, source] of input.items.entries()) {
            const member = members[index]!;
            const spec = { enabled: input.enabled, protocols: member.config.protocols, ingress: { nodeId: member.config.nodes[0]!, listen: source.listen },
                target: input.target, path: { via: member.config.nodes.slice(1) }, transport: member.config.transport };
            const resolved = await this.forwards.previewIngressIn(tx, actor, scope, spec, member.template);
            items.push({ position: index + 1, memberId: source.memberId, template: member.template, ...resolved });
        }
        return parseIngressPlan({ schemaVersion: 1, group: input.group, items });
    }
    async preview(actor: string, scope: string, input: unknown) {
        identity(actor, scope); const selection = parseIngressInput(input);
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope, true);
            const plan = await this.plan(tx, actor, scope, selection);
            return deepFreeze({ ...plan, previewDigest: digest(plan), limits: INGRESS_LIMITS, ...flags, interruption: 'independent-ingress-listeners' });
        });
    }
    async create(actor: string, scope: string, key: string | undefined, input: unknown, previewDigest: unknown) {
        identity(actor, scope); const selection = parseIngressInput(input);
        if (!publicationHash(previewDigest)) invalid('Exact ingress preview digest required');
        const request = requestIdentity(actor, scope, key, 'POST', `/api/v1/scopes/${scope}/ingress-deployments`, { ...selection, previewDigest });
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope, true);
            const replay = await this.requests.claim<Created>(tx, request); if (replay) return replay;
            await this.store.lockScope(tx, scope);
            const count = await this.store.count(tx, scope);
            if (!Number.isSafeInteger(count) || count < 0 || count > INGRESS_LIMITS.batchesPerScope) corrupt();
            if (count >= INGRESS_LIMITS.batchesPerScope) throw new ControlError('RESOURCE_LIMIT', 429, 'Ingress deployment quota includes terminal and restored batches');
            const plan = await this.plan(tx, actor, scope, selection);
            if (digest(plan) !== previewDigest) throw new ControlError('PUBLICATION_STATE_CHANGED', 409, 'Exact ingress expansion changed; explicitly preview again');
            const batchId = this.newId(); if (!isId(batchId)) corrupt();
            await this.store.create(tx, scope, { batchId, revision: 1, createdBy: actor, createdAt: this.now(), planDigest: previewDigest, cancelled: false, recoveryInvalidated: false }, plan);
            const response: Created = { status: 202, body: { batchId, revision: 1, planDigest: previewDigest, changed: true, reserved: false, executionAuthorized: false } };
            await this.requests.respond(tx, request, response); return response;
        });
    }
    async list(actor: string, scope: string, input: { page?: string | undefined; limit?: string | undefined; groupId?: string | undefined } = {}) {
        identity(actor, scope);
        if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype,null].includes(Object.getPrototypeOf(input)) || Object.keys(input).some(key => !['page','limit','groupId'].includes(key)) ||
            input.page !== undefined && typeof input.page !== 'string' || input.limit !== undefined && typeof input.limit !== 'string' || input.groupId !== undefined && !isId(input.groupId)) invalid('Bounded ingress deployment list required');
        const paging = Object.freeze(consolePage(input.page, input.limit)), groupId = input.groupId;
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope);
            const page = await this.store.list(tx, scope, paging, groupId);
            if (!Number.isSafeInteger(page.total) || page.total < 0 || page.total > INGRESS_LIMITS.batchesPerScope || !Array.isArray(page.items) || page.items.length > paging.limit || new Set(page.items.map(item => item.batchId)).size !== page.items.length) corrupt();
            return deepFreeze({ ...paging, total: page.total, items: page.items.map(item => ({ ...checkedHead(item), createdAt: nativeIsoTime(item.createdAt) })), ...flags });
        });
    }
    private async read(tx: Tx, scope: string, id: string, lock = false) {
        const record = await this.store.read(tx, scope, id, lock); if (!record) notFound();
        try { return checkedRecord(record, id); } catch { return corrupt(); }
    }
    async originIn(tx: Tx, actor: string, scope: string, input: IngressOriginRef): Promise<IngressLineage> {
        identity(actor, scope); const ref = parseIngressOriginRef(input);
        if (ref.kind !== 'deployment' || ref.phase !== 'apply') invalid('Accepted creation origin required');
        await this.auth.scope(tx, actor, scope);
        const record = await this.read(tx, scope, ref.batchId);
        if (record.head.recoveryInvalidated) throw new ControlError('RECOVERY_REPLAY_REQUIRES_REVIEW', 409, 'Restored creation origin cannot authorize migration');
        const item = record.plan.items[ref.position - 1], created = record.attempts.find(attempt => attempt.position === ref.position && attempt.kind === 'create');
        if (!item || !created?.outcome.accepted || record.attempts.some(attempt => attempt.position === ref.position && attempt.kind === 'compensate' && attempt.outcome.accepted))
            throw new ControlError('PUBLICATION_STATE_CHANGED', 409, 'Creation origin has no eligible live-state receipt');
        return deepFreeze({ ref, group: record.plan.group, memberId: item.memberId, template: item.template, state: created.outcome.result.state });
    }
    async get(actor: string, scope: string, id: string) {
        identity(actor, scope, id);
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope);
            const record = await this.read(tx, scope, id), references = record.attempts.flatMap(item => item.outcome.accepted ? [item.outcome.result.accepted.body] : []);
            const ids = [...new Set(references.map(item => item.operationId!))], operations = ids.length ? await this.store.operations(tx, scope, ids) : [];
            if (operations.length > ids.length || new Set(operations.map(item => item.operationId)).size !== operations.length || operations.some(item =>
                !references.some(reference => reference.operationId === item.operationId && reference.forwardId === item.forwardId && reference.revision === item.targetRevision) ||
                !['accepted','running','succeeded','failed','superseded'].includes(item.status) || typeof item.cleanupPending !== 'boolean' || typeof item.recoveryInvalidated !== 'boolean')) corrupt();
            return deepFreeze({ ...record.head, createdAt: nativeIsoTime(record.head.createdAt), plan: record.plan, attempts: record.attempts.map(attemptView),
                items: record.plan.items.map(item => {
                    const created = record.attempts.find(attempt => attempt.position === item.position && attempt.kind === 'create'), compensation = record.attempts.find(attempt => attempt.position === item.position && attempt.kind === 'compensate');
                    return { position: item.position, state: created ? created.outcome.accepted ? 'accepted' : 'rejected' : record.head.recoveryInvalidated ? 'suspended' : record.head.cancelled ? 'cancelled' : 'pending',
                        create: created ? attemptView(created) : null, compensation: compensation ? attemptView(compensation) : null };
                }), operations, ...flags, consistency: 'read-committed-not-global-snapshot' });
        });
    }
    async act(actor: string, scope: string, id: string, key: string | undefined, expectedRevision: number, kind: IngressAttempt['kind'], position: number) {
        identity(actor, scope, id);
        if (!isCounter(expectedRevision) || expectedRevision > INGRESS_LIMITS.maxBatchRevision || !['create','compensate'].includes(kind) || !Number.isSafeInteger(position) || position < 1 || position > INGRESS_LIMITS.itemsPerBatch) invalid('Exact ingress batch CAS and item required');
        const request = requestIdentity(actor, scope, key, 'POST', `/api/v1/scopes/${scope}/ingress-deployments/${id}/items/${position}/${kind}`, { expectedRevision });
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope, true);
            const record = await this.read(tx, scope, id, true);
            if (record.head.createdBy !== actor) throw new ControlError('AUTHORIZATION_DENIED', 403, 'Only the original current manager can advance this ingress plan');
            if (record.head.recoveryInvalidated) throw new ControlError('RECOVERY_REPLAY_REQUIRES_REVIEW', 409, 'Restored ingress plans cannot execute or compensate');
            const replay = await this.requests.claim<Acted>(tx, request); if (replay) return replay;
            if (record.head.revision !== expectedRevision) throw new ControlError('REVISION_CONFLICT', 409, 'Ingress plan changed; explicitly reload');
            const row = record.plan.items[position - 1]; if (!row) notFound();
            if (record.attempts.some(item => item.position === position && item.kind === kind)) throw new ControlError('PUBLICATION_ITEM_ATTEMPTED', 409, 'This ingress item already has a durable decision');
            if (kind === 'create' && record.head.cancelled) throw new ControlError('PUBLICATION_CANCELLED', 409, 'Future ingress creations were cancelled');
            const created = record.attempts.find(item => item.position === position && item.kind === 'create');
            if (kind === 'compensate' && !created?.outcome.accepted) throw new ControlError('PUBLICATION_NOT_COMPENSATABLE', 409, 'Only accepted creations can request conditional deletion');
            const result = await this.store.isolate(tx, async () => {
                let value: PublicationForwardResult | IngressRemovalResult;
                if (kind === 'create') {
                    const [member] = await this.groups.resolveIn(tx, actor, scope, record.plan.group, [row.memberId]);
                    if (!member || !same(member.template, row.template)) corrupt();
                    value = await this.forwards.createIngressIn(tx, request, row.spec, row.template);
                } else value = await this.forwards.compensateIngressIn(tx, request, created!.outcome.accepted ? created!.outcome.result.state : corrupt());
                return checkedResult(value, record, position, kind);
            });
            const attempt: IngressAttempt = { position, kind, actorId: actor, createdAt: this.now(), requestKey: request.key, requestDigest: request.digest,
                outcome: result.accepted ? { accepted: true, result: result.value } : { accepted: false, error: result.error } };
            await this.store.append(tx, scope, id, expectedRevision, attempt);
            const response: Acted = { status: 202, body: { batchId: id, revision: expectedRevision + 1, position, kind, attempt: attemptView(attempt), atomicAcrossForwards: false } };
            await this.requests.respond(tx, request, response); return response;
        });
    }
    async cancel(actor: string, scope: string, id: string, key: string | undefined, expectedRevision: number) {
        identity(actor, scope, id);
        if (!isCounter(expectedRevision) || expectedRevision > INGRESS_LIMITS.maxBatchRevision) invalid('Exact ingress batch CAS required');
        const request = requestIdentity(actor, scope, key, 'POST', `/api/v1/scopes/${scope}/ingress-deployments/${id}/cancel`, { expectedRevision });
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope, true);
            const record = await this.read(tx, scope, id, true);
            if (record.head.createdBy !== actor) throw new ControlError('AUTHORIZATION_DENIED', 403, 'Only the original current manager can cancel this ingress plan');
            if (record.head.recoveryInvalidated) throw new ControlError('RECOVERY_REPLAY_REQUIRES_REVIEW', 409, 'Restored ingress plans remain suspended');
            const replay = await this.requests.claim<Cancelled>(tx, request); if (replay) return replay;
            if (record.head.revision !== expectedRevision) throw new ControlError('REVISION_CONFLICT', 409, 'Ingress plan changed; explicitly reload');
            const changed = !record.head.cancelled;
            if (changed) await this.store.cancel(tx, scope, id, expectedRevision, actor, this.now());
            const response: Cancelled = { status: changed ? 202 : 200, body: { batchId: id, revision: expectedRevision + Number(changed), cancelled: true, changed } };
            await this.requests.respond(tx, request, response); return response;
        });
    }
}
