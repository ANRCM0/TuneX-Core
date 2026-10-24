import { parseJson } from '@tunex/contracts';
export { parseJson as nativeUpgradeParseJson };

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
    resourceLimitSnapshots:number;
    latestLeaseUntil: number | null;
}
const migrationName = /^[0-9]{4}-[a-z0-9-]+\.sql$/;
// FR-0027 reviews this complete CHECK-only migration. It adds no table/column footprint.
const probePlanJsonIntegersSql = `ALTER TABLE probe_plans
 DROP CHECK probe_plans_chk_7,
 ADD CONSTRAINT probe_plan_expiry_json_integer CHECK(
  JSON_TYPE(JSON_EXTRACT(config,'$.expiresAt')) IN ('INTEGER','UNSIGNED INTEGER')
  AND JSON_EXTRACT(config,'$.expiresAt') IS NOT NULL
 );`;
function reviewedSqlTokens(sql: string): string {
    // Preserve quoted values and every SQL token; ignore only whitespace and outside-string line comments.
    const tokens = sql.match(/'(?:''|[^'])*'|--(?=[\x00-\x20\x7f]|$)[^\r\n]*|[A-Za-z_][A-Za-z0-9_]*|[0-9]+|[^ \t\r\n\f\v]/g) ?? [];
    return JSON.stringify(tokens.filter(token => !token.startsWith('--')));
}
/** Footprints detect interrupted known DDL; this is not a full schema equivalence proof. */
export function schemaMarkers(migration: string, sql: string): SchemaMarker[] {
    const markers: SchemaMarker[] = [];
    if (!migrationName.test(migration)) throw new Error('UNKNOWN_MIGRATION_FILE');
    if (migration === '0038-probe-plan-json-integers.sql') {
        if (reviewedSqlTokens(sql) !== reviewedSqlTokens(probePlanJsonIntegersSql))
            throw new Error('UNREVIEWED_MIGRATION_FILE');
        return markers;
    }
    for (const match of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?([a-z_]+)\s*\(/g))
        markers.push({ migration, table: match[1]! });
    for (const match of sql.matchAll(/ALTER TABLE ([a-z_]+)([^;]+);/g)) {
        for (const column of match[2]!.matchAll(/ADD COLUMN ([a-z_]+)/g))
            markers.push({ migration, table: match[1]!, column: column[1]! });
        for (const column of match[2]!.matchAll(/MODIFY (?:COLUMN )?([a-z_]+) (ENUM\([^)]*\))/g))
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

export const nativeUpgradeFormat={
 revision:(value:string):boolean=>/^[a-f0-9]{40}$/.test(value),
 digest:(value:string):boolean=>/^sha256:[a-f0-9]{64}$/.test(value),
 mysqlBaseline:(value:string):boolean=>/^8\.4\.[0-9]+(?:[-+.]|$)/.test(value),
};
