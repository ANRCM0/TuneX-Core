import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { assessUpgrade, inspectSchema, parseUpgradePlan, schemaMarkers } from '../../../scripts/ops/upgrade.ts';
import type { UpgradeInspection, UpgradePlan } from '../../../scripts/ops/upgrade.ts';
import { upgradeSchemaCatalog } from '../../../scripts/ops/upgrade-inspect.ts';

const hash = 'sha256:' + 'a'.repeat(64);
function fixture(): { plan: UpgradePlan; inspection: UpgradeInspection } {
    const build = { revision: 'a'.repeat(40), imageDigest: hash, profile: 'adp3-multihop-v1' as const };
    const names = ['0001-phase1.sql', '0002-lifecycle.sql', '0003-node-security.sql', '0004-access-management.sql',
        '0005-recovery-quarantine.sql', '0006-transport-profiles.sql', '0007-relay-authorization.sql',
        '0008-relay-credentials.sql', '0009-relay-deployments.sql', '0010-transit-staging.sql',
        '0011-transit-coordination.sql', '0012-transit-delivery.sql', '0013-multihop-execution.sql'];
    return {
        plan: { version: 1, operation: 'upgrade', source: { control: { ...build }, agent: { ...build } },
            target: { control: { ...build }, agent: { ...build } }, controlMultihop: false, agentMultihop: true,
            journals: [{ version: 1, nodeId: 'node-a', protocolVersion: 3, executionExtension: 1,
                generation: 9, snapshotDigest: hash, fileDigest: hash,
                maxBindingFence: 12, maxRetiredFence: 11, importedTransit: false }] },
        inspection: {
            database: { binding: 'server:database', mysqlVersion: '8.4.9', migrations: names,
                schemaIssues: [], nodes: [{ nodeId: 'node-a', generation: 9, snapshotDigest: hash }],
                unsupportedSnapshots: 0, multihopDeployments: 0, enabledMultihopForwards: 0, latestLeaseUntil: 1000 },
            authority: { version: 1, sequence: 12, database: 'server:database', trustDigest: hash,
                maintenance: false, latestValidUntil: 1001, maxLeaseSeconds: 18, maxClockSkewSeconds: 5,
                maintenanceSince: null, recoveryId: null },
            authorityStable: true, trustMatches: true, schemaFiles: names.map(name => ({ name, sha256: 'b'.repeat(64) })),
        },
    };
}
function result(change: (f: ReturnType<typeof fixture>) => void) {
    const f = fixture(); change(f);
    return assessUpgrade(parseUpgradePlan(JSON.stringify(f.plan)), f.inspection);
}
test('compatible static assessment is not execution, recovery, backup or production approval', () => {
    const f = fixture(), before = JSON.stringify(f);
    const report = assessUpgrade(parseUpgradePlan(JSON.stringify(f.plan)), f.inspection);
    assert.equal(report.decision, 'compatible');
    assert.equal(report.runtimeReady, false);
    assert.equal(report.productionApproved, false);
    assert.equal(report.identitySource, 'operator-declared');
    assert.ok(report.unchecked.includes('backup-existence-and-integrity'));
    assert.ok(report.unchecked.includes('atomic-multi-host-snapshot'));
    assert.equal(JSON.stringify(f), before);
});
test('new Control supports unmigrated old Agents when multihop remains off', () => {
    const report = result(f => {
        f.plan.source.agent.profile = f.plan.target.agent.profile = 'adp3-runtime-v1';
        f.plan.agentMultihop = false; f.plan.journals[0]!.executionExtension = 0;
    });
    assert.equal(report.decision, 'compatible');
});
test('old schema upgrade requires reviewed DDL and explicit journal migration', () => {
    const report = result(f => {
        f.inspection.database.migrations.pop();
        f.plan.source.control.profile = 'adp3-runtime-v1';
        f.plan.source.agent.profile = 'adp3-runtime-v1';
        f.plan.journals[0]!.executionExtension = 0;
        f.plan.controlMultihop = true;
    });
    assert.equal(report.decision, 'review-required');
    assert.deepEqual(report.database.pendingMigrations, ['0013-multihop-execution.sql']);
    assert.ok(report.checks.some(c => c.code === 'EXPLICIT_JOURNAL_MIGRATION_REQUIRED'));
});
test('old Control and Agent are compatible only with their old schema/journal boundary', () => {
    const report = result(f => {
        f.inspection.database.migrations.pop();
        for (const release of [f.plan.source, f.plan.target])
            release.control.profile = release.agent.profile = 'adp3-runtime-v1';
        f.plan.agentMultihop = false; f.plan.journals[0]!.executionExtension = 0;
    });
    assert.equal(report.decision, 'compatible');
});
test('turning off Control multihop never permits downgrading an extended journal', () => {
    for (const mode of ['old-binary', 'flag-off'] as const) {
        const report = result(f => {
            f.plan.operation = 'rollback';
            if (mode === 'old-binary') f.plan.target.agent.profile = 'adp3-runtime-v1';
            else f.plan.agentMultihop = false;
        });
        assert.equal(report.decision, 'blocked');
        assert.ok(report.checks.some(c => c.code === 'JOURNAL_DOWNGRADE_FORBIDDEN' && c.status === 'block'));
    }
});
test('old Control cannot read new schema, even for a rollback or recovery', () => {
    for (const operation of ['upgrade', 'rollback', 'recover'] as const) {
        const report = result(f => { f.plan.operation = operation; f.plan.target.control.profile = 'adp3-runtime-v1'; });
        assert.equal(report.decision, 'blocked');
        assert.ok(report.checks.some(c => c.code === 'CONTROL_SCHEMA_READER' && c.subject === 'target' && c.status === 'block'));
    }
});
test('same identity old database and same-generation conflicting history are blocked', () => {
    for (const change of [
        (f: ReturnType<typeof fixture>) => { f.inspection.database.nodes[0]!.generation = 8; },
        (f: ReturnType<typeof fixture>) => { f.inspection.database.nodes[0]!.snapshotDigest = 'sha256:' + 'c'.repeat(64); },
        (f: ReturnType<typeof fixture>) => { f.inspection.database.latestLeaseUntil = 1002; },
    ]) assert.equal(result(change).decision, 'blocked');
});
test('missing journals and changing Authority demand review; foreign journals are blocked', () => {
    assert.equal(result(f => { f.plan.journals = []; }).decision, 'review-required');
    assert.equal(result(f => { f.inspection.authorityStable = false; }).decision, 'review-required');
    assert.equal(result(f => { f.plan.journals[0]!.nodeId = 'foreign'; }).decision, 'blocked');
});
test('invalid schema history, trust, protocol, SQL baseline and partial DDL fail closed', () => {
    const changes = [
        (f: ReturnType<typeof fixture>) => { f.inspection.database.migrations.splice(3, 1); },
        (f: ReturnType<typeof fixture>) => { f.inspection.database.migrations.push('0014-unknown.sql'); },
        (f: ReturnType<typeof fixture>) => { f.inspection.database.migrations = []; },
        (f: ReturnType<typeof fixture>) => { f.inspection.database.schemaIssues = ['0013-multihop-execution.sql']; },
        (f: ReturnType<typeof fixture>) => { f.inspection.database.unsupportedSnapshots = 1; },
        (f: ReturnType<typeof fixture>) => { f.inspection.database.mysqlVersion = '8.0.36'; },
        (f: ReturnType<typeof fixture>) => { f.inspection.trustMatches = false; },
        (f: ReturnType<typeof fixture>) => { f.inspection.authority.database = 'server:old'; },
    ];
    for (const change of changes) assert.equal(result(change).decision, 'blocked');
});
test('multihop admission and withdrawal require matching execution support and state', () => {
    assert.equal(result(f => { f.plan.controlMultihop = true; f.plan.agentMultihop = false; }).decision, 'blocked');
    assert.equal(result(f => { f.inspection.database.multihopDeployments = 1; }).decision, 'blocked');
    assert.equal(result(f => { f.inspection.database.enabledMultihopForwards = 1; }).decision, 'blocked');
});
test('recovery always requires the existing reviewed workflow, regardless of wall time', () => {
    assert.equal(result(f => { f.plan.operation = 'recover'; }).decision, 'blocked');
    const report = result(f => {
        f.plan.operation = 'recover'; f.inspection.authority.maintenance = true;
        f.inspection.authority.latestValidUntil = Date.now() + 300000;
    });
    assert.equal(report.decision, 'review-required');
    assert.ok(report.unchecked.includes('trusted-clock-and-lease-exhaustion'));
    assert.equal(report.authority.latestValidUntil! > Date.now(), true);
    assert.equal(result(f => { f.plan.operation = 'rollback'; }).decision, 'review-required');
});
test('plan parsing rejects duplicates, unknown fields, unsafe counters, legacy protocols and tags', () => {
    const raw = JSON.stringify(fixture().plan);
    assert.throws(() => parseUpgradePlan(raw.replace('"version":1', '"version":1,"version":1')));
    const changes = [
        (v: any) => { v.source.control.imageDigest = 'ghcr.io/owner/control:latest'; },
        (v: any) => { v.target.agent.profile = 'unknown'; },
        (v: any) => { v.journals.push(v.journals[0]); },
        (v: any) => { v.journals[0].protocolVersion = 2; },
        (v: any) => { v.journals[0].generation = Number.MAX_SAFE_INTEGER + 1; },
        (v: any) => { v.journals[0].token = 'never-export-secrets'; },
        (v: any) => { v.journals[0].fileDigest = 'unknown'; },
        (v: any) => { v.journals = Array(1001).fill(v.journals[0]); },
    ];
    for (const change of changes) {
        const value = JSON.parse(raw); change(value);
        assert.throws(() => parseUpgradePlan(JSON.stringify(value)));
    }
});
test('known migration footprints cover tables, multi-column DDL and superseded enums', async () => {
    const catalog = await upgradeSchemaCatalog();
    assert.equal(catalog.files.length, 18);
    assert.ok(catalog.markers.some(m => m.migration === '0018-path-templates.sql' && m.table === 'path_templates'));
    assert.ok(catalog.markers.some(m => m.migration === '0018-path-templates.sql' && m.table === 'path_template_revisions'));
    assert.ok(catalog.markers.some(m => m.migration === '0018-path-templates.sql' && m.table === 'path_template_events'));
    assert.ok(catalog.markers.some(m => m.migration === '0017-probe-results.sql' && m.table === 'probe_results'));
    assert.ok(catalog.markers.some(m => m.migration === '0015-probe-permits.sql' && m.table === 'probe_permits'));
    assert.ok(catalog.markers.some(m => m.migration === '0015-probe-permits.sql' && m.table === 'probe_permit_budget'));
    assert.ok(catalog.markers.some(m => m.migration === '0016-probe-permit-withdrawals.sql' && m.table === 'probe_permit_withdrawals'));
    assert.ok(catalog.markers.some(m => m.migration === '0014-probe-instances.sql' && m.table === 'probe_instances'));
    assert.ok(catalog.markers.some(m => m.column === 'activated_count'));
    const migration = '0002-example.sql';
    const markers = schemaMarkers(migration,
        "ALTER TABLE a ADD COLUMN b INT, ADD COLUMN c INT; CREATE TABLE d (id INT); ALTER TABLE a MODIFY kind ENUM('x','y') NOT NULL;");
    assert.deepEqual(inspectSchema([], markers, []), []);
    assert.deepEqual(inspectSchema([], markers, [{ table: 'a', column: 'b', type: 'int' }]), [migration]);
    const columns = [{ table: 'a', column: 'b', type: 'int' }, { table: 'a', column: 'c', type: 'int' },
        { table: 'd', column: 'id', type: 'int' }, { table: 'a', column: 'kind', type: "enum('x','y')" }];
    assert.deepEqual(inspectSchema([migration], markers, columns), []);
    assert.deepEqual(inspectSchema([migration], markers, columns.slice(1)), [migration]);
    const newer = '0003-new.sql', all = [...markers, ...schemaMarkers(newer, "ALTER TABLE a MODIFY kind ENUM('x','y','z') NOT NULL;")];
    columns[3]!.type = "enum('x','y','z')";
    assert.deepEqual(inspectSchema([migration, newer], all, columns), []);
    assert.deepEqual(inspectSchema([migration], all, columns), [migration]);
});
test('Probe registry DDL has an explicit Control-only reader ceiling and cannot silently downgrade', () => {
    const f = fixture(), migration = '0014-probe-instances.sql';
    f.inspection.schemaFiles.push({ name: migration, sha256: 'c'.repeat(64) });
    f.plan.target.control.profile = 'adp3-probe-registry-v1';
    let report = assessUpgrade(parseUpgradePlan(JSON.stringify(f.plan)), f.inspection);
    assert.equal(report.decision, 'review-required');
    assert.deepEqual(report.database.pendingMigrations, [migration]);
    f.inspection.database.migrations.push(migration);
    f.plan.source.control.profile = 'adp3-probe-registry-v1';
    f.plan.controlMultihop = true;
    report = assessUpgrade(parseUpgradePlan(JSON.stringify(f.plan)), f.inspection);
    assert.equal(report.decision, 'compatible');
    for (const operation of ['upgrade', 'rollback', 'recover'] as const) {
        f.plan.operation = operation; f.plan.target.control.profile = 'adp3-multihop-v1';
        report = assessUpgrade(parseUpgradePlan(JSON.stringify(f.plan)), f.inspection);
        assert.equal(report.decision, 'blocked');
        assert.ok(report.checks.some(c => c.code === 'CONTROL_SCHEMA_READER' && c.subject === 'target' && c.status === 'block'));
    }
    f.plan.target.agent.profile = 'adp3-probe-registry-v1';
    assert.throws(() => parseUpgradePlan(JSON.stringify(f.plan)));
    const markers = schemaMarkers(migration, 'CREATE TABLE probe_instances (node_id INT);');
    assert.deepEqual(inspectSchema([], markers, [{ table: 'probe_instances', column: 'node_id', type: 'int' }]), [migration]);
    assert.deepEqual(inspectSchema([migration], markers, []), [migration]);
});
test('Probe permit DDL has a distinct Control-only ceiling and detects partial ownership tables', () => {
    const f = fixture(), migration = '0015-probe-permits.sql';
    f.inspection.schemaFiles.push({ name: '0014-probe-instances.sql', sha256: 'c'.repeat(64) }, { name: migration, sha256: 'd'.repeat(64) });
    f.inspection.database.migrations.push('0014-probe-instances.sql', migration);
    f.plan.source.control.profile = 'adp3-probe-permits-v1'; f.plan.target.control.profile = 'adp3-probe-permits-v1';
    f.plan.controlMultihop = true;
    assert.equal(assessUpgrade(parseUpgradePlan(JSON.stringify(f.plan)), f.inspection).decision, 'compatible');
    for (const profile of ['adp3-runtime-v1', 'adp3-multihop-v1', 'adp3-probe-registry-v1'] as const) {
        f.plan.target.control.profile = profile;
        const report = assessUpgrade(parseUpgradePlan(JSON.stringify(f.plan)), f.inspection);
        assert.ok(report.checks.some(c => c.code === 'CONTROL_SCHEMA_READER' && c.subject === 'target' && c.status === 'block'));
    }
    f.plan.target.agent.profile = 'adp3-probe-permits-v1';
    assert.throws(() => parseUpgradePlan(JSON.stringify(f.plan)));
    const markers = schemaMarkers(migration, 'CREATE TABLE probe_permit_budget (id INT); CREATE TABLE probe_permits (id INT);');
    const columns = [{ table: 'probe_permit_budget', column: 'id', type: 'int' }];
    assert.deepEqual(inspectSchema([], markers, columns), [migration]);
    assert.deepEqual(inspectSchema([migration], markers, columns), [migration]);
});

