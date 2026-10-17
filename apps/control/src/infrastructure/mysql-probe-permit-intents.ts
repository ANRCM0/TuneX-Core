import type { Forward } from '@tunex/core';
import { notFound } from '../application/errors.ts';
import type { ProbeIntents } from '../modules/probe-ports.ts';
import { json, rows } from './mysql.ts';
import type { Transaction } from './mysql.ts';

/** Scoped, locking projection for permit authorization; owns no Forward mutations. */
export class MySqlProbePermitIntents implements ProbeIntents<Transaction> {
    async record(tx: Transaction, scopeId: string, id: string) {
        const [row] = await rows<{ id: string; scope_id: string; revision: number; spec: unknown;
            deleting: number; recovery_suspended: number }>(tx,
        'SELECT id,scope_id,revision,spec,deleting,recovery_suspended FROM forwards WHERE id=? AND scope_id=? FOR SHARE', [id, scopeId]);
        if (!row) notFound();
        return { id: row.id, scopeId: row.scope_id, revision: row.revision, spec: json<Forward['spec']>(row.spec),
            deleting: Boolean(row.deleting), recoverySuspended: Boolean(row.recovery_suspended) };
    }
}
