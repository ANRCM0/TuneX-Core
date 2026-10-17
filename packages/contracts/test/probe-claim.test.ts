import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { checkProbeClaim, parseProbeClaim, parseProbeInstance, parseProbeNegotiation } from '../src/index.ts';
import type { ProbeClaimRequest, ProbeClaimResponse } from '../src/index.ts';
const fixture = JSON.parse(readFileSync(new URL('../../../docs/protocol/fixtures/probe-claim-v1.json', import.meta.url), 'utf8')) as {
    cases: { name: string; message: 'Request' | 'Response'; raw: string; valid: boolean }[] };
test('Probe claim shared vectors enforce closed binding, safe counters, consumed times and disabled execution', () => {
    for (const entry of fixture.cases) {
        if (entry.valid) {
            const value = parseProbeClaim(entry.message, entry.raw);
            assert.ok(Object.isFrozen(value), entry.name);
            if (value.kind === 'probe-claim-ack') assert.ok(Object.isFrozen(value.binding));
        } else assert.throws(() => parseProbeClaim(entry.message, entry.raw), entry.name);
    }
});
test('Probe claim acknowledgement echoes each request identity and rejects typed or cross-protocol bypass', () => {
    const request = parseProbeClaim('Request', fixture.cases[0]!.raw), ack = parseProbeClaim('Response', fixture.cases[1]!.raw);
    checkProbeClaim(request, ack);
    for (const patch of [{ permitId: 'foreign' }, { instanceId: 'b'.repeat(64) }, { instanceGeneration: 2 },
        { nodeId: 'foreign', binding: { ...ack.binding, nodeId: 'foreign' } },
        { bootId: 'foreign', binding: { ...ack.binding, bootId: 'foreign' } },
        { sessionEpoch: 3, binding: { ...ack.binding, sessionEpoch: 3 } }, { executionEnabled: true }, { target: '127.0.0.1' }])
        assert.throws(() => checkProbeClaim(request, { ...ack, ...patch } as ProbeClaimResponse));
    assert.throws(() => checkProbeClaim({ ...request, permitId: 'bad\n' }, ack));
    assert.throws(() => checkProbeClaim({ ...request, target: '127.0.0.1' } as ProbeClaimRequest, ack));
    assert.throws(() => parseProbeInstance('Request', fixture.cases[0]!.raw));
    assert.throws(() => parseProbeNegotiation('Request', fixture.cases[0]!.raw));
});
