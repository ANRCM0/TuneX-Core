import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { checkProbeNegotiation, parseProbeNegotiation, parseRuntimeMessage } from '../src/index.ts';
import type { ProbeNegotiationRequest, ProbeNegotiationResponse } from '../src/index.ts';
const fixture = JSON.parse(readFileSync(new URL('../../../docs/protocol/fixtures/probe-negotiation-v1.json', import.meta.url),
    'utf8')) as { cases: { name: string; message: 'Request' | 'Response'; raw: string; valid: boolean }[] };
test('shared Probe v1 negotiation vectors agree without implying execution authority', () => {
    for (const entry of fixture.cases) {
        if (entry.valid) {
            const parsed = parseProbeNegotiation(entry.message, entry.raw);
            assert.ok(Object.isFrozen(parsed), entry.name);
        } else assert.throws(() => parseProbeNegotiation(entry.message, entry.raw), entry.name);
    }
});
test('recognition requires an exact Node, boot, session and random instance echo and rejects typed bypasses', () => {
    const request = parseProbeNegotiation('Request', fixture.cases[0]!.raw);
    const ack = parseProbeNegotiation('Response', fixture.cases[1]!.raw);
    assert.doesNotThrow(() => checkProbeNegotiation(request, ack));
    assert.equal(ack.executionEnabled, false);
    for (const patch of [{ nodeId: 'node-b' }, { bootId: 'boot-b' }, { sessionEpoch: 3 }, { instanceId: 'b'.repeat(64) },
        { executionEnabled: true }, { probeVersion: 2 }, { maxAttempts: 2 }, { permit: 'fake-permit' }])
        assert.throws(() => checkProbeNegotiation(request, { ...ack, ...patch } as ProbeNegotiationResponse));
    assert.throws(() => checkProbeNegotiation({ ...request, probeVersion: 2 } as unknown as ProbeNegotiationRequest, ack));
    assert.throws(() => parseRuntimeMessage('HelloResponse', JSON.stringify(ack)));
    assert.throws(() => parseRuntimeMessage('HelloRequest', JSON.stringify(request)));
});
