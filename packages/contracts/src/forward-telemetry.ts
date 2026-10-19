import { deepFreeze, ipBytes, isCounter, isId, isPort } from '@tunex/core';
import { digest } from './digest.ts';
import { parseJson } from './json.ts';
import { compareTimes } from './time.ts';
import { telemetryUint64 } from './telemetry.ts';

interface ForwardTelemetryIdentity {
    nodeId: string;
    bootId: string;
    sessionEpoch: number;
    assignmentId: string;
    forwardId: string;
    forwardRevision: number;
    deploymentGeneration: number;
    bindingFence: number;
    role: 'direct' | 'relay-ingress' | 'multihop-ingress';
    protocol: 'tcp' | 'udp';
    driverId: 'native.direct.v1' | 'native.relay.v1' | 'native.multihop.v1';
    driverSchemaVersion: 1;
    configDigest: string;
    resource: { protocol: 'tcp' | 'udp'; address: string; port: number };
}
interface ForwardTelemetryCounters {
    payloadSentBytes: string;
    payloadReceivedBytes: string;
    tcpAccepted: string;
    tcpConnected: string;
    tcpClosed: string;
    udpAssociationsCreated: string;
    udpAssociationsClosed: string;
    udpDatagramsSent: string;
    udpDatagramsReceived: string;
}
export interface ForwardTelemetryPoint {
    identity: ForwardTelemetryIdentity;
    state: 'current' | 'draining' | 'terminal';
    phase: 'prepared' | 'active' | 'draining';
    capturedAt: string;
    endedAt: string | null;
    availability: 'available' | 'unavailable';
    counterEpoch: string | null;
    counters: ForwardTelemetryCounters | null;
    overflowed: boolean | null;
}
export interface ForwardTelemetrySample {
    forwardTelemetryVersion: 1;
    kind: 'forward-telemetry-sample';
    nodeId: string;
    bootId: string;
    sessionEpoch: number;
    sampleEpoch: string;
    sequence: number;
    capturedAt: string;
    uptimeMs: number;
    snapshotGeneration: number;
    droppedSamples: string;
    coverage: {
        limit: 32;
        available: number;
        returned: number;
        omitted: number;
        truncated: boolean;
        offset: number;
        nextOffset: number;
        unavailableSources: number;
        tailLimit: 128;
        tailRetentionSeconds: 600;
        tailsEvicted: string;
        tailsExpired: string;
        historyComplete: false;
    };
    items: ForwardTelemetryPoint[];
}
export interface ForwardTelemetryAck {
    forwardTelemetryVersion: 1;
    kind: 'forward-telemetry-ack';
    nodeId: string;
    bootId: string;
    sessionEpoch: number;
    sampleEpoch: string;
    sequence: number;
    receivedAt: string;
    stored: true;
    acceptedPoints: number;
    rejectedPoints: number;
    source: 'agent-reported';
    executionAuthorized: false;
}

const counterKeys = ['payloadSentBytes', 'payloadReceivedBytes', 'tcpAccepted', 'tcpConnected', 'tcpClosed',
    'udpAssociationsCreated', 'udpAssociationsClosed', 'udpDatagramsSent', 'udpDatagramsReceived'];