test('Probe withdrawals have an independent Control-only ceiling and partial migration/backfill requires review', async () => {
    const f = fixture(), migration = '0016-probe-permit-withdrawals.sql';
    for (const name of ['0014-probe-instances.sql', '0015-probe-permits.sql', migration]) {
        f.inspection.schemaFiles.push({ name, sha256: 'd'.repeat(64) }); f.inspection.database.migrations.push(name);
    }
    f.plan.source.control.profile = 'adp3-probe-withdrawals-v1'; f.plan.target.control.profile = 'adp3-probe-withdrawals-v1';
    f.plan.controlMultihop = true;
    assert.equal(assessUpgrade(parseUpgradePlan(JSON.stringify(f.plan)), f.inspection).decision, 'compatible');
    for (const profile of ['adp3-runtime-v1', 'adp3-multihop-v1', 'adp3-probe-registry-v1', 'adp3-probe-permits-v1'] as const) {
        f.plan.target.control.profile = profile;
        assert.ok(assessUpgrade(parseUpgradePlan(JSON.stringify(f.plan)), f.inspection).checks.some(c =>
            c.code === 'CONTROL_SCHEMA_READER' && c.subject === 'target' && c.status === 'block'));
    }
    f.plan.target.agent.profile = 'adp3-probe-withdrawals-v1'; assert.throws(() => parseUpgradePlan(JSON.stringify(f.plan)));
    const sql = await readFile(new URL('../migrations/' + migration, import.meta.url), 'utf8');
    assert.ok(!/--[^\r\n]*;/.test(sql), 'migration runner splits semicolons including comments');
    assert.match(sql, /SELECT id,closed_at FROM probe_permits WHERE state='consumed'/);
    assert.match(sql, /ON DELETE CASCADE/);
    const markers = schemaMarkers(migration, sql), columns = [{ table: 'probe_permit_withdrawals', column: 'permit_id', type: 'varchar(128)' }];
    assert.deepEqual(inspectSchema([], markers, columns), [migration]);
    assert.deepEqual(inspectSchema([migration], markers, []), [migration]);
    assert.deepEqual(inspectSchema([migration], markers, columns), []);
});

