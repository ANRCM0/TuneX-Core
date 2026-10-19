import { randomUUID } from 'node:crypto';

import { ControlError } from '../framework/public.ts';
import type { ReadPageWindow, IngressGroupStoredHead, IngressGroupStoredRevision, IngressGroupStorage } from '../framework/public.ts';
import { consolePageSql } from './mysql-read-pagination.ts';
import { json, rows, write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

export class MySqlIngressGroupStore<Config> implements IngressGroupStorage<Transaction,Config> {
    async lockScope(tx: Transaction, scope: string) { await rows(tx, 'SELECT id FROM scopes WHERE id=? FOR UPDATE', [scope]); }
    async count(tx: Transaction, scope: string) { return (await rows<{ n: number }>(tx, 'SELECT COUNT(*) n FROM ingress_groups WHERE scope_id=?', [scope]))[0]!.n; }
    async head(tx: Transaction, scope: string, id: string, lock = false): Promise<IngressGroupStoredHead | null> {
        const record = (await rows<{ group_id: string; current_revision: number; archived: number }>(tx,
            'SELECT group_id,current_revision,archived FROM ingress_groups WHERE scope_id=? AND group_id=?' + (lock ? ' FOR UPDATE' : ''), [scope, id]))[0];
        return record ? { groupId: record.group_id, currentRevision: record.current_revision, archived: Boolean(record.archived) } : null;
    }
    async revision(tx: Transaction, scope: string, id: string, number: number): Promise<IngressGroupStoredRevision<Config> | null> {
        const record = (await rows<{ revision: number; config: unknown; config_digest: string; created_by: string; created_at: number }>(tx,
            'SELECT revision,config,config_digest,created_by,created_at FROM ingress_group_revisions WHERE scope_id=? AND group_id=? AND revision=?', [scope, id, number]))[0];
        return record ? { revision: record.revision, config: json<Config>(record.config), configDigest: record.config_digest, createdBy: record.created_by, createdAt: record.created_at } : null;
    }
    async list(tx: Transaction, scope: string, paging: ReadPageWindow, prefix: string) {
        const filter = 'scope_id=? AND LEFT(group_id,CHAR_LENGTH(?))=?', args = [scope, prefix, prefix];
        const total = (await rows<{ n: number }>(tx, 'SELECT COUNT(*) n FROM ingress_groups WHERE ' + filter, args))[0]!.n;
        const records = await rows<{ group_id: string; current_revision: number; archived: number }>(tx,
            'SELECT group_id,current_revision,archived FROM ingress_groups WHERE ' + filter + ' ORDER BY group_id ' + consolePageSql(paging), args);
        return { total, items: records.map(record => ({ groupId: record.group_id, currentRevision: record.current_revision, archived: Boolean(record.archived) })) };
    }
    /** Caller holds Scope before the ingress group head in this supplied transaction. */
    async publish(tx: Transaction, scope: string, id: string, record: IngressGroupStoredRevision<Config>, count: (tx: Transaction, scope: string) => Promise<number> = (tx, scope) => this.count(tx, scope)) {
        if (record.revision === 1) {
            if (await count(tx, scope) >= 64) throw new ControlError('RESOURCE_LIMIT', 429, 'Scope ingress group limit reached');
            await write(tx, 'INSERT INTO ingress_groups(scope_id,group_id,current_revision) VALUES(?,?,1)', [scope, id]);
        }
        await write(tx, 'INSERT INTO ingress_group_revisions(scope_id,group_id,revision,config,config_digest,created_by,created_at) VALUES(?,?,?,?,?,?,?)',
            [scope, id, record.revision, JSON.stringify(record.config), record.configDigest, record.createdBy, record.createdAt]);
        if (record.revision !== 1 && await write(tx,
            'UPDATE ingress_groups SET current_revision=? WHERE scope_id=? AND group_id=? AND current_revision=? AND archived=FALSE',
            [record.revision, scope, id, record.revision - 1]) !== 1) throw new ControlError('REVISION_CONFLICT', 409, 'Ingress group changed or archived');
    }
    async archive(tx: Transaction, scope: string, id: string) { await write(tx, 'UPDATE ingress_groups SET archived=TRUE WHERE scope_id=? AND group_id=?', [scope, id]); }
    async audit(tx: Transaction, scope: string, id: string, actor: string, revision: number, kind: 'publish' | 'archive', at: number) {
        await write(tx, 'INSERT INTO ingress_group_events(id,scope_id,group_id,actor_id,revision,kind,created_at) VALUES(?,?,?,?,?,?,?)', [randomUUID(), scope, id, actor, revision, kind, at]);
    }
}
