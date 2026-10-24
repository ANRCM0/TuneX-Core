import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { checkProbeResult, parseProbeResult, probeResultDigest } from '@tunex/contracts';
import type { ProbeResultRequest } from '@tunex/contracts';
import { ProbeResults } from '../src/application/probe-results.ts';
import { createApp } from '../src/api/app.ts';
const fixture = JSON.parse(await readFile(new URL('../../../packages/contracts/fixtures/probe-result-v1.json', import.meta.url), 'utf8')) as { request: ProbeResultRequest };
const input = parseProbeResult('Request', JSON.stringify(fixture.request)), at = Date.parse(input.measuredAt) + 10;
const accepted = () => ({ resultDigest: probeResultDigest(input), acceptedAt: at, checkedAt: at, duplicate: false });
test('result adapter delegates once to the owner, awaits commit and returns only a detached receipt', async () => {
    let calls = 0, committed = false;
    const host = new ProbeResults({ receiveResult: async (node, fp, epoch, command) => {
        calls++; assert.deepEqual([node, fp, epoch], [input.nodeId, 'f'.repeat(64), input.sessionEpoch]);
        assert.deepEqual(command, input); assert.ok(Object.isFrozen(command.binding));
        await Promise.resolve(); committed = true; return accepted();
    } }, () => at + 10);
    const ack = await host.handle(input.nodeId, 'f'.repeat(64), input.sessionEpoch, input);
    checkProbeResult(input, ack); assert.equal(calls, 1); assert.equal(committed, true); assert.ok(Object.isFrozen(ack));
    assert.equal(ack.health, 'unknown'); assert.equal(ack.executionEnabled, false);
    for (const key of ['body', 'target', 'binding', 'actorId', 'scopeId', 'fingerprint', 'permit']) assert.ok(!(key in ack));
});
test('typed result injection and claimed Node/session mismatch reject before the owner', async () => {
    const host = new ProbeResults({ receiveResult: async () => { assert.fail('owner entered'); } });
    await assert.rejects(host.handle('foreign', 'f'.repeat(64), 2, input));
    await assert.rejects(host.handle(input.nodeId, 'f'.repeat(64), 3, input));
    for (const patch of [{ actorId: 'owner' }, { target: '127.0.0.1' }, { source: 'control-verified' }, { applicationHealth: 'healthy' }, { status: 'timeout' }])
        await assert.rejects(host.handle(input.nodeId, 'f'.repeat(64), 2, { ...input, ...patch } as ProbeResultRequest));
});
test('failed owner commits propagate without an acknowledgement, fallback or retry', async () => {
    let calls = 0;
    const host = new ProbeResults({ receiveResult: async () => { calls++; throw new Error('commit guard rollback'); } });
    await assert.rejects(host.handle(input.nodeId, 'f'.repeat(64), 2, input), /commit guard rollback/); assert.equal(calls, 1);
});
test('stale post-commit clocks and inconsistent saved receipts cannot manufacture a result acknowledgement', async () => {
    for (const clock of [() => at - 1, () => at + 251, () => NaN, () => Date.parse(input.validUntil)]) {
        const host = new ProbeResults({ receiveResult: async () => accepted() }, clock);
        await assert.rejects(host.handle(input.nodeId, 'f'.repeat(64), 2, input));
    }
    for (const patch of [{ resultDigest: 'sha256:' + 'f'.repeat(64) }, { acceptedAt: NaN }, { acceptedAt: at + 1 },
        { acceptedAt: Date.parse(input.measuredAt) - 1 }, { checkedAt: NaN }, { duplicate: 'true' }]) {
        const host = new ProbeResults({ receiveResult: async () => ({ ...accepted(), ...patch }) as never }, () => at);
        await assert.rejects(host.handle(input.nodeId, 'f'.repeat(64), 2, input));
    }
});
test('result endpoint rejects Bearer and claimed fingerprint without actual mTLS', async () => {
    const app = createApp({} as never, {} as never, { allow: async () => undefined } as never);
    const response = await app.request('/agent/v3/probe/result', { method: 'POST', headers: {
        Authorization: 'Bearer fake', 'X-TuneX-Session-Epoch': '2', 'X-Client-Fingerprint': 'f'.repeat(64) }, body: JSON.stringify(input) });
    assert.equal(response.status, 401); assert.equal(response.headers.get('cache-control'), 'no-store');
});
