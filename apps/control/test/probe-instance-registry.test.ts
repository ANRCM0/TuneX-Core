import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ProbeInstanceRegistry } from '../src/application/probe-instance-registry.ts';
import { createApp } from '../src/api/app.ts';
import type { ProbeInstanceRequest } from '@tunex/contracts';
const request: ProbeInstanceRequest = { protocolVersion: 3, probeVersion: 1, kind: 'probe-instance', action: 'register',
    nodeId: 'node-a', bootId: 'boot-a', sessionEpoch: 2, instanceId: 'a'.repeat(64), expectedGeneration: 0 };
test('remote registry passes actual machine identity to the owner and emits a detached non-executable response', async () => {
    const now = Date.now(), calls: string[] = [];
    const record = { nodeId: 'node-a', bootId: 'boot-a', sessionEpoch: 2, fingerprint: 'b'.repeat(64), instanceId: request.instanceId,
        generation: 1, state: 'registered' as const, registeredAt: now, expiresAt: now + 30000, revokedAt: null, executionEnabled: false as const };
    const registry = new ProbeInstanceRegistry({
        register: async (node, fingerprint, epoch, command) => {
            assert.deepEqual([node, fingerprint, epoch], ['node-a', 'b'.repeat(64), 2]);
            assert.deepEqual(command, { bootId: 'boot-a', instanceId: request.instanceId, expectedGeneration: 0 });
            calls.push('register'); return record;
        }, revoke: async () => { calls.push('revoke'); return { ...record, state: 'revoked', revokedAt: now }; },
        inspect: async () => { calls.push('inspect'); return { generation: 0, state: 'absent', instance: null, executionEnabled: false }; },
    });
    const ack = await registry.handle('node-a', 'b'.repeat(64), 2, request);
    assert.equal(ack.executionEnabled, false); assert.equal(ack.currentInstanceId, request.instanceId);
    assert.ok(!('fingerprint' in ack)); assert.ok(Object.isFrozen(ack));
    const absent = await registry.handle('node-a', 'b'.repeat(64), 2, { ...request, action: 'inspect' });
    assert.equal(absent.generation, 0); assert.equal(absent.currentInstanceId, null);
    const revoked = await registry.handle('node-a', 'b'.repeat(64), 2, { ...request, action: 'revoke', expectedGeneration: 1 });
    assert.equal(revoked.state, 'revoked'); assert.deepEqual(calls, ['register', 'inspect', 'revoke']);
});
test('typed bypass and verified machine/session mismatch reject before entering any owner operation', async () => {
    const fail = async (): Promise<never> => { assert.fail('owner must not be called'); };
    const registry = new ProbeInstanceRegistry({ register: fail, revoke: fail, inspect: fail });
    await assert.rejects(registry.handle('node-b', 'b'.repeat(64), 2, request), { code: 'SESSION_SUPERSEDED' });
    await assert.rejects(registry.handle('node-a', 'b'.repeat(64), 3, request), { code: 'SESSION_SUPERSEDED' });
    await assert.rejects(registry.handle('node-a', 'b'.repeat(64), 2, { ...request, target: '169.254.169.254' } as never));
    await assert.rejects(registry.handle('node-a', 'b'.repeat(64), 2, { ...request, action: 'inspect', expectedGeneration: 1 }));
});
test('Bearer or session headers do not substitute for verified mTLS on the instance endpoint', async () => {
    const app = createApp({} as never, {} as never, { allow: async () => undefined } as never);
    const response = await app.request('/agent/v3/probe/instance', { method: 'POST', headers: {
        Authorization: 'Bearer fake', 'X-TuneX-Session-Epoch': '2' }, body: JSON.stringify(request) });
    assert.equal(response.status, 401);
});
