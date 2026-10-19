import { parseJson } from './json.ts';

export interface NodeTelemetrySample {
    telemetryVersion: 1;
    kind: 'telemetry-sample';
    nodeId: string;
    bootId: string;
    sessionEpoch: number;
    sampleEpoch: string;
    sequence: number;
    capturedAt: string;
    uptimeMs: number;
    platform: string;
    process: {
        goroutines: number;
        heapAllocBytes: string;
        runtimeBytes: string;
        cpuTimeNanos: string | null;
        maxRssBytes: string | null;
        openFileDescriptors: number | null;
    };
    runtime: {
        snapshotGeneration: number;
        authorizationActive: boolean;
        tcpStreams: string;
        udpAssociations: string;
        drainingInstances: number;
    };
    droppedSamples: string;
}
export interface NodeTelemetryAck {
    telemetryVersion: 1;
    kind: 'telemetry-ack';
    nodeId: string;
    bootId: string;
    sessionEpoch: number;
    sampleEpoch: string;
    sequence: number;
    stored: boolean;
    receivedAt: string;
    source: 'agent-reported';
    executionAuthorized: false;
}
const platforms = new Set(['aix', 'android', 'darwin', 'dragonfly', 'freebsd', 'illumos', 'ios',
    'js', 'linux', 'netbsd', 'openbsd', 'plan9', 'solaris', 'wasip1', 'windows']);
const identity = (value: unknown): value is string => typeof value === 'string' && !/\s/.test(value) && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const integer = (value: unknown, maximum = Number.MAX_SAFE_INTEGER, minimum = 0): value is number =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
export const telemetryUint64 = (value: unknown): value is string => typeof value === 'string' &&
    !/\s/.test(value) && /^(0|[1-9][0-9]{0,19})$/.test(value) && BigInt(value) <= 18446744073709551615n;
function invalid(): never { throw new Error('INVALID_CONFIG: Invalid telemetry-v1 message'); }
function closed(input: unknown, keys: string[]): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
        Object.keys(input).sort().join(',') !== [...keys].sort().join(',')) invalid();
    return input as Record<string, unknown>;
}
function timestamp(value: unknown): value is string {
    if (typeof value !== 'string' || /\s/.test(value) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value)) return false;
    const millis = Date.parse(value);
    return Number.isSafeInteger(millis) && millis >= 0 && new Date(millis).toISOString().slice(0, 19) === value.slice(0, 19);
}
function binding(value: Record<string, unknown>) {
    if (value.telemetryVersion !== 1 || !identity(value.nodeId) || !identity(value.bootId) ||
        !integer(value.sessionEpoch, Number.MAX_SAFE_INTEGER, 1) || !integer(value.sequence, Number.MAX_SAFE_INTEGER, 1) ||
        typeof value.sampleEpoch !== 'string' || value.sampleEpoch.length !== 32 || !/^[a-f0-9]{32}$/.test(value.sampleEpoch)) invalid();
}
export function parseNodeTelemetrySample(input: unknown): NodeTelemetrySample {
    const value = closed(input, ['telemetryVersion', 'kind', 'nodeId', 'bootId', 'sessionEpoch', 'sampleEpoch',
        'sequence', 'capturedAt', 'uptimeMs', 'platform', 'process', 'runtime', 'droppedSamples']);
    binding(value);
    if (value.kind !== 'telemetry-sample' || !timestamp(value.capturedAt) || !integer(value.uptimeMs) ||
        typeof value.platform !== 'string' || !platforms.has(value.platform) || !telemetryUint64(value.droppedSamples)) invalid();
    const process = closed(value.process, ['goroutines', 'heapAllocBytes', 'runtimeBytes', 'cpuTimeNanos', 'maxRssBytes', 'openFileDescriptors']);
    if (!integer(process.goroutines, 10000000) || !telemetryUint64(process.heapAllocBytes) || !telemetryUint64(process.runtimeBytes) ||
        process.cpuTimeNanos !== null && !telemetryUint64(process.cpuTimeNanos) ||
        process.maxRssBytes !== null && !telemetryUint64(process.maxRssBytes) ||
        process.openFileDescriptors !== null && !integer(process.openFileDescriptors, 1000000000)) invalid();
    const runtime = closed(value.runtime, ['snapshotGeneration', 'authorizationActive', 'tcpStreams', 'udpAssociations', 'drainingInstances']);
    if (!integer(runtime.snapshotGeneration) || typeof runtime.authorizationActive !== 'boolean' ||
        !telemetryUint64(runtime.tcpStreams) || !telemetryUint64(runtime.udpAssociations) || !integer(runtime.drainingInstances, 1000000)) invalid();
    return Object.freeze({ ...value, process: Object.freeze({ ...process }), runtime: Object.freeze({ ...runtime }) }) as unknown as NodeTelemetrySample;
}
export function parseNodeTelemetryAck(input: unknown): NodeTelemetryAck {
    const value = closed(input, ['telemetryVersion', 'kind', 'nodeId', 'bootId', 'sessionEpoch', 'sampleEpoch', 'sequence',
        'stored', 'receivedAt', 'source', 'executionAuthorized']);
    binding(value);
    if (value.kind !== 'telemetry-ack' || typeof value.stored !== 'boolean' || !timestamp(value.receivedAt) ||
        value.source !== 'agent-reported' || value.executionAuthorized !== false) invalid();
    return Object.freeze({ ...value }) as unknown as NodeTelemetryAck;
}
export function parseNodeTelemetry(kind: 'sample', raw: string): NodeTelemetrySample;
export function parseNodeTelemetry(kind: 'ack', raw: string): NodeTelemetryAck;
export function parseNodeTelemetry(kind: 'sample' | 'ack', raw: string): NodeTelemetrySample | NodeTelemetryAck {
    const input = parseJson(raw, kind === 'sample' ? 8192 : 4096);
    return kind === 'sample' ? parseNodeTelemetrySample(input) : parseNodeTelemetryAck(input);
}
