import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CANCELLATION_INTERFACE_VERSION, NODE_REPORT_READ_INTERFACE_VERSION, NOTIFICATION_EFFECTS_INTERFACE_VERSION } from '../src/framework/public.ts';
import type { CancellationSignal, NodeObservationContext, NotificationSender } from '../src/framework/public.ts';
import { ControlledNotificationHttps } from '../src/infrastructure/notification-https.ts';

test('native signal identity crosses both public cancellation ports without wrappers or altered reason', async () => {
    const controller = new AbortController(), signal: CancellationSignal = controller.signal;
    const context: NodeObservationContext = { actorId: 'actor-a', scopeId: 'scope-a', nodeId: 'node-a', deadlineAt: 1, signal };
    const input: Parameters<NotificationSender['send']>[0] = {
        destination: 'https://example.com/hook', deliveryId: 'delivery-a', body: '{}', secret: new Uint8Array(32),
        beforeDispatch: async () => assert.fail('a cancelled attempt cannot dispatch'), signal,
    };
    assert.equal(CANCELLATION_INTERFACE_VERSION, 1); assert.equal(NODE_REPORT_READ_INTERFACE_VERSION, 2);
    assert.equal(NOTIFICATION_EFFECTS_INTERFACE_VERSION, 2);
    assert.equal(context.signal, controller.signal); assert.equal(input.signal, controller.signal);
    const reason = new Error('cancelled by original controller');
    controller.abort(reason);
    assert.equal(context.signal.reason, reason); assert.throws(() => context.signal.throwIfAborted(), error => error === reason);
    const sender = new ControlledNotificationHttps();
    try { assert.deepEqual(await sender.send(input), { outcome: 'rejected', code: 'ABORTED', statusCode: null }); }
    finally { await sender.close(); }
});

test('a common cancellation provider needs no native EventTarget members for sender pre-admission refusal', async () => {
    const reason = { code: 'cancelled' };
    const signal: CancellationSignal = {
        aborted: true, reason,
        throwIfAborted: () => { throw reason; },
        addEventListener: () => assert.fail('pre-cancelled attempt cannot subscribe'),
        removeEventListener: () => assert.fail('pre-cancelled attempt cannot remove an unregistered callback'),
    };
    const sender = new ControlledNotificationHttps();
    try {
        assert.deepEqual(await sender.send({ destination: 'https://example.com/hook', deliveryId: 'delivery-a', body: '{}',
            secret: new Uint8Array(32), beforeDispatch: async () => assert.fail('pre-cancelled attempt cannot dispatch'), signal }),
        { outcome: 'rejected', code: 'ABORTED', statusCode: null });
    } finally { await sender.close(); }
});
