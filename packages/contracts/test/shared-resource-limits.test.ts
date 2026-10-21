import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { digest } from '../src/digest.ts';
import { parseRuntimeMessage } from '../src/adp3.ts';
import type { RuntimeSnapshot } from '../src/adp3.ts';

const fixture = JSON.parse(readFileSync(new URL('../../../docs/protocol/fixtures/adp-v3-runtime.json', import.meta.url), 'utf8')) as {
    cases: { schema: string; raw: string; valid: boolean }[];
};

function snapshot(extension: boolean): RuntimeSnapshot {
    const source = fixture.cases.find(item => item.valid && item.schema === 'Snapshot')!;
    const value = JSON.parse(source.raw) as RuntimeSnapshot;
    if (extension) value.executionExtension = 1;
    value.resourceLimits = { version: 1, buckets: [{ bucketId: 'bucket-a', scopeId: 'scope', actorId: 'owner', nodeId: value.nodeId,
        revision: 1, startsAt: '2026-10-12T08:00:00.000Z', endsAt: '2026-10-12T08:00:01.000Z',
        bytesPerSecond: 10, burstBytes: 10, byteLimit: 100, assignmentIds: value.assignments.map(assignment => assignment.assignmentId) }] };
    return value;
}

function encoded(value: RuntimeSnapshot): string {
    const { snapshotDigest: _old, ...body } = value;
    return JSON.stringify({ ...body, snapshotDigest: digest(body) });
}

