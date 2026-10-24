import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { checkProbePoll, checkProbeStatus, parseProbeDelivery, parseProbeClaim, parseProbeInstance, parseProbeNegotiation } from '../src/index.ts';
import type { ProbePollRequest, ProbePollResponse, ProbeStatusRequest, ProbeStatusResponse } from '../src/index.ts';
const fixture = JSON.parse(readFileSync(new URL('../../../packages/contracts/fixtures/probe-delivery-v1.json', import.meta.url), 'utf8')) as {
    cases: { name: string; message: 'PollRequest' | 'PollResponse' | 'StatusRequest' | 'StatusResponse'; raw: string; valid: boolean }[] };
test('Probe delivery shared vectors enforce closed singleton offers, safe identity/binding and bounded observations', () => {
    for (const entry of fixture.cases) {
        if (entry.valid) {
            const value = parseProbeDelivery(entry.message, entry.raw);
            assert.ok(Object.isFrozen(value), entry.name);
            if (value.kind === 'probe-poll-ack' && value.offer) {
                assert.ok(Object.isFrozen(value.offer)); assert.ok(Object.isFrozen(value.offer.binding));
            }
            if (value.kind === 'probe-status-ack') assert.ok(Object.isFrozen(value.binding));
        } else assert.throws(() => parseProbeDelivery(entry.message, entry.raw), entry.name);
    }
});
test('Probe delivery checks reparse typed values, echo every association and distinguish poll, claim and status', () => {
    const poll = parseProbeDelivery('PollRequest', fixture.cases[0]!.raw), offer = parseProbeDelivery('PollResponse', fixture.cases[1]!.raw);
    const status = parseProbeDelivery('StatusRequest', fixture.cases[2]!.raw), ack = parseProbeDelivery('StatusResponse', fixture.cases[3]!.raw);
    checkProbePoll(poll, offer); checkProbeStatus(status, ack);
    for (const patch of [{ nodeId: 'foreign' }, { bootId: 'foreign' }, { sessionEpoch: 3 }, { instanceId: 'b'.repeat(64) },
        { instanceGeneration: 2 }, { requestId: 'd'.repeat(64) }, { executionEnabled: true }, { target: '127.0.0.1' }]) {
        assert.throws(() => checkProbePoll(poll, { ...offer, ...patch } as ProbePollResponse));
        assert.throws(() => checkProbeStatus(status, { ...ack, ...patch } as ProbeStatusResponse));
    }
    assert.throws(() => checkProbeStatus(status, { ...ack, permitId: 'foreign' }));
    assert.throws(() => checkProbePoll({ ...poll, permitId: 'permit-a' } as ProbePollRequest, offer));
    assert.throws(() => checkProbeStatus({ ...status, target: '127.0.0.1' } as ProbeStatusRequest, ack));
    for (const entry of fixture.cases.slice(0, 4)) {
        for (const message of ['PollRequest', 'PollResponse', 'StatusRequest', 'StatusResponse'] as const)
            if (message !== entry.message) assert.throws(() => parseProbeDelivery(message, entry.raw));
        assert.throws(() => parseProbeClaim('Request', entry.raw));
        assert.throws(() => parseProbeInstance('Request', entry.raw));
        assert.throws(() => parseProbeNegotiation('Request', entry.raw));
    }
});
