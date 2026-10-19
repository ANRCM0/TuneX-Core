import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BackgroundTasks } from '../src/framework/background-tasks.ts';
import type { BackgroundTask, BackgroundTaskEffects } from '../src/framework/background-tasks.ts';
import { BackgroundTasks as NativeBackgroundTasks } from '../src/application/background-tasks.ts';

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const declaration = (extra: Partial<BackgroundTask> = {}): BackgroundTask => ({ id: 'worker', enabled: true, intervalMs: 100, run: async () => {}, ...extra });
const unusedEffects: BackgroundTaskEffects = { now: () => assert.fail('constructor sampled time'), scheduleInterval: () => assert.fail('constructor scheduled work') };

test('aggregate registration errors precede missing effects and declaration errors retain their own order without effects', async () => {
    for (const options of [null, {}, Array.from({ length: 65 }, (_, n) => declaration({ id: `task-${n}` })), [declaration(), declaration()]]) {
        assert.throws(() => new BackgroundTasks(options as never, undefined as never), { message: 'Unique bounded background task registrations required' });
    }
    for (const effects of [undefined, {}, { now: 1 }, { now: () => 0 }, { now: () => 0, scheduleInterval: 1 }]) {
        assert.throws(() => new BackgroundTasks([declaration({ id: 'INVALID' })], effects as never), { message: 'Background task scheduling effects are required' });
    }
    for (const change of [{ id: '' }, { id: 'A' }, { id: 'a'.repeat(65) }, { intervalMs: 99 }, { intervalMs: 3600001 },
        { intervalMs: 100.5 }, { intervalMs: NaN }, { enabled: 1 }, { run: null }, { onStop: 0 }, { onFailure: false }]) {
        assert.throws(() => new BackgroundTasks([declaration(change as never)], unusedEffects), { message: 'Bounded background task declaration required' });
    }
    for (const delay of [{ initialMs: 99, maxMs: 100 }, { initialMs: 200, maxMs: 100 }, { initialMs: 100, maxMs: 3600001 },
        { initialMs: NaN, maxMs: 100 }, { initialMs: 100, maxMs: 100.5 }]) {
        assert.throws(() => new BackgroundTasks([declaration({ failureDelay: delay })], unusedEffects), { message: 'Bounded background task backoff required' });
    }
    const empty = new BackgroundTasks([], unusedEffects); empty.start(); await empty.close();
    const disabled = new BackgroundTasks([declaration({ enabled: false, intervalMs: 3600000 })], unusedEffects);
    disabled.start(); disabled.start(); await disabled.close();
});

test('native construction inherits the host, defers first work and dynamically resolves timers and monotonic time', async t => {
    const events: string[] = []; let tick = () => {}, runs = 0;
    const handle = {} as ReturnType<typeof setInterval>;
    const clock = t.mock.method(performance, 'now', () => { events.push('clock-before'); return 0; });
    const interval = t.mock.method(globalThis, 'setInterval', (() => assert.fail('construction must not schedule')) as unknown as typeof setInterval);
    const clear = t.mock.method(globalThis, 'clearInterval', (() => assert.fail('construction must not cancel')) as typeof clearInterval);
    const tasks = new NativeBackgroundTasks([declaration({ run: async () => { runs++; events.push('run'); } })]);
    assert.ok(tasks instanceof BackgroundTasks); assert.equal(NativeBackgroundTasks.name, 'BackgroundTasks');
    assert.notEqual(NativeBackgroundTasks, BackgroundTasks); assert.equal(events.length, 0);
    interval.mock.mockImplementation(((action: () => void, ms: number) => { assert.equal(ms, 100); tick = action; events.push('schedule'); return handle; }) as typeof setInterval);
    tasks.start(); tasks.start(); assert.deepEqual(events, ['schedule']); assert.equal(runs, 0);
    clock.mock.mockImplementation(() => { events.push('clock-after'); return 1; });
    tick(); assert.equal(runs, 0); tick(); await flush();
    assert.equal(runs, 1); assert.deepEqual(events, ['schedule', 'clock-after', 'run']);
    clear.mock.mockImplementation((timer => { assert.equal(timer, handle); events.push('clear-after'); }) as typeof clearInterval);
    const closing = tasks.close(); assert.equal(tasks.close(), closing); await closing;
    tick(); await flush(); assert.equal(runs, 1); assert.equal(events.filter(event => event === 'clear-after').length, 1);
    assert.throws(() => tasks.start(), { message: 'Stopped task cannot restart' });
});