for (const extension of [false, true]) {
    const schema = extension ? 'execution' : 'runtime';
    test(`FR0032 ${schema} absent extension retains old wire and present bucket is digest covered`, () => {
        const old = snapshot(extension); delete old.resourceLimits;
        assert.equal(parseRuntimeMessage('Snapshot', encoded(old)).resourceLimits, undefined);
        const current = snapshot(extension), raw = encoded(current);
        assert.deepEqual(parseRuntimeMessage('Snapshot', raw).resourceLimits, current.resourceLimits);
        const altered = JSON.parse(raw) as RuntimeSnapshot; altered.resourceLimits!.buckets[0]!.byteLimit = 101;
        assert.throws(() => parseRuntimeMessage('Snapshot', JSON.stringify(altered)), /Snapshot digest differs/);
    });

    test(`FR0032 ${schema} closed policy and bucket fields and required values reject at the wire parser`, () => {
        for (const mutate of [
            (value: RuntimeSnapshot) => Object.assign(value.resourceLimits!, { extra: true }),
            (value: RuntimeSnapshot) => Object.assign(value.resourceLimits!.buckets[0]!, { extra: true }),
            (value: RuntimeSnapshot) => Reflect.deleteProperty(value.resourceLimits!.buckets[0]!, 'byteLimit'),
            (value: RuntimeSnapshot) => { value.resourceLimits!.version = 2 as 1; },
            (value: RuntimeSnapshot) => { value.resourceLimits!.buckets = []; },
            (value: RuntimeSnapshot) => { value.resourceLimits!.buckets[0]!.burstBytes = 0; },
            (value: RuntimeSnapshot) => { value.resourceLimits!.buckets[0]!.bytesPerSecond = null; value.resourceLimits!.buckets[0]!.byteLimit = null; },
        ]) { const value = snapshot(extension); mutate(value); assert.throws(() => parseRuntimeMessage('Snapshot', encoded(value))); }
    });

    test(`FR0032 ${schema} cross node unknown assignment duplicate subject bucket and assignment order reject`, () => {
        for (const mode of ['node', 'unknown', 'duplicate-assignment', 'assignment-order', 'duplicate-subject', 'duplicate-bucket', 'bucket-order', 'cross-bucket-assignment']) {
            const value = snapshot(extension), bucket = value.resourceLimits!.buckets[0]!;
            const second = structuredClone(value.assignments[0]!); second.assignmentId = 'zz-assignment'; second.forwardId = 'zz-forward'; second.resource.port++;
            value.assignments.push(second);
            if (mode === 'node') bucket.nodeId = 'foreign-node';
            if (mode === 'unknown') bucket.assignmentIds = ['unknown'];
            if (mode === 'duplicate-assignment') bucket.assignmentIds.push(bucket.assignmentIds[0]!);
            if (mode === 'assignment-order') bucket.assignmentIds = [second.assignmentId, bucket.assignmentIds[0]!];
            if (['duplicate-subject', 'duplicate-bucket', 'bucket-order', 'cross-bucket-assignment'].includes(mode)) {
                const other = { ...bucket, bucketId: 'bucket-b', actorId: 'owner-b', assignmentIds: [] as string[] };
                if (mode === 'duplicate-subject') other.actorId = bucket.actorId;
                if (mode === 'duplicate-bucket') other.bucketId = bucket.bucketId;
                if (mode === 'cross-bucket-assignment') other.assignmentIds = [...bucket.assignmentIds];
                value.resourceLimits!.buckets.push(other);
                if (mode === 'bucket-order') value.resourceLimits!.buckets.reverse();
            }
            assert.throws(() => parseRuntimeMessage('Snapshot', encoded(value)), mode);
        }
    });

    test(`FR0032 ${schema} empty assignment control bucket may update drain policy without granting execution`, () => {
        const value = snapshot(extension), old = value.assignments[0]!;
        value.tombstones = [{ assignmentId: old.assignmentId, forwardId: old.forwardId, role: old.role, protocol: old.protocol,
            physicalProtocol: old.resource.protocol, port: old.resource.port, bindingFence: old.bindingFence, retirementGeneration: value.snapshotGeneration }];
        value.assignments = []; value.resourceLimits!.buckets[0]!.assignmentIds = [];
        const parsed = parseRuntimeMessage('Snapshot', encoded(value));
        assert.deepEqual(parsed.assignments, []); assert.deepEqual(parsed.resourceLimits!.buckets[0]!.assignmentIds, []);
        assert.deepEqual(parsed.tombstones, value.tombstones);
    });

    test(`FR0032 ${schema} bucket times are canonical milliseconds and legacy issuedAt fractions compare exactly`, () => {
        for (const startsAt of ['2026-10-12T08:00:00Z', '2026-10-12T08:00:00.0000Z', '2026-10-12T09:00:00.000+01:00']) {
            const value = snapshot(extension); value.resourceLimits!.buckets[0]!.startsAt = startsAt;
            assert.throws(() => parseRuntimeMessage('Snapshot', encoded(value)));
        }
        for (const [issuedAt, startsAt, endsAt, valid] of [
            ['2026-10-12T08:00:00Z', '2026-10-12T08:00:00.000Z', '2026-10-12T08:00:00.001Z', true],
            ['2026-10-12T08:00:00.000999999999999999999Z', '2026-10-12T08:00:00.000Z', '2026-10-12T08:00:00.001Z', true],
            ['2026-10-12T08:00:00.000999999999999999999Z', '2026-10-12T08:00:00.001Z', '2026-10-12T08:00:01.000Z', false],
            ['2026-10-12T08:00:00.001000000000000000001Z', '2026-10-12T08:00:00.000Z', '2026-10-12T08:00:00.001Z', false],
            ['2026-10-12T08:00:00.001Z', '2026-10-12T08:00:00.000Z', '2026-10-12T08:00:00.001Z', false],
        ] as const) {
            const value = snapshot(extension); value.issuedAt = issuedAt;
            Object.assign(value.resourceLimits!.buckets[0]!, { startsAt, endsAt });
            if (valid) assert.doesNotThrow(() => parseRuntimeMessage('Snapshot', encoded(value)));
            else assert.throws(() => parseRuntimeMessage('Snapshot', encoded(value)));
        }
    });
}
