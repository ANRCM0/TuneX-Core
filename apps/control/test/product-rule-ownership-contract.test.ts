import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Forward, ForwardSpec } from '@tunex/core';
import { ForwardCommands, nativeForwardAdapters } from '../src/modules/forward-owner/public.ts';
import type { ForwardNodeAuthorization } from '../src/modules/node-owner/public.ts';
import type { ForwardCommandPreparation, ForwardOperationCommands, ForwardWriter } from '../src/modules/forward-owner/public.ts';
import { ControlError } from '../src/framework/public.ts';
import type { AuthorizedNodeFacts, CommandResponse, IdempotentRequests, ResourceReadAccess, ScopeAuthorization, ScopeOwnerAuthorization, TransactionBoundary } from '../src/framework/public.ts';
import { MySqlPathTemplateStore } from '../src/infrastructure/mysql-path-template-store.ts';
import { MySqlPathGroupStore, MySqlPathGroupBindingStore } from '../src/infrastructure/mysql-path-group-store.ts';
import { MySqlPathBindingStore } from '../src/infrastructure/mysql-path-binding-store.ts';
import { MySqlPathPublicationStore } from '../src/infrastructure/mysql-publication-store.ts';
import { MySqlForwardIntentStore } from '../src/infrastructure/mysql-intent-store.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import { pathPublicationStorageValues } from '../src/modules/path-owner/public.ts';

type Tx = Readonly<{ marker: symbol }>;
const spec = (): ForwardSpec => ({ enabled: true, protocols: ['tcp'], ingress: { nodeId: 'node', listen: { address: '127.0.0.1', port: 23001 } }, target: { host: '127.0.0.1', port: 80 } });

function fixture(ownerActorId: string | null, governance = false) {
    const tx: Tx = { marker: Symbol('original-transaction') }, events: string[] = [];
    let forward: Forward = { id: 'forward', scopeId: 'scope', revision: 1, spec: spec() }, authorizer = 'original-executor';
    const options = { visible: true, replay: undefined as CommandResponse | undefined };
    const check = (value: Tx) => assert.equal(value, tx);
    const db: TransactionBoundary<Tx> = { async transaction(action) { return action(tx); } };
    const auth: ScopeAuthorization<Tx> & ScopeOwnerAuthorization<Tx> = { async scope(value) { check(value); }, async owner(value) { check(value); } };
    const access: ResourceReadAccess<Tx> = {
        async principal(value, actorId) { check(value); return { actorId, governance }; },
        async forward(value) { check(value); if (!options.visible) throw new ControlError('AUTHORIZATION_DENIED', 403, 'Current visibility denied'); },
        async node() { throw new Error('Unused'); },
        async owned(value, actor, scope, kind, id, allowGovernance = false) {
            check(value); assert.equal(scope, 'scope'); assert.equal(kind, 'forward'); assert.equal(id, 'forward');
            events.push('ownership');
            if (ownerActorId !== actor && !(allowGovernance && governance)) throw new ControlError('AUTHORIZATION_DENIED', 403, 'Ownership denied');
        },
    };
    const requests: IdempotentRequests<Tx> = {
        async claim<R extends CommandResponse>(value: Tx) { check(value); return options.replay as R | undefined; },
        async respond(value) { check(value); events.push('respond'); },
    };
    const writer: ForwardWriter<Tx> = {
        async record(value) { check(value); return { ...forward, ownerActorId, deleting: false, recoverySuspended: false }; },
        async ownershipForUpdate(value) { check(value); return forward; },
        async currentForUpdate(value) { check(value); return forward; },
        async insert() { throw new Error('Unused'); },
        async classifyOwner() { throw new Error('Unused'); },
        async replace(value, _current, next) { check(value); events.push('replace'); forward = next; },
        async setAuthorizer(value, _id, actor) { check(value); events.push('authorizer'); authorizer = actor; },
        async markDeleting(value) { check(value); events.push('delete'); },
    };
    const operations: ForwardOperationCommands<Tx> = {
        async read(value) { check(value); return { forward_id: 'forward' }; },
        async get(value) { check(value); return { id: 'operation', target_revision: 1, status: 'failed', recovery_invalidated: 0, previous_spec: null }; },
        async accept(value, _forward, _request, kind) { check(value); events.push('operation:' + kind); return 'accepted'; },
    };
    const preparation: ForwardCommandPreparation<Tx> = {
        async lockOwnership(value) { check(value); },
        async prepareCreate() { throw new Error('Unused'); }, async planCreate() { throw new Error('Unused'); },
        async prepareUpdate(value) { check(value); events.push('prepare'); }, async planUpdate(value) { check(value); },
        async lock(value) { check(value); }, async lockRemoval(value) { check(value); events.push('removal-lock'); },
        async prepareRetry(value) { check(value); events.push('retry'); }, async assertCapacity(value) { check(value); },
    };
    return { service: new ForwardCommands(db, auth, access, requests, writer, operations, preparation, () => 'new-forward'),
        options, events, state: () => ({ forward, authorizer }) };
}

test('business owner is required for replacement, retry and legacy use even with Scope management', async () => {
    for (const owner of ['other', null]) {
        const f = fixture(owner);
        await assert.rejects(f.service.update('actor', 'scope', 'forward', 'update', 1, { ...spec(), target: { host: '127.0.0.1', port: 81 } }), { code: 'AUTHORIZATION_DENIED' });
        await assert.rejects(f.service.retry('actor', 'scope', 'retry', 'operation', 1), { code: 'AUTHORIZATION_DENIED' });
        assert.ok(!f.events.includes('prepare')); assert.ok(!f.events.includes('replace')); assert.ok(!f.events.includes('retry'));
        assert.equal(f.state().authorizer, 'original-executor');
    }
});

