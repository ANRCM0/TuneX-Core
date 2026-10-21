import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ForwardSpec } from '@tunex/core';
import { ControlError } from '../src/framework/public.ts';
import type { CommandResponse, ForwardIntentStore, IdempotentRequests, RequestIdentity, ResourceReadAccess, ScopeAuthorization,
    ScopeOwnerAuthorization, TransactionBoundary } from '../src/framework/public.ts';
import { ForwardCommands, ForwardStateService } from '../src/modules/forward-owner/public.ts';
import type { ForwardCommandPreparation, ForwardOperationCommands } from '../src/modules/forward-owner/public.ts';
import { PathTemplateCommands, PathGroups } from '../src/modules/path-owner/public.ts';
import type { PathTemplateWriter, PathGroupWriter } from '../src/modules/path-owner/public.ts';
import { MySqlForwardIntentStore } from '../src/infrastructure/mysql-intent-store.ts';
import { MySqlPathTemplateStore } from '../src/infrastructure/mysql-path-template-store.ts';
import { MySqlPathGroupStore } from '../src/infrastructure/mysql-path-group-store.ts';
import type { Transaction } from '../src/infrastructure/mysql.ts';

type Tx = Readonly<{ marker: symbol }>;
type Kind = 'forward' | 'path-template' | 'path-group';
const spec = (): ForwardSpec => ({ enabled: true, protocols: ['tcp'], ingress: { nodeId: 'private-node', listen: { address: '127.0.0.1', port: 23001 } }, target: { host: '127.0.0.1', port: 80 } });
const unused = async (): Promise<never> => { throw new Error('Classification must not invoke configuration or execution work'); };

