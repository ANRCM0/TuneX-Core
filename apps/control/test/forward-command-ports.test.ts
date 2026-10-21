import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_COUNTER } from '@tunex/core';
import type { Forward, ForwardSpec } from '@tunex/core';
import { digest } from '@tunex/contracts';
import { ForwardCommands } from '../src/application/forward-commands.ts';
import type { CommandResponse, IdempotentRequests, RequestIdentity, ScopeAuthorization, ScopeOwnerAuthorization, TransactionBoundary } from '../src/application/ports.ts';
import type { ResourceReadAccess } from '../src/framework/public.ts';
import type { ForwardWriter } from '../src/modules/forwarding-ports.ts';
import type { ForwardNodeAuthorization } from '../src/modules/node-execution-ports.ts';
import type { ForwardAuthorizationExecution } from '../src/modules/runtime/authorization-ports.ts';
import type { ForwardOperationCommands, ForwardOperationKind, ForwardRelayHost, ForwardResourceHost, RetrySource } from '../src/modules/runtime/forward-command-ports.ts';
import { ForwardCommandExecutor } from '../src/modules/runtime/forward-commands.ts';
import type { ReservedSlot } from '../src/modules/runtime/planner.ts';

type Tx = Readonly<{ token: symbol }>;
function fixture(relay = false) {
    const tx: Tx = Object.freeze({ token: Symbol('tx') }), events: string[] = [];
    const spec: ForwardSpec = { enabled: true, protocols: ['tcp', 'udp'],
        ingress: { nodeId: 'node-a', listen: { address: '127.0.0.1', port: 32001 } },
        target: { host: '127.0.0.1', port: 80 },
        ...(relay ? { path: { via: ['node-c', 'node-b'] }, transport: { profileId: 'profile-a', configRevision: 1 } } : {}) };
    let state = { forward: { id: 'forward-a', scopeId: 'scope-a', revision: 4, spec } as Forward | null,
        authorizer: 'old-author', deleting: false, recoverySuspended: false, generation: 10,
        source: { id: 'source-a', forward_id: 'forward-a', target_revision: 4, status: 'failed',
            recovery_invalidated: 0, previous_spec: { target: 'historical input' } } as RetrySource & { forward_id: string },
        operations: [] as { id: string; forward: Forward; request: RequestIdentity; kind: ForwardOperationKind; previous: unknown; source: string | null }[],
        slots: [] as ReservedSlot[], plans: [] as number[], leases: [10000],
        responses: new Map<string, { digest: string; response?: CommandResponse }>() };
    const options = { visible: true, resourceVisible: true, manage: true, nodeAllowed: true, relayAllowed: true, oldRevoked: false,
        failure: '', invalidFacts: false, invalidReservation: false, onScope: () => {} };
    function event(current: Tx, name: string) {
        assert.equal(current, tx); events.push(name);
        if (options.failure === name) throw new Error('Injected ' + name);
    }
    const db: TransactionBoundary<Tx> = { transaction: async action => {
        const before = structuredClone(state); events.push('begin');
        try { const response = await action(tx); events.push('commit'); return response; }
        catch (error) { state = before; events.push('rollback'); throw error; }
    } };
    const identity: ScopeAuthorization<Tx> & ScopeOwnerAuthorization<Tx> = { owner: async (current, actor, scope) => { assert.equal(current, tx); assert.equal(actor, 'manager-a'); assert.equal(scope, 'scope-a'); }, scope: async (current, actor, scope, manage) => {
        event(current, manage ? 'manage' : 'visible'); assert.equal(actor, 'manager-a'); assert.equal(scope, 'scope-a');
        if (!options.visible || (manage && !options.manage)) throw new Error('denied');
        options.onScope();
    } };
    const idempotency: IdempotentRequests<Tx> = {
        claim: async <R extends CommandResponse>(current: Tx, request: RequestIdentity) => {
            event(current, 'claim'); const old = state.responses.get(request.key);
            if (old && old.digest !== request.digest) throw new Error('IDEMPOTENCY_CONFLICT');
            if (old?.response) return structuredClone(old.response) as R;
            state.responses.set(request.key, { digest: request.digest }); return undefined;
        },
        respond: async (current, request, response) => {
            event(current, 'respond'); state.responses.set(request.key, { digest: request.digest, response: structuredClone(response) });
        },
    };
    function currentForward() { if (!state.forward) throw new Error('not found'); return state.forward; }
    const accessReads: string[] = [];
    const access: ResourceReadAccess<Tx> = {
        async principal(current, actor, scope) { assert.equal(current, tx); assert.equal(scope, 'scope-a'); return { actorId: actor, governance: false }; },
        async forward(current, actor, scope, id) { assert.equal(current, tx); assert.equal(actor, 'manager-a'); const forward = currentForward(); assert.equal(scope, forward.scopeId); assert.equal(id, forward.id); accessReads.push(id); if (!options.resourceVisible) throw new Error('Resource visibility denied'); },
        async node() { throw new Error('Forward fixture does not read Node product views'); },
        async owned(current, actor, scope, kind, id) { assert.equal(current, tx); assert.equal(actor, 'manager-a'); assert.equal(scope, 'scope-a'); assert.equal(kind, 'forward'); assert.equal(id, currentForward().id); },
    };
    const forwarding: ForwardWriter<Tx> = {
        ownershipForUpdate: async (current, scope, id) => { assert.equal(current, tx); const forward = currentForward(); assert.equal(scope, forward.scopeId); assert.equal(id, forward.id); return forward; },
        classifyOwner: async () => { throw new Error('Legacy command fixture does not classify ownership'); },
        record: async (current, scope, id) => {
            event(current, 'record'); const f = currentForward(); assert.equal(scope, f.scopeId); assert.equal(id, f.id);
            return { ...f, ownerActorId: 'manager-a', deleting: state.deleting, recoverySuspended: state.recoverySuspended };
        },
        currentForUpdate: async (current, scope, id) => {
            event(current, 'current'); if (state.deleting) throw new Error('deleting');
            const f = currentForward(); assert.equal(scope, f.scopeId); assert.equal(id, f.id); return f;
        },
        insert: async (current, forward, actor) => { event(current, 'insert'); state.forward = forward; state.authorizer = actor; },
        replace: async (current, before, next) => {
            event(current, 'replace'); assert.equal(currentForward().revision, before.revision); state.forward = next; state.recoverySuspended = false;
        },
        setAuthorizer: async (current, id, actor) => { event(current, 'authorizer'); assert.equal(id, currentForward().id); state.authorizer = actor; },
        markDeleting: async (current, before, revision) => {
            event(current, 'deleting'); assert.equal(before.revision, currentForward().revision);
            state.forward = { ...before, revision }; state.deleting = true;
        },
    };
    const nodes: ForwardNodeAuthorization<Tx> = {
        authorized: async (current, actor, forward) => {
            event(current, 'authorize'); assert.equal(actor, 'manager-a');
            if (!options.nodeAllowed) throw new Error('Node grant denied');
            return { nodeId: forward.spec.ingress.nodeId, scopeId: forward.scopeId, egressPolicyRevision: 1,
                allowedListenerAddresses: ['127.0.0.1'], allowedPorts: options.invalidFacts ? [1] : [32001, 32003],
                allowedDestinationCidrs: ['127.0.0.0/8'], allowMetadataTargets: false,
                capabilities: ['adp.3', 'native.direct.v1', 'tcp', 'udp'] };
        },
        authorizedRelayNode: async (current, actor, scope, id) => {
            event(current, 'relay-authorize:' + id); assert.equal(actor, 'manager-a'); assert.equal(scope, 'scope-a');
            if (!options.nodeAllowed) throw new Error('Node grant denied');
            return { nodeId: id, scopeId: scope, egressPolicyRevision: 1, capabilities: [],
                allowedListenerAddresses: [], allowedPorts: [], allowedDestinationCidrs: [], allowMetadataTargets: false };
        },
        state: async (current, id) => { event(current, 'old-node'); assert.equal(id, 'node-a'); return { revoked: options.oldRevoked }; },
    };
    function allocate(forward: Forward): ReservedSlot[] {
        state.generation++;
        const slots = forward.spec.protocols.map(protocol => ({ nodeId: forward.spec.ingress.nodeId, forwardId: forward.id,
            protocol, port: options.invalidReservation ? 1 : forward.spec.ingress.listen.port,
            bindingFence: state.generation, deploymentGeneration: state.generation }));
        state.slots.push(...slots); return slots;
    }
    const resources: ForwardResourceHost<Tx> = {
        lockOwnership: async (current,forward) => { event(current, 'ownership-lock:' + forward.id); },
        lockNode: async (current, id) => { event(current, 'node-lock:' + id); },
        reserve: async (current, forward,creatingOwnerActorId) => { assert.equal(creatingOwnerActorId,'manager-a'); event(current, 'reserve'); return allocate(forward); },
        transition: async (current, before, next) => { event(current, 'transition'); assert.equal(before.id, next.id); return allocate(next); },
    };
    const relayHost: ForwardRelayHost<Tx> = {
        lockNodes: async (current) => { event(current, 'relay-lock'); },
        canExecute: async (current, actor) => { event(current, 'relay-allowed'); assert.equal(actor, 'manager-a'); return options.relayAllowed; },
        acceptPlan: async (current) => { event(current, 'plan'); state.plans.push(++state.generation); },
    };
    const execution: Pick<ForwardAuthorizationExecution<Tx>, 'lock' | 'transition' | 'assertCapacity'> = {
        lock: async (current) => { event(current, 'lock'); },
        transition: async (current, actor, forward) => {
            event(current, 'retry-transition'); assert.equal(actor, 'manager-a');
            if (forward.spec.path) {
                if (!options.relayAllowed) throw new Error('Full path denied');
                await relayHost.acceptPlan(current, actor, forward);
            } else await resources.transition(current, forward, forward);
        },
        assertCapacity: async (current) => { event(current, 'capacity'); },
    };
    const operations: ForwardOperationCommands<Tx> = {
        read: async (current, scope, id) => { event(current, 'read-operation'); assert.equal(scope, 'scope-a'); assert.equal(id, 'source-a'); return state.source; },
        get: async (current, scope, id) => { event(current, 'get-operation'); assert.equal(scope, 'scope-a'); assert.equal(id, 'source-a'); return state.source; },
        accept: async (current, forward, request, kind, previous = null, source = null) => {
            event(current, 'accept'); const id = 'operation-' + (state.operations.length + 1);
            state.operations.push({ id, forward, request, kind, previous, source }); return id;
        },
    };
    const preparation = new ForwardCommandExecutor(nodes, resources, relayHost, execution);
    const service = new ForwardCommands(db, identity, access, idempotency, forwarding, operations, preparation, () => 'new-forward');
    const create = (key = 'key-a', input: unknown = spec) => service.create('manager-a', 'scope-a', key, input);
    const update = (input: unknown = { ...spec, target: { host: '127.0.0.1', port: 81 } }, key = 'key-a', expected = 4) =>
        service.update('manager-a', 'scope-a', 'forward-a', key, expected, input);
    const remove = (key = 'key-a', expected = 4) => service.remove('manager-a', 'scope-a', 'forward-a', key, expected);
    const retry = (key = 'key-a', expected = 4) => service.retry('manager-a', 'scope-a', key, 'source-a', expected);
    return { tx, db, identity, access, accessReads, idempotency, forwarding, operations, preparation, service, options, events, spec,
        create, update, remove, retry, state: () => state };
}

