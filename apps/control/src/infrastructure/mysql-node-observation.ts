import { isCounter, isId } from '@tunex/core';
import type { Duplex } from 'node:stream';
import { ControlError, notFound } from '../framework/public.ts';
import type { ScopeAuthorization, ResourceReadAccess } from '../framework/public.ts';
import { rows } from './mysql.ts';
import type { MySqlUnitOfWork, Transaction } from './mysql.ts';
import type { AgentReportProvenance, AuthorizedNodeReportReader, NodeObservationContext,
    NodeReportEvidence } from '../framework/public.ts';

interface ReportRow {
    id: string; scope_id: string; revoked: number; credential_until: number | null;
    session_epoch: number | null; boot_id: string | null; snapshot_generation: number | null;
    valid_until: number | null; received_at: number | null; last_report_sequence: number | null;
    has_report: number; report_node: string | null; report_boot: string | null; report_epoch: string | null;
    report_sequence: string | null; report_snapshot: string | null; report_time: string | null;
    observation_count: number | null;
}
function counter(value: string | null, allowZero = false): number | undefined {
    if (value === null || /[\r\n]/.test(value) || !/^(0|[1-9][0-9]{0,15})$/.test(value)) return undefined;
    const number = Number(value);
    return isCounter(number, allowZero) ? number : undefined;
}
function reportFrom(row: ReportRow): AgentReportProvenance | null {
    const sessionEpoch = counter(row.report_epoch), sequence = counter(row.report_sequence);
    const snapshot = counter(row.report_snapshot, true);
    const observedAt = row.report_time !== null && !/[\r\n]/.test(row.report_time) &&
        /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(row.report_time) ?
        Date.parse(row.report_time) : NaN;
    if (!isId(row.report_node) || !isId(row.report_boot) || sessionEpoch === undefined || sequence === undefined ||
        sequence !== row.last_report_sequence || snapshot === undefined || !Number.isSafeInteger(observedAt) ||
        observedAt < 0 || row.received_at === null || !Number.isSafeInteger(row.observation_count) ||
        row.observation_count! < 0 || row.observation_count! > 10000) return null;
    return { nodeId: row.report_node, bootId: row.report_boot, sessionEpoch, reportSequence: sequence,
        snapshotGeneration: snapshot, observedAt, receivedAt: row.received_at, assignmentCount: row.observation_count! };
}

/** SELECT-only projection. Cancellation destroys its dedicated connection, never a Runtime transaction. */
export class MySqlNodeObservationReader implements AuthorizedNodeReportReader {
    private readonly db: Pick<MySqlUnitOfWork, 'pool' | 'guard'>;
    private readonly identity: ScopeAuthorization<Transaction>;
    private readonly access:ResourceReadAccess<Transaction>;
    constructor(db: Pick<MySqlUnitOfWork, 'pool' | 'guard'>, identity: ScopeAuthorization<Transaction>,
        access: ResourceReadAccess<Transaction>) {
        this.access=access;

        this.db = db; this.identity = identity;
    }
    async read(context: NodeObservationContext): Promise<NodeReportEvidence> {
        context.signal.throwIfAborted();
        // The host retains admission while pool acquisition is pending, even after cancellation.
        const tx = await this.db.pool.getConnection();
        let destroyed = false, begun = false;
        // mysql2 destroy() only ends its stream and can leave an in-flight promise pending.
        // Hard-stop the owned transport with an error so mysql2 rejects its pending commands too.
        const stream = (tx.connection as unknown as { stream?: Duplex } | undefined)?.stream;
        if (!stream || typeof stream.destroy !== 'function') {
            tx.destroy();
            throw new ControlError('OBSERVATION_FAILED', 503, 'Observation transport unavailable', true);
        }
        const stop = () => {
            if (!destroyed) {
                destroyed = true;
                try { stream.destroy(new Error('Observation connection stopped')); }
                finally { tx.destroy(); }
            }
        };
        context.signal.addEventListener('abort', stop, { once: true });
        try {
            if (context.signal.aborted) { stop(); context.signal.throwIfAborted(); }
            await this.db.guard?.();
            context.signal.throwIfAborted();
            await tx.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
            await tx.beginTransaction(); begun = true;
            await this.identity.scope(tx, context.actorId, context.scopeId);
            await this.access.node(tx, context.actorId, context.scopeId, context.nodeId, 'diagnostics');
            context.signal.throwIfAborted();
            const [row] = await rows<ReportRow>(tx, `SELECT n.id,n.scope_id,n.revoked,n.credential_until,
                r.session_epoch,r.boot_id,r.snapshot_generation,r.received_at,r.last_report_sequence,
                s.valid_until,(r.last_report IS NOT NULL) has_report,
                LEFT(JSON_UNQUOTE(JSON_EXTRACT(r.last_report,'$.nodeId')),129) report_node,
                LEFT(JSON_UNQUOTE(JSON_EXTRACT(r.last_report,'$.bootId')),129) report_boot,
                CASE WHEN JSON_TYPE(JSON_EXTRACT(r.last_report,'$.sessionEpoch'))='INTEGER'
                    THEN LEFT(JSON_UNQUOTE(JSON_EXTRACT(r.last_report,'$.sessionEpoch')),17) ELSE NULL END report_epoch,
                CASE WHEN JSON_TYPE(JSON_EXTRACT(r.last_report,'$.reportSequence'))='INTEGER'
                    THEN LEFT(JSON_UNQUOTE(JSON_EXTRACT(r.last_report,'$.reportSequence')),17) ELSE NULL END report_sequence,
                CASE WHEN JSON_TYPE(JSON_EXTRACT(r.last_report,'$.acceptedSnapshotGeneration'))='INTEGER'
                    THEN LEFT(JSON_UNQUOTE(JSON_EXTRACT(r.last_report,'$.acceptedSnapshotGeneration')),17) ELSE NULL END report_snapshot,
                LEFT(JSON_UNQUOTE(JSON_EXTRACT(r.last_report,'$.observedAt')),41) report_time,
                CASE WHEN JSON_TYPE(JSON_EXTRACT(r.last_report,'$.observations'))='ARRAY'
                    THEN JSON_LENGTH(r.last_report,'$.observations') ELSE NULL END observation_count
                FROM nodes n LEFT JOIN runtime_nodes r ON r.node_id=n.id
                LEFT JOIN snapshots s ON s.node_id=n.id AND s.generation=r.snapshot_generation AND s.session_epoch=r.session_epoch
                WHERE n.id=? AND n.scope_id=?`, [context.nodeId, context.scopeId]);
            if (!row) notFound();
            await this.db.guard?.();
            context.signal.throwIfAborted();
            const report = reportFrom(row);
            return {
                nodeId: row.id, scopeId: row.scope_id, revoked: Boolean(row.revoked),
                credentialUntil: row.credential_until, sessionEpoch: row.session_epoch ?? 0,
                bootId: row.boot_id, snapshotGeneration: row.snapshot_generation ?? 0,
                snapshotValidUntil: row.valid_until, invalidReport: Boolean(row.has_report) && report === null, report,
            };
        } finally {
            try {
                if (!destroyed && begun) await tx.rollback();
            } catch (error) {
                stop();
                throw error;
            } finally {
                context.signal.removeEventListener('abort', stop);
                if (!destroyed) tx.release();
            }
        }
    }
}
