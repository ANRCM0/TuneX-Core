import type {
    ManagementReadEffects, ManagementReadKind, ManagementReadStore, ReadFilters, ReadPageWindow, ReadPrincipal,
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
        if(filters.resourceSource)add(`${alias}resource_source=?`,filters.resourceSource);
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

function forwardVisibility(principal:ReadPrincipal,alias:string):{sql:string;args:unknown[]} {
    return principal.governance ? {sql:'TRUE',args:[]} : {sql:`${alias}owner_actor_id=?`,args:[principal.actorId]};
}
function nodeVisibility(principal:ReadPrincipal,alias:string,full=false):{sql:string;args:unknown[]} {
    const valid=`((${alias}resource_source='private' AND ${alias}owner_actor_id IS NOT NULL) OR (${alias}resource_source IN ('admin-shared','legacy-unclassified') AND ${alias}owner_actor_id IS NULL))`;
    if (principal.governance) return {sql:valid,args:[]};
    const privateNode=`(${alias}resource_source='private' AND ${alias}owner_actor_id=?)`;
    return {sql:`(${privateNode}${full?'':` OR (${alias}resource_source='admin-shared' AND ${alias}owner_actor_id IS NULL AND EXISTS(SELECT 1 FROM node_grants g WHERE g.node_id=${alias}id AND g.actor_id=?))`})`,
        args:full?[principal.actorId]:[principal.actorId,principal.actorId]};
}
function addVisibility(where:{sql:string;args:unknown[]},visible:{sql:string;args:unknown[]}):void {
    where.sql+=` AND (${visible.sql})`;where.args.push(...visible.args);
}
function nodeColumns(principal:ReadPrincipal,now:number):{sql:string;args:unknown[]} {
    return {sql:`n.id,n.revoked,n.credential_until,n.facts,
        n.resource_source,n.owner_actor_id,
        (SELECT ng.allowed_roles FROM node_grants ng WHERE ng.node_id=n.id AND ng.actor_id=?) allowed_roles,
        (n.revoked=FALSE AND n.credential_until>? AND
          ((n.resource_source='private' AND n.owner_actor_id=?) OR (n.resource_source='admin-shared' AND n.owner_actor_id IS NULL)) AND
          EXISTS(SELECT 1 FROM node_grants ug WHERE ug.node_id=n.id AND ug.actor_id=?)) can_use,
        CASE WHEN ? OR n.resource_source='private' THEN 'full' ELSE 'shared' END read_detail,
        CASE WHEN ? OR n.resource_source='private' THEN r.session_epoch ELSE NULL END session_epoch,
        CASE WHEN ? OR n.resource_source='private' THEN r.snapshot_generation ELSE NULL END snapshot_generation,
        CASE WHEN ? OR n.resource_source='private' THEN r.received_at ELSE NULL END received_at`,
        args:[principal.actorId,now,principal.actorId,principal.actorId,principal.governance,principal.governance,principal.governance,principal.governance]};
}

/** Every count/page pair uses the same caller predicate before pagination. */
export class MySqlManagementReadStore implements ManagementReadStore<Transaction> {
    private readonly effects:ManagementReadEffects;
    constructor(effects:ManagementReadEffects) { this.effects=effects; }
    async nodes<R>(tx:Transaction,scope:string,principal:ReadPrincipal,paging:ReadPageWindow,filters:ReadFilters,project:(page:ReadRows<ReadNodeRow>)=>R):Promise<R> {
        const where=predicate(this.effects.validateFilters,'nodes','n.',scope,filters,this.effects.now());
        addVisibility(where,nodeVisibility(filters.ownership==='available'?{...principal,governance:false}:principal,'n.'));
        if(filters.ownership==='mine'){where.sql+=" AND n.resource_source='private' AND n.owner_actor_id=?";where.args.push(principal.actorId);}
        const columns=nodeColumns(principal,this.effects.now());
        const [count]=await rows<{n:number}>(tx,`SELECT COUNT(*) n FROM nodes n WHERE ${where.sql}`,where.args);
        const records=await rows<ReadNodeRow>(tx,`SELECT ${columns.sql} FROM nodes n LEFT JOIN runtime_nodes r ON r.node_id=n.id WHERE ${where.sql} ORDER BY n.id ${consolePageSql(paging)}`,[...columns.args,...where.args]);
        return project({count,records});
    }
    async forwards<R>(tx:Transaction,scope:string,principal:ReadPrincipal,paging:ReadPageWindow,filters:ReadFilters,project:(page:ReadRows<ReadForwardRow>)=>R):Promise<R> {
        const where=predicate(this.effects.validateFilters,'forwards','f.',scope,filters,this.effects.now());
        addVisibility(where,forwardVisibility(filters.ownership?{...principal,governance:false}:principal,'f.'));
        const [count]=await rows<{n:number}>(tx,`SELECT COUNT(*) n FROM forwards f WHERE ${where.sql}`,where.args);
        const records=await rows<ReadForwardRow>(tx,`SELECT f.id,f.revision,f.spec,f.recovery_suspended,o.id operation_id,o.kind operation_kind,o.status operation_status FROM forwards f LEFT JOIN operations o ON o.id=(SELECT recent.id FROM operations recent WHERE recent.forward_id=f.id ORDER BY recent.target_revision DESC,recent.created_at DESC,recent.id DESC LIMIT 1) WHERE ${where.sql} ORDER BY f.id ${consolePageSql(paging)}`,where.args);
        return project({count,records});
    }
    async operations<R>(tx:Transaction,scope:string,principal:ReadPrincipal,paging:ReadPageWindow,filters:ReadFilters,project:(page:ReadRows<ReadOperationRow>)=>R):Promise<R> {
        const where=predicate(this.effects.validateFilters,'operations','o.',scope,filters,this.effects.now());
        const visible=forwardVisibility(principal,'f.');
        addVisibility(where,{sql:`EXISTS(SELECT 1 FROM forwards f WHERE f.id=o.forward_id AND f.scope_id=o.scope_id AND ${visible.sql})`,args:visible.args});
        const [count]=await rows<{n:number}>(tx,`SELECT COUNT(*) n FROM operations o WHERE ${where.sql}`,where.args);
        const records=await rows<ReadOperationRow>(tx,`SELECT o.id,o.forward_id,o.kind,o.status,o.target_revision,o.created_at,o.updated_at,o.last_error,o.recovery_invalidated,o.cleanup_pending FROM operations o WHERE ${where.sql} ORDER BY o.created_at DESC,o.id DESC ${consolePageSql(paging)}`,where.args);
        return project({count,records});
    }
    async candidates<R>(tx:Transaction,scope:string,principal:ReadPrincipal,paging:ReadPageWindow,filters:ReadFilters,capabilities:string[],project:(page:ReadRows<ReadNodeRow>)=>R):Promise<R> {
        const now=this.effects.now(),where=predicate(this.effects.validateFilters,'candidates','n.',scope,filters,now);
        // Governance permits observation, never use of someone else's private machine.
        addVisibility(where,nodeVisibility({...principal,governance:false},'n.'));
        where.sql+=' AND n.revoked=FALSE AND n.credential_until>?';where.args.push(now);
        const role=filters.role??'ingress';
        where.sql+=' AND EXISTS(SELECT 1 FROM node_grants active_grant WHERE active_grant.node_id=n.id AND active_grant.actor_id=?)';
        where.args.push(principal.actorId);
        where.sql+=` AND (n.resource_source='private' OR EXISTS(SELECT 1 FROM node_grants purpose WHERE purpose.node_id=n.id AND purpose.actor_id=? AND (purpose.allowed_roles IS NULL OR JSON_CONTAINS(purpose.allowed_roles,JSON_QUOTE(?)))))`;
        where.args.push(principal.actorId,role);
        if(filters.nodeId){where.sql+=' AND n.id=?';where.args.push(filters.nodeId);}
        where.sql+=` AND JSON_CONTAINS(n.facts->'$.capabilities',?) AND (JSON_CONTAINS(n.facts->'$.capabilities','"tcp"') OR JSON_CONTAINS(n.facts->'$.capabilities','"udp"'))`;
        if(role==='ingress')where.sql+=" AND JSON_LENGTH(n.facts->'$.allowedListenerAddresses')>0 AND JSON_LENGTH(n.facts->'$.allowedPorts')>0";
        where.args.push(JSON.stringify(capabilities));
        const columns=nodeColumns(principal,now);
        const [count]=await rows<{n:number}>(tx,`SELECT COUNT(*) n FROM nodes n WHERE ${where.sql}`,where.args);
        const records=await rows<ReadNodeRow>(tx,`SELECT ${columns.sql} FROM nodes n LEFT JOIN runtime_nodes r ON r.node_id=n.id WHERE ${where.sql} ORDER BY n.id ${consolePageSql(paging)}`,[...columns.args,...where.args]);
        return project({count,records});
    }
    async overview<R>(tx:Transaction,scope:string,principal:ReadPrincipal,project:(record:ReadOverviewRow|undefined)=>R):Promise<R> {
        const node=nodeVisibility(principal,'n.'),forward=forwardVisibility(principal,'f.');
        const operation=`EXISTS(SELECT 1 FROM forwards f WHERE f.scope_id=o.scope_id AND f.id=o.forward_id AND ${forward.sql})`;
        const [record]=await rows<ReadOverviewRow>(tx,`SELECT
          (SELECT COUNT(*) FROM nodes n WHERE n.scope_id=? AND ${node.sql}) nodes,
          (SELECT COUNT(*) FROM forwards f WHERE f.scope_id=? AND f.deleting=FALSE AND ${forward.sql}) forwards,
          (SELECT COUNT(*) FROM operations o WHERE o.scope_id=? AND o.status IN ('accepted','running') AND ${operation}) active,
          (SELECT COUNT(*) FROM operations o WHERE o.scope_id=? AND o.status='failed' AND ${operation}) failed`,
          [scope,...node.args,scope,...forward.args,scope,...forward.args,scope,...forward.args]);
        return project(record);
    }
    async diagnostics<R>(tx:Transaction,scope:string,principal:ReadPrincipal,nodeId:string,project:(record:ReadDiagnosticsRow|undefined)=>R):Promise<R> {
        const visible=nodeVisibility(principal,'n.',true);
        const [record]=await rows<ReadDiagnosticsRow>(tx,`SELECT n.id,n.revoked,n.credential_until,r.session_epoch,r.snapshot_generation,r.last_report_sequence,r.received_at,r.last_report,s.valid_until FROM nodes n LEFT JOIN runtime_nodes r ON r.node_id=n.id LEFT JOIN snapshots s ON s.node_id=n.id AND s.generation=r.snapshot_generation WHERE n.id=? AND n.scope_id=? AND ${visible.sql}`,[nodeId,scope,...visible.args]);
        return project(record);
    }
}

export class MySqlProfileReferenceReadStore implements ProfileReferenceReadStore<Transaction> {
    async profile<R>(tx:Transaction,scope:string,profile:string,project:(record:{current_revision:number}|undefined)=>R):Promise<R> {
        const [record] = await rows<{ current_revision: number }>(tx,
            'SELECT current_revision FROM transport_profiles WHERE id=? AND scope_id=?', [profile, scope]);
        return project(record);
    }
    async references<R>(tx:Transaction,scope:string,principal:ReadPrincipal,profile:string,paging:ReadPageWindow,revision:number|undefined,project:(page:ReadRows<ReadForwardReferenceRow>)=>R):Promise<R> {
        const visible=forwardVisibility(principal,'');
        const where = `(${visible.sql}) AND scope_id=? AND deleting=FALSE AND CAST(JSON_UNQUOTE(spec->'$.transport.profileId') AS BINARY)=CAST(? AS BINARY)` +
            (revision === undefined ? '' : ` AND spec->'$.transport.configRevision'=CAST(? AS JSON)`);
        const args = [...visible.args, scope, profile, ...(revision === undefined ? [] : [String(revision)])];
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
    async references<R>(tx:Transaction,scope:string,principal:ReadPrincipal,node:string,paging:ReadPageWindow,project:(page:ReadRows<ReadForwardReferenceRow>)=>R):Promise<R> {
        const visible=forwardVisibility(principal,'');
        const where = `(${visible.sql}) AND scope_id=? AND deleting=FALSE AND spec->'$.path.via' IS NOT NULL AND
            (CAST(JSON_UNQUOTE(spec->'$.ingress.nodeId') AS BINARY)=CAST(? AS BINARY) OR JSON_CONTAINS(spec->'$.path.via',JSON_QUOTE(?)))`;
        const args = [...visible.args, scope, node, node];
        const [count] = await rows<{ n: number }>(tx, `SELECT COUNT(*) n FROM forwards WHERE ${where}`, args);
        const records = await rows<ReadForwardReferenceRow>(tx,
            `SELECT id,revision,spec,recovery_suspended FROM forwards WHERE ${where} ORDER BY id ${consolePageSql(paging)}`, args);
        return project({count,records});
    }
}
