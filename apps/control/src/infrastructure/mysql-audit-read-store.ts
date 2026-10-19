import { ControlError, invalid } from '../framework/public.ts';
import type { AuditStorage, AuditStoragePolicy, AuditStorageRow, AuditStorageQuery } from '../framework/public.ts';
import { rows } from './mysql.ts';
import type { Transaction } from './mysql.ts';

type Columns = Partial<Record<keyof AuditStorageRow, string>>;
interface Projection { from: string; scope: string; pk: string[]; columns: Columns; node?: string; nodeJoins?: string }
const literal = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const extract = (value: string, path: string) => `JSON_EXTRACT(${value},${literal(path)})`;
const text = (value: string, path: string) => `CASE WHEN JSON_TYPE(${extract(value,path)})='STRING' THEN JSON_UNQUOTE(${extract(value,path)}) ELSE NULL END`;
const integer = (value: string, path: string) => `CASE WHEN JSON_TYPE(${extract(value,path)})='INTEGER' AND CAST(JSON_UNQUOTE(${extract(value,path)}) AS DECIMAL(20,0)) BETWEEN 0 AND 9007199254740991 THEN CAST(JSON_UNQUOTE(${extract(value,path)}) AS UNSIGNED) ELSE NULL END`;
const boolean = (value: string, path: string) => `CASE WHEN JSON_TYPE(${extract(value,path)})='BOOLEAN' THEN ${extract(value,path)}=CAST('true' AS JSON) ELSE NULL END`;
const nodeToken = '__AUDIT_NODE__';
function createAuditProjection(errorCodes:readonly string[]):(source:string)=>Projection {
const knownError = (value: string) => `CASE WHEN (${value}) IS NULL THEN NULL WHEN CAST((${value}) AS BINARY) IN (${errorCodes.map(code => `CAST(${literal(code)} AS BINARY)`).join(',')}) THEN (${value}) ELSE 'OTHER_ERROR' END`;
const specNode = (spec: string) => `(CAST(${text(spec,'$.ingress.nodeId')} AS BINARY)=CAST(${nodeToken} AS BINARY) OR JSON_CONTAINS(${extract(spec,'$.path.via')},JSON_QUOTE(${nodeToken})))`;
const configNode = (config: string) => `JSON_CONTAINS(${extract(config,'$.nodes')},JSON_QUOTE(${nodeToken}))`;
const itemAt = (array: string, position: string) => `JSON_EXTRACT(${array},CONCAT('$[',(${position})-1,']'))`;
const planItems = (plan: string) => extract(plan,'$.items');
// Keep table-function dependencies in the join graph. A correlated scalar WHERE
// can be evaluated before its JSON owner is joined on MySQL 8.4.9.
function definitionJoins(config: string, members: 'candidates' | 'members', scope: string) {
    return ` JOIN JSON_TABLE(${config},'$.${members}[*]' COLUMNS (` +
        "template_id VARCHAR(128) PATH '$.template.templateId',template_revision BIGINT PATH '$.template.revision'," +
        "config_digest VARCHAR(71) PATH '$.template.configDigest')) audit_members ON TRUE " +
        `JOIN path_template_revisions audit_template ON audit_template.scope_id=${scope} AND audit_template.template_id=audit_members.template_id ` +
        'AND audit_template.revision=audit_members.template_revision AND audit_template.config_digest=audit_members.config_digest';
}
function metadata(table: string, id: string, revisions: string, entity: string, members?: 'candidates' | 'members'): Projection {
    return { from: `${table} e JOIN ${revisions} r ON r.scope_id=e.scope_id AND r.${id}=e.${id} AND r.revision=e.revision`,
        scope: 'e.scope_id=?', pk: ['e.id'], columns: { occurredAt: 'e.created_at', kind: 'e.kind', actorId: 'e.actor_id',
            entityKind: literal(entity), entityId: `e.${id}`, revision: 'e.revision', revisionKind: "'config'",
            nodeAssociation: literal(members ? 'immutable-group-definition' : 'immutable-template-config') },
        node: configNode(members?'audit_template.config':'r.config'),
        ...(members?{nodeJoins:definitionJoins('r.config',members,'e.scope_id')}:{}) };
}
function batchEvent(table: string, owner: string, entity: string, selections:readonly (readonly [string,string])[]): Projection {
    return { from: `${table} e JOIN ${owner} p ON p.scope_id=e.scope_id AND p.batch_id=e.batch_id`, scope: 'e.scope_id=?',
        pk: ['e.scope_id','e.batch_id','e.revision'], columns: { occurredAt: 'e.created_at', kind: 'e.kind',
            actorId: "CASE WHEN e.kind='recovery' THEN NULL ELSE e.actor_id END",
            actorAttribution: "CASE WHEN e.kind='recovery' THEN 'unattributed-recovery' ELSE 'initiator' END",
            entityKind: literal(entity), entityId: 'e.batch_id', revision: 'e.revision', revisionKind: "'batch'",
            nodeAssociation: "'immutable-forward-spec'", recoveryInvalidated: 'p.recovery_invalidated' },
        node:'('+selections.map((_selection,index)=>specNode(`audit_specs_${index}.spec`)).join(' OR ')+')',
        nodeJoins:selections.map(([collection,path],index)=>` LEFT JOIN JSON_TABLE(p.plan,${literal(collection)} COLUMNS (spec JSON PATH ${literal(path)})) audit_specs_${index} ON TRUE`).join('') };
}
function ownerAttempt(family: 'path-publication' | 'ingress-deployment' | 'ingress-migration'): Projection {
    const table = family === 'path-publication' ? 'path_publication' : family === 'ingress-deployment' ? 'ingress_deployment' : 'ingress_migration';
    const owner = family === 'path-publication' ? 'path_publications' : family === 'ingress-deployment' ? 'ingress_deployments' : 'ingress_migrations';
    const accepted = `${boolean('e.outcome','$.accepted')}=TRUE`;
    const receipt = extract('e.outcome','$.result.accepted.body'), state = extract('e.outcome','$.result.state');
    const item = itemAt(planItems('p.plan'),'e.position');
    let source: string;
    let spec: string;
    let prior = '';
    if (family === 'path-publication') {
        source = extract(item,'$.source');
        // Failed compensation guards the accepted apply, not the pre-apply baseline.
        prior = ` LEFT JOIN ${table}_attempts applied ON applied.scope_id=e.scope_id AND applied.batch_id=e.batch_id AND applied.position=e.position AND applied.kind='apply'`;
        source = `CASE WHEN e.kind='compensate' THEN ${extract('applied.outcome','$.result.state')} ELSE ${source} END`;
        spec = extract(source,'$.spec');
    } else if (family === 'ingress-deployment') {
        prior = ` LEFT JOIN ${table}_attempts applied ON applied.scope_id=e.scope_id AND applied.batch_id=e.batch_id AND applied.position=e.position AND applied.kind='create'`;
        source = `CASE WHEN e.kind='compensate' THEN ${extract('applied.outcome','$.result.state')} ELSE NULL END`;
        spec = `CASE WHEN e.kind='create' THEN ${extract(item,'$.spec')} ELSE ${extract(source,'$.spec')} END`;
    } else {
        prior = ` LEFT JOIN ${table}_attempts applied ON applied.scope_id=e.scope_id AND applied.batch_id=e.batch_id AND applied.position=e.position AND applied.kind='apply'`;
        const baseline = extract(itemAt(extract('p.plan','$.sources'),integer(item,'$.source')),'$.state');
        source = `CASE WHEN e.kind='compensate' THEN ${extract('applied.outcome','$.result.state')} ELSE ${baseline} END`;
        spec = `CASE WHEN ${text(item,'$.kind')}='add' AND e.kind='apply' THEN ${extract(item,'$.spec')} ELSE ${extract(source,'$.spec')} END`;
    }
    const forward = `CASE WHEN ${accepted} THEN ${text(receipt,'$.forwardId')} ELSE ${text(source,'$.forwardId')} END`;
    const revision = `CASE WHEN ${accepted} THEN ${integer(receipt,'$.revision')} ELSE ${integer(source,'$.revision')} END`;
    const immutableSpec = `CASE WHEN ${accepted} THEN ${extract(state,'$.spec')} ELSE ${spec} END`;
    const error = `CASE WHEN ${accepted} THEN NULL ELSE ${text('e.outcome','$.error.code')} END`;
    return { from: `${table}_attempts e JOIN ${owner} p ON p.scope_id=e.scope_id AND p.batch_id=e.batch_id` + prior,
        scope: 'e.scope_id=?', pk: ['e.scope_id','e.batch_id','e.position','e.kind'], columns: {
            occurredAt: 'e.created_at', kind: 'e.kind', recordType: "'owner-attempt'", actorId: 'e.actor_id',
            entityKind: literal(family), entityId: 'e.batch_id', position: 'e.position', revision,
            revisionKind: `CASE WHEN (${revision}) IS NULL THEN NULL ELSE 'forward' END`,
            nodeAssociation: "'immutable-forward-spec'", forwardId: forward,
            operationId: `CASE WHEN ${accepted} THEN ${text(receipt,'$.operationId')} ELSE NULL END`,
            outcome: `CASE WHEN ${boolean('e.outcome','$.accepted')} IS NULL THEN 'invalid' WHEN ${accepted} THEN 'accepted' ELSE 'rejected' END`,
            errorCode: knownError(error), retryable: `CASE WHEN ${accepted} THEN NULL ELSE FALSE END`,
            recoveryInvalidated: 'p.recovery_invalidated' }, node: specNode(immutableSpec) };
}
function projection(source: string): Projection {
    switch (source) {
        case 'access': {
            const node = `CASE WHEN e.kind='node_grant_change' THEN ${text('e.details','$.nodeId')} ELSE NULL END`;
            return { from: 'access_events e', scope: 'e.scope_id=?', pk: ['e.id'], columns: {
                occurredAt: 'e.created_at', kind: 'e.kind', actorId: 'e.actor_id', subjectId: 'e.subject_id', entityKind: "'scope-access'",
                entityId: 'e.subject_id', revision: 'e.revision', revisionKind: "CASE WHEN e.kind='node_grant_change' THEN 'grant' ELSE 'access' END",
                nodeId: node, nodeAssociation: "CASE WHEN e.kind='node_grant_change' THEN 'explicit-node' ELSE 'none' END" }, node: `CAST((${node}) AS BINARY)=CAST(${nodeToken} AS BINARY)` };
        }
        case 'node-security': {
            const revision = `COALESCE(${integer('e.details','$.policyRevision')},${integer('e.details','$.revision')})`;
            return { from: 'node_security_events e JOIN nodes owner ON owner.id=e.node_id', scope: 'owner.scope_id=?', pk: ['e.id'],
                columns: { occurredAt: 'e.created_at', kind: 'e.kind', actorId: 'e.actor_id',
                    actorAttribution: "CASE WHEN e.actor_id IS NULL THEN 'unattributed' ELSE 'initiator' END", entityKind: "'node'", entityId: 'e.node_id',
                    revision, revisionKind: `CASE WHEN (${revision}) IS NULL THEN NULL ELSE 'config' END`, nodeId: 'e.node_id', nodeAssociation: "'explicit-node'" }, node: `CAST(e.node_id AS BINARY)=CAST(${nodeToken} AS BINARY)` };
        }
        case 'transport': return { from: 'transport_events e JOIN transport_profiles owner ON owner.id=e.profile_id', scope: 'owner.scope_id=?',
            pk: ['e.id'], columns: { occurredAt: 'e.created_at', kind: "'grant-change'", actorId: 'e.actor_id', subjectId: 'e.subject_id',
                entityKind: "'transport-profile'", entityId: 'e.profile_id', revision: 'e.revision', revisionKind: "'grant'" } };
        case 'path-template': return metadata('path_template_events','template_id','path_template_revisions','path-template');
        case 'path-group': return metadata('path_group_events','group_id','path_group_revisions','path-group','candidates');
        case 'ingress-group': return metadata('ingress_group_events','group_id','ingress_group_revisions','ingress-group','members');
        case 'path-binding':
        case 'path-group-binding': {
            const table = source === 'path-binding' ? 'forward_path_bindings' : 'forward_path_group_bindings';
            return { from: `${table} e JOIN forwards owner ON owner.id=e.forward_id AND owner.scope_id=e.scope_id`, scope: 'e.scope_id=?',
                pk: ['e.forward_id','e.sequence'], columns: { occurredAt: 'e.created_at', kind: "'bind'", recordType: "'immutable-provenance'",
                    actorId: 'e.actor_id', entityKind: "'forward'", entityId: 'e.forward_id', revision: 'e.forward_revision', revisionKind: "'forward'",
                    sequence: 'e.sequence', forwardId: 'e.forward_id', nodeAssociation: "'immutable-forward-spec'", outcome: "'accepted'" }, node: specNode('e.expanded_spec') };
        }
        case 'path-publication': return batchEvent('path_publication_events','path_publications','path-publication',
            [['$.items[*]','$.source.spec'],['$.items[*]','$.proposedSpec']]);
        case 'ingress-deployment': return batchEvent('ingress_deployment_events','ingress_deployments','ingress-deployment',[['$.items[*]','$.spec']]);
        case 'ingress-migration': return batchEvent('ingress_migration_events','ingress_migrations','ingress-migration',
            [['$.items[*]','$.spec'],['$.sources[*]','$.state.spec']]);
        case 'path-publication-attempt': return ownerAttempt('path-publication');
        case 'ingress-deployment-attempt': return ownerAttempt('ingress-deployment');
        case 'ingress-migration-attempt': return ownerAttempt('ingress-migration');
        case 'operation': return { from: 'operations e LEFT JOIN forward_revisions r ON r.forward_id=e.forward_id AND r.revision=e.target_revision',
            scope: 'e.scope_id=?', pk: ['e.id'], columns: { occurredAt: 'e.updated_at', kind: 'e.kind', recordType: "'latest-operation-state'",
                timeMeaning: "'latest-operation-update'", actorId: 'e.requested_by', actorAttribution: "'requester-not-status-actor'",
                entityKind: "'forward'", entityId: 'e.forward_id', revision: 'e.target_revision', revisionKind: "'forward'",
                forwardId: 'e.forward_id', operationId: 'e.id', nodeAssociation: "'immutable-forward-spec'", outcome: 'e.status',
                errorCode: knownError(text('e.last_error','$.code')), retryable: boolean('e.last_error','$.retryable'),
                recoveryInvalidated: 'e.recovery_invalidated' }, node: specNode('r.spec') };
    }
    return invalid('Bounded audit source window required');
}

    return projection;
}

