import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BackgroundTasks } from '../src/framework/background-tasks.ts';

const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }

test('background effects prevent overlapping work and close joins the active task and stop hook exactly once', async () => {
    const running = deferred(), stopping = deferred(), events: string[] = []; let tick = () => {};
    const tasks = new BackgroundTasks([{ id: 'worker', intervalMs: 100, enabled: true,
        run: async () => { events.push('run'); await running.promise; events.push('run-end'); },
        onStop: async () => { events.push('stop'); await stopping.promise; events.push('stop-end'); } }],
    { now: () => 0, scheduleInterval: (action, interval) => { assert.equal(interval, 100); tick = action; events.push('schedule'); return () => { events.push('cancel'); }; } });
    tasks.start(); tasks.start(); tick(); tick(); await flush(); assert.deepEqual(events, ['schedule', 'run']);
    let closed = false; const close = tasks.close(); assert.equal(tasks.close(), close); close.then(() => { closed = true; });
    await flush(); tick(); assert.equal(closed, false); running.resolve(); await flush(); assert.equal(closed, false);
    stopping.resolve(); await close; assert.equal(events.filter(value => value === 'run').length, 1);
    assert.equal(events.filter(value => value === 'cancel').length, 1); assert.equal(events.filter(value => value === 'stop').length, 1);
    assert.throws(() => tasks.start(), /Stopped task cannot restart/);
});

test('background failure backoff uses completion time, exact thresholds and caps, then resets on success', async () => {
    let at = 1000, runs = 0, fail = true, tick = () => {}; const failures: string[] = [];
    const tasks = new BackgroundTasks([{ id: 'worker', intervalMs: 100, enabled: true, failureDelay: { initialMs: 100, maxMs: 200 },
        run: async () => { runs++; at += 10; if (fail) throw new Error('private owner error'); },
        onFailure: id => { failures.push(id); throw new Error('logger'); } }],
    { now: () => at, scheduleInterval: action => { tick = action; return () => {}; } });
    tasks.start(); tick(); await flush(); assert.equal(runs, 1);
    at = 1109; tick(); await flush(); assert.equal(runs, 1);
    at = 1110; tick(); await flush(); assert.equal(runs, 2);
    at = 1319; tick(); await flush(); assert.equal(runs, 2);
    at = 1320; tick(); await flush(); assert.equal(runs, 3);
    at = 1529; tick(); await flush(); assert.equal(runs, 3);
    at = 1530; fail = false; tick(); await flush(); assert.equal(runs, 4);
    tick(); await flush(); assert.equal(runs, 5); assert.deepEqual(failures, ['worker', 'worker', 'worker']); await tasks.close();
});

test('background shutdown waits for all independent hooks even when one fails', async () => {
    const gate = deferred(), events: string[] = [];
    const tasks = new BackgroundTasks([
        { id: 'first', intervalMs: 100, enabled: false, run: async () => {}, onStop: async () => { events.push('first'); throw new Error('private'); } },
        { id: 'second', intervalMs: 100, enabled: false, run: async () => {}, onStop: async () => { await gate.promise; events.push('second'); } },
    ], { now: () => 0, scheduleInterval: () => { throw new Error('disabled task scheduled'); } });
    tasks.start(); const close = tasks.close(); let settled = false; const rejection = assert.rejects(close, /Background task shutdown failed after draining/).then(() => { settled = true; });
    await flush(); assert.equal(settled, false); gate.resolve(); await rejection; assert.deepEqual(events, ['first', 'second']);
});
