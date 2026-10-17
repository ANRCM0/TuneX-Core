import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { checkProbeInstance, parseProbeInstance, parseProbeNegotiation } from '../src/index.ts';
import type { ProbeInstanceResponse } from '../src/index.ts';
const fixture = JSON.parse(readFileSync(new URL('../../../docs/protocol/fixtures/probe-instance-v1.json', import.meta.url), 'utf8')) as {
    cases: { name: string; message: 'Request' | 'Response'; raw: string; valid: boolean }[] };
test('Probe instance shared vectors enforce closed shapes, ownership state, times and disabled execution', () => {
    for (const entry of fixture.cases) {
        if (entry.valid) assert.ok(Object.isFrozen(parseProbeInstance(entry.message, entry.raw)), entry.name);
        else assert.throws(() => parseProbeInstance(entry.message, entry.raw), entry.name);
    }
});
test('Probe instance acknowledgement must echo the exact action, identity and generation, including typed inputs', () => {
    const request = parseProbeInstance('Request', fixture.cases[0]!.raw), ack = parseProbeInstance('Response', fixture.cases[1]!.raw);
    checkProbeInstance(request, ack);
    for (const patch of [{ nodeId: 'foreign' }, { bootId: 'boot-b' }, { sessionEpoch: 3 }, { action: 'inspect' },
        { expectedGeneration: 1, generation: 2 }, { instanceId: 'b'.repeat(64), currentInstanceId: 'b'.repeat(64) },
        { executionEnabled: true }, { permit: 'forged' }])
        assert.throws(() => checkProbeInstance(request, { ...ack, ...patch } as ProbeInstanceResponse));
    assert.throws(() => checkProbeInstance({ ...request, action: 'unknown' } as never, ack));
    assert.throws(() => parseProbeNegotiation('Request', JSON.stringify(request)));
});