/** No pool, commands, raw owner JSON or current-route reverse joins are exposed by this projection. */
export class MySqlAuditReadStore implements AuditStorage<Transaction> {
    private readonly policy:AuditStoragePolicy;
    private readonly projection:(source:string)=>Projection;
    constructor(policy:AuditStoragePolicy) {this.policy=policy;this.projection=createAuditProjection(policy.errorCodes);}
    async source<R>(tx:Transaction,scope:string,source:string,query:AuditStorageQuery,project:(row:AuditStorageRow)=>R):Promise<R[]> {
        if (!this.policy.sources.includes(source) || !Number.isSafeInteger(query.limit) || query.limit < 1 || query.limit > 50 ||
            !Number.isSafeInteger(query.from) || !Number.isSafeInteger(query.to) || query.from < 0 || query.to <= query.from)
            invalid('Bounded audit source window required');
        if (query.filters.source !== undefined && query.filters.source !== source) return [];
        const selected = this.projection(source), args: unknown[] = [scope];
        let where = selected.scope;
        if (query.filters.nodeId !== undefined) {
            if (!selected.node) return [];
            const node = selected.node.replaceAll(nodeToken, () => { args.push(query.filters.nodeId); return '?'; });
            where += ' AND (' + node + ')';
        }
        const columns: Record<keyof AuditStorageRow, string> = {
            occurredAt: 'NULL', source: literal(source), key: `CONCAT('sha256:',SHA2(CAST(JSON_ARRAY(${selected.pk.join(',')}) AS CHAR CHARACTER SET utf8mb4),256))`,
            kind: 'NULL', recordType: "'owner-event'", timeMeaning: "'recorded-at'", actorId: 'NULL', actorAttribution: "'initiator'",
            subjectId: 'NULL', entityKind: 'NULL', entityId: 'NULL', revision: 'NULL', revisionKind: 'NULL', sequence: 'NULL', position: 'NULL',
            nodeId: 'NULL', nodeAssociation: "'none'", forwardId: 'NULL', operationId: 'NULL', outcome: "'recorded'", errorCode: 'NULL',
            retryable: 'NULL', recoveryInvalidated: 'NULL', ...selected.columns,
        };
        const filters = ['audit.occurredAt>=?', 'audit.occurredAt<?']; args.push(query.from,query.to);
        for (const name of ['actorId','forwardId','operationId','errorCode'] as const) if (query.filters[name] !== undefined) {
            filters.push(`CAST(audit.\`${name}\` AS BINARY)=CAST(? AS BINARY)`); args.push(query.filters[name]);
        }
        if (query.before) {
            filters.push('(audit.occurredAt<? OR (audit.occurredAt=? AND (CAST(audit.source AS BINARY)<CAST(? AS BINARY) OR ' +
                '(CAST(audit.source AS BINARY)=CAST(? AS BINARY) AND CAST(audit.`key` AS BINARY)<CAST(? AS BINARY)))))');
            args.push(query.before.occurredAt,query.before.occurredAt,query.before.source,query.before.source,query.before.key);
        }
        const fields = Object.entries(columns).map(([name,value]) => `${value} AS \`${name}\``).join(',');
        const nodeJoins=query.filters.nodeId!==undefined?selected.nodeJoins??'':'';
        const result = await rows<Record<keyof AuditStorageRow, unknown>>(tx,
            `SELECT audit.* FROM (SELECT ${nodeJoins?'DISTINCT ':''}${fields} FROM ${selected.from}${nodeJoins} WHERE ${where}) audit WHERE ${filters.join(' AND ')} ` +
            `ORDER BY audit.occurredAt DESC,CAST(audit.source AS BINARY) DESC,CAST(audit.\`key\` AS BINARY) DESC LIMIT ${query.limit + 1}`, args);
        const flag = (value: unknown): boolean | null => {
            if (value === null) return null;
            if (value === true || value === 1) return true;
            if (value === false || value === 0) return false;
            throw new ControlError('INTEGRITY_FAILURE',409,'Invalid projected audit flag');
        };
        const counter = (value: unknown): number | null => {
            if (value === null) return null;
            const parsed = typeof value === 'string' && /^(0|[1-9][0-9]{0,15})$(?![\s\S])/.test(value) ? Number(value) : value;
            if (typeof parsed !== 'number' || !Number.isSafeInteger(parsed) || parsed < 0)
                throw new ControlError('INTEGRITY_FAILURE',409,'Invalid projected audit number');
            return parsed;
        };
        // mysql2 may represent BIGINT expressions as decimal strings; never coerce unsafe numbers.
        return result.map(record => project({ ...record, occurredAt: counter(record.occurredAt), revision: counter(record.revision),
            sequence: counter(record.sequence), position: counter(record.position), retryable: flag(record.retryable),
            recoveryInvalidated: flag(record.recoveryInvalidated) }));
    }
}