test('Direct creation reserves and compiles before owner writes and commits one complete response on the supplied transaction', async () => {
    const f = fixture(), result = await f.create();
    assert.deepEqual(f.events, ['begin', 'visible', 'claim', 'manage', 'authorize', 'node-lock:node-a', 'reserve',
        'insert', 'accept', 'capacity', 'respond', 'commit']);
    assert.deepEqual(result, { status: 202, body: { forwardId: 'new-forward', revision: 1, operationId: 'operation-1' } });
    assert.equal(f.state().operations[0]!.request.digest, digest({ method: 'POST', path: '/api/v1/scopes/scope-a/forwards', input: f.spec }));
    assert.equal(f.state().slots.length, 2); assert.deepEqual(f.state().leases, [10000]);
});

test('Relay creation authorizes sorted Nodes and plans after owner insertion even when the intent is disabled', async () => {
    const f = fixture(true); await f.create('key-a', { ...f.spec, enabled: false });
    assert.deepEqual(f.events.slice(4, 10), ['relay-authorize:node-a', 'node-lock:node-a', 'relay-authorize:node-b',
        'node-lock:node-b', 'relay-authorize:node-c', 'node-lock:node-c']);
    assert.ok(f.events.indexOf('plan') > f.events.indexOf('insert') && f.events.indexOf('plan') < f.events.indexOf('accept'));
    assert.equal(f.state().slots.length, 0); assert.equal(f.state().plans.length, 1);
});

