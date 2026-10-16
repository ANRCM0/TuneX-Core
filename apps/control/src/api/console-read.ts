import type { ControlApplication } from '../application/control.ts';
import { ControlError, invalid } from '../application/errors.ts';
import { json, rows } from '../infrastructure/mysql.ts';

type ListKind = 'nodes' | 'forwards' | 'operations' | 'candidates';
export type ConsoleFilters = Readonly<Record<string, string>>;
const filterNames: Record<ListKind, readonly string[]> = {
    nodes: ['idPrefix', 'credential'],
    forwards: ['idPrefix', 'enabled', 'recoverySuspended', 'protocol'],
    operations: ['forwardId', 'kind', 'status'],
    candidates: ['idPrefix', 'nodeId', 'mode', 'protocol'],
};
const enums: Record<string, readonly string[]> = {
    credential: ['valid', 'expired', 'unenrolled', 'revoked'],
    enabled: ['true', 'false'], recoverySuspended: ['true', 'false'],
    protocol: ['tcp', 'udp', 'both'], mode: ['direct', 'relay', 'multihop'],
    status: ['accepted', 'running', 'succeeded', 'failed', 'superseded'],
    kind: ['create', 'update', 'enable', 'disable', 'delete', 'retry', 'policy', 'revoke'],
};
function validateFilters(kind: ListKind, filters: ConsoleFilters): void {
    for (const [key, value] of Object.entries(filters)) {
        if (!filterNames[kind].includes(key) || typeof value !== 'string' ||
            (enums[key] ? !enums[key]!.includes(value) : !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)))
            invalid('Invalid console filter');
    }
}
/** Reject duplicates and unknown keys rather than silently broadening a query. */
export function consoleQuery(kind: ListKind, search: URLSearchParams) {
    const filters: Record<string, string> = {};
    for (const [key, value] of search) {
        if (search.getAll(key).length !== 1 || !['page', 'limit', ...filterNames[kind]].includes(key))
            invalid('Invalid console query parameter');
        if (key !== 'page' && key !== 'limit') filters[key] = value;
    }
    validateFilters(kind, filters);
    const page = search.get('page') ?? undefined, limit = search.get('limit') ?? undefined;
    consolePage(page, limit);
    return { page, limit, filters };
}
function predicate(kind: ListKind, alias: string, scope: string, filters: ConsoleFilters, now: number) {
    validateFilters(kind, filters);
    const clauses = [`${alias}scope_id=?`], args: unknown[] = [scope];
    const add = (sql: string, value?: unknown) => { clauses.push(sql); if (value !== undefined) args.push(value); };
    if (filters.idPrefix) add(`${alias}id LIKE CONCAT(?,'%') ESCAPE '!'`, filters.idPrefix.replaceAll('_', '!_'));
    if (kind === 'nodes') {
        if (filters.credential === 'revoked') add(`${alias}revoked=TRUE`);
        if (filters.credential && filters.credential !== 'revoked') {
            add(`${alias}revoked=FALSE`);
            if (filters.credential === 'unenrolled') add(`${alias}credential_until IS NULL`);
            else add(`${alias}credential_until${filters.credential === 'valid' ? '>' : '<='}?`, now);
        }
    }
    if (kind === 'forwards') {
        add(`${alias}deleting=FALSE`);
        if (filters.enabled) add(`${alias}spec->'$.enabled'=CAST(? AS JSON)`, filters.enabled);
        if (filters.recoverySuspended) add(`${alias}recovery_suspended=?`, filters.recoverySuspended === 'true');
        if (filters.protocol) add(`JSON_CONTAINS(${alias}spec->'$.protocols',?)`,
            JSON.stringify(filters.protocol === 'both' ? ['tcp', 'udp'] : [filters.protocol]));
    }
    if (kind === 'operations') {
        for (const [key, column] of [['forwardId', 'forward_id'], ['kind', 'kind'], ['status', 'status']] as const)
            if (filters[key]) add(`${alias}${column}=?`, filters[key]);
    }
    return { sql: clauses.join(' AND '), args };
}
type NodeRow = {
    id: string; revoked: number; credential_until: number | null; facts: unknown;
    session_epoch: number | null; snapshot_generation: number | null; received_at: number | null;
};
function nodeItem(record: NodeRow) {
    return {
        id: record.id, revoked: Boolean(record.revoked),
        credentialUntil: record.credential_until === null ? null : new Date(record.credential_until).toISOString(),
        policy: json(record.facts), sessionEpoch: record.session_epoch ?? 0,
        snapshotGeneration: record.snapshot_generation ?? 0,
        lastReportAt: record.received_at === null ? null : new Date(record.received_at).toISOString(),
    };
}

