import { isCounter, isId } from '@tunex/core';
import { digest } from '@tunex/contracts/shared';
import { parseRuntimeMessage } from '@tunex/contracts/runtime';
import type { DirectConfig, RuntimeSnapshot } from '@tunex/contracts/runtime';
import type { ProbeTelemetryPoint } from '@tunex/contracts/observability';
import { ControlError } from '../framework/public.ts';
import type { TelemetryProbeMapping, TelemetryObservedMappingPort } from '../framework/public.ts';
import { rows } from './mysql.ts';
import type { Transaction } from './mysql.ts';

type NodeBinding = { nodeId: string; bootId: string; sessionEpoch: number; fingerprint: string };
type ProbeTelemetryMapping=TelemetryProbeMapping<ProbeTelemetryPoint['identity']>;
interface NodeRow {
    scope_id: string; session_epoch: number; boot_id: string | null;
    instance_id: string | null; instance_generation: number | null; instance_state: string | null;
    instance_boot: string | null; instance_session: number | null; instance_fingerprint: string | null;
    instance_registered_at: number | null; instance_until: number | null; instance_revoked_at: number | null;
}
interface SnapshotRow { generation: number; session_epoch: number; valid_until: number; body: unknown }
interface ForwardRow { id: string; scope_id: string; recovery_suspended: number }
function corrupt(): never { throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid published Probe telemetry provenance'); }
function counter(value: unknown, zero = false): number {
    if (!isCounter(value, zero)) corrupt();
    return value as number;
}
function flag(value: unknown): boolean {
    if (value !== 0 && value !== 1 && value !== false && value !== true) corrupt();
    return value === 1 || value === true;
}
function timestamp(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 253402300799999;
}
function rawBody(value: unknown): string {
    if (value === null || value === undefined) corrupt();
    const raw = typeof value === 'string' ? value : JSON.stringify(value);
    if (typeof raw !== 'string' || Buffer.byteLength(raw) > 4194304) corrupt();
    return raw;
}

/** SELECT-only immutable Snapshot provenance on the supplied observation transaction. */
export class MySqlProbeTelemetryMapping implements TelemetryObservedMappingPort<Transaction,NodeBinding,ProbeTelemetryPoint,ProbeTelemetryMapping> {
    async resolve(tx: Transaction, node: NodeBinding, points: readonly ProbeTelemetryPoint[], observedAt: number) {
        if (!isId(node.nodeId) || !isId(node.bootId) || !isCounter(node.sessionEpoch) ||
            !/^[a-f0-9]{64}$/.test(node.fingerprint) || !Number.isSafeInteger(observedAt) || observedAt < 0 ||
            !Array.isArray(points) || points.length > 32) corrupt();
        const result: (ProbeTelemetryMapping | null)[] = points.map(() => null);
        if (!points.length) return result;
        const generations = [...new Set(points.map(point => counter(point.identity.binding.snapshotGeneration)))];
        if (generations.length > 2) corrupt();
        const [current] = await rows<NodeRow>(tx, `SELECT n.scope_id,r.session_epoch,r.boot_id,
            p.instance_id,p.generation instance_generation,p.state instance_state,p.boot_id instance_boot,
            p.session_epoch instance_session,p.fingerprint instance_fingerprint,p.registered_at instance_registered_at,
            p.expires_at instance_until,p.revoked_at instance_revoked_at
            FROM nodes n JOIN runtime_nodes r ON r.node_id=n.id
            LEFT JOIN probe_instances p ON p.node_id=n.id WHERE n.id=?`, [node.nodeId]);
        if (!current) return result;
        if (!isId(current.scope_id)) corrupt();
        if (counter(current.session_epoch, true) !== node.sessionEpoch || current.boot_id !== node.bootId) return result;
        const snapshots = new Map<number, RuntimeSnapshot>();
        for (const row of await rows<SnapshotRow>(tx, `SELECT generation,session_epoch,valid_until,
            IF(OCTET_LENGTH(body)<=4194304,body,NULL) body FROM snapshots
            WHERE node_id=? AND session_epoch=? AND generation IN (${generations.map(() => '?').join(',')})`,
            [node.nodeId, node.sessionEpoch, ...generations])) {
            try {
                const snapshot = parseRuntimeMessage('Snapshot', rawBody(row.body));
                if (snapshot.nodeId !== node.nodeId || snapshot.sessionEpoch !== node.sessionEpoch ||
                    counter(row.session_epoch) !== node.sessionEpoch || snapshot.snapshotGeneration !== counter(row.generation) ||
                    !generations.includes(row.generation) || Date.parse(snapshot.validUntil) !== counter(row.valid_until) ||
                    snapshots.has(row.generation)) corrupt();
                snapshots.set(row.generation, snapshot);
            } catch { corrupt(); }
        }
        const candidates = points.map(point => {
            const reported = point.identity.binding, snapshot = snapshots.get(reported.snapshotGeneration);
            const assignment = snapshot?.assignments.find(value => value.assignmentId === reported.assignmentId);
            if (!snapshot || !assignment || assignment.role !== 'direct' || assignment.protocol !== 'tcp' ||
                assignment.phase !== 'active' || assignment.driver.id !== 'native.direct.v1' || assignment.driver.schemaVersion !== 1)
                return null;
            const config = assignment.driver.config as DirectConfig;
            if (digest(config) !== assignment.driver.configDigest || !isCounter(config.egressPolicyRevision)) corrupt();
            const binding = { nodeId: node.nodeId, bootId: node.bootId, sessionEpoch: node.sessionEpoch,
                snapshotGeneration: snapshot.snapshotGeneration, assignmentId: assignment.assignmentId,
                forwardId: assignment.forwardId, forwardRevision: assignment.forwardRevision,
                deploymentGeneration: assignment.deploymentGeneration, bindingFence: assignment.bindingFence,
                configDigest: assignment.driver.configDigest, egressPolicyRevision: config.egressPolicyRevision };
            if (reported.nodeId !== binding.nodeId || reported.bootId !== binding.bootId || reported.sessionEpoch !== binding.sessionEpoch ||
                reported.snapshotGeneration !== binding.snapshotGeneration || reported.assignmentId !== binding.assignmentId ||
                reported.forwardId !== binding.forwardId || reported.forwardRevision !== binding.forwardRevision ||
                reported.deploymentGeneration !== binding.deploymentGeneration || reported.bindingFence !== binding.bindingFence ||
                reported.configDigest !== binding.configDigest || reported.egressPolicyRevision !== binding.egressPolicyRevision) return null;
            return { identity: { ...point.identity, binding }, publishedUntil: Date.parse(snapshot.validUntil) };
        });
        const forwardIds = [...new Set(candidates.flatMap(value => value ? [value.identity.binding.forwardId] : []))];
        if (!forwardIds.length) return result;
        const forwards = new Map<string, ForwardRow>();
        for (const row of await rows<ForwardRow>(tx, `SELECT id,scope_id,recovery_suspended FROM forwards
            WHERE id IN (${forwardIds.map(() => '?').join(',')})`, forwardIds)) {
            if (!isId(row.id) || !isId(row.scope_id) || !forwardIds.includes(row.id) || forwards.has(row.id)) corrupt();
            flag(row.recovery_suspended); forwards.set(row.id, row);
        }
        for (let index = 0; index < candidates.length; index++) {
            const candidate = candidates[index];
            if (!candidate) continue;
            const forward = forwards.get(candidate.identity.binding.forwardId);
            if (!forward || forward.scope_id !== current.scope_id) corrupt();
            const registered = current.instance_state === 'registered' && current.instance_id === candidate.identity.instanceId &&
                current.instance_generation === candidate.identity.instanceGeneration && current.instance_boot === node.bootId &&
                current.instance_session === node.sessionEpoch && current.instance_fingerprint === node.fingerprint &&
                timestamp(current.instance_registered_at) && timestamp(current.instance_until) &&
                current.instance_registered_at <= observedAt && observedAt < current.instance_until &&
                current.instance_until <= current.instance_registered_at + 30000 && current.instance_revoked_at === null;
            result[index] = { identity: candidate.identity, scopeId: forward.scope_id, source: 'published-snapshot',
                publishedUntil: candidate.publishedUntil, probeInstance: registered ? 'current-registered' : 'not-rechecked',
                instanceUntil: registered ? current.instance_until : null, forwardRecoverySuspended: flag(forward.recovery_suspended) };
        }
        return result;
    }
}
