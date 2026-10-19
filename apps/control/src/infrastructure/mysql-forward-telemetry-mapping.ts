import { isCounter, isId } from '@tunex/core';
import { digest, parseJson } from '@tunex/contracts/shared';
import { parseForwardTelemetryIdentity } from '@tunex/contracts/observability';
import { parseRelayAssignment, parseRuntimeMessage, validateHopConfig } from '@tunex/contracts/runtime';
import type { ForwardTelemetryPoint } from '@tunex/contracts/observability';
import type { MultihopConfig, RelayConfig, RuntimeAssignment } from '@tunex/contracts/runtime';
import { ControlError } from '../framework/public.ts';
import type { TelemetryPublishedMapping, TelemetryForwardMappingSource, TelemetryPublishedMappingPort } from '../framework/public.ts';
import { rows } from './mysql.ts';
import type { Transaction } from './mysql.ts';

type NodeBinding = { nodeId: string; bootId: string; sessionEpoch: number };
type Identity = ForwardTelemetryPoint['identity'];
type ForwardTelemetryMapping=TelemetryPublishedMapping<Identity,TelemetryForwardMappingSource>;
interface CurrentRow {
    scope_id: string; snapshot_generation: number; generation: number | null;
    session_epoch: number | null; valid_until: number | null; body: unknown;
}
interface ForwardRow { id: string; scope_id: string; recovery_suspended: number }
interface RetiredRow {
    assignment_id: string; deployment_generation: number; binding_fence: number;
    forward_id: string; scope_id: string; recovery_suspended: number;
    valid_until: number; body: unknown;
}
const maximumBodyBytes = 4194304;
function corrupt(): never { throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid published telemetry provenance'); }
function counter(value: unknown, zero = false): number {
    if (!isCounter(value, zero)) corrupt();
    return value as number;
}
function flag(value: unknown): boolean {
    if (value !== 0 && value !== 1 && value !== false && value !== true) corrupt();
    return value === 1 || value === true;
}
function body(value: unknown): string {
    if (value === null || value === undefined) corrupt();
    const raw = typeof value === 'string' ? value : JSON.stringify(value);
    if (typeof raw !== 'string' || Buffer.byteLength(raw) > maximumBodyBytes) corrupt();
    return raw;
}
function key(value: { assignmentId: string; deploymentGeneration: number; bindingFence: number }): string {
    return `${value.assignmentId}/${value.deploymentGeneration}/${value.bindingFence}`;
}
function ingress(value: RuntimeAssignment): boolean {
    return value.role === 'direct' || value.role === 'relay-ingress' || value.role === 'multihop-ingress';
}
function identity(node: NodeBinding, assignment: RuntimeAssignment): Identity {
    return parseForwardTelemetryIdentity({ ...node, assignmentId: assignment.assignmentId,
        forwardId: assignment.forwardId, forwardRevision: assignment.forwardRevision,
        deploymentGeneration: assignment.deploymentGeneration, bindingFence: assignment.bindingFence,
        role: assignment.role, protocol: assignment.protocol, driverId: assignment.driver.id,
        driverSchemaVersion: assignment.driver.schemaVersion, configDigest: assignment.driver.configDigest,
        resource: { ...assignment.resource } });
}
function same(a: Identity, b: Identity): boolean {
    return a.nodeId === b.nodeId && a.bootId === b.bootId && a.sessionEpoch === b.sessionEpoch &&
        a.assignmentId === b.assignmentId && a.forwardId === b.forwardId && a.forwardRevision === b.forwardRevision &&
        a.deploymentGeneration === b.deploymentGeneration && a.bindingFence === b.bindingFence &&
        a.role === b.role && a.protocol === b.protocol && a.driverId === b.driverId &&
        a.driverSchemaVersion === b.driverSchemaVersion && a.configDigest === b.configDigest &&
        a.resource.protocol === b.resource.protocol && a.resource.address === b.resource.address &&
        a.resource.port === b.resource.port;
}
function scopeBinding(assignment: RuntimeAssignment, node: NodeBinding, scope: string): void {
    if (!isId(scope) || !assignment.driver.config || typeof assignment.driver.config !== 'object' ||
        digest(assignment.driver.config) !== assignment.driver.configDigest) corrupt();
    if (assignment.role === 'relay-ingress') {
        parseRelayAssignment('Assignment', JSON.stringify({ ...assignment, protocolVersion: 3,
            nodeId: node.nodeId, sessionEpoch: node.sessionEpoch }));
        if ((assignment.driver.config as RelayConfig).binding.scopeId !== scope) corrupt();
    } else if (assignment.role === 'multihop-ingress') {
        const hop = (assignment.driver.config as MultihopConfig).hop;
        validateHopConfig(hop);
        const local = hop.path[0];
        if (!local || hop.hopIndex !== 0 || hop.scopeId !== scope || hop.forwardId !== assignment.forwardId ||
            hop.forwardRevision !== assignment.forwardRevision || hop.deploymentGeneration !== assignment.deploymentGeneration ||
            hop.protocol !== assignment.protocol || local.nodeId !== node.nodeId || local.sessionEpoch !== node.sessionEpoch ||
            local.assignmentId !== assignment.assignmentId || local.bindingFence !== assignment.bindingFence ||
            local.listenAddress !== assignment.resource.address || local.port !== assignment.resource.port) corrupt();
    }
}

/** SELECT-only published mapping on the caller's telemetry transaction and deadline. */
export class MySqlForwardTelemetryMapping implements TelemetryPublishedMappingPort<Transaction,NodeBinding,ForwardTelemetryPoint,ForwardTelemetryMapping> {
    async resolve(tx: Transaction, node: NodeBinding,
        points: readonly ForwardTelemetryPoint[]): Promise<readonly (ForwardTelemetryMapping | null)[]> {
        if (!isId(node.nodeId) || !isId(node.bootId) || !isCounter(node.sessionEpoch) ||
            !Array.isArray(points) || points.length > 32) corrupt();
        const result: (ForwardTelemetryMapping | null)[] = points.map(() => null);
        if (!points.length) return result;
        const [current] = await rows<CurrentRow>(tx, `SELECT n.scope_id,r.snapshot_generation,
            s.generation,s.session_epoch,s.valid_until,
            IF(OCTET_LENGTH(s.body)<=4194304,s.body,NULL) body
            FROM nodes n JOIN runtime_nodes r ON r.node_id=n.id
            LEFT JOIN snapshots s ON s.node_id=r.node_id AND s.generation=r.snapshot_generation
            WHERE n.id=? AND r.session_epoch=? AND r.boot_id=?`, [node.nodeId, node.sessionEpoch, node.bootId]);
        if (!current) return result;
        if (!isId(current.scope_id)) corrupt();
        counter(current.snapshot_generation, true);
        const published = new Map<string, RuntimeAssignment>();
        let currentUntil = 0;
        if (current.generation !== null) {
            // Hello can establish a new session before its first Snapshot is published.
            if (counter(current.session_epoch) !== node.sessionEpoch) return result;
            try {
                const snapshot = parseRuntimeMessage('Snapshot', body(current.body));
                currentUntil = counter(current.valid_until);
                if (snapshot.nodeId !== node.nodeId || snapshot.sessionEpoch !== node.sessionEpoch ||
                    counter(current.session_epoch) !== node.sessionEpoch ||
                    snapshot.snapshotGeneration !== counter(current.generation) ||
                    current.generation !== current.snapshot_generation || Date.parse(snapshot.validUntil) !== currentUntil) corrupt();
                for (const assignment of snapshot.assignments) if (ingress(assignment)) published.set(key(assignment), assignment);
            } catch { corrupt(); }
        } else if (current.snapshot_generation !== 0) {
            // An absent current-session Snapshot is not an empty, usable execution map.
            corrupt();
        }
        const candidates = points.map(point => published.get(key(point.identity)));
        const forwardIds = [...new Set(candidates.flatMap(assignment => assignment ? [assignment.forwardId] : []))];
        const forwards = new Map<string, ForwardRow>();
        if (forwardIds.length) {
            for (const row of await rows<ForwardRow>(tx, `SELECT id,scope_id,recovery_suspended FROM forwards
                WHERE id IN (${forwardIds.map(() => '?').join(',')})`, forwardIds)) {
                if (!isId(row.id) || !isId(row.scope_id)) corrupt();
                flag(row.recovery_suspended);
                forwards.set(row.id, row);
            }
        }
        for (let index = 0; index < points.length; index++) {
            const assignment = candidates[index];
            if (!assignment) continue;
            const forward = forwards.get(assignment.forwardId);
            if (!forward || forward.scope_id !== current.scope_id) corrupt();
            try {
                const trusted = identity(node, assignment);
                scopeBinding(assignment, node, forward.scope_id);
                if (same(trusted, points[index]!.identity)) result[index] = { identity: trusted,
                    scopeId: forward.scope_id, source: 'current-published', publishedUntil: currentUntil,
                    forwardRecoverySuspended: flag(forward.recovery_suspended) };
            } catch { corrupt(); }
        }
        const missing = points.flatMap((point, index) => candidates[index] ? [] : [point.identity]);
        if (!missing.length) return result;
        const retired = await rows<RetiredRow>(tx, `SELECT r.assignment_id,r.deployment_generation,r.binding_fence,
            r.forward_id,f.scope_id,f.recovery_suspended,l.valid_until,
            IF(OCTET_LENGTH(r.body)<=4194304,r.body,NULL) body
            FROM retirements r JOIN execution_leases l ON l.node_id=r.node_id
                AND l.assignment_id=r.assignment_id AND l.deployment_generation=r.deployment_generation
                AND l.binding_fence=r.binding_fence AND l.forward_id=r.forward_id AND l.session_epoch=?
            JOIN forwards f ON f.id=r.forward_id
            WHERE r.node_id=? AND (r.assignment_id,r.deployment_generation,r.binding_fence)
                IN (${missing.map(() => '(?,?,?)').join(',')})`, [node.sessionEpoch, node.nodeId,
            ...missing.flatMap(item => [item.assignmentId, item.deploymentGeneration, item.bindingFence])]);
        const historical = new Map<string, ForwardTelemetryMapping>();
        if (retired.length > 32) corrupt();
        for (const row of retired) {
            try {
                const assignment = parseJson(body(row.body), maximumBodyBytes) as RuntimeAssignment;
                if (!assignment || assignment.assignmentId !== row.assignment_id ||
                    assignment.forwardId !== row.forward_id || assignment.deploymentGeneration !== counter(row.deployment_generation) ||
                    assignment.bindingFence !== counter(row.binding_fence) || row.scope_id !== current.scope_id ||
                    !['prepared', 'active', 'draining'].includes(assignment.phase) ||
                    !isCounter(assignment.drainTimeoutSeconds, true)) corrupt();
                if (!ingress(assignment)) continue;
                const trusted = identity(node, assignment);
                scopeBinding(assignment, node, row.scope_id);
                const instanceKey = key(assignment);
                if (historical.has(instanceKey)) corrupt();
                historical.set(instanceKey, { identity: trusted, scopeId: row.scope_id, source: 'retired-published',
                    publishedUntil: counter(row.valid_until), forwardRecoverySuspended: flag(row.recovery_suspended) });
            } catch { corrupt(); }
        }
        for (let index = 0; index < points.length; index++) {
            if (candidates[index]) continue;
            const mapped = historical.get(key(points[index]!.identity));
            if (mapped && same(mapped.identity, points[index]!.identity)) result[index] = mapped;
        }
        return result;
    }
}
