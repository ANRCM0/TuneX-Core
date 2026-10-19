import { randomUUID } from 'node:crypto';
import { ControlError } from '../framework/public.ts';
import type { ReadPageWindow, ForwardIntent, PathGroupStoredHead, PathGroupStoredRevision, PathGroupStorage, PathGroupBindingStoredRecord, PathGroupBindingStorage } from '../framework/public.ts';

import { consolePageSql } from './mysql-read-pagination.ts';
import { json, rows, write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

export class MySqlPathGroupStore<Config> implements PathGroupStorage<Transaction,Config> {
    async lockScope(tx: Transaction, scope: string) { await rows(tx, 'SELECT id FROM scopes WHERE id=? FOR UPDATE', [scope]); }
    async count(tx: Transaction, scope: string) { return (await rows<{ n: number }>(tx, 'SELECT COUNT(*) n FROM path_groups WHERE scope_id=?', [scope]))[0]!.n; }
    async head(tx: Transaction, scope: string, id: string, lock = false): Promise<PathGroupStoredHead | null> {
        const record = (await rows<{ group_id: string; current_revision: number; archived: number }>(tx,
            'SELECT group_id,current_revision,archived FROM path_groups WHERE scope_id=? AND group_id=?' + (lock ? ' FOR UPDATE' : ''), [scope, id]))[0];
        return record ? { groupId: record.group_id, currentRevision: record.current_revision, archived: Boolean(record.archived) } : null;
    }
    async revision(tx: Transaction, scope: string, id: string, number: number): Promise<PathGroupStoredRevision<Config> | null> {
        const record = (await rows<{ revision: number; config: unknown; config_digest: string; created_by: string; created_at: number }>(tx,
            'SELECT revision,config,config_digest,created_by,created_at FROM path_group_revisions WHERE scope_id=? AND group_id=? AND revision=?', [scope, id, number]))[0];
        return record ? { revision: record.revision, config: json<Config>(record.config), configDigest: record.config_digest,
            createdBy: record.created_by, createdAt: record.created_at } : null;
    }
    async list(tx: Transaction, scope: string, paging: ReadPageWindow, prefix: string) {
        const filter = 'scope_id=? AND LEFT(group_id,CHAR_LENGTH(?))=?', args = [scope, prefix, prefix];
        const total = (await rows<{ n: number }>(tx, 'SELECT COUNT(*) n FROM path_groups WHERE ' + filter, args))[0]!.n;
        const records = await rows<{ group_id: string; current_revision: number; archived: number }>(tx,
            'SELECT group_id,current_revision,archived FROM path_groups WHERE ' + filter + ' ORDER BY group_id ' + consolePageSql(paging), args);
        return { total, items: records.map(record => ({ groupId: record.group_id, currentRevision: record.current_revision, archived: Boolean(record.archived) })) };
    }
    /** Caller holds the Scope lock before the group head lock in the same transaction. */
    // Only the legacy bridge supplies count, retaining its original dynamic override.
    async publish(tx: Transaction, scope: string, id: string, record: PathGroupStoredRevision<Config>, count: (tx: Transaction, scope: string) => Promise<number> = (tx, scope) => this.count(tx, scope)) {
        if (record.revision === 1) {
            if (await count(tx, scope) >= 64) throw new ControlError('RESOURCE_LIMIT', 429, 'Scope immutable path group limit reached');
            await write(tx, 'INSERT INTO path_groups(scope_id,group_id,current_revision) VALUES(?,?,1)', [scope, id]);
        }
        await write(tx, 'INSERT INTO path_group_revisions(scope_id,group_id,revision,config,config_digest,created_by,created_at) VALUES(?,?,?,?,?,?,?)',
            [scope, id, record.revision, JSON.stringify(record.config), record.configDigest, record.createdBy, record.createdAt]);
        if (record.revision !== 1 && await write(tx,
            'UPDATE path_groups SET current_revision=? WHERE scope_id=? AND group_id=? AND current_revision=? AND archived=FALSE',
            [record.revision, scope, id, record.revision - 1]) !== 1)
            throw new ControlError('REVISION_CONFLICT', 409, 'Path group head changed or archived');
    }
    async archive(tx: Transaction, scope: string, id: string) { await write(tx, 'UPDATE path_groups SET archived=TRUE WHERE scope_id=? AND group_id=?', [scope, id]); }
    async audit(tx: Transaction, scope: string, id: string, actor: string, revision: number, kind: 'publish' | 'archive', at: number) {
        await write(tx, 'INSERT INTO path_group_events(id,scope_id,group_id,actor_id,revision,kind,created_at) VALUES(?,?,?,?,?,?,?)', [randomUUID(), scope, id, actor, revision, kind, at]);
    }
}

interface StoredBinding {
    sequence: number; group_id: string; group_revision: number; config_digest: string; candidate_id: string;
    path_binding_sequence: number; forward_revision: number; expanded_spec: unknown; spec_digest: string; actor_id: string; created_at: number;
}
const binding = (row: StoredBinding): PathGroupBindingStoredRecord => ({ sequence: row.sequence, groupId: row.group_id, revision: row.group_revision,
    configDigest: row.config_digest, candidateId: row.candidate_id, pathBindingSequence: row.path_binding_sequence, forwardRevision: row.forward_revision,
    expandedSpec: json(row.expanded_spec), specDigest: row.spec_digest, actorId: row.actor_id, createdAt: row.created_at });
const join = ' FROM current_forward_path_group_bindings c JOIN forward_path_group_bindings b ON b.forward_id=c.forward_id AND b.sequence=c.sequence JOIN forwards f ON f.id=c.forward_id';

/** Mutation calls require the original Forward row lock on this supplied transaction. */
export class MySqlPathGroupBindingStore implements PathGroupBindingStorage<Transaction> {
    async current(tx: Transaction, scope: string, forwardId: string) {
        const record = (await rows<StoredBinding>(tx, 'SELECT b.*' + join + ' WHERE f.scope_id=? AND b.scope_id=? AND f.id=?', [scope, scope, forwardId]))[0];
        return record ? binding(record) : null;
    }
    async history(tx: Transaction, scope: string, forwardId: string) {
        const records = await rows<StoredBinding>(tx, 'SELECT b.* FROM forward_path_group_bindings b JOIN forwards f ON f.id=b.forward_id WHERE f.scope_id=? AND b.scope_id=? AND f.id=? ORDER BY b.sequence LIMIT 64', [scope, scope, forwardId]);
        return records.map(binding);
    }
    async references(tx: Transaction, scope: string, id: string, paging: ReadPageWindow, revision?: number) {
        const filter = ' WHERE f.scope_id=? AND b.scope_id=? AND b.group_id=? AND f.deleting=FALSE' + (revision === undefined ? '' : ' AND b.group_revision=?');
        const args = [scope, scope, id, ...(revision === undefined ? [] : [revision])];
        const total = (await rows<{ n: number }>(tx, 'SELECT COUNT(*) n' + join + filter, args))[0]!.n;
        const data = await rows<StoredBinding & { id: string; revision: number; spec: unknown; recovery_suspended: number }>(tx,
            'SELECT b.*,f.id,f.revision,f.spec,f.recovery_suspended' + join + filter + ' ORDER BY f.id ' + consolePageSql(paging), args);
        return { total, items: data.map(record => ({ forward: { id: record.id, scopeId: scope, revision: record.revision, spec: json<ForwardIntent>(record.spec) },
            recoverySuspended: Boolean(record.recovery_suspended), binding: binding(record) })) };
    }
    async append(tx: Transaction, scope: string, forwardId: string, record: Omit<PathGroupBindingStoredRecord, 'sequence'>) {
        const maximum = (await rows<{ n: number | string }>(tx, 'SELECT COALESCE(MAX(sequence),0) n FROM forward_path_group_bindings WHERE forward_id=?', [forwardId]))[0]!.n;
        // MySQL can return COALESCE over BIGINT as a DECIMAL string.
        const previous = typeof maximum === 'string' && String(Number(maximum)) === maximum ? Number(maximum) : maximum;
        if (typeof previous !== 'number' || !Number.isSafeInteger(previous) || previous < 0)
            throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid persisted path group binding sequence');
        if (previous >= 64) throw new ControlError('RESOURCE_LIMIT', 429, 'Forward immutable path group binding limit reached');
        const sequence = previous + 1;
        await write(tx, 'INSERT INTO forward_path_group_bindings(forward_id,sequence,scope_id,group_id,group_revision,config_digest,candidate_id,path_binding_sequence,forward_revision,expanded_spec,spec_digest,actor_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [forwardId, sequence, scope, record.groupId, record.revision, record.configDigest, record.candidateId, record.pathBindingSequence, record.forwardRevision, JSON.stringify(record.expandedSpec), record.specDigest, record.actorId, record.createdAt]);
        await write(tx, 'INSERT INTO current_forward_path_group_bindings(forward_id,sequence) VALUES(?,?) ON DUPLICATE KEY UPDATE sequence=VALUES(sequence)', [forwardId, sequence]);
        return { ...record, sequence };
    }
    async detach(tx: Transaction, scope: string, forwardId: string) {
        await write(tx, 'DELETE c FROM current_forward_path_group_bindings c JOIN forward_path_group_bindings b ON b.forward_id=c.forward_id AND b.sequence=c.sequence WHERE c.forward_id=? AND b.scope_id=?', [forwardId, scope]);
    }
}