test('all replay paths require current resource visibility but not renewed management authority', async () => {
    for (const method of ['create', 'update', 'remove', 'retry'] as const) {
        const f = fixture(), action = () => method === 'update' ? f.update() : f[method]();
        const first = await action(), reads = f.accessReads.length; f.options.manage = false; f.events.length = 0;
        assert.deepEqual(await action(), first);
        assert.deepEqual(f.events, ['begin', 'visible', 'claim', 'commit']);
        assert.equal(f.accessReads.length, reads + 1);
        assert.equal(f.state().operations.length, 1);
        f.options.resourceVisible = false; await assert.rejects(action(), /Resource visibility denied/);
        f.options.resourceVisible = true;
        f.options.visible = false; await assert.rejects(action(), /denied/);
    }
    const missing = fixture(); await missing.create(); missing.state().forward = null;
    await assert.rejects(missing.create(), /not found/);
});

test('no-op updates still authorize and validate but do not reserve, change authorizer or create operations', async () => {
    const f = fixture(), result = await f.update(f.spec);
    assert.deepEqual(result, { status: 200, body: { forwardId: 'forward-a', revision: 4, operationId: null } });
    assert.ok(f.events.includes('authorize') && f.events.includes('lock'));
    assert.ok(!f.events.some(e => ['transition', 'replace', 'authorizer', 'accept', 'capacity'].includes(e)));
    assert.equal(f.state().authorizer, 'old-author'); assert.equal(f.state().generation, 10);
    const denied = fixture(); denied.options.nodeAllowed = false;
    await assert.rejects(denied.update(denied.spec), /Node grant denied/);
    assert.equal(denied.state().responses.size, 0);
});

