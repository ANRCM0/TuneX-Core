import { ResourceAccess } from '../src/modules/resource-access-owner/public.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nativeValueDigest as digest } from '../src/compatibility/public.ts';
import { ControlError } from '../src/framework/public.ts';
import type { IdempotentRequests, RequestIdentity } from '../src/framework/public.ts';
import { IngressGroups } from '../src/modules/ingress-owner/public.ts';
import type { IngressGroupConfig, IngressGroupStore, IngressGroupHead, IngressGroupRevision } from '../src/modules/ingress-owner/public.ts';
import { parsePathTemplate } from '../src/modules/path-owner/public.ts';
import type { PathTemplateReader, PathTemplateReferences } from '../src/modules/path-owner/public.ts';

function fixture() {
    const tx = Object.freeze({ transaction: Symbol('caller') }), events: string[] = [];
    const profileDigest = 'sha256:' + 'a'.repeat(64);
    const templates = new Map(['template-a', 'template-z'].map((id, index) => {
        const config = parsePathTemplate({ version: 1, protocols: ['tcp'], nodes: [`ingress-${index}`, 'egress'],
            endpoints: [{ nodeId: 'egress', revision: 1 }], transport: { profileId: 'profile', configRevision: 1 } });
        return [id, { revision: 1, config, configDigest: digest({ config, profileDigest }), profileDigest, createdBy: 'actor', createdAt: 1800000000000 }];
    }));
    const input: IngressGroupConfig = { schemaVersion: 1, members: ['template-z', 'template-a'].map((id, i) =>
        ({ memberId: `member-${i}`, template: { templateId: id, revision: 1, configDigest: templates.get(id)!.configDigest } })) };
    const state = { head: null as IngressGroupHead | null, record: null as IngressGroupRevision | null,
        audit: 0, replies: new Map<string, unknown>(), deny: false, fail: '', references: 0, clocks: 0 };
    const check = (actual: typeof tx) => assert.equal(actual, tx);
    const db = { async transaction<T>(action: (actual: typeof tx) => Promise<T>) {
        events.push('begin'); const saved = structuredClone({ head: state.head, record: state.record, audit: state.audit, replies: state.replies });
        try { const result = await action(tx); events.push('commit'); return result; }
        catch (error) { Object.assign(state, saved); events.push('rollback'); throw error; }
    } };
    const auth = { async owner() { assert.fail('not owner classification'); }, async scope(actual: typeof tx, actor: string, scope: string, manage?: boolean) {
        check(actual); assert.deepEqual([actor, scope, manage], ['actor', 'scope', true]); events.push('authorize');
        if (state.deny) throw new ControlError('AUTHORIZATION_DENIED', 403, 'denied');
    } };
    const requests: IdempotentRequests<typeof tx> = {
        async claim<R>(actual: typeof tx, request: RequestIdentity) { check(actual); events.push('claim'); return state.replies.get(request.key) as R | undefined; },
        async respond(actual, request, response) {
            check(actual); events.push('respond'); state.replies.set(request.key, response);
            if (state.fail === 'respond') throw new Error('response unavailable');
        },
    };
    const store: IngressGroupStore<typeof tx> = {
        async classifyOwner() { assert.fail('not owner classification'); },
        async lockScope(actual) { check(actual); events.push('lock-scope'); },
        async head(actual) { check(actual); events.push('head'); return state.head; },
        async revision(actual) { check(actual); events.push('revision'); return state.record; },
        async count(actual) { check(actual); events.push('count'); return state.head ? 1 : 0; },
        async list() { assert.fail('not a list operation'); },
        async publish(actual, _scope, id, record) {
            check(actual); events.push('publish'); state.head = { groupId: id, currentRevision: record.revision, archived: false, ownerActorId: record.createdBy };
            state.record = record;
        },
        async archive(actual) { check(actual); events.push('archive'); state.head = { ...state.head!, archived: true }; },
        async audit(actual) { check(actual); events.push('audit'); state.audit++; },
    };
    const reader: PathTemplateReader<typeof tx> = {
        async list() { assert.fail('not a template list operation'); },
        async head(actual, _scope, id, lock) { check(actual); events.push(`template:${id}:${lock}`); return { templateId: id, currentRevision: 1, archived: false, ownerActorId: 'actor' }; },
        async revision(actual, _scope, id) { check(actual); return templates.get(id) ?? null; },
    };
    const references: PathTemplateReferences<typeof tx> = {
        async validate(actual) { check(actual); events.push('references'); state.references++;
            if (state.fail === 'references') throw new ControlError('AUTHORIZATION_DENIED', 403, 'grant denied');
            return { profileDigest };
        },
    };
    const access = new ResourceAccess({async scope(actual:typeof tx, actor:string, scope:string) { assert.equal(actual,tx); assert.equal(actor,'actor'); assert.equal(scope,'scope'); }}, {
        async scopeOwner(actual,scope) { assert.equal(actual,tx); assert.equal(scope,'scope'); return {ownerActorId:'governor'}; },
        async ownership(actual,scope,kind,id) { assert.equal(actual,tx); assert.equal(scope,'scope'); return kind === 'ingress-group' && id === 'group' ? {ownerActorId:state.head ? state.head.ownerActorId : 'actor'} : kind === 'path-template' && ['template-a','template-z'].includes(id) ? {ownerActorId:'actor'} : kind === 'forward' && id === 'forward' ? {ownerActorId:'actor'} : undefined; },
        async node() { assert.fail('not a Node read'); },
    });
    const host = new IngressGroups(db, auth, access, requests, store, reader, references, () => { state.clocks++; return 1800000000000; });
    const selection = () => ({ groupId: 'group', revision: 1, configDigest: digest(input) });
    return { tx, host, events, state, input, templates, selection, publish: (key = 'key', expected = 0) => host.publish('actor', 'scope', 'group', key, expected, input) };
}

