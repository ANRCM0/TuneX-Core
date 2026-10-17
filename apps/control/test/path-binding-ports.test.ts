import assert from 'node:assert/strict';
import { test } from 'node:test';
import { digest } from '@tunex/contracts';
import { parseForwardSpec } from '@tunex/core';
import type { Forward } from '@tunex/core';
import { ForwardCommands } from '../src/application/forward-commands.ts';
import { PathBindings } from '../src/application/path-bindings.ts';
import { ControlError } from '../src/application/errors.ts';
import type { CommandResponse, IdempotentRequests, RequestIdentity } from '../src/application/ports.ts';
import { parsePathSelection, expandPath } from '../src/modules/path-binding-contract.ts';
import type { PathBindingRecord, PathBindingWriter } from '../src/modules/path-binding-ports.ts';
import { parsePathTemplate } from '../src/modules/path-template-contract.ts';
import type { PathTemplateReader } from '../src/modules/path-template-ports.ts';
import type { ForwardWriter } from '../src/modules/forwarding-ports.ts';
import type { ForwardCommandPreparation, ForwardOperationCommands } from '../src/modules/runtime/forward-command-ports.ts';
import { pathReferenceQuery } from '../src/api/path-template-query.ts';

type Tx = { name: string };
const hash = 'sha256:' + 'a'.repeat(64);
const config = (via = ['middle', 'egress']) => parsePathTemplate({ version: 1, protocols: ['tcp', 'udp'], nodes: ['ingress', ...via],
    endpoints: via.map(nodeId => ({ nodeId, revision: 1 })), transport: { profileId: 'profile', configRevision: 1 } });
