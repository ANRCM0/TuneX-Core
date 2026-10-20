import assert from 'node:assert/strict';
import { test } from 'node:test';
import { foldTelemetryRollup, processObservation } from '../src/modules/telemetry-owner/public.ts';
import type { TelemetryObservation } from '../src/modules/telemetry-owner/public.ts';
import type { NodeTelemetrySample } from '../src/compatibility/public.ts';

const minute = 1800000000000;
function observation(sequence: number, receipt: number, cpu: string): TelemetryObservation {
    const sample: NodeTelemetrySample = { telemetryVersion: 1, kind: 'telemetry-sample', nodeId: 'node', bootId: 'boot',
        sessionEpoch: 1, sampleEpoch: 'a'.repeat(32), sequence, capturedAt: new Date(receipt - 3000).toISOString(), uptimeMs: sequence * 1000,
        platform: 'linux', droppedSamples: '0', process: { goroutines: 2, heapAllocBytes: '18446744073709551615', runtimeBytes: '1',
            cpuTimeNanos: cpu, maxRssBytes: null, openFileDescriptors: null },
        runtime: { snapshotGeneration: 3, authorizationActive: false, tcpStreams: '0', udpAssociations: '0', drainingInstances: 0 } };
    return processObservation('scope', sample, receipt);
}

test('rollup wide sums and precise counter increments preserve immutable prior bucket', () => {
    const first = observation(1, minute + 1000, '18446744073709551000');
    const second = observation(2, minute + 2000, '18446744073709551009');
    const initial = foldTelemetryRollup(null, null, first, 'minute'), saved = structuredClone(initial);
    const next = foldTelemetryRollup(initial, first, second, 'minute');
    assert.deepEqual(initial, saved); assert.notEqual(next, initial); assert.ok(Object.isFrozen(next));
    assert.equal(next.gauges.heapAllocBytes!.sum, '36893488147419103230');
    assert.equal(next.increments.cpuTimeNanos!.sum, '9'); assert.equal(next.increments.cpuTimeNanos!.elapsedMs, 1000);
    assert.equal(next.quality.baseline, 1); assert.equal(next.quality.continuous, 1);
    assert.equal(next.cumulative.cpuTimeNanos!.first, '18446744073709551000');
    assert.equal(next.cumulative.cpuTimeNanos!.last, '18446744073709551009');
    assert.equal(next.coverage.elapsedMs, 1000); assert.equal(next.coverage.intervalCount, 1);
    assert.equal(next.gauges.maxRssBytes, undefined, 'missing metric was synthesized as zero');
});

test('rollup attribution uses receipt interval end across minute and hour boundaries', () => {
    const previous = observation(1, minute - 1000, '10'), current = observation(2, minute + 1000, '17');
    for (const resolution of ['minute', 'hour'] as const) {
        const bucket = foldTelemetryRollup(null, previous, current, resolution);
        assert.equal(bucket.start, minute); assert.equal(bucket.capturedFrom, minute - 2000);
        assert.equal(bucket.receivedFrom, minute + 1000); assert.equal(bucket.sampleCount, 1);
        assert.equal(bucket.coverage.attribution, 'receipt-interval-end'); assert.equal(bucket.coverage.boundaryIntervals, 1);
        assert.equal(bucket.coverage.from, minute - 1000); assert.equal(bucket.coverage.to, minute + 1000);
        assert.equal(bucket.coverage.elapsedMs, 1000, 'wall receipt difference replaced monotonic elapsed');
        assert.equal(bucket.increments.cpuTimeNanos!.sum, '7');
        assert.equal(bucket.end - bucket.start, resolution === 'minute' ? 60000 : 3600000);
    }
});

test('rollup reset gap overflow and terminal precedence never invents an increment interval', () => {
    const previous = observation(1, minute + 1000, '10'), current = observation(2, minute + 2000, '17');
    for (const [change, quality] of [
        [{ sequence: 3 }, 'gap'], [{ sequence: 1 }, 'counterReset'], [{ counters: { cpuTimeNanos: '9' } }, 'counterReset'],
        [{ droppedSamples: '1' }, 'gap'], [{ truncated: true }, 'gap'],
        [{ overflowed: true, state: 'terminal' as const }, 'overflowed'], [{ state: 'terminal' as const }, 'terminal'],
    ] as const) {
        const bucket = foldTelemetryRollup(null, previous, { ...current, ...change }, 'minute');
        assert.equal(bucket.quality[quality], 1); assert.deepEqual(bucket.increments, {});
        assert.equal(bucket.coverage.intervalCount, 0); assert.equal(bucket.coverage.elapsedMs, 0);
        assert.equal(bucket.coverage.from, null); assert.equal(bucket.coverage.to, null);
    }
});

test('rollup rejects cross-bucket or cross-series reuse before mutating existing values', () => {
    const current = observation(1, minute + 1000, '10');
    const initial = foldTelemetryRollup(null, null, current, 'minute'), saved = structuredClone(initial);
    assert.throws(() => foldTelemetryRollup(initial, current, observation(2, minute + 61000, '12'), 'minute'));
    const other = { ...initial, scopeId: 'another-scope' };
    assert.throws(() => foldTelemetryRollup(other, null, current, 'minute'));
    assert.deepEqual(initial, saved);
});
