import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import dns from 'node:dns';
import https from 'node:https';
import { createHmac } from 'node:crypto';
import type { RequestOptions } from 'node:https';
import type { ClientRequest, IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import { EventEmitter } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import { ControlledNotificationHttps } from '../src/infrastructure/notification-https.ts';
import { MySqlNodeObservationReader } from '../src/infrastructure/mysql-node-observation.ts';
import type { MySqlUnitOfWork } from '../src/infrastructure/mysql.ts';
import type { CancellationSignal, NotificationSender } from '../src/framework/public.ts';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;
type SignalKeys = Expect<Equal<keyof CancellationSignal, 'aborted' | 'reason' | 'throwIfAborted' | 'addEventListener' | 'removeEventListener'>>;
type NativeSubstitution = Expect<AbortSignal extends CancellationSignal ? true : false>;
type LowerOnlyIsNotNative = Expect<CancellationSignal extends AbortSignal ? false : true>;
const typeWitness: [SignalKeys, NativeSubstitution, LowerOnlyIsNotNative] = [true, true, true];
const turn = () => new Promise<void>(resolve => setImmediate(resolve));
const value = (signal?: CancellationSignal): Parameters<NotificationSender['send']>[0] => ({ destination: 'https://notify.tunex.org/hook',
    deliveryId: 'delivery-a', body: '{"message":"bytes-\u00e9"}', secret: new Uint8Array(32).fill(7), beforeDispatch: async () => true, ...(signal ? { signal } : {}) });

function transport(t: TestContext) {
    const attempts: Array<{ request: ClientRequest; socket: Socket; options: RequestOptions & { autoSelectFamily?: boolean }; body?: Buffer; requestDestroyed: number; socketDestroyed: number;
        responses: Array<{ incoming: IncomingMessage; destroyed: number }>; respond(status: number | undefined, complete?: boolean): IncomingMessage }> = [];
    let resolutions = 0;
    const lookup = t.mock.method(dns, 'lookup', ((_host: string, _options: unknown, callback: (error: null, answers: dns.LookupAddress[]) => void) => {
        resolutions++; callback(null, [{ address: '1.1.1.1', family: 4 }, { address: '8.8.8.8', family: 4 }]);
    }) as unknown as typeof dns.lookup);
    const request = t.mock.method(https, 'request', ((options: RequestOptions, receive: (incoming: IncomingMessage) => void) => {
        const req = new EventEmitter() as ClientRequest, socket = new EventEmitter() as Socket;
        const attempt: typeof attempts[number] = { request: req, socket, options, requestDestroyed: 0, socketDestroyed: 0, responses: [], respond(status, complete = false) {
            const incoming = new EventEmitter() as IncomingMessage, record = { incoming, destroyed: 0 };
            Object.assign(incoming, { statusCode: status, complete });
            incoming.destroy = (() => { record.destroyed++; return incoming; }) as typeof incoming.destroy;
            attempt.responses.push(record); receive(incoming); return incoming;
        } };
        req.destroy = (() => { attempt.requestDestroyed++; return req; }) as typeof req.destroy;
        socket.destroy = (() => { attempt.socketDestroyed++; return socket; }) as typeof socket.destroy;
        req.end = ((body: Buffer) => { attempt.body = body; req.emit('socket', socket); return req; }) as typeof req.end;
        attempts.push(attempt); return req;
    }) as unknown as typeof https.request);
    syncBuiltinESMExports();
    const sender = new ControlledNotificationHttps();
    t.after(async () => {
        const closed = sender.close();
        for (const attempt of attempts) { attempt.request.emit('close'); attempt.socket.emit('close'); }
        await closed; lookup.mock.restore(); request.mock.restore(); syncBuiltinESMExports();
    });
    return { attempts, sender, resolutions: () => resolutions };
}

test('211 lower cancellation has its exact minimal keys and observation registration races preserve the original reason and callback', async () => {
    assert.deepEqual(typeWitness, [true, true, true]);
    const events: string[] = [], reason = {}, callbacks: Array<() => void> = [], removed: Array<() => void> = [];
    let cancelled = false;
    const signal: CancellationSignal = {
        get aborted() { return cancelled; }, get reason() { return reason; },
        throwIfAborted() { assert.equal(this, signal); events.push('throw'); if (cancelled) throw reason; },
        addEventListener(type, callback, options) { assert.equal(this, signal); assert.equal(type, 'abort'); assert.deepEqual(options, { once: true });
            callbacks.push(callback); events.push('subscribe'); cancelled = true; callback(); },
        removeEventListener(type, callback) { assert.equal(this, signal); assert.equal(type, 'abort'); removed.push(callback); events.push('remove'); },
    };
    const tx = { connection: { stream: { destroy(error: Error) { assert.equal(error.message, 'Observation connection stopped'); events.push('stop'); } } },
        destroy() { assert.equal(this, tx); events.push('destroy'); }, release() { assert.fail('cancelled connection must not reenter pool'); } };
    const db = { pool: { async getConnection() { events.push('pool'); return tx; } }, guard() { assert.fail('registration cancellation precedes guard'); } } as unknown as MySqlUnitOfWork;
    const reader = new MySqlNodeObservationReader(db, { scope: async () => assert.fail('registration cancellation precedes authorization') });
    const context = { actorId: 'actor', scopeId: 'scope', nodeId: 'node', deadlineAt: 1, signal };
    await assert.rejects(reader.read(context), error => error === reason);
    assert.deepEqual(events, ['throw', 'pool', 'subscribe', 'stop', 'destroy', 'throw', 'remove']);
    assert.deepEqual(removed, callbacks); assert.equal(context.signal, signal); assert.equal(context.signal.reason, reason);
    await assert.rejects(reader.read(context), error => error === reason); assert.equal(events.at(-1), 'throw');
    assert.equal(events.filter(event => event === 'pool').length, 1);
});

test('211 request cancellation stays unknown and holds capacity until both native close events, with late callbacks unable to release another attempt', async t => {
    const f = transport(t), first = new AbortController(), a = f.sender.send(value(first.signal)), b = f.sender.send(value());
    await turn(); assert.equal(f.attempts.length, 2);
    const owned = f.attempts[0]!; first.abort(new Error('original request cancellation'));
    assert.deepEqual(await a, { outcome: 'unknown', code: 'ABORTED', statusCode: null });
    assert.ok(owned.requestDestroyed > 0); assert.ok(owned.socketDestroyed > 0);
    assert.deepEqual(await f.sender.send(value()), { outcome: 'rejected', code: 'CAPACITY_UNAVAILABLE', statusCode: null });
    let idle = false; void f.sender.idle().then(() => { idle = true; });
    const late = owned.respond(204, true); late.emit('end'); assert.equal(owned.responses[0]!.destroyed, 1);
    owned.socket.emit('close'); await turn(); assert.equal(idle, false);
    assert.equal((await f.sender.send(value())).code, 'CAPACITY_UNAVAILABLE', 'closed socket alone does not drain the request');
    owned.request.emit('close'); await turn();
    const c = f.sender.send(value()); await turn(); assert.equal(f.attempts.length, 3);
    owned.request.emit('close'); owned.socket.emit('close'); late.emit('end');
    assert.equal((await f.sender.send(value())).code, 'CAPACITY_UNAVAILABLE', 'old close callbacks cannot release a new active attempt');
    const closing = f.sender.close();
    assert.equal((await b).outcome, 'unknown'); assert.equal((await c).outcome, 'unknown');
    for (const attempt of f.attempts.slice(1)) { attempt.request.emit('close'); attempt.socket.emit('close'); }
    await closing; assert.equal(idle, true); assert.equal(f.resolutions(), 3);
});

test('211 response cancellation destroys the partial response request and socket, removes the identical once callback and waits for actual drain', async t => {
    const f = transport(t), reason = {}, registered: Array<() => void> = [], removed: Array<() => void> = [];
    let cancelled = false;
    const signal: CancellationSignal = { get aborted() { return cancelled; }, get reason() { return reason; },
        throwIfAborted() { if (cancelled) throw reason; },
        addEventListener(type, listener, options) { assert.equal(type, 'abort'); assert.deepEqual(options, { once: true }); registered.push(listener); },
        removeEventListener(type, listener) { assert.equal(type, 'abort'); removed.push(listener); } };
    const pending = f.sender.send(value(signal)); await turn(); const owned = f.attempts[0]!, response = owned.respond(200);
    response.emit('data', Buffer.alloc(4096)); let settled = false; void pending.then(() => { settled = true; }); await turn(); assert.equal(settled, false);
    cancelled = true; registered[0]!();
    assert.deepEqual(await pending, { outcome: 'unknown', code: 'ABORTED', statusCode: null });
    assert.deepEqual(removed, registered); assert.equal(signal.reason, reason);
    assert.equal(owned.responses[0]!.destroyed, 1); assert.equal(owned.requestDestroyed, 1); assert.equal(owned.socketDestroyed, 1);
    let closed = false; const closing = f.sender.close().then(() => { closed = true; }); await turn(); assert.equal(closed, false);
    owned.request.emit('close'); await turn(); assert.equal(closed, false);
    response.emit('data', Buffer.from([1])); response.emit('aborted'); response.emit('error', new Error('late')); response.emit('end');
    assert.deepEqual(removed, registered, 'late response events cannot settle or remove twice');
    owned.socket.emit('close'); await closing; assert.equal(closed, true);
    assert.deepEqual(await f.sender.send(value()), { outcome: 'rejected', code: 'ABORTED', statusCode: null });
});

test('211 pinned dispatch keeps literal signing bytes and response bounds while end error abort and incomplete bodies retain original classifications', async t => {
    const f = transport(t);
    for (const mode of ['limit', 'aborted', 'error', 'incomplete', 'missing-status', 'bad-status', 'accepted', 'rejected'] as const) {
        const input = value(), pending = f.sender.send(input); await turn(); const owned = f.attempts.at(-1)!;
        assert.equal(owned.body!.toString('utf8'), input.body);
        assert.deepEqual(owned.options.headers, { Host: 'notify.tunex.org', 'Content-Type': 'application/json', Accept: 'application/json',
            'Content-Length': Buffer.byteLength(input.body, 'utf8'), Connection: 'close', 'X-TuneX-Delivery-Id': 'delivery-a',
            'X-TuneX-Signature': 'v1=' + createHmac('sha256', input.secret).update('delivery-a\n', 'utf8').update(Buffer.from(input.body, 'utf8')).digest('hex') });
        assert.equal(owned.options.path, '/hook'); assert.equal(owned.options.agent, false); assert.equal(owned.options.autoSelectFamily, false);
        let pinned = false;
        (owned.options.lookup as (...args: any[]) => void)('ignored-other-host', {}, (error: unknown, address: string, family: number) => {
            assert.equal(error, null); assert.equal(address, '1.1.1.1'); assert.equal(family, 4); pinned = true;
        }); assert.equal(pinned, true);
        const response = owned.respond(mode === 'missing-status' ? undefined : mode === 'bad-status' ? 600 : mode === 'accepted' ? 299 : 300, mode !== 'incomplete');
        if (mode === 'limit') { response.emit('data', Buffer.alloc(4096)); response.emit('data', Buffer.from([0])); }
        else if (mode === 'aborted') response.emit('aborted');
        else if (mode === 'error') response.emit('error', new Error('partial failure'));
        else response.emit('end');
        assert.deepEqual(await pending, mode === 'accepted' ? { outcome: 'delivered', code: 'HTTP_ACCEPTED', statusCode: 299 } :
            mode === 'rejected' ? { outcome: 'rejected', code: 'HTTP_REJECTED', statusCode: 300 } :
            { outcome: 'unknown', code: mode === 'limit' ? 'RESPONSE_LIMIT' : 'NETWORK_UNKNOWN', statusCode: null }, mode);
        let drained = false; void f.sender.idle().then(() => { drained = true; }); await turn(); assert.equal(drained, false);
        owned.request.emit('close'); owned.socket.emit('close'); await f.sender.idle(); assert.equal(drained, true);
        assert.ok(input.secret.every(byte => byte === 7));
    }
    assert.equal(f.attempts.length, 8); assert.equal(f.resolutions(), 8);
});
