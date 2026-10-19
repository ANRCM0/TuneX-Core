import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { MAX_COUNTER } from '@tunex/core';
import { digest as wireDigest } from '@tunex/contracts/shared';
import { nativeValueDigest } from '../src/compatibility/public.ts';
import { TransportGrantCommands as Legacy } from '../src/application/transport-grants.ts';
import type { TransportGrantResponse as LegacyResponse } from '../src/application/transport-grants.ts';
import { TransportGrantCommands as Public, TRANSPORT_GRANT_INTERFACE_VERSION } from '../src/modules/transport-owner/public.ts';
import type { TransportGrantApi, TransportGrantResponse, TransportGrantCommand, TransportGrantState, TransportGrantWriter,
    TransportGrantEffects } from '../src/modules/transport-owner/public.ts';
import { TransportGrantCommands } from '../src/modules/transport-owner/grant-commands.ts';
import type { TransportGrantResponse as CanonicalResponse } from '../src/modules/transport-owner/grant-api.ts';
import type { TransportGrantCommand as LegacyCommand, TransportGrantState as LegacyState, TransportGrantWriter as LegacyWriter,
    TransportGrantEffects as LegacyEffects } from '../src/modules/transport-ports.ts';
import type { TransportGrantCommand as CanonicalCommand, TransportGrantState as CanonicalState } from '../src/modules/transport-owner/contracts.ts';
import type { RequestIdentity, TransactionBoundary, ScopeOwnerAuthorization, IdempotentRequests } from '../src/framework/public.ts';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
const typeContract: [Equal<LegacyResponse, TransportGrantResponse>, Equal<CanonicalResponse, TransportGrantResponse>,
    Equal<TransportGrantCommands<object>['change'], TransportGrantApi['change']>,
    Equal<Parameters<TransportGrantWriter<object>['applyGrant']>, [object, TransportGrantCommand]>,
    Equal<Parameters<TransportGrantEffects<object>['reconcile']>, [object, RequestIdentity, TransportGrantState]>] = [true, true, true, true, true];
type Tx = Readonly<{ id: symbol }>;
function fixture() {
    const tx: Tx = Object.freeze({ id: Symbol('original') }), events: string[] = [];
    const failure = new Error('provider failure');
    const options = { changed: true, fail: '', replay: undefined as TransportGrantResponse | undefined };
    let state = { grantWrites: 0, effectWrites: 0, receiptWrites: 0 };
    let capturedCommand: TransportGrantCommand | undefined, capturedRequest: RequestIdentity | undefined;
    let responded: TransportGrantResponse | undefined;
    const operations = ['operation'];
    const grant: TransportGrantState = { profileId: 'profile', actorId: 'member', revision: 2, allowed: false, changed: true };
    const record = (actual: Tx, name: string) => { assert.equal(actual, tx); events.push(name); if (options.fail === name) throw failure; };
    const db: TransactionBoundary<Tx> = {
        async transaction(action) {
            assert.equal(this, db); events.push('begin'); const before = { ...state };
            try { const value = await action(tx); events.push('commit'); return value; }
            catch (error) { state = before; events.push('rollback'); throw error; }
        },
    };
    const identity: ScopeOwnerAuthorization<Tx> = {
        async owner(actual, actor, scope) { assert.equal(this, identity); assert.deepEqual([actor, scope], ['owner', 'scope']); record(actual, 'owner'); },
    };
    const requests: IdempotentRequests<Tx> = {
        async claim<R>(actual: Tx, request: RequestIdentity) {
            assert.equal(this, requests); record(actual, 'claim'); capturedRequest = request;
            assert.ok(Object.isFrozen(request)); return options.replay as R | undefined;
        },
        async respond(actual, request, response) {
            assert.equal(this, requests); assert.equal(request, capturedRequest); state.receiptWrites++;
            responded = response as TransportGrantResponse; record(actual, 'respond');
        },
    };
    const writer: TransportGrantWriter<Tx> = {
        async applyGrant(actual, command) {
            assert.equal(this, writer); capturedCommand = command; assert.ok(Object.isFrozen(command));
            state.grantWrites++; record(actual, 'apply'); return { ...grant, changed: options.changed };
        },
    };
    const effects: TransportGrantEffects<Tx> = {
        async reconcile(actual, request, supplied) {
            assert.equal(this, effects); assert.equal(request, capturedRequest);
            assert.deepEqual(supplied, grant); state.effectWrites++; record(actual, 'reconcile'); return operations;
        },
    };
    const host = new TransportGrantCommands(db, identity, requests, writer, effects);
    const change = () => host.change('owner', 'scope', 'profile', 'member', 'key', 1, false);
    return { db, identity, requests, writer, effects, host, options, events, failure, operations, change,
        state: () => state, command: () => capturedCommand, request: () => capturedRequest, responded: () => responded };
}

