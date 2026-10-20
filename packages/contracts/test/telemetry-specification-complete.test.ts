import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { parseNodeTelemetry } from '../src/telemetry.ts';
import { parseHostTelemetry } from '../src/host-telemetry.ts';
import { parseRawForwardTelemetrySample, parseRawForwardTelemetryAck } from '../src/forward-telemetry.ts';
import { parseRawProbeTelemetrySample, parseRawProbeTelemetryAck } from '../src/probe-telemetry.ts';

const time = '2026-10-19T00:00:00.123456789Z';
const epoch = 'a'.repeat(32), hash = 'sha256:' + 'b'.repeat(64);
const binding = { nodeId: 'node-1', bootId: 'boot-1', sessionEpoch: 1, sampleEpoch: epoch, sequence: 1 };
const coverage = { limit: 32, available: 1, returned: 1, omitted: 0, truncated: false, offset: 0,
    nextOffset: 0, unavailableSources: 0, tailLimit: 128, tailRetentionSeconds: 600,
    tailsEvicted: '0', tailsExpired: '0', historyComplete: false };
const forwardPoint = { identity: { nodeId: 'node-1', bootId: 'boot-1', sessionEpoch: 1, assignmentId: 'assignment-1',
    forwardId: 'forward-1', forwardRevision: 1, deploymentGeneration: 1, bindingFence: 1,
    role: 'direct', protocol: 'tcp', driverId: 'native.direct.v1', driverSchemaVersion: 1, configDigest: hash,
    resource: { protocol: 'tcp', address: '127.0.0.1', port: 10001 } },
    state: 'current', phase: 'active', capturedAt: time, endedAt: null, availability: 'available', counterEpoch: epoch,
    counters: { payloadSentBytes: '18446744073709551615', payloadReceivedBytes: '0', tcpAccepted: '1',
        tcpConnected: '1', tcpClosed: '0', udpAssociationsCreated: '0', udpAssociationsClosed: '0',
        udpDatagramsSent: '0', udpDatagramsReceived: '0' }, overflowed: false };
const probePoint = { identity: { binding: { nodeId: 'node-1', bootId: 'boot-1', sessionEpoch: 1,
    snapshotGeneration: 1, assignmentId: 'assignment-1', forwardId: 'forward-1', forwardRevision: 1,
    deploymentGeneration: 1, bindingFence: 1, configDigest: hash, egressPolicyRevision: 1 },
    instanceId: 'c'.repeat(64), instanceGeneration: 1 }, state: 'current', capturedAt: time, endedAt: null,
    availability: 'available', counterEpoch: epoch, counters: { attempted: '4', succeeded: '1', failed: '1',
        unknown: '1', inFlight: '1' }, overflowed: false };
const node = { telemetryVersion: 1, kind: 'telemetry-sample', ...binding, capturedAt: time, uptimeMs: 0,
    platform: 'linux', process: { goroutines: 1, heapAllocBytes: '18446744073709551615', runtimeBytes: '0',
        cpuTimeNanos: null, maxRssBytes: null, openFileDescriptors: null },
    runtime: { snapshotGeneration: 0, authorizationActive: false, tcpStreams: '0', udpAssociations: '0', drainingInstances: 0 }, droppedSamples: '0' };
const host = { hostTelemetryVersion: 1, kind: 'host-telemetry-sample', ...binding, capturedAt: time, uptimeMs: 0,
    platform: 'linux', droppedSamples: '0', host: { scope: 'agent-visible-os',
        cpu: { availability: 'available', logicalProcessors: 2, totalTicks: '100', idleTicks: '60', ioWaitTicks: '10' },
        memory: { availability: 'available', totalBytes: '100', availableBytes: '50' },
        load: { availability: 'available', oneMilli: '1', fiveMilli: '2', fifteenMilli: '3' },
        filesystem: { availability: 'available', scope: 'agent-root-filesystem', totalBytes: '100', availableBytes: '50' },
        network: { availability: 'available', scope: 'agent-network-namespace', limit: 16, available: 1,
            returned: 1, omitted: 0, truncated: false, interfaces: [{ name: 'eth0', rxBytes: '1', txBytes: '2' }] } } };
const forward = { forwardTelemetryVersion: 1, kind: 'forward-telemetry-sample', ...binding, capturedAt: time,
    uptimeMs: 0, snapshotGeneration: 1, droppedSamples: '0', coverage, items: [forwardPoint] };
