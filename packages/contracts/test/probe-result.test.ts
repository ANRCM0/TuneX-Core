import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { checkProbeResult, parseProbeResult, probeResultDigest } from '../src/probe-result.ts';
import type { ProbeResultRequest, ProbeResultResponse } from '../src/probe-result.ts';
const fixture = JSON.parse(await readFile(new URL('../../../docs/protocol/fixtures/probe-result-v1.json', import.meta.url), 'utf8')) as {
    request: ProbeResultRequest; response: ProbeResultResponse; resultDigest: string;
    cases: { name: string; message: 'Request' | 'Response'; raw: string; valid: boolean }[];
};
test('Probe result shared TS/Go fixtures reject non-closed, unsafe and inconsistent observations', async t => {
    for (const entry of fixture.cases) await t.test(entry.name, () => {
        if (entry.valid) parseProbeResult(entry.message, entry.raw);
        else assert.throws(() => parseProbeResult(entry.message, entry.raw));
    });
});
test('Probe result digest is JCS over immutable measurement content, excluding only fresh correlation', () => {
    const input = parseProbeResult('Request', JSON.stringify(fixture.request));
    assert.ok(Object.isFrozen(input)); assert.ok(Object.isFrozen(input.binding));
    assert.equal(probeResultDigest(input), fixture.resultDigest);
    assert.equal(probeResultDigest({ ...input, requestId: 'd'.repeat(64) }), fixture.resultDigest);
    assert.notEqual(probeResultDigest({ ...input, elapsedMs: 11 }), fixture.resultDigest);
    checkProbeResult(input, fixture.response);
    for (const patch of [{ requestId: 'd'.repeat(64) }, { instanceGeneration: 2 }, { permitId: 'foreign' },
        { nodeId: 'foreign' }, { bootId: 'foreign' }, { sessionEpoch: 3 }, { instanceId: 'f'.repeat(64) },
        { resultDigest: 'sha256:' + 'f'.repeat(64) }, { acceptedAt: input.measuredAt.replace('.100Z', '.099Z') },
        { serverTime: input.validUntil }, { health: 'healthy' }, { executionEnabled: true }])
        assert.throws(() => checkProbeResult(input, { ...fixture.response, ...patch } as ProbeResultResponse));
});
