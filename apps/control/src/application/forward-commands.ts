import { decideForwardChange, isCounter, isId, MAX_COUNTER, parseForwardSpec } from '@tunex/core';
import type { Forward } from '@tunex/core';
import { ControlError, invalid } from './errors.ts';
import { requestIdentity } from './command-request.ts';
import type { IdempotentRequests, ScopeAuthorization, TransactionBoundary, RequestIdentity } from './ports.ts';
import type { ForwardWriter } from '../modules/forwarding-ports.ts';
import type { ForwardCommandPreparation, ForwardOperationCommands } from '../modules/runtime/forward-command-ports.ts';
import { parsePathSelection } from '../modules/path-binding-contract.ts';
import type { ForwardPathBindings, PathBindingReceipt, PathSelection } from '../modules/path-binding-ports.ts';

export interface ForwardAccepted {
    status: 200 | 202;
    body: { forwardId: string; revision: number; operationId: string | null; sourceOperationId?: string; pathBinding?: PathBindingReceipt };
}

function revision(value: number): void {
    if (!isCounter(value)) invalid('Positive safe expectedRevision required');
}

export class ForwardCommands<Tx> {
    private readonly db: TransactionBoundary<Tx>;
    private readonly identity: ScopeAuthorization<Tx>;
    private readonly idempotency: IdempotentRequests<Tx>;
    private readonly forwarding: ForwardWriter<Tx>;
    private readonly operations: ForwardOperationCommands<Tx>;
    private readonly execution: ForwardCommandPreparation<Tx>;
    private readonly newId: () => string;
    private readonly paths: ForwardPathBindings<Tx> | undefined;

    constructor(db: TransactionBoundary<Tx>, identity: ScopeAuthorization<Tx>, idempotency: IdempotentRequests<Tx>,
        forwarding: ForwardWriter<Tx>, operations: ForwardOperationCommands<Tx>, execution: ForwardCommandPreparation<Tx>,
        newId: () => string, paths?: ForwardPathBindings<Tx>) {
        for (const method of ['prepareCreate', 'planCreate', 'prepareUpdate', 'planUpdate', 'lock', 'lockRemoval', 'prepareRetry', 'assertCapacity'] as const)
            if (typeof execution?.[method] !== 'function') throw new Error('Forward execution preparation is required');
        this.db = db; this.identity = identity; this.idempotency = idempotency; this.forwarding = forwarding;
        this.operations = operations; this.execution = execution; this.newId = newId; this.paths = paths;
    }

    async create(actorId: string, scopeId: string, key: string | undefined, input: unknown): Promise<ForwardAccepted> {
        const parsed = parseForwardSpec(input); if (!parsed.ok) invalid('Invalid Forward spec'); const spec = parsed.value;
        const request = requestIdentity(actorId, scopeId, key, 'POST', `/api/v1/scopes/${scopeId}/forwards`, spec);
        return this.db.transaction(async tx => {
            await this.identity.scope(tx, actorId, scopeId);
            const replay = await this.idempotency.claim<ForwardAccepted>(tx, request);
            if (replay) {
                await this.forwarding.record(tx, scopeId, replay.body.forwardId);
                return replay;
            }
            await this.identity.scope(tx, actorId, scopeId, true);
            const forward: Forward = { id: this.newId(), scopeId, revision: 1, spec };
            await this.execution.prepareCreate(tx, actorId, forward);
            await this.forwarding.insert(tx, forward, actorId);
            await this.execution.planCreate(tx, actorId, forward);
            const operationId = await this.operations.accept(tx, forward, request, 'create');
            await this.execution.assertCapacity(tx, forward);
            const response: ForwardAccepted = { status: 202, body: { forwardId: forward.id, revision: 1, operationId } };
            await this.idempotency.respond(tx, request, response);
            return response;
        });
    }

    async update(actorId: string, scopeId: string, id: string, key: string | undefined, expectedRevision: number,
        input: unknown): Promise<ForwardAccepted> {
        revision(expectedRevision);
        if (!isId(id)) invalid('Valid Forward ID required');
        const parsed = parseForwardSpec(input); if (!parsed.ok) invalid('Invalid Forward spec'); const spec = parsed.value;
        const request = requestIdentity(actorId, scopeId, key, 'PUT', `/api/v1/scopes/${scopeId}/forwards/${id}`, { expectedRevision, spec });
        return this.db.transaction(async tx => {
            await this.identity.scope(tx, actorId, scopeId);
            const replay = await this.idempotency.claim<ForwardAccepted>(tx, request);
            if (replay) return replay;
            await this.identity.scope(tx, actorId, scopeId, true);
            const current = await this.forwarding.currentForUpdate(tx, scopeId, id);
            const decision = decideForwardChange(current, expectedRevision, { kind: 'replace', spec });
            if (!decision.ok) throw new ControlError(decision.errors[0]!.code, 409, decision.errors[0]!.message);
            const next = decision.value;
            return this.acceptUpdate(tx, actorId, current, next, request);
        });
    }

    async applyPath(actorId: string, scopeId: string, id: string, key: string | undefined, expectedRevision: number,
        input: unknown): Promise<ForwardAccepted> {
        revision(expectedRevision);
        if (!isId(id)) invalid('Valid Forward ID required');
        const selection = parsePathSelection(input);
        const paths = this.paths; if (!paths) throw new Error('Original path binding preparation is required');
        const request = requestIdentity(actorId, scopeId, key, 'PUT', `/api/v1/scopes/${scopeId}/forwards/${id}/path-binding`, { expectedRevision, template: selection });
        return this.db.transaction(async tx => {
            await this.identity.scope(tx, actorId, scopeId, true);
            const replay = await this.idempotency.claim<ForwardAccepted>(tx, request); if (replay) return replay;
            const current = await this.forwarding.currentForUpdate(tx, scopeId, id);
            if (current.revision !== expectedRevision || (await this.forwarding.record(tx, scopeId, id)).recoverySuspended)
                throw new ControlError('REVISION_CONFLICT', 409, 'Forward changed or recovery suspended');
            const spec = await paths.resolve(tx, actorId, current, selection);
            const decision = decideForwardChange(current, expectedRevision, { kind: 'replace', spec });
            if (!decision.ok) throw new ControlError(decision.errors[0]!.code, 409, decision.errors[0]!.message);
            return this.acceptUpdate(tx, actorId, current, decision.value, request, selection);
        });
    }

