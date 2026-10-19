import { deepFreeze, isCounter, isId } from '@tunex/core';
import { parseJson } from './json.ts';
import { telemetryUint64 } from './telemetry.ts';

type Availability = 'available' | 'unavailable' | 'unsupported';
interface HostTelemetrySources {
    scope: 'agent-visible-os';
    cpu: { availability: Availability; logicalProcessors: number | null; totalTicks: string | null; idleTicks: string | null; ioWaitTicks: string | null };
    memory: { availability: Availability; totalBytes: string | null; availableBytes: string | null };
    load: { availability: Availability; oneMilli: string | null; fiveMilli: string | null; fifteenMilli: string | null };
    filesystem: { availability: Availability; scope: 'agent-root-filesystem'; totalBytes: string | null; availableBytes: string | null };
    network: {
        availability: Availability;
        scope: 'agent-network-namespace';
        limit: 16;
        available: number;
        returned: number;
        omitted: number;
        truncated: boolean;
        interfaces: { name: string; rxBytes: string; txBytes: string }[];
    };
}
export interface HostTelemetrySample {
    hostTelemetryVersion: 1;
    kind: 'host-telemetry-sample';
    nodeId: string;
    bootId: string;
    sessionEpoch: number;
    sampleEpoch: string;
    sequence: number;
    capturedAt: string;
    uptimeMs: number;
    platform: string;
    droppedSamples: string;
    host: HostTelemetrySources;
}
export interface HostTelemetryAck {
    hostTelemetryVersion: 1;
    kind: 'host-telemetry-ack';
    nodeId: string;
    bootId: string;
    sessionEpoch: number;
    sampleEpoch: string;
    sequence: number;
    stored: true;
    receivedAt: string;
    source: 'agent-reported';
    executionAuthorized: false;
}
const platforms = new Set(['aix','android','darwin','dragonfly','freebsd','illumos','ios','js','linux','netbsd','openbsd','plan9','solaris','wasip1','windows']);
const epoch = (value: unknown): value is string => typeof value === 'string' && value.length === 32 && /^[a-f0-9]{32}$/.test(value);
function invalid(): never { throw new Error('INVALID_CONFIG: Invalid host-telemetry-v1 message'); }
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
    if (value.hostTelemetryVersion !== 1 || !isId(value.nodeId) || !isId(value.bootId) ||
        !isCounter(value.sessionEpoch) || !isCounter(value.sequence) || !epoch(value.sampleEpoch)) invalid();
}
function source(value: Record<string, unknown>, measurements: string[]): void {
    if (!['available','unavailable','unsupported'].includes(value.availability as string)) invalid();
    if (value.availability !== 'available' && measurements.some(key => value[key] !== null)) invalid();
}
export function parseHostTelemetrySample(input: unknown): HostTelemetrySample {
    const value = closed(input, ['hostTelemetryVersion','kind','nodeId','bootId','sessionEpoch','sampleEpoch','sequence',
        'capturedAt','uptimeMs','platform','droppedSamples','host']);
    binding(value);
    if (value.kind !== 'host-telemetry-sample' || !timestamp(value.capturedAt) || !isCounter(value.uptimeMs, true) ||
        typeof value.platform !== 'string' || !platforms.has(value.platform) || !telemetryUint64(value.droppedSamples)) invalid();
    const host = closed(value.host, ['scope','cpu','memory','load','filesystem','network']);
    if (host.scope !== 'agent-visible-os') invalid();
    const cpu = closed(host.cpu, ['availability','logicalProcessors','totalTicks','idleTicks','ioWaitTicks']);
    source(cpu, ['logicalProcessors','totalTicks','idleTicks','ioWaitTicks']);
    if (cpu.availability === 'available' && (!isCounter(cpu.logicalProcessors) || cpu.logicalProcessors > 65536 ||
        !telemetryUint64(cpu.totalTicks) || !telemetryUint64(cpu.idleTicks) || !telemetryUint64(cpu.ioWaitTicks) ||
        BigInt(cpu.idleTicks) + BigInt(cpu.ioWaitTicks) > BigInt(cpu.totalTicks))) invalid();
    const memory = closed(host.memory, ['availability','totalBytes','availableBytes']);
    source(memory, ['totalBytes','availableBytes']);
    if (memory.availability === 'available' && (!telemetryUint64(memory.totalBytes) || !telemetryUint64(memory.availableBytes) ||
        BigInt(memory.availableBytes) > BigInt(memory.totalBytes))) invalid();
    const load = closed(host.load, ['availability','oneMilli','fiveMilli','fifteenMilli']);
    source(load, ['oneMilli','fiveMilli','fifteenMilli']);
    if (load.availability === 'available' && ['oneMilli','fiveMilli','fifteenMilli'].some(key => !telemetryUint64(load[key]))) invalid();
    const filesystem = closed(host.filesystem, ['availability','scope','totalBytes','availableBytes']);
    source(filesystem, ['totalBytes','availableBytes']);
    if (filesystem.scope !== 'agent-root-filesystem' || filesystem.availability === 'available' &&
        (!telemetryUint64(filesystem.totalBytes) || !telemetryUint64(filesystem.availableBytes) || BigInt(filesystem.availableBytes) > BigInt(filesystem.totalBytes))) invalid();
    const network = closed(host.network, ['availability','scope','limit','available','returned','omitted','truncated','interfaces']);
    source(network, []);
    if (network.scope !== 'agent-network-namespace' || network.limit !== 16 || !isCounter(network.available, true) || network.available > 128 ||
        !Array.isArray(network.interfaces) || network.interfaces.length > 16 || network.returned !== network.interfaces.length ||
        network.returned !== Math.min(network.available, 16) || network.omitted !== network.available - network.interfaces.length ||
        network.truncated !== (network.available > network.interfaces.length) || network.availability !== 'available' && network.available !== 0) invalid();
    const interfaces = network.interfaces.map((entry, index) => {
        const item = closed(entry, ['name','rxBytes','txBytes']);
        if (typeof item.name !== 'string' || item.name.length < 1 || item.name.length > 63 || !/^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,62}$/.test(item.name) ||
            /\s/.test(item.name) || !telemetryUint64(item.rxBytes) || !telemetryUint64(item.txBytes) ||
            index > 0 && ((network.interfaces as Record<string, unknown>[])[index - 1]!.name as string) >= item.name) invalid();
        return { ...item };
    });
    if (value.platform !== 'linux' && [cpu,memory,load,filesystem,network].some(item => item.availability !== 'unsupported')) invalid();
    const result = { ...value, host: { ...host, cpu: { ...cpu }, memory: { ...memory }, load: { ...load },
        filesystem: { ...filesystem }, network: { ...network, interfaces } } };
    if (new TextEncoder().encode(JSON.stringify(result)).byteLength > 8192) invalid();
    return deepFreeze(result) as unknown as HostTelemetrySample;
}
export function parseHostTelemetryAck(input: unknown): HostTelemetryAck {
    const value = closed(input, ['hostTelemetryVersion','kind','nodeId','bootId','sessionEpoch','sampleEpoch','sequence',
        'stored','receivedAt','source','executionAuthorized']);
    binding(value);
    if (value.kind !== 'host-telemetry-ack' || value.stored !== true || !timestamp(value.receivedAt) ||
        value.source !== 'agent-reported' || value.executionAuthorized !== false) invalid();
    return deepFreeze({ ...value }) as unknown as HostTelemetryAck;
}
export function parseRawHostTelemetrySample(raw: string): HostTelemetrySample { return parseHostTelemetrySample(parseJson(raw, 8192)); }
export function parseRawHostTelemetryAck(raw: string): HostTelemetryAck { return parseHostTelemetryAck(parseJson(raw, 4096)); }
export function parseHostTelemetry(kind: 'sample', raw: string): HostTelemetrySample;
export function parseHostTelemetry(kind: 'ack', raw: string): HostTelemetryAck;
export function parseHostTelemetry(kind: 'sample' | 'ack', raw: string): HostTelemetrySample | HostTelemetryAck {
    return kind === 'sample' ? parseRawHostTelemetrySample(raw) : parseRawHostTelemetryAck(raw);
}
