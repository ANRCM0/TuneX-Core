import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkProbePoll, checkProbeStatus } from '@tunex/contracts';
import type { ProbePollRequest, ProbeStatusRequest } from '@tunex/contracts';
import { ProbeDelivery } from '../src/application/probe-delivery.ts';
import { createApp } from '../src/api/app.ts';
const now = Date.parse('2026-10-17T00:00:00.100Z'), fingerprint = 'f'.repeat(64);
const poll: ProbePollRequest = { protocolVersion: 3, probeVersion: 1, kind: 'probe-poll', nodeId: 'node-a', bootId: 'boot-a',
    sessionEpoch: 2, instanceId: 'a'.repeat(64), instanceGeneration: 1, requestId: 'c'.repeat(64) };
const status: ProbeStatusRequest = { ...poll, kind: 'probe-status', permitId: 'permit-a' };
function consumed() {
    return { id: 'permit-a', actorId: 'owner', scopeId: 'scope-a', binding: { nodeId: poll.nodeId, bootId: poll.bootId,
        sessionEpoch: 2, snapshotGeneration: 3, assignmentId: 'assignment-a', forwardId: 'forward-a', forwardRevision: 1,
        deploymentGeneration: 4, bindingFence: 5, configDigest: 'sha256:' + 'b'.repeat(64), egressPolicyRevision: 1 },
        instanceId: poll.instanceId, instanceGeneration: 1, timeoutMs: 1000, issuedAt: now - 100, expiresAt: now + 1900,
        state: 'consumed' as const, closedAt: now - 50, checkedAt: now, executionEnabled: false as const, dispatch: 'not-implemented' as const };
}
function offered() {
    const record = consumed();
    return { observedAt: now, executionEnabled: false as const, offer: { permitId: record.id, instanceId: record.instanceId,
        instanceGeneration: record.instanceGeneration, binding: record.binding, timeoutMs: record.timeoutMs,
        issuedAt: record.issuedAt, expiresAt: record.expiresAt } };
}
test('closed delivery adapter forwards actual machine identity and minimizes immutable empty/one/status replies after owner completion', async () => {
    const result = offered(), record = consumed(); let polls = 0, statuses = 0;
    const delivery = new ProbeDelivery({ offer: async (node, fp, epoch, input) => {
        polls++; assert.deepEqual([node, fp, epoch], ['node-a', fingerprint, 2]);
        assert.deepEqual(input, { bootId: poll.bootId, instanceId: poll.instanceId, instanceGeneration: 1 });
        return polls === 1 ? { ...result, offer: null } : result;
    }, check: async (node, fp, epoch, input) => {
        statuses++; assert.deepEqual([node, fp, epoch], ['node-a', fingerprint, 2]);
        assert.deepEqual(input, { permitId: 'permit-a', bootId: poll.bootId, instanceId: poll.instanceId, instanceGeneration: 1 });
        return record;
    } }, () => now + 10);
    const empty = await delivery.poll('node-a', fingerprint, 2, poll);
    checkProbePoll(poll, empty); assert.equal(empty.offer, null);
    const offer = await delivery.poll('node-a', fingerprint, 2, poll), ack = await delivery.status('node-a', fingerprint, 2, status);
    checkProbePoll(poll, offer); checkProbeStatus(status, ack); assert.equal(polls, 2); assert.equal(statuses, 1);
    assert.ok(Object.isFrozen(offer.offer!.binding)); assert.ok(Object.isFrozen(ack.binding));
    assert.ok(Object.isFrozen(offer)); assert.ok(Object.isFrozen(ack));
    for (const value of [offer, offer.offer!, ack])
        assert.ok(!['fingerprint', 'actorId', 'scopeId', 'dispatch', 'target', 'permit'].some(k => k in value));
    result.offer.binding.bindingFence++; record.binding.bindingFence++;
    assert.equal(offer.offer!.binding.bindingFence, 5); assert.equal(ack.binding.bindingFence, 5);
    assert.equal(offer.executionEnabled, false); assert.equal(ack.executionEnabled, false);
});
test('invalid typed commands, cross-protocol and verified identity mismatch reject before any owner call', async () => {
    const delivery = new ProbeDelivery({ offer: async () => { assert.fail('offer entered'); }, check: async () => { assert.fail('check entered'); } });
    for (const [node, epoch] of [['foreign', 2], ['node-a', 3]] as const) {
        await assert.rejects(delivery.poll(node, fingerprint, epoch, poll), { code: 'SESSION_SUPERSEDED' });
        await assert.rejects(delivery.status(node, fingerprint, epoch, status), { code: 'SESSION_SUPERSEDED' });
    }
    for (const patch of [{ fingerprint }, { actorId: 'owner' }, { target: '127.0.0.1' }, { binding: consumed().binding },
        { timeoutMs: 1000 }, { requestId: 'a' }, { instanceGeneration: 0 }, { kind: 'probe-claim' }]) {
        await assert.rejects(delivery.poll('node-a', fingerprint, 2, { ...poll, ...patch } as ProbePollRequest));
        await assert.rejects(delivery.status('node-a', fingerprint, 2, { ...status, ...patch } as ProbeStatusRequest));
    }
    await assert.rejects(delivery.poll('node-a', fingerprint, 2, { ...poll, permitId: 'permit-a' } as ProbePollRequest));
});
test('owner denial and pre-commit guard failures propagate without fallback, cached success or a second transaction', async () => {
    let polls = 0, checks = 0;
    const delivery = new ProbeDelivery({ offer: async () => { polls++; throw new Error('guard rollback'); },
        check: async () => { checks++; throw new Error('withdrawn'); } });
    await assert.rejects(delivery.poll('node-a', fingerprint, 2, poll), /guard rollback/);
    await assert.rejects(delivery.status('node-a', fingerprint, 2, status), /withdrawn/);
    assert.equal(polls, 1); assert.equal(checks, 1);
});
test('post-commit stale or uncertain clocks and expired results cannot produce discovery or status acknowledgements', async () => {
    for (const clock of [() => now - 1, () => now + 251, () => NaN, () => 8640000000000001]) {
        const delivery = new ProbeDelivery({ offer: async () => offered(), check: async () => consumed() }, clock);
        await assert.rejects(delivery.poll('node-a', fingerprint, 2, poll), { code: 'PROBE_PERMIT_UNAVAILABLE' });
        await assert.rejects(delivery.status('node-a', fingerprint, 2, status), { code: 'PROBE_PERMIT_UNAVAILABLE' });
    }
    const boundary = new ProbeDelivery({ offer: async () => offered(), check: async () => consumed() }, () => now + 250);
    await boundary.poll('node-a', fingerprint, 2, poll); await boundary.status('node-a', fingerprint, 2, status);
    const delivery = new ProbeDelivery({ offer: async () => ({ ...offered(), offer: { ...offered().offer, expiresAt: now } }),
        check: async () => ({ ...consumed(), expiresAt: now }) }, () => now);
    await assert.rejects(delivery.poll('node-a', fingerprint, 2, poll));
    await assert.rejects(delivery.status('node-a', fingerprint, 2, status));
});
test('inconsistent owner identity, instance, time or execution markers fail closed after exactly one call', async () => {
    for (const patch of [{ offer: undefined }, { offer: false }, { offer: [] }, { executionEnabled: true }, { observedAt: NaN }]) {
        let calls = 0;
        const delivery = new ProbeDelivery({ offer: async () => { calls++; return { ...offered(), ...patch } as never; },
            check: async () => consumed() }, () => now);
        await assert.rejects(delivery.poll('node-a', fingerprint, 2, poll)); assert.equal(calls, 1);
    }
    for (const patch of [{ instanceId: 'b'.repeat(64) }, { instanceGeneration: 2 }, { permitId: 'bad\n' },
        { binding: { ...consumed().binding, nodeId: 'foreign' } }, { timeoutMs: 2001 }, { issuedAt: now + 1 }]) {
        let calls = 0;
        const delivery = new ProbeDelivery({ offer: async () => { calls++; return { ...offered(), offer: { ...offered().offer, ...patch } } as never; },
            check: async () => consumed() }, () => now);
        await assert.rejects(delivery.poll('node-a', fingerprint, 2, poll)); assert.equal(calls, 1);
    }
    for (const patch of [{ id: 'foreign' }, { instanceId: 'b'.repeat(64) }, { instanceGeneration: 2 }, { state: 'issued' },
        { closedAt: null }, { closedAt: now + 1 }, { executionEnabled: true }, { checkedAt: NaN },
        { binding: { ...consumed().binding, bootId: 'foreign' } }]) {
        let calls = 0;
        const delivery = new ProbeDelivery({ offer: async () => offered(), check: async () => { calls++; return { ...consumed(), ...patch } as never; } }, () => now);
        await assert.rejects(delivery.status('node-a', fingerprint, 2, status)); assert.equal(calls, 1);
    }
});
test('delivery endpoints never substitute Bearer or claimed headers for actual mTLS', async () => {
    const app = createApp({} as never, {} as never, { allow: async () => undefined } as never);
    for (const [path, input] of [['poll', poll], ['status', status]] as const) {
        const response = await app.request('/agent/v3/probe/' + path, { method: 'POST', headers: {
            Authorization: 'Bearer fake', 'X-TuneX-Session-Epoch': '2', 'X-Client-Fingerprint': fingerprint }, body: JSON.stringify(input) });
        assert.equal(response.status, 401); assert.equal(response.headers.get('cache-control'), 'no-store');
    }
});
