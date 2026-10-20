import assert from 'node:assert/strict';
import { test } from 'node:test';
import dns from 'node:dns';
import https from 'node:https';
import type { RequestOptions } from 'node:https';
import type { ClientRequest, IncomingMessage } from 'node:http';
import { EventEmitter } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import { ControlledNotificationHttps } from '../src/infrastructure/notification-https.ts';
import type { CancellationSignal, NotificationSender } from '../src/framework/public.ts';

type Answer = (error: NodeJS.ErrnoException | null, answers: dns.LookupAddress[]) => void;
const input = (signal?: AbortSignal): Parameters<NotificationSender['send']>[0] => ({
    destination: 'https://notify.tunex.org/hook', deliveryId: 'delivery', body: '{"event":"bounded"}',
    secret: new Uint8Array(32).fill(7), beforeDispatch: async () => true, ...(signal ? { signal } : {}),
});

test('a common cancellation registration race removes the same once callback and never enters DNS', async t => {
    const lookup = t.mock.method(dns, 'lookup', (() => assert.fail('already cancelled registration must not resolve')) as unknown as typeof dns.lookup);
    syncBuiltinESMExports(); t.after(() => { lookup.mock.restore(); syncBuiltinESMExports(); });
    const sender = new ControlledNotificationHttps();
    // Three calls exceed the two-attempt capacity if either prior race leaks it.
    for (let attempt = 0; attempt < 3; attempt++) {
        let cancelled = false, registered: (() => void) | undefined, removed: (() => void) | undefined;
        const reason = new Error('original reason'), signal: CancellationSignal = {
            get aborted() { return cancelled; }, get reason() { return reason; },
            throwIfAborted() { if (cancelled) throw reason; },
            addEventListener(type, listener, options) {
                assert.equal(type, 'abort'); assert.deepEqual(options, { once: true });
                registered = listener; cancelled = true; listener();
            },
            removeEventListener(type, listener) { assert.equal(type, 'abort'); removed = listener; },
        };
        assert.deepEqual(await sender.send({ ...input(), signal }), { outcome: 'rejected', code: 'ABORTED', statusCode: null });
        assert.equal(registered, removed); assert.equal(signal.reason, reason); assert.throws(() => signal.throwIfAborted(), error => error === reason);
    }
    let drained = false; const closing = sender.close().then(() => { drained = true; });
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(drained, true, 'registration-race cancellation has no DNS, guard or socket left to drain');
    await closing; assert.equal(lookup.mock.callCount(), 0);
});

test('cancelled DNS still owns sender capacity and close waits for the actual callbacks without another lookup or request', async t => {
    const callbacks: Answer[] = [];
    const lookup = t.mock.method(dns, 'lookup', ((_host: string, _options: unknown, callback: Answer) => {
        callbacks.push(callback);
    }) as unknown as typeof dns.lookup);
    const request = t.mock.method(https, 'request', (() => assert.fail('cancelled DNS must not dispatch HTTPS')) as unknown as typeof https.request);
    syncBuiltinESMExports();
    t.after(() => { lookup.mock.restore(); request.mock.restore(); syncBuiltinESMExports(); });
    const sender = new ControlledNotificationHttps(), first = new AbortController(), second = new AbortController();
    const a = sender.send(input(first.signal)), b = sender.send(input(second.signal));
    assert.equal(callbacks.length, 2); first.abort(new Error('caller cancellation'));
    assert.deepEqual(await a, { outcome: 'rejected', code: 'ABORTED', statusCode: null });
    assert.deepEqual(await sender.send(input()), { outcome: 'rejected', code: 'CAPACITY_UNAVAILABLE', statusCode: null });
    let drained = false; const closing = sender.close().then(() => { drained = true; });
    assert.deepEqual(await b, { outcome: 'rejected', code: 'ABORTED', statusCode: null });
    await Promise.resolve(); assert.equal(drained, false);
    callbacks[0]!(null, [{ address: '1.1.1.1', family: 4 }]);
    await Promise.resolve(); assert.equal(drained, false);
    callbacks[1]!(null, [{ address: '1.1.1.1', family: 4 }]); await closing;
    assert.equal(drained, true); assert.equal(callbacks.length, 2); assert.equal(request.mock.callCount(), 0);
    assert.deepEqual(await sender.send(input()), { outcome: 'rejected', code: 'ABORTED', statusCode: null });
});