/** Scope-scoped, strictly bounded read models. Never infer health from Agent presence. */
export function consolePage(pageText: string | undefined, limitText: string | undefined) {
    const numeric = (value: string | undefined, fallback: number, maximum: number) => {
        if (value === undefined) return fallback;
        if (!/^[1-9][0-9]*$/.test(value) || Number(value) > maximum) invalid('Invalid pagination parameter');
        return Number(value);
    };
    const page = numeric(pageText, 1, 10000);
    const limit = numeric(limitText, 25, 100);
    return { page, limit, offset: (page - 1) * limit };
}

/** mysql2.execute binds JavaScript number arguments as DOUBLE. MySQL 8.4 may reject
 * DOUBLE bound parameters in LIMIT/OFFSET with ER_WRONG_ARGUMENTS.
 * Interpolate ONLY integers from consolePage; all user/scope values stay bound.
 */
export function consolePageSql(paging: ReturnType<typeof consolePage>): string {
    if (!Number.isSafeInteger(paging.page) || paging.page < 1 || paging.page > 10000 ||
        !Number.isSafeInteger(paging.limit) || paging.limit < 1 || paging.limit > 100 ||
        !Number.isSafeInteger(paging.offset) || paging.offset !== (paging.page - 1) * paging.limit)
        invalid('Invalid bounded pagination');
    return `LIMIT ${paging.limit} OFFSET ${paging.offset}`;
}

export async function consoleNodes(control: ControlApplication, actor: string, scope: string, pageText?: string, limitText?: string, filters: ConsoleFilters = {}) {
    const paging = consolePage(pageText, limitText);
    validateFilters('nodes', filters);
    return control.db.transaction(async tx => {
        await control.identity.scope(tx, actor, scope);
        const now = Date.now(), where = predicate('nodes', '', scope, filters, now);
        const pageWhere = predicate('nodes', 'n.', scope, filters, now);
        const [count] = await rows<{ n: number }>(tx, `SELECT COUNT(*) n FROM nodes WHERE ${where.sql}`, where.args);
        const records = await rows<NodeRow>(tx, `SELECT n.id,n.revoked,n.credential_until,n.facts,r.session_epoch,r.snapshot_generation,r.received_at FROM nodes n LEFT JOIN runtime_nodes r ON r.node_id=n.id WHERE ${pageWhere.sql} ORDER BY n.id ${consolePageSql(paging)}`, where.args);
        return {
            page: paging.page, limit: paging.limit, total: Number(count?.n ?? 0),
            items: records.map(nodeItem),
        };
    });
}

export async function consoleForwards(control: ControlApplication, actor: string, scope: string, pageText?: string, limitText?: string, filters: ConsoleFilters = {}) {
    const paging = consolePage(pageText, limitText);
    const where = predicate('forwards', '', scope, filters, Date.now());
    const pageWhere = predicate('forwards', 'f.', scope, filters, Date.now());
    return control.db.transaction(async tx => {
        await control.identity.scope(tx, actor, scope);
        const [count] = await rows<{ n: number }>(tx, `SELECT COUNT(*) n FROM forwards WHERE ${where.sql}`, where.args);
        const records = await rows<{
            id: string; revision: number; spec: unknown; recovery_suspended: number;
            operation_id: string | null; operation_kind: string | null; operation_status: string | null;
        }>(tx, `SELECT f.id,f.revision,f.spec,f.recovery_suspended,o.id operation_id,o.kind operation_kind,o.status operation_status FROM forwards f LEFT JOIN operations o ON o.id=(SELECT recent.id FROM operations recent WHERE recent.forward_id=f.id ORDER BY recent.target_revision DESC,recent.created_at DESC,recent.id DESC LIMIT 1) WHERE ${pageWhere.sql} ORDER BY f.id ${consolePageSql(paging)}`, where.args);
        return {
            page: paging.page, limit: paging.limit, total: Number(count?.n ?? 0),
            items: records.map(record => ({
                id: record.id, revision: record.revision, spec: json(record.spec),
                recoverySuspended: Boolean(record.recovery_suspended),
                lastOperation: record.operation_id === null ? null : { id: record.operation_id, kind: record.operation_kind, status: record.operation_status },
            })),
        };
    });
}