test('short-lived Probe results require a new Control-only reader ceiling and reject partial DDL', async () => {
    const f = fixture(), migration = '0017-probe-results.sql';
    for (const name of ['0014-probe-instances.sql', '0015-probe-permits.sql', '0016-probe-permit-withdrawals.sql', migration]) {
        f.inspection.schemaFiles.push({ name, sha256: 'd'.repeat(64) }); f.inspection.database.migrations.push(name);
    }
    f.plan.source.control.profile = 'adp3-probe-results-v1'; f.plan.target.control.profile = 'adp3-probe-results-v1';
    f.plan.controlMultihop = true;
    assert.equal(assessUpgrade(parseUpgradePlan(JSON.stringify(f.plan)), f.inspection).decision, 'compatible');
    for (const profile of ['adp3-runtime-v1', 'adp3-multihop-v1', 'adp3-probe-registry-v1', 'adp3-probe-permits-v1', 'adp3-probe-withdrawals-v1'] as const) {
        f.plan.target.control.profile = profile;
        assert.ok(assessUpgrade(parseUpgradePlan(JSON.stringify(f.plan)), f.inspection).checks.some(c =>
            c.code === 'CONTROL_SCHEMA_READER' && c.subject === 'target' && c.status === 'block'));
    }
    f.plan.target.agent.profile = 'adp3-probe-results-v1'; assert.throws(() => parseUpgradePlan(JSON.stringify(f.plan)));
    const sql = await readFile(new URL('../migrations/' + migration, import.meta.url), 'utf8');
    assert.ok(!/--[^\r\n]*;/.test(sql)); assert.match(sql, /ON DELETE CASCADE/);
    const markers = schemaMarkers(migration, sql), columns = [{ table: 'probe_results', column: 'permit_id', type: 'varchar(128)' }];
    assert.deepEqual(inspectSchema([], markers, columns), [migration]); assert.deepEqual(inspectSchema([migration], markers, []), [migration]);
    assert.deepEqual(inspectSchema([migration], markers, columns), []);
});

