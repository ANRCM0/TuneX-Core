import { digest, DEFAULT_POLICY } from '@tunex/contracts';
import type { HelloRequest, HelloResponse, Snapshot, ReportRequest, ReportAck, Observation } from '@tunex/contracts';
import { MAX_COUNTER, isCounter } from '@tunex/core';
import type { Forward } from '@tunex/core';
import { ControlError } from '../../application/errors.ts';
import { json, rows, write } from '../../infrastructure/mysql.ts';
import type { MySqlUnitOfWork, Transaction } from '../../infrastructure/mysql.ts';
import type { Nodes } from '../nodes.ts';
import type { Forwarding } from '../forwarding.ts';
import { RuntimeLedger } from './ledger.ts';
import type { Operation } from './ledger.ts';
import { compileSnapshot } from './planner.ts';
interface RuntimeNode {
    node_id: string;
    session_epoch: number;
    boot_id: string | null;
    snapshot_generation: number;
    last_report_sequence: number;
    last_report: unknown;
    received_at: number | null;
}
export class RuntimeController {
    private readonly db: MySqlUnitOfWork;
    private readonly nodes: Nodes;
    private readonly forwarding: Forwarding;
    private readonly ledger: RuntimeLedger;
    constructor(db: MySqlUnitOfWork, nodes: Nodes, forwarding: Forwarding, ledger: RuntimeLedger) { this.db = db; this.nodes = nodes; this.forwarding = forwarding; this.ledger = ledger; }
    private async locked(tx: Transaction, nodeId: string, epoch?: number): Promise<RuntimeNode> {
        const state = (await rows<RuntimeNode>(tx, 'SELECT * FROM runtime_nodes WHERE node_id=? FOR UPDATE', [nodeId]))[0];
        if (!state || (epoch !== undefined && (!isCounter(epoch) || state.session_epoch !== epoch)))
            throw new ControlError('SESSION_SUPERSEDED', 409, 'Current Node session required');
        return state;
    }
    async hello(nodeId: string, input: HelloRequest, fingerprint?: string): Promise<HelloResponse> {
        if (input.nodeId !== nodeId)
            throw new ControlError('AUTHORIZATION_DENIED', 403, 'Foreign Node identity');
        if ((!input.capabilities.includes('tcp') && !input.capabilities.includes('udp')) || !input.capabilities.includes('native.direct.v1'))
            throw new ControlError('UNSUPPORTED_CAPABILITY', 409, 'Direct protocol capability required');
        return this.db.transaction(async (tx) => {
            const current = await this.locked(tx, nodeId);
            if (fingerprint)
                await this.nodes.credential(tx, nodeId, fingerprint);
            await this.nodes.facts(tx, nodeId);
            if (input.lastStoredSnapshotGeneration > current.snapshot_generation)
                throw new ControlError('INTEGRITY_FAILURE', 409, 'Control history is older than Node state');
            let epoch = current.session_epoch;
            const boot = (await rows<{
                session_epoch: number;
            }>(tx, 'SELECT session_epoch FROM node_boots WHERE node_id=? AND boot_id=?', [nodeId, input.bootId]))[0];
            if (boot && (boot.session_epoch !== epoch || input.bootId !== current.boot_id))
                throw new ControlError('SESSION_SUPERSEDED', 409, 'Boot already retired');
            if (!boot) {
                if (epoch >= MAX_COUNTER)
                    throw new ControlError('RESOURCE_LIMIT', 429, 'Session counter exhausted');
                epoch++;
                await write(tx, 'INSERT INTO node_boots(node_id,boot_id,session_epoch) VALUES(?,?,?)', [nodeId, input.bootId, epoch]);
                await write(tx, 'UPDATE runtime_nodes SET session_epoch=?,boot_id=?,last_report_sequence=0,last_report=NULL,received_at=NULL WHERE node_id=?', [epoch, input.bootId, nodeId]);
                await this.nodes.capabilities(tx, nodeId, input.capabilities);
            }
            return { protocolVersion: 2, nodeId, bootId: input.bootId, sessionEpoch: epoch, serverTime: new Date().toISOString(), policy: { ...DEFAULT_POLICY } };
        });
    }
    private async publish(tx: Transaction, state: RuntimeNode, claim?: {
        id: string;
        token: string;
        until: number;
    }, fingerprint?: string): Promise<Snapshot> {
        const node = await this.nodes.state(tx, state.node_id);
        const { facts } = node;
        const credentialUntil = fingerprint ? await this.nodes.credential(tx, state.node_id, fingerprint) : node.credentialUntil;
        const withdrawn = node.revoked || credentialUntil <= Date.now();
        const previousRecord = (await rows<{
            body: unknown;
        }>(tx, 'SELECT body FROM snapshots WHERE node_id=? AND generation=?', [state.node_id, state.snapshot_generation]))[0];
        const previous = previousRecord ? json<Snapshot>(previousRecord.body) : undefined;
        const now = Date.now();
        const awaitingClaim = (await rows<{
            n: number;
        }>(tx, "SELECT COUNT(*) n FROM operations o JOIN forwards f ON f.id=o.forward_id AND f.revision=o.target_revision WHERE o.status='accepted' AND JSON_UNQUOTE(JSON_EXTRACT(f.spec,'$.ingress.nodeId'))=?", [state.node_id]))[0]!.n;
        // Preserve the last explicit authorization until persisted work is claimed; do not renew it.
        if (!withdrawn && awaitingClaim > 0 && previous?.sessionEpoch === state.session_epoch && Date.parse(previous.validUntil) > now + 5000 && Date.parse(previous.validUntil) <= credentialUntil)
            return previous;
        const assignments = withdrawn ? [] : await this.ledger.assignments(tx, this.forwarding, facts);
        if (previous && previous.sessionEpoch === state.session_epoch && digest(previous.assignments) === digest(assignments) && Date.parse(previous.validUntil) <= credentialUntil && Date.parse(previous.validUntil) - now > DEFAULT_POLICY.renewalLeadSeconds * 1000)
            return previous;
        if (!state.session_epoch)
            throw new ControlError('SESSION_SUPERSEDED', 409, 'Hello required before snapshot');
        if (state.snapshot_generation >= MAX_COUNTER)
            throw new ControlError('RESOURCE_LIMIT', 429, 'Snapshot counter exhausted');
        await this.ledger.retireChanged(tx, state.node_id, previous, assignments, state.snapshot_generation + 1);
        const tombstones = await this.ledger.tombstones(tx, state.node_id, state.snapshot_generation + 1);
        const validUntil = !withdrawn ? Math.min(now + DEFAULT_POLICY.leaseSeconds * 1000, credentialUntil) : now + DEFAULT_POLICY.leaseSeconds * 1000;
        const snapshot = compileSnapshot({ nodeId: state.node_id, sessionEpoch: state.session_epoch, snapshotGeneration: state.snapshot_generation + 1, issuedAt: new Date(now).toISOString(), validUntil: new Date(validUntil).toISOString(), assignments, tombstones });
        await this.ledger.verifyPublishable(tx, assignments);
        if (claim) {
            const current = (await rows<Operation>(tx, 'SELECT * FROM operations WHERE id=? FOR UPDATE', [claim.id]))[0];
            if (!current || current.status !== 'running' || current.claim_token !== claim.token || claim.until <= Date.now() || current.execution_deadline <= Date.now())
                throw new ControlError('STALE_CLAIM', 409, 'Worker claim expired before publication');
        }
        await write(tx, 'INSERT INTO snapshots(node_id,generation,session_epoch,valid_until,body) VALUES(?,?,?,?,?)', [state.node_id, snapshot.snapshotGeneration, state.session_epoch, Date.parse(snapshot.validUntil), JSON.stringify(snapshot)]);
        await write(tx, 'UPDATE runtime_nodes SET snapshot_generation=? WHERE node_id=?', [snapshot.snapshotGeneration, state.node_id]);
        await this.ledger.recordLeases(tx, snapshot);
        return snapshot;
    }
    async snapshot(nodeId: string, epoch: number, fingerprint?: string): Promise<Snapshot> { return this.db.transaction(async (tx) => { const snapshot = await this.publish(tx, await this.locked(tx, nodeId, epoch), undefined, fingerprint); await this.ledger.complete(tx, nodeId, this.forwarding); return snapshot; }); }
    async tick(): Promise<void> {
        const cleanup = await rows<{
            node_id: string;
        }>(this.db.pool, "SELECT node_id FROM retirements WHERE safe=FALSE UNION SELECT CAST(JSON_UNQUOTE(JSON_EXTRACT(f.spec,'$.ingress.nodeId')) AS CHAR CHARACTER SET ascii) COLLATE ascii_bin node_id FROM operations o JOIN forwards f ON f.id=o.forward_id WHERE o.cleanup_pending=TRUE AND o.status='failed' LIMIT 20");
        for (const item of cleanup)
            await this.db.transaction(async (tx) => { const state = await this.locked(tx, item.node_id); if (state.session_epoch)
                await this.publish(tx, state); await this.ledger.complete(tx, item.node_id, this.forwarding); });
        const claim = await this.db.transaction(tx => this.ledger.claim(tx));
        if (!claim)
            return;
        await this.db.transaction(async (tx) => {
            const stored = await this.forwarding.record(tx, claim.scope_id, claim.forward_id);
            const forward: Forward = { id: stored.id, scopeId: stored.scopeId, revision: stored.revision, spec: stored.spec };
            const state = await this.locked(tx, forward.spec.ingress.nodeId);
            const current = await this.ledger.get(tx, claim.scope_id, claim.id);
            if (current.status !== 'running' || current.claim_token !== claim.claim_token || !current.claim_until || current.claim_until <= Date.now() || current.target_revision !== forward.revision)
                return;
            if (state.session_epoch)
                await this.publish(tx, state, { id: claim.id, token: claim.claim_token!, until: claim.claim_until! });
        });
    }
    async report(nodeId: string, epoch: number, report: ReportRequest, fingerprint?: string): Promise<ReportAck> {
        if (report.nodeId !== nodeId || report.sessionEpoch !== epoch)
            throw new ControlError('AUTHORIZATION_DENIED', 403, 'Report identity mismatch');
        return this.db.transaction(async (tx) => {
            const state = await this.locked(tx, nodeId, epoch);
            if (fingerprint)
                await this.nodes.credential(tx, nodeId, fingerprint);
            await this.nodes.facts(tx, nodeId);
            if (report.bootId !== state.boot_id)
                throw new ControlError('SESSION_SUPERSEDED', 409, 'Boot identity mismatch');
            const requestDigest = digest(report);
            const prior = (await rows<{
                request_digest: string;
            }>(tx, 'SELECT request_digest FROM reports WHERE node_id=? AND session_epoch=? AND sequence=?', [nodeId, epoch, report.reportSequence]))[0];
            const ack: ReportAck = { protocolVersion: 2, nodeId, bootId: report.bootId, sessionEpoch: epoch, reportSequence: report.reportSequence, status: prior ? 'duplicate' : 'accepted' };
            if (prior) {
                if (prior.request_digest !== requestDigest)
                    throw new ControlError('INTEGRITY_FAILURE', 409, 'Report sequence body changed');
                return ack;
            }
            if (report.reportSequence <= state.last_report_sequence)
                throw new ControlError('STALE_GENERATION', 409, 'Report sequence regressed');
            const record = report.acceptedSnapshotGeneration ? (await rows<{
                body: unknown;
            }>(tx, 'SELECT body FROM snapshots WHERE node_id=? AND generation=? AND session_epoch=?', [nodeId, report.acceptedSnapshotGeneration, epoch]))[0] : undefined;
            if (report.acceptedSnapshotGeneration && !record)
                throw new ControlError('STALE_GENERATION', 409, 'Unpublished snapshot reported');
            const snapshot = record ? json<Snapshot>(record.body) : undefined;
            for (const obs of report.observations)
                if (!snapshot?.assignments.some(a => a.assignmentId === obs.assignmentId && a.deploymentGeneration === obs.deploymentGeneration && a.bindingFence === obs.bindingFence && (obs.phase === a.phase || obs.phase === 'absent')))
                    throw new ControlError('FENCING_REJECTED', 409, 'Observation does not belong to published instance/phase');
            await this.ledger.observeDrains(tx, nodeId, epoch, report);
            const now = Date.now();
            await write(tx, 'INSERT INTO reports(node_id,session_epoch,sequence,request_digest) VALUES(?,?,?,?)', [nodeId, epoch, report.reportSequence, requestDigest]);
            await write(tx, 'UPDATE runtime_nodes SET last_report_sequence=?,last_report=?,received_at=? WHERE node_id=?', [report.reportSequence, JSON.stringify(report), now, nodeId]);
            if (snapshot && snapshot.snapshotGeneration === state.snapshot_generation && Date.parse(snapshot.validUntil) > now + DEFAULT_POLICY.maxClockSkewSeconds * 1000) {
                for (const a of snapshot.assignments) {
                    const obs = report.observations.find(o => o.assignmentId === a.assignmentId);
                    if (obs?.condition === 'error')
                        await write(tx, "UPDATE operations SET last_error=?,updated_at=?,status=IF(?,'running','failed'),cleanup_pending=IF(?,cleanup_pending,TRUE) WHERE forward_id=? AND target_revision=? AND status='running'", [JSON.stringify({ code: obs.errorCode, retryable: obs.retryable }), now, obs.retryable, obs.retryable, a.forwardId, a.forwardRevision]);
                }
            }
            if (snapshot && snapshot.snapshotGeneration === state.snapshot_generation)
                await this.ledger.complete(tx, nodeId, this.forwarding, report, snapshot);
            return ack;
        });
    }
    async status(tx: Transaction, forward: Forward): Promise<{
        applied: Observation[];
        health: {
            condition: 'unknown' | 'ready' | 'degraded';
            receivedAt: string | null;
            freshUntil: string | null;
        };
    }> {
        const state = (await rows<RuntimeNode>(tx, 'SELECT * FROM runtime_nodes WHERE node_id=?', [forward.spec.ingress.nodeId]))[0]!;
        const report = state.last_report ? json<ReportRequest>(state.last_report) : undefined;
        const current = state.snapshot_generation ? (await rows<{
            body: unknown;
        }>(tx, 'SELECT body FROM snapshots WHERE node_id=? AND generation=?', [state.node_id, state.snapshot_generation]))[0] : undefined;
        const assignments = current ? json<Snapshot>(current.body).assignments.filter(a => a.forwardId === forward.id) : [];
        const applied = report?.observations.filter(obs => assignments.some(a => a.assignmentId === obs.assignmentId && a.deploymentGeneration === obs.deploymentGeneration && a.bindingFence === obs.bindingFence)) ?? [];
        const reported = report ? (await rows<{
            body: unknown;
        }>(tx, 'SELECT body FROM snapshots WHERE node_id=? AND generation=? AND session_epoch=?', [state.node_id, report.acceptedSnapshotGeneration, report.sessionEpoch]))[0] : undefined;
        const freshUntil = state.received_at !== null && current && reported ? Math.min(state.received_at + DEFAULT_POLICY.observationFreshnessSeconds * 1000, Date.parse(json<Snapshot>(current.body).validUntil) - DEFAULT_POLICY.maxClockSkewSeconds * 1000, Date.parse(json<Snapshot>(reported.body).validUntil) - DEFAULT_POLICY.maxClockSkewSeconds * 1000) : null;
        const fresh = freshUntil !== null && freshUntil > Date.now() && report?.sessionEpoch === state.session_epoch;
        return { applied, health: { condition: !fresh ? 'unknown' : applied.length === forward.spec.protocols.length && applied.every(obs => obs.condition === 'ready') ? 'ready' : 'degraded', receivedAt: state.received_at ? new Date(state.received_at).toISOString() : null, freshUntil: freshUntil ? new Date(freshUntil).toISOString() : null } };
    }
}
