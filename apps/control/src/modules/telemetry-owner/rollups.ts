import { deepFreeze, isId } from '@tunex/core';
import { nativeParseJson as parseJson, nativeParseTime, nativeIsoTime, nativeWallClockSource, nativeJsonBase64Url, nativeBase64UrlText } from '../../compatibility/public.ts';
import { ControlError, invalid, notFound } from '../../framework/public.ts';
import type { ScopeAuthorization, TransactionBoundary, ResourceReadAccess } from '../../framework/public.ts';
import type { TelemetryFamily, TelemetryResolution, TelemetryRollupAfter, TelemetryRollupCounts,
    TelemetryRollupBucket, TelemetryRollupRecord, TelemetryRollupStore, TelemetryRollupTargets } from './rollup-contracts.ts';
import { TELEMETRY_ROLLUP_LIMITS, parseTelemetryRollupBucket } from './rollup-values.ts';
import type { TelemetryRollupApi, TelemetryRollupQuery } from './api.ts';
export type { TelemetryRollupQuery } from './api.ts';

const timestamp = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 253402300799999;
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const hash = (v: unknown): v is string => typeof v === 'string' && v.length === 71 && /^sha256:[a-f0-9]{64}$/.test(v);
const wide = (v: unknown): v is string => typeof v === 'string' && !/\s/.test(v) && /^(0|[1-9][0-9]{0,38})$/.test(v) &&
    BigInt(v) <= 340282366920938463463374607431768211455n;
