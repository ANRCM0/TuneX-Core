import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { ControlError } from '../src/framework/public.ts';
import type { AccountCredentialStore, TransactionBoundary } from '../src/framework/public.ts';
import { IdentityCredentials, ACCOUNT_CREDENTIAL_EVENT_LIMIT } from '../src/modules/identity-owner/public.ts';

const first = 'a'.repeat(64), second = 'b'.repeat(64), third = 'c'.repeat(64);
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const bearer = (value: string) => 'Bearer ' + value;
const input = (newToken = second) => ({ credentialVersion: 1, newToken });
const code = (value: string) => (error: unknown) => (error as { code?: string }).code === value;
type Tx = { readonly original: true };

function fixture() {
    const tx: Tx = { original: true }, trace: string[] = [];
    const state = { tokenHash: hash(first), times: [] as number[], auditFails: false, conflict: false, afterAuth: null as (() => void) | null };
    let tail = Promise.resolve();
    const db: TransactionBoundary<Tx> = { async transaction(action) {
        const previous = tail; let release!: () => void;
        tail = new Promise<void>(resolve => { release = resolve; }); await previous;
        const before = { tokenHash: state.tokenHash, times: [...state.times] };
        trace.push('begin');
        try { const value = await action(tx); trace.push('commit'); return value; }
        catch (error) { state.tokenHash = before.tokenHash; state.times = before.times; trace.push('rollback'); throw error; }
        finally { release(); }
    } };
    const store: AccountCredentialStore<Tx> = {
        async account(value, actor, lock) { assert.equal(value, tx); assert.equal(actor, 'account-a'); trace.push(lock); return { tokenHash: state.tokenHash }; },
        async summary(value, actor) { assert.equal(value, tx); assert.equal(actor, 'account-a'); return { eventCount: state.times.length,
            lastRotatedAt: state.times.length ? Math.max(...state.times) : null }; },
        async replaceCurrent(value, actor, current, next) {
            assert.equal(value, tx); assert.equal(actor, 'account-a'); trace.push('cas');
            if (state.conflict) throw new ControlError('ACCOUNT_CREDENTIAL_CONFLICT', 409, 'Credential unavailable');
            if (state.tokenHash !== current) return false; state.tokenHash = next; return true;
        },
        async rotated(value, eventId, actor, at) { assert.equal(value, tx); assert.equal(actor, 'account-a'); assert.equal(eventId, 'event-a');
            trace.push('audit'); if (state.auditFails) throw Error('original audit failure'); state.times.push(at); },
    };
    const service = new IdentityCredentials({ db, store,
        identity: { async authenticate(header) {
            if (!header?.startsWith('Bearer ') || hash(header.slice(7)) !== state.tokenHash)
                throw new ControlError('UNAUTHENTICATED', 401, 'Valid bearer required');
            state.afterAuth?.(); return 'account-a';
        } }, codec: { bearer: header => header?.startsWith('Bearer ') ? header.slice(7) : undefined,
            validBearer: (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(value) },
        secrets: { tokenHash: hash, newID: () => 'event-a' }, now: () => 1790000000000 });
    return { service, state, trace };
}

test('self rotation updates the original account and own audit in one supplied transaction without returning secrets', async () => {
    const f = fixture();
    const value = await f.service.rotate(bearer(first), input());
    assert.equal(value.actorId, 'account-a'); assert.equal(value.changed, true);
    assert.equal(value.history.retained, 1); assert.equal(value.history.source, 'self-service-rotation');
    assert.equal(value.agentCredentialsChanged, false); assert.equal(f.state.tokenHash, hash(second));
    assert.deepEqual(f.trace, ['begin', 'update', 'cas', 'audit', 'commit']);
    assert.doesNotMatch(JSON.stringify(value), /aaaaaaa|bbbbbbb|tokenHash|newToken/);
    await assert.rejects(f.service.get(bearer(first)), code('UNAUTHENTICATED'));
    assert.equal((await f.service.get(bearer(second))).history.retained, 1);
});

test('an uncertain response can be checked with the same requested credential without another audit', async () => {
    const f = fixture(); await f.service.rotate(bearer(first), input());
    const value = await f.service.rotate(bearer(second), input());
    assert.equal(value.changed, false); assert.equal(value.history.retained, 1);
    assert.equal(f.trace.filter(step => step === 'cas').length, 1);
    assert.equal(f.trace.filter(step => step === 'audit').length, 1);
});

test('an authentication result captured before a competing change cannot rotate its successor', async () => {
    const f = fixture(); f.state.afterAuth = () => { f.state.tokenHash = hash(third); };
    await assert.rejects(f.service.rotate(bearer(first), input()), code('UNAUTHENTICATED'));
    assert.equal(f.state.tokenHash, hash(third)); assert.equal(f.state.times.length, 0);
    assert.equal(f.trace.includes('cas'), false);
});

test('two old-credential requests serialize at the original account and only one can change it', async () => {
    const f = fixture();
    const results = await Promise.allSettled([f.service.rotate(bearer(first), input(second)), f.service.rotate(bearer(first), input(third))]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    assert.equal(f.state.times.length, 1); assert.equal(f.trace.filter(step => step === 'cas').length, 1);
});

test('audit failure or duplicate credential rolls the account mutation back', async () => {
    for (const failure of ['auditFails', 'conflict'] as const) {
        const f = fixture(); f.state[failure] = true;
        await assert.rejects(f.service.rotate(bearer(first), input()));
        assert.equal(f.state.tokenHash, hash(first)); assert.equal(f.state.times.length, 0);
        assert.equal(f.trace.at(-1), 'rollback');
    }
});

test('retained event capacity refuses new rotation without evicting history and permits current-credential verification', async () => {
    const f = fixture(); f.state.times = Array(ACCOUNT_CREDENTIAL_EVENT_LIMIT).fill(1780000000000);
    await assert.rejects(f.service.rotate(bearer(first), input()), code('ACCOUNT_CREDENTIAL_CAPACITY'));
    assert.equal(f.state.tokenHash, hash(first)); assert.equal(f.state.times.length, 1024);
    assert.equal((await f.service.rotate(bearer(first), input(first))).changed, false);
});

test('caller identities unknown fields malformed versions and secrets never widen a self rotation', async () => {
    for (const value of [null, [], { ...input(), actorId: 'another-account' }, { ...input(), scopeId: 'owned-scope' },
        { ...input(), credentialVersion: 2 }, { credentialVersion: 1, newToken: 'invalid secret' }]) {
        const f = fixture(); await assert.rejects(f.service.rotate(bearer(first), value));
        assert.equal(f.state.tokenHash, hash(first)); assert.equal(f.state.times.length, 0);
    }
});
