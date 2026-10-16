import { isId, MAX_COUNTER } from '@tunex/core';
import { parseJson } from '@tunex/contracts';
import type { AuthorityRecord } from '../../apps/control/src/infrastructure/authority.ts';

export type CompatibilityProfile = 'adp3-runtime-v1' | 'adp3-multihop-v1';
interface Build {
    revision: string;
    imageDigest: string;
    profile: CompatibilityProfile;
}
interface Release { control: Build; agent: Build }
export interface JournalInspection {
    version: 1;
    nodeId: string;
    protocolVersion: 3;
    executionExtension: 0 | 1;
    generation: number;
    snapshotDigest: string;
    fileDigest: string;
    maxBindingFence: number;
    maxRetiredFence: number;
    importedTransit: boolean;
}
export interface UpgradePlan {
    version: 1;
    operation: 'upgrade' | 'rollback' | 'recover';
    source: Release;
    target: Release;
    controlMultihop: boolean;
    agentMultihop: boolean;
    journals: JournalInspection[];
}
export interface SchemaMarker { migration: string; table: string; column?: string; enumType?: string }
export interface DatabaseInspection {
    binding: string;
    mysqlVersion: string;
    migrations: string[];
    schemaIssues: string[];
    nodes: { nodeId: string; generation: number; snapshotDigest: string | null }[];
    unsupportedSnapshots: number;
    multihopDeployments: number;
    enabledMultihopForwards: number;
    latestLeaseUntil: number | null;
}
export interface UpgradeInspection {
    database: DatabaseInspection;
    authority: AuthorityRecord;
    authorityStable: boolean;
    trustMatches: boolean;
    schemaFiles: { name: string; sha256: string }[];
}
type Check = { code: string; status: 'pass' | 'block' | 'review'; subject: string };
const sha = /^[a-f0-9]{40}$/;
const digest = /^sha256:[a-f0-9]{64}$/;
const profiles = new Set<CompatibilityProfile>(['adp3-runtime-v1', 'adp3-multihop-v1']);
const migrationName = /^[0-9]{4}-[a-z0-9-]+\.sql$/;
const invalid = (): never => { throw new Error('INVALID_UPGRADE_PLAN'); };
function object(value: unknown, keys: string[]): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).sort().join(',') !== keys.sort().join(',')) invalid();
    return value as Record<string, unknown>;
}
function counter(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MAX_COUNTER;
}
function build(value: unknown): Build {
    const v = object(value, ['revision', 'imageDigest', 'profile']);
    if (typeof v.revision !== 'string' || !sha.test(v.revision) ||
        typeof v.imageDigest !== 'string' || !digest.test(v.imageDigest) ||
        !profiles.has(v.profile as CompatibilityProfile)) invalid();
    return v as unknown as Build;
}
function release(value: unknown): Release {
    const v = object(value, ['control', 'agent']);
    return { control: build(v.control), agent: build(v.agent) };
}
export function parseUpgradePlan(raw: string): UpgradePlan {
    const v = object(parseJson(raw, 1048576), ['version', 'operation', 'source', 'target',
        'controlMultihop', 'agentMultihop', 'journals']);
    if (v.version !== 1 || !['upgrade', 'rollback', 'recover'].includes(v.operation as string) ||
        typeof v.controlMultihop !== 'boolean' || typeof v.agentMultihop !== 'boolean' ||
        !Array.isArray(v.journals) || v.journals.length > 1000) invalid();
    const source = release(v.source), target = release(v.target), seen = new Set<string>();
    for (const journal of v.journals as unknown[]) {
        const j = object(journal, ['version', 'nodeId', 'protocolVersion', 'executionExtension',
            'generation', 'snapshotDigest', 'fileDigest', 'maxBindingFence', 'maxRetiredFence', 'importedTransit']);
        if (j.version !== 1 || typeof j.nodeId !== 'string' || !isId(j.nodeId) || seen.has(j.nodeId) || j.protocolVersion !== 3 ||
            ![0, 1].includes(j.executionExtension as number) || !counter(j.generation) ||
            typeof j.snapshotDigest !== 'string' || (j.generation === 0 ? j.snapshotDigest !== '' : !digest.test(j.snapshotDigest)) ||
            typeof j.fileDigest !== 'string' || !digest.test(j.fileDigest) ||
            !counter(j.maxBindingFence) || !counter(j.maxRetiredFence) ||
            typeof j.importedTransit !== 'boolean' || j.importedTransit && j.executionExtension !== 1) invalid();
        seen.add(j.nodeId as string);
    }
    return { ...v, source, target } as unknown as UpgradePlan;
}

