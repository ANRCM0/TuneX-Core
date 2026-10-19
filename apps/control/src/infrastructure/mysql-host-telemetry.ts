import { isId, isCounter } from '@tunex/core';
import { telemetryUint64 } from '@tunex/contracts/observability';
import type { HostTelemetrySample } from '@tunex/contracts/observability';
import { ControlError } from '../framework/public.ts';
import type { TelemetryStoredHead as TelemetryHead, TelemetryStoredNode as TelemetryNode,
    TelemetryStoredPoint as TelemetryPoint, TelemetryStorage } from '../framework/public.ts';
import { json, rows, write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

function corrupt(): never { throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid host telemetry read model'); }
function integer(value: unknown, zero = true): number {
    const number = typeof value === 'string' && /^(0|[1-9][0-9]{0,15})$/.test(value) ? Number(value) : value;
    if (!isCounter(number, zero)) corrupt();
    return number;
}
function boolean(value: unknown): boolean {
    if (value !== 0 && value !== 1) corrupt();
    return value === 1;
}
function id(value: unknown): string { if (!isId(value)) corrupt(); return value; }
function string(value: unknown): string { if (typeof value !== 'string') corrupt(); return value; }
type RecordRow = Record<string, unknown>;
function point(row: RecordRow): TelemetryPoint {
    return { nodeId: id(row.node_id), scopeId: id(row.scope_id), sessionEpoch: integer(row.session_epoch, false),
        bootId: id(row.boot_id), sampleEpoch: string(row.sample_epoch), sequence: integer(row.sequence, false),
        capturedAt: integer(row.captured_at), receivedAt: integer(row.received_at), uptimeMs: integer(row.uptime_ms),
        body: json(row.body), digest: string(row.digest), recoverySuspended: boolean(row.recovery_suspended) };
}
const pointColumns = 'node_id,scope_id,session_epoch,boot_id,sample_epoch,sequence,captured_at,received_at,uptime_ms,body,digest,recovery_suspended';

export class MySqlHostTelemetryStore implements TelemetryStorage<Transaction,HostTelemetrySample> {
    async node(tx: Transaction, nodeId: string): Promise<TelemetryNode | null> {
        const [record] = await rows<RecordRow>(tx, `SELECT n.id,n.scope_id,n.revoked,n.credential_until,r.session_epoch,r.boot_id
            FROM nodes n LEFT JOIN runtime_nodes r ON r.node_id=n.id WHERE n.id=?`, [nodeId]);
        if (!record) return null;
        return { nodeId: id(record.id), scopeId: id(record.scope_id), revoked: boolean(record.revoked),
            credentialUntil: record.credential_until === null ? 0 : integer(record.credential_until),
            sessionEpoch: record.session_epoch === null ? 0 : integer(record.session_epoch),
            bootId: record.boot_id === null ? null : id(record.boot_id) };
    }
    async lockHead(tx: Transaction, scopeId: string, sample: HostTelemetrySample): Promise<TelemetryHead> {
        await write(tx, `INSERT INTO host_telemetry_heads(node_id,scope_id,session_epoch,boot_id,sample_epoch)
            VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE node_id=VALUES(node_id)`,
            [sample.nodeId, scopeId, sample.sessionEpoch, sample.bootId, sample.sampleEpoch]);
        const [row] = await rows<RecordRow>(tx, 'SELECT * FROM host_telemetry_heads WHERE node_id=? FOR UPDATE', [sample.nodeId]);
        if (!row || !telemetryUint64(row.dropped_samples)) corrupt();
        return { nodeId: id(row.node_id), scopeId: id(row.scope_id), sessionEpoch: integer(row.session_epoch, false),
            bootId: id(row.boot_id), sampleEpoch: string(row.sample_epoch), lastSequence: integer(row.last_sequence),
            lastUptimeMs: integer(row.last_uptime_ms), lastDigest: row.last_digest === null ? null : string(row.last_digest),
            lastReceivedAt: integer(row.last_received_at), lastCapturedAt: integer(row.last_captured_at), droppedSamples: row.dropped_samples };
    }
    async append(tx: Transaction, scopeId: string, sample: HostTelemetrySample, hash: string, receivedAt: number) {
        await write(tx, 'DELETE FROM host_telemetry_points WHERE node_id=? AND received_at<? ORDER BY received_at LIMIT 256', [sample.nodeId, receivedAt - 86400000]);
        const [count] = await rows<{ total: unknown }>(tx, 'SELECT COUNT(*) total FROM host_telemetry_points WHERE node_id=?', [sample.nodeId]);
        const total = integer(count?.total);
        if (total > 8640) corrupt();
        if (total === 8640) await write(tx, 'DELETE FROM host_telemetry_points WHERE node_id=? ORDER BY received_at,sample_epoch,sequence LIMIT 1', [sample.nodeId]);
        await write(tx, `INSERT INTO host_telemetry_points(node_id,scope_id,session_epoch,boot_id,sample_epoch,sequence,
            captured_at,received_at,uptime_ms,body,digest) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
            [sample.nodeId, scopeId, sample.sessionEpoch, sample.bootId, sample.sampleEpoch, sample.sequence,
                Date.parse(sample.capturedAt), receivedAt, sample.uptimeMs, JSON.stringify(sample), hash]);
        await write(tx, `UPDATE host_telemetry_heads SET scope_id=?,session_epoch=?,boot_id=?,sample_epoch=?,last_sequence=?,
            last_uptime_ms=?,last_digest=?,last_received_at=?,last_captured_at=?,dropped_samples=? WHERE node_id=?`,
            [scopeId, sample.sessionEpoch, sample.bootId, sample.sampleEpoch, sample.sequence, sample.uptimeMs,
                hash, receivedAt, Date.parse(sample.capturedAt), sample.droppedSamples, sample.nodeId]);
    }
    async history(tx: Transaction, scopeId: string, nodeId: string, from: number, to: number, limit: number): Promise<TelemetryPoint[]> {
        if (!Number.isSafeInteger(limit) || limit < 1 || limit > 512) corrupt();
        // Only the checked limit is interpolated; identities and time bounds remain bound values.
        return (await rows<RecordRow>(tx, `SELECT ${pointColumns} FROM host_telemetry_points WHERE node_id=? AND scope_id=?
            AND received_at>=? AND received_at<=? ORDER BY received_at,sample_epoch,sequence LIMIT ${limit + 1}`,
            [nodeId, scopeId, from, to])).map(point);
    }
    async latest(tx: Transaction, scopeId: string, nodeId: string, from: number): Promise<TelemetryPoint[]> {
        return (await rows<RecordRow>(tx, `SELECT ${pointColumns} FROM host_telemetry_points WHERE node_id=? AND scope_id=?
            AND received_at>=? ORDER BY received_at DESC,sample_epoch DESC,sequence DESC LIMIT 2`, [nodeId, scopeId, from])).map(point);
    }
    async prune(tx: Transaction, before: number): Promise<number> {
        // The global retention index makes each cleanup transaction a bounded oldest-page delete.
        return write(tx, 'DELETE FROM host_telemetry_points WHERE received_at<? ORDER BY received_at LIMIT 256', [before]);
    }
}