export async function consoleOperations(control: ControlApplication, actor: string, scope: string, pageText?: string, limitText?: string, filters: ConsoleFilters = {}) {
    const paging = consolePage(pageText, limitText);
    const where = predicate('operations', '', scope, filters, Date.now());
    return control.db.transaction(async tx => {
        await control.identity.scope(tx, actor, scope);
        const [count] = await rows<{ n: number }>(tx, `SELECT COUNT(*) n FROM operations WHERE ${where.sql}`, where.args);
        const records = await rows<{
            id: string; forward_id: string; kind: string; status: string; target_revision: number;
            created_at: number; updated_at: number; last_error: unknown; recovery_invalidated: number; cleanup_pending: number;
        }>(tx, `SELECT id,forward_id,kind,status,target_revision,created_at,updated_at,last_error,recovery_invalidated,cleanup_pending FROM operations WHERE ${where.sql} ORDER BY created_at DESC,id DESC ${consolePageSql(paging)}`, where.args);
        return {
            page: paging.page, limit: paging.limit, total: Number(count?.n ?? 0),
            items: records.map(record => ({
                id: record.id, forwardId: record.forward_id, kind: record.kind, status: record.status,
                targetRevision: record.target_revision,
                createdAt: new Date(record.created_at).toISOString(),
                updatedAt: new Date(record.updated_at).toISOString(),
                lastError: record.last_error === null ? null : json(record.last_error),
                recoveryInvalidated: Boolean(record.recovery_invalidated), cleanupPending: Boolean(record.cleanup_pending),
            })),
        };
    });
}

/** Candidate qualification is not a reservation, live-session check or full plan authorization. */
export async function consoleNodeCandidates(control: ControlApplication, actor: string, scope: string, pageText?: string, limitText?: string, filters: ConsoleFilters = {}) {
    validateFilters('candidates', filters);
    const paging = consolePage(pageText, limitText), mode = filters.mode ?? 'direct';
    const caps = ['adp.3', 'native.direct.v1'];
    if (mode !== 'direct') caps.push('native.relay.v1', 'relay.wire.1');
    if (mode === 'multihop') caps.push('adp.execution.1', 'native.multihop.v1', 'multihop.wire.1');
    if (filters.protocol) caps.push(...(filters.protocol === 'both' ? ['tcp', 'udp'] : [filters.protocol]));
    return control.db.transaction(async tx => {
        await control.identity.scope(tx, actor, scope, true);
        const now = Date.now(), where = predicate('candidates', 'n.', scope, filters, now);
        where.sql += ' AND n.revoked=FALSE AND n.credential_until>? AND EXISTS(SELECT 1 FROM node_grants g WHERE g.node_id=n.id AND g.actor_id=?)';
        where.args.push(now, actor);
        if (filters.nodeId) { where.sql += ' AND n.id=?'; where.args.push(filters.nodeId); }
        where.sql += " AND JSON_CONTAINS(n.facts->'$.capabilities',?) AND (JSON_CONTAINS(n.facts->'$.capabilities','\"tcp\"') OR JSON_CONTAINS(n.facts->'$.capabilities','\"udp\"')) AND JSON_LENGTH(n.facts->'$.allowedListenerAddresses')>0 AND JSON_LENGTH(n.facts->'$.allowedPorts')>0";
        where.args.push(JSON.stringify(caps));
        const [count] = await rows<{ n: number }>(tx, `SELECT COUNT(*) n FROM nodes n WHERE ${where.sql}`, where.args);
        const records = await rows<NodeRow>(tx, `SELECT n.id,n.revoked,n.credential_until,n.facts,r.session_epoch,r.snapshot_generation,r.received_at FROM nodes n LEFT JOIN runtime_nodes r ON r.node_id=n.id WHERE ${where.sql} ORDER BY n.id ${consolePageSql(paging)}`, where.args);
        return { page: paging.page, limit: paging.limit, total: Number(count?.n ?? 0), mode,
            items: records.map(nodeItem), source: 'persisted-control-state', independentProbe: false,
            fullPlanAuthorization: false, reserved: false };
    });
}

