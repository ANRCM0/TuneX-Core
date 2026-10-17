import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Forward } from '@tunex/core';
import { digest } from '@tunex/contracts';
import { TransportGrantCommands } from '../src/application/transport-grants.ts';
import type { TransportGrantResponse } from '../src/application/transport-grants.ts';
import type { IdempotentRequests, RequestIdentity, ScopeOwnerAuthorization, TransactionBoundary } from '../src/application/ports.ts';
import type { ProfileForwardReferences } from '../src/modules/forwarding-ports.ts';
import type { TransportGrantCommand, TransportGrantWriter } from '../src/modules/transport-ports.ts';
import { ProfileGrantReconciler } from '../src/modules/runtime/profile-grants.ts';
import type { ForwardAuthorizationExecution } from '../src/modules/runtime/authorization-ports.ts';

type Tx = Readonly<{ id: symbol }>;
function fixture(initialAllowed = true) {
    const tx: Tx = Object.freeze({ id: Symbol('transaction') }), events: string[] = [];
    const forwards: Forward[] = [true, false].map((enabled, i) => ({
        id: 'forward-' + i, scopeId: 'scope-a', revision: 7,
        spec: { enabled, protocols: ['tcp'], ingress: { nodeId: 'node-a', listen: { address: '127.0.0.1', port: 32001 + i } },
            target: { host: '127.0.0.1', port: 80 }, path: { via: ['node-b'] },
            transport: { profileId: 'profile-a', configRevision: 3 } },
    }));
    let state = { allowed: initialAllowed, revision: 1, audit: 0,
        operations: [] as { forwardId: string; revision: number; kind: string; request: RequestIdentity }[],
        responses: new Map<string, { digest: string; response: TransportGrantResponse | undefined }>() };
    const options = { owner: true, executable: true, failure: '' };
    function record(current: Tx, event: string) {
        assert.equal(current, tx);
        events.push(event);
        if (options.failure === event) throw new Error('Injected ' + event);
    }
    const db: TransactionBoundary<Tx> = {
        transaction: async action => {
            const before = structuredClone(state);
            events.push('begin');
            try {
                const result = await action(tx);
                events.push('commit'); return result;
            } catch (error) {
                state = before;
                events.push('rollback'); throw error;
            }
        },
    };
    const identity: ScopeOwnerAuthorization<Tx> = {
        owner: async (current, actor, scope) => {
            record(current, 'owner');
            assert.equal(actor, 'owner-a'); assert.equal(scope, 'scope-a');
            if (!options.owner) throw new Error('denied');
        },
    };
    const idempotency: IdempotentRequests<Tx> = {
        claim: async <R>(current: Tx, request: RequestIdentity) => {
            record(current, 'claim');
            const old = state.responses.get(request.key);
            if (old && old.digest !== request.digest) throw new Error('IDEMPOTENCY_CONFLICT');
            if (old?.response) return structuredClone(old.response) as R;
            state.responses.set(request.key, { digest: request.digest, response: undefined });
            return undefined;
        },
        respond: async (current, request, response) => {
            record(current, 'respond');
            state.responses.set(request.key, { digest: request.digest, response: structuredClone(response) as TransportGrantResponse });
        },
    };
    const transport: TransportGrantWriter<Tx> = {
        applyGrant: async (current, command: TransportGrantCommand) => {
            record(current, 'mutate');
            assert.ok(Object.isFrozen(command));
            assert.deepEqual([command.actorId, command.scopeId, command.profileId, command.subject],
                ['owner-a', 'scope-a', 'profile-a', 'member-a']);
            if (command.expectedRevision !== state.revision) throw new Error('REVISION_CONFLICT');
            const changed = command.allowed !== state.allowed;
            if (changed) { state.allowed = command.allowed; state.revision++; state.audit++; }
            return { profileId: command.profileId, actorId: command.subject, revision: state.revision, allowed: state.allowed, changed };
        },
    };
    const references: Pick<ProfileForwardReferences<Tx>, 'forProfileActor'> = {
        forProfileActor: async (current, profile, actor) => {
            record(current, 'references');
            assert.equal(profile, 'profile-a'); assert.equal(actor, 'member-a');
            return forwards;
        },
    };
    const execution: ForwardAuthorizationExecution<Tx> = {
        lock: async (current, forward) => { record(current, 'lock:' + forward.id); },
        allowed: async (current, actor, forward) => {
            record(current, 'allowed:' + forward.id); assert.equal(actor, 'member-a'); return options.executable;
        },
        transition: async (current, actor, forward) => {
            record(current, 'transition:' + forward.id); assert.equal(actor, 'member-a');
        },
        accept: async (current, forward, request, kind) => {
            record(current, 'accept:' + forward.id);
            state.operations.push({ forwardId: forward.id, revision: forward.revision, kind, request });
            return 'operation-' + state.operations.length;
        },
        assertCapacity: async (current, forward) => { record(current, 'capacity:' + forward.id); },
    };
    const effects = new ProfileGrantReconciler(references, execution);
    const commands = new TransportGrantCommands(db, identity, idempotency, transport, effects);
    const change = (allowed: boolean, expected = state.revision, key = 'request-a') =>
        commands.change('owner-a', 'scope-a', 'profile-a', 'member-a', key, expected, allowed);
    return { tx, events, options, forwards, db, identity, idempotency, transport, effects, change, commands, state: () => state };
}