test('provider and declaration receivers retain copied frozen configuration and cancellation is retryable after a throw', async () => {
    const events: string[] = []; let tick = () => {}, cancels = 0, originalRun = 0;
    let runReceiver: unknown, failureReceiver: unknown;
    const options: BackgroundTask = declaration({
        failureDelay: { initialMs: 100, maxMs: 100 },
        async run(this: unknown) { runReceiver = this; originalRun++; throw new Error('private failure'); },
        onFailure(this: unknown, id) { failureReceiver = this; assert.equal(id, 'worker'); events.push('failure'); },
    });
    const effects: BackgroundTaskEffects = {
        now() { assert.equal(this, effects); events.push('clock'); return 0; },
        scheduleInterval(action, ms) { assert.equal(this, effects); assert.equal(ms, 100); tick = action;
            return () => { cancels++; if (cancels === 1) throw new Error('cancel once'); }; },
    };
    const tasks = new BackgroundTasks([options], effects);
    (options as { run: () => Promise<void> }).run = async () => assert.fail('mutated declaration run');
    (options.failureDelay as { initialMs: number }).initialMs = 1000;
    tasks.start(); tick(); await flush(); assert.equal(originalRun, 1);
    assert.notEqual(runReceiver, options); assert.equal(runReceiver, failureReceiver);
    assert.equal(Object.isFrozen(runReceiver), true);
    assert.deepEqual((runReceiver as BackgroundTask).failureDelay, { initialMs: 100, maxMs: 100 });
    assert.equal(Object.isFrozen((runReceiver as BackgroundTask).failureDelay), true);
    assert.deepEqual(events, ['clock', 'clock', 'failure']);
    assert.throws(() => tasks.close(), { message: 'cancel once' });
    tick(); await flush(); assert.equal(originalRun, 1, 'stopping short-circuits after a failed cancellation');
    const closing = tasks.close(); assert.equal(tasks.close(), closing); await closing; assert.equal(cancels, 2);
});

test('failure delays stay capped beyond sixteen failures and no-delay failures use only admission samples', async () => {
    let now = 0, next = 0, runs = 0, tick = () => {}, clockReads = 0;
    const tasks = new BackgroundTasks([declaration({ failureDelay: { initialMs: 100, maxMs: 3600000 },
        run: async () => { runs++; now += 7; throw new Error('private'); } })],
    { now: () => { clockReads++; return now; }, scheduleInterval: action => { tick = action; return () => {}; } });
    tasks.start();
    for (let failure = 1; failure <= 20; failure++) {
        now = next; tick(); await flush(); assert.equal(runs, failure);
        const delay = Math.min(3600000, 100 * 2 ** (Math.min(failure, 16) - 1));
        next = now + delay; now = next - 1; tick(); await flush(); assert.equal(runs, failure);
    }
    assert.equal(clockReads, 60); await tasks.close();
    let reads = 0, immediateRuns = 0;
    const noDelay = new BackgroundTasks([declaration({ run: async () => { immediateRuns++; throw new Error('private'); }, onFailure: () => { throw new Error('logger'); } })],
    { now: () => { reads++; return 0; }, scheduleInterval: action => { tick = action; return () => {}; } });
    noDelay.start(); tick(); await flush(); tick(); await flush();
    assert.equal(immediateRuns, 2); assert.equal(reads, 2); await noDelay.close();
});

test('independent tasks retain registration order, own active slots and sanitize errors only after all hooks settle', async () => {
    const events: string[] = [], ticks: Array<() => void> = []; let finish!: () => void, stop!: () => void;
    const active = new Promise<void>(resolve => { finish = resolve; }), stopping = new Promise<void>(resolve => { stop = resolve; });
    const tasks = new BackgroundTasks([
        declaration({ id: 'first', run: async () => { events.push('first-run'); await active; events.push('first-end'); },
            onStop: async () => { events.push('first-stop'); throw new Error('secret first-stop detail'); } }),
        declaration({ id: 'second', intervalMs: 200, run: async () => { events.push('second-run'); },
            onStop: async () => { await stopping; events.push('second-stop'); } }),
    ], { now: () => 0, scheduleInterval: (action, ms) => { events.push(`schedule:${ms}`); ticks.push(action); return () => events.push(`cancel:${ms}`); } });
    tasks.start(); ticks[0]!(); ticks[1]!(); await flush(); ticks[0]!(); ticks[1]!(); await flush();
    assert.deepEqual(events.slice(0, 5), ['schedule:100', 'schedule:200', 'first-run', 'second-run', 'second-run']);
    const closing = tasks.close(); let settled = false;
    const rejection = assert.rejects(closing, { message: 'Background task shutdown failed after draining' }).then(() => { settled = true; });
    await flush(); assert.equal(settled, false); finish(); await flush(); assert.equal(settled, false);
    stop(); await rejection; assert.equal(settled, true);
    assert.equal(events.filter(event => event === 'first-run').length, 1);
    assert.equal(events.filter(event => event === 'cancel:100').length, 1); assert.equal(events.filter(event => event === 'cancel:200').length, 1);
    assert.ok(events.includes('first-end')); assert.ok(events.includes('second-stop'));
});
