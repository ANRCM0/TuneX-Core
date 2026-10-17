import type { ForwardSpec } from '@tunex/core';
import type { ProfileReference, TransportReferenceReader } from '../application/transport-queries.ts';
import type { ConsolePaging } from '../application/console-query.ts';
import { consolePageSql } from './mysql-console-read.ts';
import { json, rows } from './mysql.ts';
import type { Transaction } from './mysql.ts';

/** SELECT-only; the application owns authorization, resolution and the supplied transaction. */
export class MySqlTransportReader implements TransportReferenceReader<Transaction> {
    async profile(tx: Transaction, scope: string, profile: string) {
        const [record] = await rows<{ current_revision: number }>(tx,
            'SELECT current_revision FROM transport_profiles WHERE id=? AND scope_id=?', [profile, scope]);
        return record ? { currentRevision: record.current_revision } : null;
    }
    async references(tx: Transaction, scope: string, profile: string, paging: ConsolePaging, revision?: number) {
        const where = `scope_id=? AND deleting=FALSE AND CAST(JSON_UNQUOTE(spec->'$.transport.profileId') AS BINARY)=CAST(? AS BINARY)` +
            (revision === undefined ? '' : ` AND spec->'$.transport.configRevision'=CAST(? AS JSON)`);
        const args = [scope, profile, ...(revision === undefined ? [] : [String(revision)])];
        const [count] = await rows<{ n: number }>(tx, `SELECT COUNT(*) n FROM forwards WHERE ${where}`, args);
        const records = await rows<{ id: string; revision: number; spec: unknown; recovery_suspended: number }>(tx,
            `SELECT id,revision,spec,recovery_suspended FROM forwards WHERE ${where} ORDER BY id ${consolePageSql(paging)}`, args);
        const items: ProfileReference[] = records.map(record => {
            const spec = json<ForwardSpec>(record.spec);
            return { forwardId: record.id, revision: record.revision, spec, configRevision: spec?.transport?.configRevision ?? 0,
                recoverySuspended: Boolean(record.recovery_suspended) };
        });
        return { total: Number(count?.n ?? 0), items };
    }
}
