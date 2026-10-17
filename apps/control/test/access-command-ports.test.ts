import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Forward } from '@tunex/core';
import { digest } from '@tunex/contracts';
import { AccessCommands } from '../src/application/access-commands.ts';
import type { MemberChangeResponse, NodeGrantResponse } from '../src/application/access-commands.ts';
import type { CommandResponse, IdempotentRequests, RequestIdentity, ScopeOwnerAuthorization, TransactionBoundary } from '../src/application/ports.ts';
import type { ActorForwardReferences } from '../src/modules/forwarding-ports.ts';
import type { MemberChangeInput, MemberWriter } from '../src/modules/identity-ports.ts';
import type { NodeGrantWriter } from '../src/modules/node-grant-ports.ts';
import { AccessChangeReconciler } from '../src/modules/runtime/access-changes.ts';
import type { AccessExecution } from '../src/modules/runtime/authorization-ports.ts';
import { tokenHash } from '../src/modules/identity-credentials.ts';

type Tx = Readonly<{ id: symbol }>;
function fixture(initial: { role?: string; allowed?: boolean } = {}) {
    const tx: Tx = Object.freeze({ id: Symbol('transaction') }), events: string[] = [];
    const forwards: Forward[] = ['direct', 'relay', 'disabled'].map(id => ({
        id, scopeId: 'scope-a', revision: 7, spec: { enabled: id !== 'disabled', protocols: ['tcp'],
            ingress: { nodeId: id === 'relay' ? 'node-a' : 'node-middle', listen: { address: '127.0.0.1', port: 32001 } },
            target: { host: '127.0.0.1', port: 80 },
            ...(id === 'relay' ? { path: { via: ['node-middle', 'node-z'] }, transport: { profileId: 'profile-a', configRevision: 1 } } : {}) },
    }));
    const records = new Map(forwards.map(f => [f.id, { ...f, deleting: false, recoverySuspended: false }]));
    const authorizers = new Map(forwards.map(f => [f.id, 'member-a']));
    const until = new Map([['node-middle', 10000], ['node-a', 20000], ['node-z', 30000], ['node-old', 50000]]);
    const options = { owner: true, executable: true, failure: '', onOwner: () => {} };
    const memberInputs: MemberChangeInput[] = [];
    let state = { role: initial.role ?? 'manager', allowed: initial.allowed ?? true, memberRevision: 1, grantRevision: 1, audit: 0,
        operations: [] as { forwardId: string; revision: number; kind: string; request: RequestIdentity }[],
        responses: new Map<string, { digest: string; response?: CommandResponse }>() };
    function record(current: Tx, event: string) {
        assert.equal(current, tx); events.push(event);
        if (options.failure === event) throw new Error('Injected ' + event);
    }
    const db: TransactionBoundary<Tx> = {
        transaction: async action => {
            const before = structuredClone(state); events.push('begin');
            try { const response = await action(tx); events.push('commit'); return response; }
            catch (error) { state = before; events.push('rollback'); throw error; }
        },
    };
    const identity: ScopeOwnerAuthorization<Tx> & MemberWriter<Tx> = {
        owner: async (current, actor, scope) => {
            record(current, 'owner'); assert.equal(actor, 'owner-a'); assert.equal(scope, 'scope-a');
            if (!options.owner) throw new Error('denied');
            options.onOwner();
        },
        changeMember: async (current, actor, scope, subject, expectedRevision, role, token) => {
            record(current, 'member'); assert.deepEqual([actor, scope, subject], ['owner-a', 'scope-a', 'member-a']);
            memberInputs.push({ expectedRevision, role, ...(token === undefined ? {} : { token }) });
            if (expectedRevision !== state.memberRevision) throw new Error('REVISION_CONFLICT');
            const changed = role !== state.role;
            if (changed) { state.role = role; state.memberRevision++; state.audit++; }
            return { actorId: subject, role, active: role !== 'removed', revision: state.memberRevision, changed };
        },
    };
    const nodes: NodeGrantWriter<Tx> = {
        changeGrant: async (current, actor, scope, nodeId, subject, expectedRevision, allowed) => {
            record(current, 'grant'); assert.deepEqual([actor, scope, nodeId, subject], ['owner-a', 'scope-a', 'node-middle', 'member-a']);
            if (expectedRevision !== state.grantRevision) throw new Error('REVISION_CONFLICT');
            const changed = allowed !== state.allowed;
            if (changed) { state.allowed = allowed; state.grantRevision++; state.audit++; }
            return { nodeId, actorId: subject, revision: state.grantRevision, allowed, changed };
        },
    };
    const idempotency: IdempotentRequests<Tx> = {
        claim: async <R extends CommandResponse>(current: Tx, request: RequestIdentity) => {
            record(current, 'claim');
            const old = state.responses.get(request.key);
            if (old && old.digest !== request.digest) throw new Error('IDEMPOTENCY_CONFLICT');
            if (old?.response) return structuredClone(old.response) as R;
            state.responses.set(request.key, { digest: request.digest }); return undefined;
        },
        respond: async (current, request, response) => {
            record(current, 'respond');
            state.responses.set(request.key, { digest: request.digest, response: structuredClone(response) });
        },
    };
    const references: ActorForwardReferences<Tx> = {
        forActor: async (current, scope, actor) => {
            record(current, 'references'); assert.equal(scope, 'scope-a'); assert.equal(actor, 'member-a'); return forwards;
        },
        record: async (current, scope, id) => { record(current, 'record:' + id); assert.equal(scope, 'scope-a'); return records.get(id)!; },
        authorizer: async (current, id) => { record(current, 'authorizer:' + id); return authorizers.get(id) ?? null; },
    };
    const execution: AccessExecution<Tx> = {
        lock: async (current, forward) => { record(current, 'lock:' + forward.id); },
        allowed: async (current, actor, forward) => {
            record(current, 'allowed:' + forward.id); assert.equal(actor, 'member-a');
            return options.executable && state.allowed && state.role === 'manager';
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
        nodeIDs: async (current, forward) => {
            record(current, 'nodes:' + forward.id);
            return [forward.spec.ingress.nodeId, ...forward.spec.path?.via ?? [], 'node-old'];
        },
        maximumAuthorization: async (current, nodeId) => { record(current, 'cutoff:' + nodeId); return until.get(nodeId) ?? null; },
        validateNode: async (current, nodeId, scope, capacity) => {
            record(current, 'node:' + capacity); assert.equal(nodeId, 'node-middle'); assert.equal(scope, 'scope-a');
        },
    };
    const effects = new AccessChangeReconciler(references, execution);
    const commands = new AccessCommands(db, identity, nodes, idempotency, effects);
    const member = (role: MemberChangeInput['role'], expected = state.memberRevision, key = 'request-a') =>
        commands.changeMember('owner-a', 'scope-a', 'member-a', key, { expectedRevision: expected, role });
    const grant = (allowed: boolean, expected = state.grantRevision, key = 'request-a') =>
        commands.changeNodeGrant('owner-a', 'scope-a', 'node-middle', 'member-a', key, expected, allowed);
    return { tx, events, options, forwards, records, authorizers, until, memberInputs, db, identity, nodes, idempotency,
        effects, commands, member, grant, state: () => state };
}

test('member demotion re-reads the current owner after locking, revokes through one ledger and reports historical path cutoff', async () => {
    const f = fixture(), result = await f.member('viewer');
    assert.deepEqual(f.events.slice(0, 8), ['begin', 'owner', 'claim', 'member', 'references', 'lock:direct', 'record:direct', 'authorizer:direct']);
    assert.ok(f.events.every(e => !e.startsWith('transition:') && !e.startsWith('capacity:') && !e.startsWith('allowed:')));
    assert.deepEqual(result, { status: 202, body: { actorId: 'member-a', revision: 2, role: 'viewer', active: true,
        operationIds: ['operation-1', 'operation-2', 'operation-3'], latestAuthorizationUntil: new Date(55000).toISOString() } });
    assert.ok(f.state().operations.every(o => o.kind === 'revoke' && o.request.actorId === 'owner-a' && o.revision === 7));
    assert.deepEqual(f.events.slice(-2), ['respond', 'commit']);
});

test('member restoration uses the current record, rechecks authorization and retains disabled-intent cleanup capacity checks', async () => {
    const f = fixture({ role: 'viewer' });
    f.records.set('direct', { ...f.records.get('direct')!, revision: 9 });
    await f.member('manager');
    assert.equal(f.state().operations[0]!.revision, 9);
    assert.ok(f.events.includes('transition:direct') && f.events.includes('transition:relay'));
    assert.ok(!f.events.includes('transition:disabled')); assert.ok(f.events.includes('capacity:disabled'));
    const denied = fixture({ role: 'viewer', allowed: false });
    await denied.member('manager');
    assert.ok(denied.state().operations.every(o => o.kind === 'revoke'));
    assert.ok(!denied.events.some(e => e.startsWith('transition:') || e.startsWith('capacity:')));
});

test('member reconciliation skips deleted or reassigned intents after locking', async () => {
    const f = fixture();
    f.records.get('direct')!.deleting = true;
    f.authorizers.set('relay', 'other-actor');
    const result = await f.member('removed');
    assert.equal(result.body.active, false); assert.equal(result.body.operationIds.length, 1);
    assert.equal(f.state().operations[0]!.forwardId, 'disabled');
    assert.ok(!f.events.includes('authorizer:direct')); assert.ok(!f.events.includes('accept:relay'));
});

test('Node Grant withdrawal includes intermediate and historical nodes without transition or capacity veto', async () => {
    const f = fixture(), result = await f.grant(false);
    assert.equal(result.status, 202); assert.equal(result.body.operationIds.length, 3);
    assert.equal(result.body.latestAuthorizationUntil, new Date(55000).toISOString());
    assert.ok(f.events.includes('nodes:relay')); assert.ok(f.events.includes('node:false'));
    assert.ok(!f.events.some(e => e.startsWith('transition:') || e.startsWith('capacity:')));
    assert.ok(f.state().operations.every(o => o.kind === 'revoke'));
    assert.equal(f.state().operations[0]!.request.digest, digest({ method: 'PUT',
        path: '/api/v1/scopes/scope-a/nodes/node-middle/grants/member-a', input: { expectedRevision: 1, allowed: false } }));
});

test('Node Grant restoration preserves host transition failures and never transitions disabled or unrelated intents', async () => {
    const f = fixture({ allowed: false });
    f.forwards.push({ ...f.forwards[0]!, id: 'unrelated', spec: { ...f.forwards[0]!.spec,
        ingress: { nodeId: 'other-node', listen: { address: '127.0.0.1', port: 32003 } } } });
    await f.grant(true);
    assert.ok(f.state().operations.every(o => o.kind === 'policy')); assert.equal(f.state().operations.length, 3);
    assert.ok(f.events.includes('node:true')); assert.ok(!f.events.includes('transition:disabled'));
    assert.ok(!f.events.includes('capacity:disabled')); assert.ok(!f.events.includes('lock:unrelated'));
    const denied = fixture({ allowed: false }); denied.options.failure = 'transition:relay';
    await assert.rejects(denied.grant(true), /Injected transition/);
    assert.equal(denied.state().allowed, false); assert.equal(denied.state().audit, 0);
    assert.deepEqual(denied.state().operations, []);
});

test('member no-op has no execution work; Node Grant no-op still validates the node and reports its cutoff', async () => {
    const member = fixture(), result = await member.member('manager');
    assert.equal(result.status, 200); assert.deepEqual(result.body.operationIds, []);
    assert.equal(result.body.latestAuthorizationUntil, null);
    assert.deepEqual(member.events, ['begin', 'owner', 'claim', 'member', 'respond', 'commit']);
    const grant = fixture(), noOp = await grant.grant(true);
    assert.equal(noOp.status, 200); assert.deepEqual(noOp.body.operationIds, []);
    assert.equal(noOp.body.latestAuthorizationUntil, new Date(15000).toISOString());
    assert.deepEqual(grant.events, ['begin', 'owner', 'claim', 'grant', 'node:true', 'cutoff:node-middle', 'respond', 'commit']);
    grant.forwards.length = 0;
    assert.equal((await grant.grant(false, 1, 'empty')).status, 202);
    grant.until.clear();
    assert.equal((await grant.grant(false, 2, 'no-lease')).body.latestAuthorizationUntil, null);
});

test('both access commands gate replay with current owner authorization and preserve operation IDs and digest conflict', async () => {
    for (const kind of ['member', 'grant'] as const) {
        const f = fixture();
        const change = () => kind === 'member' ? f.member('viewer', 1) : f.grant(false, 1);
        const first = await change(); f.events.length = 0;
        assert.deepEqual(await change(), first);
        assert.deepEqual(f.events, ['begin', 'owner', 'claim', 'commit']);
        const conflict = kind === 'member' ? () => f.member('removed', 1) : () => f.grant(true, 1);
        await assert.rejects(conflict, /IDEMPOTENCY_CONFLICT/);
        f.options.owner = false; f.events.length = 0;
        await assert.rejects(change, /denied/);
        assert.deepEqual(f.events, ['begin', 'owner', 'rollback']);
    }
});

test('access failures roll back owner rows, audit, prior accepted effects and replay responses together', async () => {
    for (const kind of ['member', 'grant'] as const) {
        const failures = ['claim', kind, 'references', 'lock:direct', 'transition:direct',
            'accept:direct', 'capacity:direct', 'accept:relay', 'cutoff:node-old', 'respond',
            ...(kind === 'member' ? ['record:direct', 'authorizer:direct', 'allowed:direct', 'capacity:disabled'] : ['node:true'])];
        for (const failure of failures) {
            const f = fixture(kind === 'member' ? { role: 'viewer' } : { allowed: false });
            const before = structuredClone(f.state()); f.options.failure = failure;
            const change = () => kind === 'member' ? f.member('manager') : f.grant(true);
            await assert.rejects(change, new RegExp('Injected ' + failure));
            assert.deepEqual(f.state(), before); assert.equal(f.events.at(-1), 'rollback');
            f.options.failure = ''; assert.equal((await change()).status, 202);
        }
    }
});

test('member input is detached before awaiting authorization and only its original token hash enters the request digest', async () => {
    const f = fixture({ role: 'viewer' }), token = 'a'.repeat(40);
    const input: { expectedRevision: number; role: MemberChangeInput['role']; token: string } =
        { expectedRevision: 1, role: 'manager', token };
    f.options.onOwner = () => { input.expectedRevision = 99; input.role = 'removed'; input.token = 'b'.repeat(40); };
    await f.commands.changeMember('owner-a', 'scope-a', 'member-a', 'request-a', input);
    assert.deepEqual(f.memberInputs, [{ expectedRevision: 1, role: 'manager', token }]);
    assert.equal(f.state().operations[0]!.request.digest, digest({ method: 'PUT',
        path: '/api/v1/scopes/scope-a/members/member-a', input: { expectedRevision: 1, role: 'manager', tokenHash: tokenHash(token) } }));
    assert.ok(!JSON.stringify(f.state().operations).includes(token));
});

test('access integration fails closed on cross-scope candidates/current records and incomplete effect wiring', async () => {
    for (const kind of ['member', 'grant', 'current'] as const) {
        const f = fixture();
        if (kind === 'current') f.records.set('direct', { ...f.records.get('direct')!, scopeId: 'scope-b' });
        else f.forwards[0] = { ...f.forwards[0]!, scopeId: 'scope-b' };
        await assert.rejects(kind === 'grant' ? f.grant(false) : f.member('viewer'), { code: 'INTEGRITY_FAILURE' });
        assert.equal(f.state().audit, 0); assert.deepEqual(f.state().operations, []);
    }
    const f = fixture();
    assert.throws(() => new AccessCommands(f.db, f.identity, f.nodes, f.idempotency, undefined as never), /effects are required/);
    assert.throws(() => new AccessCommands(f.db, f.identity, f.nodes, f.idempotency, { member: f.effects.member } as never),
        /effects are required/);
});

test('non-HTTP access calls cannot bypass IDs, counters, role, token, boolean or idempotency-key validation', async () => {
    const f = fixture(), member = { expectedRevision: 1, role: 'viewer' as const };
    const calls: (() => Promise<MemberChangeResponse | NodeGrantResponse>)[] = [
        () => f.commands.changeMember('../actor', 'scope-a', 'member-a', 'key', member),
        () => f.commands.changeMember('owner-a', '../scope', 'member-a', 'key', member),
        () => f.commands.changeMember('owner-a', 'scope-a', '../member', 'key', member),
        () => f.commands.changeMember('owner-a', 'scope-a', 'member-a', undefined, member),
        () => f.commands.changeMember('owner-a', 'scope-a', 'member-a', 'key', { ...member, expectedRevision: -1 }),
        () => f.commands.changeMember('owner-a', 'scope-a', 'member-a', 'key', { ...member, role: 'owner' as never }),
        () => f.commands.changeMember('owner-a', 'scope-a', 'member-a', 'key', { ...member, token: 'bad-token' }),
        () => f.commands.changeNodeGrant('owner-a', 'scope-a', '../node', 'member-a', 'key', 1, false),
        () => f.commands.changeNodeGrant('owner-a', 'scope-a', 'node-middle', '../member', 'key', 1, false),
        () => f.commands.changeNodeGrant('owner-a', 'scope-a', 'node-middle', 'member-a', 'key', 0, false),
        () => f.commands.changeNodeGrant('owner-a', 'scope-a', 'node-middle', 'member-a', 'key', 1, 'false' as never),
        () => f.commands.changeNodeGrant('owner-a', 'scope-a', 'node-middle', 'member-a', 'bad\nkey', 1, false),
    ];
    for (const call of calls) await assert.rejects(call, { code: 'INVALID_CONFIG' });
    assert.deepEqual(f.events, []);
});
