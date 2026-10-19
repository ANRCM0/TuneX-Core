import { randomUUID } from 'node:crypto';
import { consolePageSql } from './mysql-read-pagination.ts';
import type { ReadPageWindow, PathTemplateStoredHead, PathTemplateStoredRevision, PathTemplateStorage } from '../framework/public.ts';
import { rows, write, json } from './mysql.ts';
import type { Transaction } from './mysql.ts';

export class MySqlPathTemplateStore<Config> implements PathTemplateStorage<Transaction,Config> {
    async lockScope(tx: Transaction, scope: string) { await rows(tx, 'SELECT id FROM scopes WHERE id=? FOR UPDATE', [scope]); }
    async count(tx: Transaction, scope: string) { return (await rows<{ n: number }>(tx, 'SELECT COUNT(*) n FROM path_templates WHERE scope_id=?', [scope]))[0]!.n; }
    async head(tx: Transaction, scope: string, id: string, lock = false): Promise<PathTemplateStoredHead | null> {
        const record = (await rows<{ template_id: string; current_revision: number; archived: number }>(tx,
            'SELECT template_id,current_revision,archived FROM path_templates WHERE scope_id=? AND template_id=?' + (lock ? ' FOR UPDATE' : ''), [scope, id]))[0];
        return record ? { templateId: record.template_id, currentRevision: record.current_revision, archived: Boolean(record.archived) } : null;
    }
    async revision(tx: Transaction, scope: string, id: string, number: number): Promise<PathTemplateStoredRevision<Config> | null> {
        const record = (await rows<{ revision: number; config: unknown; profile_digest: string; config_digest: string; created_by: string; created_at: number }>(tx,
            'SELECT revision,config,profile_digest,config_digest,created_by,created_at FROM path_template_revisions WHERE scope_id=? AND template_id=? AND revision=?', [scope, id, number]))[0];
        return record ? { revision: record.revision, config: json<Config>(record.config), profileDigest: record.profile_digest,
            configDigest: record.config_digest, createdBy: record.created_by, createdAt: record.created_at } : null;
    }
    async list(tx: Transaction, scope: string, paging: ReadPageWindow, prefix: string) {
        const filter = 'scope_id=? AND LEFT(template_id,CHAR_LENGTH(?))=?', args = [scope, prefix, prefix];
        const total = (await rows<{ n: number }>(tx, 'SELECT COUNT(*) n FROM path_templates WHERE ' + filter, args))[0]!.n;
        const records = await rows<{ template_id: string; current_revision: number; archived: number }>(tx,
            'SELECT template_id,current_revision,archived FROM path_templates WHERE ' + filter + ' ORDER BY template_id ' + consolePageSql(paging), args);
        return { total, items: records.map(record => ({ templateId: record.template_id, currentRevision: record.current_revision, archived: Boolean(record.archived) })) };
    }
    async publish(tx: Transaction, scope: string, id: string, record: PathTemplateStoredRevision<Config>) {
        if (record.revision === 1) await write(tx, 'INSERT INTO path_templates(scope_id,template_id,current_revision) VALUES(?,?,1)', [scope, id]);
        await write(tx, 'INSERT INTO path_template_revisions(scope_id,template_id,revision,config,profile_digest,config_digest,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)',
            [scope, id, record.revision, JSON.stringify(record.config), record.profileDigest, record.configDigest, record.createdBy, record.createdAt]);
        await write(tx, 'UPDATE path_templates SET current_revision=? WHERE scope_id=? AND template_id=?', [record.revision, scope, id]);
    }
    async archive(tx: Transaction, scope: string, id: string) { await write(tx, 'UPDATE path_templates SET archived=TRUE WHERE scope_id=? AND template_id=?', [scope, id]); }
    async audit(tx: Transaction, scope: string, id: string, actor: string, revision: number, kind: 'publish' | 'archive', at: number) {
        await write(tx, 'INSERT INTO path_template_events(id,scope_id,template_id,actor_id,revision,kind,created_at) VALUES(?,?,?,?,?,?,?)', [randomUUID(), scope, id, actor, revision, kind, at]);
    }
}
