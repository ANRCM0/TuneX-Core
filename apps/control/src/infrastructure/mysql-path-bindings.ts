import { ControlError } from '../application/errors.ts';
import type { ConsolePaging } from '../application/console-query.ts';
import type { PathBindingRecord, PathBindingWriter } from '../modules/path-binding-ports.ts';
import { consolePageSql } from './mysql-console-read.ts';
import { json, rows, write } from './mysql.ts';
import type { Transaction } from './mysql.ts';
import type { ForwardSpec } from '@tunex/core';

interface StoredBinding {
    sequence: number; template_id: string; template_revision: number; config_digest: string; forward_revision: number;
    expanded_spec: unknown; spec_digest: string; actor_id: string; created_at: number;
}
const binding = (row: StoredBinding): PathBindingRecord => ({ sequence: row.sequence, templateId: row.template_id, revision: row.template_revision,
    configDigest: row.config_digest, forwardRevision: row.forward_revision, expandedSpec: json(row.expanded_spec), specDigest: row.spec_digest, actorId: row.actor_id, createdAt: row.created_at });
const join = ' FROM current_path_bindings c JOIN forward_path_bindings b ON b.forward_id=c.forward_id AND b.sequence=c.sequence JOIN forwards f ON f.id=c.forward_id';

/** All mutation calls require the original Forward row lock on this supplied transaction. */
export class MySqlPathBindings implements PathBindingWriter<Transaction> {
    async current(tx: Transaction, scope: string, forwardId: string) {
        const row = (await rows<StoredBinding>(tx, 'SELECT b.*' + join + ' WHERE f.scope_id=? AND b.scope_id=? AND f.id=?', [scope, scope, forwardId]))[0];
        return row ? binding(row) : null;
    }
    async history(tx: Transaction, scope: string, forwardId: string) {
        const records = await rows<StoredBinding>(tx, 'SELECT b.* FROM forward_path_bindings b JOIN forwards f ON f.id=b.forward_id WHERE f.scope_id=? AND b.scope_id=? AND f.id=? ORDER BY b.sequence', [scope, scope, forwardId]);
        return records.map(binding);
    }
    async references(tx: Transaction, scope: string, templateId: string, paging: ConsolePaging, revision?: number) {
        const filter = ' WHERE f.scope_id=? AND b.scope_id=? AND b.template_id=? AND f.deleting=FALSE' + (revision === undefined ? '' : ' AND b.template_revision=?');
        const args = [scope, scope, templateId, ...(revision === undefined ? [] : [revision])];
        const total = (await rows<{ n: number }>(tx, 'SELECT COUNT(*) n' + join + filter, args))[0]!.n;
        const data = await rows<StoredBinding & { id: string; revision: number; spec: unknown; recovery_suspended: number }>(tx,
            'SELECT b.*,f.id,f.revision,f.spec,f.recovery_suspended' + join + filter + ' ORDER BY f.id ' + consolePageSql(paging), args);
        return { total, items: data.map(row => ({ forward: { id: row.id, scopeId: scope, revision: row.revision, spec: json<ForwardSpec>(row.spec) },
            recoverySuspended: Boolean(row.recovery_suspended), binding: binding(row) })) };
    }
    async append(tx: Transaction, scope: string, forwardId: string, record: Omit<PathBindingRecord, 'sequence'>) {
        const sequence = ((await rows<{ n: number }>(tx, 'SELECT COALESCE(MAX(sequence),0) n FROM forward_path_bindings WHERE forward_id=?', [forwardId]))[0]!.n) + 1;
        if (!Number.isSafeInteger(sequence) || sequence > 64) throw new ControlError('RESOURCE_LIMIT', 429, 'Forward immutable path binding limit reached');
        await write(tx, 'INSERT INTO forward_path_bindings(forward_id,sequence,scope_id,template_id,template_revision,config_digest,forward_revision,expanded_spec,spec_digest,actor_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
            [forwardId, sequence, scope, record.templateId, record.revision, record.configDigest, record.forwardRevision, JSON.stringify(record.expandedSpec), record.specDigest, record.actorId, record.createdAt]);
        await write(tx, 'INSERT INTO current_path_bindings(forward_id,sequence) VALUES(?,?) ON DUPLICATE KEY UPDATE sequence=VALUES(sequence)', [forwardId, sequence]);
        return { ...record, sequence };
    }
    async detach(tx: Transaction, scope: string, forwardId: string) {
        await write(tx, 'DELETE c FROM current_path_bindings c JOIN forward_path_bindings b ON b.forward_id=c.forward_id AND b.sequence=c.sequence WHERE c.forward_id=? AND b.scope_id=?', [forwardId, scope]);
    }
}
