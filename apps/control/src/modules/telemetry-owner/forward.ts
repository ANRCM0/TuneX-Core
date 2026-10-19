import { deepFreeze, isCounter, isId } from '@tunex/core';
import { nativeCompareTimes as compareTimes, nativeValueDigest as digest, nativeParseTime, nativeIsoTime, nativeWallClockSource, jsonUtf8DefaultBytes } from '../../compatibility/public.ts';
import { nativeForwardTelemetryAck, parseForwardTelemetryCoverage, parseForwardTelemetryIdentity, parseForwardTelemetryPoint, parseForwardTelemetrySample, telemetryUint64 } from '../../compatibility/public.ts';
import type { ForwardTelemetryPoint, ForwardTelemetrySample } from '../../compatibility/public.ts';
import { ControlError, invalid, notFound } from '../../framework/public.ts';
import type { ScopeAuthorization, TransactionBoundary } from '../../framework/public.ts';
import type { TelemetryMachineAuthorization, TelemetryNode } from './node-contracts.ts';
import type { ForwardTelemetryAccepted, ForwardTelemetryExport, ForwardTelemetryForward,
    ForwardTelemetryHead, ForwardTelemetryRecord, ForwardTelemetryStore } from './forward-contracts.ts';
import type { ForwardTelemetryMappingPort } from './forward-mapping-contracts.ts';
import type { TelemetryRollupRecorder } from './rollup-contracts.ts';
import { forwardObservations } from './rollup-values.ts';
import { FORWARD_TELEMETRY_LIMITS } from './policy.ts';
import type { ForwardTelemetryApi, TelemetryHistoryQuery as Query, ForwardTelemetryCounterName as CounterName, ForwardTelemetryDelta as Delta } from './api.ts';
export { FORWARD_TELEMETRY_LIMITS } from './policy.ts';

interface ValidRecord { record: ForwardTelemetryRecord; point: ForwardTelemetryPoint; exporter: ForwardTelemetryExport }
const counterNames: CounterName[] = ['payloadSentBytes', 'payloadReceivedBytes', 'tcpAccepted', 'tcpConnected', 'tcpClosed',
    'udpAssociationsCreated', 'udpAssociationsClosed', 'udpDatagramsSent', 'udpDatagramsReceived'];
const epoch = (v: unknown): v is string => typeof v === 'string' && v.length === 32 && /^[a-f0-9]{32}$/.test(v);
const hash = (v: unknown): v is string => typeof v === 'string' && v.length === 71 && /^sha256:[a-f0-9]{64}$/.test(v);
const timestamp = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 253402300799999;
function corrupt(): never { throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid persisted forward telemetry'); }
function closed(input: unknown, keys: string[]): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
        Object.keys(input).sort().join(',') !== [...keys].sort().join(',')) corrupt();
    return input as Record<string, unknown>;
}
function captured(value: unknown): value is string {
    if (typeof value !== 'string' || /\s/.test(value) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value)) return false;
    const at = nativeParseTime(value);
    return timestamp(at) && nativeIsoTime(at).slice(0, 19) === value.slice(0, 19);
}
function queryTime(value: string): number {
    const at = nativeParseTime(value);
    if (!timestamp(at) || nativeIsoTime(at) !== value) invalid('Canonical UTC telemetry window required');
    return at;
}
function exporter(input: unknown): ForwardTelemetryExport {
    const v = closed(input, ['sampleEpoch', 'sequence', 'capturedAt', 'uptimeMs', 'snapshotGeneration', 'droppedSamples', 'coverage']);
    if (!epoch(v.sampleEpoch) || !isCounter(v.sequence) || !captured(v.capturedAt) || !isCounter(v.uptimeMs, true) ||
        !isCounter(v.snapshotGeneration, true) || !telemetryUint64(v.droppedSamples)) corrupt();
    const coverageInput = v.coverage as Record<string, unknown> | null;
    let coverage: ForwardTelemetrySample['coverage'];
    try { coverage = parseForwardTelemetryCoverage(v.coverage, coverageInput?.returned as number); } catch { corrupt(); }
    const result = { ...v, coverage } as unknown as ForwardTelemetryExport;
    if (jsonUtf8DefaultBytes(result) > FORWARD_TELEMETRY_LIMITS.maxMetadataBytes) corrupt();
    return result;
}
function recordOrder(a: ForwardTelemetryRecord, b: ForwardTelemetryRecord): number {
    const text = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
    return a.receivedAt - b.receivedAt || text(a.nodeId, b.nodeId) ||
        text(a.sampleEpoch, b.sampleEpoch) || a.sequence - b.sequence || a.itemIndex - b.itemIndex;
}
function recordKey(v: ForwardTelemetryRecord): string { return `${v.nodeId}/${v.sampleEpoch}/${v.sequence}/${v.itemIndex}`; }
function instanceKey(v: ValidRecord): string { return v.record.identityDigest + '/' + (v.point.counterEpoch ?? 'unavailable'); }

