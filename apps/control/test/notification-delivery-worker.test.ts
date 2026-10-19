import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nativeValueDigest as digest } from '../src/compatibility/public.ts';
import { ControlError } from '../src/framework/public.ts';
import { NotificationDeliveries, notificationDeliveryId, parseNotificationPayload } from '../src/modules/notification-owner/public.ts';
import type { NotificationDelivery, NotificationDeliveryAttempt, NotificationDeliveryStore, NotificationEndpointStore,
    NotificationEndpoint, NotificationSender, NotificationSecrets, NotificationSendResult } from '../src/modules/notification-owner/public.ts';
import { emptyStationAlertState } from '../src/modules/station-alert-owner/public.ts';
import type { StationAlertPolicy } from '../src/modules/station-alert-owner/public.ts';

function fixture() {
    const now = 1800000000000, binding = 'sha256:' + 'a'.repeat(64), reference = 'b'.repeat(64), events: string[] = [];
    const id = notificationDeliveryId('scope', 'event', 'endpoint');
    const payload = parseNotificationPayload({ notificationVersion: 1, deliveryId: id, scopeId: 'scope', event: {
        id: 'event', policyId: 'policy', configRevision: 1, episode: 1, kind: 'firing', rule: 'forward-operation-failed',
        target: { kind: 'forward', id: 'forward' }, reason: 'operation-failed', occurredAt: now,
    } });
    const config: NotificationEndpoint['config'] = { schemaVersion: 1, enabled: true, policyIds: ['policy'], kinds: ['firing'], minimumIntervalSeconds: 10 };
    const endpoint: NotificationEndpoint = { endpointId: 'endpoint', revision: 1, credentialRevision: 1, config, configDigest: digest(config),
        managedBy: 'endpoint-manager', createdAt: now, updatedAt: now, suspended: 'none', authorityDigest: binding, credentialRef: reference };
    const policyConfig: StationAlertPolicy['config'] = { schemaVersion: 1, rule: 'forward-operation-failed', target: { kind: 'forward', id: 'forward' }, enabled: true, thresholdSeconds: 0 };
    const policy: StationAlertPolicy = { policyId: 'policy', revision: 1, configRevision: 1, config: policyConfig, configDigest: digest(policyConfig),
        managedBy: 'policy-manager', createdAt: now, updatedAt: now, silencedUntil: null, suspended: 'none', nextEvaluateAt: now, state: emptyStationAlertState() };
    const queued: NotificationDelivery = { id, eventId: 'event', policyId: 'policy', endpointId: 'endpoint', policyConfigRevision: 1,
        endpointRevision: 1, credentialRevision: 1, policyManagedBy: policy.managedBy, endpointManagedBy: endpoint.managedBy, authorityDigest: binding,
        payload, payloadDigest: digest(payload), revision: 1, status: 'queued', attemptCount: 0, fence: 0, claimedAt: null, claimUntil: null,
        createdAt: now, updatedAt: now, nextAttemptAt: now, expiresAt: now + 3600000, lastCode: null, lastOutcome: 'none', lastStatusCode: null, recoverySuspended: false };
    const state = { row: queued, attempts: [] as NotificationDeliveryAttempt[], result: { outcome: 'unknown', code: 'NETWORK_UNKNOWN', statusCode: null } as NotificationSendResult,
        deny: false, fail: '', sends: 0, released: 0, rateReservations: 0, idle: Promise.resolve(), sentSecret: undefined as Uint8Array | undefined,
        idleEntered: undefined as (() => void) | undefined, hookBeforeDispatch: () => {}, active: null as object | null, transactionCount: 0 };
    const db = { async transaction<T>(action: (tx: object) => Promise<T>) {
        assert.equal(state.active, null, 'network effects and owner transactions must not nest');
        const tx = Object.freeze({ sequence: ++state.transactionCount }), saved = structuredClone({ row: state.row, attempts: state.attempts, rateReservations: state.rateReservations });
        state.active = tx; events.push('begin');
        try { const response = await action(tx); events.push('commit'); return response; }
        catch (error) { Object.assign(state, saved); events.push('rollback'); throw error; }
        finally { state.active = null; }
    } };
    const checked = (tx: object, event: string) => { assert.equal(tx, state.active); events.push(event); };
    const store: NotificationDeliveryStore<object> = {
        async lockScope(tx) { checked(tx, 'outbox-lock'); },
        async due(tx, at) { checked(tx, 'due'); return !['delivered', 'dead-letter', 'cancelled'].includes(state.row.status) && state.row.nextAttemptAt <= at ?
            { scopeId: 'scope', id, revision: state.row.revision } : null; },
        async get(tx) { checked(tx, 'delivery'); return state.row; },
        async activeCount(tx) { checked(tx, 'active-count'); return 0; },
        async reserveRate(tx, _scope, _endpoint, at, interval) { checked(tx, 'rate'); assert.equal(interval, 10000); state.rateReservations++; return at; },
        async put(tx, _scope, value) { checked(tx, 'put:' + value.status); state.row = value; },
        async appendAttempt(tx, _scope, attempt) {
            checked(tx, 'append-attempt'); state.attempts.push(attempt);
            if (state.fail === 'append') throw new Error('attempt write unavailable');
        },
        async finishAttempt(tx, _scope, _id, attempt) {
            checked(tx, 'finish-attempt'); state.attempts = state.attempts.map(v => v.id === attempt.id ? attempt : v);
            if (state.fail === 'finish') throw new Error('finish write unavailable');
        },
        async defer(tx) { checked(tx, 'defer'); },
        async attempts(tx) { checked(tx, 'attempts'); return state.attempts; },
        async losses(tx) { checked(tx, 'losses'); return { queueRejected: 0, routingRejected: 0, silenceSuppressed: 0, disabledSuppressed: 0, rowsExpired: 0, rowsEvicted: 0, attemptsEvicted: 0 }; },
        async history() { assert.fail('not a history request'); }, async loss() { assert.fail('not a routing request'); }, async insert() { assert.fail('not enqueue'); },
    };
    const endpoints: NotificationEndpointStore<object> = {
        async lockScope(tx) { checked(tx, 'endpoint-lock'); }, async get(tx) { checked(tx, 'endpoint'); return endpoint; },
        async count() { assert.fail('not endpoint write'); }, async list() { assert.fail('not enqueue'); }, async put() { assert.fail('not endpoint write'); },
        async audit() { assert.fail('not endpoint write'); }, async audits() { assert.fail('not endpoint query'); }, async auditLosses() { assert.fail('not endpoint query'); },
    };
    const secrets: NotificationSecrets = {
        async acquire(actual, ref) {
            assert.equal(state.active, null); events.push('acquire');
            assert.deepEqual(actual, { scopeId: 'scope', endpointId: 'endpoint', credentialRevision: 1, authorityDigest: binding }); assert.equal(ref, reference);
            if (state.fail === 'acquire') throw new Error('private material unavailable');
            return { destination: { url: 'https://notify.tunex.org/hook', signingKey: 'c'.repeat(64) }, release() { events.push('release'); state.released++; } };
        },
        async read() { assert.fail('worker must acquire a lease'); }, async stage() { assert.fail('worker must not stage credentials'); }, async close() {},
    };
    const sender: NotificationSender = {
        async send(input) {
            assert.equal(state.active, null); events.push('send'); state.sends++; state.sentSecret = input.secret;
            assert.equal(input.deliveryId, id); assert.equal(JSON.parse(input.body).deliveryId, id);
            assert.equal(input.body.includes(reference), false); assert.equal(input.secret.length, 32);
            state.hookBeforeDispatch(); const allowed = await input.beforeDispatch(); events.push('guard:' + allowed);
            return allowed ? state.result : { outcome: 'rejected', code: 'DISPATCH_DENIED', statusCode: null };
        },
        async idle() { assert.equal(state.active, null); events.push('idle'); state.idleEntered?.(); await state.idle; },
        async close() { events.push('sender-close'); },
    };
    const host = new NotificationDeliveries({ db, store, endpoints, secrets, sender, enabled: true, clock: () => now,
        auth: { async scope(tx, actor, scope, manage) {
            checked(tx, 'authorize:' + actor); assert.equal(scope, 'scope'); assert.equal(manage, true);
            if (state.deny) throw new ControlError('AUTHORIZATION_DENIED', 403, 'denied');
        } },
        policies: { async lockScope(tx) { checked(tx, 'policy-lock'); }, async policy(tx) { checked(tx, 'policy'); return policy; } },
        authorityBinding: async () => { events.push('authority'); return binding; },
    });
    return { host, state, events, now, id };
}

