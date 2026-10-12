import { randomUUID } from 'node:crypto';
import { decideForwardChange, isCounter, isId, MAX_COUNTER, parseForwardSpec } from '@tunex/core';
import type { Forward, ForwardSpec } from '@tunex/core';
import { digest } from '@tunex/contracts';
import { ControlError, invalid } from './errors.ts';
import type { MySqlUnitOfWork } from '../infrastructure/mysql.ts';
import type { Identity } from '../modules/identity.ts';
import type { Nodes } from '../modules/nodes.ts';
import { Forwarding } from '../modules/forwarding.ts';
import { Idempotency } from '../modules/idempotency.ts';
import type { Accepted, RequestIdentity } from '../modules/idempotency.ts';
import { RuntimeLedger } from '../modules/runtime/ledger.ts';
import { compileDirect } from '../modules/runtime/planner.ts';
function requestIdentity(actorId: string, scopeId: string, key: string | undefined, method: string, path: string, input: unknown): RequestIdentity {
    if (!isId(actorId) || !isId(scopeId) || !key || !/^[\x21-\x7e]{1,128}$/.test(key))
        invalid('Valid identity, scope and Idempotency-Key required');
    return { actorId, scopeId, key, digest: digest({ method, path, input }) };
}
function directSpec(input: unknown): ForwardSpec {
    const parsed = parseForwardSpec(input);
    if (!parsed.ok)
        invalid('Invalid Forward spec');
    const spec = parsed.value;
    if (spec.path || spec.transport)
        throw new ControlError('UNSUPPORTED_CAPABILITY', 422, 'Direct TCP/UDP supported; Relay requires its versioned transport');
    return spec;
}
function revision(value: number): void { if (!isCounter(value))
    invalid('Positive safe expectedRevision required'); }