const desired = () => {
    const parsed = parseForwardSpec({ enabled: true, protocols: ['tcp', 'udp'], ingress: { nodeId: 'ingress', listen: { address: '127.0.0.1', port: 32001 } },
        target: { host: '127.0.0.1', port: 9000 }, path: { via: ['middle', 'egress'] }, transport: { profileId: 'profile', configRevision: 1 } });
    if (!parsed.ok) throw Error('invalid fixture'); return parsed.value;
};
function fixture() {
    const tx: Tx = { name: 'original-transaction' }, calls: string[] = [];
    let state = { forward: { id: 'forward', scopeId: 'scope', revision: 4, spec: desired() } as Forward,
        suspended: false, archived: false, history: [] as PathBindingRecord[], pointer: null as PathBindingRecord | null,
        replies: new Map<string, { digest: string; response?: CommandResponse }>(), operations: [] as Forward[], authorizer: 'original' };
    const options = { manage: true, references: true, profileDigest: hash, capacity: true, audit: true, preparation: true };
    const check = (value: Tx, name: string) => { assert.equal(value, tx); calls.push(name); };
    const db = { async transaction<T>(action: (tx: Tx) => Promise<T>) {
        const before = structuredClone(state); calls.push('begin');
        try { const result = await action(tx); calls.push('commit'); return result; }
        catch (error) { state = before; calls.push('rollback'); throw error; }
    } };
    const auth = { async scope(value: Tx, _actor: string, scope: string, manage = false) {
        check(value, 'auth:' + manage); if (scope !== 'scope' || manage && !options.manage) throw new ControlError('AUTHORIZATION_DENIED', 403, 'Denied');
    } };
    const requests: IdempotentRequests<Tx> = {
        async claim<R extends CommandResponse>(value: Tx, request: RequestIdentity) {
            check(value, 'claim'); const prior = state.replies.get(request.key);
            if (prior && prior.digest !== request.digest) throw new ControlError('IDEMPOTENCY_CONFLICT', 409, 'Changed key');
            if (prior?.response) return structuredClone(prior.response) as R;
            state.replies.set(request.key, { digest: request.digest }); return undefined;
        },
        async respond(value, request, response) { check(value, 'respond'); state.replies.get(request.key)!.response = structuredClone(response); }
    };
    const templates = new Map([1, 2].map(number => {
        const value = config(number === 1 ? ['middle', 'egress'] : ['egress']);
        return [number, { revision: number, config: value, profileDigest: hash, configDigest: digest({ config: value, profileDigest: hash }), createdBy: 'manager', createdAt: 1800000000000 }] as const;
    }));
    const reader: PathTemplateReader<Tx> = {
        async head(value, scope, id, lock) { check(value, 'template-head:' + Boolean(lock)); return scope === 'scope' && id === 'path' ? { templateId: id, currentRevision: 2, archived: state.archived } : null; },
        async revision(value, scope, id, revision) { check(value, 'template-revision'); return scope === 'scope' && id === 'path' ? templates.get(revision) ?? null : null; },
        async list() { throw Error('unused'); }
    };
    const references = { async validate(value: Tx) { check(value, 'references'); if (!options.references) throw new ControlError('AUTHORIZATION_DENIED', 403, 'Original reference denied'); return { profileDigest: options.profileDigest }; } };
    const store: PathBindingWriter<Tx> = {
        async current(value) { check(value, 'binding-read'); return state.pointer ? structuredClone(state.pointer) : null; },
        async history(value) { check(value, 'binding-history'); return structuredClone(state.history); },
        async references(value, _scope, _template, paging, revision) {
            check(value, 'references-read'); const items = state.pointer && (revision === undefined || state.pointer.revision === revision) ?
                [{ forward: state.forward, recoverySuspended: state.suspended, binding: structuredClone(state.pointer) }] : [];
            return { total: items.length, items: items.slice(paging.offset, paging.offset + paging.limit) };
        },
        async append(value, _scope, _id, record) {
            check(value, 'binding-append'); if (!options.audit) throw Error('audit failed');
            if (state.history.length >= 64) throw new ControlError('RESOURCE_LIMIT', 429, 'Binding quota');
            const next = { ...structuredClone(record), sequence: state.history.length + 1 }; state.history.push(next); state.pointer = next; return next;
        },
        async detach(value) { check(value, 'detach'); state.pointer = null; }
    };
    const forwards: ForwardWriter<Tx> = {
        async record(value) { check(value, 'record'); return { ...state.forward, deleting: false, recoverySuspended: state.suspended }; },
        async currentForUpdate(value) { check(value, 'forward-lock'); return structuredClone(state.forward); },
        async replace(value, _current, next) { check(value, 'replace'); state.forward = next; },
        async setAuthorizer(value, _id, actor) { check(value, 'authorizer'); state.authorizer = actor; },
        async insert() { throw Error('unused'); }, async markDeleting() { throw Error('unused'); }
    };
    const execution: ForwardCommandPreparation<Tx> = {
        async prepareUpdate(value) { check(value, 'prepare'); if (!options.preparation) throw Error('Original runtime preparation denied'); },
        async planUpdate(value) { check(value, 'plan'); },
        async assertCapacity(value) { check(value, 'capacity'); if (!options.capacity) throw Error('Original capacity denied'); },
        async prepareCreate() { throw Error('unused'); }, async planCreate() { throw Error('unused'); }, async lock() { throw Error('unused'); },
        async lockRemoval() { throw Error('unused'); }, async prepareRetry() { throw Error('unused'); }
    };
    const operations: ForwardOperationCommands<Tx> = {
        async accept(value, forward) { check(value, 'accept'); state.operations.push(structuredClone(forward)); return 'operation-' + state.operations.length; },
        async read() { throw Error('unused'); }, async get() { throw Error('unused'); }
    };
    const paths = new PathBindings(db, auth, reader, references, store, forwards, () => 1800000000000);
    const commands = new ForwardCommands(db, auth, requests, forwards, operations, execution, () => 'new-id', paths);
    const selection = (revision = 2) => ({ templateId: 'path', revision, configDigest: templates.get(revision)!.configDigest });
    const apply = (revision = 2, key = 'apply', cas = 4) => commands.applyPath('manager', 'scope', 'forward', key, cas, selection(revision));
    return { tx, calls, db, auth, state: () => state, options, store, reader, templates, paths, commands, selection, apply };
}

test('selection is closed/detached, expansion changes only the fixed path/Profile and denies ingress/protocol moves', () => {
    const input = { templateId: 'path', revision: 2, configDigest: hash }, selected = parsePathSelection(input); input.revision = 3;
    assert.equal(selected.revision, 2); assert.equal(Object.isFrozen(selected), true);
    for (const value of [{ ...input, latest: true }, { ...input, revision: 0 }, { ...input, revision: 65 }, { ...input, configDigest: 'unlocked' }]) assert.throws(() => parsePathSelection(value));
    const spec = desired(), expanded = expandPath(spec, config(['egress']));
    assert.deepEqual(expanded.target, spec.target); assert.deepEqual(expanded.ingress, spec.ingress); assert.equal(expanded.enabled, spec.enabled);
    assert.deepEqual(expanded.path!.via, ['egress']); assert.throws(() => expandPath({ ...spec, protocols: ['tcp'] }, config()));
    assert.throws(() => expandPath({ ...spec, ingress: { ...spec.ingress, nodeId: 'other' } }, config()));
});

