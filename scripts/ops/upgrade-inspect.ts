import { createHash } from 'node:crypto';
import { open, readdir } from 'node:fs/promises';
import { createConnection } from 'mysql2/promise';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import { isId, MAX_COUNTER } from '@tunex/core';
import { AuthorityStore, trustDigest } from '../../apps/control/src/infrastructure/authority.ts';
import { assessUpgrade, inspectSchema, parseUpgradePlan, schemaMarkers } from './upgrade.ts';
import type { DatabaseInspection } from './upgrade.ts';

export async function readUpgradeInput(path: string | URL, maximum = 1048576): Promise<string> {
    const file = await open(path, 'r');
    try {
        const info = await file.stat();
        if (!info.isFile() || info.size > maximum) throw new Error('UPGRADE_INPUT_LIMIT');
        const bytes = Buffer.alloc(maximum + 1);
        let length = 0;
        while (length < bytes.length) {
            const { bytesRead } = await file.read(bytes, length, bytes.length - length, null);
            if (!bytesRead) break;
            length += bytesRead;
        }
        if (length > maximum) throw new Error('UPGRADE_INPUT_LIMIT');
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length));
    } finally { await file.close(); }
}
export async function upgradeSchemaCatalog() {
    const root = new URL('../../apps/control/migrations/', import.meta.url);
    const names = (await readdir(root)).filter(n => n.endsWith('.sql')).sort();
    // New migrations require a deliberate compatibility-profile review.
    if (names.length !== 19 || names.at(-1) !== '0019-path-bindings.sql')
        throw new Error('UNREVIEWED_UPGRADE_SCHEMA');
    const files = await Promise.all(names.map(async name => {
        const sql = await readUpgradeInput(new URL(name, root));
        return { name, sql, sha256: createHash('sha256').update(sql).digest('hex') };
    }));
    return { files, markers: files.flatMap(f => schemaMarkers(f.name, f.sql)) };
}
async function query<T>(db: Connection, sql: string): Promise<T[]> {
    const [result] = await db.query<RowDataPacket[]>({ sql, timeout: 10000 });
    return result as T[];
}
function integer(value: unknown): number {
    const number = typeof value === 'string' && /^[0-9]+$/.test(value) ? Number(value) : value;
    if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < 0 || number > MAX_COUNTER)
        throw new Error('INVALID_DATABASE_COUNTER');
    return number;
}

