import { isCounter, isId } from '@tunex/core';
import { digest } from '@tunex/contracts/shared';
import { ControlError } from '../framework/public.ts';
import type { DiagnosticStorageAssignment, DiagnosticStorageDeployment, DiagnosticStorageDrain, DiagnosticStorageForward, DiagnosticStorageLease, DiagnosticStorageReportContext,
    DiagnosticStorageNode, DiagnosticStorageObservation, DiagnosticStorageOperation, DiagnosticStoragePage, DiagnosticStorageProbe, DiagnosticStorageRetirement,
    DiagnosticStorageSlot, ForwardDiagnosticStorage } from '../framework/public.ts';
import { json, rows } from './mysql.ts';
import type { Transaction } from './mysql.ts';

type Row = Record<string,unknown>;
function corrupt(): never { throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid Forward diagnostic projection'); }
function number(value: unknown, zero = true): number {
    const parsed = typeof value === 'string' && /^(0|[1-9][0-9]{0,15})$(?![\s\S])/.test(value) ? Number(value) : value;
    if (!isCounter(parsed,zero)) corrupt();
    return parsed;
}
function text(value: unknown, maximum = 128): string {
    if (typeof value !== 'string' || value.length > maximum) corrupt();
    return value;
}
function flag(value: unknown): boolean { if (value !== 0 && value !== 1) corrupt(); return value === 1; }
function nullableNumber(value: unknown): number | null { return value === null ? null : number(value); }
function nullableText(value: unknown, maximum = 128): string | null { return value === null ? null : text(value,maximum); }
function stored(value: unknown, maximum: number): unknown {
    try {
        const parsed = json<unknown>(value), encoded = JSON.stringify(parsed);
        if (typeof encoded !== 'string' || Buffer.byteLength(encoded,'utf8') > maximum) corrupt();
        return parsed;
    } catch { return corrupt(); }
}
function scopeId(scope: string): void { if (!isId(scope)) corrupt(); }
function forwardId(scope: string, id: string): void { scopeId(scope); if (!isId(id)) corrupt(); }
function nodeIds(scope: string, input: string[]): string[] {
    scopeId(scope);
    if (!Array.isArray(input) || input.length > 8 || input.some(id => !isId(id)) || new Set(input).size !== input.length) corrupt();
    return [...input];
}
function page<T>(records: Row[], cap: number, map: (row: Row) => T): DiagnosticStoragePage<T> {
    if (records.length > cap + 1) corrupt();
    return { items: records.slice(0,cap).map(map), truncated: records.length > cap };
}
// Paths and aliases passed to these SQL helpers are fixed source literals, never request input.
const extract = (body: string, path: string) => `JSON_EXTRACT(${body},'${path}')`;
const stringSql = (value: string, maximum = 128) => `CASE WHEN JSON_TYPE(${value})='STRING' AND CHAR_LENGTH(JSON_UNQUOTE(${value}))<=${maximum} THEN JSON_UNQUOTE(${value}) ELSE NULL END`;
const integerSql = (value: string) => `CASE WHEN JSON_TYPE(${value})='INTEGER' THEN JSON_UNQUOTE(${value}) ELSE NULL END`;
const boolSql = (value: string) => `CASE WHEN JSON_TYPE(${value})='BOOLEAN' THEN JSON_UNQUOTE(${value}) ELSE NULL END`;
const arraySql = (body: string, path: string, maximum: number) => `CASE WHEN OCTET_LENGTH(${body})<=${maximum} AND JSON_TYPE(${extract(body,path)})='ARRAY' THEN ${extract(body,path)} ELSE JSON_ARRAY() END`;
const assignmentField = (path: string) => `JSON_EXTRACT(s.body,CONCAT('$.assignments[',a.ord-1,']${path}'))`;
const reportField = (collection: 'observations' | 'drains', path: string) => `JSON_EXTRACT(r.last_report,CONCAT('$.${collection}[',q.ord-1,']${path}'))`;
function endpoint(host: unknown, port: unknown, type: unknown): {host:string;port:number} | null {
    if (type === null || type === 'NULL') {
        if (host !== null || port !== null) corrupt();
        return null;
    }
    if (type !== 'OBJECT') corrupt();
    return { host: text(host,253), port: number(port,false) };
}
const key = (value: Pick<DiagnosticStorageAssignment,'nodeId'|'assignmentId'|'deploymentGeneration'|'bindingFence'>) =>
    JSON.stringify([value.nodeId,value.assignmentId,value.deploymentGeneration,value.bindingFence]);

/** Bounded SELECT-only facts on the observation host's transaction; never an execution connection. */
export class MySqlForwardDiagnosticReadStore implements ForwardDiagnosticStorage<Transaction> {
    async forward(tx: Transaction, scope: string, id: string): Promise<DiagnosticStorageForward | null> {
        forwardId(scope,id);
        const [row] = await rows<Row>(tx, `SELECT id,scope_id,revision,IF(OCTET_LENGTH(spec)<=65536,spec,NULL) spec,deleting,recovery_suspended
            FROM forwards WHERE scope_id=? AND id=?`, [scope,id]);
        return row ? { id: text(row.id), scopeId: text(row.scope_id), revision: number(row.revision,false), spec: stored(row.spec,65536),
            deleting: flag(row.deleting), recoverySuspended: flag(row.recovery_suspended) } : null;
    }
    async operations(tx: Transaction, scope: string, id: string): Promise<DiagnosticStoragePage<DiagnosticStorageOperation>> {
        forwardId(scope,id);
        const records = await rows<Row>(tx, `SELECT o.id,o.forward_id,o.target_revision,o.kind,o.status,o.created_at,o.updated_at,o.execution_deadline,
            o.cleanup_pending,o.recovery_invalidated,o.source_operation_id,(o.last_error IS NOT NULL) has_error,
            ${stringSql(extract('o.last_error','$.code'),64)} error_code,${boolSql(extract('o.last_error','$.retryable'))} error_retryable,
            JSON_TYPE(${extract('o.last_error','$.retryable')}) error_retryable_type
            FROM operations o JOIN forwards f ON f.id=o.forward_id
            WHERE f.scope_id=? AND o.scope_id=? AND o.forward_id=? ORDER BY o.created_at DESC,o.id DESC LIMIT 9`, [scope,scope,id]);
        return page(records,8,row => {
            const hasError = flag(row.has_error), retry = row.error_retryable;
            if (hasError && row.error_code === null || retry !== null && retry !== 'true' && retry !== 'false') corrupt();
            if (row.error_retryable_type !== null && row.error_retryable_type !== 'NULL' && row.error_retryable_type !== 'BOOLEAN') corrupt();
            return { id: text(row.id), forwardId: text(row.forward_id), targetRevision: number(row.target_revision,false), kind: text(row.kind,32), status: text(row.status,32),
                createdAt: number(row.created_at), updatedAt: number(row.updated_at), executionDeadline: number(row.execution_deadline), cleanupPending: flag(row.cleanup_pending),
                recoveryInvalidated: flag(row.recovery_invalidated), sourceOperationId: nullableText(row.source_operation_id), errorCode: nullableText(row.error_code,64), errorRetryable: retry === null ? null : retry === 'true' };
        });
    }
    async nodes(tx: Transaction, scope: string, input: string[]): Promise<DiagnosticStorageNode[]> {
        const ids = nodeIds(scope,input); if (!ids.length) return [];
        const snapshotPaths = [['snapshot_node','$.nodeId',128],['snapshot_issued','$.issuedAt',40],['snapshot_valid','$.validUntil',40],['snapshot_digest','$.snapshotDigest',71]] as const;
        const reportPaths = [['report_node','$.nodeId',128],['report_boot','$.bootId',128],['report_observed','$.observedAt',40]] as const;
        const records = await rows<Row>(tx, `SELECT n.id,n.scope_id,n.revoked,n.credential_until,r.boot_id,r.session_epoch,r.snapshot_generation,r.last_report_sequence,r.received_at,
            (s.body IS NOT NULL) has_snapshot,(r.last_report IS NOT NULL) has_report,s.valid_until snapshot_until,
            (OCTET_LENGTH(s.body)<=4194304 AND ${integerSql(extract('s.body','$.protocolVersion'))}='3' AND ${boolSql(extract('s.body','$.complete'))}='true'
                AND JSON_TYPE(${extract('s.body','$.assignments')})='ARRAY' AND JSON_TYPE(${extract('s.body','$.tombstones')})='ARRAY') snapshot_shape,
            (OCTET_LENGTH(r.last_report)<=1048576 AND ${integerSql(extract('r.last_report','$.protocolVersion'))}='3'
                AND JSON_TYPE(${extract('r.last_report','$.observations')})='ARRAY' AND JSON_TYPE(${extract('r.last_report','$.drains')})='ARRAY') report_shape,
            ${snapshotPaths.map(([alias,path,max]) => `${stringSql(extract('s.body',path),max)} ${alias}`).join(',')},
            ${reportPaths.map(([alias,path,max]) => `${stringSql(extract('r.last_report',path),max)} ${alias}`).join(',')},
            ${integerSql(extract('s.body','$.sessionEpoch'))} snapshot_epoch,${integerSql(extract('s.body','$.snapshotGeneration'))} snapshot_generation_body,
            ${integerSql(extract('r.last_report','$.sessionEpoch'))} report_epoch,${integerSql(extract('r.last_report','$.reportSequence'))} report_sequence,
            ${integerSql(extract('r.last_report','$.acceptedSnapshotGeneration'))} report_snapshot
            FROM nodes n LEFT JOIN runtime_nodes r ON r.node_id=n.id
            LEFT JOIN snapshots s ON s.node_id=n.id AND s.generation=r.snapshot_generation AND s.session_epoch=r.session_epoch
            WHERE n.scope_id=? AND n.id IN (${ids.map(() => '?').join(',')}) ORDER BY n.id LIMIT 8`, [scope,...ids]);
        const seen = new Set<string>();
        return records.map(row => {
            const id = text(row.id); if (!ids.includes(id) || seen.has(id)) corrupt(); seen.add(id);
            let snapshot: DiagnosticStorageNode['snapshot'] = null, report: DiagnosticStorageNode['report'] = null;
            let invalidSnapshot = false, invalidReport = false;
            if (flag(row.has_snapshot)) {
                try {
                    if (row.snapshot_shape !== 1) corrupt();
                    snapshot = { nodeId: text(row.snapshot_node), sessionEpoch: number(row.snapshot_epoch,false), generation: number(row.snapshot_generation_body,false),
                        issuedAt: text(row.snapshot_issued,40), validUntil: text(row.snapshot_valid,40), digest: text(row.snapshot_digest,71) };
                    if (Date.parse(snapshot.validUntil) !== number(row.snapshot_until)) invalidSnapshot = true;
                } catch { invalidSnapshot = true; snapshot = null; }
            }
            if (flag(row.has_report)) {
                try {
                    if (row.report_shape !== 1) corrupt();
                    report = { nodeId: text(row.report_node), bootId: text(row.report_boot), sessionEpoch: number(row.report_epoch,false), sequence: number(row.report_sequence,false),
                        snapshotGeneration: number(row.report_snapshot), observedAt: text(row.report_observed,40) };
                } catch { invalidReport = true; report = null; }
            }
            return { nodeId: id, scopeId: text(row.scope_id), revoked: flag(row.revoked), credentialUntil: nullableNumber(row.credential_until), bootId: nullableText(row.boot_id),
                sessionEpoch: row.session_epoch === null ? 0 : number(row.session_epoch), snapshotGeneration: row.snapshot_generation === null ? 0 : number(row.snapshot_generation),
                lastReportSequence: row.last_report_sequence === null ? 0 : number(row.last_report_sequence), receivedAt: nullableNumber(row.received_at), snapshot, report, invalidSnapshot, invalidReport };
        });
    }
    async assignments(tx: Transaction, scope: string, id: string, input: string[]): Promise<DiagnosticStoragePage<DiagnosticStorageAssignment>> {
        forwardId(scope,id); const ids = nodeIds(scope,input); if (!ids.length) return { items: [], truncated: false };
        const fields = [ ['assignment_id','.assignmentId',128],['forward_id','.forwardId',128],['role','.role',32],['protocol','.protocol',3],['phase','.phase',16],
            ['resource_address','.resource.address',127],['resource_protocol','.resource.protocol',3],['driver_id','.driver.id',64],['config_digest','.driver.configDigest',71],
            ['target_host','.driver.config.target.host',253],['peer_host','.driver.config.peerEndpoint.host',253],['hop_target_host','.driver.config.hop.target.host',253],['hop_digest','.driver.config.hop.pathDigest',71] ] as const;
        const integers = [['forward_revision','.forwardRevision'],['deployment_generation','.deploymentGeneration'],['binding_fence','.bindingFence'],['resource_port','.resource.port'],
            ['driver_schema','.driver.schemaVersion'],['target_port','.driver.config.target.port'],['peer_port','.driver.config.peerEndpoint.port'],['hop_target_port','.driver.config.hop.target.port']] as const;
        const binding = assignmentField('.driver.config.binding');
        const records = await rows<Row>(tx, `SELECT n.id node_id,r.session_epoch,r.snapshot_generation,
            ${fields.map(([alias,path,max]) => `${stringSql(assignmentField(path),max)} ${alias}`).join(',')},
            ${integers.map(([alias,path]) => `${integerSql(assignmentField(path))} ${alias}`).join(',')},
            JSON_TYPE(${assignmentField('.driver.config.target')}) target_type,JSON_TYPE(${assignmentField('.driver.config.peerEndpoint')}) peer_type,
            JSON_TYPE(${assignmentField('.driver.config.hop.target')}) hop_target_type,
            CASE WHEN JSON_TYPE(${binding})='OBJECT' AND OCTET_LENGTH(${binding})<=4096 THEN ${binding} ELSE NULL END relay_binding
            FROM nodes n JOIN runtime_nodes r ON r.node_id=n.id
            JOIN snapshots s ON s.node_id=n.id AND s.generation=r.snapshot_generation AND s.session_epoch=r.session_epoch
            JOIN JSON_TABLE(${arraySql('s.body','$.assignments',4194304)},'$[*]' COLUMNS(ord FOR ORDINALITY)) a ON TRUE
            JOIN forwards f ON BINARY f.id=BINARY ${stringSql(assignmentField('.forwardId'))} AND f.scope_id=n.scope_id
            WHERE n.scope_id=? AND f.scope_id=? AND f.id=? AND n.id IN (${ids.map(() => '?').join(',')})
            ORDER BY n.id,a.ord LIMIT 17`, [scope,scope,id,...ids]);
        const result = page<DiagnosticStorageAssignment>(records,16,row => {
            const driver = text(row.driver_id,64);
            let linkDigest: string | null = null, linkKind: DiagnosticStorageAssignment['linkKind'] = 'none';
            if (driver === 'native.relay.v1') {
                const source = stored(row.relay_binding,4096);
                if (!source || typeof source !== 'object' || Array.isArray(source)) corrupt();
                const binding = source as Row;
                const keys = ['scopeId','forwardId','forwardRevision','deploymentGeneration','ingressNodeId','egressNodeId','ingressAssignmentId','egressAssignmentId','ingressSessionEpoch','egressSessionEpoch','ingressFence','egressFence','profileId','profileRevision','profileDigest'];
                if (Object.keys(binding).sort().join(',') !== keys.sort().join(',') || binding.scopeId !== scope || binding.forwardId !== id ||
                    binding.forwardRevision !== number(row.forward_revision,false) || binding.deploymentGeneration !== number(row.deployment_generation,false)) corrupt();
                linkDigest = digest(source); linkKind = 'relay-binding';
            } else if (driver === 'native.multihop.v1') { linkDigest = text(row.hop_digest,71); linkKind = 'hop-path'; }
            return { nodeId: text(row.node_id), sessionEpoch: number(row.session_epoch,false), snapshotGeneration: number(row.snapshot_generation,false), assignmentId: text(row.assignment_id),
                forwardId: text(row.forward_id), forwardRevision: number(row.forward_revision,false), deploymentGeneration: number(row.deployment_generation,false), bindingFence: number(row.binding_fence,false),
                role: text(row.role,32), protocol: text(row.protocol,3) as DiagnosticStorageAssignment['protocol'], phase: text(row.phase,16),
                resource: { address: text(row.resource_address,127), port: number(row.resource_port,false), protocol: text(row.resource_protocol,3) as DiagnosticStorageAssignment['resource']['protocol'] },
                driverId: driver, driverSchemaVersion: number(row.driver_schema,false), configDigest: text(row.config_digest,71),
                target: driver === 'native.multihop.v1' ? endpoint(row.hop_target_host,row.hop_target_port,row.hop_target_type) : endpoint(row.target_host,row.target_port,row.target_type),
                peerEndpoint: endpoint(row.peer_host,row.peer_port,row.peer_type), linkDigest, linkKind, observation: null, drain: null };
        });
        const seen = new Set<string>();
        for (const item of result.items) { const identity = key(item); if (seen.has(identity)) corrupt(); seen.add(identity); }
        if (!result.items.length) return result;
        const observations = await this.reportRows(tx,scope,id,result.items,'observations'), drains = await this.reportRows(tx,scope,id,result.items,'drains');
        const observationMap = new Map<string,DiagnosticStorageObservation>(), drainMap = new Map<string,DiagnosticStorageDrain>();
        for (const row of observations) {
            const identity = this.reportKey(row); if (!seen.has(identity) || observationMap.has(identity) || row.retryable !== 'true' && row.retryable !== 'false') corrupt();
            if (row.error_type !== 'NULL' && row.error_type !== 'STRING' || row.error_type === 'STRING' && row.error_code === null) corrupt();
            observationMap.set(identity, { phase: text(row.phase,16), condition: text(row.condition_code,32), errorCode: nullableText(row.error_code,64), retryable: row.retryable === 'true', report: this.reportContext(row) });
        }
        for (const row of drains) {
            const identity = this.reportKey(row); if (!seen.has(identity) || drainMap.has(identity)) corrupt();
            drainMap.set(identity, { startedAt: text(row.started_at,40), deadline: text(row.deadline,40), remainingConnections: number(row.remaining_connections), condition: text(row.condition_code,32), report: this.reportContext(row) });
        }
        for (const item of result.items) { item.observation = observationMap.get(key(item)) ?? null; item.drain = drainMap.get(key(item)) ?? null; }
        return result;
    }
    private reportKey(row: Row): string {
        return key({ nodeId: text(row.node_id), assignmentId: text(row.assignment_id), deploymentGeneration: number(row.deployment_generation,false), bindingFence: number(row.binding_fence,false) });
    }
    private reportContext(row: Row): DiagnosticStorageReportContext {
        return { nodeId: text(row.report_node), bootId: text(row.report_boot), sessionEpoch: number(row.report_epoch,false), sequence: number(row.report_sequence,false),
            snapshotGeneration: number(row.report_snapshot), observedAt: text(row.report_observed,40), receivedAt: number(row.report_received) };
    }
    private async reportRows(tx: Transaction, scope: string, id: string, selected: DiagnosticStorageAssignment[], collection: 'observations' | 'drains'): Promise<Row[]> {
        const identities = selected.map(item => ({ nodeId: item.nodeId, sessionEpoch: item.sessionEpoch, snapshotGeneration: item.snapshotGeneration,
            assignmentId: item.assignmentId, deploymentGeneration: item.deploymentGeneration, bindingFence: item.bindingFence }));
        const field = (path: string) => reportField(collection,path);
        const projection = collection === 'observations' ? `${stringSql(field('.phase'),16)} phase,${stringSql(field('.condition'),32)} condition_code,
            ${stringSql(field('.errorCode'),64)} error_code,JSON_TYPE(${field('.errorCode')}) error_type,${boolSql(field('.retryable'))} retryable` :
            `${stringSql(field('.startedAt'),40)} started_at,${stringSql(field('.deadline'),40)} deadline,
            ${integerSql(field('.remainingConnections'))} remaining_connections,${stringSql(field('.condition'),32)} condition_code`;
        const records = await rows<Row>(tx, `SELECT n.id node_id,k.assignment_id,k.deployment_generation,k.binding_fence,${projection},
            ${stringSql(extract('r.last_report','$.nodeId'))} report_node,${stringSql(extract('r.last_report','$.bootId'))} report_boot,
            ${integerSql(extract('r.last_report','$.sessionEpoch'))} report_epoch,${integerSql(extract('r.last_report','$.reportSequence'))} report_sequence,
            ${integerSql(extract('r.last_report','$.acceptedSnapshotGeneration'))} report_snapshot,
            ${stringSql(extract('r.last_report','$.observedAt'),40)} report_observed,r.received_at report_received
            FROM JSON_TABLE(?,'$[*]' COLUMNS(node_id VARCHAR(128) PATH '$.nodeId',session_epoch BIGINT UNSIGNED PATH '$.sessionEpoch',
                snapshot_generation BIGINT UNSIGNED PATH '$.snapshotGeneration',assignment_id VARCHAR(128) PATH '$.assignmentId',
                deployment_generation BIGINT UNSIGNED PATH '$.deploymentGeneration',binding_fence BIGINT UNSIGNED PATH '$.bindingFence')) k
            JOIN nodes n ON n.id=k.node_id JOIN forwards f ON f.id=? AND f.scope_id=n.scope_id
            JOIN runtime_nodes r ON r.node_id=n.id AND r.session_epoch=k.session_epoch AND r.snapshot_generation=k.snapshot_generation
            JOIN JSON_TABLE(${arraySql('r.last_report',`$.${collection}`,1048576)},'$[*]' COLUMNS(ord FOR ORDINALITY)) q ON TRUE
            WHERE n.scope_id=? AND f.scope_id=? AND BINARY ${stringSql(field('.assignmentId'))}=BINARY k.assignment_id
                AND ${integerSql(field('.deploymentGeneration'))}=k.deployment_generation AND ${integerSql(field('.bindingFence'))}=k.binding_fence
                AND BINARY ${stringSql(extract('r.last_report','$.nodeId'))}=BINARY n.id
                AND BINARY ${stringSql(extract('r.last_report','$.bootId'))}=BINARY r.boot_id
                AND ${integerSql(extract('r.last_report','$.sessionEpoch'))}=r.session_epoch
                AND ${integerSql(extract('r.last_report','$.reportSequence'))}=r.last_report_sequence
                AND ${integerSql(extract('r.last_report','$.acceptedSnapshotGeneration'))}=r.snapshot_generation
            ORDER BY n.id,q.ord LIMIT 17`, [JSON.stringify(identities),id,scope,scope]);
        if (records.length > selected.length) corrupt();
        return records;
    }
    async deployment(tx: Transaction, scope: string, id: string): Promise<DiagnosticStorageDeployment | null> {
        forwardId(scope,id);
        const [row] = await rows<Row>(tx, `SELECT d.forward_id,d.generation,d.target_revision,d.stage,d.created_at,d.updated_at,
            ${integerSql(extract('d.body','$.authorizationUntil'))} authorization_until,${stringSql(extract('d.body','$.planDigest'),71)} plan_digest
            FROM relay_deployments d JOIN forwards f ON f.id=d.forward_id WHERE f.scope_id=? AND d.forward_id=? ORDER BY d.generation DESC LIMIT 1`, [scope,id]);
        return row ? { forwardId: text(row.forward_id), generation: number(row.generation,false), targetRevision: number(row.target_revision,false), stage: text(row.stage,32),
            createdAt: number(row.created_at), updatedAt: number(row.updated_at), authorizationUntil: number(row.authorization_until), planDigest: text(row.plan_digest,71) } : null;
    }
    async slots(tx: Transaction, scope: string, id: string): Promise<DiagnosticStoragePage<DiagnosticStorageSlot>> {
        forwardId(scope,id);
        const records = await rows<Row>(tx, `SELECT p.node_id,p.protocol,p.port,p.fence,p.deployment_generation FROM port_slots p
            JOIN forwards f ON f.id=p.owner_id JOIN nodes n ON n.id=p.node_id
            WHERE f.scope_id=? AND n.scope_id=? AND f.id=? ORDER BY p.node_id,p.protocol,p.port LIMIT 17`, [scope,scope,id]);
        return page(records,16,row => ({ nodeId: text(row.node_id), protocol: text(row.protocol,3) as DiagnosticStorageSlot['protocol'], port: number(row.port,false), fence: number(row.fence), deploymentGeneration: number(row.deployment_generation) }));
    }
    async retirements(tx: Transaction, scope: string, id: string): Promise<DiagnosticStoragePage<DiagnosticStorageRetirement>> {
        forwardId(scope,id);
        const records = await rows<Row>(tx, `SELECT r.node_id,r.assignment_id,r.deployment_generation,r.binding_fence,r.operation_id,r.removed_epoch,r.retirement_generation,r.safe
            FROM retirements r JOIN forwards f ON f.id=r.forward_id JOIN nodes n ON n.id=r.node_id
            JOIN operations o ON o.id=r.operation_id AND o.forward_id=f.id AND o.scope_id=f.scope_id
            WHERE f.scope_id=? AND n.scope_id=? AND r.forward_id=? ORDER BY r.safe,r.deployment_generation DESC,r.node_id,r.assignment_id,r.binding_fence LIMIT 33`, [scope,scope,id]);
        return page(records,32,row => ({ nodeId: text(row.node_id), assignmentId: text(row.assignment_id), deploymentGeneration: number(row.deployment_generation,false), bindingFence: number(row.binding_fence,false),
            operationId: text(row.operation_id), removedEpoch: nullableNumber(row.removed_epoch), retirementGeneration: nullableNumber(row.retirement_generation), safe: flag(row.safe) }));
    }
    async leases(tx: Transaction, scope: string, id: string): Promise<DiagnosticStoragePage<DiagnosticStorageLease>> {
        forwardId(scope,id);
        const records = await rows<Row>(tx, `SELECT l.node_id,l.assignment_id,l.deployment_generation,l.binding_fence,l.session_epoch,l.valid_until
            FROM execution_leases l JOIN forwards f ON f.id=l.forward_id JOIN nodes n ON n.id=l.node_id
            WHERE f.scope_id=? AND n.scope_id=? AND l.forward_id=? ORDER BY l.valid_until DESC,l.node_id,l.assignment_id,l.deployment_generation DESC,l.binding_fence,l.session_epoch LIMIT 33`, [scope,scope,id]);
        return page(records,32,row => ({ nodeId: text(row.node_id), assignmentId: text(row.assignment_id), deploymentGeneration: number(row.deployment_generation,false), bindingFence: number(row.binding_fence,false),
            sessionEpoch: number(row.session_epoch,false), validUntil: number(row.valid_until) }));
    }
    async probes(tx: Transaction, scope: string, id: string): Promise<DiagnosticStoragePage<DiagnosticStorageProbe>> {
        forwardId(scope,id);
        const records = await rows<Row>(tx, `SELECT p.id,p.state,p.issued_at,p.expires_at,p.closed_at,p.measurement,
            IF(p.tls_context IS NULL OR OCTET_LENGTH(p.tls_context)<=16384,p.tls_context,NULL) tls_context,
            (p.tls_context IS NOT NULL) has_context,
            IF(OCTET_LENGTH(p.binding)<=2048,p.binding,NULL) binding,w.withdrawn_at,v.permit_id result_id,
            IF(OCTET_LENGTH(v.body)<=4096,v.body,NULL) result_body,v.result_digest,v.accepted_at
            FROM probe_permits p JOIN forwards f ON BINARY f.id=BINARY ${stringSql(extract('p.binding','$.forwardId'))} AND f.scope_id=p.scope_id
            LEFT JOIN probe_permit_withdrawals w ON w.permit_id=p.id LEFT JOIN probe_results v ON v.permit_id=p.id
            WHERE p.scope_id=? AND f.scope_id=? AND f.id=? ORDER BY p.issued_at DESC,p.id DESC LIMIT 9`, [scope,scope,id]);
        return page(records,8,row => ({ measurement: text(row.measurement,32), serviceContext: flag(row.has_context)?stored(row.tls_context,16384):null,
            permitId: text(row.id), binding: stored(row.binding,2048), state: text(row.state,32), issuedAt: number(row.issued_at), expiresAt: number(row.expires_at), closedAt: nullableNumber(row.closed_at),
            withdrawnAt: nullableNumber(row.withdrawn_at), result: row.result_id === null ? null : { body: stored(row.result_body,4096), digest: text(row.result_digest,71), acceptedAt: number(row.accepted_at) } }));
    }
}
