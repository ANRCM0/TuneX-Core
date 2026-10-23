import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Forward } from '@tunex/core';
import { ControlError } from '../src/framework/public.ts';
import { ForwardProbeCapabilities, FORWARD_PROBE_CAPABILITY_API_INTERFACE_VERSION } from '../src/modules/probe-owner/public.ts';
import type { ForwardProbePlan } from '../src/modules/probe-owner/public.ts';

function fixture() {
    const tx = { marker: 'capability-read' }, calls: string[] = [];
    const state: {
        forward: Forward & { deleting: boolean; recoverySuspended: boolean };
        scopeError?: Error; accessError?: Error; planErrors: Map<string, Error>; planWait?: () => Promise<void>;
    } = {
        forward: { id: 'forward-a', scopeId: 'scope-a', revision: 7, deleting: false, recoverySuspended: false,
            spec: { enabled: true, protocols: ['tcp', 'udp'],
                ingress: { nodeId: 'node-a', listen: { address: '127.0.0.1', port: 22001 } },
                target: { host: '127.0.0.1', port: 22002 } } }, planErrors: new Map(),
    };
    const switches = { enabled: true, ingressEnabled: true, servicesEnabled: true };
    const host = new ForwardProbeCapabilities({ transaction: async action => {
        calls.push('transaction'); return action(tx);
    } }, { scope: async (actual, actor, scope, manage) => {
        assert.equal(actual, tx); assert.equal(actor, 'actor-a'); assert.equal(scope, 'scope-a'); assert.equal(manage, true);
        calls.push('scope'); if (state.scopeError) throw state.scopeError;
    } }, {
        principal: async () => { throw new Error('unexpected principal read'); },
        forward: async () => { throw new Error('unexpected forward authorization path'); },
        node: async () => { throw new Error('unexpected Node authorization path'); },
        owned: async (actual, actor, scope, kind, id) => {
            assert.equal(actual, tx); assert.equal(actor, 'actor-a'); assert.equal(scope, 'scope-a');
            assert.equal(kind, 'forward'); assert.equal(id, 'forward-a'); calls.push('owned');
            if (state.accessError) throw state.accessError;
        },
    }, { record: async (actual, scope, id) => {
        assert.equal(actual, tx); assert.equal(scope, 'scope-a'); assert.equal(id, 'forward-a');
        calls.push('intent'); return state.forward;
    } }, { plan: async (actor, scope, id, input) => {
        const command = input as { kind: 'tcp-connect' | 'tcp-ingress-connect'; expectedRevision: number };
        assert.equal(actor, 'actor-a'); assert.equal(scope, 'scope-a'); assert.equal(id, 'forward-a');
        assert.equal(command.expectedRevision, 7); calls.push(command.kind);
        await state.planWait?.();
        const error = state.planErrors.get(command.kind); if (error) throw error;
        const facts = { version: 1 as const, executable: false as const, dispatch: 'not-implemented' as const,
            independentProbe: false as const, health: 'unknown' as const, scopeId: scope,
            binding: { nodeId: 'node-a', bootId: 'boot-a', sessionEpoch: 2, snapshotGeneration: 3,
                assignmentId: 'assignment-a', forwardId: id, forwardRevision: 7, deploymentGeneration: 4,
                bindingFence: 5, configDigest: 'a'.repeat(64), egressPolicyRevision: 1 },
            timeoutMs: 1000, maxAttempts: 1 as const, applicationPayloadBytes: 0 as const,
            plannedAt: '2026-10-21T00:00:00.000Z', expiresAt: '2026-10-21T00:00:02.000Z' };
        const plan: ForwardProbePlan = command.kind === 'tcp-connect' ? { ...facts, kind: 'tcp-connect', point: 'agent-direct-egress' } :
            { ...facts, kind: 'tcp-ingress-connect', point: 'agent-local-direct-ingress',
                measurement: 'tcp-ingress-connect-v1', capability: 'probe.tcp-ingress-connect.v1' };
        return plan;
    } }, switches);
    return { host, state, calls, switches, get: () => host.get('actor-a', 'scope-a', 'forward-a') };
}

