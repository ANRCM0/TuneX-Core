import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Forward } from '@tunex/core';
import { digest } from '@tunex/contracts';
import { NodeManagementCommands } from '../src/application/node-management.ts';
import type { CommandResponse, IdempotentRequests, RequestIdentity, ScopeAuthorization, TransactionBoundary } from '../src/application/ports.ts';
import type { NodeForwardReferences } from '../src/modules/forwarding-ports.ts';
import type { AuthorizedNodeFacts, NodeManagementAudit, NodeManagementCommand, NodeManagementWriter, NodePolicy } from '../src/modules/node-management-ports.ts';
import { NodeChangeReconciler } from '../src/modules/runtime/node-changes.ts';
import type { NodeManagementExecution } from '../src/modules/runtime/authorization-ports.ts';

type Tx = Readonly<{ id: symbol }>;
function fixture() {
    const tx: Tx = Object.freeze({ id: Symbol('transaction') }), events: string[] = [];
    const facts: AuthorizedNodeFacts = { nodeId: 'node-middle', scopeId: 'scope-a', capabilities: ['adp.3', 'native.direct.v1', 'tcp'],
        allowedListenerAddresses: ['127.0.0.1'], allowedPorts: [32001], egressPolicyRevision: 1,
        allowedDestinationCidrs: ['127.0.0.0/8'], allowMetadataTargets: false };
    const policy: NodePolicy = { allowedListenerAddresses: ['127.0.0.1'], allowedPorts: [32001], egressPolicyRevision: 2,
        allowedDestinationCidrs: ['127.0.0.0/9'], allowMetadataTargets: false };
    const forwards: Forward[] = ['relay', 'disabled', 'denied', 'missing'].map(id => ({
        id, scopeId: 'scope-a', revision: 7, spec: { enabled: id !== 'disabled', protocols: ['tcp'],
            ingress: { nodeId: 'node-middle', listen: { address: '127.0.0.1', port: 32001 } },
            target: { host: '127.0.0.1', port: 80 },
            ...(id === 'relay' ? { path: { via: ['node-z'] }, transport: { profileId: 'profile-a', configRevision: 1 } } : {}) },
    }));
    const authors = new Map<string, string | null>(forwards.map(f => [f.id, f.id === 'missing' ? null : 'source-' + f.id]));
    const until = new Map([['node-middle', 10000], ['node-z', 20000], ['node-old', 40000]]);
    const options = { permitted: true, failure: '', onAuthorization: () => {} };
    const commands: NodeManagementCommand[] = [];
    let state = { facts, revoked: false, machineRevoked: false, relayRevoked: false,
        operations: [] as { id: string; forwardId: string; revision: number; kind: string; request: RequestIdentity; denied: boolean }[],
        audits: [] as { kind: string; details: NodeManagementAudit }[],
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
    const identity: ScopeAuthorization<Tx> = {
        scope: async (current, actor, scope, manage) => {
            record(current, 'manage'); assert.equal(actor, 'manager-a'); assert.equal(scope, 'scope-a'); assert.equal(manage, true);
            if (!options.permitted) throw new Error('denied');
            options.onAuthorization();
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
    const nodes: NodeManagementWriter<Tx> = {
        applyManagement: async (current, actor, scope, nodeId, command) => {
            record(current, 'mutate');
            assert.deepEqual([actor, scope, nodeId], ['manager-a', 'scope-a', 'node-middle']);
            assert.ok(Object.isFrozen(command)); commands.push(command);
            if (command.kind === 'policy') {
                assert.ok(Object.isFrozen(command.policy.allowedPorts));
                if (state.revoked) throw new Error('revoked');
                if (command.expectedRevision !== state.facts.egressPolicyRevision) throw new Error('REVISION_CONFLICT');
                if (command.policy.egressPolicyRevision !== command.expectedRevision + 1) throw new Error('invalid increment');
                state.facts = { ...state.facts, ...command.policy };
            } else { state.revoked = true; state.machineRevoked = true; state.relayRevoked = true; }
            return { nodeId, kind: command.kind, facts: state.facts };
        },
        audit: async (current, nodeId, actor, kind, details) => {
            record(current, 'audit'); assert.equal(nodeId, 'node-middle'); assert.equal(actor, 'manager-a');
            state.audits.push({ kind, details });
        },
    };
    const references: NodeForwardReferences<Tx> = {
        forReferencedNode: async (current, nodeId) => { record(current, 'references'); assert.equal(nodeId, 'node-middle'); return forwards; },
        authorizer: async (current, id) => { record(current, 'authorizer:' + id); return authors.get(id) ?? null; },
    };
    const execution: NodeManagementExecution<Tx> = {
        lock: async (current, forward) => { record(current, 'lock:' + forward.id); },
        nodeIDs: async (current, forward) => { record(current, 'nodes:' + forward.id); return ['node-middle', 'node-z', 'node-old']; },
        allowed: async (current, actor, forward) => {
            record(current, 'allowed:' + forward.id); assert.equal(actor, authors.get(forward.id));
            assert.notEqual(actor, 'manager-a'); return forward.id !== 'denied';
        },
        transition: async (current, actor, forward) => {
            record(current, 'transition:' + forward.id); assert.equal(actor, authors.get(forward.id));
        },
        accept: async (current, forward, request, kind) => {
            record(current, 'accept:' + forward.id);
            const id = 'operation-' + (state.operations.length + 1);
            state.operations.push({ id, forwardId: forward.id, revision: forward.revision, kind, request, denied: false });
            return id;
        },
        assertCapacity: async (current, forward) => { record(current, 'capacity:' + forward.id); },
        denyIntent: async (current, id) => { record(current, 'deny:' + id); state.operations.find(o => o.id === id)!.denied = true; },
        assertNodeCapacity: async (current, currentFacts) => {
            record(current, 'node-capacity'); assert.equal(currentFacts, state.facts);
        },
        maximumAuthorization: async (current, nodeId) => { record(current, 'cutoff:' + nodeId); return until.get(nodeId) ?? null; },
    };
    const effects = new NodeChangeReconciler(references, execution);
    const service = new NodeManagementCommands(db, identity, idempotency, nodes, effects);
    const change = (command: NodeManagementCommand, key = 'request-a') => service.change('manager-a', 'scope-a', 'node-middle', key, command);
    const update = (): NodeManagementCommand => ({ kind: 'policy', expectedRevision: 1, policy });
    return { events, forwards, authors, until, options, commands, db, identity, idempotency, nodes, effects, execution,
        service, change, update, policy, state: () => state };
}

test('policy acceptance uses manager scope authorization and each original authorizer, not the management requester', async () => {
    const f = fixture(), command = f.update(), result = await f.change(command);
    assert.deepEqual(f.events.slice(0, 6), ['begin', 'manage', 'claim', 'mutate', 'references', 'lock:relay']);
    assert.equal(result.status, 202); assert.equal(result.body.policyRevision, 2);
    assert.equal(result.body.latestAuthorizationUntil, new Date(45000).toISOString());
    assert.ok(f.state().operations.every(o => o.revision === 7 && o.request.actorId === 'manager-a'));
    assert.equal(f.state().operations[0]!.request.digest, digest({ method: 'PUT',
        path: '/api/v1/scopes/scope-a/nodes/node-middle/policy', input: command }));
    assert.ok(f.events.includes('node-capacity')); assert.deepEqual(f.events.slice(-3), ['audit', 'respond', 'commit']);
    assert.deepEqual(f.state().audits, [{ kind: 'policy_update', details: {
        policyRevision: 2, operationIds: result.body.operationIds, latestAuthorizationUntil: 40000 } }]);
});

test('policy denial and missing authorizers create failed withdrawal intents; disabled allowed intents never transition', async () => {
    const f = fixture(); await f.change(f.update());
    assert.deepEqual(f.state().operations.map(o => [o.forwardId, o.kind, o.denied]),
        [['relay', 'policy', false], ['disabled', 'policy', false], ['denied', 'revoke', true], ['missing', 'revoke', true]]);
    assert.ok(f.events.includes('transition:relay') && f.events.includes('capacity:relay'));
    assert.ok(!f.events.includes('transition:disabled') && !f.events.includes('capacity:disabled'));
    assert.ok(!f.events.includes('allowed:missing')); assert.ok(f.events.includes('node-capacity'));
    assert.ok(f.events.indexOf('deny:operation-3') > f.events.indexOf('accept:denied'));
});

test('whole-Node revocation invalidates both credential families and cannot be vetoed by Snapshot capacity or deny-intent handling', async () => {
    const f = fixture();
    f.execution.assertCapacity = async () => { throw new Error('capacity veto'); };
    f.execution.assertNodeCapacity = async () => { throw new Error('node capacity veto'); };
    f.execution.denyIntent = async () => { throw new Error('deny-intent veto'); };
    const result = await f.change({ kind: 'revoke' });
    assert.equal(f.state().revoked, true); assert.equal(f.state().machineRevoked, true); assert.equal(f.state().relayRevoked, true);
    assert.equal(result.body.policyRevision, 1); assert.equal(result.body.latestAuthorizationUntil, new Date(45000).toISOString());
    assert.ok(f.state().operations.every(o => o.kind === 'revoke' && !o.denied));
    assert.ok(!f.events.some(e => /^(allowed:|transition:|capacity:|deny:|node-capacity)/.test(e)));
    assert.equal(f.state().audits[0]!.kind, 'node_revocation');
    assert.equal(f.state().operations[0]!.request.digest, digest({ method: 'POST',
        path: '/api/v1/scopes/scope-a/nodes/node-middle/revoke', input: { kind: 'revoke' } }));
});

test('both commands gate replay with current scope management permission and reuse the complete response without side effects', async () => {
    for (const kind of ['policy', 'revoke'] as const) {
        const f = fixture(), command = kind === 'policy' ? f.update() : { kind } as const;
        const first = await f.change(command); f.events.length = 0;
        assert.deepEqual(await f.change(command), first);
        assert.deepEqual(f.events, ['begin', 'manage', 'claim', 'commit']); assert.equal(f.state().audits.length, 1);
        const conflict = kind === 'policy' ? { kind, expectedRevision: 1, policy: { ...f.policy, allowMetadataTargets: true } } as const : f.update();
        await assert.rejects(f.change(conflict), /IDEMPOTENCY_CONFLICT/);
        f.options.permitted = false; f.events.length = 0;
        await assert.rejects(f.change(command), /denied/);
        assert.deepEqual(f.events, ['begin', 'manage', 'rollback']);
    }
});

test('new revocation keys retain acceptance semantics; empty reference and missing lease sets do not invent execution state', async () => {
    const f = fixture();
    await f.change({ kind: 'revoke' });
    const repeated = await f.change({ kind: 'revoke' }, 'second');
    assert.equal(repeated.status, 202); assert.equal(f.state().audits.length, 2); assert.equal(f.state().operations.length, 8);
    const empty = fixture(); empty.forwards.length = 0; empty.until.clear();
    const result = await empty.change({ kind: 'revoke' });
    assert.deepEqual(result.body.operationIds, []); assert.equal(result.body.latestAuthorizationUntil, null);
    assert.equal(empty.state().revoked, true); assert.ok(empty.events.includes('cutoff:node-middle'));
});

test('policy stale CAS, revision increment errors and policy changes on revoked Nodes roll back idempotency claims', async () => {
    const f = fixture();
    await assert.rejects(f.change({ kind: 'policy', expectedRevision: 2, policy: { ...f.policy, egressPolicyRevision: 3 } }), /REVISION_CONFLICT/);
    await assert.rejects(f.change({ kind: 'policy', expectedRevision: 1, policy: { ...f.policy, egressPolicyRevision: 3 } }), /invalid increment/);
    assert.equal(f.state().responses.size, 0); assert.equal(f.state().facts.egressPolicyRevision, 1);
    await f.change({ kind: 'revoke' });
    await assert.rejects(f.change(f.update(), 'after-revoke'), /revoked/);
    assert.equal(f.state().responses.has('after-revoke'), false);
});

test('policy and revocation failures roll back owner changes, prior operations, audit and replay together', async () => {
    for (const kind of ['policy', 'revoke'] as const) {
        const failures = ['claim', 'mutate', 'references', 'lock:relay', 'nodes:relay', 'authorizer:relay', 'accept:relay',
            'accept:denied', 'cutoff:node-old', 'audit', 'respond',
            ...(kind === 'policy' ? ['allowed:relay', 'transition:relay', 'capacity:relay', 'deny:operation-3', 'node-capacity'] : [])];
        for (const failure of failures) {
            const f = fixture(), before = structuredClone(f.state()); f.options.failure = failure;
            const command = kind === 'policy' ? f.update() : { kind } as const;
            await assert.rejects(f.change(command), new RegExp('Injected ' + failure));
            assert.deepEqual(f.state(), before); assert.equal(f.events.at(-1), 'rollback');
            f.options.failure = ''; assert.equal((await f.change(command)).status, 202);
        }
    }
});

test('policy objects and nested arrays are detached before authorization so digest and mutation see one intent', async () => {
    const f = fixture(), input = { kind: 'policy' as const, expectedRevision: 1,
        policy: { ...f.policy, allowedPorts: [32001], allowedListenerAddresses: ['127.0.0.1'], allowedDestinationCidrs: ['127.0.0.0/9'] } };
    const original = structuredClone(input);
    f.options.onAuthorization = () => {
        input.expectedRevision = 99; input.policy.egressPolicyRevision = 99; input.policy.allowedPorts[0] = 1;
        input.policy.allowedDestinationCidrs[0] = '192.0.2.0/24'; input.policy.allowedListenerAddresses[0] = '0.0.0.0';
    };
    await f.change(input);
    assert.deepEqual(f.commands, [original]);
    assert.equal(f.state().operations[0]!.request.digest, digest({ method: 'PUT',
        path: '/api/v1/scopes/scope-a/nodes/node-middle/policy', input: original }));
});

test('Node effect wiring and cross-scope owner references fail closed', async () => {
    const f = fixture(); f.forwards[0] = { ...f.forwards[0]!, scopeId: 'scope-b' };
    await assert.rejects(f.change({ kind: 'revoke' }), { code: 'INTEGRITY_FAILURE' });
    assert.equal(f.state().revoked, false); assert.ok(!f.events.includes('lock:relay'));
    const wrongFacts = fixture();
    wrongFacts.state().facts = { ...wrongFacts.state().facts, scopeId: 'scope-b' };
    await assert.rejects(wrongFacts.change({ kind: 'revoke' }), { code: 'INTEGRITY_FAILURE' });
    assert.ok(!wrongFacts.events.includes('references'));
    assert.throws(() => new NodeManagementCommands(f.db, f.identity, f.idempotency, f.nodes, undefined as never), /effects are required/);
});

test('non-HTTP management callers cannot bypass identifiers, closed command shapes or bounded Node policy validation', async () => {
    const f = fixture(), command = f.update();
    for (const input of [undefined, null, [], { kind: 'unknown' }, { kind: 'revoke', policy: f.policy },
        { kind: 'policy', expectedRevision: 0, policy: f.policy }, { kind: 'policy', expectedRevision: 1, policy: null },
        { kind: 'policy', expectedRevision: 1, policy: { ...f.policy, allowedPorts: [32001, 32001] } },
        { kind: 'policy', expectedRevision: 1, policy: { ...f.policy, capabilities: ['everything'] } },
        { kind: 'policy', expectedRevision: 1, policy: { ...f.policy, allowedDestinationCidrs: ['10.0.0.1/24'] } }])
        await assert.rejects(f.change(input as never), { code: 'INVALID_CONFIG' });
    for (const action of [
        () => f.service.change('../manager', 'scope-a', 'node-middle', 'key', command),
        () => f.service.change('manager-a', '../scope', 'node-middle', 'key', command),
        () => f.service.change('manager-a', 'scope-a', '../node', 'key', command),
        () => f.service.change('manager-a', 'scope-a', 'node-middle', undefined, command),
    ]) await assert.rejects(action, { code: 'INVALID_CONFIG' });
    assert.deepEqual(f.events, []);
});