/** No UnitOfWork/migrate, advisory locks, DDL, writes, or network calls to Agents. */
export async function inspectUpgradeDatabase(db: Connection, catalog: Awaited<ReturnType<typeof upgradeSchemaCatalog>>): Promise<DatabaseInspection> {
    await db.query({ sql: 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ', timeout: 10000 });
    await db.query({ sql: 'START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY', timeout: 10000 });
    try {
        const [metadata] = await query<{ binding: string; mysqlVersion: string }>(db,
            "SELECT CONCAT(@@server_uuid,':',DATABASE()) binding,VERSION() mysqlVersion");
        if (!metadata || typeof metadata.binding !== 'string' || metadata.binding.length > 128 ||
            typeof metadata.mysqlVersion !== 'string' || metadata.mysqlVersion.length > 128)
            throw new Error('INVALID_DATABASE_METADATA');
        const columns = await query<{ table: string; column: string; type: string }>(db,
            'SELECT TABLE_NAME AS `table`,COLUMN_NAME AS `column`,COLUMN_TYPE AS `type` FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,COLUMN_NAME LIMIT 10001');
        if (columns.length > 10000 || columns.some(c => ['Tunnel', 'Forward', 'User', '_prisma_migrations'].includes(c.table)))
            throw new Error('UNSUPPORTED_UPGRADE_DATABASE');
        const migrations = (await query<{ name: string }>(db, 'SELECT name FROM vnext_migrations ORDER BY name LIMIT 101')).map(m => m.name);
        if (migrations.length > 100 || migrations.some(m => typeof m !== 'string' || !/^[0-9]{4}-[a-z0-9-]+\.sql$/.test(m)))
            throw new Error('INVALID_MIGRATION_HISTORY');
        const schemaIssues = inspectSchema(migrations, catalog.markers, columns);
        const hasTable = (name: string) => columns.some(c => c.table === name);
        const rawNodes = hasTable('nodes') && hasTable('runtime_nodes') && hasTable('snapshots') ?
            await query<{ nodeId: string; generation: unknown; snapshotDigest: string | null }>(db,
                "SELECT n.id nodeId,COALESCE(r.snapshot_generation,0) generation,JSON_UNQUOTE(JSON_EXTRACT(s.body,'$.snapshotDigest')) snapshotDigest FROM nodes n LEFT JOIN runtime_nodes r ON r.node_id=n.id LEFT JOIN snapshots s ON s.node_id=n.id AND s.generation=r.snapshot_generation ORDER BY n.id LIMIT 1001") : [];
        if (rawNodes.length > 1000) throw new Error('UPGRADE_NODE_INVENTORY_LIMIT');
        const nodes = rawNodes.map(n => {
            const generation = integer(n.generation);
            if (!isId(n.nodeId) || generation > 0 && (typeof n.snapshotDigest !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(n.snapshotDigest)))
                throw new Error('INVALID_DATABASE_NODE_HISTORY');
            return { nodeId: n.nodeId, generation, snapshotDigest: n.snapshotDigest };
        });
        const [protocols] = hasTable('snapshots') ? await query<{ n: unknown }>(db,
            "SELECT COUNT(*) n FROM snapshots WHERE JSON_EXTRACT(body,'$.protocolVersion') IS NULL OR JSON_TYPE(JSON_EXTRACT(body,'$.protocolVersion'))<>'INTEGER' OR JSON_EXTRACT(body,'$.protocolVersion')<>3 OR (JSON_EXTRACT(body,'$.executionExtension') IS NOT NULL AND (JSON_TYPE(JSON_EXTRACT(body,'$.executionExtension'))<>'INTEGER' OR JSON_EXTRACT(body,'$.executionExtension')<>1))") : [{ n: 0 }];
        const [leases] = hasTable('execution_leases') ? await query<{ until: unknown }>(db,
            'SELECT MAX(bound) until FROM (SELECT MAX(valid_until) bound FROM execution_leases UNION ALL SELECT MAX(valid_until) bound FROM snapshots) authorization_bounds') : [{ until: null }];
        const [paths] = columns.some(c => c.table === 'relay_deployments' && c.column === 'path_nodes') ?
            await query<{ n: unknown }>(db, "SELECT COUNT(*) n FROM relay_deployments WHERE path_nodes IS NOT NULL AND stage<>'withdrawn'") : [{ n: 0 }];
        const [intents] = hasTable('forwards') ? await query<{ n: unknown }>(db,
            "SELECT COUNT(*) n FROM forwards WHERE deleting=FALSE AND JSON_EXTRACT(spec,'$.enabled')=TRUE AND JSON_LENGTH(JSON_EXTRACT(spec,'$.path.via'))>1") : [{ n: 0 }];
        // InnoDB snapshots do not make concurrent DDL atomic. Detect visible metadata changes too.
        const after = await query<{ table: string; column: string; type: string }>(db,
            'SELECT TABLE_NAME AS `table`,COLUMN_NAME AS `column`,COLUMN_TYPE AS `type` FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,COLUMN_NAME LIMIT 10001');
        if (JSON.stringify(columns) !== JSON.stringify(after)) throw new Error('UPGRADE_SCHEMA_CHANGED_RETRY');
        return { ...metadata, migrations, schemaIssues, nodes,
            unsupportedSnapshots: integer(protocols!.n), multihopDeployments: integer(paths!.n),
            enabledMultihopForwards: integer(intents!.n),
            latestLeaseUntil: leases!.until === null ? null : integer(leases!.until) };
    } finally { await db.rollback(); }
}

export async function runUpgradeAssessment(options: {
    planPath: string; databaseUrl: string; stateDirectory: string; caPath: string;
}) {
    const plan = parseUpgradePlan(await readUpgradeInput(options.planPath));
    const catalog = await upgradeSchemaCatalog();
    const authority = new AuthorityStore(options.stateDirectory), before = await authority.read();
    const ca = trustDigest(await readUpgradeInput(options.caPath, 65536));
    const db = await createConnection({ uri: options.databaseUrl, connectTimeout: 10000,
        supportBigNumbers: true, bigNumberStrings: true });
    try {
        const database = await inspectUpgradeDatabase(db, catalog);
        const after = await authority.read();
        return assessUpgrade(plan, {
            database, authority: after, authorityStable: before.sequence === after.sequence,
            trustMatches: ca === after.trustDigest,
            schemaFiles: catalog.files.map(({ name, sha256 }) => ({ name, sha256 })),
        });
    } finally { await db.end(); }
}