test('binding and actual expanded Forward enter one original CAS/preparation/Operation/capacity/idempotency transaction', async () => {
    const f = fixture(), result = await f.apply();
    assert.equal(result.status, 202); assert.equal(result.body.revision, 5); assert.equal(result.body.operationId, 'operation-1');
    assert.deepEqual(result.body.pathBinding, { ...f.selection(), sequence: 1, forwardRevision: 5, changed: true });
    for (const name of ['forward-lock', 'template-head:true', 'references', 'prepare', 'replace', 'plan', 'accept', 'capacity', 'binding-append', 'respond']) assert.ok(f.calls.includes(name));
    assert.ok(f.calls.indexOf('forward-lock') < f.calls.indexOf('references')); assert.ok(f.calls.indexOf('binding-append') > f.calls.indexOf('capacity'));
    assert.equal(f.calls.filter(name => name === 'begin').length, 1); assert.equal(f.calls.at(-1), 'commit');
    const record = f.state().history[0]!; assert.deepEqual(record.expandedSpec, f.state().forward.spec); assert.equal(record.specDigest, digest(record.expandedSpec));
    assert.equal(f.state().operations.length, 1); assert.equal(f.state().authorizer, 'manager');
});

test('identical replay returns the original receipt without re-expansion but requires current management; changed normalized key conflicts', async () => {
    const f = fixture(), first = await f.apply(); f.options.references = false; f.state().archived = true; f.calls.length = 0;
    assert.deepEqual(await f.apply(), first); assert.deepEqual(f.calls, ['begin', 'auth:true', 'claim', 'commit']);
    assert.equal(f.state().history.length, 1); assert.equal(f.state().operations.length, 1);
    await assert.rejects(f.apply(1), /Changed key/); f.options.manage = false; await assert.rejects(f.apply(), /Denied/);
});

test('stale CAS, recovery isolation, archived/different digest and denied original grants fail before any provenance or execution commit', async () => {
    for (const mutation of [(f: ReturnType<typeof fixture>) => { f.state().suspended = true; },
        (f: ReturnType<typeof fixture>) => { f.state().archived = true; }, (f: ReturnType<typeof fixture>) => { f.options.references = false; },
        (f: ReturnType<typeof fixture>) => { f.options.profileDigest = 'sha256:' + 'b'.repeat(64); }]) {
        const f = fixture(); mutation(f); await assert.rejects(f.apply()); assert.equal(f.state().history.length, 0);
        assert.equal(f.state().forward.revision, 4); assert.equal(f.state().operations.length, 0); assert.equal(f.state().replies.size, 0);
    }
    const f = fixture(); await assert.rejects(f.apply(2, 'stale', 3)); assert.equal(f.calls.includes('references'), false);
    await assert.rejects(f.commands.applyPath('manager', 'scope', 'forward', 'digest', 4, { ...f.selection(), configDigest: hash }));
});

test('original preparation, capacity and binding audit failures roll back the entire accepted revision, Operation, authorizer and key', async () => {
    for (const option of ['preparation', 'capacity', 'audit'] as const) {
        const f = fixture(); f.options[option] = false; await assert.rejects(f.apply());
        assert.equal(f.state().forward.revision, 4); assert.equal(f.state().operations.length, 0); assert.equal(f.state().history.length, 0);
        assert.equal(f.state().pointer, null); assert.equal(f.state().authorizer, 'original'); assert.equal(f.state().replies.size, 0);
    }
});

test('same expanded spec can attach/rebind provenance without an Operation; exact no-op does not consume history', async () => {
    const f = fixture(), first = await f.apply(1); assert.equal(first.status, 200); assert.equal(first.body.operationId, null);
    assert.equal(first.body.revision, 4); assert.equal(first.body.pathBinding!.changed, true); assert.equal(f.state().operations.length, 0);
    const second = await f.apply(1, 'again'); assert.equal(second.body.pathBinding!.changed, false); assert.equal(f.state().history.length, 1);
    const different = f.templates.get(2)!; f.templates.set(2, { ...different, config: f.templates.get(1)!.config, configDigest: f.templates.get(1)!.configDigest });
    const third = await f.apply(2, 'equivalent'); assert.equal(third.status, 200); assert.equal(third.body.pathBinding!.sequence, 2);
    assert.equal(f.state().forward.revision, 4); assert.equal(f.state().history[0]!.revision, 1); assert.equal(f.state().history[1]!.revision, 2);
});