/** Separate operational intake/read model. Published mapping never issues or extends execution authority. */
export class ForwardTelemetry<Tx> implements ForwardTelemetryApi {
    readonly enabled: boolean;
    private readonly db: TransactionBoundary<Tx>;
    private readonly auth: ScopeAuthorization<Tx>;
    private readonly machine: TelemetryMachineAuthorization<Tx>;
    private readonly store: ForwardTelemetryStore<Tx>;
    private readonly mapping: ForwardTelemetryMappingPort<Tx>;
    private readonly clock: () => number;
    private readonly rollups: TelemetryRollupRecorder<Tx> | undefined;
    private active = 0;
    private requests = 0;
    private readonly activeKeys = new Set<string>();
    private readonly readStarts = new Map<string, number>();
    constructor(db: TransactionBoundary<Tx>, auth: ScopeAuthorization<Tx>, machine: TelemetryMachineAuthorization<Tx>,
        store: ForwardTelemetryStore<Tx>, mapping: ForwardTelemetryMappingPort<Tx>, enabled = false, clock: () => number = nativeWallClockSource(), rollups?: TelemetryRollupRecorder<Tx>) {
        this.db = db; this.auth = auth; this.machine = machine; this.store = store;
        this.mapping = mapping; this.enabled = enabled; this.clock = clock;
        this.rollups = rollups;
    }
    private now(): number { const now = this.clock(); if (!timestamp(now)) corrupt(); return now; }
    private async admitted<T>(key: string, action: () => Promise<T>): Promise<T> {
        if (this.active >= 2 || this.activeKeys.has(key))
            throw new ControlError('FORWARD_TELEMETRY_BUSY', 429, 'Forward telemetry capacity unavailable', true);
        this.active++; this.activeKeys.add(key);
        try { return await action(); } finally { this.active--; this.activeKeys.delete(key); }
    }
    async admitMachineRequest<T>(action: () => Promise<T>): Promise<T> {
        if (!this.enabled) throw new ControlError('FORWARD_TELEMETRY_DISABLED', 503, 'Forward telemetry collection is disabled');
        if (this.requests >= 4) throw new ControlError('FORWARD_TELEMETRY_BUSY', 429, 'Forward telemetry request capacity unavailable', true);
        this.requests++;
        try { return await action(); } finally { this.requests--; }
    }
    async admitReadRequest<T>(action: () => Promise<T>): Promise<T> {
        if (this.requests >= 4) throw new ControlError('FORWARD_TELEMETRY_BUSY', 429, 'Forward telemetry request capacity unavailable', true);
        this.requests++;
        try { return await action(); } finally { this.requests--; }
    }
    private node(record: TelemetryNode | null, nodeId: string): TelemetryNode {
        if (!record) notFound();
        if (record.nodeId !== nodeId || !isId(record.scopeId) || typeof record.revoked !== 'boolean' ||
            !timestamp(record.credentialUntil) || !isCounter(record.sessionEpoch, true) || record.bootId !== null && !isId(record.bootId)) corrupt();
        return record;
    }
    private forward(record: ForwardTelemetryForward | null, scope: string, id: string): ForwardTelemetryForward {
        if (!record) notFound();
        if (record.scopeId !== scope || record.forwardId !== id || !isCounter(record.revision) ||
            typeof record.deleting !== 'boolean' || typeof record.recoverySuspended !== 'boolean') corrupt();
        return record;
    }
    private head(v: ForwardTelemetryHead, scopeId: string, nodeId: string): ForwardTelemetryHead {
        if (v.nodeId !== nodeId || v.scopeId !== scopeId || !isCounter(v.sessionEpoch) || !isId(v.bootId) || !epoch(v.sampleEpoch) ||
            !isCounter(v.lastSequence, true) || !isCounter(v.lastUptimeMs, true) || !timestamp(v.lastReceivedAt) || !timestamp(v.lastCapturedAt) ||
            !telemetryUint64(v.droppedSamples) || (v.lastSequence === 0 ? v.lastDigest !== null : !hash(v.lastDigest)) ||
            !isCounter(v.acceptedPoints, true) || !isCounter(v.rejectedPoints, true) || v.acceptedPoints + v.rejectedPoints > 32) corrupt();
        return v;
    }
    private ack(sample: ForwardTelemetrySample, at: number, accepted: number, rejected: number) {
        if (accepted + rejected !== sample.items.length) corrupt();
        return nativeForwardTelemetryAck(sample, at, accepted, rejected);
    }
    async ingest(nodeId: string, fingerprint: string, sessionEpoch: number, input: unknown) {
        if (!this.enabled) throw new ControlError('FORWARD_TELEMETRY_DISABLED', 503, 'Forward telemetry collection is disabled');
        const sample = parseForwardTelemetrySample(input);
        if (!isId(nodeId) || typeof fingerprint !== 'string' || fingerprint.length !== 64 || !/^[a-f0-9]{64}$/.test(fingerprint) ||
            sample.nodeId !== nodeId || sample.sessionEpoch !== sessionEpoch)
            throw new ControlError('AUTHORIZATION_DENIED', 403, 'Forward telemetry machine identity differs');
        const requestDigest = digest(sample);
        return this.admitted('write:' + nodeId, () => this.db.transaction(async tx => {
            await this.machine.credential(tx, nodeId, fingerprint);
            const current = this.node(await this.store.node(tx, nodeId), nodeId), now = this.now();
            if (current.revoked || current.credentialUntil <= now || current.sessionEpoch !== sample.sessionEpoch || current.bootId !== sample.bootId)
                throw new ControlError('SESSION_SUPERSEDED', 409, 'Forward telemetry requires the current Node session');
            if (Math.abs(nativeParseTime(sample.capturedAt) - now) > FORWARD_TELEMETRY_LIMITS.maxSampleClockSkewMs)
                throw new ControlError('FORWARD_TELEMETRY_CLOCK_SKEW', 409, 'Forward telemetry sample time outside accepted window');
            const head = this.head(await this.store.lockHead(tx, current.scopeId, sample), current.scopeId, nodeId);
            const sameSession = head.sessionEpoch === sample.sessionEpoch && head.bootId === sample.bootId;
            if (head.lastSequence > 0) {
                if (head.sessionEpoch > sample.sessionEpoch || head.sessionEpoch === sample.sessionEpoch && !sameSession)
                    throw new ControlError('SESSION_SUPERSEDED', 409, 'Forward telemetry session regressed');
                if (sameSession && head.sampleEpoch !== sample.sampleEpoch || !sameSession && head.sampleEpoch === sample.sampleEpoch)
                    throw new ControlError('FORWARD_TELEMETRY_EPOCH_CONFLICT', 409, 'A forward telemetry epoch belongs to exactly one Node session');
                if (sameSession && sample.sequence <= head.lastSequence) {
                    if (sample.sequence !== head.lastSequence || requestDigest !== head.lastDigest)
                        throw new ControlError('FORWARD_TELEMETRY_SEQUENCE_CONFLICT', 409, 'Forward telemetry sequence regressed or body changed');
                    return this.ack(sample, head.lastReceivedAt, head.acceptedPoints, head.rejectedPoints);
                }
                if (sameSession && sample.uptimeMs <= head.lastUptimeMs)
                    throw new ControlError('FORWARD_TELEMETRY_SEQUENCE_CONFLICT', 409, 'Forward telemetry monotonic uptime did not advance');
                if (now < head.lastReceivedAt || now - head.lastReceivedAt < FORWARD_TELEMETRY_LIMITS.minSampleIntervalMs)
                    throw new ControlError('FORWARD_TELEMETRY_RATE_LIMIT', 429, 'Node forward telemetry interval is bounded', true);
            }
            const mappings = await this.mapping.resolve(tx,
                { nodeId, bootId: sample.bootId, sessionEpoch: sample.sessionEpoch }, sample.items);
            if (!Array.isArray(mappings) || mappings.length !== sample.items.length) corrupt();
            const accepted: ForwardTelemetryAccepted[] = [];
            for (let index = 0; index < sample.items.length; index++) {
                const point = sample.items[index]!, mapped = mappings[index];
                if (!mapped || nativeParseTime(sample.capturedAt) - nativeParseTime(point.capturedAt) > FORWARD_TELEMETRY_LIMITS.maxPointAgeMs) continue;
                let trusted: ForwardTelemetryPoint['identity'];
                try { trusted = parseForwardTelemetryIdentity(mapped.identity); } catch { corrupt(); }
                if (mapped.scopeId !== current.scopeId || digest(trusted) !== digest(point.identity) || !timestamp(mapped.publishedUntil) ||
                    !['current-published', 'retired-published'].includes(mapped.source) || typeof mapped.forwardRecoverySuspended !== 'boolean') corrupt();
                if (mapped.forwardRecoverySuspended) continue;
                accepted.push(deepFreeze({ index, point, mapping: { ...mapped, identity: trusted } }));
            }
            await this.store.append(tx, current.scopeId, sample, accepted, requestDigest, now);
            await this.rollups?.append(tx, forwardObservations(current.scopeId, sample, accepted.map(entry => entry.point), now));
            return this.ack(sample, now, accepted.length, sample.items.length - accepted.length);
        }));
    }
    private record(input: ForwardTelemetryRecord, scopeId: string, forwardId: string): ValidRecord {
        let point: ForwardTelemetryPoint, exported: ForwardTelemetryExport;
        try { point = parseForwardTelemetryPoint(input.point); exported = exporter(input.exporter); } catch { corrupt(); }
        const identity = point.identity;
        if (input.scopeId !== scopeId || input.forwardId !== forwardId || identity.forwardId !== forwardId ||
            input.nodeId !== identity.nodeId || input.bootId !== identity.bootId || input.sessionEpoch !== identity.sessionEpoch ||
            input.sampleEpoch !== exported.sampleEpoch || input.sequence !== exported.sequence || !isCounter(input.itemIndex, true) ||
            input.itemIndex >= exported.coverage.returned || input.receivedAt < 0 || !timestamp(input.receivedAt) ||
            input.capturedAt !== nativeParseTime(point.capturedAt) || input.sampleCapturedAt !== nativeParseTime(exported.capturedAt) ||
            input.uptimeMs !== exported.uptimeMs || input.identityDigest !== digest(identity) || input.counterEpoch !== point.counterEpoch ||
            !timestamp(input.publishedUntil) || !['current-published', 'retired-published'].includes(input.mappingSource) ||
            typeof input.recoverySuspended !== 'boolean' || compareTimes(point.capturedAt, exported.capturedAt) > 0 ||
            input.sampleCapturedAt - input.capturedAt > FORWARD_TELEMETRY_LIMITS.maxPointAgeMs ||
            digest({ point, exporter: exported, mappingSource: input.mappingSource, publishedUntil: input.publishedUntil }) !== input.digest) corrupt();
        return { record: input, point, exporter: exported };
    }
    private delta(value: ValidRecord, previous: ValidRecord | undefined, sessionCurrent: boolean): Delta {
        const result: Delta = { status: 'baseline', elapsedMs: null, payloadSentBytes: null, payloadReceivedBytes: null,
            tcpAccepted: null, tcpConnected: null, tcpClosed: null, udpAssociationsCreated: null,
            udpAssociationsClosed: null, udpDatagramsSent: null, udpDatagramsReceived: null };
        const { point, exporter: sample } = value;
        if (!sessionCurrent) { result.status = 'historical'; return result; }
        if (point.availability !== 'available') { result.status = 'unavailable'; return result; }
        if (point.overflowed) { result.status = 'overflowed'; return result; }
        if (point.state === 'terminal') { result.status = 'terminal'; return result; }
        if (!previous || previous.record.recoverySuspended || instanceKey(previous) !== instanceKey(value) ||
            previous.exporter.sampleEpoch !== sample.sampleEpoch) return result;
        const old = previous.exporter, before = previous.point;
        if (before.availability !== 'available' || before.overflowed || before.state === 'terminal') { result.status = 'gap'; return result; }
        const markers = ['droppedSamples'] as const;
        const dropped = markers.some(name => BigInt(sample[name]) !== BigInt(old[name]));
        const tails = ['tailsEvicted', 'tailsExpired'] as const;
        const tailChanged = tails.some(name => BigInt(sample.coverage[name]) !== BigInt(old.coverage[name]));
        const differences = Object.fromEntries(counterNames.map(name => [name, BigInt(point.counters![name]) - BigInt(before.counters![name])])) as Record<CounterName, bigint>;
        if (sample.uptimeMs <= old.uptimeMs || sample.sequence <= old.sequence || counterNames.some(name => differences[name] < 0n) ||
            BigInt(sample.droppedSamples) < BigInt(old.droppedSamples) ||
            tails.some(name => BigInt(sample.coverage[name]) < BigInt(old.coverage[name]))) result.status = 'counter-reset';
        else if (sample.sequence !== old.sequence + 1 || dropped || tailChanged || sample.coverage.truncated || old.coverage.truncated)
            result.status = 'gap';
        else {
            result.status = 'continuous'; result.elapsedMs = sample.uptimeMs - old.uptimeMs;
            for (const name of counterNames) result[name] = differences[name].toString();
        }
        return result;
    }
    private view(value: ValidRecord, previous: ValidRecord | undefined, node: TelemetryNode | undefined,
        forward: ForwardTelemetryForward, now: number) {
        const { point, record, exporter: exported } = value;
        const visibleNode = node && node.scopeId === forward.scopeId ? node : undefined;
        const credentialWindowOpen = !!visibleNode && !visibleNode.revoked && visibleNode.credentialUntil > now;
        const currentSession = visibleNode && visibleNode.sessionEpoch > 0 && visibleNode.bootId !== null ?
            { bootId: visibleNode.bootId, sessionEpoch: visibleNode.sessionEpoch } : null;
        const sessionCurrent = this.enabled && !forward.deleting && !forward.recoverySuspended && !record.recoverySuspended &&
            credentialWindowOpen && currentSession !== null && currentSession.sessionEpoch === point.identity.sessionEpoch &&
            currentSession.bootId === point.identity.bootId;
        return { point, exporter: exported, receivedAt: nativeIsoTime(record.receivedAt),
            mapping: { source: record.mappingSource, publishedUntil: nativeIsoTime(record.publishedUntil), currentBinding: 'not-rechecked' },
            recoverySuspended: record.recoverySuspended, currentSession, nodeRevoked: !visibleNode || visibleNode.revoked,
            credentialWindowOpen, sessionCurrent,
            freshness: !sessionCurrent ? 'historical' : now >= record.receivedAt && now - record.receivedAt <= FORWARD_TELEMETRY_LIMITS.freshnessMs ? 'fresh' : 'stale',
            delta: this.delta(value, previous, sessionCurrent) };
    }
    async history(actor: string, scopeId: string, forwardId: string, input: Query = {}) {
        if (![actor, scopeId, forwardId].every(isId)) invalid('Valid telemetry Scope and Forward required');
        if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
            Object.keys(input).some(name => !['from', 'to', 'limit'].includes(name)) ||
            Object.values(input).some(value => value !== undefined && typeof value !== 'string')) invalid('Bounded forward telemetry window required');
        const now = this.now(), to = input.to === undefined ? now : queryTime(input.to),
            from = input.from === undefined ? to - 900000 : queryTime(input.from);
        const limit = input.limit === undefined ? 128 : !/\s/.test(input.limit) && /^[1-9][0-9]{0,2}$/.test(input.limit) ? Number(input.limit) : NaN;
        if (!timestamp(from) || !timestamp(to) || from >= to || to - from > 86400000 || from < now - 86400000 - 300000 ||
            to > now + 300000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 512)
            invalid('Forward telemetry query needs a last-24-hour window and at most 512 points');
        for (const [key, started] of this.readStarts) if (now >= started && now - started >= 1000) this.readStarts.delete(key);
        if (this.readStarts.has(actor) || this.readStarts.size >= 128)
            throw new ControlError('FORWARD_TELEMETRY_RATE_LIMIT', 429, 'Forward telemetry reader cooldown active', true);
        this.readStarts.set(actor, now);
        return this.admitted('read:' + actor + ':' + forwardId, () => this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scopeId);
            const forward = this.forward(await this.store.forward(tx, scopeId, forwardId), scopeId, forwardId);
            const retainedFrom = Math.max(0, now - 86400000), effectiveFrom = Math.max(from, retainedFrom);
            const records = await this.store.history(tx, scopeId, forwardId, effectiveFrom, to, limit);
            if (!Array.isArray(records) || records.length > limit + 1) corrupt();
            const seen = new Set<string>();
            const valid = records.map((row, index) => {
                const value = this.record(row, scopeId, forwardId), key = recordKey(row);
                if (row.receivedAt < effectiveFrom || row.receivedAt > to || seen.has(key) ||
                    index > 0 && recordOrder(records[index - 1]!, row) >= 0) corrupt();
                seen.add(key); return value;
            });
            const latestRecords = await this.store.latest(tx, scopeId, forwardId, retainedFrom);
            if (!Array.isArray(latestRecords) || latestRecords.length > 2) corrupt();
            const latest = latestRecords.map(row => this.record(row, scopeId, forwardId));
            if (latest.some(value => value.record.receivedAt < retainedFrom) || latest.length > 1 &&
                (recordOrder(latest[1]!.record, latest[0]!.record) >= 0 || instanceKey(latest[0]!) !== instanceKey(latest[1]!))) corrupt();
            const selected = valid.slice(0, limit), nodeIds = [...new Set([...selected, ...latest].map(value => value.record.nodeId))];
            const nodes = new Map<string, TelemetryNode>();
            for (const row of await this.store.nodes(tx, nodeIds)) {
                const node = this.node(row, row.nodeId);
                if (!nodeIds.includes(node.nodeId) || nodes.has(node.nodeId)) corrupt();
                nodes.set(node.nodeId, node);
            }
            const observedAt = this.now(), preceding = new Map<string, ValidRecord>();
            const items = selected.map(value => {
                const key = instanceKey(value), previous = preceding.get(key); preceding.set(key, value);
                return this.view(value, previous, nodes.get(value.record.nodeId), forward, observedAt);
            });
            return deepFreeze({ forwardTelemetryVersion: 1, forwardId, enabled: this.enabled, source: 'agent-reported', health: 'unknown',
                executionAuthorized: false, observedAt: nativeIsoTime(observedAt),
                forward: { revision: forward.revision, deleting: forward.deleting, recoverySuspended: forward.recoverySuspended },
                window: { from: nativeIsoTime(from), to: nativeIsoTime(to), limit, truncated: records.length > limit },
                retention: { rawSeconds: 86400, maxPointsPerNode: 4096, maxPointBytes: 4096, maxMetadataBytes: 2048, historyComplete: false },
                latest: latest[0] ? this.view(latest[0], latest[1], nodes.get(latest[0].record.nodeId), forward, observedAt) : null, items });
        }));
    }
    async prune() {
        return this.admitted('retention', () => this.db.transaction(tx => this.store.prune(tx, Math.max(0, this.now() - 86400000))));
    }
}