function fixture(kind: Kind) {
    const tx: Tx = { marker: Symbol('owner-classification-transaction') }, calls: string[] = [];
    let state = { ownerActorId: null as string | null, revision: 7, spec: spec(), authorizer: 'historical-authorizer',
        deleting: true, recoverySuspended: true, archived: true };
    let audits: { actor: string; owner: string; revision: number; at: number }[] = [];
    let replies = new Map<string, { digest: string; response?: CommandResponse }>();
    const history = Object.freeze(['immutable-revisions', 'Agent-Journal', 'Runtime-authority', 'original-provenance']);
    const options = { managers: new Set(['new-owner']), casLost: false, failAudit: false, failRespond: false };
    const check = (value: Tx) => assert.equal(value, tx);
    const db: TransactionBoundary<Tx> = { async transaction(action) {
        const before = structuredClone({ state, audits, replies });
        try { return await action(tx); } catch (error) { ({ state, audits, replies } = before); throw error; }
    } };
    const auth: ScopeAuthorization<Tx> & ScopeOwnerAuthorization<Tx> = {
        async owner(value, actor, scope) {
            check(value); calls.push('scope-owner'); assert.equal(scope, 'scope');
            if (actor !== 'administrator') throw new ControlError('AUTHORIZATION_DENIED', 403, 'Only Scope owner classifies');
        },
        async scope(value, actor, scope, manage) {
            check(value); calls.push('new-owner-membership'); assert.equal(scope, 'scope'); assert.equal(manage, true);
            if (!options.managers.has(actor)) throw new ControlError('AUTHORIZATION_DENIED', 403, 'Current Scope manager required');
        },
    };
    const requests: IdempotentRequests<Tx> = {
        async claim<R extends CommandResponse>(value: Tx, request: RequestIdentity) {
            check(value); calls.push('claim'); const previous = replies.get(request.key);
            if (previous && previous.digest !== request.digest) throw new ControlError('IDEMPOTENCY_CONFLICT', 409, 'Different classification');
            if (!previous) replies.set(request.key, { digest: request.digest });
            return previous?.response as R | undefined;
        },
        async respond(value, request, response) {
            check(value); calls.push('respond'); if (options.failRespond) throw new Error('response persistence failed');
            replies.get(request.key)!.response = structuredClone(response);
        },
    };
    const access: ResourceReadAccess<Tx> = {
        async principal(value, actorId) { check(value); return { actorId, governance: true }; },
        async forward(value) { check(value); calls.push('replay-visible'); },
        async owned(value, _actor, _scope, resourceKind, id, allowGovernance) {
            check(value); assert.equal(resourceKind, kind); assert.equal(id, 'legacy'); assert.equal(allowGovernance, true); calls.push('replay-visible');
        },
        node: unused,
    };
    const classify = async (value: Tx, scope: string, id: string, expected: number, owner: string) => {
        check(value); calls.push('cas'); assert.equal(scope, 'scope'); assert.equal(id, 'legacy');
        if (options.casLost || state.ownerActorId !== null || state.revision !== expected) return 0;
        state.ownerActorId = owner; return 1;
    };
    const audit = async (value: Tx, scope: string, id: string, actor: string, owner: string, revision: number, at: number) => {
        check(value); calls.push('audit'); assert.equal(scope, 'scope'); assert.equal(id, 'legacy');
        if (options.failAudit) throw new Error('audit persistence failed');
        audits.push({ actor, owner, revision, at });
    };
    const head = (value: Tx, lock?: boolean) => { check(value); assert.equal(lock, true); calls.push('head-lock'); };
    const templateStore: PathTemplateWriter<Tx> = {
        async lockScope(value) { check(value); calls.push('scope-lock'); }, count: unused,
        async head(value, _scope, id, lock) { head(value, lock); return { templateId: id, ownerActorId: state.ownerActorId, currentRevision: state.revision, archived: state.archived }; },
        revision: unused, list: unused, publish: unused, archive: unused, audit: unused,
        classifyOwner: classify, auditOwnership: audit,
    };
    const groupStore: PathGroupWriter<Tx> = {
        async lockScope(value) { check(value); calls.push('scope-lock'); }, count: unused,
        async head(value, _scope, id, lock) { head(value, lock); return { groupId: id, ownerActorId: state.ownerActorId, currentRevision: state.revision, archived: state.archived }; },
        revision: unused, list: unused, publish: unused, archive: unused, audit: unused,
        classifyOwner: classify, auditOwnership: audit,
    };
    const intentStore: ForwardIntentStore<Tx> = {
        revisions: unused, quarantine: unused, liveProfileCount: unused, liveNodeCount: unused, forNode: unused,
        forReferencedNode: unused, forProfileActor: unused, insertCurrent: unused, insertRevision: unused,
        authorizer: unused, setAuthorizer: unused, forActor: unused, get: unused, currentForUpdate: unused,
        replaceCurrent: unused, markDeleting: unused,
        async record(value, id, scope, lock) {
            head(value, lock); return { id, scope_id: scope, owner_actor_id: state.ownerActorId, revision: state.revision, spec: state.spec,
                deleting: Number(state.deleting), recovery_suspended: Number(state.recoverySuspended) };
        },
        async classifyOwner(value, id, scope, expected, owner) { return classify(value, scope, id, expected, owner); },
        async auditOwnership(value, eventId, id, scope, revision, actor, owner, at) {
            assert.equal(eventId, 'classification-event'); return audit(value, scope, id, actor, owner, revision, at);
        },
    };
    const intents = new ForwardStateService({ store: intentStore, values: { read<T>(value: unknown) { return value as T; },
        encode(value: unknown) { const encoded = JSON.stringify(value); if (encoded === undefined) throw new Error('Value required'); return encoded; } } });
    const operations: ForwardOperationCommands<Tx> = { read: unused, get: unused, accept: unused };
    const preparation: ForwardCommandPreparation<Tx> = { prepareCreate: unused, planCreate: unused, prepareUpdate: unused, planUpdate: unused,
        async lockOwnership(value,forward) { check(value);assert.equal(forward.id,'legacy');calls.push('runtime-ownership-lock'); },
        lock: unused, lockRemoval: unused, prepareRetry: unused, assertCapacity: unused };
    const commands = kind === 'forward' ?
        new ForwardCommands(db, auth, access, requests, intents, operations, preparation, () => 'classification-event', undefined, undefined, undefined, () => 1000) :
        kind === 'path-template' ? new PathTemplateCommands(db, auth, access, requests, templateStore, { validate: unused }, () => 1000) :
            new PathGroups(db, auth, access, requests, groupStore, templateStore, { validate: unused },
                { current: unused, history: unused, references: unused, append: unused, detach: unused }, { record: unused },
                { previewIn: unused }, { current: unused, at: unused }, () => 1000);
    return { options, calls, snapshot: () => structuredClone({ state, audits, replies, history }),
        setOwner(owner: string | null) { state.ownerActorId = owner; },
        invoke: (actor = 'administrator', key = 'classification', expected = 7, owner = 'new-owner') =>
            commands.classifyOwner(actor, 'scope', 'legacy', key, expected, owner) };
}

