import type {
    ManagementReadEffects, ManagementReadKind, ManagementReadStore, ReadFilters, ReadPageWindow,
    ReadNodeRow, ReadForwardRow, ReadOperationRow, ReadOverviewRow, ReadDiagnosticsRow, ReadRows,
    ProfileReferenceReadStore, ReadForwardReferenceRow, TunnelMetadataReadStore,
    ReadTunnelNodeRow, ReadTunnelEndpointRow, ReadTunnelPeerRow, ReadTunnelPeers,
} from '../framework/public.ts';
import { consolePageSql } from './mysql-read-pagination.ts';
import { rows } from './mysql.ts';
import type { Transaction } from './mysql.ts';

function predicate(validateFilters:ManagementReadEffects['validateFilters'],kind:ManagementReadKind,alias:string,scope:string,filters:ReadFilters,now:number) {
    validateFilters(kind, filters);
    const clauses = [`${alias}scope_id=?`], args: unknown[] = [scope];
    const add = (sql: string, value?: unknown) => { clauses.push(sql); if (value !== undefined)
        args.push(value); };
    if (filters.idPrefix)
        add(`${alias}id LIKE CONCAT(?,'%') ESCAPE '!'`, filters.idPrefix.replaceAll('_', '!_'));
    if (kind === 'nodes') {
        if (filters.credential === 'revoked')
            add(`${alias}revoked=TRUE`);
        if (filters.credential && filters.credential !== 'revoked') {
            add(`${alias}revoked=FALSE`);
            if (filters.credential === 'unenrolled')
                add(`${alias}credential_until IS NULL`);
            else
                add(`${alias}credential_until${filters.credential === 'valid' ? '>' : '<='}?`, now);
        }
    }
    if (kind === 'forwards') {
        add(`${alias}deleting=FALSE`);
        if (filters.enabled)
            add(`${alias}spec->'$.enabled'=CAST(? AS JSON)`, filters.enabled);
        if (filters.recoverySuspended)
            add(`${alias}recovery_suspended=?`, filters.recoverySuspended === 'true');
        if (filters.protocol)
            add(`JSON_CONTAINS(${alias}spec->'$.protocols',?)`, JSON.stringify(filters.protocol === 'both' ? ['tcp', 'udp'] : [filters.protocol]));
    }
    if (kind === 'operations') {
        for (const [key, column] of [['forwardId', 'forward_id'], ['kind', 'kind'], ['status', 'status']] as const)
            if (filters[key])
                add(`${alias}${column}=?`, filters[key]);
    }
    return { sql: clauses.join(' AND '), args };
}