test('changed Direct disable, enable and update intents advance revision/generation and retain old resources and previous spec', async () => {
    for (const kind of ['disable', 'enable', 'update'] as const) {
        const f = fixture(), before = f.state().forward!;
        if (kind === 'enable') f.state().forward = { ...before, spec: { ...f.spec, enabled: false } };
        const previous = f.state().forward!.spec;
        await f.update(kind === 'disable' ? { ...f.spec, enabled: false } :
            kind === 'enable' ? f.spec : { ...f.spec, target: { host: '127.0.0.1', port: 81 } });
        assert.equal(f.state().operations[0]!.kind, kind); assert.deepEqual(f.state().operations[0]!.previous, previous);
        assert.equal(f.state().forward!.revision, 5); assert.equal(f.state().generation, 11);
        assert.equal(f.state().authorizer, 'manager-a'); assert.deepEqual(f.state().leases, [10000]);
    }
});

test('Relay disable skips execution authorization and planning but retains capacity checks; enabled changes reject denied paths', async () => {
    const f = fixture(true); f.options.relayAllowed = false;
    await f.update({ ...f.spec, enabled: false });
    assert.ok(f.events.includes('relay-lock') && f.events.includes('capacity'));
    assert.ok(!f.events.includes('relay-allowed') && !f.events.includes('plan'));
    assert.equal(f.state().operations[0]!.kind, 'disable');
    const denied = fixture(true); denied.options.relayAllowed = false;
    await assert.rejects(denied.update(), { code: 'AUTHORIZATION_DENIED' });
    assert.equal(denied.state().forward!.revision, 4); assert.equal(denied.state().operations.length, 0);
});

