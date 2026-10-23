import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createControlApp } from '../src/api/public.ts';
import type { ControlApi, ControlHttpOptions } from '../src/api/public.ts';
import { ControlError } from '../src/framework/public.ts';
import { IdentityCredentials } from '../src/modules/identity-owner/public.ts';
import { nativeNodeSecrets } from '../src/infrastructure/identity-secrets.ts';
import { nativeIdentityCodec } from '../src/compatibility/public.ts';

const first = 'a'.repeat(64), next = 'b'.repeat(64);
function fixture() {
    const state = { hash: nativeNodeSecrets.tokenHash(first), events: [] as number[] };
    const tx = { original: true };
    const identity = { async authenticate(header: string | undefined) {
        const value = nativeIdentityCodec.bearer(header);
        if (!value || nativeNodeSecrets.tokenHash(value) !== state.hash) throw new ControlError('UNAUTHENTICATED', 401, 'Valid account required');
        return 'account-a';
    } };
    const credentials = new IdentityCredentials({ identity, db: { transaction: action => action(tx) },
        codec: nativeIdentityCodec, secrets: nativeNodeSecrets, now: () => 1790000000000,
        store: {
            async account(value) { assert.equal(value, tx); return { tokenHash: state.hash }; },
            async summary(value) { assert.equal(value, tx); return { eventCount: state.events.length, lastRotatedAt: state.events.at(-1) ?? null }; },
            async replaceCurrent(value, actor, old, replacement) { assert.equal(value, tx); assert.equal(actor, 'account-a'); if (old !== state.hash) return false; state.hash = replacement; return true; },
            async rotated(value, _eventId, actor, at) { assert.equal(value, tx); assert.equal(actor, 'account-a'); state.events.push(at); },
        } });
    const app = createControlApp({ control: { identity, accountCredentials: credentials } as unknown as ControlApi,
        runtime: {} as ControlHttpOptions['runtime'], authority: { allow: async () => undefined, read: async () => ({ maintenance: false }) } });
    const call = (method = 'GET', token = first, body?: string, suffix = '', cookie = false) => app.request('/api/v1/me/credentials' + suffix,
        { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(cookie ? { Cookie: 'session=unexpected' } : {}) },
            ...(body === undefined ? {} : { body }) });
    return { state, call };
}

test('account credential HTTP flow works without a Scope and keeps original bearer/no-store boundaries', async () => {
    const f = fixture(), metadata = await f.call();
    assert.equal(metadata.status, 200); assert.equal(metadata.headers.get('cache-control'), 'no-store');
    assert.equal((await metadata.json()).actorId, 'account-a');
    assert.equal((await f.call('GET', first, undefined, '', true)).status, 401);
    assert.equal((await f.call('GET', first, undefined, '?actorId=someone')).status, 422);
    const rotated = await f.call('PUT', first, JSON.stringify({ credentialVersion: 1, newToken: next }));
    assert.equal(rotated.status, 200); const result = await rotated.json(); assert.equal(result.changed, true);
    assert.doesNotMatch(JSON.stringify(result), /aaaaaaa|bbbbbbb|tokenHash|newToken/);
    assert.equal((await f.call()).status, 401);
    assert.equal((await f.call('GET', next)).status, 200);
    const replay = await f.call('PUT', next, JSON.stringify({ credentialVersion: 1, newToken: next }));
    assert.equal(replay.status, 200); assert.equal((await replay.json()).changed, false); assert.equal(f.state.events.length, 1);
});

test('credential HTTP mutation rejects identity overrides query parameters and oversized bodies before any account change', async () => {
    for (const body of [{ credentialVersion: 1, newToken: next, actorId: 'other' }, { credentialVersion: 1, newToken: next, scopeId: 'owned-scope' },
        { credentialVersion: 1, newToken: next, oldToken: first }, { credentialVersion: 2, newToken: next }]) {
        const f = fixture(); assert.equal((await f.call('PUT', first, JSON.stringify(body))).status, 422); assert.equal(f.state.events.length, 0);
    }
    const f = fixture();
    assert.equal((await f.call('PUT', first, JSON.stringify({ credentialVersion: 1, newToken: next }), '?scope=owned')).status, 422);
    assert.equal((await f.call('PUT', first, ' '.repeat(1025))).status, 413);
    assert.equal(f.state.hash, nativeNodeSecrets.tokenHash(first)); assert.equal(f.state.events.length, 0);
});
