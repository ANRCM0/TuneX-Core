import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nativeValueDigest as digest } from '../src/compatibility/public.ts';
import { ControlError } from '../src/framework/public.ts';
import type { IdempotentRequests } from '../src/framework/public.ts';
import { StationAlerts, STATION_ALERT_LIMITS, emptyStationAlertState, parseStationAlertConfig, parseStationAlertPolicy } from '../src/modules/station-alert-owner/public.ts';
import type { StationAlertStore, StationAlertPolicy, StationAlertEvent } from '../src/modules/station-alert-owner/public.ts';

function fixture() {
    const now = 1800000000000, tx = Object.freeze({ transaction: Symbol('station-worker') }), trace: string[] = [];
    const config = parseStationAlertConfig({ schemaVersion: 1, rule: 'node-credential-expiring', target: { kind: 'node', id: 'node' }, enabled: true, thresholdSeconds: 60 });
    const original = parseStationAlertPolicy({ policyId: 'policy', revision: 1, configRevision: 1, config, configDigest: digest(config),
        managedBy: 'scope-owner', createdAt: now - 1000, updatedAt: now - 1000, silencedUntil: null, suspended: 'none',
        nextEvaluateAt: now, state: { ...emptyStationAlertState(), condition: 'clear', armed: true } });
    const state = { policy: original, latest: null as StationAlertPolicy | null, events: [] as StationAlertEvent[], queued: 0,
        deny: false, fail: '', depth: 0, gate: undefined as Promise<void> | undefined, deferred: [] as number[][] };
    const check = (actual: typeof tx, step: string) => { assert.equal(actual, tx); trace.push(step); };
    const db = { async transaction<T>(action: (actual: typeof tx) => Promise<T>) {
        assert.equal(state.depth, 0, 'worker introduced a nested transaction'); state.depth++;
        const saved = structuredClone({ policy: state.policy, events: state.events, queued: state.queued }); trace.push('begin');
        try { const result = await action(tx); trace.push('commit'); return result; }
        catch (error) { Object.assign(state, saved); trace.push('rollback'); throw error; }
        finally { state.depth--; }
    } };
    const store: StationAlertStore<typeof tx> = {
        async due(actual, at) { check(actual, 'due'); assert.equal(at, now); return { scopeId: 'scope', policyId: 'policy', revision: 1 }; },
        async policy(actual, scope, id, lock) { check(actual, lock ? 'policy-locked' : 'candidate'); assert.deepEqual([scope, id], ['scope', 'policy']); return lock && state.latest ? state.latest : state.policy; },
        async lockScope(actual, scope) { check(actual, 'lock-scope'); assert.equal(scope, 'scope'); },
        async putPolicy(actual, scope, value) { check(actual, 'put-policy'); assert.equal(scope, 'scope'); state.policy = value; if (state.fail === 'put') throw new Error('policy write failed'); },
        async appendEvent(actual, scope, value, at) { check(actual, 'append-event'); assert.equal(scope, 'scope'); assert.equal(at, now); state.events.push(value); },
        async defer(actual, scope, id, revision, cutoff, retryAt) { check(actual, 'defer'); assert.deepEqual([scope, id], ['scope', 'policy']); state.deferred.push([revision, cutoff, retryAt]); },
        async losses() { assert.fail('unexpected losses read'); }, async policyCount() { assert.fail('unexpected count'); },
        async policies() { assert.fail('unexpected list'); }, async audit() { assert.fail('unexpected command audit'); },
        async audits() { assert.fail('unexpected audit query'); }, async event() { assert.fail('unexpected event read'); },
        async events() { assert.fail('unexpected event query'); }, async acknowledge() { assert.fail('unexpected acknowledgement'); },
    };
    const auth = { async scope() { assert.fail('Station worker must retain owner authorization'); }, async owner(actual: typeof tx, actor: string, scope: string, ...extra:unknown[]) {
        check(actual, 'authorize'); assert.equal(scope,'scope'); assert.deepEqual(extra,[]);
        if (state.deny||actor!=='scope-owner') throw new ControlError('AUTHORIZATION_DENIED', 403, 'Scope owner permission required');
    } };
    const requests: IdempotentRequests<typeof tx> = { async claim() { assert.fail('worker claimed a command'); }, async respond() { assert.fail('worker wrote a receipt'); } };
    const facts = { async read(actual: typeof tx, scope: string) {
        check(actual, 'facts'); assert.equal(scope, 'scope'); await state.gate;
        return { kind: 'node' as const, id: 'node', revoked: false, credentialUntil: now + 1000, report: null, invalidReport: false };
    } };
    const handoff = { async enqueueIn(actual: typeof tx, scope: string, policy: StationAlertPolicy, event: StationAlertEvent, at: number) {
        check(actual, 'enqueue'); assert.equal(scope, 'scope'); assert.equal(policy.policyId, event.policyId); assert.equal(at, now); state.queued++;
        if (state.fail === 'enqueue') throw new Error('handoff failed');
    } };
    return { state, trace, now, service: new StationAlerts(db, auth, requests, store, facts, true, () => now, 1000, handoff) };
}