/** Coordinates owner-owned commands inside one durable acceptance transaction. */
export class ControlApplication {
    readonly forwarding = new Forwarding();
    readonly ledger = new RuntimeLedger();
    readonly idempotency = new Idempotency();
    readonly db: MySqlUnitOfWork;
    readonly identity: Identity;
    readonly nodes: Nodes;
    constructor(db: MySqlUnitOfWork, identity: Identity, nodes: Nodes) { this.db = db; this.identity = identity; this.nodes = nodes; }
    async create(actorId: string, scopeId: string, key: string | undefined, input: unknown): Promise<Accepted> {
        const spec = directSpec(input);
        const request = requestIdentity(actorId, scopeId, key, 'POST', `/api/v1/scopes/${scopeId}/forwards`, spec);
        return this.db.transaction(async (tx) => {
            await this.identity.scope(tx, actorId, scopeId);
            const replay = await this.idempotency.claim(tx, request);
            if (replay) {
                await this.forwarding.record(tx, scopeId, replay.body.forwardId);
                return replay;
            }
            await this.identity.scope(tx, actorId, scopeId, true);
            const forward: Forward = { id: randomUUID(), scopeId, revision: 1, spec };
            const facts = await this.nodes.authorized(tx, actorId, forward);
            await this.ledger.lockNode(tx, facts.nodeId);
            compileDirect({ ...forward, spec: { ...spec, enabled: true } }, facts, spec.protocols.map(protocol => ({ nodeId: facts.nodeId, forwardId: forward.id, protocol, port: spec.ingress.listen.port, bindingFence: 1, deploymentGeneration: 1 })));
            const slots = await this.ledger.reserve(tx, forward);
            compileDirect({ ...forward, spec: { ...spec, enabled: true } }, facts, slots);
            await this.forwarding.insert(tx, forward);
            const operationId = await this.ledger.accept(tx, forward, request);
            await this.ledger.assertCapacity(tx, this.forwarding, facts);
            const response: Accepted = { status: 202, body: { forwardId: forward.id, revision: 1, operationId } };
            await this.idempotency.respond(tx, request, response);
            return response;
        });
    }
    async update(actorId: string, scopeId: string, id: string, key: string | undefined, expectedRevision: number, input: unknown): Promise<Accepted> {
        revision(expectedRevision);
        if (!isId(id))
            invalid('Valid Forward ID required');
        const spec = directSpec(input);
        const request = requestIdentity(actorId, scopeId, key, 'PUT', `/api/v1/scopes/${scopeId}/forwards/${id}`, { expectedRevision, spec });
        return this.db.transaction(async (tx) => {
            await this.identity.scope(tx, actorId, scopeId);
            const replay = await this.idempotency.claim(tx, request);
            if (replay)
                return replay;
            await this.identity.scope(tx, actorId, scopeId, true);
            const current = await this.forwarding.currentForUpdate(tx, scopeId, id);
            const decision = decideForwardChange(current, expectedRevision, { kind: 'replace', spec });
            if (!decision.ok)
                throw new ControlError(decision.errors[0]!.code, 409, decision.errors[0]!.message);
            const next = decision.value;
            if (next.spec.ingress.nodeId !== current.spec.ingress.nodeId)
                throw new ControlError('UNSUPPORTED_CAPABILITY', 422, 'Changing ingress Node requires the later multi-node coordinator');
            const facts = await this.nodes.authorized(tx, actorId, next);
            await this.ledger.lockNode(tx, facts.nodeId);
            compileDirect({ ...next, spec: { ...next.spec, enabled: true } }, facts, next.spec.protocols.map(protocol => ({ nodeId: facts.nodeId, forwardId: next.id, protocol, port: next.spec.ingress.listen.port, bindingFence: 1, deploymentGeneration: 1 })));
            if (next.revision === current.revision) {
                const response: Accepted = { status: 200, body: { forwardId: id, revision: current.revision, operationId: null } };
                await this.idempotency.respond(tx, request, response);
                return response;
            }
            // Every changed execution gets a fresh generation/fence, even when currently disabled.
            const slots = await this.ledger.transition(tx, current, next);
            compileDirect({ ...next, spec: { ...next.spec, enabled: true } }, facts, slots);
            await this.forwarding.replace(tx, current, next);
            const kind = !next.spec.enabled ? 'disable' : !current.spec.enabled ? 'enable' : 'update';
            const operationId = await this.ledger.accept(tx, next, request, kind, current.spec);
            await this.ledger.assertCapacity(tx, this.forwarding, facts);
            const response: Accepted = { status: 202, body: { forwardId: id, revision: next.revision, operationId } };
            await this.idempotency.respond(tx, request, response);
            return response;
        });
    }
    async remove(actorId: string, scopeId: string, id: string, key: string | undefined, expectedRevision: number): Promise<Accepted> {
        revision(expectedRevision);
        if (!isId(id))
            invalid('Valid Forward ID required');
        const request = requestIdentity(actorId, scopeId, key, 'DELETE', `/api/v1/scopes/${scopeId}/forwards/${id}`, { expectedRevision });
        return this.db.transaction(async (tx) => {
            await this.identity.scope(tx, actorId, scopeId);
            const replay = await this.idempotency.claim(tx, request);
            if (replay)
                return replay;
            await this.identity.scope(tx, actorId, scopeId, true);
            const current = await this.forwarding.currentForUpdate(tx, scopeId, id);
            await this.ledger.lockNode(tx, current.spec.ingress.nodeId);
            if (current.revision !== expectedRevision)
                throw new ControlError('REVISION_CONFLICT', 409, 'Expected revision does not match');
            if (current.revision >= MAX_COUNTER)
                throw new ControlError('REVISION_EXHAUSTED', 409, 'Revision counter exhausted');
            const next = { ...current, revision: current.revision + 1 };
            await this.forwarding.markDeleting(tx, current, next.revision);
            const operationId = await this.ledger.accept(tx, next, request, 'delete', current.spec);
            const facts = await this.nodes.authorized(tx, actorId, next);
            await this.ledger.assertCapacity(tx, this.forwarding, facts);
            const response: Accepted = { status: 202, body: { forwardId: id, revision: next.revision, operationId } };
            await this.idempotency.respond(tx, request, response);
            return response;
        });
    }
    async retry(actorId: string, scopeId: string, key: string | undefined, sourceOperationId: string, expectedRevision: number): Promise<Accepted> {
        revision(expectedRevision);
        if (!isId(sourceOperationId))
            invalid('Valid Operation ID required');
        const request = requestIdentity(actorId, scopeId, key, 'POST', `/api/v1/scopes/${scopeId}/operations/${sourceOperationId}/retry`, { expectedRevision });
        return this.db.transaction(async (tx) => {
            await this.identity.scope(tx, actorId, scopeId);
            const replay = await this.idempotency.claim(tx, request);
            if (replay)
                return replay;
            await this.identity.scope(tx, actorId, scopeId, true);
            const sourceReference = await this.ledger.read(tx, scopeId, sourceOperationId);
            const forward = await this.forwarding.currentForUpdate(tx, scopeId, sourceReference.forward_id);
            await this.ledger.lockNode(tx, forward.spec.ingress.nodeId);
            const source = await this.ledger.get(tx, scopeId, sourceOperationId);
            if (forward.revision !== expectedRevision || source.target_revision !== forward.revision)
                throw new ControlError('OPERATION_SUPERSEDED', 409, 'Operation no longer targets an editable desired revision');
            if (source.status !== 'failed')
                throw new ControlError('OPERATION_NOT_RETRYABLE', 409, 'Only failed Operations can be retried');
            const facts = await this.nodes.authorized(tx, actorId, forward);
            await this.ledger.lockNode(tx, facts.nodeId);
            if (forward.spec.enabled)
                await this.ledger.transition(tx, forward, forward);
            const operationId = await this.ledger.accept(tx, forward, request, 'retry', source.previous_spec, source.id);
            await this.ledger.assertCapacity(tx, this.forwarding, facts);
            const response: Accepted = { status: 202, body: { forwardId: forward.id, revision: forward.revision, operationId, sourceOperationId: source.id } };
            await this.idempotency.respond(tx, request, response);
            return response;
        });
    }
}
