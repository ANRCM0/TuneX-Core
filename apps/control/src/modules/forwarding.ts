import type { Forward } from '@tunex/core';
import { ControlError } from '../application/errors.ts';
import { notFound } from '../application/errors.ts';
import { json, rows, write } from '../infrastructure/mysql.ts';
import type { Transaction } from '../infrastructure/mysql.ts';
export class Forwarding {
    async forNode(tx: Transaction, nodeId: string): Promise<Forward[]> {
        const records = await rows<{
            id: string;
            scope_id: string;
            revision: number;
            spec: unknown;
        }>(tx, "SELECT * FROM forwards WHERE deleting=FALSE AND JSON_UNQUOTE(JSON_EXTRACT(spec,'$.ingress.nodeId'))=? ORDER BY id", [nodeId]);
        return records.map(record => ({ id: record.id, scopeId: record.scope_id, revision: record.revision, spec: json(record.spec) }));
    }
    async insert(tx: Transaction, forward: Forward, actorId: string): Promise<void> {
        await write(tx, 'INSERT INTO forwards(id,scope_id,revision,spec,authorization_actor) VALUES(?,?,?,?,?)', [forward.id, forward.scopeId, forward.revision, JSON.stringify(forward.spec), actorId]);
        await write(tx, 'INSERT INTO forward_revisions(forward_id,revision,spec) VALUES(?,?,?)', [forward.id, forward.revision, JSON.stringify(forward.spec)]);
    }
    async authorizer(tx: Transaction, forwardId: string): Promise<string | null> { return (await rows<{
        authorization_actor: string | null;
    }>(tx, 'SELECT authorization_actor FROM forwards WHERE id=?', [forwardId]))[0]?.authorization_actor ?? null; }
    async setAuthorizer(tx: Transaction, forwardId: string, actorId: string): Promise<void> { await write(tx, 'UPDATE forwards SET authorization_actor=? WHERE id=?', [actorId, forwardId]); }
    async forActor(tx: Transaction, scopeId: string, actorId: string): Promise<Forward[]> { const records = await rows<{
        id: string;
        scope_id: string;
        revision: number;
        spec: unknown;
    }>(tx, 'SELECT * FROM forwards WHERE scope_id=? AND authorization_actor=? AND deleting=FALSE ORDER BY id', [scopeId, actorId]); return records.map(row => ({ id: row.id, scopeId: row.scope_id, revision: row.revision, spec: json(row.spec) })); }
    async get(tx: Transaction, scopeId: string, id: string): Promise<Forward> {
        const record = (await rows<{
            id: string;
            scope_id: string;
            revision: number;
            spec: unknown;
        }>(tx, 'SELECT * FROM forwards WHERE id=? AND scope_id=? AND deleting=FALSE', [id, scopeId]))[0];
        if (!record)
            notFound();
        return { id: record.id, scopeId: record.scope_id, revision: record.revision, spec: json(record.spec) };
    }
    async currentForUpdate(tx: Transaction, scopeId: string, id: string): Promise<Forward> {
        const record = (await rows<{
            id: string;
            scope_id: string;
            revision: number;
            spec: unknown;
        }>(tx, 'SELECT * FROM forwards WHERE id=? AND scope_id=? AND deleting=FALSE FOR UPDATE', [id, scopeId]))[0];
        if (!record)
            notFound();
        return { id: record.id, scopeId: record.scope_id, revision: record.revision, spec: json(record.spec) };
    }
    async record(tx: Transaction, scopeId: string, id: string): Promise<Forward & {
        deleting: boolean;
    }> {
        const row = (await rows<{
            id: string;
            scope_id: string;
            revision: number;
            spec: unknown;
            deleting: number;
        }>(tx, 'SELECT * FROM forwards WHERE id=? AND scope_id=?', [id, scopeId]))[0];
        if (!row)
            notFound();
        return { id: row.id, scopeId: row.scope_id, revision: row.revision, spec: json(row.spec), deleting: Boolean(row.deleting) };
    }
    async replace(tx: Transaction, current: Forward, next: Forward): Promise<void> {
        const changed = await write(tx, 'UPDATE forwards SET revision=?,spec=?,deleting=FALSE WHERE id=? AND revision=? AND deleting=FALSE', [next.revision, JSON.stringify(next.spec), current.id, current.revision]);
        if (changed !== 1)
            throw new ControlError('REVISION_CONFLICT', 409, 'Concurrent intent change');
        await write(tx, 'INSERT INTO forward_revisions(forward_id,revision,spec) VALUES(?,?,?)', [next.id, next.revision, JSON.stringify(next.spec)]);
    }
    async markDeleting(tx: Transaction, current: Forward, nextRevision: number): Promise<void> {
        const changed = await write(tx, 'UPDATE forwards SET revision=?,deleting=TRUE WHERE id=? AND revision=? AND deleting=FALSE', [nextRevision, current.id, current.revision]);
        if (changed !== 1)
            throw new ControlError('REVISION_CONFLICT', 409, 'Concurrent intent change');
        await write(tx, 'INSERT INTO forward_revisions(forward_id,revision,spec) VALUES(?,?,?)', [current.id, nextRevision, JSON.stringify(current.spec)]);
    }
}