test('readiness98 exact public/legacy class, API response/port aliases and constructor method surface', () => {
    assert.equal(Legacy, TransportGrantCommands); assert.equal(Public, TransportGrantCommands);
    assert.deepEqual(typeContract, [true, true, true, true, true]);
    const portTypes: [Equal<LegacyCommand, CanonicalCommand>, Equal<LegacyState, CanonicalState>,
        Equal<LegacyWriter<object>, TransportGrantWriter<object>>, Equal<LegacyEffects<object>, TransportGrantEffects<object>>] = [true, true, true, true];
    assert.deepEqual(portTypes, [true, true, true, true]);
    assert.equal(nativeValueDigest, wireDigest);
    assert.equal(TRANSPORT_GRANT_INTERFACE_VERSION, 1); assert.equal(TransportGrantCommands.length, 5);
    assert.deepEqual(Object.getOwnPropertyNames(TransportGrantCommands.prototype), ['constructor', 'change']);
    const f = fixture(); const api: TransportGrantApi = f.host; assert.equal(api, f.host);
    assert.equal(Object.hasOwn(f.host, 'change'), false);
});

test('required reconcile effects refuse construction without touching any provider', () => {
    const f = fixture();
    for (const effects of [undefined, null, {}, { reconcile: undefined }, { reconcile: 1 }])
        assert.throws(() => new TransportGrantCommands(f.db, f.identity, f.requests, f.writer, effects as never),
            { message: 'Profile grant execution effects are required' });
    assert.deepEqual(f.events, []);
    const failure = new Error('effects getter');
    assert.throws(() => new TransportGrantCommands(f.db, f.identity, f.requests, f.writer,
        { get reconcile() { throw failure; } } as never), error => error === failure);
    assert.deepEqual(f.events, []);
});

test('native digest frame, command/request key order, frozen identity and original provider receivers', async () => {
    const f = fixture(), result = await f.change();
    assert.deepEqual(f.command(), { actorId: 'owner', scopeId: 'scope', profileId: 'profile', subject: 'member', expectedRevision: 1, allowed: false });
    assert.deepEqual(Object.keys(f.command()!), ['actorId', 'scopeId', 'profileId', 'subject', 'expectedRevision', 'allowed']);
    assert.deepEqual(f.request(), { actorId: 'owner', scopeId: 'scope', key: 'key', digest: nativeValueDigest({ method: 'PUT',
        path: '/api/v1/scopes/scope/transport-profiles/profile/grants/member', expectedRevision: 1, allowed: false }) });
    assert.deepEqual(Object.keys(f.request()!), ['actorId', 'scopeId', 'key', 'digest']);
    assert.equal(Object.isFrozen(f.command()), true); assert.equal(Object.isFrozen(f.request()), true);
    assert.deepEqual(f.events, ['begin', 'owner', 'claim', 'apply', 'reconcile', 'respond', 'commit']);
    assert.equal(result, f.responded()); assert.equal(result.body.operationIds, f.operations);
    assert.deepEqual(Object.keys(result), ['status', 'body']);
    assert.deepEqual(Object.keys(result.body), ['profileId', 'actorId', 'revision', 'allowed', 'changed', 'operationIds']);
    assert.equal(result.status, 202); assert.equal(Object.isFrozen(result), false);
});

test('unchanged grant returns 200, persists receipt and never reconciles; replay keeps exact response identity', async () => {
    const f = fixture(); f.options.changed = false;
    const unchanged = await f.change();
    assert.equal(unchanged.status, 200); assert.deepEqual(unchanged.body.operationIds, []);
    assert.deepEqual(f.events, ['begin', 'owner', 'claim', 'apply', 'respond', 'commit']);
    assert.deepEqual(f.state(), { grantWrites: 1, effectWrites: 0, receiptWrites: 1 });
    const replay = fixture(); replay.options.replay = unchanged;
    assert.equal(await replay.change(), unchanged);
    assert.deepEqual(replay.events, ['begin', 'owner', 'claim', 'commit']);
    assert.deepEqual(replay.state(), { grantWrites: 0, effectWrites: 0, receiptWrites: 0 });
    replay.options.fail = 'owner'; replay.events.length = 0;
    await assert.rejects(replay.change(), error => error === replay.failure);
    assert.deepEqual(replay.events, ['begin', 'owner', 'rollback']);
});