test('Profile revoke uses one owner-authorized transaction and never transitions or allocates', async () => {
    const f = fixture(), response = await f.change(false);
    assert.deepEqual(f.events, ['begin', 'owner', 'claim', 'mutate', 'references',
        'lock:forward-0', 'accept:forward-0', 'lock:forward-1', 'accept:forward-1', 'respond', 'commit']);
    assert.equal(response.status, 202);
    assert.deepEqual(response.body, { profileId: 'profile-a', actorId: 'member-a', revision: 2,
        allowed: false, changed: true, operationIds: ['operation-1', 'operation-2'] });
    assert.ok(f.state().operations.every(o => o.kind === 'revoke' && o.revision === 7 && o.request.actorId === 'owner-a'));
    assert.equal(f.state().operations[0]!.request.digest, digest({ method: 'PUT',
        path: '/api/v1/scopes/scope-a/transport-profiles/profile-a/grants/member-a', expectedRevision: 1, allowed: false }));
});

test('Profile restore rechecks subject authority and capacity, but disabled intents never transition', async () => {
    const f = fixture(false);
    await f.change(true);
    assert.deepEqual(f.events, ['begin', 'owner', 'claim', 'mutate', 'references', 'lock:forward-0',
        'allowed:forward-0', 'transition:forward-0', 'accept:forward-0', 'capacity:forward-0',
        'lock:forward-1', 'allowed:forward-1', 'accept:forward-1', 'respond', 'commit']);
    assert.ok(f.state().operations.every(o => o.kind === 'policy'));
    const denied = fixture(false); denied.options.executable = false;
    await denied.change(true);
    assert.ok(denied.state().operations.every(o => o.kind === 'revoke'));
    assert.ok(denied.events.every(e => !e.startsWith('transition:') && !e.startsWith('capacity:')));
});

test('Profile replay is owner-gated before returning the same operation IDs without repeating effects', async () => {
    const f = fixture(), first = await f.change(false, 1);
    f.events.length = 0;
    assert.deepEqual(await f.change(false, 1), first);
    assert.deepEqual(f.events, ['begin', 'owner', 'claim', 'commit']);
    assert.equal(f.state().operations.length, 2); assert.equal(f.state().audit, 1);
    await assert.rejects(f.change(true, 1), /IDEMPOTENCY_CONFLICT/);
    f.options.owner = false; f.events.length = 0;
    await assert.rejects(f.change(false, 1), /denied/);
    assert.deepEqual(f.events, ['begin', 'owner', 'rollback']);
});

test('Profile no-op, stale CAS and empty references do not invent deployment work', async () => {
    const f = fixture();
    const response = await f.change(true);
    assert.equal(response.status, 200); assert.deepEqual(response.body.operationIds, []);
    assert.ok(!f.events.includes('references')); assert.equal(f.state().audit, 0);
    await assert.rejects(f.change(false, 2, 'stale'), /REVISION_CONFLICT/);
    assert.equal(f.state().responses.has('stale'), false);
    f.forwards.length = 0;
    assert.deepEqual((await f.change(false, 1, 'unused')).body.operationIds, []);
    assert.equal(f.state().revision, 2);
});

test('Profile port failures roll back grant, audit, operations and replay response together', async () => {
    for (const failure of ['claim', 'mutate', 'references', 'lock:forward-0', 'allowed:forward-0',
        'transition:forward-0', 'accept:forward-0', 'capacity:forward-0', 'accept:forward-1', 'respond']) {
        const f = fixture(false); f.options.failure = failure;
        await assert.rejects(f.change(true), new RegExp('Injected ' + failure));
        assert.equal(f.events.at(-1), 'rollback');
        assert.deepEqual(f.state(), { allowed: false, revision: 1, audit: 0, operations: [], responses: new Map() });
        f.options.failure = '';
        assert.equal((await f.change(true)).status, 202, 'same request must remain retryable after rollback');
    }
});

test('Profile integration rejects cross-scope owner references and missing effect wiring', async () => {
    const f = fixture();
    f.forwards[0] = { ...f.forwards[0]!, scopeId: 'scope-b' };
    await assert.rejects(f.change(false), { code: 'INTEGRITY_FAILURE' });
    assert.ok(!f.events.some(e => e.startsWith('lock:')));
    assert.equal(f.state().allowed, true); assert.equal(f.state().audit, 0);
    assert.throws(() => new TransportGrantCommands(f.db, f.identity, f.idempotency, f.transport, undefined as never),
        /execution effects are required/);
});

test('non-HTTP Profile grant callers cannot bypass identifier, revision, boolean or key validation', async () => {
    const f = fixture();
    for (const command of [
        () => f.commands.change('../owner', 'scope-a', 'profile-a', 'member-a', 'key', 1, false),
        () => f.commands.change('owner-a', '../scope', 'profile-a', 'member-a', 'key', 1, false),
        () => f.commands.change('owner-a', 'scope-a', '../profile', 'member-a', 'key', 1, false),
        () => f.commands.change('owner-a', 'scope-a', 'profile-a', '../member', 'key', 1, false),
        () => f.commands.change('owner-a', 'scope-a', 'profile-a', 'member-a', undefined, 1, false),
        () => f.commands.change('owner-a', 'scope-a', 'profile-a', 'member-a', 'bad\nkey', 1, false),
        () => f.commands.change('owner-a', 'scope-a', 'profile-a', 'member-a', 'key', 0, false),
        () => f.commands.change('owner-a', 'scope-a', 'profile-a', 'member-a', 'key', 1, 'false' as never),
    ]) await assert.rejects(command, { code: 'INVALID_CONFIG' });
    assert.deepEqual(f.events, []);
});