/** Raw SELECT results only; outer projections run synchronously at the original return point. */
export class MySqlManagementReadStore implements ManagementReadStore<Transaction> {
    private readonly effects:ManagementReadEffects;
    constructor(effects:ManagementReadEffects) {this.effects=effects;}
    async nodes<R>(tx:Transaction,scope:string,paging:ReadPageWindow,filters:ReadFilters,project:(page:ReadRows<ReadNodeRow>)=>R):Promise<R> {
        const now = this.effects.now(), where = predicate(this.effects.validateFilters,'nodes', '', scope, filters, now);
        const pageWhere = predicate(this.effects.validateFilters,'nodes', 'n.', scope, filters, now);
        const [count] = await rows<{n:number}>(tx, `SELECT COUNT(*) n FROM nodes WHERE ${where.sql}`, where.args);
        const records = await rows<ReadNodeRow>(tx, `SELECT n.id,n.revoked,n.credential_until,n.facts,r.session_epoch,r.snapshot_generation,r.received_at FROM nodes n LEFT JOIN runtime_nodes r ON r.node_id=n.id WHERE ${pageWhere.sql} ORDER BY n.id ${consolePageSql(paging)}`, where.args);
        return project({count,records});
    }
    async forwards<R>(tx:Transaction,scope:string,paging:ReadPageWindow,filters:ReadFilters,project:(page:ReadRows<ReadForwardRow>)=>R):Promise<R> {
        const where = predicate(this.effects.validateFilters,'forwards', '', scope, filters, this.effects.now());
        const pageWhere = predicate(this.effects.validateFilters,'forwards', 'f.', scope, filters, this.effects.now());
        const [count] = await rows<{n:number}>(tx, `SELECT COUNT(*) n FROM forwards WHERE ${where.sql}`, where.args);
        const records = await rows<ReadForwardRow>(tx, `SELECT f.id,f.revision,f.spec,f.recovery_suspended,o.id operation_id,o.kind operation_kind,o.status operation_status FROM forwards f LEFT JOIN operations o ON o.id=(SELECT recent.id FROM operations recent WHERE recent.forward_id=f.id ORDER BY recent.target_revision DESC,recent.created_at DESC,recent.id DESC LIMIT 1) WHERE ${pageWhere.sql} ORDER BY f.id ${consolePageSql(paging)}`, where.args);
        return project({count,records});
    }
    async operations<R>(tx:Transaction,scope:string,paging:ReadPageWindow,filters:ReadFilters,project:(page:ReadRows<ReadOperationRow>)=>R):Promise<R> {
        const where = predicate(this.effects.validateFilters,'operations', '', scope, filters, this.effects.now());
        const [count] = await rows<{n:number}>(tx, `SELECT COUNT(*) n FROM operations WHERE ${where.sql}`, where.args);
        const records = await rows<ReadOperationRow>(tx, `SELECT id,forward_id,kind,status,target_revision,created_at,updated_at,last_error,recovery_invalidated,cleanup_pending FROM operations WHERE ${where.sql} ORDER BY created_at DESC,id DESC ${consolePageSql(paging)}`, where.args);
        return project({count,records});
    }
    async candidates<R>(tx:Transaction,actor:string,scope:string,paging:ReadPageWindow,filters:ReadFilters,capabilities:string[],project:(page:ReadRows<ReadNodeRow>)=>R):Promise<R> {
        const now = this.effects.now(), where = predicate(this.effects.validateFilters,'candidates', 'n.', scope, filters, now);
        where.sql += ' AND n.revoked=FALSE AND n.credential_until>? AND EXISTS(SELECT 1 FROM node_grants g WHERE g.node_id=n.id AND g.actor_id=?)';
        where.args.push(now, actor);
        if (filters.nodeId) {
            where.sql += ' AND n.id=?';
            where.args.push(filters.nodeId);
        }
        where.sql += " AND JSON_CONTAINS(n.facts->'$.capabilities',?) AND (JSON_CONTAINS(n.facts->'$.capabilities','\"tcp\"') OR JSON_CONTAINS(n.facts->'$.capabilities','\"udp\"')) AND JSON_LENGTH(n.facts->'$.allowedListenerAddresses')>0 AND JSON_LENGTH(n.facts->'$.allowedPorts')>0";
        where.args.push(JSON.stringify(capabilities));
        const [count] = await rows<{n:number}>(tx, `SELECT COUNT(*) n FROM nodes n WHERE ${where.sql}`, where.args);
        const records = await rows<ReadNodeRow>(tx, `SELECT n.id,n.revoked,n.credential_until,n.facts,r.session_epoch,r.snapshot_generation,r.received_at FROM nodes n LEFT JOIN runtime_nodes r ON r.node_id=n.id WHERE ${where.sql} ORDER BY n.id ${consolePageSql(paging)}`, where.args);
        return project({count,records});
    }
    async overview<R>(tx:Transaction,scope:string,project:(record:ReadOverviewRow|undefined)=>R):Promise<R> {
        const [record] = await rows<ReadOverviewRow>(tx, `SELECT
                    (SELECT COUNT(*) FROM nodes WHERE scope_id=?) nodes,
                    (SELECT COUNT(*) FROM forwards WHERE scope_id=? AND deleting=FALSE) forwards,
                    (SELECT COUNT(*) FROM operations WHERE scope_id=? AND status IN ('accepted','running')) active,
                    (SELECT COUNT(*) FROM operations WHERE scope_id=? AND status='failed') failed`, [scope, scope, scope, scope]);
        return project(record);
    }
    async diagnostics<R>(tx:Transaction,scope:string,nodeId:string,project:(record:ReadDiagnosticsRow|undefined)=>R):Promise<R> {
        const [record] = await rows<ReadDiagnosticsRow>(tx, 'SELECT n.id,n.revoked,n.credential_until,r.session_epoch,r.snapshot_generation,r.last_report_sequence,r.received_at,r.last_report,s.valid_until FROM nodes n LEFT JOIN runtime_nodes r ON r.node_id=n.id LEFT JOIN snapshots s ON s.node_id=n.id AND s.generation=r.snapshot_generation WHERE n.id=? AND n.scope_id=?', [nodeId, scope]);
        return project(record);
    }
}