/** One statement gives a scope-wide observation, independent of filtered list pages. */
export async function consoleOverview(control: ControlApplication, actor: string, scope: string) {
    return control.db.transaction(async tx => {
        await control.identity.scope(tx, actor, scope);
        const [record] = await rows<{ nodes: number; forwards: number; active: number; failed: number }>(tx, `SELECT
            (SELECT COUNT(*) FROM nodes WHERE scope_id=?) nodes,
            (SELECT COUNT(*) FROM forwards WHERE scope_id=? AND deleting=FALSE) forwards,
            (SELECT COUNT(*) FROM operations WHERE scope_id=? AND status IN ('accepted','running')) active,
            (SELECT COUNT(*) FROM operations WHERE scope_id=? AND status='failed') failed`, [scope, scope, scope, scope]);
        return { nodes: Number(record?.nodes ?? 0), forwards: Number(record?.forwards ?? 0),
            activeOperations: Number(record?.active ?? 0), failedOperations: Number(record?.failed ?? 0),
            observedAt: new Date().toISOString(), source: 'persisted-control-state', independentProbe: false };
    });
}

/** Read-only Node diagnosis: persisted machine facts, not a network or target probe. */
export async function consoleNodeDiagnostics(control: ControlApplication, actor: string, scope: string, nodeId: string) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(nodeId)) invalid('Invalid Node identifier');
    return control.db.transaction(async tx => {
        await control.identity.scope(tx, actor, scope);
        const [record] = await rows<{
            id: string; revoked: number; credential_until: number | null;
            session_epoch: number | null; snapshot_generation: number | null;
            last_report_sequence: number | null; received_at: number | null;
            last_report: unknown; valid_until: number | null;
        }>(tx, 'SELECT n.id,n.revoked,n.credential_until,r.session_epoch,r.snapshot_generation,r.last_report_sequence,r.received_at,r.last_report,s.valid_until FROM nodes n LEFT JOIN runtime_nodes r ON r.node_id=n.id LEFT JOIN snapshots s ON s.node_id=n.id AND s.generation=r.snapshot_generation WHERE n.id=? AND n.scope_id=?', [nodeId,scope]);
        if (!record) throw new ControlError('NOT_FOUND',404,'Node not found');
        const now=Date.now();
        const raw=record.last_report===null?null:json<unknown>(record.last_report);
        const observations=raw&&typeof raw==='object'&&'observations' in raw&&Array.isArray(raw.observations)?raw.observations:[];
        const failures=observations.flatMap((value: unknown)=>{
            if (!value||typeof value!=='object') return [];
            const o=value as Record<string,unknown>;
            if (typeof o.errorCode!=='string'||!/^[A-Z][A-Z0-9_]{0,63}$/.test(o.errorCode)) return [];
            return [{ assignmentId:typeof o.assignmentId==='string'?o.assignmentId:'unknown',
                condition:typeof o.condition==='string'?o.condition:'unknown',
                errorCode:o.errorCode,retryable:o.retryable===true }];
        }).slice(0,50);
        const age=record.received_at===null?null:Math.max(0,Math.floor((now-record.received_at)/1000));
        const until=record.valid_until===null?null:new Date(record.valid_until).toISOString();
        const credentialUntil=record.credential_until===null?null:new Date(record.credential_until).toISOString();
        return {
            nodeId:record.id,observedAt:new Date(now).toISOString(),source:'persisted-control-state',
            independentProbe:false,
            revoked:Boolean(record.revoked),credentialUntil,
            sessionEpoch:record.session_epoch??0,snapshotGeneration:record.snapshot_generation??0,
            lastReportSequence:record.last_report_sequence??0,
            lastReportAt:record.received_at===null?null:new Date(record.received_at).toISOString(),
            reportAgeSeconds:age,reportStatus:age===null?'missing':'age-only',
            snapshotLeaseUntil:until,
            snapshotLeaseRemainingSeconds:record.valid_until===null?null:Math.floor((record.valid_until-now)/1000),
            totalReportedObservations:observations.length,errors:failures,
            note:'Control 仅提供历史状态和时间事实；报告年龄、有效证书或未到期快照均不能单独证明链路可达。'
        };
    });
}
