import { createPool } from 'mysql2/promise';
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { readFile, readdir } from 'node:fs/promises';
export type Transaction = PoolConnection;
export async function rows<T>(tx: Pool | Transaction, sql: string, args: unknown[] = []): Promise<T[]> {
    const [result] = await tx.execute<RowDataPacket[]>(sql, args);
    return result as T[];
}
export async function write(tx: Pool | Transaction, sql: string, args: unknown[] = []): Promise<number> {
    const [result] = await tx.execute<ResultSetHeader>(sql, args);
    return result.affectedRows;
}
export class MySqlUnitOfWork {
    readonly pool: Pool;
    constructor(url: string) { this.pool = createPool({ uri: url, connectionLimit: 8, supportBigNumbers: true, bigNumberStrings: false, timezone: 'Z' }); }
    async transaction<T>(action: (tx: Transaction) => Promise<T>): Promise<T> {
        for (let attempt = 0;; attempt++) {
            const tx = await this.pool.getConnection();
            try {
                await tx.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
                await tx.beginTransaction();
                const result = await action(tx);
                await tx.commit();
                return result;
            }
            catch (error) {
                await tx.rollback();
                const code = (error as {
                    code?: string;
                }).code;
                if (attempt < 2 && (code === 'ER_LOCK_DEADLOCK' || code === 'ER_LOCK_WAIT_TIMEOUT'))
                    continue;
                throw error;
            }
            finally {
                tx.release();
            }
        }
    }
    async migrate(): Promise<void> {
        const legacy = await rows<{
            n: number;
        }>(this.pool, "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('Tunnel','Forward','User','_prisma_migrations')");
        if (legacy[0]!.n !== 0)
            throw new Error('VNext requires a fresh database');
        const connection = await this.pool.getConnection();
        let migrationLocked=false;
        try {
            const [locked] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK(CONCAT('tunex:migrate:',LEFT(SHA2(DATABASE(),256),48)),30) acquired");
            if (locked[0]?.acquired !== 1)
                throw new Error('Migration lock unavailable');
            migrationLocked=true;
            await connection.query('CREATE TABLE IF NOT EXISTS vnext_migrations(name VARCHAR(128) PRIMARY KEY,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
            const directory = new URL('../../migrations/', import.meta.url);
            for (const name of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) {
                if ((await rows(connection, 'SELECT name FROM vnext_migrations WHERE name=?', [name])).length)
                    continue;
                const sql = await readFile(new URL(name, directory), 'utf8');
                // MySQL DDL commits implicitly. A partially failed migration stops startup for operator repair.
                for (const statement of sql.split(';').map(value => value.trim()).filter(Boolean))
                    await connection.query(statement);
                if (name === '0002-lifecycle.sql') {
                    const history = await rows<{
                        node_id: string;
                        session_epoch: number;
                        valid_until: number;
                        body: unknown;
                    }>(connection, 'SELECT node_id,session_epoch,valid_until,body FROM snapshots');
                    for (const record of history) {
                        const snapshot = json<{
                            assignments: {
                                forwardId: string;
                                assignmentId: string;
                                deploymentGeneration: number;
                                bindingFence: number;
                            }[];
                        }>(record.body);
                        for (const a of snapshot.assignments)
                            await write(connection, 'INSERT INTO execution_leases(forward_id,node_id,assignment_id,deployment_generation,binding_fence,session_epoch,valid_until) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE valid_until=GREATEST(valid_until,VALUES(valid_until))', [a.forwardId, record.node_id, a.assignmentId, a.deploymentGeneration, a.bindingFence, record.session_epoch, record.valid_until]);
                    }
                }
                await write(connection, 'INSERT INTO vnext_migrations(name) VALUES(?)', [name]);
            }
        }
        finally {
            try{if(migrationLocked)await connection.query("SELECT RELEASE_LOCK(CONCAT('tunex:migrate:',LEFT(SHA2(DATABASE(),256),48)))");}finally{connection.release();}
        }
    }
    async close(): Promise<void> { await this.pool.end(); }
}
export function json<T>(value: unknown): T { return (typeof value === 'string' ? JSON.parse(value) : value) as T; }
