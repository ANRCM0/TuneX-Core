import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ControlError, RequestLifecycle } from '../src/framework/public.ts';
import type { ModuleLogEntry, ScopeAuthorization, TransactionBoundary } from '../src/framework/public.ts';
import { flatForwardAdapter } from '../src/compatibility/public.ts';
import { ForwardImportPreviewModule, MODULE_CONTRACT_VERSION } from '../../../examples/foundation-extension/public.ts';

type Tx = { readonly identity: 'preview-transaction' };
const input = () => ({ version: 1, nodeId: 'example-node', enabled: true, protocol: 'BOTH',
    listenAddress: '127.0.0.1', listenPort: 18080, targetHost: 'Example.COM.', targetPort: 8080 });
function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    return { promise, resolve };
}

test('the public extension authorizes the caller transaction and returns detached immutable native-format intent', async () => {
    const transaction: Tx = { identity: 'preview-transaction' }, gate = deferred(), events: string[] = [], logs: ModuleLogEntry[] = [];
    const db: TransactionBoundary<Tx> = { transaction: async action => {
        events.push('begin'); const result = await action(transaction); events.push('complete'); return result;
    } };
    const auth: ScopeAuthorization<Tx> = { scope: async (tx, actor, scope, manage) => {
        assert.equal(tx, transaction); assert.equal(actor, 'example-actor'); assert.equal(scope, 'example-scope');
        assert.equal(manage, true); events.push('authorize'); await gate.promise;
    } };
    const module = new ForwardImportPreviewModule({ db, auth, adapter: flatForwardAdapter, log: { write: value => { logs.push(value); } } });
    const value = input(), pending = module.preview('example-actor', 'example-scope', value);
    value.targetHost = 'mutated.invalid'; value.protocol = 'UDP'; value.targetPort = 1;
    gate.resolve();
    const result = await pending;
    assert.equal(MODULE_CONTRACT_VERSION, 1); assert.equal(result.version, 1);
    assert.equal(result.formatId, 'tunex-flat-forward'); assert.equal(result.formatVersion, 1);
    assert.equal(result.executionAuthorized, false);
    assert.deepEqual(result.spec.protocols, ['tcp', 'udp']);
    assert.deepEqual(result.spec.target, { host: 'example.com', port: 8080 });
    assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.spec));
    assert.ok(Object.isFrozen(result.spec.protocols)); assert.ok(Object.isFrozen(result.spec.target));
    assert.ok(Object.isFrozen(result.spec.ingress.listen));
    assert.deepEqual(events, ['begin', 'authorize', 'complete']);
    assert.deepEqual(logs, [{ level: 'info', module: 'forward-import-preview', code: 'PREVIEW_READY' }]);
});

test('the public extension refuses invalid identities and closed-format input before transactions and never logs denied intent', async () => {
    let transactions = 0, logs = 0;
    const transaction: Tx = { identity: 'preview-transaction' };
    const db: TransactionBoundary<Tx> = { transaction: async action => { transactions++; return action(transaction); } };
    const denied = new ControlError('AUTHORIZATION_DENIED', 403, 'preview denied');
    const module = new ForwardImportPreviewModule({ db, adapter: flatForwardAdapter,
        auth: { scope: async tx => { assert.equal(tx, transaction); throw denied; } }, log: { write: () => { logs++; } } });
    for (const value of [{ ...input(), version: 2 }, { ...input(), protocol: 'SCTP' }, { ...input(), unknown: true },
        { ...input(), targetHost: '169.254.169.254', targetPort: 0 }, null]) {
        await assert.rejects(module.preview('example-actor', 'example-scope', value),
            error => error instanceof ControlError && error.code === 'INVALID_CONFIG');
    }
    await assert.rejects(module.preview('../actor', 'example-scope', input()),
        error => error instanceof ControlError && error.code === 'INVALID_CONFIG');
    assert.equal(transactions, 0);
    await assert.rejects(module.preview('example-actor', 'example-scope', input()), error => error === denied);
    assert.equal(transactions, 1); assert.equal(logs, 0);
});

test('the public extension completes despite logger failure and request draining waits for its actual transaction', async () => {
    const gate = deferred(), entered = deferred(), transaction: Tx = { identity: 'preview-transaction' };
    const module = new ForwardImportPreviewModule({ adapter: flatForwardAdapter,
        db: { transaction: async <T>(action: (tx: Tx) => Promise<T>) => action(transaction) },
        auth: { scope: async () => { entered.resolve(); await gate.promise; } },
        log: { write: () => { throw new Error('logger unavailable'); } } });
    const requests = new RequestLifecycle();
    const pending = requests.run(() => module.preview('example-actor', 'example-scope', input()));
    await entered.promise;
    let drained = false;
    const closing = requests.drain().then(() => { drained = true; });
    await Promise.resolve();
    assert.equal(drained, false);
    await assert.rejects(requests.run(async () => undefined),
        error => error instanceof ControlError && error.code === 'CONTROL_STOPPING');
    gate.resolve();
    assert.equal((await pending).executionAuthorized, false);
    await closing; assert.equal(drained, true);
});
