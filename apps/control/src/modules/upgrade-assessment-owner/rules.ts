import { isId, MAX_COUNTER } from '@tunex/core';
import { nativeUpgradeParseJson, nativeUpgradeFormat } from '../../compatibility/public.ts';
import type { CompatibilityProfile, UpgradePlan, UpgradeInspection } from './contracts.ts';
import type { Build, Release } from './internal-contracts.ts';

type Check = { code: string; status: 'pass' | 'block' | 'review'; subject: string };
const profiles = new Set<CompatibilityProfile>(['adp3-runtime-v1', 'adp3-multihop-v1', 'adp3-probe-registry-v1', 'adp3-probe-permits-v1', 'adp3-probe-withdrawals-v1', 'adp3-probe-results-v1', 'adp3-path-templates-v1', 'adp3-path-bindings-v1', 'adp3-node-telemetry-v1', 'adp3-forward-telemetry-v1', 'adp3-host-telemetry-v1', 'adp3-probe-telemetry-v1', 'adp3-telemetry-rollups-v1', 'adp3-path-groups-v1', 'adp3-path-publications-v1', 'adp3-ingress-groups-v1', 'adp3-ingress-migrations-v1', 'adp3-station-alerts-v1', 'adp3-notification-endpoints-v1', 'adp3-notification-deliveries-v1', 'adp3-probe-runs-v1', 'adp3-probe-plans-v1']);
const controlSchemaCeiling: Record<CompatibilityProfile, string> = {
    'adp3-runtime-v1': '0012-', 'adp3-multihop-v1': '0013-', 'adp3-probe-registry-v1': '0014-',
    'adp3-probe-permits-v1': '0015-',
    'adp3-probe-withdrawals-v1': '0016-',
    'adp3-probe-results-v1': '0017-',
    'adp3-path-templates-v1': '0018-',
    'adp3-path-bindings-v1': '0019-',
    'adp3-node-telemetry-v1': '0020-',
    'adp3-forward-telemetry-v1': '0021-',
    'adp3-host-telemetry-v1': '0022-',
    'adp3-probe-telemetry-v1': '0023-',
    'adp3-telemetry-rollups-v1': '0024-',
    'adp3-path-groups-v1': '0025-',
    'adp3-path-publications-v1': '0026-',
    'adp3-ingress-groups-v1': '0027-',
    'adp3-ingress-migrations-v1': '0028-',
    'adp3-station-alerts-v1': '0029-',
    'adp3-notification-endpoints-v1': '0030-',
    'adp3-notification-deliveries-v1': '0031-',
    'adp3-probe-runs-v1': '0032-',
    'adp3-probe-plans-v1': '0033-',
    'adp3-typed-probes-v1': '0034-',
    'adp3-observation-services-v1': '0035-',
    'adp3-probe-services-v1': '0036-',
    'adp3-probe-echo-v1': '0037-',
};
profiles.add('adp3-typed-probes-v1');
profiles.add('adp3-observation-services-v1');
profiles.add('adp3-probe-services-v1');
profiles.add('adp3-probe-echo-v1');
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
    if (typeof v.revision !== 'string' || !nativeUpgradeFormat.revision(v.revision) ||
        typeof v.imageDigest !== 'string' || !nativeUpgradeFormat.digest(v.imageDigest) ||
        !profiles.has(v.profile as CompatibilityProfile)) invalid();
    return v as unknown as Build;
}
function release(value: unknown): Release {
    const v = object(value, ['control', 'agent']);
    const control = build(v.control), agent = build(v.agent);
    if (agent.profile !== 'adp3-runtime-v1' && agent.profile !== 'adp3-multihop-v1') invalid();
    return { control, agent };
}
export function parseUpgradePlan(raw: string): UpgradePlan {
    const v = object(nativeUpgradeParseJson(raw, 1048576), ['version', 'operation', 'source', 'target',
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
            typeof j.snapshotDigest !== 'string' || (j.generation === 0 ? j.snapshotDigest !== '' : !nativeUpgradeFormat.digest(j.snapshotDigest)) ||
            typeof j.fileDigest !== 'string' || !nativeUpgradeFormat.digest(j.fileDigest) ||
            !counter(j.maxBindingFence) || !counter(j.maxRetiredFence) ||
            typeof j.importedTransit !== 'boolean' || j.importedTransit && j.executionExtension !== 1) invalid();
        seen.add(j.nodeId as string);
    }
    return { ...v, source, target } as unknown as UpgradePlan;
}

export function assessUpgrade(plan: UpgradePlan, inspection: UpgradeInspection) {
    const checks: Check[] = [];
    const add = (code: string, status: Check['status'], subject = 'deployment') => checks.push({ code, status, subject });
    const { database: db, authority: a, schemaFiles } = inspection;
    const known = schemaFiles.map(f => f.name), applied = db.migrations;
    const prefix = applied.length > 0 && applied.length <= known.length &&
        applied.every((name, i) => name === known[i]);
    add('MIGRATION_HISTORY', prefix ? 'pass' : 'block', 'database');
    add('MYSQL_BASELINE', nativeUpgradeFormat.mysqlBaseline(db.mysqlVersion) ? 'pass' : 'block', 'database');
    add('SCHEMA_FOOTPRINTS', db.schemaIssues.length ? 'block' : 'pass', 'database');
    add('AUTHORITY_BINDING', a.database === db.binding ? 'pass' : 'block', 'authority');
    add('TRUST_BINDING', inspection.trustMatches ? 'pass' : 'block', 'authority');
    add('AUTHORITY_OBSERVATION_STABLE', inspection.authorityStable ? 'pass' : 'review', 'authority');
    add('AUTHORIZATION_UPPER_BOUND', (db.latestLeaseUntil ?? 0) <= (a.latestValidUntil ?? 0) ? 'pass' : 'block', 'authority');
    add('PERSISTED_PROTOCOL', db.unsupportedSnapshots ? 'block' : 'pass', 'database');
    for (const [side, build] of [['source', plan.source.control], ['target', plan.target.control]] as const) {
        const ceiling = controlSchemaCeiling[build.profile];
        add('CONTROL_SCHEMA_READER', applied.some(m => m.slice(0, 5) > ceiling) ? 'block' : 'pass', side);
    }
    const targetMigration = controlSchemaCeiling[plan.target.control.profile];
    const pending = prefix ? known.filter(m => m.slice(0, 5) <= targetMigration && !applied.includes(m)) : [];
    if (pending.length) add('DDL_MAINTENANCE_REQUIRED', 'review', 'database');
    if (plan.controlMultihop && (plan.target.control.profile === 'adp3-runtime-v1' ||
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