test('governance can only stop unchanged business configuration and cannot take execution authorization', async () => {
    const f = fixture('other', true);
    await assert.rejects(f.service.update('actor', 'scope', 'forward', 'retarget', 1, { ...spec(), enabled: false, target: { host: '127.0.0.1', port: 81 } }), { code: 'AUTHORIZATION_DENIED' });
    await f.service.update('actor', 'scope', 'forward', 'stop', 1, { ...spec(), enabled: false });
    assert.equal(f.state().forward.spec.enabled, false); assert.equal(f.state().authorizer, 'original-executor');
    assert.ok(f.events.includes('operation:disable')); assert.ok(!f.events.includes('authorizer'));
    await assert.rejects(f.service.update('actor', 'scope', 'forward', 'enable', 2, spec()), { code: 'AUTHORIZATION_DENIED' });
    await assert.rejects(f.service.retry('actor', 'scope', 'retry', 'operation', 2), { code: 'AUTHORIZATION_DENIED' });
});

test('governance removal and current replay visibility use the original Forward transaction', async () => {
    const f = fixture('other', true);
    await f.service.remove('actor', 'scope', 'forward', 'remove', 1);
    assert.ok(f.events.indexOf('ownership') < f.events.indexOf('removal-lock')); assert.ok(f.events.includes('operation:delete'));
    f.options.replay = { status: 202, body: { forwardId: 'forward', revision: 2, operationId: 'accepted' } };
    f.options.visible = false;
    await assert.rejects(f.service.remove('actor', 'scope', 'forward', 'remove', 1), { code: 'AUTHORIZATION_DENIED' });
});

test('ordered Relay locks retain ingress, transit and egress roles from the unsorted path', async () => {
    const uses: { node: string; role: string }[] = [], locks: string[] = [];
    const nodes: ForwardNodeAuthorization<Tx> = {
        async authorized() { throw new Error('Direct authorization is not a Relay entry'); },
        async state() { return { revoked: false }; },
        async authorizedRelayNode(_tx, _actor, _scope, node, role) {
            uses.push({ node, role }); return { nodeId: node } as AuthorizedNodeFacts;
        },
    };
    const adapters = nativeForwardAdapters(nodes, {
        async lockNode(_tx, node) { locks.push(node); }, async lockOwnership(){throw new Error('No ownership classification in this fixture');}, async reserve() { return []; }, async transition() { return []; },
    }, { async lockNodes() {}, async canExecute() { return true; }, async acceptPlan() {} }, { async lock() {} });
    const forward: Forward = { id: 'forward', scopeId: 'scope', revision: 1,
        spec: { ...spec(), ingress: { ...spec().ingress, nodeId: 'z-ingress' }, path: { via: ['a-transit', 'm-egress'] }, transport: { profileId: 'profile', configRevision: 1 } } };
    await adapters.find(adapter => adapter.id === 'native.multihop.v1')!.prepareCreate({ marker: Symbol() }, 'actor', forward);
    assert.deepEqual(uses, [{ node: 'a-transit', role: 'transit' }, { node: 'm-egress', role: 'egress' }, { node: 'z-ingress', role: 'ingress' }]);
    assert.deepEqual(locks, ['a-transit', 'm-egress', 'z-ingress']);
});

function sqlTransaction() {
    const calls: { sql: string; args: unknown[] }[] = [];
    const tx = { async execute(sql: string, args: unknown[] = []) {
        calls.push({ sql, args });
        return [sql.startsWith('SELECT COUNT(*)') ? [{ n: 0 }] : sql.startsWith('SELECT') ? [] : { affectedRows: 1 }];
    } } as unknown as Transaction;
    return { tx, calls };
}

test('Path list and reference count/page queries apply identical ownership predicates before pagination', async () => {
    const principal = { actorId: 'actor', governance: false }, page = { page: 2, limit: 10, offset: 10 };
    const actions: [(tx: Transaction) => Promise<unknown>, RegExp][] = [
        [tx => new MySqlPathTemplateStore().list(tx, 'scope', principal, page, 'prefix'), /owner_actor_id=\?/],
        [tx => new MySqlPathGroupStore().list(tx, 'scope', principal, page, 'prefix'), /owner_actor_id=\?/],
        [tx => new MySqlPathBindingStore().references(tx, 'scope', principal, 'template', page, 1), /owner_actor_id=\?/],
        [tx => new MySqlPathGroupBindingStore().references(tx, 'scope', principal, 'group', page, 1), /owner_actor_id=\?/],
        [tx => new MySqlPathPublicationStore(pathPublicationStorageValues).list(tx, 'scope', principal, page), /created_by=\?/],
    ];
    for (const [action, ownership] of actions) {
        const { tx, calls } = sqlTransaction(); await action(tx); assert.equal(calls.length, 2);
        assert.match(calls[0]!.sql, ownership); assert.match(calls[1]!.sql, ownership);
        assert.deepEqual(calls[0]!.args, calls[1]!.args); assert.ok(calls[0]!.args.includes('actor'));
        assert.match(calls[1]!.sql, /ORDER BY .* LIMIT 10 OFFSET 10$/);
    }
});

test('new Forward writes immutable business ownership alongside its independent execution authorizer', async () => {
    const { tx, calls } = sqlTransaction();
    await new MySqlForwardIntentStore().insertCurrent(tx, 'forward', 'scope', 1, '{}', 'actor');
    assert.match(calls[0]!.sql, /authorization_actor,owner_actor_id/);
    assert.deepEqual(calls[0]!.args, ['forward', 'scope', 1, '{}', 'actor', 'actor']);
    await new MySqlForwardIntentStore().setAuthorizer(tx, 'successor', 'forward');
    assert.doesNotMatch(calls[1]!.sql, /owner_actor_id/);
});