test('station worker authorizes before locks and atomically appends handoff and state', async () => {
    const f = fixture(); await f.service.tick();
    assert.deepEqual(f.trace, ['begin', 'due', 'candidate', 'authorize', 'lock-scope', 'policy-locked', 'facts', 'append-event', 'enqueue', 'put-policy', 'commit']);
    assert.equal(f.state.events.length, 1); assert.equal(f.state.queued, 1); assert.equal(f.state.policy.state.condition, 'firing');
    assert.equal(f.state.events[0]!.reason, 'credential-expiring');
    assert.equal(f.state.policy.nextEvaluateAt, f.now + STATION_ALERT_LIMITS.evaluationIntervalMs);
});

test('station revoked owner suspends without reading facts or producing events', async () => {
    const f = fixture(); f.state.deny = true; await f.service.tick();
    assert.deepEqual(f.trace, ['begin', 'due', 'candidate', 'authorize', 'lock-scope', 'policy-locked', 'put-policy', 'commit']);
    assert.equal(f.state.policy.suspended, 'actor-not-authorized'); assert.deepEqual(f.state.events, []); assert.equal(f.state.queued, 0);
});

test('station handoff or state failure rolls back all event effects and defers with original guarded revision', async () => {
    for (const stage of ['enqueue', 'put']) {
        const f = fixture(), before = structuredClone(f.state.policy); f.state.fail = stage;
        await assert.rejects(f.service.tick(), new RegExp(stage === 'enqueue' ? 'handoff failed' : 'policy write failed'));
        assert.deepEqual(f.state.policy, before); assert.deepEqual(f.state.events, []); assert.equal(f.state.queued, 0);
        assert.deepEqual(f.state.deferred, [[1, f.now, f.now + 300000]]);
        assert.deepEqual(f.trace.slice(-5), ['rollback', 'begin', 'lock-scope', 'defer', 'commit']);
        f.state.fail = ''; await f.service.tick(); assert.equal(f.state.events.length, 1, 'failed tick did not release ticking guard');
    }
});

test('station worker rechecks latest revision and prevents overlapping ticks while a fact read drains', async () => {
    for (const mutate of [
        (policy: StationAlertPolicy): StationAlertPolicy => ({ ...policy, revision: policy.revision + 1 }),
        (policy: StationAlertPolicy): StationAlertPolicy => ({ ...policy, managedBy: 'successor' }),
        (policy: StationAlertPolicy): StationAlertPolicy => ({ ...policy, suspended: 'recovery' }),
        (policy: StationAlertPolicy): StationAlertPolicy => ({ ...policy, nextEvaluateAt: policy.nextEvaluateAt + 1 }),
        (policy: StationAlertPolicy): StationAlertPolicy => {
            const config = { ...policy.config, enabled: false };
            return { ...policy, config, configDigest: digest(config) };
        },
    ]) {
        const changed = fixture(); changed.state.latest = mutate(changed.state.policy);
        await changed.service.tick(); assert.ok(!changed.trace.includes('facts')); assert.equal(changed.state.events.length, 0);
        assert.ok(!changed.trace.includes('put-policy'));
    }
    const f = fixture(); let release!: () => void; f.state.gate = new Promise<void>(resolve => { release = resolve; });
    const first = f.service.tick();
    // Advance through the finite chain of asynchronous port calls without a timer or real I/O.
    for (let index = 0; index < 40 && !f.trace.includes('facts'); index++) await Promise.resolve();
    if (!f.trace.includes('facts')) { release(); await first; assert.fail('worker did not reach fact read'); }
    const before = [...f.trace]; await f.service.tick(); assert.deepEqual(f.trace, before);
    release(); await first; assert.equal(f.state.events.length, 1); assert.equal(f.state.depth, 0);
});

test('station worker suspends a formerly managing selfservice actor instead of evaluating protected facts',async()=>{
 const f=fixture();f.state.policy={...f.state.policy,managedBy:'selfservice-manager'};await f.service.tick();
 assert.deepEqual(f.trace,['begin','due','candidate','authorize','lock-scope','policy-locked','put-policy','commit']);
 assert.equal(f.state.policy.suspended,'actor-not-authorized');assert.deepEqual(f.state.events,[]);assert.equal(f.state.queued,0);
});
