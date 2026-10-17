import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkProbeClaim } from '@tunex/contracts';
import type { ProbeClaimRequest } from '@tunex/contracts';
import { ProbeClaims } from '../src/application/probe-claims.ts';
import { createApp } from '../src/api/app.ts';
const request: ProbeClaimRequest = { protocolVersion: 3, probeVersion: 1, kind: 'probe-claim', nodeId: 'node-a',
    bootId: 'boot-a', sessionEpoch: 2, instanceId: 'a'.repeat(64), instanceGeneration: 1, permitId: 'permit-a' };
function consumed() {
    const now = Date.now();
    return { id: request.permitId, actorId: 'owner', scopeId: 'scope-a', binding: { nodeId: request.nodeId,
        bootId: request.bootId, sessionEpoch: 2, snapshotGeneration: 3, assignmentId: 'assignment-a', forwardId: 'forward-a',
        forwardRevision: 1, deploymentGeneration: 4, bindingFence: 5, configDigest: 'sha256:' + 'b'.repeat(64), egressPolicyRevision: 1 },
        instanceId: request.instanceId, instanceGeneration: 1, timeoutMs: 1000, issuedAt: now - 10, expiresAt: now + 1990,
        state: 'consumed' as const, closedAt: now, executionEnabled: false as const, dispatch: 'not-implemented' as const };
}
test('closed claim adapter forwards only actual mTLS identity and emits a detached minimized receipt after owner completion', async () => {
    let calls = 0;
    const result = consumed();
    const claims = new ProbeClaims({ consume: async (node, fingerprint, epoch, input) => {
        calls++; assert.deepEqual([node, fingerprint, epoch], ['node-a', 'f'.repeat(64), 2]);
        assert.deepEqual(input, { permitId: request.permitId, bootId: request.bootId, instanceId: request.instanceId, instanceGeneration: 1 });
        return result;
    } });
    const ack = await claims.handle('node-a', 'f'.repeat(64), 2, request);
    checkProbeClaim(request, ack); assert.equal(calls, 1);
    assert.equal(ack.executionEnabled, false); assert.equal(ack.state, 'consumed');
    assert.ok(Object.isFrozen(ack.binding)); assert.ok(Object.isFrozen(ack));
    assert.ok(!['fingerprint', 'actorId', 'scopeId', 'dispatch', 'target', 'permit'].some(k => k in ack));
    result.binding.bindingFence++;
    assert.equal(ack.binding.bindingFence, 5);
});
test('typed contract bypass and verified Node/session mismatch reject before owner consumption', async () => {
    const claims = new ProbeClaims({ consume: async () => { assert.fail('owner must not be entered'); } });
    await assert.rejects(claims.handle('foreign', 'f'.repeat(64), 2, request), { code: 'SESSION_SUPERSEDED' });
    await assert.rejects(claims.handle('node-a', 'f'.repeat(64), 3, request), { code: 'SESSION_SUPERSEDED' });
    for (const patch of [{ fingerprint: 'f'.repeat(64) }, { actorId: 'owner' }, { timeoutMs: 2000 },
        { binding: consumed().binding }, { target: '127.0.0.1' }, { instanceGeneration: 0 }, { permitId: 'bad\n' }])
        await assert.rejects(claims.handle('node-a', 'f'.repeat(64), 2, { ...request, ...patch } as ProbeClaimRequest));
});
test('owner denial, post-commit expiration and inconsistent owner result cannot manufacture a receipt or retry consumption', async () => {
    let calls = 0;
    const deny = new ProbeClaims({ consume: async () => { calls++; throw new Error('owner denied'); } });
    await assert.rejects(deny.handle('node-a', 'f'.repeat(64), 2, request), /owner denied/); assert.equal(calls, 1);
    for (const patch of [{ expiresAt: Date.now() - 1 }, { closedAt: null }, { state: 'issued' }, { id: 'foreign' },
        { instanceId: 'b'.repeat(64) }, { instanceGeneration: 2 }, { closedAt: Date.now() + 60000 }]) {
        let entered = 0;
        const claims = new ProbeClaims({ consume: async () => { entered++; return { ...consumed(), ...patch } as never; } });
        await assert.rejects(claims.handle('node-a', 'f'.repeat(64), 2, request), { code: 'PROBE_PERMIT_UNAVAILABLE' });
        assert.equal(entered, 1);
    }
});
test('Bearer, claimed fingerprint and session headers never substitute for actual mTLS on the claim endpoint', async () => {
    const app = createApp({} as never, {} as never, { allow: async () => undefined } as never);
    const response = await app.request('/agent/v3/probe/claim', { method: 'POST', headers: {
        Authorization: 'Bearer fake', 'X-TuneX-Session-Epoch': '2', 'X-Client-Fingerprint': 'f'.repeat(64) }, body: JSON.stringify(request) });
    assert.equal(response.status, 401);
});