function corrupt(): never { throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid aggregate read model'); }
function closed(v: unknown, keys: readonly string[]): Record<string, unknown> {
    if (!v || typeof v !== 'object' || Array.isArray(v) || ![Object.prototype, null].includes(Object.getPrototypeOf(v)) ||
        Object.keys(v).sort().join(',') !== [...keys].sort().join(',')) corrupt();
    return v as Record<string, unknown>;
}
function queryTime(value: string): number {
    const at = nativeParseTime(value);
    if (!timestamp(at) || nativeIsoTime(at) !== value) invalid('Canonical UTC aggregate bounds required');
    return at;
}
function textOrder(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function order(a: TelemetryRollupAfter, b: TelemetryRollupAfter): number {
    return a.start - b.start || textOrder(a.nodeId, b.nodeId) || textOrder(a.seriesKey, b.seriesKey);
}
function rowKey(row: TelemetryRollupRecord): TelemetryRollupAfter {
    return { start: row.body.start, nodeId: row.body.nodeId, seriesKey: row.body.seriesKey };
}
function encodeAfter(value: TelemetryRollupAfter): string {
    return nativeJsonBase64Url(value);
}
function decodeAfter(value: string | undefined, width: number, from: number, to: number): TelemetryRollupAfter | null {
    if (value === undefined) return null;
    if (!value || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) invalid('Invalid aggregate page cursor');
    try {
        const decoded = nativeBase64UrlText(value);
        const v = closed(parseJson(decoded, 512), ['start', 'nodeId', 'seriesKey']);
        if (!timestamp(v.start) || v.start % width !== 0 || v.start < from || v.start >= to || !isId(v.nodeId) || !hash(v.seriesKey))
            invalid('Aggregate cursor is outside the selected window');
        const after = { start: v.start, nodeId: v.nodeId, seriesKey: v.seriesKey };
        if (encodeAfter(after) !== value) invalid('Canonical aggregate cursor required');
        return after;
    } catch { return invalid('Invalid aggregate page cursor'); }
}

/** Historical arithmetic is immutable observation evidence, never a current readiness gate. */
export class TelemetryRollups<Tx> implements TelemetryRollupApi {
    readonly enabled: boolean;
    private readonly db: TransactionBoundary<Tx>;
    private readonly auth: ScopeAuthorization<Tx>;
    private readonly readAccess: ResourceReadAccess<Tx>;
    private readonly store: TelemetryRollupStore<Tx>;
    private readonly targets: TelemetryRollupTargets<Tx>;
    private readonly clock: () => number;
    private active = 0;
    private requests = 0;
    private readonly keys = new Set<string>();
    private readonly readStarts = new Map<string, number>();
    constructor(db: TransactionBoundary<Tx>, auth: ScopeAuthorization<Tx>, readAccess: ResourceReadAccess<Tx>, store: TelemetryRollupStore<Tx>,
        targets: TelemetryRollupTargets<Tx>, enabled = false, clock: () => number = nativeWallClockSource()) {
        this.db = db; this.auth = auth; this.readAccess = readAccess; this.store = store; this.targets = targets; this.enabled = enabled; this.clock = clock;
    }
    private now(): number { const at = this.clock(); if (!timestamp(at)) corrupt(); return at; }
    async admitReadRequest<T>(action: () => Promise<T>): Promise<T> {
        if (this.requests >= 4) throw new ControlError('TELEMETRY_AGGREGATE_BUSY', 429, 'Aggregate request capacity unavailable', true);
        this.requests++;
        try { return await action(); } finally { this.requests--; }
    }
    private async admitted<T>(key: string, action: () => Promise<T>): Promise<T> {
        if (this.active >= 2 || this.keys.has(key)) throw new ControlError('TELEMETRY_AGGREGATE_BUSY', 429, 'Aggregate capacity unavailable', true);
        this.active++; this.keys.add(key);
        try { return await action(); } finally { this.active--; this.keys.delete(key); }
    }
    private cooldown(actor: string, now: number): void {
        for (const [key, at] of this.readStarts) if (now >= at && now - at >= 1000) this.readStarts.delete(key);
        if (this.readStarts.has(actor) || this.readStarts.size >= 128)
            throw new ControlError('TELEMETRY_AGGREGATE_RATE_LIMIT', 429, 'Aggregate reader cooldown active', true);
        this.readStarts.set(actor, now);
    }
    async history(actor: string, scopeId: string, kind: 'node' | 'forward', targetId: string, input: TelemetryRollupQuery) {
        if (![actor, scopeId, targetId].every(isId) || !['node', 'forward'].includes(kind)) invalid('Valid aggregate target required');
        if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
            Object.keys(input).some(key => !['family', 'resolution', 'from', 'to', 'limit', 'seriesKey', 'after'].includes(key)) ||
            Object.values(input).some(value => value !== undefined && typeof value !== 'string')) invalid('Closed aggregate query required');
        const families = kind === 'node' ? ['process', 'host'] : ['forward', 'probe'];
        if (!input.family || !families.includes(input.family) || !['minute', 'hour'].includes(input.resolution ?? 'minute'))
            invalid('Aggregate family and resolution do not match the target');
        const family = input.family as TelemetryFamily, resolution = (input.resolution ?? 'minute') as TelemetryResolution;
        const width = resolution === 'minute' ? 60000 : 3600000, now = this.now();
        const seconds = resolution === 'minute' ? TELEMETRY_ROLLUP_LIMITS.minuteSeconds : TELEMETRY_ROLLUP_LIMITS.hourSeconds;
        const to = input.to === undefined ? Math.floor(now / width) * width + width : queryTime(input.to);
        const from = input.from === undefined ? to - (resolution === 'minute' ? 3600000 : 604800000) : queryTime(input.from);
        const limit = input.limit === undefined ? 128 : /^[1-9][0-9]{0,2}$/.test(input.limit) && !/\s/.test(input.limit) ? Number(input.limit) : NaN;
        if (!timestamp(from) || !timestamp(to) || from % width !== 0 || to % width !== 0 || from >= to ||
            to - from > seconds * 1000 || from < Math.max(0, Math.floor((now - seconds * 1000) / width) * width) ||
            to > Math.floor(now / width) * width + width || !Number.isSafeInteger(limit) || limit < 1 || limit > 512 ||
            input.seriesKey !== undefined && !hash(input.seriesKey)) invalid('Aligned, bounded UTC aggregate window required');
        const seriesKey = input.seriesKey ?? null, after = decodeAfter(input.after, width, from, to);
        if (after && (kind === 'node' && after.nodeId !== targetId || seriesKey !== null && after.seriesKey !== seriesKey))
            invalid('Aggregate cursor differs from the selected series or Node');
        this.cooldown(actor, now);
        return this.admitted('history:' + actor, () => this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scopeId);
            const principal = await this.readAccess.principal(tx, actor, scopeId);
            if (kind === 'node') {
                await this.readAccess.node(tx, actor, scopeId, targetId, 'host');
                const target = await this.targets.node(tx, targetId);
                if (!target || target.scopeId !== scopeId) notFound();
                if (target.nodeId !== targetId) corrupt();
            } else {
                await this.readAccess.forward(tx, actor, scopeId, targetId);
                const target = await this.targets.forward(tx, scopeId, targetId);
                if (!target) notFound();
                if (target.scopeId !== scopeId || target.forwardId !== targetId) corrupt();
            }
            const rows = await this.store.history(tx, { scopeId, family, resolution, kind, targetId, from, to, limit, seriesKey, after });
            if (!Array.isArray(rows) || rows.length > limit + 1) corrupt();
            let preceding = after;
            const valid = rows.map(row => {
                closed(row, ['body', 'recoverySuspended']);
                let body: TelemetryRollupBucket;
                try { body = parseTelemetryRollupBucket(row.body); } catch { corrupt(); }
                const key = rowKey({ body, recoverySuspended: row.recoverySuspended });
                if (typeof row.recoverySuspended !== 'boolean' || body.scopeId !== scopeId || body.family !== family ||
                    body.resolution !== resolution || body.start < from || body.start >= to ||
                    (kind === 'node' ? body.nodeId !== targetId : body.forwardId !== targetId) ||
                    seriesKey !== null && body.seriesKey !== seriesKey || preceding && order(preceding, key) >= 0) corrupt();
                preceding = key;
                return { body, recoverySuspended: row.recoverySuspended };
            });
            const lossesVisible = kind === 'node' || principal.governance;
            const losses = lossesVisible ? { scope: kind === 'node' ? 'node-family' as const : 'scope-family' as const,
                ...this.losses(await this.store.losses(tx, scopeId, family, kind === 'node' ? targetId : null)) } :
                { scope: 'withheld-scope-family' as const, minuteEvicted: null, hourEvicted: null, cursorEvicted: null, cursorExpired: null };
            const items = valid.slice(0, limit), truncated = valid.length > limit;
            return deepFreeze({ telemetryAggregateVersion: 1, target: { kind, id: targetId }, family, enabled: this.enabled,
                source: 'agent-reported', health: 'unknown', executionAuthorized: false, observedAt: nativeIsoTime(this.now()),
                window: { from: nativeIsoTime(from), to: nativeIsoTime(to), resolution, limit, seriesKey,
                    after: input.after ?? null, nextAfter: truncated && items.length ? encodeAfter(rowKey(items[items.length - 1]!)) : null, truncated },
                retention: TELEMETRY_ROLLUP_LIMITS, losses, items });
        }));
    }
    private losses(input: unknown) {
        const v = closed(input, ['minuteEvicted', 'hourEvicted', 'cursorEvicted', 'cursorExpired']);
        if (!Object.values(v).every(wide)) corrupt();
        return v as unknown as { minuteEvicted: string; hourEvicted: string; cursorEvicted: string; cursorExpired: string };
    }
    private counts(input: TelemetryRollupCounts): TelemetryRollupCounts {
        const v = closed(input, ['minuteRows', 'hourRows', 'cursorRows', 'nodeFamilies']);
        if (!Object.values(v).every(integer)) corrupt();
        return input;
    }
    async capacity(actor: string, scopeId: string) {
        if (![actor, scopeId].every(isId)) invalid('Valid telemetry Scope required');
        this.cooldown(actor, this.now());
        return this.admitted('capacity:' + actor, () => this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scopeId);
            if (!(await this.readAccess.principal(tx, actor, scopeId)).governance) notFound();
            const observed = this.counts(await this.store.capacity(tx, scopeId)), limits = TELEMETRY_ROLLUP_LIMITS;
            return deepFreeze({ telemetryAggregateVersion: 1, enabled: this.enabled, source: 'observation-read-model', executionAuthorized: false,
                observedAt: nativeIsoTime(this.now()), policy: limits, observed,
                logicalBudget: {
                    maxBucketJsonBytesPerNode: (BigInt(limits.maxMinuteRowsPerNodeFamily + limits.maxHourRowsPerNodeFamily) * 4n * BigInt(limits.maxBucketBytes)).toString(),
                    maxCursorJsonBytesPerNode: (BigInt(limits.maxCursorRowsPerNodeFamily) * 4n * BigInt(limits.maxCursorBytes)).toString(),
                    maxBucketJsonBytesPerScope: (BigInt(limits.maxMinuteRowsPerScope + limits.maxHourRowsPerScope) * BigInt(limits.maxBucketBytes)).toString(),
                    maxCursorJsonBytesPerScope: (BigInt(limits.maxCursorRowsPerScope) * BigInt(limits.maxCursorBytes)).toString(),
                    rawMaxJsonBytesPerNode: (2n * 8640n * 8192n + 2n * 4096n * 6144n).toString(),
                    scopeRawHardCap: false, physicalBytesMeasured: false,
                } });
        }));
    }
    async prune() {
        return this.admitted('retention', () => this.db.transaction(tx => this.store.prune(tx, this.now())));
    }
}