    private async acceptUpdate(tx: Tx, actorId: string, current: Forward, next: Forward, request: RequestIdentity,
        selection?: PathSelection): Promise<ForwardAccepted> {
        const recoverySuspended = next.spec.ingress.nodeId !== current.spec.ingress.nodeId ?
            (await this.forwarding.record(tx, current.scopeId, current.id)).recoverySuspended : false;
        await this.execution.prepareUpdate(tx, actorId, current, next, recoverySuspended);
        let operationId: string | null = null;
        if (next.revision !== current.revision) {
            await this.forwarding.replace(tx, current, next);
            if (!selection) await this.paths?.preserve(tx, current, next);
            await this.forwarding.setAuthorizer(tx, next.id, actorId);
            await this.execution.planUpdate(tx, actorId, next);
            const kind = !next.spec.enabled ? 'disable' : !current.spec.enabled ? 'enable' : 'update';
            operationId = await this.operations.accept(tx, next, request, kind, current.spec);
            await this.execution.assertCapacity(tx, next);
        }
        // Exact-path attachment can change provenance without restarting an unchanged Forward.
        const pathBinding = selection ? await this.paths!.accept(tx, actorId, next, selection) : undefined;
        const response: ForwardAccepted = { status: operationId ? 202 : 200, body: { forwardId: next.id, revision: next.revision, operationId,
            ...(pathBinding ? { pathBinding } : {}) } };
        await this.idempotency.respond(tx, request, response);
        return response;
    }

    async remove(actorId: string, scopeId: string, id: string, key: string | undefined, expectedRevision: number): Promise<ForwardAccepted> {
        revision(expectedRevision);
        if (!isId(id)) invalid('Valid Forward ID required');
        const request = requestIdentity(actorId, scopeId, key, 'DELETE', `/api/v1/scopes/${scopeId}/forwards/${id}`, { expectedRevision });
        return this.db.transaction(async tx => {
            await this.identity.scope(tx, actorId, scopeId);
            const replay = await this.idempotency.claim<ForwardAccepted>(tx, request);
            if (replay) return replay;
            await this.identity.scope(tx, actorId, scopeId, true);
            const current = await this.forwarding.currentForUpdate(tx, scopeId, id);
            await this.execution.lockRemoval(tx, current);
            if (current.revision !== expectedRevision)
                throw new ControlError('REVISION_CONFLICT', 409, 'Expected revision does not match');
            if (current.revision >= MAX_COUNTER)
                throw new ControlError('REVISION_EXHAUSTED', 409, 'Revision counter exhausted');
            const next = { ...current, revision: current.revision + 1 };
            await this.forwarding.markDeleting(tx, current, next.revision);
            const operationId = await this.operations.accept(tx, next, request, 'delete', current.spec);
            await this.execution.assertCapacity(tx, next);
            const response: ForwardAccepted = { status: 202, body: { forwardId: id, revision: next.revision, operationId } };
            await this.idempotency.respond(tx, request, response);
            return response;
        });
    }

    async retry(actorId: string, scopeId: string, key: string | undefined, sourceOperationId: string,
        expectedRevision: number): Promise<ForwardAccepted> {
        revision(expectedRevision);
        if (!isId(sourceOperationId)) invalid('Valid Operation ID required');
        const request = requestIdentity(actorId, scopeId, key, 'POST', `/api/v1/scopes/${scopeId}/operations/${sourceOperationId}/retry`, { expectedRevision });
        return this.db.transaction(async tx => {
            await this.identity.scope(tx, actorId, scopeId);
            const replay = await this.idempotency.claim<ForwardAccepted>(tx, request);
            if (replay) return replay;
            await this.identity.scope(tx, actorId, scopeId, true);
            const reference = await this.operations.read(tx, scopeId, sourceOperationId);
            const forward = await this.forwarding.currentForUpdate(tx, scopeId, reference.forward_id);
            await this.execution.lock(tx, forward);
            const source = await this.operations.get(tx, scopeId, sourceOperationId);
            if (source.recovery_invalidated)
                throw new ControlError('OPERATION_SUPERSEDED', 409, 'Restored operation is not an authoritative deployment attempt');
            if (forward.revision !== expectedRevision || source.target_revision !== forward.revision)
                throw new ControlError('OPERATION_SUPERSEDED', 409, 'Operation no longer targets an editable desired revision');
            if (source.status !== 'failed')
                throw new ControlError('OPERATION_NOT_RETRYABLE', 409, 'Only failed Operations can be retried');
            await this.execution.prepareRetry(tx, actorId, forward);
            await this.forwarding.setAuthorizer(tx, forward.id, actorId);
            const operationId = await this.operations.accept(tx, forward, request, 'retry', source.previous_spec, source.id);
            await this.execution.assertCapacity(tx, forward);
            const response: ForwardAccepted = { status: 202, body: { forwardId: forward.id, revision: forward.revision,
                operationId, sourceOperationId: source.id } };
            await this.idempotency.respond(tx, request, response);
            return response;
        });
    }
}
