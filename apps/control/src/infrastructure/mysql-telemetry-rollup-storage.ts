import { isId } from '@tunex/core';
import { digest } from '@tunex/contracts/shared';
import { telemetryUint64 } from '@tunex/contracts/observability';
import { ControlError } from '../framework/public.ts';
import type { TelemetryRollupStorageFamily as TelemetryFamily, TelemetryRollupStorageResolution as TelemetryResolution,
    TelemetryRollupStorageCounts as TelemetryRollupCounts, TelemetryRollupStorageLosses as TelemetryRollupLosses,
    TelemetryRollupStorageWindow as TelemetryRollupWindow, TelemetryRollupStoredRecord,
    TelemetryRollupObservationRecord, TelemetryRollupBucketRecord, TelemetryRollupStorageLimits,
    TelemetryRollupStorageValues, TelemetryRollupStorage } from '../framework/public.ts';
import { json, rows, write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

type Row = Record<string, unknown>;
const families = ['process', 'host', 'forward', 'probe'];
const maximumUint64 = 18446744073709551615n;
function corrupt(): never { throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid telemetry aggregate storage'); }
function capacity(): never { throw new ControlError('TELEMETRY_AGGREGATE_CAPACITY', 429, 'Telemetry aggregate Scope capacity unavailable', true); }
function integer(value: unknown, maximum = Number.MAX_SAFE_INTEGER): number {
    const n = typeof value === 'string' && /^(0|[1-9][0-9]{0,15})$(?![\s\S])/.test(value) ? Number(value) : value;
    if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0 || n > maximum) corrupt();
    return n;
}
function time(value: unknown): number { return integer(value, 253402300799999); }
function id(value: unknown): string { if (!isId(value)) corrupt(); return value; }
function hash(value: unknown): string {
    if (typeof value !== 'string' || !/^sha256:[a-f0-9]{64}$(?![\s\S])/.test(value)) corrupt();
    return value;
}
function family(value: unknown): TelemetryFamily {
    if (!families.includes(value as string)) corrupt();
    return value as TelemetryFamily;
}
function resolution(value: unknown): TelemetryResolution { if (value !== 'minute' && value !== 'hour') corrupt(); return value; }
function encoded(value: unknown, maximum: number): string {
    const raw = JSON.stringify(value);
    if (typeof raw !== 'string' || Buffer.byteLength(raw) > maximum) corrupt();
    return raw;
}
function stored(value: unknown, maximum: number): unknown {
    if (value === null || value === undefined) corrupt();
    try { const parsed = json<unknown>(value); encoded(parsed, maximum); return parsed; } catch { return corrupt(); }
}
function marker(value: unknown): string { if (!telemetryUint64(value)) corrupt(); return value; }
function bump(value: string, amount: number): string {
    return (BigInt(value) + BigInt(integer(amount)) > maximumUint64 ? maximumUint64 : BigInt(value) + BigInt(amount)).toString();
}
function loss(row?: Row): TelemetryRollupLosses {
    return row ? { minuteEvicted: marker(row.minute_evicted), hourEvicted: marker(row.hour_evicted),
        cursorEvicted: marker(row.cursor_evicted), cursorExpired: marker(row.cursor_expired) } :
        { minuteEvicted: '0', hourEvicted: '0', cursorEvicted: '0', cursorExpired: '0' };
}
function width(r: TelemetryResolution): number { return r === 'minute' ? 60000 : 3600000; }
function ttl(r: TelemetryResolution, limits:TelemetryRollupStorageLimits): number { return (r === 'minute' ? limits.minuteSeconds : limits.hourSeconds) * 1000; }
function bucketKey(r: TelemetryResolution, start: number, series: string): string { return `${r}/${start}/${series}`; }
const bucketColumns = 'scope_id,node_id,family,resolution,bucket_start,series_key,forward_id,body,digest,recovery_suspended';
function bucket<Observation extends TelemetryRollupObservationRecord,Bucket extends TelemetryRollupBucketRecord>(row: Row, values:TelemetryRollupStorageValues<Observation,Bucket>): TelemetryRollupStoredRecord<Bucket> {
    const limits=values.limits;
    let body: Bucket;
    try { body = values.bucket(stored(row.body, limits.maxBucketBytes)); } catch { return corrupt(); }
    if (body.scopeId !== id(row.scope_id) || body.nodeId !== id(row.node_id) || body.family !== family(row.family) ||
        body.resolution !== resolution(row.resolution) || body.start !== time(row.bucket_start) ||
        body.seriesKey !== hash(row.series_key) || body.forwardId !== row.forward_id || digest(body) !== hash(row.digest) ||
        row.recovery_suspended !== 0 && row.recovery_suspended !== 1) corrupt();
    return { body, recoverySuspended: row.recovery_suspended === 1 };
}
function cursor<Observation extends TelemetryRollupObservationRecord,Bucket extends TelemetryRollupBucketRecord>(row: Row, values:TelemetryRollupStorageValues<Observation,Bucket>): Observation {
    const limits=values.limits;
    let value: Observation;
    try { value = values.observation(stored(row.body, limits.maxCursorBytes)); } catch { return corrupt(); }
    if (value.scopeId !== id(row.scope_id) || value.nodeId !== id(row.node_id) || value.family !== family(row.family) ||
        value.seriesKey !== hash(row.series_key) || value.receivedAt !== time(row.last_received_at) || digest(value) !== hash(row.digest)) corrupt();
    return value;
}
async function lockScope(tx: Transaction, scopeId: string): Promise<void> {
    await write(tx, 'INSERT INTO telemetry_rollup_scope_heads(scope_id) VALUES(?) ON DUPLICATE KEY UPDATE scope_id=VALUES(scope_id)', [scopeId]);
    if ((await rows(tx, 'SELECT scope_id FROM telemetry_rollup_scope_heads WHERE scope_id=? FOR UPDATE', [scopeId])).length !== 1) corrupt();
}
async function saveLoss(tx: Transaction, nodeId: string, f: TelemetryFamily, value: TelemetryRollupLosses) {
    await write(tx, `UPDATE telemetry_rollup_heads SET minute_evicted=?,hour_evicted=?,cursor_evicted=?,cursor_expired=?
        WHERE node_id=? AND family=?`, [value.minuteEvicted, value.hourEvicted, value.cursorEvicted, value.cursorExpired, nodeId, f]);
}

/** Same accepted-raw transaction, bounded Scope serialization; no Runtime locks or private pool. */
export class MySqlTelemetryRollupStorage<Observation extends TelemetryRollupObservationRecord,Bucket extends TelemetryRollupBucketRecord> implements TelemetryRollupStorage<Transaction,Observation,Bucket> {
    private readonly values:TelemetryRollupStorageValues<Observation,Bucket>;
    constructor(values:TelemetryRollupStorageValues<Observation,Bucket>) {this.values=values;}
    async append(tx: Transaction, input: readonly Observation[]): Promise<void> {
        if (!Array.isArray(input) || input.length > 32) corrupt();
        if (!input.length) return;
        const limits=this.values.limits;
        const values = input.map(value => this.values.observation(value)), first = values[0]!;
        const { nodeId, scopeId, family: f, receivedAt: now } = first;
        const keys = values.map(value => value.seriesKey);
        if (new Set(keys).size !== keys.length || values.some(value => value.nodeId !== nodeId || value.scopeId !== scopeId ||
            value.family !== f || value.receivedAt !== now)) corrupt();
        await lockScope(tx, scopeId);
        const [head] = await rows<Row>(tx, 'SELECT * FROM telemetry_rollup_heads WHERE node_id=? AND family=?', [nodeId, f]);
        if (head && head.scope_id !== scopeId) corrupt();
        const [bc] = await rows<Row>(tx, `SELECT COUNT(CASE WHEN resolution='minute' THEN 1 END) sm,
            COUNT(CASE WHEN resolution='hour' THEN 1 END) sh,
            COUNT(CASE WHEN node_id=? AND family=? AND resolution='minute' THEN 1 END) nm,
            COUNT(CASE WHEN node_id=? AND family=? AND resolution='hour' THEN 1 END) nh
            FROM telemetry_rollup_buckets WHERE scope_id=?`, [nodeId, f, nodeId, f, scopeId]);
        const [cc] = await rows<Row>(tx, `SELECT COUNT(*) sc,COUNT(CASE WHEN node_id=? AND family=? THEN 1 END) nc
            FROM telemetry_rollup_cursors WHERE scope_id=?`, [nodeId, f, scopeId]);
        const [hc] = await rows<Row>(tx, 'SELECT COUNT(*) n FROM telemetry_rollup_heads WHERE scope_id=?', [scopeId]);
        if (!bc || !cc || !hc) corrupt();
        const sm = integer(bc.sm, limits.maxMinuteRowsPerScope), sh = integer(bc.sh, limits.maxHourRowsPerScope),
            nm = integer(bc.nm, limits.maxMinuteRowsPerNodeFamily), nh = integer(bc.nh, limits.maxHourRowsPerNodeFamily),
            sc = integer(cc.sc, limits.maxCursorRowsPerScope), nc = integer(cc.nc, limits.maxCursorRowsPerNodeFamily),
            heads = integer(hc.n, limits.maxNodeFamiliesPerScope);
        if (!head && heads >= limits.maxNodeFamiliesPerScope) capacity();
        const markers = loss(head);
        const previous = new Map<string, Observation>();
        for (const row of await rows<Row>(tx, `SELECT node_id,family,series_key,scope_id,last_received_at,body,digest
            FROM telemetry_rollup_cursors WHERE node_id=? AND family=? AND series_key IN (${keys.map(() => '?').join(',')})`, [nodeId, f, ...keys])) {
            const value = cursor(row,this.values);
            if (value.scopeId !== scopeId || !keys.includes(value.seriesKey) || previous.has(value.seriesKey)) corrupt();
            previous.set(value.seriesKey, value);
        }
        const requested = values.flatMap(value => (['minute', 'hour'] as const).map(r => ({ resolution: r,
            start: Math.floor(now / width(r)) * width(r), series: value.seriesKey })));
        const existing = new Map<string, TelemetryRollupStoredRecord<Bucket>>();
        for (const row of await rows<Row>(tx, `SELECT ${bucketColumns} FROM telemetry_rollup_buckets WHERE node_id=? AND family=?
            AND (resolution,bucket_start,series_key) IN (${requested.map(() => '(?,?,?)').join(',')})`,
            [nodeId, f, ...requested.flatMap(value => [value.resolution, value.start, value.series])])) {
            const record = bucket(row,this.values), b = record.body, k = bucketKey(b.resolution, b.start, b.seriesKey);
            if (b.scopeId !== scopeId || existing.has(k)) corrupt();
            existing.set(k, record);
        }
        const addMinute = requested.filter(value => value.resolution === 'minute' && !existing.has(bucketKey(value.resolution, value.start, value.series))).length;
        const addHour = requested.filter(value => value.resolution === 'hour' && !existing.has(bucketKey(value.resolution, value.start, value.series))).length;
        const addCursor = keys.filter(k => !previous.has(k)).length;
        const evictMinute = Math.max(0, nm + addMinute - limits.maxMinuteRowsPerNodeFamily),
            evictHour = Math.max(0, nh + addHour - limits.maxHourRowsPerNodeFamily),
            evictCursor = Math.max(0, nc + addCursor - limits.maxCursorRowsPerNodeFamily);
        if (sm + addMinute - evictMinute > limits.maxMinuteRowsPerScope || sh + addHour - evictHour > limits.maxHourRowsPerScope ||
            sc + addCursor - evictCursor > limits.maxCursorRowsPerScope) capacity();
        for (const [r, amount] of [['minute', evictMinute], ['hour', evictHour]] as const) {
            if (!amount) continue;
            if (amount > 32) corrupt();
            const selected = await rows<Row>(tx, `SELECT bucket_start,series_key FROM telemetry_rollup_buckets
                WHERE node_id=? AND family=? AND resolution=? AND NOT(bucket_start=? AND series_key IN (${keys.map(() => '?').join(',')}))
                ORDER BY bucket_start,series_key LIMIT ${amount}`, [nodeId, f, r, Math.floor(now / width(r)) * width(r), ...keys]);
            if (selected.length !== amount) corrupt();
            const removed = await write(tx, `DELETE FROM telemetry_rollup_buckets WHERE node_id=? AND family=? AND resolution=?
                AND (bucket_start,series_key) IN (${selected.map(() => '(?,?)').join(',')})`,
                [nodeId, f, r, ...selected.flatMap(row => [time(row.bucket_start), hash(row.series_key)])]);
            if (removed !== amount) corrupt();
            const lost = selected.filter(row => time(row.bucket_start) + width(r) > now - ttl(r,limits)).length;
            if (r === 'minute') markers.minuteEvicted = bump(markers.minuteEvicted, lost);
            else markers.hourEvicted = bump(markers.hourEvicted, lost);
        }
        if (evictCursor) {
            if (evictCursor > 32) corrupt();
            const selected = await rows<Row>(tx, `SELECT series_key,last_received_at FROM telemetry_rollup_cursors WHERE node_id=? AND family=?
                AND series_key NOT IN (${keys.map(() => '?').join(',')}) ORDER BY last_received_at,series_key LIMIT ${evictCursor}`, [nodeId, f, ...keys]);
            if (selected.length !== evictCursor) corrupt();
            const removed = await write(tx, `DELETE FROM telemetry_rollup_cursors WHERE node_id=? AND family=? AND series_key IN
                (${selected.map(() => '?').join(',')})`, [nodeId, f, ...selected.map(row => hash(row.series_key))]);
            if (removed !== evictCursor) corrupt();
            const expired = selected.filter(row => time(row.last_received_at) < now - limits.cursorSeconds * 1000).length;
            markers.cursorExpired = bump(markers.cursorExpired, expired);
            markers.cursorEvicted = bump(markers.cursorEvicted, removed - expired);
        }
        if (!head) await write(tx, 'INSERT INTO telemetry_rollup_heads(node_id,family,scope_id) VALUES(?,?,?)', [nodeId, f, scopeId]);
        const bucketArgs: unknown[] = [], cursorArgs: unknown[] = [];
        for (const value of values) {
            let before = previous.get(value.seriesKey) ?? null;
            if (before && before.receivedAt < now - limits.cursorSeconds * 1000) {
                before = null; markers.cursorExpired = bump(markers.cursorExpired, 1);
            }
            for (const r of ['minute', 'hour'] as const) {
                const start = Math.floor(now / width(r)) * width(r), old = existing.get(bucketKey(r, start, value.seriesKey));
                const folded = this.values.fold(old?.body ?? null, before, value, r);
                const body = encoded(folded, limits.maxBucketBytes);
                bucketArgs.push(scopeId, nodeId, f, r, start, value.seriesKey, value.forwardId, body, digest(folded));
            }
            cursorArgs.push(nodeId, f, value.seriesKey, scopeId, now, encoded(value, limits.maxCursorBytes), digest(value));
        }
        await write(tx, `INSERT INTO telemetry_rollup_buckets(${bucketColumns}) VALUES
            ${requested.map(() => '(?,?,?,?,?,?,?,?,?,FALSE)').join(',')}
            ON DUPLICATE KEY UPDATE body=VALUES(body),digest=VALUES(digest),
            recovery_suspended=telemetry_rollup_buckets.recovery_suspended OR VALUES(recovery_suspended)`, bucketArgs);
        await write(tx, `INSERT INTO telemetry_rollup_cursors(node_id,family,series_key,scope_id,last_received_at,body,digest)
            VALUES ${values.map(() => '(?,?,?,?,?,?,?)').join(',')}
            ON DUPLICATE KEY UPDATE last_received_at=VALUES(last_received_at),body=VALUES(body),digest=VALUES(digest)`, cursorArgs);
        await saveLoss(tx, nodeId, f, markers);
    }

    async history(tx: Transaction, w: TelemetryRollupWindow): Promise<TelemetryRollupStoredRecord<Bucket>[]> {
        const limits=this.values.limits;
        id(w.scopeId); family(w.family); resolution(w.resolution); id(w.targetId); time(w.from); time(w.to);
        if (w.kind !== 'node' && w.kind !== 'forward' || !Number.isSafeInteger(w.limit) || w.limit < 1 || w.limit > limits.maxQueryPoints) corrupt();
        const filters = ['scope_id=?', 'family=?', 'resolution=?', w.kind === 'node' ? 'node_id=?' : 'forward_id=?', 'bucket_start>=?', 'bucket_start<?'];
        const args: unknown[] = [w.scopeId, w.family, w.resolution, w.targetId, w.from, w.to];
        if (w.seriesKey !== null) { filters.push('series_key=?'); args.push(hash(w.seriesKey)); }
        if (w.after !== null) {
            filters.push('(bucket_start,node_id,series_key)>(?,?,?)'); args.push(time(w.after.start), id(w.after.nodeId), hash(w.after.seriesKey));
        }
        return (await rows<Row>(tx, `SELECT ${bucketColumns} FROM telemetry_rollup_buckets WHERE ${filters.join(' AND ')}
            ORDER BY bucket_start,node_id,series_key LIMIT ${w.limit + 1}`, args)).map(row=>bucket(row,this.values));
    }
    async losses(tx: Transaction, scopeId: string, f: TelemetryFamily, nodeId: string | null): Promise<TelemetryRollupLosses> {
        id(scopeId); family(f); if (nodeId !== null) id(nodeId);
        const [row] = await rows<Row>(tx, `SELECT COALESCE(SUM(CAST(minute_evicted AS DECIMAL(39,0))),0) minute_evicted,
            COALESCE(SUM(CAST(hour_evicted AS DECIMAL(39,0))),0) hour_evicted,
            COALESCE(SUM(CAST(cursor_evicted AS DECIMAL(39,0))),0) cursor_evicted,
            COALESCE(SUM(CAST(cursor_expired AS DECIMAL(39,0))),0) cursor_expired
            FROM telemetry_rollup_heads WHERE scope_id=? AND family=?${nodeId === null ? '' : ' AND node_id=?'}`,
            nodeId === null ? [scopeId, f] : [scopeId, f, nodeId]);
        if (!row) corrupt();
        const wide = (value: unknown): string => {
            const n = typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? String(value) : value;
            if (typeof n !== 'string' || !/^(0|[1-9][0-9]{0,38})$(?![\s\S])/.test(n) || BigInt(n) > (1n << 128n) - 1n) corrupt();
            return n;
        };
        return { minuteEvicted: wide(row.minute_evicted), hourEvicted: wide(row.hour_evicted),
            cursorEvicted: wide(row.cursor_evicted), cursorExpired: wide(row.cursor_expired) };
    }
    async capacity(tx: Transaction, scopeId: string): Promise<TelemetryRollupCounts> {
        id(scopeId);
        const [b] = await rows<Row>(tx, `SELECT COUNT(CASE WHEN resolution='minute' THEN 1 END) m,
            COUNT(CASE WHEN resolution='hour' THEN 1 END) h FROM telemetry_rollup_buckets WHERE scope_id=?`, [scopeId]);
        const [c] = await rows<Row>(tx, 'SELECT COUNT(*) n FROM telemetry_rollup_cursors WHERE scope_id=?', [scopeId]);
        const [h] = await rows<Row>(tx, 'SELECT COUNT(*) n FROM telemetry_rollup_heads WHERE scope_id=?', [scopeId]);
        if (!b || !c || !h) corrupt();
        // Inspection must remain available for over-budget restored/operator-modified data.
        return { minuteRows: integer(b.m), hourRows: integer(b.h), cursorRows: integer(c.n), nodeFamilies: integer(h.n) };
    }
    async prune(tx: Transaction, now: number): Promise<number> {
        time(now);
        const limits=this.values.limits;
        const minuteBefore = Math.max(0, now - limits.minuteSeconds * 1000 - 60000),
            hourBefore = Math.max(0, now - limits.hourSeconds * 1000 - 3600000), cursorBefore = Math.max(0, now - limits.cursorSeconds * 1000);
        const [candidate] = await rows<Row>(tx, `SELECT scope_id FROM (
            (SELECT scope_id,bucket_start candidate_at FROM telemetry_rollup_buckets WHERE resolution='minute' AND bucket_start<? ORDER BY bucket_start LIMIT 1)
            UNION ALL (SELECT scope_id,bucket_start candidate_at FROM telemetry_rollup_buckets WHERE resolution='hour' AND bucket_start<? ORDER BY bucket_start LIMIT 1)
            UNION ALL (SELECT scope_id,last_received_at candidate_at FROM telemetry_rollup_cursors WHERE last_received_at<? ORDER BY last_received_at LIMIT 1)
            ) eligible ORDER BY candidate_at,scope_id LIMIT 1`, [minuteBefore, hourBefore, cursorBefore]);
        if (!candidate) return 0;
        const scopeId = id(candidate.scope_id); await lockScope(tx, scopeId);
        const expired = await rows<Row>(tx, `SELECT node_id,family,series_key FROM telemetry_rollup_cursors
            WHERE scope_id=? AND last_received_at<? ORDER BY last_received_at,node_id,family,series_key LIMIT 128`, [scopeId, cursorBefore]);
        let removed = 0;
        if (expired.length) {
            removed = await write(tx, `DELETE FROM telemetry_rollup_cursors WHERE scope_id=? AND (node_id,family,series_key)
                IN (${expired.map(() => '(?,?,?)').join(',')})`, [scopeId, ...expired.flatMap(row => [id(row.node_id), family(row.family), hash(row.series_key)])]);
            if (removed !== expired.length) corrupt();
            const grouped = new Map<string, { node: string; f: TelemetryFamily; count: number }>();
            for (const row of expired) {
                const node = id(row.node_id), f = family(row.family), k = `${node}/${f}`, group = grouped.get(k);
                if (group) group.count++; else grouped.set(k, { node, f, count: 1 });
            }
            const groups = [...grouped.values()];
            await write(tx, `UPDATE telemetry_rollup_heads SET cursor_expired=LEAST(18446744073709551615,cursor_expired+
                CASE ${groups.map(() => 'WHEN node_id=? AND family=? THEN ?').join(' ')} ELSE 0 END)
                WHERE scope_id=? AND (node_id,family) IN (${groups.map(() => '(?,?)').join(',')})`,
                [...groups.flatMap(group => [group.node, group.f, group.count]), scopeId,
                    ...groups.flatMap(group => [group.node, group.f])]);
        }
        if (removed < 256) removed += await write(tx, `DELETE FROM telemetry_rollup_buckets WHERE scope_id=?
            AND ((resolution='minute' AND bucket_start<?) OR (resolution='hour' AND bucket_start<?))
            ORDER BY bucket_start,node_id,family,resolution,series_key LIMIT ${256 - removed}`, [scopeId, minuteBefore, hourBefore]);
        return removed;
    }
}