for (const failed of ['owner', 'claim', 'apply', 'reconcile', 'respond']) {
    test(`original ${failed} failure stops the sequence and rolls back all original transaction effects`, async () => {
        const f = fixture(); f.options.fail = failed;
        await assert.rejects(f.change(), error => error === f.failure);
        const sequence = ['begin', 'owner', 'claim', 'apply', 'reconcile', 'respond'];
        assert.deepEqual(f.events, [...sequence.slice(0, sequence.indexOf(failed) + 1), 'rollback']);
        assert.deepEqual(f.state(), { grantWrites: 0, effectWrites: 0, receiptWrites: 0 });
        f.options.fail = ''; f.events.length = 0;
        assert.equal((await f.change()).status, 202);
        assert.deepEqual(f.events, ['begin', 'owner', 'claim', 'apply', 'reconcile', 'respond', 'commit']);
    });
}

test('validation preserves actual actor/scope/profile/subject/revision/Boolean/key order before digest or transaction', async () => {
    const f = fixture();
    type Args = Parameters<TransportGrantApi['change']>;
    const good: Args = ['owner', 'scope', 'profile', 'member', 'key', 1, false];
    const poison = { toString() { throw new Error('key conversion reached'); } };
    // A truthy non-string key reaches RegExp coercion only after every preceding field check.
    for (const [index, value] of [[0, ''], [1, ''], [2, ''], [3, ''], [5, 0], [6, null]] as const) {
        const args = [...good] as Args; args[index] = value as never; args[4] = poison as never;
        await assert.rejects(f.host.change(...args), { code: 'INVALID_CONFIG', status: 422, message: 'Valid Profile grant command required' });
    }
    await assert.rejects(f.host.change('owner', 'scope', 'profile', 'member', poison as never, 1, false), /key conversion reached/);
    for (const index of [0, 1, 2, 3]) for (const value of [null, 1, '', '../bad', 'a'.repeat(129), 'bad\n']) {
        const args = [...good] as Args; args[index] = value as never;
        await assert.rejects(f.host.change(...args), { code: 'INVALID_CONFIG' });
    }
    for (const revision of [0, -1, 0.5, MAX_COUNTER + 1, NaN, Infinity, '1', null])
        await assert.rejects(f.host.change('owner', 'scope', 'profile', 'member', 'key', revision as number, false), { code: 'INVALID_CONFIG' });
    for (const allowed of [undefined, null, 0, 1, 'false'])
        await assert.rejects(f.host.change('owner', 'scope', 'profile', 'member', 'key', 1, allowed as unknown as boolean), { code: 'INVALID_CONFIG' });
    for (const key of [undefined, '', ' ', 'bad key', '\n', '\x7f', 'é', 'a'.repeat(129)])
        await assert.rejects(f.host.change('owner', 'scope', 'profile', 'member', key, 1, false), { code: 'INVALID_CONFIG' });
    assert.deepEqual(f.events, []);
    for (const key of ['!', '~', 'a'.repeat(128)]) {
        const boundary = fixture();
        assert.equal((await boundary.host.change('owner', 'scope', 'profile', 'member', key, MAX_COUNTER, true)).status, 202);
        assert.equal(boundary.command()!.expectedRevision, MAX_COUNTER); assert.equal(boundary.command()!.allowed, true);
    }
});

test('canonical command imports original digest and actual current consumer wires exact supplied owners', async () => {
    const canonical = await readFile(new URL('../src/modules/transport-owner/grant-commands.ts', import.meta.url), 'utf8');
    assert.match(canonical, /import \{ nativeValueDigest as digest \} from '\.\.\/\.\.\/compatibility\/public\.ts'/);
    assert.match(canonical, /!isId\(actorId\) \|\| !isId\(scopeId\) \|\| !isId\(profileId\) \|\| !isId\(subject\) \|\| !isCounter\(expectedRevision\) \|\|\s*typeof allowed !== 'boolean' \|\| !key/);
    assert.doesNotMatch(canonical, /buildRequestIdentity|nativeCommandRequest|Date\.|randomUUID|createPool/);
    const composition = await readFile(new URL('../src/application/control.ts', import.meta.url), 'utf8');
    assert.match(composition, /this\.profileGrants=new TransportGrantCommands\(db,identity,this\.idempotency,this\.transport,/);
    const routes = await readFile(new URL('../src/api/routes.ts', import.meta.url), 'utf8');
    assert.match(routes, /control\.profileGrants\.change\(c\.get\('actor'\),scope\(c\.req\.param\('scope'\)\),c\.req\.param\('profile'\),c\.req\.param\('actor'\),c\.req\.header\('idempotency-key'\),input\.expectedRevision,input\.allowed\)/);
    const legacy = await readFile(new URL('../src/application/transport-grants.ts', import.meta.url), 'utf8');
    assert.match(legacy, /^export \{ TransportGrantCommands \} from '\.\.\/modules\/transport-owner\/grant-commands\.ts';/);
});