test('capability query exports v1, authorizes before intent and delegates basic preflight to the original planner', async () => {
    const f = fixture(), view = await f.get();
    assert.equal(FORWARD_PROBE_CAPABILITY_API_INTERFACE_VERSION, 1);
    assert.deepEqual(f.calls, ['transaction', 'scope', 'owned', 'intent', 'tcp-connect', 'tcp-ingress-connect']);
    assert.equal(view.items.length, 5); assert.equal(view.mode, 'direct');
    assert.equal(view.items[0]!.preflight.state, 'available'); assert.equal(view.items[1]!.preflight.state, 'available');
    assert.equal(view.items[0]!.point, 'agent-direct-egress'); assert.equal(view.items[1]!.point, 'agent-local-direct-ingress');
    assert.equal(view.executionAuthorized, false); assert.equal(view.networkCheck, 'not-performed');
    assert.equal(view.endToEnd, false); assert.equal(view.health, 'unknown');
    for (const item of view.items) { assert.equal(item.endToEnd, false); assert.equal(item.health, 'unknown'); }
    assert.equal(view.diagnostics.apiPath, '/api/v1/scopes/scope-a/forwards/forward-a/diagnostics');
    assert.equal(view.diagnostics.readOnly, true); assert.ok(Object.isFrozen(view)); assert.ok(Object.isFrozen(view.items));
    assert.ok(!JSON.stringify(view).includes('127.0.0.1')); assert.ok(!JSON.stringify(view).includes('assignment-a'));
});

test('scope and ownership refusals propagate before intent or capability disclosure', async () => {
    for (const boundary of ['scopeError', 'accessError'] as const) {
        const f = fixture(), error = new ControlError('AUTHORIZATION_DENIED', 403, 'Not authorized');
        f.state[boundary] = error;
        await assert.rejects(f.get(), actual => actual === error);
        assert.ok(!f.calls.includes('intent')); assert.ok(!f.calls.includes('tcp-connect'));
    }
    const f = fixture(); await assert.rejects(f.host.get('actor-a\n', 'scope-a', 'forward-a'), { code: 'INVALID_CONFIG' });
    assert.deepEqual(f.calls, []);
});

test('Relay and multihop refuse active execution while profile-only intent retains its integrity refusal', async () => {
    for (const via of [['node-b'], ['node-b', 'node-c']]) {
        const f = fixture(); f.state.forward = { ...f.state.forward, spec: { ...f.state.forward.spec, path: { via }, transport: { profileId: 'profile-a', configRevision: 1 } } };
        const view = await f.get(); assert.equal(view.mode, via.length === 1 ? 'relay' : 'multihop');
        assert.ok(view.items.every(item => item.transportSupport === 'unsupported' && item.preflight.state === 'unsupported'));
        assert.deepEqual(f.calls, ['transaction', 'scope', 'owned', 'intent']);
        assert.equal(view.diagnostics.networkCheck, 'not-performed');
    }
    const f = fixture(); f.state.forward = { ...f.state.forward, spec: { ...f.state.forward.spec,
        transport: { profileId: 'profile-a', configRevision: 1 } } };
    await assert.rejects(f.get(), { code: 'INTEGRITY_FAILURE', status: 409, message: 'Stored Forward cannot be classified' });
    assert.deepEqual(f.calls, ['transaction', 'scope', 'owned', 'intent']);
});

