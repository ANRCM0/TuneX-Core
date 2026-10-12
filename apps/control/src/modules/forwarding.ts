import type { Forward } from '@tunex/core';
import { notFound } from '../application/errors.ts';
import { json, rows, write } from '../infrastructure/mysql.ts';
import type { Transaction } from '../infrastructure/mysql.ts';
export class Forwarding {
  async forNode(tx:Transaction,nodeId:string):Promise<Forward[]>{
    const records=await rows<{id:string;scope_id:string;revision:number;spec:unknown}>(tx,"SELECT * FROM forwards WHERE deleting=FALSE AND JSON_UNQUOTE(JSON_EXTRACT(spec,'$.ingress.nodeId'))=? ORDER BY id",[nodeId]);
    return records.map(record=>({id:record.id,scopeId:record.scope_id,revision:record.revision,spec:json(record.spec)}));
  }
  async insert(tx: Transaction, forward: Forward): Promise<void> {
    await write(tx, 'INSERT INTO forwards(id,scope_id,revision,spec) VALUES(?,?,?,?)', [forward.id, forward.scopeId, forward.revision, JSON.stringify(forward.spec)]);
    await write(tx, 'INSERT INTO forward_revisions(forward_id,revision,spec) VALUES(?,?,?)', [forward.id, forward.revision, JSON.stringify(forward.spec)]);
  }
  async get(tx: Transaction, scopeId: string, id: string): Promise<Forward> {
    const record = (await rows<{ id: string; scope_id: string; revision: number; spec: unknown }>(tx, 'SELECT * FROM forwards WHERE id=? AND scope_id=? AND deleting=FALSE', [id, scopeId]))[0];
    if (!record) notFound();
    return { id: record.id, scopeId: record.scope_id, revision: record.revision, spec: json(record.spec) };
  }
}
