import { deepFreeze, isCounter, isId } from '@tunex/core';
import { digest } from './digest.ts';
import { parseJson } from './json.ts';
import { compareTimes } from './time.ts';
import { telemetryUint64 } from './telemetry.ts';
import type { ProbeClaimBinding } from './probe-claim.ts';

export interface ProbeTelemetryIdentity {
    binding: ProbeClaimBinding;
    instanceId: string;
    instanceGeneration: number;
}
export interface ProbeTelemetryPoint {
    identity: ProbeTelemetryIdentity;
    state: 'current' | 'terminal';
    capturedAt: string;
    endedAt: string | null;
    availability: 'available' | 'unavailable';
    counterEpoch: string | null;
    counters: { attempted: string; succeeded: string; failed: string; unknown: string; inFlight: string } | null;
    overflowed: boolean | null;
}
export interface ProbeTelemetryCoverage {
    limit: 32;
    snapshotLimit: 2;
    available: number;
    returned: number;
    omitted: number;
    truncated: boolean;
    offset: number;
    nextOffset: number;
    unavailableSources: number;
    retiringSourceLimit: 8;
    retiringSources: number;
    tailLimit: 128;
    tailRetentionSeconds: 600;
    tailsEvicted: string;
    tailsExpired: string;
    historyComplete: false;
}
export interface ProbeTelemetrySample {
    probeTelemetryVersion: 1;
    kind: 'probe-telemetry-sample';
    nodeId: string;
    bootId: string;
    sessionEpoch: number;
    sampleEpoch: string;
    sequence: number;
    capturedAt: string;
    uptimeMs: number;
    droppedSamples: string;
    coverage: ProbeTelemetryCoverage;
    items: ProbeTelemetryPoint[];
}
export interface ProbeTelemetryAck {
    probeTelemetryVersion: 1;
    kind: 'probe-telemetry-ack';
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
const counterKeys = ['attempted','succeeded','failed','unknown','inFlight'];
const epoch = (value: unknown): value is string => typeof value === 'string' && value.length === 32 && /^[a-f0-9]{32}$/.test(value);
function invalid(): never { throw new Error('INVALID_CONFIG: Invalid probe-telemetry-v1 message'); }
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
    if (value.probeTelemetryVersion !== 1 || !isId(value.nodeId) || !isId(value.bootId) ||
        !isCounter(value.sessionEpoch) || !isCounter(value.sequence) || !epoch(value.sampleEpoch)) invalid();
}
export function parseProbeTelemetryIdentity(input: unknown): ProbeTelemetryIdentity {
    const value = closed(input, ['binding','instanceId','instanceGeneration']);
    const b = closed(value.binding, ['nodeId','bootId','sessionEpoch','snapshotGeneration','assignmentId','forwardId','forwardRevision',
        'deploymentGeneration','bindingFence','configDigest','egressPolicyRevision']);
    if (![b.nodeId,b.bootId,b.assignmentId,b.forwardId].every(isId) ||
        ![b.sessionEpoch,b.snapshotGeneration,b.forwardRevision,b.deploymentGeneration,b.bindingFence,b.egressPolicyRevision].every(item => isCounter(item)) ||
        typeof b.configDigest !== 'string' || b.configDigest.length !== 71 || !/^sha256:[a-f0-9]{64}$/.test(b.configDigest) ||
        typeof value.instanceId !== 'string' || value.instanceId.length !== 64 || !/^[a-f0-9]{64}$/.test(value.instanceId) || !isCounter(value.instanceGeneration)) invalid();
    return deepFreeze({ ...value, binding: { ...b } }) as unknown as ProbeTelemetryIdentity;
}
export function parseProbeTelemetryPoint(input: unknown): ProbeTelemetryPoint {
    const value = closed(input, ['identity','state','capturedAt','endedAt','availability','counterEpoch','counters','overflowed']);
    const identity = parseProbeTelemetryIdentity(value.identity);
    if (!['current','terminal'].includes(value.state as string) || !timestamp(value.capturedAt) ||
        (value.state === 'terminal' ? value.endedAt !== value.capturedAt : value.endedAt !== null)) invalid();
    let counters: Record<string, unknown> | null = null;
    if (value.availability === 'available') {
        if (!epoch(value.counterEpoch) || typeof value.overflowed !== 'boolean') invalid();
        counters = closed(value.counters, counterKeys);
        if (counterKeys.some(key => !telemetryUint64(counters![key]))) invalid();
        if (!value.overflowed && BigInt(counters.attempted as string) !== BigInt(counters.succeeded as string) + BigInt(counters.failed as string) +
            BigInt(counters.unknown as string) + BigInt(counters.inFlight as string)) invalid();
    } else if (value.availability !== 'unavailable' || value.counterEpoch !== null || value.counters !== null || value.overflowed !== null) invalid();
    const point = { ...value, identity, counters: counters === null ? null : { ...counters } } as unknown as ProbeTelemetryPoint;
    if (new TextEncoder().encode(JSON.stringify(point)).byteLength > 4096) invalid();
    return deepFreeze(point);
}
export function parseProbeTelemetryCoverage(input: unknown, returned: number): ProbeTelemetryCoverage {
    const value = closed(input, ['limit','snapshotLimit','available','returned','omitted','truncated','offset','nextOffset','unavailableSources','retiringSourceLimit','retiringSources',
        'tailLimit','tailRetentionSeconds','tailsEvicted','tailsExpired','historyComplete']);
    if (!isCounter(returned, true) || returned > 32 || value.limit !== 32 || value.snapshotLimit !== 2 || !isCounter(value.available, true) ||
        value.available > 2432 || value.returned !== returned || returned > Math.min(32, value.available) || value.omitted !== value.available - returned ||
        value.truncated !== (value.available > returned) || !isCounter(value.offset, true) || !isCounter(value.nextOffset, true) ||
        !isCounter(value.unavailableSources, true) || value.unavailableSources > 1 || value.retiringSourceLimit !== 8 ||
        !isCounter(value.retiringSources, true) || value.retiringSources > 8 || value.available > 384 + value.retiringSources * 256 || value.tailLimit !== 128 || value.tailRetentionSeconds !== 600 ||
        !telemetryUint64(value.tailsEvicted) || !telemetryUint64(value.tailsExpired) || value.historyComplete !== false) invalid();
    if (value.available === 0 ? value.offset !== 0 || value.nextOffset !== 0 : value.offset >= value.available ||
        value.nextOffset !== (value.truncated ? (value.offset + Math.max(1, returned)) % value.available : 0)) invalid();
    return deepFreeze({ ...value }) as unknown as ProbeTelemetryCoverage;
}
export function parseProbeTelemetrySample(input: unknown): ProbeTelemetrySample {
    const value = closed(input, ['probeTelemetryVersion','kind','nodeId','bootId','sessionEpoch','sampleEpoch','sequence',
        'capturedAt','uptimeMs','droppedSamples','coverage','items']);
    binding(value);
    if (value.kind !== 'probe-telemetry-sample' || !timestamp(value.capturedAt) || !isCounter(value.uptimeMs, true) ||
        !telemetryUint64(value.droppedSamples) || !Array.isArray(value.items) || value.items.length > 32) invalid();
    const identities = new Set<string>(), snapshots = new Set<number>();
    const items = value.items.map(item => {
        const point = parseProbeTelemetryPoint(item), b = point.identity.binding;
        if (b.nodeId !== value.nodeId || b.bootId !== value.bootId || b.sessionEpoch !== value.sessionEpoch || compareTimes(point.capturedAt, value.capturedAt as string) > 0) invalid();
        const key = digest({ identity: point.identity, counterEpoch: point.counterEpoch });
        if (identities.has(key)) invalid();
        identities.add(key); snapshots.add(b.snapshotGeneration);
        return point;
    });
    if (snapshots.size > 2) invalid();
    const coverage = parseProbeTelemetryCoverage(value.coverage, items.length);
    return deepFreeze({ ...value, coverage, items }) as unknown as ProbeTelemetrySample;
}
export function parseProbeTelemetryAck(input: unknown): ProbeTelemetryAck {
    const value = closed(input, ['probeTelemetryVersion','kind','nodeId','bootId','sessionEpoch','sampleEpoch','sequence',
        'receivedAt','stored','acceptedPoints','rejectedPoints','source','executionAuthorized']);
    binding(value);
    if (value.kind !== 'probe-telemetry-ack' || !timestamp(value.receivedAt) || value.stored !== true ||
        !isCounter(value.acceptedPoints, true) || !isCounter(value.rejectedPoints, true) || value.acceptedPoints + value.rejectedPoints > 32 ||
        value.source !== 'agent-reported' || value.executionAuthorized !== false) invalid();
    return deepFreeze({ ...value }) as unknown as ProbeTelemetryAck;
}
export function parseRawProbeTelemetrySample(raw: string): ProbeTelemetrySample { return parseProbeTelemetrySample(parseJson(raw, 65536)); }
export function parseRawProbeTelemetryAck(raw: string): ProbeTelemetryAck { return parseProbeTelemetryAck(parseJson(raw, 4096)); }
