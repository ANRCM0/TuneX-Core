import type { ForwardSpec } from '@tunex/core';
import type { ConsolePaging } from '../application/console-query.ts';
import type { TunnelReadPort, TunnelReference } from '../application/tunnel-queries.ts';
import { consolePageSql } from './mysql-console-read.ts';
import { json, rows } from './mysql.ts';
import type { Transaction } from './mysql.ts';

/** SELECT-only projection using the application-supplied authorized transaction. */
export class MySqlTunnelReader implements TunnelReadPort<Transaction> {
    async node(tx: Transaction, scope: string, node: string) {
        const [record] = await rows<{ id: string; revoked: number; credential_until: number | null; capabilities: unknown;
            session_epoch: number | null; snapshot_generation: number | null; received_at: number | null }>(tx,
            `SELECT n.id,n.revoked,n.credential_until,n.facts->'$.capabilities' capabilities,r.session_epoch,r.snapshot_generation,r.received_at
             FROM nodes n LEFT JOIN runtime_nodes r ON r.node_id=n.id WHERE n.id=? AND n.scope_id=?`, [node, scope]);
        return record ? { nodeId: record.id, revoked: Boolean(record.revoked), credentialUntil: record.credential_until,
            capabilities: record.capabilities === null ? [] : json<unknown>(record.capabilities), sessionEpoch: record.session_epoch ?? 0,
            snapshotGeneration: record.snapshot_generation ?? 0, lastReportAt: record.received_at } : null;
    }
    async endpoint(tx: Transaction, node: string) {
        const [record] = await rows<{ revision: number; config: unknown }>(tx, 'SELECT revision,config FROM node_relay_endpoints WHERE node_id=?', [node]);
        return record ? { revision: record.revision, config: json(record.config) } : null;
    }
    async peers(tx: Transaction, node: string, now: number) {
        const [count] = await rows<{ total: number; window_count: number }>(tx,
            'SELECT COUNT(*) total,COALESCE(SUM(revoked=FALSE AND valid_until>? AND (retire_after IS NULL OR retire_after>?)),0) window_count FROM node_relay_credentials WHERE node_id=?', [now, now, node]);
        const records = await rows<{ fingerprint: string; issued_at: number; valid_until: number; retire_after: number | null; revoked: number }>(tx,
            `SELECT fingerprint,issued_at,valid_until,retire_after,revoked FROM node_relay_credentials WHERE node_id=?
             ORDER BY (revoked=FALSE AND valid_until>? AND (retire_after IS NULL OR retire_after>?)) DESC,issued_at DESC,fingerprint DESC LIMIT 4`, [node, now, now]);
        return { total: Number(count?.total ?? 0), windowCount: Number(count?.window_count ?? 0), items: records.map(record => ({
            fingerprint: record.fingerprint, issuedAt: record.issued_at, validUntil: record.valid_until, retireAfter: record.retire_after, revoked: Boolean(record.revoked) })) };
    }
    async references(tx: Transaction, scope: string, node: string, paging: ConsolePaging) {
        const where = `scope_id=? AND deleting=FALSE AND spec->'$.path.via' IS NOT NULL AND
            (CAST(JSON_UNQUOTE(spec->'$.ingress.nodeId') AS BINARY)=CAST(? AS BINARY) OR JSON_CONTAINS(spec->'$.path.via',JSON_QUOTE(?)))`;
        const args = [scope, node, node];
        const [count] = await rows<{ n: number }>(tx, `SELECT COUNT(*) n FROM forwards WHERE ${where}`, args);
        const records = await rows<{ id: string; revision: number; spec: unknown; recovery_suspended: number }>(tx,
            `SELECT id,revision,spec,recovery_suspended FROM forwards WHERE ${where} ORDER BY id ${consolePageSql(paging)}`, args);
        const items: TunnelReference[] = records.map(record => ({ forwardId: record.id, revision: record.revision,
            spec: json<ForwardSpec>(record.spec), recoverySuspended: Boolean(record.recovery_suspended) }));
        return { total: Number(count?.n ?? 0), items };
    }
}
