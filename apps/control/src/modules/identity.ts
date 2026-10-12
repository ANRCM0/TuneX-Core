import { createHash, randomBytes } from 'node:crypto';
import { isId } from '@tunex/core';
import { ControlError, notFound } from '../application/errors.ts';
import { rows, write } from '../infrastructure/mysql.ts';
import type { MySqlUnitOfWork, Transaction } from '../infrastructure/mysql.ts';
export function tokenHash(token: string): string { return createHash('sha256').update(token).digest('hex'); }
export function newToken(): string { return randomBytes(32).toString('base64url'); }
export class Identity {
  private readonly db: MySqlUnitOfWork;
  constructor(db: MySqlUnitOfWork) { this.db=db; }
  async bootstrap(scopeId: string, actorId: string, token: string): Promise<void> {
    if (!isId(scopeId) || !isId(actorId) || !/^[A-Za-z0-9_-]{32,128}$/.test(token)) throw new Error('Bootstrap requires valid IDs and a random bearer token');
    await this.db.transaction(async tx => {
      await write(tx, 'INSERT INTO accounts(id,token_hash) VALUES(?,?)', [actorId, tokenHash(token)]);
      await write(tx, 'INSERT INTO scopes(id,owner_id) VALUES(?,?)', [scopeId, actorId]);
      await write(tx, 'INSERT INTO scope_members(scope_id,actor_id,can_manage) VALUES(?,?,TRUE)', [scopeId, actorId]);
    });
  }
  async authenticate(header: string | undefined): Promise<string> {
    const token = header?.match(/^Bearer ([A-Za-z0-9_-]{32,128})$/)?.[1];
    const account = token ? (await rows<{ id: string }>(this.db.pool, 'SELECT id FROM accounts WHERE token_hash=?', [tokenHash(token)]))[0] : undefined;
    if (!account) throw new ControlError('UNAUTHENTICATED', 401, 'Valid bearer identity required');
    return account.id;
  }
  async scope(tx: Transaction, actorId: string, scopeId: string, manage = false): Promise<void> {
    const member = (await rows<{ can_manage: number }>(tx, 'SELECT can_manage FROM scope_members WHERE scope_id=? AND actor_id=? FOR SHARE', [scopeId, actorId]))[0];
    if (!member) notFound();
    if (manage && !member.can_manage) throw new ControlError('AUTHORIZATION_DENIED', 403, 'Scope management permission required');
  }
}
