import { isCounter, isId } from '@tunex/core';
import { digest } from '@tunex/contracts/shared';
import { telemetryUint64 } from '@tunex/contracts/observability';
import type { ProbeTelemetryPoint, ProbeTelemetrySample } from '@tunex/contracts/observability';
import { ControlError } from '../framework/public.ts';
import type { TelemetryStoredMappedHead as ProbeTelemetryHead, TelemetryStoredForward as ProbeTelemetryForward,
    TelemetryStoredNode as TelemetryNode, TelemetryAcceptedPoint, TelemetryProbeMapping,
    TelemetryProbeRecord as ProbeTelemetryRecord, TelemetryMappedStorage } from '../framework/public.ts';
import { MySqlTelemetryStore } from './mysql-telemetry.ts';
import { json, rows, write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

type ProbeTelemetryAccepted=TelemetryAcceptedPoint<ProbeTelemetryPoint,TelemetryProbeMapping<ProbeTelemetryPoint['identity']>>;
type ProbeTelemetryExport=Pick<ProbeTelemetrySample,
    'sampleEpoch'|'sequence'|'capturedAt'|'uptimeMs'|'droppedSamples'|'coverage'>;

const retentionMs = 86400000, nodePointLimit = 4096, batchPointLimit = 32;
type RecordRow = Record<string, unknown>;
function corrupt(): never { throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid Probe telemetry read model'); }
function integer(value: unknown, zero = true, maximum = Number.MAX_SAFE_INTEGER): number {
    const number = typeof value === 'string' && /^(0|[1-9][0-9]{0,15})$(?![\s\S])/.test(value) ? Number(value) : value;
    if (!isCounter(number, zero) || number > maximum) corrupt();
    return number;
}
function timestamp(value: unknown): number { return integer(value, true, 8640000000000000); }
function boolean(value: unknown): boolean {
    if (value !== 0 && value !== 1) corrupt();
    return value === 1;
}
function id(value: unknown): string { if (!isId(value)) corrupt(); return value; }
function epoch(value: unknown): string {
    if (typeof value !== 'string' || !/^[a-f0-9]{32}$(?![\s\S])/.test(value)) corrupt();
    return value;
}
function hash(value: unknown): string {
    if (typeof value !== 'string' || !/^sha256:[a-f0-9]{64}$(?![\s\S])/.test(value)) corrupt();
    return value;
}
function mappingSource(value: unknown): ProbeTelemetryRecord['mappingSource'] {
    if (value !== 'published-snapshot') corrupt();
    return value;
}
function instanceRecord(source: unknown, until: unknown): Pick<ProbeTelemetryRecord, 'probeInstance' | 'instanceUntil'> {
    if (source === 'not-rechecked' && until === null) return { probeInstance: source, instanceUntil: null };
    if (source === 'current-registered' && until !== null)
        return { probeInstance: source, instanceUntil: timestamp(until) };
    return corrupt();
}
function encoded(value: unknown, maximum: number): string {
    const body = JSON.stringify(value);
    if (typeof body !== 'string' || Buffer.byteLength(body, 'utf8') > maximum) corrupt();
    return body;
}
function storedJson(value: unknown, maximum: number): unknown {
    try {
        const body = json<unknown>(value);
        encoded(body, maximum);
        return body;
    } catch { return corrupt(); }
}
function point(row: RecordRow): ProbeTelemetryRecord {
    return {
        nodeId: id(row.node_id), scopeId: id(row.scope_id), forwardId: id(row.forward_id),
        sessionEpoch: integer(row.session_epoch, false), bootId: id(row.boot_id), sampleEpoch: epoch(row.sample_epoch),
        sequence: integer(row.sequence, false), itemIndex: integer(row.item_index, true, batchPointLimit - 1),
        receivedAt: timestamp(row.received_at), capturedAt: timestamp(row.captured_at),
        sampleCapturedAt: timestamp(row.sample_captured_at), uptimeMs: integer(row.uptime_ms),
        identityDigest: hash(row.identity_digest), counterEpoch: row.counter_epoch === null ? null : epoch(row.counter_epoch),
        point: storedJson(row.body, 4096), exporter: storedJson(row.exporter, 2048), digest: hash(row.digest),
        mappingSource: mappingSource(row.mapping_source), publishedUntil: timestamp(row.published_until),
        ...instanceRecord(row.probe_instance, row.instance_until),
        recoverySuspended: boolean(row.recovery_suspended),
    };
}
const pointColumns = 'node_id,scope_id,forward_id,session_epoch,boot_id,sample_epoch,sequence,item_index,received_at,captured_at,sample_captured_at,uptime_ms,identity_digest,counter_epoch,body,exporter,digest,mapping_source,published_until,probe_instance,instance_until,recovery_suspended';

/** Uses the shared bounded observation transaction pool; no Runtime connection or private pool. */
export class MySqlProbeTelemetryStore implements TelemetryMappedStorage<Transaction,ProbeTelemetrySample,ProbeTelemetryAccepted,ProbeTelemetryRecord> {
    private readonly nodeStore = new MySqlTelemetryStore();
    node(tx: Transaction, nodeId: string): Promise<TelemetryNode | null> { return this.nodeStore.node(tx, nodeId); }
    async nodes(tx: Transaction, nodeIds: readonly string[]): Promise<TelemetryNode[]> {
        if (!Array.isArray(nodeIds) || nodeIds.length > 514) corrupt();
        const requested = [...new Set(nodeIds.map(id))];
        if (!requested.length) return [];
        const records = await rows<RecordRow>(tx, `SELECT n.id,n.scope_id,n.revoked,n.credential_until,r.session_epoch,r.boot_id
            FROM nodes n LEFT JOIN runtime_nodes r ON r.node_id=n.id WHERE n.id IN (${requested.map(() => '?').join(',')})`, requested);
        const returned = new Set<string>();
        return records.map(row => {
            const nodeId = id(row.id);
            if (!requested.includes(nodeId) || returned.has(nodeId)) corrupt();
            returned.add(nodeId);
            return { nodeId, scopeId: id(row.scope_id), revoked: boolean(row.revoked),
                credentialUntil: row.credential_until === null ? 0 : timestamp(row.credential_until),
                sessionEpoch: row.session_epoch === null ? 0 : integer(row.session_epoch),
                bootId: row.boot_id === null ? null : id(row.boot_id) };
        });
    }
    async forward(tx: Transaction, scopeId: string, forwardId: string): Promise<ProbeTelemetryForward | null> {
        const [row] = await rows<RecordRow>(tx, `SELECT id,scope_id,revision,deleting,recovery_suspended
            FROM forwards WHERE scope_id=? AND id=?`, [scopeId, forwardId]);
        if (!row) return null;
        return { forwardId: id(row.id), scopeId: id(row.scope_id), revision: integer(row.revision, false),
            deleting: boolean(row.deleting), recoverySuspended: boolean(row.recovery_suspended) };
    }
    async lockHead(tx: Transaction, scopeId: string, sample: ProbeTelemetrySample): Promise<ProbeTelemetryHead> {
        await write(tx, `INSERT INTO probe_telemetry_heads(node_id,scope_id,session_epoch,boot_id,sample_epoch)
            VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE node_id=VALUES(node_id)`,
            [sample.nodeId, scopeId, sample.sessionEpoch, sample.bootId, sample.sampleEpoch]);
        const [row] = await rows<RecordRow>(tx, 'SELECT * FROM probe_telemetry_heads WHERE node_id=? FOR UPDATE', [sample.nodeId]);
        if (!row || !telemetryUint64(row.dropped_samples)) corrupt();
        const acceptedPoints = integer(row.accepted_points, true, batchPointLimit);
        const rejectedPoints = integer(row.rejected_points, true, batchPointLimit);
        if (acceptedPoints + rejectedPoints > batchPointLimit) corrupt();
        return { nodeId: id(row.node_id), scopeId: id(row.scope_id), sessionEpoch: integer(row.session_epoch, false),
            bootId: id(row.boot_id), sampleEpoch: epoch(row.sample_epoch), lastSequence: integer(row.last_sequence),
            lastUptimeMs: integer(row.last_uptime_ms), lastDigest: row.last_digest === null ? null : hash(row.last_digest),
            lastReceivedAt: timestamp(row.last_received_at), lastCapturedAt: timestamp(row.last_captured_at),
            droppedSamples: row.dropped_samples, acceptedPoints, rejectedPoints };
    }
    async append(tx: Transaction, scopeId: string, sample: ProbeTelemetrySample,
        accepted: readonly ProbeTelemetryAccepted[], sampleHash: string, receivedAt: number): Promise<void> {
        id(scopeId); id(sample.nodeId); id(sample.bootId); epoch(sample.sampleEpoch); hash(sampleHash); timestamp(receivedAt);
        integer(sample.sessionEpoch, false); integer(sample.sequence, false); integer(sample.uptimeMs);
        if (!telemetryUint64(sample.droppedSamples)) corrupt();
        if (sample.items.length > batchPointLimit || accepted.length > sample.items.length) corrupt();
        const sampleCapturedAt = timestamp(Date.parse(sample.capturedAt));
        const exporter: ProbeTelemetryExport = { sampleEpoch: sample.sampleEpoch, sequence: sample.sequence,
            capturedAt: sample.capturedAt, uptimeMs: sample.uptimeMs,
            droppedSamples: sample.droppedSamples, coverage: sample.coverage };
        const exporterBody = encoded(exporter, 2048), indices = new Set<number>();
        const args: unknown[] = [];
        for (const entry of accepted) {
            const index = integer(entry.index, true, batchPointLimit - 1), item = entry.point, mapping = entry.mapping;
            if (index >= sample.items.length || indices.has(index) || digest(item) !== digest(sample.items[index]) ||
                mapping.scopeId !== scopeId || mapping.forwardRecoverySuspended !== false ||
                digest(mapping.identity) !== digest(item.identity) || item.identity.binding.nodeId !== sample.nodeId ||
                item.identity.binding.bootId !== sample.bootId || item.identity.binding.sessionEpoch !== sample.sessionEpoch) corrupt();
            indices.add(index);
            const source = mappingSource(mapping.source), publishedUntil = timestamp(mapping.publishedUntil);
            const { probeInstance, instanceUntil } = instanceRecord(mapping.probeInstance, mapping.instanceUntil);
            const identityDigest = digest(item.identity), counterEpoch = item.counterEpoch === null ? null : epoch(item.counterEpoch);
            const itemBody = encoded(item, 4096), capturedAt = timestamp(Date.parse(item.capturedAt));
            args.push(sample.nodeId, scopeId, id(mapping.identity.binding.forwardId), sample.sessionEpoch, sample.bootId,
                sample.sampleEpoch, sample.sequence, index, receivedAt, capturedAt, sampleCapturedAt, sample.uptimeMs,
                identityDigest, counterEpoch, itemBody, exporterBody,
                digest({ point: item, exporter, mappingSource: source, publishedUntil, probeInstance, instanceUntil }),
                source, publishedUntil, probeInstance, instanceUntil);
        }
        // The caller holds this Node's head lock across quota maintenance, inserts and checkpoint update.
        await write(tx, `DELETE FROM probe_telemetry_points WHERE node_id=? AND received_at<?
            ORDER BY received_at,sample_epoch,sequence,item_index LIMIT 256`, [sample.nodeId, receivedAt - retentionMs]);
        const [count] = await rows<{ total: unknown }>(tx, 'SELECT COUNT(*) total FROM probe_telemetry_points WHERE node_id=?', [sample.nodeId]);
        const total = integer(count?.total, true, nodePointLimit), overflow = total + accepted.length - nodePointLimit;
        if (overflow > 0) {
            if (!Number.isSafeInteger(overflow) || overflow > batchPointLimit) corrupt();
            // Only a bounded, validated integer is interpolated; mysql2 prepared LIMIT parameters are avoided.
            await write(tx, `DELETE FROM probe_telemetry_points WHERE node_id=?
                ORDER BY received_at,sample_epoch,sequence,item_index LIMIT ${overflow}`, [sample.nodeId]);
        }
        if (accepted.length) {
            const placeholders = accepted.map(() => `(${Array(21).fill('?').join(',')},FALSE)`).join(',');
            await write(tx, `INSERT INTO probe_telemetry_points(${pointColumns}) VALUES ${placeholders}`, args);
        }
        await write(tx, `UPDATE probe_telemetry_heads SET scope_id=?,session_epoch=?,boot_id=?,sample_epoch=?,last_sequence=?,
            last_uptime_ms=?,last_digest=?,last_received_at=?,last_captured_at=?,dropped_samples=?,accepted_points=?,rejected_points=? WHERE node_id=?`,
            [scopeId, sample.sessionEpoch, sample.bootId, sample.sampleEpoch, sample.sequence, sample.uptimeMs,
                sampleHash, receivedAt, sampleCapturedAt, sample.droppedSamples, accepted.length, sample.items.length - accepted.length, sample.nodeId]);
    }
    async history(tx: Transaction, scopeId: string, forwardId: string, from: number, to: number, limit: number): Promise<ProbeTelemetryRecord[]> {
        if (!Number.isSafeInteger(limit) || limit < 1 || limit > 512) corrupt();
        timestamp(from); timestamp(to); id(scopeId); id(forwardId);
        return (await rows<RecordRow>(tx, `SELECT ${pointColumns} FROM probe_telemetry_points
            WHERE scope_id=? AND forward_id=? AND received_at>=? AND received_at<=?
            ORDER BY received_at,node_id,sample_epoch,sequence,item_index LIMIT ${limit + 1}`,
            [scopeId, forwardId, from, to])).map(point);
    }
    async latest(tx: Transaction, scopeId: string, forwardId: string, from: number): Promise<ProbeTelemetryRecord[]> {
        timestamp(from); id(scopeId); id(forwardId);
        const [newest] = await rows<RecordRow>(tx, `SELECT ${pointColumns} FROM probe_telemetry_points
            WHERE scope_id=? AND forward_id=? AND received_at>=?
            ORDER BY received_at DESC,node_id DESC,sample_epoch DESC,sequence DESC,item_index DESC LIMIT 1`, [scopeId, forwardId, from]);
        if (!newest) return [];
        const current = point(newest);
        const [prior] = await rows<RecordRow>(tx, `SELECT ${pointColumns} FROM probe_telemetry_points
            WHERE scope_id=? AND forward_id=? AND received_at>=? AND identity_digest=? AND counter_epoch<=>?
            AND NOT(node_id=? AND sample_epoch=? AND sequence=? AND item_index=?)
            AND (received_at,node_id,sample_epoch,sequence,item_index)<(?,?,?,?,?)
            ORDER BY received_at DESC,node_id DESC,sample_epoch DESC,sequence DESC,item_index DESC LIMIT 1`,
            [scopeId, forwardId, from, current.identityDigest, current.counterEpoch,
                current.nodeId, current.sampleEpoch, current.sequence, current.itemIndex,
                current.receivedAt, current.nodeId, current.sampleEpoch, current.sequence, current.itemIndex]);
        return prior ? [current, point(prior)] : [current];
    }
    prune(tx: Transaction, before: number): Promise<number> {
        timestamp(before);
        return write(tx, 'DELETE FROM probe_telemetry_points WHERE received_at<? ORDER BY received_at LIMIT 256', [before]);
    }
}