test('ingress publication authorizes before replay and rechecks sorted live template grants even for an unchanged definition', async () => {
    const f = fixture(); await f.publish();
    assert.deepEqual(f.events.filter(s => s.startsWith('template:')), ['template:template-a:true', 'template:template-z:true']);
    assert.deepEqual(f.state.record!.config.members.map(m => m.memberId), ['member-0', 'member-1']);
    f.events.length = 0; f.state.deny = true;
    await assert.rejects(f.publish(), { code: 'AUTHORIZATION_DENIED', status: 403 });
    assert.deepEqual(f.events, ['begin', 'authorize', 'rollback']);
    f.state.deny = false; f.state.fail = 'references'; f.events.length = 0;
    await assert.rejects(f.publish('new-key', 1), { code: 'AUTHORIZATION_DENIED' });
    assert.equal(f.state.head!.currentRevision, 1); assert.equal(f.state.audit, 1);
    assert.equal(f.events.includes('publish'), false); assert.equal(f.events.includes('respond'), false);
});

test('a response persistence failure rolls back ingress head, immutable revision, audit and replay before a same-key retry', async () => {
    const f = fixture(); f.state.fail = 'respond';
    await assert.rejects(f.publish(), /response unavailable/);
    assert.equal(f.state.head, null); assert.equal(f.state.record, null); assert.equal(f.state.audit, 0); assert.equal(f.state.replies.size, 0);
    assert.ok(f.events.indexOf('publish') < f.events.indexOf('audit')); assert.ok(f.events.indexOf('audit') < f.events.indexOf('respond'));
    f.state.fail = ''; const response = await f.publish();
    assert.equal(response.status, 202); assert.equal(f.state.head!.currentRevision, 1); assert.equal(f.state.audit, 1);
    const writes = f.events.filter(e => e === 'publish').length, samples = f.state.clocks;
    assert.deepEqual(await f.publish(), response);
    assert.equal(f.events.filter(e => e === 'publish').length, writes); assert.equal(f.state.clocks, samples);
});

test('historical ingress descriptions use persisted references but active resolution refuses archived groups before template disclosure', async () => {
    const f = fixture(); await f.publish(); f.state.head!.archived = true;
    f.events.length = 0; const liveChecks = f.state.references;
    const described = await f.host.describeIn(f.tx, 'actor', 'scope', f.selection());
    assert.deepEqual(described.members.map(m => m.memberId), ['member-0', 'member-1']);
    assert.equal(f.state.references, liveChecks); assert.ok(Object.isFrozen(described.members));
    assert.deepEqual(f.events.filter(s => s.startsWith('template:')), ['template:template-a:false', 'template:template-z:false']);
    f.events.length = 0;
    await assert.rejects(f.host.resolveIn(f.tx, 'actor', 'scope', f.selection(), ['member-1']), { code: 'GROUP_ARCHIVED' });
    assert.deepEqual(f.events, ['authorize', 'head']);
    f.state.head!.archived = false;
    const selected = await f.host.resolveIn(f.tx, 'actor', 'scope', f.selection(), ['member-1', 'member-0']);
    assert.deepEqual(selected.map(m => m.memberId), ['member-1', 'member-0']); assert.equal(f.state.references, liveChecks);
});

test('ingress requires distinct ingress Nodes and common protocols before committing definition state', async () => {
    for (const mismatch of ['ingress', 'protocol']) {
        const f = fixture(), first = f.templates.get('template-a')!, second = f.templates.get('template-z')!;
        second.config = mismatch === 'ingress'
            ? parsePathTemplate({ ...first.config, transport: { ...first.config.transport, profileId: 'other-profile' } })
            : parsePathTemplate({ ...second.config, protocols: ['udp'] });
        second.configDigest = digest({ config: second.config, profileDigest: second.profileDigest });
        f.input.members[0]!.template.configDigest = second.configDigest;
        await assert.rejects(f.publish(), { code: 'INVALID_CONFIG', status: 422,
            message: 'Ingress members require distinct ingress Nodes and one business protocol set' });
        assert.equal(f.state.head, null); assert.equal(f.state.record, null); assert.equal(f.state.replies.size, 0);
        assert.equal(f.events.includes('publish'), false);
        assert.deepEqual(f.events, ['begin', 'authorize', 'claim', 'lock-scope', 'head',
            'template:template-a:true', 'references', 'template:template-z:true', 'references', 'rollback']);
    }
});