export class MySqlProfileReferenceReadStore implements ProfileReferenceReadStore<Transaction> {
    async profile<R>(tx:Transaction,scope:string,profile:string,project:(record:{current_revision:number}|undefined)=>R):Promise<R> {
        const [record] = await rows<{ current_revision: number }>(tx,
            'SELECT current_revision FROM transport_profiles WHERE id=? AND scope_id=?', [profile, scope]);
        return project(record);
    }
    async references<R>(tx:Transaction,scope:string,profile:string,paging:ReadPageWindow,revision:number|undefined,project:(page:ReadRows<ReadForwardReferenceRow>)=>R):Promise<R> {
        const where = `scope_id=? AND deleting=FALSE AND CAST(JSON_UNQUOTE(spec->'$.transport.profileId') AS BINARY)=CAST(? AS BINARY)` +
            (revision === undefined ? '' : ` AND spec->'$.transport.configRevision'=CAST(? AS JSON)`);
        const args = [scope, profile, ...(revision === undefined ? [] : [String(revision)])];
        const [count] = await rows<{ n: number }>(tx, `SELECT COUNT(*) n FROM forwards WHERE ${where}`, args);
        const records = await rows<ReadForwardReferenceRow>(tx,
            `SELECT id,revision,spec,recovery_suspended FROM forwards WHERE ${where} ORDER BY id ${consolePageSql(paging)}`, args);
        return project({count,records});
    }
}

export class MySqlTunnelMetadataReadStore implements TunnelMetadataReadStore<Transaction> {
    async node<R>(tx:Transaction,scope:string,node:string,project:(record:ReadTunnelNodeRow|undefined)=>R):Promise<R> {
        const [record] = await rows<ReadTunnelNodeRow>(tx,
            `SELECT n.id,n.revoked,n.credential_until,n.facts->'$.capabilities' capabilities,r.session_epoch,r.snapshot_generation,r.received_at
             FROM nodes n LEFT JOIN runtime_nodes r ON r.node_id=n.id WHERE n.id=? AND n.scope_id=?`, [node, scope]);
        return project(record);
    }
    async endpoint<R>(tx:Transaction,node:string,project:(record:ReadTunnelEndpointRow|undefined)=>R):Promise<R> {
        const [record] = await rows<ReadTunnelEndpointRow>(tx, 'SELECT revision,config FROM node_relay_endpoints WHERE node_id=?', [node]);
        return project(record);
    }
    async peers<R>(tx:Transaction,node:string,now:number,project:(page:ReadTunnelPeers)=>R):Promise<R> {
        const [count] = await rows<{ total: number; window_count: number }>(tx,
            'SELECT COUNT(*) total,COALESCE(SUM(revoked=FALSE AND valid_until>? AND (retire_after IS NULL OR retire_after>?)),0) window_count FROM node_relay_credentials WHERE node_id=?', [now, now, node]);
        const records = await rows<ReadTunnelPeerRow>(tx,
            `SELECT fingerprint,issued_at,valid_until,retire_after,revoked FROM node_relay_credentials WHERE node_id=?
             ORDER BY (revoked=FALSE AND valid_until>? AND (retire_after IS NULL OR retire_after>?)) DESC,issued_at DESC,fingerprint DESC LIMIT 4`, [node, now, now]);
        return project({count,records});
    }
    async references<R>(tx:Transaction,scope:string,node:string,paging:ReadPageWindow,project:(page:ReadRows<ReadForwardReferenceRow>)=>R):Promise<R> {
        const where = `scope_id=? AND deleting=FALSE AND spec->'$.path.via' IS NOT NULL AND
            (CAST(JSON_UNQUOTE(spec->'$.ingress.nodeId') AS BINARY)=CAST(? AS BINARY) OR JSON_CONTAINS(spec->'$.path.via',JSON_QUOTE(?)))`;
        const args = [scope, node, node];
        const [count] = await rows<{ n: number }>(tx, `SELECT COUNT(*) n FROM forwards WHERE ${where}`, args);
        const records = await rows<ReadForwardReferenceRow>(tx,
            `SELECT id,revision,spec,recovery_suspended FROM forwards WHERE ${where} ORDER BY id ${consolePageSql(paging)}`, args);
        return project({count,records});
    }
}