test('ingress moves require both recovery suspension and a revoked old Node before sorted Node locking', async () => {
    for (const recovery of [false, true]) for (const revoked of [false, true]) {
        const f = fixture(); f.state().recoverySuspended = recovery; f.options.oldRevoked = revoked;
        const spec = { ...f.spec, ingress: { ...f.spec.ingress, nodeId: 'node-b' } };
        if (!recovery || !revoked) await assert.rejects(f.update(spec), { code: 'UNSUPPORTED_CAPABILITY' });
        else {
            await f.update(spec);
            assert.ok(f.events.indexOf('node-lock:node-a') < f.events.indexOf('node-lock:node-b'));
            assert.equal(f.state().forward!.spec.ingress.nodeId, 'node-b');
            assert.equal(f.state().recoverySuspended, false);
        }
    }
});

test('deletion retains separate Direct/Relay locks, CAS, exhaustion, capacity veto and occupied leases', async () => {
    for (const relay of [false, true]) {
        const f = fixture(relay); await f.remove();
        assert.ok(f.events.includes(relay ? 'relay-lock' : 'node-lock:node-a'));
        assert.ok(!f.events.includes('transition')); assert.equal(f.state().deleting, true);
        assert.equal(f.state().operations[0]!.kind, 'delete'); assert.deepEqual(f.state().leases, [10000]);
    }
    const stale = fixture(); await assert.rejects(stale.remove('key-a', 3), { code: 'REVISION_CONFLICT' });
    const exhausted = fixture(); exhausted.state().forward = { ...exhausted.state().forward!, revision: MAX_COUNTER };
    await assert.rejects(exhausted.remove('key-a', MAX_COUNTER), { code: 'REVISION_EXHAUSTED' });
    const capacity = fixture(), before = structuredClone(capacity.state()); capacity.options.failure = 'capacity';
    await assert.rejects(capacity.remove(), /Injected capacity/); assert.deepEqual(capacity.state(), before);
});

test('retry locks the current Forward before the source Operation, reauthorizes and preserves source identity without changing intent', async () => {
    const f = fixture(true), result = await f.retry();
    assert.deepEqual(f.events.slice(4, 9), ['read-operation', 'current', 'lock', 'get-operation', 'relay-authorize:node-a']);
    assert.equal(f.events.filter(e => e === 'lock').length, 2);
    assert.equal(f.state().operations[0]!.source, 'source-a');
    assert.deepEqual(f.state().operations[0]!.previous, f.state().source.previous_spec);
    assert.equal(result.body.sourceOperationId, 'source-a'); assert.equal(result.body.revision, 4);
    assert.equal(f.state().authorizer, 'manager-a');
    const disabled = fixture(); disabled.state().forward = { ...disabled.state().forward!, spec: { ...disabled.spec, enabled: false } };
    await disabled.retry(); assert.ok(disabled.events.includes('authorize') && !disabled.events.includes('retry-transition'));
});

test('retry rejects recovered, stale and nonfailed sources before effects and checks full Relay authorization on transition', async () => {
    for (const mode of ['recovered', 'stale', 'wrong-revision', 'accepted', 'succeeded', 'superseded'] as const) {
        const f = fixture();
        if (mode === 'recovered') f.state().source.recovery_invalidated = 1;
        else if (mode === 'stale') f.state().source.target_revision = 3;
        else if (mode !== 'wrong-revision') f.state().source.status = mode;
        await assert.rejects(f.retry('key-a', mode === 'wrong-revision' ? 3 : 4),
            { code: ['recovered', 'stale', 'wrong-revision'].includes(mode) ? 'OPERATION_SUPERSEDED' : 'OPERATION_NOT_RETRYABLE' });
        assert.ok(!f.events.includes('authorize')); assert.equal(f.state().responses.size, 0);
    }
    const denied = fixture(true); denied.options.relayAllowed = false;
    await assert.rejects(denied.retry(), /Full path denied/); assert.equal(denied.state().authorizer, 'old-author');
});