test('immutable path metadata requires a Control-only reader ceiling and rejects all partial three-table footprints', async () => {
    const f = fixture(), migration = '0018-path-templates.sql';
    for (const name of ['0014-probe-instances.sql', '0015-probe-permits.sql', '0016-probe-permit-withdrawals.sql', '0017-probe-results.sql', migration]) {
        f.inspection.schemaFiles.push({ name, sha256: 'e'.repeat(64) }); f.inspection.database.migrations.push(name);
    }
    f.plan.source.control.profile = 'adp3-path-templates-v1'; f.plan.target.control.profile = 'adp3-path-templates-v1'; f.plan.controlMultihop = true;
    assert.equal(assessUpgrade(parseUpgradePlan(JSON.stringify(f.plan)), f.inspection).decision, 'compatible');
    for (const profile of ['adp3-runtime-v1', 'adp3-multihop-v1', 'adp3-probe-registry-v1', 'adp3-probe-permits-v1', 'adp3-probe-withdrawals-v1', 'adp3-probe-results-v1'] as const) {
        f.plan.target.control.profile = profile;
        assert.ok(assessUpgrade(parseUpgradePlan(JSON.stringify(f.plan)), f.inspection).checks.some(c => c.code === 'CONTROL_SCHEMA_READER' && c.subject === 'target' && c.status === 'block'));
    }
    f.plan.target.agent.profile = 'adp3-path-templates-v1'; assert.throws(() => parseUpgradePlan(JSON.stringify(f.plan)));
    const sql = await readFile(new URL('../migrations/' + migration, import.meta.url), 'utf8');
    assert.ok(!/--[^\r\n]*;/.test(sql)); const markers = schemaMarkers(migration, sql);
    const columns = ['path_templates', 'path_template_revisions', 'path_template_events'].map(table => ({ table, column: 'scope_id', type: 'varchar(128)' }));
    assert.deepEqual(inspectSchema([migration], markers, columns), []);
    for (let mask = 0; mask < 7; mask++) assert.deepEqual(inspectSchema([migration], markers, columns.filter((_, index) => mask & (1 << index))), [migration]);
    assert.deepEqual(inspectSchema([], markers, columns), [migration]);
});

test('CLI dispatch and CI wiring keep assessment read-only and separate real MySQL acceptance', async () => {
    const cli = await readFile(new URL('../../../scripts/ops/cli.ts', import.meta.url), 'utf8');
    assert.ok(cli.indexOf("command==='assess-upgrade'") < cli.indexOf('const authority=new AuthorityStore'));
    const collector = await readFile(new URL('../../../scripts/ops/upgrade-inspect.ts', import.meta.url), 'utf8');
    assert.ok(!collector.includes('new MySqlUnitOfWork'));
    assert.ok(!collector.includes('.migrate('));
    assert.ok(collector.includes('WITH CONSISTENT SNAPSHOT, READ ONLY'));
    const ci = await readFile(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8');
    assert.ok(ci.includes('node --test apps/control/test/upgrade-mysql-acceptance.test.ts'));
});
