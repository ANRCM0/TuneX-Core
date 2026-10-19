import { isId } from '@tunex/core';
import { invalid } from '../framework/public.ts';
import type { StationFactTarget, StationFactRecord, StationOperationFactRecord, StationReportFactRecord,
    StationFactValues, StationFactsStorage } from '../framework/public.ts';
import { rows } from './mysql.ts';
import type { Transaction } from './mysql.ts';
import { corrupt, counter, flag, id, text, nullableCounter, nullableId } from './station-alert-storage-native.ts';
import type { Row } from './station-alert-storage-native.ts';

// Every JSON path is a fixed projection literal, never a caller-supplied path.
const field = (body: string, path: string) => `JSON_EXTRACT(${body},'${path}')`;
const scalar = (body: string, path: string, size = 128) => `CASE WHEN JSON_TYPE(${field(body,path)})='STRING' AND CHAR_LENGTH(JSON_UNQUOTE(${field(body,path)}))<=${size} THEN JSON_UNQUOTE(${field(body,path)}) ELSE NULL END`;
const uint = (body: string, path: string) => `CASE WHEN JSON_TYPE(${field(body,path)})='INTEGER' THEN JSON_UNQUOTE(${field(body,path)}) ELSE NULL END`;
const bool = (body: string, path: string) => `CASE WHEN JSON_TYPE(${field(body,path)})='BOOLEAN' THEN JSON_UNQUOTE(${field(body,path)}) ELSE NULL END`;
function instant(value: unknown): number {
    const raw = text(value,40), at = Date.parse(raw);
    if (!Number.isSafeInteger(at) || at < 0 || new Date(at).toISOString() !== raw) corrupt();
    return at;
}
/** Passive original-owner facts only; no Runtime object, resource lock or full JSON payload. */
export class MySqlStationAlertFactStore implements StationFactsStorage<Transaction> {
    private readonly values:StationFactValues;
    constructor(values:StationFactValues) {this.values=values;}
    async read(tx: Transaction, scope: string, config: StationFactTarget): Promise<StationFactRecord | null> {
        if (!isId(scope) || !isId(config.target.id)) invalid('Exact station alert target required');
        if (config.target.kind === 'forward') return this.forward(tx,scope,config.target.id);
        return this.node(tx,scope,config.target.id);
    }
    private async forward(tx: Transaction, scope: string, target: string): Promise<StationFactRecord | null> {
        const [r] = await rows<Row>(tx,`SELECT f.id,f.revision,${bool('f.spec','$.enabled')} enabled,f.deleting,f.recovery_suspended,
            o.id operation_id,o.target_revision,o.kind,o.status,o.source_operation_id,o.created_at,o.updated_at,o.recovery_invalidated,
            (o.last_error IS NOT NULL) has_error,${scalar('o.last_error','$.code',64)} error_code
            FROM forwards f LEFT JOIN operations o ON o.id=(SELECT picked.id FROM operations picked
                WHERE picked.scope_id=f.scope_id AND picked.forward_id=f.id AND picked.target_revision=f.revision ORDER BY picked.created_at DESC,picked.id DESC LIMIT 1)
            WHERE f.scope_id=? AND f.id=?`,[scope,target]);
        if (!r) return null;
        if (r.enabled !== 'true' && r.enabled !== 'false') corrupt();
        let operation: StationOperationFactRecord | null = null;
        if (r.operation_id !== null) {
            const status = text(r.status), kind = text(r.kind);
            if (!['accepted','running','succeeded','failed','superseded'].includes(status) ||
                !['create','update','enable','disable','delete','retry','policy','revoke'].includes(kind)) corrupt();
            operation = { kind: 'operation', targetId: id(r.id), forwardRevision: counter(r.revision,true), operationId: id(r.operation_id),
                targetRevision: counter(r.target_revision,true), operationKind: kind, status: status as StationOperationFactRecord['status'],
                sourceOperationId: nullableId(r.source_operation_id), createdAt: counter(r.created_at), updatedAt: counter(r.updated_at),
                errorCode: this.values.errorCode(r.error_code === null && flag(r.has_error) ? 'OTHER_ERROR' : r.error_code), recoveryInvalidated: flag(r.recovery_invalidated) };
        }
        return { kind: 'forward', id: id(r.id), revision: counter(r.revision,true), enabled: r.enabled === 'true', deleting: flag(r.deleting),
            recoverySuspended: flag(r.recovery_suspended), operation };
    }
    private async node(tx: Transaction, scope: string, target: string): Promise<StationFactRecord | null> {
        const [r] = await rows<Row>(tx,`SELECT n.id,n.revoked,n.credential_until,r.boot_id,r.session_epoch,r.snapshot_generation,r.last_report_sequence,r.received_at,
            (r.last_report IS NOT NULL) has_report,(s.body IS NOT NULL) has_snapshot,s.valid_until snapshot_until,
            (OCTET_LENGTH(r.last_report)<=1048576 AND ${uint('r.last_report','$.protocolVersion')}='3'
                AND JSON_TYPE(${field('r.last_report','$.observations')})='ARRAY' AND JSON_TYPE(${field('r.last_report','$.drains')})='ARRAY') report_shape,
            (OCTET_LENGTH(s.body)<=4194304 AND ${uint('s.body','$.protocolVersion')}='3' AND ${bool('s.body','$.complete')}='true'
                AND JSON_TYPE(${field('s.body','$.assignments')})='ARRAY' AND JSON_TYPE(${field('s.body','$.tombstones')})='ARRAY') snapshot_shape,
            ${scalar('r.last_report','$.nodeId')} report_node,${scalar('r.last_report','$.bootId')} report_boot,
            ${uint('r.last_report','$.sessionEpoch')} report_epoch,${uint('r.last_report','$.reportSequence')} report_sequence,
            ${uint('r.last_report','$.acceptedSnapshotGeneration')} report_snapshot,${scalar('r.last_report','$.observedAt',40)} report_observed,
            ${scalar('s.body','$.nodeId')} snapshot_node,${uint('s.body','$.sessionEpoch')} snapshot_epoch,
            ${uint('s.body','$.snapshotGeneration')} snapshot_generation_body,${scalar('s.body','$.snapshotDigest',71)} snapshot_digest,
            ${scalar('s.body','$.issuedAt',40)} snapshot_issued,${scalar('s.body','$.validUntil',40)} snapshot_valid
            FROM nodes n LEFT JOIN runtime_nodes r ON r.node_id=n.id LEFT JOIN snapshots s
                ON s.node_id=n.id AND s.session_epoch=r.session_epoch AND s.generation=r.snapshot_generation
            WHERE n.scope_id=? AND n.id=?`,[scope,target]);
        if (!r) return null;
        const nodeId = id(r.id), credentialUntil = nullableCounter(r.credential_until);
        let report: StationReportFactRecord | null = null, invalidReport = false;
        if (flag(r.has_report)) {
            try {
                if (!flag(r.has_snapshot) || !flag(r.report_shape) || !flag(r.snapshot_shape)) corrupt();
                const bootId = id(r.boot_id), epoch = counter(r.session_epoch,true), sequence = counter(r.last_report_sequence,true),
                    generation = counter(r.snapshot_generation,true), observedAt = instant(r.report_observed), receivedAt = counter(r.received_at),
                    issuedAt = instant(r.snapshot_issued), validUntil = instant(r.snapshot_valid);
                if (r.report_node !== nodeId || r.snapshot_node !== nodeId || r.report_boot !== bootId || counter(r.report_epoch,true) !== epoch ||
                    counter(r.snapshot_epoch,true) !== epoch || counter(r.report_sequence,true) !== sequence || counter(r.report_snapshot,true) !== generation ||
                    counter(r.snapshot_generation_body,true) !== generation || counter(r.snapshot_until) !== validUntil || issuedAt >= validUntil ||
                    typeof r.snapshot_digest !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(r.snapshot_digest) || credentialUntil === null) corrupt();
                report = { kind: 'node-report', targetId: nodeId, bootId, sessionEpoch: epoch, reportSequence: sequence, snapshotGeneration: generation,
                    observedAt, receivedAt, credentialUntil };
            } catch { invalidReport = true; }
        }
        return { kind: 'node', id: nodeId, revoked: flag(r.revoked), credentialUntil, report, invalidReport };
    }
}