test('delivery worker commits its bounded claim before leasing secrets, reauthorizes the dispatch and records an unknown result without immediate resend', async () => {
    const f = fixture(); await f.host.tick();
    assert.deepEqual([f.state.row.status, f.state.row.lastOutcome, f.state.row.lastCode], ['retry-wait', 'unknown', 'NETWORK_UNKNOWN']);
    assert.equal(f.state.row.nextAttemptAt, f.now + 30000); assert.equal(f.state.row.attemptCount, 1);
    assert.deepEqual(f.state.attempts.map(a => a.outcome), ['unknown']); assert.equal(f.state.sends, 1);
    assert.ok(f.events.indexOf('append-attempt') < f.events.indexOf('commit'));
    assert.ok(f.events.indexOf('commit') < f.events.indexOf('acquire'));
    assert.deepEqual(f.events.slice(0, f.events.indexOf('acquire')).filter(e => e.startsWith('authorize:')),
        ['authorize:endpoint-manager', 'authorize:policy-manager']);
    assert.ok(f.events.indexOf('policy-lock') < f.events.indexOf('endpoint-lock'));
    assert.ok(f.events.indexOf('endpoint-lock') < f.events.indexOf('outbox-lock'));
    assert.ok(f.events.indexOf('send') < f.events.indexOf('guard:true'));
    assert.deepEqual(f.events.slice(-2), ['idle', 'release']); assert.ok(f.state.sentSecret!.every(value => value === 0));
    await f.host.tick(); assert.equal(f.state.sends, 1); assert.equal(f.state.row.fence, 1);
    await f.host.close();
});

