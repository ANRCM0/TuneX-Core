import { createPool } from 'mysql2/promise';
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
export type Transaction = PoolConnection;
export async function rows<T>(tx: Pool | Transaction, sql: string, args: unknown[] = []): Promise<T[]> {
  const [result] = await tx.execute<RowDataPacket[]>(sql, args); return result as T[];
}
export async function write(tx: Pool | Transaction, sql: string, args: unknown[] = []): Promise<number> {
  const [result] = await tx.execute<ResultSetHeader>(sql, args); return result.affectedRows;
}
export class MySqlUnitOfWork {
  readonly pool: Pool;
  constructor(url: string) { this.pool = createPool({ uri: url, connectionLimit: 8, supportBigNumbers: true, bigNumberStrings: false, timezone: 'Z' }); }
  async transaction<T>(action: (tx: Transaction) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const tx = await this.pool.getConnection();
      try { await tx.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');await tx.beginTransaction(); const result = await action(tx); await tx.commit(); return result; }
      catch (error) {
        await tx.rollback(); const code = (error as { code?: string }).code;
        if (attempt < 2 && (code === 'ER_LOCK_DEADLOCK' || code === 'ER_LOCK_WAIT_TIMEOUT')) continue;
        throw error;
      } finally { tx.release(); }
    }
  }
  async migrate(): Promise<void> {
    const legacy = await rows<{ n: number }>(this.pool, "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('Tunnel','Forward','User','_prisma_migrations')");
    if (legacy[0]!.n !== 0) throw new Error('VNext requires a fresh database');
    const sql = await readFile(new URL('../../migrations/0001-phase1.sql', import.meta.url), 'utf8');
    for (const statement of sql.split(';').map(value => value.trim()).filter(Boolean)) await this.pool.query(statement);
  }
  async close(): Promise<void> { await this.pool.end(); }
}
export function json<T>(value: unknown): T { return (typeof value === 'string' ? JSON.parse(value) : value) as T; }