for (const kind of ['forward', 'path-template', 'path-group'] as const) {
    test(`${kind} classification changes only a null business owner and preserves all execution/configuration/history`, async () => {
        const f = fixture(kind), before = f.snapshot();
        const response = await f.invoke(), after = f.snapshot();
        assert.equal(response.status, 200); assert.equal(response.body.revision, 7); assert.equal(response.body.ownerActorId, 'new-owner');
        assert.equal(response.body.classified, true); assert.equal(after.state.ownerActorId, 'new-owner');
        assert.deepEqual({ ...after.state, ownerActorId: null }, before.state); assert.deepEqual(after.history, before.history);
        assert.deepEqual(after.audits, [{ actor: 'administrator', owner: 'new-owner', revision: 7, at: 1000 }]);
        assert.ok(f.calls.indexOf('scope-owner') < f.calls.indexOf('claim'));
        assert.ok(f.calls.indexOf('new-owner-membership') < f.calls.indexOf('head-lock'));
        assert.ok(f.calls.indexOf('head-lock') < f.calls.indexOf('cas')); assert.ok(f.calls.indexOf('audit') < f.calls.indexOf('respond'));
        if (kind === 'forward') {
            assert.ok(f.calls.indexOf('head-lock') < f.calls.indexOf('runtime-ownership-lock'));
            assert.ok(f.calls.indexOf('runtime-ownership-lock') < f.calls.indexOf('cas'));
        }
        if (kind !== 'forward') assert.ok(f.calls.indexOf('scope-lock') < f.calls.indexOf('head-lock'));
    });

    test(`${kind} classification rejects ordinary managers, inactive/viewer/foreign targets, stale CAS and reclassification`, async () => {
        const manager = fixture(kind);
        await assert.rejects(manager.invoke('manager'), { code: 'AUTHORIZATION_DENIED' }); assert.ok(!manager.calls.includes('cas'));
        for (const target of ['viewer', 'removed', 'foreign']) {
            const f = fixture(kind), before = f.snapshot(); await assert.rejects(f.invoke('administrator', 'classification', 7, target), { code: 'AUTHORIZATION_DENIED' });
            assert.deepEqual(f.snapshot(), before); assert.ok(!f.calls.includes('cas'));
        }
        const stale = fixture(kind), beforeStale = stale.snapshot();
        await assert.rejects(stale.invoke('administrator', 'classification', 6), { code: 'REVISION_CONFLICT' }); assert.deepEqual(stale.snapshot(), beforeStale);
        for (const owner of ['new-owner', 'other']) {
            const f = fixture(kind); f.setOwner(owner); const before = f.snapshot();
            await assert.rejects(f.invoke(), { code: 'REVISION_CONFLICT' }); assert.deepEqual(f.snapshot(), before); assert.ok(!f.calls.includes('cas'));
        }
    });

    test(`${kind} classification CAS/audit/response failure rolls back ownership and its idempotency record`, async () => {
        for (const failure of ['casLost', 'failAudit', 'failRespond'] as const) {
            const f = fixture(kind), before = f.snapshot(); f.options[failure] = true;
            await assert.rejects(f.invoke(), failure === 'casLost' ? { code: 'REVISION_CONFLICT' } : { message: failure === 'failAudit' ? 'audit persistence failed' : 'response persistence failed' });
            assert.deepEqual(f.snapshot(), before);
        }
    });

    test(`${kind} classification replay rechecks current Scope owner and target membership without redoing CAS/audit`, async () => {
        const f = fixture(kind), response = await f.invoke(), before = f.snapshot(); f.calls.length = 0;
        assert.deepEqual(await f.invoke(), response); assert.deepEqual(f.snapshot(), before);
        assert.ok(f.calls.includes('replay-visible')); assert.ok(!f.calls.includes('cas')); assert.ok(!f.calls.includes('audit'));
        f.options.managers.clear(); await assert.rejects(f.invoke(), { code: 'AUTHORIZATION_DENIED' }); assert.deepEqual(f.snapshot(), before);
        f.options.managers.add('new-owner');
        await assert.rejects(f.invoke('administrator', 'classification', 6), { code: 'IDEMPOTENCY_CONFLICT' });
        await assert.rejects(f.invoke('manager'), { code: 'AUTHORIZATION_DENIED' });
        await assert.rejects(f.invoke('administrator', 'different-key'), { code: 'REVISION_CONFLICT' });
    });
}

test('classification SQL updates only the owner under scope/revision/null CAS and audits original owners', async () => {
    const calls: { sql: string; args: unknown[] }[] = [];
    const tx = { async execute(sql: string, args: unknown[]) { calls.push({ sql, args }); return [{ affectedRows: 1 }]; } } as unknown as Transaction;
    const forward = new MySqlForwardIntentStore(), templates = new MySqlPathTemplateStore(), groups = new MySqlPathGroupStore();
    await forward.classifyOwner(tx, 'legacy', 'scope', 7, 'new-owner');
    await templates.classifyOwner(tx, 'scope', 'legacy', 7, 'new-owner');
    await groups.classifyOwner(tx, 'scope', 'legacy', 7, 'new-owner');
    for (const { sql } of calls) {
        assert.match(sql, /SET owner_actor_id=\? WHERE/); assert.match(sql, /scope_id=\?/);
        assert.match(sql, /(?:current_)?revision=\?/); assert.match(sql, /owner_actor_id IS NULL$/);
        assert.equal(sql.slice(sql.indexOf(' SET ') + 5, sql.indexOf(' WHERE ')), 'owner_actor_id=?');
    }
    await forward.auditOwnership(tx, 'event', 'legacy', 'scope', 7, 'administrator', 'new-owner', 1000);
    await templates.auditOwnership(tx, 'scope', 'legacy', 'administrator', 'new-owner', 7, 1000);
    await groups.auditOwnership(tx, 'scope', 'legacy', 'administrator', 'new-owner', 7, 1000);
    assert.match(calls[3]!.sql, /INSERT INTO forward_ownership_events/);
    assert.match(calls[4]!.sql, /INSERT INTO path_template_events.*'classify-owner'/);
    assert.match(calls[5]!.sql, /INSERT INTO path_group_events.*'classify-owner'/);
    for (const { args } of calls.slice(3)) { assert.ok(args.includes('administrator')); assert.ok(args.includes('new-owner')); assert.ok(args.includes(7)); }
});