test('issuance switches, controlled-service requirements and echo command support are independent', async () => {
    const f = fixture(); f.switches.enabled = false; f.switches.ingressEnabled = false; f.switches.servicesEnabled = false;
    const view = await f.get();
    assert.equal(view.items[0]!.preflight.state, 'available'); assert.equal(view.items[0]!.issuance, 'disabled');
    assert.equal(view.items[2]!.preflight.state, 'requires-controlled-service'); assert.equal(view.items[2]!.issuance, 'disabled');
    for (const item of view.items.slice(3)) {
        assert.equal(item.preflight.state, 'requires-controlled-service'); assert.equal(item.issuance, 'not-dispatchable');
        assert.equal(item.preflight.expiresAt, null);
    }
    assert.equal(f.calls.filter(call => call.startsWith('tcp-')).length, 2);
});

test('disabled, deleting and recovery-suspended rules expose unavailable preflight without planner work', async () => {
    for (const condition of ['disabled', 'deleting', 'recoverySuspended']) {
        const f = fixture();
        f.state.forward = { ...f.state.forward, deleting: condition === 'deleting', recoverySuspended: condition === 'recoverySuspended',
            spec: { ...f.state.forward.spec, enabled: condition !== 'disabled' } };
        assert.ok((await f.get()).items.every(item => item.preflight.state === 'unavailable'));
        assert.deepEqual(f.calls, ['transaction', 'scope', 'owned', 'intent']);
    }
});

test('known capability and lifecycle refusals become reasons, while permission, integrity and internal failures propagate', async () => {
    for (const code of ['PROBE_UNAVAILABLE', 'REVISION_CONFLICT', 'UNSUPPORTED_CAPABILITY']) {
        const f = fixture(); f.state.planErrors.set('tcp-connect', new ControlError(code, 409, 'Expected original refusal'));
        const item = (await f.get()).items[0]!; assert.equal(item.preflight.reason.code, code);
        assert.equal(item.preflight.state, code === 'UNSUPPORTED_CAPABILITY' ? 'unsupported' : 'unavailable');
    }
    for (const error of [new ControlError('AUTHORIZATION_DENIED', 403, 'Grant changed'),
        new ControlError('INTEGRITY_FAILURE', 409, 'Corrupt binding'), new Error('storage failed'),
        new ControlError('INVALID_CONFIG', 422, 'Unexpected planner request failure')]) {
        const f = fixture(); f.state.planErrors.set('tcp-ingress-connect', error);
        await assert.rejects(f.get(), actual => actual === error);
    }
});

test('protocol mismatch is explicit and corrupt stored identity never becomes an ordinary capability refusal', async () => {
    const f = fixture(); f.state.forward = { ...f.state.forward, spec: { ...f.state.forward.spec, protocols: ['tcp'] } };
    assert.equal((await f.get()).items[4]!.preflight.state, 'unsupported');
    f.state.forward = { ...f.state.forward, id: 'different-forward' };
    await assert.rejects(f.get(), { code: 'INTEGRITY_FAILURE' });
});

test('capability reads hold four slots through planner completion and reject overflow before storage', async () => {
    const f = fixture(); let release!: () => void, entered!: () => void, waiting = 0;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const allEntered = new Promise<void>(resolve => { entered = resolve; });
    f.state.planWait = async () => { if (++waiting === 4) entered(); await barrier; };
    const pending = Array.from({ length: 4 }, () => f.get());
    try {
        await allEntered;
        const before = [...f.calls];
        await assert.rejects(f.get(), { code: 'PROBE_CAPABILITY_BUSY', status: 429, retryable: true });
        assert.deepEqual(f.calls, before);
    } finally {
        release(); await Promise.all(pending);
    }
    delete f.state.planWait;
    assert.equal((await f.get()).items.length, 5);
});

test('capability read errors release their slot and preserve the original error', async () => {
    const f = fixture(), error = new Error('planner failed');
    f.state.planErrors.set('tcp-connect', error);
    for (let index = 0; index < 5; index++) await assert.rejects(f.get(), actual => actual === error);
    f.state.planErrors.clear();
    assert.equal((await f.get()).items.length, 5);
});