const probe = { probeTelemetryVersion: 1, kind: 'probe-telemetry-sample', ...binding, capturedAt: time,
    uptimeMs: 0, droppedSamples: '0', coverage: { ...coverage, snapshotLimit: 2, retiringSourceLimit: 8, retiringSources: 0 }, items: [probePoint] };
const acknowledgement = { ...binding, stored: true, receivedAt: time, source: 'agent-reported', executionAuthorized: false };
const families = [
    { name: 'telemetry-v1', sample: node, ack: { telemetryVersion: 1, kind: 'telemetry-ack', ...acknowledgement },
        parseSample: (raw: string) => parseNodeTelemetry('sample', raw), parseAck: (raw: string) => parseNodeTelemetry('ack', raw), cap: 8192 },
    { name: 'host-telemetry-v1', sample: host, ack: { hostTelemetryVersion: 1, kind: 'host-telemetry-ack', ...acknowledgement },
        parseSample: (raw: string) => parseHostTelemetry('sample', raw), parseAck: (raw: string) => parseHostTelemetry('ack', raw), cap: 8192 },
    { name: 'forward-telemetry-v1', sample: forward, ack: { forwardTelemetryVersion: 1, kind: 'forward-telemetry-ack',
        ...acknowledgement, acceptedPoints: 1, rejectedPoints: 0 }, parseSample: parseRawForwardTelemetrySample, parseAck: parseRawForwardTelemetryAck, cap: 65536 },
    { name: 'probe-telemetry-v1', sample: probe, ack: { probeTelemetryVersion: 1, kind: 'probe-telemetry-ack',
        ...acknowledgement, acceptedPoints: 1, rejectedPoints: 0 }, parseSample: parseRawProbeTelemetrySample, parseAck: parseRawProbeTelemetryAck, cap: 65536 },
];
function frozen(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    assert.equal(Object.isFrozen(value), true);
    for (const child of Object.values(value)) frozen(child);
}

test('four handwritten telemetry parsers independently agree with their specification samples and ACK fixtures and preserve immutable detached data', () => {
    const addFormats: (ajv: Ajv2020) => void = createRequire(import.meta.url)('ajv-formats');
    for (const family of families) {
        const schema = JSON.parse(readFileSync(new URL(`../../../docs/protocol/schemas/${family.name}.schema.json`, import.meta.url), 'utf8'));
        const ajv = new Ajv2020({ strict: true, allErrors: true }); addFormats(ajv);
        const validate = ajv.compile(schema);
        for (const [value, parse] of [[family.sample, family.parseSample], [family.ack, family.parseAck]] as const) {
            assert.equal(validate(value), true, family.name + ': ' + JSON.stringify(validate.errors));
            const result = parse(JSON.stringify(value));
            assert.deepEqual(result, value, family.name);
            assert.notEqual(result, value); frozen(result);
            assert.throws(() => parse(JSON.stringify({ ...value, unknown: true })), /INVALID_CONFIG/);
            for (const key of Object.keys(value)) {
                const incomplete: Record<string, unknown> = structuredClone(value); delete incomplete[key];
                assert.throws(() => parse(JSON.stringify(incomplete)), /INVALID_CONFIG/, family.name + ':' + key);
            }
        }
        for (const parse of [family.parseSample, family.parseAck]) {
            assert.throws(() => parse('{"kind":1,"kind":2}'), /INTEGRITY_FAILURE/);
            assert.throws(() => parse('{ malformed JSON'), /INVALID_CONFIG/);
        }
        assert.throws(() => family.parseSample(' '.repeat(family.cap + 1)), /RESOURCE_LIMIT/);
        assert.throws(() => family.parseAck(' '.repeat(4097)), /RESOURCE_LIMIT/);
        for (const patch of [{ source: 'trusted' }, { executionAuthorized: true }, { receivedAt: '2026-02-30T00:00:00Z' },
            { receivedAt: '2026-10-19T00:00:00+00:00' }, { sequence: 0 }, { sampleEpoch: 'A'.repeat(32) }]) {
            assert.throws(() => family.parseAck(JSON.stringify({ ...family.ack, ...patch })), /INVALID_CONFIG/);
        }
    }
    // The process parser historically accepts stored=false; Agent CheckTelemetryAck
    // refuses it. Preserve that division rather than inventing cross-side equality.
    assert.equal(parseNodeTelemetry('ack', JSON.stringify({ ...families[0]!.ack, stored: false })).stored, false);
    for (const family of families.slice(1)) assert.throws(() => family.parseAck(JSON.stringify({ ...family.ack, stored: false })), /INVALID_CONFIG/);
});