/** Footprints detect interrupted known DDL; this is not a full schema equivalence proof. */
export function schemaMarkers(migration: string, sql: string): SchemaMarker[] {
    const markers: SchemaMarker[] = [];
    if (!migrationName.test(migration)) throw new Error('UNKNOWN_MIGRATION_FILE');
    for (const match of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?([a-z_]+)\s*\(/g))
        markers.push({ migration, table: match[1]! });
    for (const match of sql.matchAll(/ALTER TABLE ([a-z_]+)([^;]+);/g)) {
        for (const column of match[2]!.matchAll(/ADD COLUMN ([a-z_]+)/g))
            markers.push({ migration, table: match[1]!, column: column[1]! });
        for (const column of match[2]!.matchAll(/MODIFY ([a-z_]+) (ENUM\([^)]*\))/g))
            markers.push({ migration, table: match[1]!, column: column[1]!, enumType: column[2]!.toLowerCase() });
    }
    if (!markers.length) throw new Error('UNREVIEWED_MIGRATION_FILE');
    return markers;
}
export function inspectSchema(migrations: string[], catalog: SchemaMarker[],
    columns: { table: string; column: string; type: string }[]): string[] {
    const issues = new Set<string>(), applied = new Set(migrations);
    const tables = new Set(columns.map(c => c.table));
    for (const marker of catalog) {
        const exists = marker.column ? columns.some(c => c.table === marker.table && c.column === marker.column) : tables.has(marker.table);
        if (marker.enumType) continue;
        if (applied.has(marker.migration) !== exists) issues.add(marker.migration);
    }
    for (const key of new Set(catalog.filter(c => c.enumType).map(c => `${c.table}.${c.column}`))) {
        const changes = catalog.filter(c => c.enumType && `${c.table}.${c.column}` === key);
        const expected = changes.filter(c => applied.has(c.migration)).at(-1);
        const actual = columns.find(c => `${c.table}.${c.column}` === key)?.type.toLowerCase();
        if (expected && actual !== expected.enumType) issues.add(expected.migration);
        else if (!expected && changes.some(c => c.enumType === actual)) issues.add(changes[0]!.migration);
    }
    return [...issues].sort();
}

