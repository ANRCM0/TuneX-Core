import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { mysqlMigrationStatements } from '../src/infrastructure/mysql-migration-statements.ts';

test('migration splitting preserves comments and quoted semicolons without joining SQL tokens', () => {
    const statements = [
        '-- header; not a statement\nCREATE TABLE `semi;colon` (value VARCHAR(32))',
        '/* comment; with \' and " */ INSERT INTO `semi;colon` VALUES (\'one;two\')',
        'SELECT/* keep token boundary; */1 # trailing comment;\n',
        '--\ttab begins a comment;\r\nSELECT "double;quoted"',
    ];
    assert.deepEqual(mysqlMigrationStatements(statements.join(';') + '; -- final comment;'), statements.map(value => value.trim()));
    assert.deepEqual(mysqlMigrationStatements(' ; # comment;\n /* another; */ ; -- end;'), []);
    assert.deepEqual(mysqlMigrationStatements('SELECT 4--1; SELECT 2'), ['SELECT 4--1', 'SELECT 2']);
});

test('migration splitting respects doubled quotes and native string backslash escapes', () => {
    const statements = [
        String.raw`SELECT 'escaped \'; still a value'`,
        String.raw`SELECT "escaped \"; still a value"`,
        "SELECT 'doubled ''; still a value'",
        'SELECT "doubled ""; still a value"',
        'SELECT `doubled ``; still an identifier`',
        String.raw`SELECT 'trailing backslash\\'`,
        "SELECT '# not a comment; -- neither; /* nor */'",
    ];
    assert.deepEqual(mysqlMigrationStatements(statements.join(';\n') + ';'), statements);
});

test('migration splitting follows NO_BACKSLASH_ESCAPES and ANSI_QUOTES without changing SQL text', () => {
    const single = String.raw`SELECT 'path\'; SELECT 2;`;
    assert.throws(() => mysqlMigrationStatements(single), /UNTERMINATED_MIGRATION_SQL/);
    assert.deepEqual(mysqlMigrationStatements(single, { noBackslashEscapes: true }), [String.raw`SELECT 'path\'`, 'SELECT 2']);
    const double = String.raw`SELECT "path\"; SELECT 2;`;
    assert.throws(() => mysqlMigrationStatements(double), /UNTERMINATED_MIGRATION_SQL/);
    assert.deepEqual(mysqlMigrationStatements(double, { ansiQuotes: true }), [String.raw`SELECT "path\"`, 'SELECT 2']);
    assert.deepEqual(mysqlMigrationStatements('SELECT `path\\`; SELECT 2;'), ['SELECT `path\\`', 'SELECT 2']);
    assert.deepEqual(mysqlMigrationStatements("SELECT 'doubled ''; value';", { noBackslashEscapes: true }), ["SELECT 'doubled ''; value'"]);
});

test('executable MySQL comments remain statements and unterminated or client-delimited scripts fail closed', () => {
    const versioned = "/*!80000 SET @migration_value='semi;colon' */";
    assert.deepEqual(mysqlMigrationStatements(versioned + '; /* comment only; */'), [versioned]);
    assert.deepEqual(mysqlMigrationStatements('/*+ hint; */ SELECT 1;'), ['/*+ hint; */ SELECT 1']);
    for (const source of ["SELECT 1; SELECT 'unclosed", 'SELECT 1; SELECT "unclosed', 'SELECT 1; SELECT `unclosed',
        'SELECT 1; /* unclosed;']) assert.throws(() => mysqlMigrationStatements(source), /UNTERMINATED_MIGRATION_SQL/);
    assert.throws(() => mysqlMigrationStatements('-- header;\nDELIMITER $$\nSELECT 1$$'), /UNSUPPORTED_MIGRATION_DELIMITER/);
});

test('the four production migrations with semicolons in introductory comments retain complete ordered DDL', async () => {
    for (const [name, count, firstTable] of [
        ['0024-telemetry-rollups.sql', 4, 'telemetry_rollup_scope_heads'],
        ['0031-notification-deliveries.sql', 4, 'notification_delivery_scopes'],
        ['0032-probe-runs.sql', 2, 'probe_run_scopes'],
        ['0037-probe-echo.sql', 23, 'probe_permits'],
    ] as const) {
        const sql = await readFile(new URL('../migrations/' + name, import.meta.url), 'utf8');
        const statements = mysqlMigrationStatements(sql), header = sql.split('\n')[0]!.trim();
        assert.match(header, /^-- .*;/);
        assert.equal(statements.length, count, name);
        assert.ok(statements[0]!.startsWith(header), name + ': original introductory comment must remain whole');
        assert.match(statements[0]!, new RegExp('(?:CREATE|ALTER) TABLE ' + firstTable + '\\b'));
        assert.ok(statements.every(value => /(?:^|\n)(?:CREATE|ALTER) TABLE /.test(value)), name + ': no comment fragment may become a query');
    }
});