test('the exact four Agent native encoder fixtures satisfy the separate TS handwritten parsers and specification schemas', () => {
    const fixtures = JSON.parse(readFileSync(new URL('../../../agent/internal/observationwire/testdata/native-telemetry-fixtures.json', import.meta.url), 'utf8')) as Record<string, string>;
    assert.deepEqual(Object.keys(fixtures), ['process', 'host', 'forward', 'probe']);
    const addFormats: (ajv: Ajv2020) => void = createRequire(import.meta.url)('ajv-formats');
    for (const [index, key] of ['process', 'host', 'forward', 'probe'].entries()) {
        const family = families[index]!, raw = fixtures[key]!;
        const schema = JSON.parse(readFileSync(new URL(`../../../docs/protocol/schemas/${family.name}.schema.json`, import.meta.url), 'utf8'));
        const ajv = new Ajv2020({ strict: true, allErrors: true }); addFormats(ajv);
        const validate = ajv.compile(schema), value = JSON.parse(raw);
        assert.equal(validate(value), true, key + ': ' + JSON.stringify(validate.errors));
        assert.deepEqual(family.parseSample(raw), value, key);
    }
});

test('handwritten telemetry keeps native uint64, host arithmetic and point provenance beyond specification-only checks', () => {
    for (const value of ['18446744073709551616', '-1', '01', '1 ', 1]) {
        assert.throws(() => parseNodeTelemetry('sample', JSON.stringify({ ...node, droppedSamples: value })), /INVALID_CONFIG/);
    }
    for (const mutate of [
        (sample: typeof host) => sample.host.cpu.idleTicks = '101',
        (sample: typeof host) => sample.host.memory.availableBytes = '101',
        (sample: typeof host) => sample.host.filesystem.availableBytes = '101',
        (sample: typeof host) => sample.host.network.returned = 0,
        (sample: typeof host) => sample.platform = 'windows',
    ]) {
        const changed = structuredClone(host); mutate(changed);
        assert.throws(() => parseHostTelemetry('sample', JSON.stringify(changed)), /INVALID_CONFIG/);
    }
    const forwardMutations = [
        (sample: typeof forward) => sample.items[0]!.identity.nodeId = 'other-node',
        (sample: typeof forward) => sample.items[0]!.identity.driverId = 'native.relay.v1',
        (sample: typeof forward) => sample.items[0]!.counters.udpDatagramsSent = '1',
        (sample: typeof forward) => sample.items[0]!.capturedAt = '2026-10-20T00:00:00Z',
        (sample: typeof forward) => sample.coverage.historyComplete = true,
        (sample: typeof forward) => sample.coverage.nextOffset = 1,
        (sample: typeof forward) => { sample.items.push(structuredClone(sample.items[0]!)); sample.coverage.available = 2; sample.coverage.returned = 2; },
    ];
    for (const mutate of forwardMutations) {
        const changed = structuredClone(forward); mutate(changed);
        assert.throws(() => parseRawForwardTelemetrySample(JSON.stringify(changed)), /INVALID_CONFIG/);
    }
    for (const mutate of [
        (sample: typeof probe) => sample.items[0]!.counters.attempted = '5',
        (sample: typeof probe) => sample.items[0]!.identity.binding.nodeId = 'other-node',
        (sample: typeof probe) => sample.items[0]!.capturedAt = '2026-10-20T00:00:00Z',
        (sample: typeof probe) => sample.coverage.retiringSources = 9,
        (sample: typeof probe) => sample.coverage.unavailableSources = 2,
    ]) {
        const changed = structuredClone(probe); mutate(changed);
        assert.throws(() => parseRawProbeTelemetrySample(JSON.stringify(changed)), /INVALID_CONFIG/);
    }
    const overflow = structuredClone(probe); overflow.items[0]!.counters.attempted = '5'; overflow.items[0]!.overflowed = true;
    assert.equal(parseRawProbeTelemetrySample(JSON.stringify(overflow)).items[0]!.overflowed, true);
    for (const family of families.slice(2)) {
        assert.throws(() => family.parseAck(JSON.stringify({ ...family.ack, acceptedPoints: 33 })), /INVALID_CONFIG/);
        // Receiver parsers validate bounded receipt shape; original Agent checker
        // separately requires the receipt to account for the actual sent page.
        assert.equal((family.parseAck(JSON.stringify({ ...family.ack, acceptedPoints: 0 })) as { acceptedPoints: number }).acceptedPoints, 0);
    }
});