test('all command failures roll back owner writes, resources, plans, operations and replay and permit a same-key retry', async () => {
    for (const method of ['create', 'update', 'remove', 'retry'] as const) {
        const stages = ['claim', 'manage', 'accept', 'capacity', 'respond',
            ...(method === 'create' ? ['authorize', 'reserve', 'insert'] :
                method === 'update' ? ['current', 'authorize', 'transition', 'replace', 'authorizer'] :
                    method === 'remove' ? ['current', 'node-lock:node-a', 'deleting'] :
                        ['read-operation', 'current', 'lock', 'get-operation', 'authorize', 'retry-transition', 'authorizer'])];
        for (const stage of stages) {
            const f = fixture(), before = structuredClone(f.state()); f.options.failure = stage;
            const action = () => method === 'update' ? f.update() : f[method]();
            await assert.rejects(action(), new RegExp('Injected ' + stage)); assert.deepEqual(f.state(), before);
            f.options.failure = ''; assert.equal((await action()).status, 202);
        }
    }
    for (const method of ['create', 'update', 'retry'] as const) {
        const f = fixture(true), before = structuredClone(f.state()); f.options.failure = 'plan';
        await assert.rejects(method === 'update' ? f.update() : f[method](), /Injected plan/); assert.deepEqual(f.state(), before);
    }
});

test('canonical input detaches before the first await and uses the same frozen spec for request digest and persistence', async () => {
    for (const method of ['create', 'update'] as const) {
        const f = fixture(), input = { ...structuredClone(f.spec), protocols: ['udp', 'tcp'],
            ingress: { nodeId: 'node-a', listen: { address: '127.0.0.1', port: 32001 } }, target: { host: '127.0.0.1', port: 81 } };
        f.options.onScope = () => { input.target.port = 99; input.ingress.listen.port = 1; input.protocols.length = 0; };
        const result = await (method === 'create' ? f.create('key-a', input) : f.update(input));
        const persisted = f.state().forward!.spec; assert.equal(persisted.target.port, 81);
        assert.deepEqual(persisted.protocols, ['tcp', 'udp']); assert.ok(Object.isFrozen(persisted.ingress.listen));
        assert.equal(f.state().operations[0]!.request.digest, digest({ method: method === 'create' ? 'POST' : 'PUT',
            path: '/api/v1/scopes/scope-a/forwards' + (method === 'create' ? '' : '/forward-a'),
            input: method === 'create' ? persisted : { expectedRevision: 4, spec: persisted } }));
        assert.equal(result.status, 202);
    }
});

test('Direct compiler validation remains before and after resource allocation, including disabled intents', async () => {
    const facts = fixture(); facts.options.invalidFacts = true;
    await assert.rejects(facts.create('key-a', { ...facts.spec, enabled: false }));
    assert.ok(!facts.events.includes('reserve') && !facts.events.includes('insert'));
    const reservations = fixture(); reservations.options.invalidReservation = true;
    await assert.rejects(reservations.create());
    assert.ok(reservations.events.includes('reserve') && !reservations.events.includes('insert'));
    assert.equal(reservations.state().slots.length, 0);
});

test('non-HTTP callers cannot bypass input/identity/revision validation or required Runtime preparation', async () => {
    const f = fixture();
    for (const action of [
        () => f.create('key-a', { ...f.spec, extra: true }), () => f.update(f.spec, 'key-a', 0),
        () => f.remove('key-a', Number.MAX_SAFE_INTEGER + 1), () => f.retry('key-a', -1),
        () => f.service.create('../actor', 'scope-a', 'key-a', f.spec),
        () => f.service.update('manager-a', 'scope-a', '../forward', 'key-a', 4, f.spec),
        () => f.service.retry('manager-a', 'scope-a', undefined, '../operation', 4),
    ]) await assert.rejects(action(), { code: 'INVALID_CONFIG' });
    assert.deepEqual(f.events, []);
    assert.throws(() => new ForwardCommands(f.db, f.identity, f.access, f.idempotency, f.forwarding, f.operations, undefined as never, () => 'id'),
        /preparation is required/);
    assert.equal((await f.create()).status, 202);
    await assert.rejects(f.create('key-a', { ...f.spec, enabled: false }), /IDEMPOTENCY_CONFLICT/);
});
