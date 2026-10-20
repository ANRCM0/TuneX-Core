import assert from 'node:assert/strict';
import { test } from 'node:test';
import { holdPublishedSnapshot, reusePublishedSnapshot, publicationDeadline } from '../src/kernel/public.ts';

test('publication hold requires a live same-session lease beyond the exact five-second boundary', () => {
    const previous = { sessionEpoch: 2, validUntil: 16000 };
    const input = { sessionEpoch: 2, now: 10000, credentialUntil: 16000, withdrawn: false, awaitingClaim: 1, multihopPreserved: true };
    assert.equal(holdPublishedSnapshot(previous, input), true);
    assert.equal(holdPublishedSnapshot({ ...previous, validUntil: 15000 }, input), false);
    assert.equal(holdPublishedSnapshot(undefined, input), false);
    for (const change of [{ sessionEpoch: 3 }, { credentialUntil: 15999 }, { withdrawn: true }, { awaitingClaim: 0 }, { multihopPreserved: false }])
        assert.equal(holdPublishedSnapshot(previous, { ...input, ...change }), false);
});

test('publication reuse retains exact renewal and credential/Relay caps without importing host authority', () => {
    const previous = { sessionEpoch: 2, validUntil: 20000 };
    const input = { sessionEpoch: 2, now: 10000, credentialUntil: 20000, relayUntil: 20000, renewalLeadSeconds: 9, assignmentsUnchanged: true };
    assert.equal(reusePublishedSnapshot(previous, input), true);
    assert.equal(reusePublishedSnapshot(previous, { ...input, renewalLeadSeconds: 10 }), false);
    assert.equal(reusePublishedSnapshot(undefined, input), false);
    for (const change of [{ sessionEpoch: 1 }, { credentialUntil: 19999 }, { relayUntil: 19999 }, { assignmentsUnchanged: false }])
        assert.equal(reusePublishedSnapshot(previous, { ...input, ...change }), false);
});

test('publication deadline chooses the earliest authority and keeps the empty withdrawal policy deadline', () => {
    const input = { now: 10000, leaseSeconds: 300, credentialUntil: 30000, relayUntil: 20000, withdrawn: false };
    assert.equal(publicationDeadline(input), 20000);
    assert.equal(publicationDeadline({ ...input, credentialUntil: 15000 }), 15000);
    assert.equal(publicationDeadline({ ...input, relayUntil: 1000000, credentialUntil: 1000000 }), 310000);
    assert.equal(publicationDeadline({ ...input, credentialUntil: 0, relayUntil: 0, withdrawn: true }), 310000);
});
