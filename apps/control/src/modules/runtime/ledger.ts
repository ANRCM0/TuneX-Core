import { randomUUID } from 'node:crypto';
import { MAX_COUNTER, isCounter } from '@tunex/core';
import type { Forward } from '@tunex/core';
import { ControlError, notFound } from '../../application/errors.ts';
import { rows, write } from '../../infrastructure/mysql.ts';
import type { Transaction } from '../../infrastructure/mysql.ts';
import type { RequestIdentity } from '../idempotency.ts';
import type { ReservedSlot } from './planner.ts';
import { compileDirect, compileSnapshot } from './planner.ts';
import type { AuthorizedNodeFacts } from './planner.ts';
import type { Assignment, Snapshot, Tombstone, ReportRequest, Policy } from '@tunex/contracts';
import { DEFAULT_POLICY } from '@tunex/contracts';
import { json } from '../../infrastructure/mysql.ts';
import type { Forwarding } from '../forwarding.ts';
import { targetAllowed } from '../target-policy.ts';
export interface Operation {
    id: string;
    scope_id: string;
    forward_id: string;
    target_revision: number;
    kind: 'create' | 'update' | 'enable' | 'disable' | 'delete' | 'retry' | 'policy' | 'revoke';
    status: 'accepted' | 'running' | 'succeeded' | 'failed' | 'superseded';
    execution_deadline: number;
    claim_token: string | null;
    claim_until: number | null;
    cleanup_pending: number;
    last_error: unknown;
    source_operation_id: string | null;
    previous_spec: unknown;
    created_at: number;
}
interface Retirement {
    node_id: string;
    assignment_id: string;
    deployment_generation: number;
    binding_fence: number;
    forward_id: string;
    operation_id: string;
    body: unknown;
    removed_epoch: number | null;
    retirement_generation: number;
    safe: number;
}
export class RuntimeLedger {
    private readonly policy:Policy;
    constructor(policy:Policy={...DEFAULT_POLICY}){this.policy={...policy};}
    async assignments(tx: Transaction, forwarding: Forwarding, facts: AuthorizedNodeFacts, includeAccepted = false): Promise<Assignment[]> {
        const forwards = await forwarding.forNode(tx, facts.nodeId);
        if (!forwards.length)
            return [];
        const placeholders = forwards.map(() => '?').join(',');
        const operations = await rows<Operation>(tx, `SELECT * FROM operations WHERE forward_id IN (${placeholders}) ORDER BY created_at DESC,id DESC FOR UPDATE`, forwards.map(forward => forward.id));
        const slots = await rows<{
            owner_id: string;
            protocol: 'tcp' | 'udp';
            port: number;
            fence: number;
            deployment_generation: number;
        }>(tx, 'SELECT * FROM port_slots WHERE node_id=? AND owner_id IS NOT NULL', [facts.nodeId]);
        const assignments: Assignment[] = [];
        for (const forward of forwards) {
            const op = operations.find(op => op.forward_id === forward.id && op.target_revision === forward.revision);
            if (!op || !(op.status === 'succeeded' || ((op.status === 'running' || (includeAccepted && op.status === 'accepted')) && op.execution_deadline > Date.now())))
                continue;
            if (!forward.spec.enabled)
                continue;
            if (op.kind === 'revoke')
                continue;
            if (!facts.allowedListenerAddresses.includes(forward.spec.ingress.listen.address) || !facts.allowedPorts.includes(forward.spec.ingress.listen.port) || !targetAllowed(forward.spec.target.host, facts))
                continue;
            const reservations: ReservedSlot[] = slots.filter(slot => slot.owner_id === forward.id).map(slot => ({ nodeId: facts.nodeId, forwardId: forward.id, protocol: slot.protocol, port: slot.port, bindingFence: slot.fence, deploymentGeneration: slot.deployment_generation }));
            assignments.push(...compileDirect(forward, facts, reservations.filter(slot => slot.port === forward.spec.ingress.listen.port)));
        }
        return assignments.sort((a, b) => a.assignmentId < b.assignmentId ? -1 : 1);
    }
    async assertCapacity(tx: Transaction, forwarding: Forwarding, facts: AuthorizedNodeFacts): Promise<void> {
        const now = Date.now();
        const assignments = await this.assignments(tx, forwarding, facts, true);
        const tombstones = await this.tombstones(tx, facts.nodeId, MAX_COUNTER);
        const previousRow = (await rows<{
            body: unknown;
        }>(tx, 'SELECT body FROM snapshots WHERE node_id=? ORDER BY generation DESC LIMIT 1', [facts.nodeId]))[0];
        for (const old of previousRow ? json<Snapshot>(previousRow.body).assignments : []) {
            if (!assignments.some(a => a.assignmentId === old.assignmentId && a.deploymentGeneration === old.deploymentGeneration && a.bindingFence === old.bindingFence) && !tombstones.some(t => t.assignmentId === old.assignmentId && t.bindingFence === old.bindingFence && t.port === old.listener.port && t.protocol === old.protocol))
                tombstones.push({ assignmentId: old.assignmentId, forwardId: old.forwardId, protocol: old.protocol, port: old.listener.port, bindingFence: old.bindingFence, retirementGeneration: MAX_COUNTER });
        }
        compileSnapshot({ nodeId: facts.nodeId, sessionEpoch: MAX_COUNTER, snapshotGeneration: MAX_COUNTER, issuedAt: new Date(now).toISOString(), validUntil: new Date(now + this.policy.leaseSeconds*1000).toISOString(), assignments, tombstones,policy:this.policy });
    }
    async verifyPublishable(tx: Transaction, assignments: readonly Assignment[]): Promise<void> {
        for (const assignment of assignments) {
            const op = (await rows<Operation>(tx, 'SELECT * FROM operations WHERE forward_id=? AND target_revision=? ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE', [assignment.forwardId, assignment.forwardRevision]))[0];
            if (!op || !(op.status === 'succeeded' || (op.status === 'running' && op.execution_deadline > Date.now())))
                throw new ControlError('STALE_CLAIM', 409, 'Operation expired during compilation');
        }
    }
    async initializeNode(tx: Transaction, nodeId: string): Promise<void> { await write(tx, 'INSERT INTO runtime_nodes(node_id) VALUES(?)', [nodeId]); }
    async lockNode(tx: Transaction, nodeId: string, epoch?: number): Promise<void> {
        const state = (await rows<{
            session_epoch: number;
        }>(tx, 'SELECT session_epoch FROM runtime_nodes WHERE node_id=? FOR UPDATE', [nodeId]))[0];
        if (!state || epoch !== undefined && (!isCounter(epoch) || state.session_epoch !== epoch))
            throw new ControlError('SESSION_SUPERSEDED', 409, 'Current Node session required');
    }
    async maximumAuthorization(tx: Transaction, nodeId: string): Promise<number | null> { return (await rows<{
        until: number | null;
    }>(tx, 'SELECT MAX(valid_until) until FROM execution_leases WHERE node_id=?', [nodeId]))[0]!.until; }
    async latest(tx: Transaction, forwardId: string): Promise<Operation | undefined> { return (await rows<Operation>(tx, 'SELECT * FROM operations WHERE forward_id=? ORDER BY target_revision DESC,created_at DESC,id DESC LIMIT 1', [forwardId]))[0]; }
    async reserve(tx: Transaction, forward: Forward): Promise<ReservedSlot[]> {
        const slots: ReservedSlot[] = [];
        for (const protocol of [...forward.spec.protocols].sort()) {
            const args = [forward.spec.ingress.nodeId, protocol, forward.spec.ingress.listen.port];
            await write(tx, 'INSERT INTO port_slots(node_id,protocol,port) VALUES(?,?,?) ON DUPLICATE KEY UPDATE port=port', args);
            const record = (await rows<{
                owner_id: string | null;
                fence: number;
            }>(tx, 'SELECT owner_id,fence FROM port_slots WHERE node_id=? AND protocol=? AND port=? FOR UPDATE', args))[0]!;
            if (record.owner_id !== null)
                throw new ControlError('PORT_RESERVED', 409, 'Listener port is reserved');
            if (record.fence >= MAX_COUNTER)
                throw new ControlError('RESOURCE_LIMIT', 429, 'Resource counter exhausted');
            await write(tx, 'UPDATE port_slots SET owner_id=?,fence=fence+1,deployment_generation=1 WHERE node_id=? AND protocol=? AND port=?', [forward.id, ...args]);
            slots.push({ nodeId: args[0] as string, forwardId: forward.id, protocol, port: args[2] as number, bindingFence: record.fence + 1, deploymentGeneration: 1 });
        }
        const count = (await rows<{
            n: number;
        }>(tx, 'SELECT COUNT(*) n FROM port_slots WHERE node_id=? AND owner_id IS NOT NULL', [forward.spec.ingress.nodeId]))[0]!.n;
        if (count > this.policy.maxAssignmentsPerNode)
            throw new ControlError('RESOURCE_LIMIT', 429, 'Node assignment capacity exceeded');
        return slots;
    }
    async transition(tx: Transaction, current: Forward, next: Forward): Promise<ReservedSlot[]> {
        const currentRows = await rows<{
            protocol: 'tcp' | 'udp';
            port: number;
            owner_id: string | null;
            fence: number;
            deployment_generation: number;
        }>(tx, 'SELECT * FROM port_slots WHERE node_id=? AND owner_id=? FOR UPDATE', [current.spec.ingress.nodeId, current.id]);
        const result: ReservedSlot[] = [];
        for (const protocol of [...next.spec.protocols].sort()) {
            const args = [next.spec.ingress.nodeId, protocol, next.spec.ingress.listen.port];
            await write(tx, 'INSERT INTO port_slots(node_id,protocol,port) VALUES(?,?,?) ON DUPLICATE KEY UPDATE port=port', args);
            const slot = (await rows<{
                owner_id: string | null;
                fence: number;
                deployment_generation: number;
            }>(tx, 'SELECT owner_id,fence,deployment_generation FROM port_slots WHERE node_id=? AND protocol=? AND port=? FOR UPDATE', args))[0]!;
            if (slot.owner_id !== null && slot.owner_id !== current.id)
                throw new ControlError('PORT_RESERVED', 409, 'Listener port is reserved');
            if (slot.fence >= MAX_COUNTER)
                throw new ControlError('RESOURCE_LIMIT', 429, 'Resource counter exhausted');
            const generation = Math.max(next.revision, slot.deployment_generation + 1, ...currentRows.map(slot => slot.deployment_generation + 1));
            if (generation > MAX_COUNTER)
                throw new ControlError('RESOURCE_LIMIT', 429, 'Deployment counter exhausted');
            await write(tx, 'UPDATE port_slots SET owner_id=?,fence=fence+1,deployment_generation=? WHERE node_id=? AND protocol=? AND port=?', [next.id, generation, ...args]);
            result.push({ nodeId: args[0] as string, forwardId: next.id, protocol, port: args[2] as number, bindingFence: slot.fence + 1, deploymentGeneration: generation });
        }
        // Previous slots stay owned until the new assignment is reported ready; this is the drain safety window.
        return result;
    }
    async releaseForwardSlots(tx: Transaction, forwardId: string): Promise<void> { await write(tx, 'UPDATE port_slots SET owner_id=NULL WHERE owner_id=?', [forwardId]); }
    async accept(tx: Transaction, forward: Forward, request: RequestIdentity, kind: Operation['kind'] = 'create', previousSpec: unknown = null, sourceOperationId: string | null = null): Promise<string> {
        const operationId = randomUUID(), prior = await this.latest(tx, forward.id), now = Math.max(Date.now(), (prior?.created_at ?? 0) + 1);
        await write(tx, "INSERT INTO operations(id,scope_id,forward_id,target_revision,kind,status,requested_by,idempotency_key,request_digest,created_at,updated_at,execution_deadline,source_operation_id,previous_spec) VALUES(?,?,?,? ,?,'accepted',?,?,?,?,?,?,?,?)", [operationId, forward.scopeId, forward.id, forward.revision, kind, request.actorId, request.key, request.digest, now, now, now + 600000, sourceOperationId, previousSpec === null ? null : JSON.stringify(previousSpec)]);
        await write(tx, "UPDATE operations SET status='superseded',superseded_by=?,claim_token=NULL,claim_until=NULL,updated_at=? WHERE forward_id=? AND id<>? AND status IN ('accepted','running')", [operationId, now, forward.id, operationId]);
        await write(tx, 'UPDATE retirements SET operation_id=? WHERE forward_id=? AND safe=FALSE', [operationId, forward.id]);
        return operationId;
    }
    async retireChanged(tx: Transaction, nodeId: string, previous: Snapshot | undefined, next: readonly Assignment[], generation: number): Promise<void> {
        for (const old of previous?.assignments ?? []) {
            if (next.some(a => a.assignmentId === old.assignmentId && a.deploymentGeneration === old.deploymentGeneration && a.bindingFence === old.bindingFence))
                continue;
            const operation = await this.latest(tx, old.forwardId);
            if (!operation)
                throw new Error('Missing retirement owner');
            await write(tx, 'INSERT INTO retirements(node_id,assignment_id,deployment_generation,binding_fence,forward_id,operation_id,body,retirement_generation) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE operation_id=VALUES(operation_id)', [nodeId, old.assignmentId, old.deploymentGeneration, old.bindingFence, old.forwardId, operation.id, JSON.stringify(old), generation]);
            await write(tx, 'UPDATE operations SET cleanup_pending=TRUE WHERE id=?', [operation.id]);
        }
    }
    async recordLeases(tx: Transaction, snapshot: Snapshot): Promise<void> {
        for (const a of snapshot.assignments)
            await write(tx, 'INSERT INTO execution_leases(forward_id,node_id,assignment_id,deployment_generation,binding_fence,session_epoch,valid_until) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE valid_until=GREATEST(valid_until,VALUES(valid_until))', [a.forwardId, snapshot.nodeId, a.assignmentId, a.deploymentGeneration, a.bindingFence, snapshot.sessionEpoch, Date.parse(snapshot.validUntil)]);
    }
    async tombstones(tx: Transaction, nodeId: string, generation: number): Promise<Tombstone[]> {
        const retired = await rows<Retirement>(tx, 'SELECT * FROM retirements WHERE node_id=? ORDER BY retirement_generation,assignment_id', [nodeId]);
        return retired.map(r => { const a = json<Assignment>(r.body); return { assignmentId: a.assignmentId, forwardId: a.forwardId, protocol: a.protocol, port: a.listener.port, bindingFence: a.bindingFence, retirementGeneration: Math.min(r.retirement_generation, generation) }; }).sort((a, b) => (a.protocol < b.protocol ? -1 : a.protocol > b.protocol ? 1 : 0) || a.port - b.port || a.retirementGeneration - b.retirementGeneration || (a.assignmentId < b.assignmentId ? -1 : a.assignmentId > b.assignmentId ? 1 : 0));
    }
    async observeDrains(tx: Transaction, nodeId: string, epoch: number, report: ReportRequest): Promise<void> {
        for (const drain of report.drains) {
            const record = (await rows<Retirement>(tx, 'SELECT * FROM retirements WHERE node_id=? AND assignment_id=? AND deployment_generation=? AND binding_fence=?', [nodeId, drain.assignmentId, drain.deploymentGeneration, drain.bindingFence]))[0];
            if (!record || record.retirement_generation > report.acceptedSnapshotGeneration)
                throw new ControlError('FENCING_REJECTED', 409, 'Unknown or unaccepted draining instance');
            const lease = (await rows<{
                until: number | null;
            }>(tx, 'SELECT MAX(valid_until) until FROM execution_leases WHERE node_id=? AND assignment_id=? AND deployment_generation=? AND binding_fence=? AND session_epoch=?', [nodeId, drain.assignmentId, drain.deploymentGeneration, drain.bindingFence, epoch]))[0];
            if (drain.condition === 'draining' && (!lease?.until || Date.parse(drain.deadline) > lease.until))
                throw new ControlError('LEASE_EXPIRED', 409, 'Drain exceeds its execution authorization');
            if (drain.condition === 'removed' && drain.remainingConnections === 0)
                await write(tx, 'UPDATE retirements SET removed_epoch=? WHERE node_id=? AND assignment_id=? AND deployment_generation=? AND binding_fence=?', [epoch, nodeId, drain.assignmentId, drain.deploymentGeneration, drain.bindingFence]);
        }
    }
    async complete(tx: Transaction, nodeId: string, forwarding: Forwarding, report?: ReportRequest, snapshot?: Snapshot): Promise<void> {
        const authoritative = (await rows<{
            body: unknown;
        }>(tx, 'SELECT body FROM snapshots WHERE node_id=? ORDER BY generation DESC LIMIT 1', [nodeId]))[0];
        const retired = await rows<Retirement>(tx, 'SELECT * FROM retirements WHERE node_id=? AND safe=FALSE FOR UPDATE', [nodeId]);
        for (const r of retired) {
            const outstanding = (await rows<{
                n: number;
            }>(tx, 'SELECT COUNT(*) n FROM execution_leases WHERE node_id=? AND assignment_id=? AND deployment_generation=? AND binding_fence=? AND valid_until+5000>? AND (session_epoch<>? OR ? IS NULL)', [nodeId, r.assignment_id, r.deployment_generation, r.binding_fence, Date.now(), r.removed_epoch, r.removed_epoch]))[0]!.n;
            if (outstanding === 0) {
                await write(tx, 'UPDATE retirements SET safe=TRUE WHERE node_id=? AND assignment_id=? AND deployment_generation=? AND binding_fence=?', [nodeId, r.assignment_id, r.deployment_generation, r.binding_fence]);
            }
        }
        const operations = await rows<Operation>(tx, "SELECT o.* FROM operations o JOIN forwards f ON f.id=o.forward_id AND f.revision=o.target_revision WHERE JSON_UNQUOTE(JSON_EXTRACT(f.spec,'$.ingress.nodeId'))=? AND (o.status='running' OR o.cleanup_pending=TRUE) ORDER BY o.id FOR UPDATE", [nodeId]);
        for (const op of operations) {
            const forward = await forwarding.record(tx, op.scope_id, op.forward_id);
            const pending = (await rows<{
                n: number;
            }>(tx, 'SELECT COUNT(*) n FROM retirements WHERE forward_id=? AND safe=FALSE', [op.forward_id]))[0]!.n;
            if (pending !== 0)
                continue;
            const stopped = forward.deleting || !forward.spec.enabled || op.kind === 'revoke';
            const currentReady = Boolean(report && snapshot && op.execution_deadline > Date.now() && Date.parse(snapshot.validUntil) > Date.now() + 5000 && forward.spec.protocols.every(protocol => { const a = snapshot.assignments.find(a => a.forwardId === forward.id && a.forwardRevision === forward.revision && a.protocol === protocol); return a && report.observations.some(o => o.assignmentId === a.assignmentId && o.deploymentGeneration === a.deploymentGeneration && o.bindingFence === a.bindingFence && o.phase === 'active' && o.condition === 'ready'); }));
            const latest = authoritative ? json<Snapshot>(authoritative.body) : undefined;
            const noCurrentAssignment = Boolean(latest && !latest.assignments.some(a => a.forwardId === forward.id));
            const unsafe = (await rows<{
                n: number;
            }>(tx, 'SELECT COUNT(*) n FROM execution_leases l LEFT JOIN retirements r ON r.node_id=l.node_id AND r.assignment_id=l.assignment_id AND r.deployment_generation=l.deployment_generation AND r.binding_fence=l.binding_fence WHERE l.forward_id=? AND (r.safe IS NULL OR r.safe=FALSE)', [forward.id]))[0]!.n;
            if (stopped && noCurrentAssignment && unsafe === 0) {
                if (forward.deleting)
                    await this.releaseForwardSlots(tx, forward.id);
                await write(tx, "UPDATE operations SET status=IF(status='running','succeeded',status),cleanup_pending=FALSE,updated_at=? WHERE id=?", [Date.now(), op.id]);
                await write(tx, "UPDATE operations SET cleanup_pending=FALSE WHERE forward_id=? AND status IN ('failed','superseded')", [forward.id]);
            }
            else if (op.status === 'failed' && noCurrentAssignment && unsafe === 0) {
                await this.releaseObsoleteSlots(tx, forward);
                await write(tx, 'UPDATE operations SET cleanup_pending=FALSE,updated_at=? WHERE id=?', [Date.now(), op.id]);
            }
            else if (!stopped && currentReady) {
                await this.releaseObsoleteSlots(tx, forward);
                await write(tx, "UPDATE operations SET status=IF(status='running','succeeded',status),cleanup_pending=FALSE,claim_token=NULL,claim_until=NULL,updated_at=? WHERE id=?", [Date.now(), op.id]);
                await write(tx, "UPDATE operations SET cleanup_pending=FALSE WHERE forward_id=? AND status IN ('failed','superseded')", [forward.id]);
            }
        }
    }
    private async releaseObsoleteSlots(tx: Transaction, forward: Forward): Promise<void> {
        const slots = await rows<{
            node_id: string;
            protocol: string;
            port: number;
        }>(tx, 'SELECT node_id,protocol,port FROM port_slots WHERE owner_id=?', [forward.id]);
        for (const slot of slots)
            if (slot.node_id !== forward.spec.ingress.nodeId || slot.port !== forward.spec.ingress.listen.port || !forward.spec.protocols.includes(slot.protocol as 'tcp' | 'udp'))
                await write(tx, 'UPDATE port_slots SET owner_id=NULL WHERE node_id=? AND protocol=? AND port=? AND owner_id=?', [slot.node_id, slot.protocol, slot.port, forward.id]);
    }
    async get(tx: Transaction, scope: string, id: string): Promise<Operation> {
        const op = (await rows<Operation>(tx, 'SELECT * FROM operations WHERE id=? AND scope_id=? FOR UPDATE', [id, scope]))[0];
        if (!op)
            notFound();
        return op;
    }
    async read(tx: Transaction, scope: string, id: string): Promise<Operation> {
        const op = (await rows<Operation>(tx, 'SELECT * FROM operations WHERE id=? AND scope_id=?', [id, scope]))[0];
        if (!op)
            notFound();
        return op;
    }
    async claim(tx: Transaction): Promise<Operation | undefined> {
        const now = Date.now();
        await write(tx, "UPDATE operations SET status='failed',last_error=?,cleanup_pending=TRUE,claim_token=NULL,claim_until=NULL,updated_at=? WHERE status IN ('accepted','running') AND execution_deadline<=?", [JSON.stringify({ code: 'EXECUTION_DEADLINE', retryable: false }), now, now]);
        const op = (await rows<Operation>(tx, "SELECT * FROM operations WHERE status IN ('accepted','running') AND (claim_until IS NULL OR claim_until<=?) AND execution_deadline>? ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED", [now, now]))[0];
        if (!op)
            return undefined;
        const token = randomUUID();
        await write(tx, "UPDATE operations SET status='running',claim_token=?,claim_until=?,attempt_count=attempt_count+1,updated_at=? WHERE id=?", [token, now + 15000, now, op.id]);
        return { ...op, status: 'running', claim_token: token, claim_until: now + 15000 };
    }
}