test('ordinary enabled/target/listener changes preserve historical binding; explicit topology changes detach current pointer without deleting history', async () => {
    const f = fixture(); await f.apply(1); const before = structuredClone(f.state().history);
    const changed = { ...f.state().forward.spec, enabled: false, target: { host: '127.0.0.1', port: 9001 } };
    await f.commands.update('manager', 'scope', 'forward', 'normal', 4, changed);
    assert.equal(f.state().pointer!.sequence, 1); assert.deepEqual(f.state().history, before);
    const current = await f.paths.get('viewer', 'scope', 'forward'); assert.equal(current.revision, 5); assert.equal(current.binding!.forwardRevision, 4);
    f.state().archived = true;
    await f.commands.update('manager', 'scope', 'forward', 'different', 5, { ...changed, path: { via: ['egress'] } });
    assert.equal(f.state().pointer, null); assert.deepEqual(f.state().history, before); assert.ok(f.calls.includes('detach'));
});

test('binding quota counts retained immutable records but allows exact no-op and ordinary disable/detach', async () => {
    const f = fixture(); await f.apply(1); const record = f.state().history[0]!;
    f.state().history = Array.from({ length: 64 }, (_, i) => ({ ...structuredClone(record), sequence: i + 1 }));
    assert.equal((await f.apply(1, 'noop')).status, 200); await assert.rejects(f.apply(2, 'quota'), /quota/);
    assert.equal(f.state().forward.revision, 4); assert.equal(f.state().operations.length, 0);
    await f.commands.update('manager', 'scope', 'forward', 'disable', 4, { ...f.state().forward.spec, enabled: false });
    assert.equal(f.state().forward.spec.enabled, false); assert.equal(f.state().history.length, 64);
});

test('bounded references and impact are read-only, include suspended/archived history labels, and reject malformed or corrupt provenance', async () => {
    const f = fixture(); await f.apply(1); const before = structuredClone(f.state()); f.calls.length = 0;
    const page = await f.paths.references('manager', 'scope', 'path', { page: '1', limit: '25', revision: 1, targetRevision: 2 });
    assert.equal(page.total, 1); assert.equal(page.reserved, false); assert.equal(page.fullPlanAuthorization, false);
    assert.deepEqual(page.items[0]!.proposedSpec!.path!.via, ['egress']); assert.equal(page.items[0]!.expectedRevision, 4);
    assert.deepEqual(f.state(), before); assert.equal(f.calls.includes('binding-append'), false); assert.equal(f.calls.includes('prepare'), false);
    const proposal = await f.paths.preview('manager', 'scope', 'forward', 4, f.selection());
    assert.equal(proposal.changed, true); assert.equal(proposal.executionAuthorized, false); assert.match(proposal.udp, /lose-datagrams/);
    f.state().suspended = true;
    assert.equal((await f.paths.references('manager', 'scope', 'path', { targetRevision: 2 })).items[0]!.unavailableReason, 'RECOVERY_SUSPENDED');
    await assert.rejects(f.paths.preview('manager', 'scope', 'forward', 4, f.selection())); f.state().suspended = false; f.state().archived = true;
    f.options.references = false;
    assert.equal((await f.paths.references('viewer', 'scope', 'path')).items.length, 1);
    assert.equal((await f.paths.references('manager', 'scope', 'path', { targetRevision: 2 })).items[0]!.unavailableReason, 'TEMPLATE_ARCHIVED');
    assert.equal((await f.paths.get('viewer', 'scope', 'forward')).binding!.sequence, 1);
    f.state().pointer!.specDigest = hash; await assert.rejects(f.paths.get('viewer', 'scope', 'forward'), /provenance/);
    for (const query of ['page=01', 'limit=101', 'targetRevision=0', 'targetRevision=1&targetRevision=2', 'revision=65', 'latest=true'])
        assert.throws(() => pathReferenceQuery(new URLSearchParams(query)));
    assert.deepEqual(pathReferenceQuery(new URLSearchParams('page=2&limit=25&revision=1&targetRevision=2')), { page: '2', limit: '25', revision: 1, targetRevision: 2 });
});