const tcpKeys = ['tcpAccepted', 'tcpConnected', 'tcpClosed'];
const udpKeys = ['udpAssociationsCreated', 'udpAssociationsClosed', 'udpDatagramsSent', 'udpDatagramsReceived'];
const epoch = (value: unknown): value is string => typeof value === 'string' && value.length === 32 && /^[a-f0-9]{32}$/.test(value);
function invalid(): never { throw new Error('INVALID_CONFIG: Invalid forward-telemetry-v1 message'); }
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
function binding(value: Record<string, unknown>): void {
    if (value.forwardTelemetryVersion !== 1 || !isId(value.nodeId) || !isId(value.bootId) ||
        !isCounter(value.sessionEpoch) || !isCounter(value.sequence) || !epoch(value.sampleEpoch)) invalid();
}
export function parseForwardTelemetryIdentity(input: unknown): ForwardTelemetryPoint['identity'] {
    const value = closed(input, ['nodeId', 'bootId', 'sessionEpoch', 'assignmentId', 'forwardId', 'forwardRevision',
        'deploymentGeneration', 'bindingFence', 'role', 'protocol', 'driverId', 'driverSchemaVersion', 'configDigest', 'resource']);
    if (!isId(value.nodeId) || !isId(value.bootId) || !isCounter(value.sessionEpoch) ||
        !isId(value.assignmentId) || !isId(value.forwardId) || !isCounter(value.forwardRevision) ||
        !isCounter(value.deploymentGeneration) || !isCounter(value.bindingFence) ||
        !['direct', 'relay-ingress', 'multihop-ingress'].includes(value.role as string) ||
        !['tcp', 'udp'].includes(value.protocol as string) || value.driverSchemaVersion !== 1 ||
        typeof value.configDigest !== 'string' || value.configDigest.length !== 71 || !/^sha256:[a-f0-9]{64}$/.test(value.configDigest)) invalid();
    const expectedDriver = value.role === 'direct' ? 'native.direct.v1' : value.role === 'relay-ingress' ? 'native.relay.v1' : 'native.multihop.v1';
    if (value.driverId !== expectedDriver) invalid();
    const resource = closed(value.resource, ['protocol', 'address', 'port']);
    if (resource.protocol !== value.protocol || typeof resource.address !== 'string' || resource.address.length < 1 ||
        resource.address.length > 127 || /\s/.test(resource.address) || !ipBytes(resource.address) || !isPort(resource.port)) invalid();
    return deepFreeze({ ...value, resource: { ...resource } }) as unknown as ForwardTelemetryPoint['identity'];
}
export function parseForwardTelemetryPoint(input: unknown): ForwardTelemetryPoint {
    const value = closed(input, ['identity', 'state', 'phase', 'capturedAt', 'endedAt', 'availability', 'counterEpoch', 'counters', 'overflowed']);
    const identity = parseForwardTelemetryIdentity(value.identity);
    if (!['current', 'draining', 'terminal'].includes(value.state as string) || !['prepared', 'active', 'draining'].includes(value.phase as string) ||
        identity.role === 'direct' && value.phase !== 'active' || !timestamp(value.capturedAt) ||
        (value.state === 'terminal' ? value.endedAt !== value.capturedAt : value.endedAt !== null)) invalid();
    let counters: Record<string, unknown> | null = null;
    if (value.availability === 'available') {
        if (!epoch(value.counterEpoch) || typeof value.overflowed !== 'boolean') invalid();
        counters = closed(value.counters, counterKeys);
        if (counterKeys.some(key => !telemetryUint64(counters![key])) ||
            (identity.protocol === 'tcp' ? udpKeys : tcpKeys).some(key => counters![key] !== '0')) invalid();
    } else if (value.availability !== 'unavailable' || value.counterEpoch !== null || value.counters !== null || value.overflowed !== null) invalid();
    const point = { ...value, identity, counters: counters === null ? null : { ...counters } } as unknown as ForwardTelemetryPoint;
    // Closed keys and ASCII field bounds make canonical and ordinary JSON byte lengths identical.
    if (new TextEncoder().encode(JSON.stringify(point)).byteLength > 4096) invalid();
    return deepFreeze(point);
}
export function parseForwardTelemetryCoverage(input: unknown, returned: number): ForwardTelemetrySample['coverage'] {
    const value = closed(input, ['limit', 'available', 'returned', 'omitted', 'truncated', 'offset', 'nextOffset', 'unavailableSources',
        'tailLimit', 'tailRetentionSeconds', 'tailsEvicted', 'tailsExpired', 'historyComplete']);
    if (!isCounter(returned, true) || returned > 32 || value.limit !== 32 || !isCounter(value.available, true) || value.returned !== returned || returned !== Math.min(32, value.available) ||
        value.omitted !== value.available - returned || value.truncated !== (value.available > returned) ||
        !isCounter(value.offset, true) || !isCounter(value.nextOffset, true) || !isCounter(value.unavailableSources, true) ||
        value.unavailableSources > value.available || value.tailLimit !== 128 || value.tailRetentionSeconds !== 600 ||
        !telemetryUint64(value.tailsEvicted) || !telemetryUint64(value.tailsExpired) || value.historyComplete !== false) invalid();
    if (value.available <= 32 ? value.offset !== 0 || value.nextOffset !== 0 :
        value.offset >= value.available || value.nextOffset !== Number((BigInt(value.offset) + BigInt(returned)) % BigInt(value.available))) invalid();
    return deepFreeze({ ...value }) as unknown as ForwardTelemetrySample['coverage'];
}
export function parseForwardTelemetrySample(input: unknown): ForwardTelemetrySample {
    const value = closed(input, ['forwardTelemetryVersion', 'kind', 'nodeId', 'bootId', 'sessionEpoch', 'sampleEpoch', 'sequence',
        'capturedAt', 'uptimeMs', 'snapshotGeneration', 'droppedSamples', 'coverage', 'items']);
    binding(value);
    if (value.kind !== 'forward-telemetry-sample' || !timestamp(value.capturedAt) || !isCounter(value.uptimeMs, true) ||
        !isCounter(value.snapshotGeneration, true) || !telemetryUint64(value.droppedSamples) || !Array.isArray(value.items) || value.items.length > 32) invalid();
    const items = value.items.map(item => {
        const point = parseForwardTelemetryPoint(item);
        if (point.identity.nodeId !== value.nodeId || point.identity.bootId !== value.bootId || point.identity.sessionEpoch !== value.sessionEpoch ||
            compareTimes(point.capturedAt, value.capturedAt as string) > 0) invalid();
        return point;
    });
    const identities = new Set<string>();
    for (const point of items) {
        const key = digest({ identity: point.identity, counterEpoch: point.counterEpoch });
        if (identities.has(key)) invalid();
        identities.add(key);
    }
    const coverage = parseForwardTelemetryCoverage(value.coverage, items.length);
    return deepFreeze({ ...value, coverage, items }) as unknown as ForwardTelemetrySample;
}
export function parseForwardTelemetryAck(input: unknown): ForwardTelemetryAck {
    const value = closed(input, ['forwardTelemetryVersion', 'kind', 'nodeId', 'bootId', 'sessionEpoch', 'sampleEpoch', 'sequence',
        'receivedAt', 'stored', 'acceptedPoints', 'rejectedPoints', 'source', 'executionAuthorized']);
    binding(value);
    if (value.kind !== 'forward-telemetry-ack' || !timestamp(value.receivedAt) || value.stored !== true ||
        !isCounter(value.acceptedPoints, true) || !isCounter(value.rejectedPoints, true) || value.acceptedPoints + value.rejectedPoints > 32 ||
        value.source !== 'agent-reported' || value.executionAuthorized !== false) invalid();
    return deepFreeze({ ...value }) as unknown as ForwardTelemetryAck;
}
export function parseRawForwardTelemetrySample(raw: string): ForwardTelemetrySample {
    return parseForwardTelemetrySample(parseJson(raw, 65536));
}
export function parseRawForwardTelemetryAck(raw: string): ForwardTelemetryAck {
    return parseForwardTelemetryAck(parseJson(raw, 4096));
}
