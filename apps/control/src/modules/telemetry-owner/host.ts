import { deepFreeze, isCounter, isId } from '@tunex/core';
import { nativeValueDigest as digest, nativeParseTime, nativeIsoTime, nativeWallClockSource } from '../../compatibility/public.ts';
import { nativeHostTelemetryAck, parseHostTelemetrySample, telemetryUint64 } from '../../compatibility/public.ts';
import type { HostTelemetrySample } from '../../compatibility/public.ts';
import { ControlError, invalid, notFound } from '../../framework/public.ts';
import type { ScopeAuthorization, TransactionBoundary } from '../../framework/public.ts';
import type { TelemetryHead, TelemetryMachineAuthorization, TelemetryNode, TelemetryPoint } from './node-contracts.ts';
import type { HostTelemetryStore } from './host-contracts.ts';
import type { TelemetryRollupRecorder } from './rollup-contracts.ts';
import { hostObservation } from './rollup-values.ts';
import { HOST_TELEMETRY_LIMITS } from './policy.ts';
import type { HostTelemetryApi, TelemetryHistoryQuery as Query, HostTelemetryDelta as PointDelta } from './api.ts';
export { HOST_TELEMETRY_LIMITS } from './policy.ts';

const epoch = (value: unknown): value is string => typeof value === 'string' && value.length === 32 && /^[a-f0-9]{32}$/.test(value);
const hash = (value: unknown): value is string => typeof value === 'string' && value.length === 71 && /^sha256:[a-f0-9]{64}$/.test(value);
const timestamp = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 253402300799999;
function corrupt(): never { throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid persisted host telemetry metadata'); }
function time(value: string): number {
    const at = nativeParseTime(value);
    if (!timestamp(at) || nativeIsoTime(at) !== value) invalid('Canonical UTC telemetry window required');
    return at;
}

/** Independent operational read model. No Runtime locks, execution writes or network probes. */
export class HostTelemetry<Tx> implements HostTelemetryApi {
    readonly enabled: boolean;
    private readonly db: TransactionBoundary<Tx>;
    private readonly auth: ScopeAuthorization<Tx>;
    private readonly machine: TelemetryMachineAuthorization<Tx>;
    private readonly store: HostTelemetryStore<Tx>;
    private readonly clock: () => number;
    private readonly rollups: TelemetryRollupRecorder<Tx> | undefined;
    private active = 0;
    private requests = 0;
    private readonly activeNodes = new Set<string>();
    private readonly readStarts = new Map<string, number>();
    constructor(db: TransactionBoundary<Tx>, auth: ScopeAuthorization<Tx>, machine: TelemetryMachineAuthorization<Tx>,
        store: HostTelemetryStore<Tx>, enabled = false, clock: () => number = nativeWallClockSource(), rollups?: TelemetryRollupRecorder<Tx>) {
        this.db = db; this.auth = auth; this.machine = machine; this.store = store; this.enabled = enabled; this.clock = clock;
        this.rollups = rollups;
    }
    private now() { const now = this.clock(); if (!timestamp(now)) corrupt(); return now; }
    private async admitted<T>(key: string, action: () => Promise<T>): Promise<T> {
        if (this.active >= 2 || this.activeNodes.has(key))
            throw new ControlError('HOST_TELEMETRY_BUSY', 429, 'Telemetry capacity unavailable', true);
        this.active++; this.activeNodes.add(key);
        try { return await action(); } finally { this.active--; this.activeNodes.delete(key); }
    }
    async admitMachineRequest<T>(action: () => Promise<T>): Promise<T> {
        if (!this.enabled) throw new ControlError('HOST_TELEMETRY_DISABLED', 503, 'Telemetry collection is disabled');
        if (this.requests >= 4) throw new ControlError('HOST_TELEMETRY_BUSY', 429, 'Telemetry request capacity unavailable', true);
        this.requests++;
        try { return await action(); } finally { this.requests--; }
    }
    async admitReadRequest<T>(action: () => Promise<T>): Promise<T> {
        if (this.requests >= 4) throw new ControlError('HOST_TELEMETRY_BUSY', 429, 'Telemetry request capacity unavailable', true);
        this.requests++;
        try { return await action(); } finally { this.requests--; }
    }
    private node(record: TelemetryNode | null, nodeId: string): TelemetryNode {
        if (!record) notFound();
        if (record.nodeId !== nodeId || !isId(record.scopeId) || typeof record.revoked !== 'boolean' ||
            !timestamp(record.credentialUntil) || !isCounter(record.sessionEpoch, true) || record.bootId !== null && !isId(record.bootId)) corrupt();
        return record;
    }
    private head(record: TelemetryHead, scopeId: string, nodeId: string): TelemetryHead {
        if (record.nodeId !== nodeId || record.scopeId !== scopeId || !isCounter(record.sessionEpoch) || !isId(record.bootId) ||
            !epoch(record.sampleEpoch) || !isCounter(record.lastSequence, true) || !isCounter(record.lastUptimeMs, true) ||
            !timestamp(record.lastReceivedAt) || !timestamp(record.lastCapturedAt) || !telemetryUint64(record.droppedSamples) ||
            (record.lastSequence === 0 ? record.lastDigest !== null : !hash(record.lastDigest))) corrupt();
        return record;
    }
    async ingest(nodeId: string, fingerprint: string, sessionEpoch: number, input: unknown) {
        if (!this.enabled) throw new ControlError('HOST_TELEMETRY_DISABLED', 503, 'Telemetry collection is disabled');
        const sample = parseHostTelemetrySample(input);
        if (!isId(nodeId) || typeof fingerprint !== 'string' || fingerprint.length !== 64 || !/^[a-f0-9]{64}$/.test(fingerprint) ||
            sample.nodeId !== nodeId || sample.sessionEpoch !== sessionEpoch)
            throw new ControlError('AUTHORIZATION_DENIED', 403, 'Telemetry machine identity differs');
        const requestDigest = digest(sample);
        return this.admitted('write:' + nodeId, () => this.db.transaction(async tx => {
            await this.machine.credential(tx, nodeId, fingerprint);
            const current = this.node(await this.store.node(tx, nodeId), nodeId), now = this.now();
            if (current.revoked || current.credentialUntil <= now || current.sessionEpoch !== sample.sessionEpoch || current.bootId !== sample.bootId)
                throw new ControlError('SESSION_SUPERSEDED', 409, 'Telemetry requires the current Node session');
            if (Math.abs(nativeParseTime(sample.capturedAt) - now) > HOST_TELEMETRY_LIMITS.maxSampleClockSkewMs)
                throw new ControlError('HOST_TELEMETRY_CLOCK_SKEW', 409, 'Telemetry sample time outside accepted window');
            const head = this.head(await this.store.lockHead(tx, current.scopeId, sample), current.scopeId, nodeId);
            const sameSession = head.sessionEpoch === sample.sessionEpoch && head.bootId === sample.bootId;
            if (head.lastSequence > 0) {
                if (head.sessionEpoch > sample.sessionEpoch || head.sessionEpoch === sample.sessionEpoch && !sameSession)
                    throw new ControlError('SESSION_SUPERSEDED', 409, 'Telemetry session regressed');
                if (sameSession && head.sampleEpoch !== sample.sampleEpoch || !sameSession && head.sampleEpoch === sample.sampleEpoch)
                    throw new ControlError('HOST_TELEMETRY_EPOCH_CONFLICT', 409, 'A telemetry epoch belongs to exactly one Node session');
                if (sameSession && sample.sequence <= head.lastSequence) {
                    if (sample.sequence !== head.lastSequence || requestDigest !== head.lastDigest)
                        throw new ControlError('HOST_TELEMETRY_SEQUENCE_CONFLICT', 409, 'Telemetry sequence regressed or body changed');
                    return this.ack(sample, head.lastReceivedAt);
                }
                if (sameSession && sample.uptimeMs <= head.lastUptimeMs)
                    throw new ControlError('HOST_TELEMETRY_SEQUENCE_CONFLICT', 409, 'Telemetry monotonic uptime did not advance');
                if (now < head.lastReceivedAt || now - head.lastReceivedAt < HOST_TELEMETRY_LIMITS.minSampleIntervalMs)
                    throw new ControlError('HOST_TELEMETRY_RATE_LIMIT', 429, 'Node telemetry interval is bounded', true);
            }
            await this.store.append(tx, current.scopeId, sample, requestDigest, now);
            await this.rollups?.append(tx, [hostObservation(current.scopeId, sample, now)]);
            return this.ack(sample, now);
        }));
    }
    private ack(sample: HostTelemetrySample, receivedAt: number) {
        return nativeHostTelemetryAck(sample, receivedAt);
    }
    private sample(point: TelemetryPoint, scopeId: string, nodeId: string): HostTelemetrySample {
        let sample: HostTelemetrySample;
        try { sample = parseHostTelemetrySample(point.body); } catch { corrupt(); }
        if (point.nodeId !== nodeId || point.scopeId !== scopeId || sample.nodeId !== nodeId ||
            sample.sessionEpoch !== point.sessionEpoch || sample.bootId !== point.bootId || sample.sampleEpoch !== point.sampleEpoch ||
            sample.sequence !== point.sequence || nativeParseTime(sample.capturedAt) !== point.capturedAt || sample.uptimeMs !== point.uptimeMs ||
            !timestamp(point.receivedAt) || !timestamp(point.capturedAt) || typeof point.recoverySuspended !== 'boolean' || digest(sample) !== point.digest) corrupt();
        return sample;
    }
    private view(point: TelemetryPoint, previous: TelemetryPoint | undefined, current: TelemetryNode, now: number) {
        const sample = this.sample(point, current.scopeId, current.nodeId);
        const sessionCurrent = this.enabled && !point.recoverySuspended && !current.revoked && current.credentialUntil > now &&
            current.sessionEpoch === sample.sessionEpoch && current.bootId === sample.bootId;
        const delta: PointDelta = { status: sessionCurrent ? 'baseline' : 'historical', elapsedMs: null,
            cpuTotalTicks: null, cpuIdleTicks: null, cpuIoWaitTicks: null, exportDroppedSamples: null };
        if (sessionCurrent && previous && !previous.recoverySuspended) {
            const old = this.sample(previous, current.scopeId, current.nodeId);
            if (old.sessionEpoch === sample.sessionEpoch && old.bootId === sample.bootId && old.sampleEpoch === sample.sampleEpoch) {
                const dropped = BigInt(sample.droppedSamples) - BigInt(old.droppedSamples);
                const cpu = sample.host.cpu, before = old.host.cpu;
                const comparable = cpu.availability === 'available' && before.availability === 'available' &&
                    cpu.logicalProcessors === before.logicalProcessors;
                const total = comparable ? BigInt(cpu.totalTicks!) - BigInt(before.totalTicks!) : null;
                const idle = comparable ? BigInt(cpu.idleTicks!) - BigInt(before.idleTicks!) : null;
                const wait = comparable ? BigInt(cpu.ioWaitTicks!) - BigInt(before.ioWaitTicks!) : null;
                const reset = total !== null && (total <= 0n || idle! < 0n || wait! < 0n || idle! + wait! > total);
                delta.exportDroppedSamples = dropped < 0n ? null : dropped.toString();
                if (sample.uptimeMs <= old.uptimeMs || sample.sequence <= old.sequence || dropped < 0n || reset)
                    delta.status = 'counter-reset';
                else if (sample.sequence !== old.sequence + 1 || dropped > 0n) delta.status = 'gap';
                else {
                    delta.status = 'continuous'; delta.elapsedMs = sample.uptimeMs - old.uptimeMs;
                    delta.cpuTotalTicks = total?.toString() ?? null;
                    delta.cpuIdleTicks = idle?.toString() ?? null;
                    delta.cpuIoWaitTicks = wait?.toString() ?? null;
                }
            }
        }
        return { sample, receivedAt: nativeIsoTime(point.receivedAt), recoverySuspended: point.recoverySuspended,
            sessionCurrent, freshness: !sessionCurrent ? 'historical' as const : now >= point.receivedAt && now - point.receivedAt <= HOST_TELEMETRY_LIMITS.freshnessMs ? 'fresh' as const : 'stale' as const,
            delta };
    }
    async history(actor: string, scopeId: string, nodeId: string, input: Query = {}) {
        if (![actor, scopeId, nodeId].every(isId)) invalid('Valid telemetry Scope and Node required');
        if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
            Object.keys(input).some(name => !['from', 'to', 'limit'].includes(name)) ||
            Object.values(input).some(value => value !== undefined && typeof value !== 'string')) invalid('Bounded telemetry window required');
        const now = this.now(), to = input.to === undefined ? now : time(input.to),
            from = input.from === undefined ? to - 900000 : time(input.from);
        const limit = input.limit === undefined ? 128 : !/\s/.test(input.limit) && /^[1-9][0-9]{0,2}$/.test(input.limit) ? Number(input.limit) : NaN;
        if (!timestamp(from) || !timestamp(to) || from >= to || to - from > 86400000 ||
            from < now - 86400000 - 300000 || to > now + 300000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 512)
            invalid('Telemetry query needs a last-24-hour window and at most 512 points');
        for (const [key, started] of this.readStarts) if (now >= started && now - started >= 1000) this.readStarts.delete(key);
        if (this.readStarts.has(actor) || this.readStarts.size >= 128)
            throw new ControlError('HOST_TELEMETRY_RATE_LIMIT', 429, 'Telemetry reader cooldown active', true);
        this.readStarts.set(actor, now);
        return this.admitted('read:' + actor + ':' + nodeId, () => this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scopeId);
            const current = this.node(await this.store.node(tx, nodeId), nodeId);
            if (current.scopeId !== scopeId) notFound();
            const retainedFrom = Math.max(0, now - 86400000), effectiveFrom = Math.max(from, retainedFrom);
            const records = await this.store.history(tx, scopeId, nodeId, effectiveFrom, to, limit);
            if (!Array.isArray(records) || records.length > limit + 1 || records.some((point, index) =>
                point.receivedAt < effectiveFrom || point.receivedAt > to || index > 0 && records[index - 1]!.receivedAt > point.receivedAt)) corrupt();
            const identities = new Set<string>();
            for (const point of records) {
                const sample = this.sample(point, scopeId, nodeId), key = sample.sampleEpoch + ':' + sample.sequence;
                if (identities.has(key)) corrupt(); identities.add(key);
            }
            const latest = await this.store.latest(tx, scopeId, nodeId, retainedFrom);
            if (!Array.isArray(latest) || latest.length > 2 || latest.some((point, index) => point.receivedAt < retainedFrom ||
                index > 0 && latest[index - 1]!.receivedAt < point.receivedAt)) corrupt();
            for (const point of latest) this.sample(point, scopeId, nodeId);
            const selected = records.slice(0, limit), observedAt = this.now();
            return deepFreeze({ hostTelemetryVersion: 1, nodeId, enabled: this.enabled, source: 'agent-reported', health: 'unknown',
                executionAuthorized: false, observedAt: nativeIsoTime(observedAt),
                currentSession: current.sessionEpoch > 0 && current.bootId !== null ? { sessionEpoch: current.sessionEpoch, bootId: current.bootId } : null,
                nodeRevoked: current.revoked, window: { from: nativeIsoTime(from), to: nativeIsoTime(to), limit, truncated: records.length > limit },
                retention: { rawSeconds: HOST_TELEMETRY_LIMITS.rawSeconds, maxPointsPerNode: HOST_TELEMETRY_LIMITS.maxPointsPerNode },
                latest: latest[0] ? this.view(latest[0], latest[1], current, observedAt) : null,
                items: selected.map((point, index) => this.view(point, selected[index - 1], current, observedAt)),
            });
        }));
    }
    async prune() {
        return this.admitted('retention', () => this.db.transaction(tx => this.store.prune(tx, Math.max(0, this.now() - 86400000))));
    }
}