test('revoked manager after claim cancels dispatch and secret unavailability records refusal without using raw credentials or another sender', async () => {
    const denied = fixture(); denied.state.hookBeforeDispatch = () => { denied.state.deny = true; };
    await denied.host.tick();
    assert.deepEqual([denied.state.row.status, denied.state.row.lastCode], ['cancelled', 'DISPATCH_DENIED']);
    assert.equal(denied.events.filter(v => v === 'guard:false').length, 1); assert.equal(denied.state.released, 1);
    const missing = fixture(); missing.state.fail = 'acquire'; await missing.host.tick();
    assert.deepEqual([missing.state.row.status, missing.state.row.lastCode], ['dead-letter', 'CREDENTIAL_UNAVAILABLE']);
    assert.equal(missing.state.sends, 0); assert.equal(missing.state.released, 0);
    await denied.host.close(); await missing.host.close();
});

test('failed claim and finish writes roll back their owner transaction without a hidden resend or resetting the existing fence', async () => {
    const claim = fixture(); claim.state.fail = 'append'; await assert.rejects(claim.host.tick(), /attempt write unavailable/);
    assert.equal(claim.state.row.status, 'queued'); assert.equal(claim.state.row.fence, 0); assert.equal(claim.state.attempts.length, 0);
    assert.equal(claim.state.rateReservations, 0); assert.equal(claim.state.sends, 0);
    const finish = fixture(); finish.state.fail = 'finish'; await assert.rejects(finish.host.tick(), /finish write unavailable/);
    assert.equal(finish.state.row.status, 'claimed'); assert.equal(finish.state.row.fence, 1);
    assert.deepEqual(finish.state.attempts.map(a => a.outcome), ['pending']); assert.equal(finish.state.sends, 1);
    assert.equal(finish.events.filter(e => e === 'defer').length, 1); assert.equal(finish.state.released, 1);
    assert.ok(finish.state.sentSecret!.every(value => value === 0));
    await claim.host.close(); await finish.host.close();
});

test('worker retains its secret lease and coalesces ticks until sender physical drain, and close joins that drain', async () => {
    const f = fixture(); let release!: () => void, entered!: () => void;
    const atIdle = new Promise<void>(resolve => { entered = resolve; });
    f.state.idle = new Promise<void>(resolve => { release = resolve; }); f.state.idleEntered = entered;
    const running = f.host.tick(); await atIdle;
    assert.equal(f.state.released, 0); assert.ok(f.state.sentSecret!.every(value => value === 0));
    await f.host.tick(); assert.equal(f.state.sends, 1);
    let closed = false; const closing = f.host.close().then(() => { closed = true; });
    await Promise.resolve(); assert.equal(closed, false); assert.equal(f.state.released, 0);
    release(); await running; await closing;
    assert.equal(f.state.released, 1); assert.equal(closed, true);
    const view = await f.host.get('manager', 'scope', f.id);
    const serialized = JSON.stringify(view);
    assert.equal(serialized.includes('credentialRef'), false); assert.equal(serialized.includes('authorityDigest'), false);
    assert.equal(serialized.includes('signingKey'), false); assert.equal(serialized.includes('notify.tunex.org'), false);
});