test('cancelled authorization guards retain capacity until both real guards settle, including a late guard failure', async t => {
    const lookup = t.mock.method(dns, 'lookup', ((_host: string, _options: unknown, callback: Answer) => {
        callback(null, [{ address: '1.1.1.1', family: 4 }]);
    }) as unknown as typeof dns.lookup);
    const request = t.mock.method(https, 'request', (() => assert.fail('cancelled guard must not dispatch HTTPS')) as unknown as typeof https.request);
    syncBuiltinESMExports();
    t.after(() => { lookup.mock.restore(); request.mock.restore(); syncBuiltinESMExports(); });
    let allow!: (value: boolean) => void, deny!: (error: Error) => void;
    const held = new Promise<boolean>(resolve => { allow = resolve; }), failed = new Promise<boolean>((_resolve, reject) => { deny = reject; });
    const sender = new ControlledNotificationHttps(), a = sender.send({ ...input(), beforeDispatch: () => held }),
        b = sender.send({ ...input(), beforeDispatch: () => failed });
    let drained = false; const closing = sender.close().then(() => { drained = true; });
    assert.equal((await a).code, 'ABORTED'); assert.equal((await b).code, 'ABORTED');
    allow(true); await Promise.resolve(); await Promise.resolve(); assert.equal(drained, false);
    deny(new Error('late authorization failure')); await closing;
    assert.equal(drained, true); assert.equal(lookup.mock.callCount(), 2); assert.equal(request.mock.callCount(), 0);
});

test('one pinned HTTPS attempt preserves HTTP rejection versus unknown network outcome without redirect or retry', async t => {
    const lookup = t.mock.method(dns, 'lookup', ((_host: string, _options: unknown, callback: Answer) => {
        callback(null, [{ address: '1.1.1.1', family: 4 }]);
    }) as unknown as typeof dns.lookup);
    let outcome: number | 'network-error' = 302, calls = 0;
    const request = t.mock.method(https, 'request', ((options: RequestOptions, callback: (incoming: IncomingMessage) => void) => {
        calls++; assert.equal(options.agent, false); assert.equal(options.rejectUnauthorized, true); assert.equal(options.minVersion, 'TLSv1.3');
        assert.equal(options.path, '/hook'); assert.equal(options.servername, 'notify.tunex.org');
        const req = new EventEmitter() as ClientRequest;
        req.destroy = (() => { req.emit('close'); return req; }) as typeof req.destroy;
        req.end = (() => { queueMicrotask(() => {
            if (outcome === 'network-error') { req.emit('error', new Error('connection outcome unknown')); return; }
            const response = new EventEmitter() as IncomingMessage;
            Object.assign(response, { complete: true, statusCode: outcome });
            response.destroy = (() => response) as typeof response.destroy;
            callback(response); response.emit('end');
        }); return req; }) as typeof req.end;
        return req;
    }) as unknown as typeof https.request);
    syncBuiltinESMExports();
    t.after(() => { lookup.mock.restore(); request.mock.restore(); syncBuiltinESMExports(); });
    const sender = new ControlledNotificationHttps();
    for (const status of [302, 503, 204, 'network-error'] as const) {
        outcome = status; const secret = input().secret;
        const result = await sender.send({ ...input(), secret }); await sender.idle();
        assert.deepEqual(result, status === 'network-error' ? { outcome: 'unknown', code: 'NETWORK_UNKNOWN', statusCode: null } :
            { outcome: status === 204 ? 'delivered' : 'rejected', code: status === 204 ? 'HTTP_ACCEPTED' : 'HTTP_REJECTED', statusCode: status });
        assert.ok(secret.every(value => value === 7), 'sender must not mutate caller-owned signing bytes');
    }
    assert.equal(calls, 4); assert.equal(lookup.mock.callCount(), 4); await sender.close();
});