export function assessUpgrade(plan: UpgradePlan, inspection: UpgradeInspection) {
    const checks: Check[] = [];
    const add = (code: string, status: Check['status'], subject = 'deployment') => checks.push({ code, status, subject });
    const { database: db, authority: a, schemaFiles } = inspection;
    const known = schemaFiles.map(f => f.name), applied = db.migrations;
    const prefix = applied.length > 0 && applied.length <= known.length &&
        applied.every((name, i) => name === known[i]);
    add('MIGRATION_HISTORY', prefix ? 'pass' : 'block', 'database');
    add('MYSQL_BASELINE', /^8\.4\.[0-9]+(?:[-+.]|$)/.test(db.mysqlVersion) ? 'pass' : 'block', 'database');
    add('SCHEMA_FOOTPRINTS', db.schemaIssues.length ? 'block' : 'pass', 'database');
    add('AUTHORITY_BINDING', a.database === db.binding ? 'pass' : 'block', 'authority');
    add('TRUST_BINDING', inspection.trustMatches ? 'pass' : 'block', 'authority');
    add('AUTHORITY_OBSERVATION_STABLE', inspection.authorityStable ? 'pass' : 'review', 'authority');
    add('AUTHORIZATION_UPPER_BOUND', (db.latestLeaseUntil ?? 0) <= (a.latestValidUntil ?? 0) ? 'pass' : 'block', 'authority');
    add('PERSISTED_PROTOCOL', db.unsupportedSnapshots ? 'block' : 'pass', 'database');
    for (const [side, build] of [['source', plan.source.control], ['target', plan.target.control]] as const) {
        const ceiling = build.profile === 'adp3-runtime-v1' ? '0012-' : '0013-';
        add('CONTROL_SCHEMA_READER', applied.some(m => m.slice(0, 5) > ceiling) ? 'block' : 'pass', side);
    }
    const targetMigration = plan.target.control.profile === 'adp3-runtime-v1' ? '0012-' : '0013-';
    const pending = prefix ? known.filter(m => m.slice(0, 5) <= targetMigration && !applied.includes(m)) : [];
    if (pending.length) add('DDL_MAINTENANCE_REQUIRED', 'review', 'database');
    if (plan.controlMultihop && (plan.target.control.profile !== 'adp3-multihop-v1' ||
        plan.target.agent.profile !== 'adp3-multihop-v1' || !plan.agentMultihop))
        add('MULTIHOP_EXECUTOR_REQUIRED', 'block');
    if (!plan.controlMultihop && (db.multihopDeployments > 0 || db.enabledMultihopForwards > 0))
        add('MULTIHOP_WITHDRAWAL_REQUIRED', 'block');
    const nodes = new Map(db.nodes.map(n => [n.nodeId, n]));
    for (const journal of plan.journals) {
        const node = nodes.get(journal.nodeId);
        if (!node) { add('JOURNAL_NODE_NOT_IN_DATABASE', 'block', journal.nodeId); continue; }
        nodes.delete(journal.nodeId);
        add('CONTROL_HISTORY_NOT_BEHIND_AGENT', journal.generation > node.generation ? 'block' : 'pass', journal.nodeId);
        if (journal.generation > 0 && journal.generation === node.generation)
            add('SNAPSHOT_HISTORY_DIGEST', journal.snapshotDigest === node.snapshotDigest ? 'pass' : 'block', journal.nodeId);
        if (journal.executionExtension === 1 && plan.source.agent.profile === 'adp3-runtime-v1')
            add('SOURCE_JOURNAL_PROFILE_MISMATCH', 'block', journal.nodeId);
        if (journal.executionExtension === 1 && (plan.target.agent.profile !== 'adp3-multihop-v1' || !plan.agentMultihop))
            add('JOURNAL_DOWNGRADE_FORBIDDEN', 'block', journal.nodeId);
        if (journal.executionExtension === 0 && plan.agentMultihop)
            add('EXPLICIT_JOURNAL_MIGRATION_REQUIRED', 'review', journal.nodeId);
    }
    for (const nodeId of nodes.keys()) add('JOURNAL_INVENTORY_MISSING', 'review', nodeId);
    if (plan.agentMultihop && plan.target.agent.profile !== 'adp3-multihop-v1')
        add('AGENT_EXECUTION_EXTENSION_UNSUPPORTED', 'block');
    if (plan.operation === 'rollback') add('ROLLBACK_REVIEW_REQUIRED', 'review');
    if (plan.operation === 'recover') {
        add('RECOVERY_MAINTENANCE', a.maintenance ? 'pass' : 'block', 'authority');
        add('RECOVERY_WORKFLOW_REQUIRED', 'review', 'authority');
    } else if (a.maintenance) add(a.recoveryId ? 'RECOVERY_REVIEW_REQUIRED' : 'MAINTENANCE_ACTIVE', 'review', 'authority');
    const decision = checks.some(c => c.status === 'block') ? 'blocked' :
        checks.some(c => c.status === 'review') ? 'review-required' : 'compatible';
    return {
        version: 1, scope: 'read-only-compatibility', decision,
        runtimeReady: false, productionApproved: false, operation: plan.operation,
        source: plan.source, target: plan.target, identitySource: 'operator-declared',
        database: { mysqlVersion: db.mysqlVersion, migrations: applied, schemaFiles,
            pendingMigrations: pending, schemaIssues: db.schemaIssues, latestLeaseUntil: db.latestLeaseUntil,
            multihopDeployments: db.multihopDeployments, enabledMultihopForwards: db.enabledMultihopForwards },
        authority: { sequence: a.sequence, maintenance: a.maintenance,
            latestValidUntil: a.latestValidUntil, maxClockSkewSeconds: a.maxClockSkewSeconds },
        journals: plan.journals, checks,
        backupResponsibilities: [
            { owner: 'database-operator', material: 'SQL and authenticated backup manifest', rule: 'Use existing backup/restore; preserve all runtime and multihop ledgers' },
            { owner: 'control-operator', material: 'Authority state and separate MAC key; CA and private keys', rule: 'Protect independently; never initialize old identities from zero' },
            { owner: 'agent-operator', material: 'Each original Runtime/Transit Journal, separate MAC key and Node credentials', rule: 'Preserve physical high-water, even after disabling multihop' },
        ],
        unchecked: ['image-and-binary-identity', 'journal-export-origin-and-freshness', 'backup-existence-and-integrity',
            'full-schema-equivalence-and-data-backfills', 'control-agent-fence-equivalence',
            'all-issuers-stopped', 'trusted-clock-and-lease-exhaustion',
            'atomic-multi-host-snapshot', 'network-and-runtime-health'],
        requiredActions: decision === 'blocked' ? ['Resolve blocking checks; do not start the target or reset protected state'] :
            ['Review unchecked evidence and backups', ...(pending.length ? ['Stop issuers for reviewed DDL; never blindly retry partial migrations'] : []),
                ...(plan.operation === 'recover' ? ['Use existing maintenance/backup/restore/review/resume workflow with fresh trust; assessment grants no recovery permission'] :
                    ['Start only after operator approval; execution requires a fresh authenticated online session'])],
    };
}
