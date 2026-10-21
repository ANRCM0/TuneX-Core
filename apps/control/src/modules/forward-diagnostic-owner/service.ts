import { deepFreeze, ipBytes, isCounter, isId, normalizeIp, normalizeTargetHost, parseForward } from '@tunex/core';
import { nativeValueDigest as digest, nativeParseTime, nativeIsoTime, nativeMonotonicNow, nativeWallClockSource, jsonUtf8Bytes, nativeBase64Fingerprint } from '../../compatibility/public.ts';
import type { Forward } from '@tunex/core';
import { nativeDiagnosticProbeResult, nativeDiagnosticProbeResultBody, parseProbeServiceContext, probeServiceSelection } from '../../compatibility/public.ts';
import type { NativeDiagnosticProbeResult } from '../../compatibility/public.ts';
import { ControlError, invalid, notFound } from '../../framework/public.ts';
import type { ScopeAuthorization, TransactionBoundary, ResourceReadAccess } from '../../framework/public.ts';
import type { ForwardDiagnosticsApi } from './api.ts';
import { validProbeBinding } from '../probe-owner/public.ts';
import type { DiagnosticAssignment, DiagnosticDeployment, DiagnosticDrain, DiagnosticLease, DiagnosticNode, DiagnosticOperation,
    DiagnosticPage, DiagnosticProbe, DiagnosticReportContext, DiagnosticRetirement, DiagnosticSlot, ForwardDiagnosticReadPort } from './contracts.ts';

import { FORWARD_DIAGNOSTIC_LIMITS } from './policy.ts';
export { FORWARD_DIAGNOSTIC_LIMITS } from './policy.ts';
const conditions = ['pending','prepared','ready','degraded','error','draining','removed'];
const roles = ['direct','relay-ingress','relay-egress','multihop-ingress','multihop-transit','multihop-egress'];
const operationKinds = ['create','update','enable','disable','delete','retry','policy','revoke'];
const operationStates = ['accepted','running','succeeded','failed','superseded'];
const codes = new Set(['AUTHORIZATION_DENIED','EXECUTION_DEADLINE','INTEGRITY_FAILURE','INVALID_CONFIG','UNSUPPORTED_CAPABILITY',
    'RESOURCE_CONFLICT','RESOURCE_LIMIT','PORT_RESERVED','FENCING_REJECTED','LEASE_EXPIRED','SESSION_SUPERSEDED',
    'LISTEN_FAILED','BIND_FAILED','TARGET_DENIED','CONNECT_FAILED','DIAL_FAILED','PEER_UNAVAILABLE','TLS_FAILED',
    'RELAY_HANDSHAKE_FAILED','DRAIN_TIMEOUT','INTERNAL_ERROR','CLOCK_UNCERTAIN','CONFIG_DIGEST_MISMATCH',
    'AUTHENTICATION_FAILED','TARGET_REJECTED','DOWNSTREAM_NOT_ACTIVE','DOWNSTREAM_UNAVAILABLE','TARGET_UNAVAILABLE','PORT_IN_USE']);
const flags = { source: 'persisted-control-and-agent-state', readOnly: true, networkCheck: 'not-performed',
    executionAuthorized: false, health: 'unknown', consistency: 'read-committed-not-global-snapshot',
    snapshotDigestVerification: 'projected-not-recomputed' } as const;
const corrupt: () => never = () => { throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid bounded diagnostic evidence'); };
const bool = (v: unknown): v is boolean => typeof v === 'boolean';
const time = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 8640000000000000;
const hash = (v: unknown): v is string => typeof v === 'string' && v.length === 71 && /^sha256:[a-f0-9]{64}$/.test(v);
const instant = (v: unknown): v is string => typeof v === 'string' && time(nativeParseTime(v)) &&
    /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(v);
const iso = (v: number | null) => v === null ? null : nativeIsoTime(v);
const code = (v: string | null) => v === null ? null : codes.has(v) ? v : 'OTHER_ERROR';
function nextStep(value: string | null) {
    if (value === null) return null;
    if (['AUTHENTICATION_FAILED','AUTHORIZATION_DENIED','TARGET_DENIED','TARGET_REJECTED','LEASE_EXPIRED','SESSION_SUPERSEDED'].includes(value)) return 'review-current-permissions-and-lease';
    if (['PORT_RESERVED','PORT_IN_USE','BIND_FAILED','LISTEN_FAILED','RESOURCE_CONFLICT','RESOURCE_LIMIT'].includes(value)) return 'review-reservations-and-cleanup';
    if (['INTEGRITY_FAILURE','INVALID_CONFIG','UNSUPPORTED_CAPABILITY','CONFIG_DIGEST_MISMATCH','FENCING_REJECTED','CLOCK_UNCERTAIN'].includes(value)) return 'review-config-and-protected-state';
    if (['EXECUTION_DEADLINE','DRAIN_TIMEOUT'].includes(value)) return 'inspect-operation-and-cleanup-before-explicit-retry';
    if (['DOWNSTREAM_NOT_ACTIVE','DOWNSTREAM_UNAVAILABLE','TARGET_UNAVAILABLE','CONNECT_FAILED','DIAL_FAILED','PEER_UNAVAILABLE','TLS_FAILED','RELAY_HANDSHAKE_FAILED'].includes(value)) return 'inspect-peer-and-target-with-explicit-probe';
    return 'inspect-original-owner-diagnostics';
}
const identityKey = (v: { nodeId: string; assignmentId: string; deploymentGeneration: number; bindingFence: number }) =>
    v.nodeId + '/' + v.assignmentId + '/' + v.deploymentGeneration + '/' + v.bindingFence;
function page<T>(value: DiagnosticPage<T>, limit: number): DiagnosticPage<T> {
    if (!value || !Array.isArray(value.items) || value.items.length > limit || !bool(value.truncated) || value.truncated && value.items.length !== limit) corrupt();
    return value;
}
function endpoint(v: { host: string; port: number } | null) {
    if (v === null) return null;
    if (!v || normalizeTargetHost(v.host) !== v.host || !Number.isInteger(v.port) || v.port < 1 || v.port > 65535) corrupt();
    return { host: v.host, port: v.port };
}
function tuple(v: { nodeId: string; assignmentId: string; deploymentGeneration: number; bindingFence: number }) {
    if (!v || !isId(v.nodeId) || !isId(v.assignmentId) || !isCounter(v.deploymentGeneration) || !isCounter(v.bindingFence)) corrupt();
    return { nodeId: v.nodeId, assignmentId: v.assignmentId, deploymentGeneration: v.deploymentGeneration, bindingFence: v.bindingFence };
}
function unique<T>(values: T[], key: (value: T) => string) {
    if (new Set(values.map(key)).size !== values.length) corrupt();
    return values;
}

/** Passive projections never call Runtime, issue Probe work, or turn a diagnostic into authorization. */
export class ForwardDiagnostics<Tx> implements ForwardDiagnosticsApi {
    private readonly db: TransactionBoundary<Tx>;
    private readonly auth: ScopeAuthorization<Tx>;
    private readonly readAccess: ResourceReadAccess<Tx>;
    private readonly read: ForwardDiagnosticReadPort<Tx>;
    private readonly clock: () => number;
    private readonly freshnessMs: number;
    private readonly skewMs: number;
    private requests = 0;
    private active = 0;
    private readonly actors = new Map<string, { active: boolean; until: number }>();

    constructor(db: TransactionBoundary<Tx>, auth: ScopeAuthorization<Tx>, readAccess: ResourceReadAccess<Tx>, read: ForwardDiagnosticReadPort<Tx>,
        policy: { freshnessMs: number; clockSkewMs: number }, clock: () => number = nativeWallClockSource()) {
        if (!isCounter(policy.freshnessMs) || policy.freshnessMs > 300000 || !isCounter(policy.clockSkewMs, true) || policy.clockSkewMs > 300000)
            throw new Error('Bounded diagnostic timing policy required');
        this.db = db; this.auth = auth; this.readAccess = readAccess; this.read = read; this.clock = clock;
        this.freshnessMs = policy.freshnessMs; this.skewMs = policy.clockSkewMs;
    }
    async admitReadRequest<T>(action: () => Promise<T>): Promise<T> {
        if (this.requests >= FORWARD_DIAGNOSTIC_LIMITS.activeRequests) throw new ControlError('DIAGNOSTIC_BUSY', 429, 'Diagnostic request capacity unavailable', true);
        this.requests++;
        try { return await action(); } finally { this.requests--; }
    }
    private async admitted<T>(actor: string, action: () => Promise<T>): Promise<T> {
        const now = nativeMonotonicNow();
        for (const [key,value] of this.actors) if (!value.active && value.until <= now) this.actors.delete(key);
        if (this.active >= 2 || this.actors.has(actor) || this.actors.size >= FORWARD_DIAGNOSTIC_LIMITS.actorKeys)
            throw new ControlError('DIAGNOSTIC_BUSY', 429, 'Diagnostic read capacity or cooldown unavailable', true);
        this.active++; this.actors.set(actor, { active: true, until: Infinity });
        try { return await action(); }
        finally { this.active--; this.actors.set(actor, { active: false, until: nativeMonotonicNow() + FORWARD_DIAGNOSTIC_LIMITS.cooldownMs }); }
    }
    private operation(row: DiagnosticOperation, forwardId: string) {
        if (!row || !isId(row.id) || row.forwardId !== forwardId || !isCounter(row.targetRevision) || !operationKinds.includes(row.kind) ||
            !operationStates.includes(row.status) || !time(row.createdAt) || !time(row.updatedAt) || row.updatedAt < row.createdAt ||
            !time(row.executionDeadline) || !bool(row.cleanupPending) || !bool(row.recoveryInvalidated) ||
            row.sourceOperationId !== null && !isId(row.sourceOperationId) || row.errorCode !== null && typeof row.errorCode !== 'string' ||
            row.errorRetryable !== null && !bool(row.errorRetryable)) corrupt();
        return { id: row.id, forwardId, targetRevision: row.targetRevision, kind: row.kind, status: row.status,
            createdAt: iso(row.createdAt)!, updatedAt: iso(row.updatedAt)!, executionDeadline: iso(row.executionDeadline)!,
            cleanupPending: row.cleanupPending, recoveryInvalidated: row.recoveryInvalidated,
            sourceOperationId: row.sourceOperationId, error: row.errorCode === null ? null : { code: code(row.errorCode)!, retryable: row.errorRetryable, nextStep: nextStep(code(row.errorCode))! } };
    }
    private deployment(row: DiagnosticDeployment | null, forward: Forward) {
        if (row === null) return null;
        if (!row || row.forwardId !== forward.id || !isCounter(row.generation) || !isCounter(row.targetRevision) ||
            !['preparing','egress_active','ingress_active','active','withdrawn'].includes(row.stage) || !time(row.createdAt) ||
            !time(row.updatedAt) || row.updatedAt < row.createdAt || !time(row.authorizationUntil) || !hash(row.planDigest)) corrupt();
        return { generation: row.generation, targetRevision: row.targetRevision, stage: row.stage,
            createdAt: iso(row.createdAt)!, updatedAt: iso(row.updatedAt)!, authorizationUntil: iso(row.authorizationUntil)!,
            planDigest: row.planDigest, matchesIntent: row.targetRevision === forward.revision,
            source: 'persisted-relay-deployment', trafficVerified: false } as const;
    }
    private node(row: DiagnosticNode, scope: string, now: number) {
        if (!row || !isId(row.nodeId) || row.scopeId !== scope || !bool(row.revoked) || row.credentialUntil !== null && !time(row.credentialUntil) ||
            row.bootId !== null && !isId(row.bootId) || !isCounter(row.sessionEpoch,true) || !isCounter(row.snapshotGeneration,true) ||
            !isCounter(row.lastReportSequence,true) || row.receivedAt !== null && !time(row.receivedAt) || !bool(row.invalidSnapshot) || !bool(row.invalidReport)) corrupt();
        const snapshot = row.snapshot, report = row.report;
        if (snapshot !== null && (!isId(snapshot.nodeId) || !isCounter(snapshot.sessionEpoch) || !isCounter(snapshot.generation) ||
            !instant(snapshot.issuedAt) || !instant(snapshot.validUntil) || nativeParseTime(snapshot.validUntil) <= nativeParseTime(snapshot.issuedAt) || !hash(snapshot.digest))) corrupt();
        if (report !== null && (!isId(report.nodeId) || !isId(report.bootId) || !isCounter(report.sessionEpoch) || !isCounter(report.sequence) ||
            !isCounter(report.snapshotGeneration,true) || !instant(report.observedAt))) corrupt();
        const snapshotCurrent = snapshot !== null && snapshot.nodeId === row.nodeId && snapshot.sessionEpoch === row.sessionEpoch && snapshot.generation === row.snapshotGeneration;
        const sessionCurrent = report !== null && report.nodeId === row.nodeId && report.bootId === row.bootId && report.sessionEpoch === row.sessionEpoch && report.sequence === row.lastReportSequence;
        const generationCurrent = snapshotCurrent && report?.snapshotGeneration === row.snapshotGeneration;
        const credentialWindowOpen = !row.revoked && row.credentialUntil !== null && row.credentialUntil > now;
        const expires = report && row.receivedAt !== null && snapshot && row.credentialUntil !== null ? Math.max(0,
            Math.min(Math.min(row.receivedAt,nativeParseTime(report.observedAt)) + this.freshnessMs,nativeParseTime(snapshot.validUntil)-this.skewMs,row.credentialUntil)) : null;
        let reason = 'recent-report';
        if (row.revoked) reason = 'node-revoked';
        else if (!credentialWindowOpen) reason = 'credential-expired';
        else if (row.invalidSnapshot || row.invalidReport) reason = 'invalid-evidence';
        else if (!snapshot) reason = 'missing-snapshot';
        else if (!report || row.receivedAt === null) reason = 'missing-report';
        else if (!snapshotCurrent || !sessionCurrent) reason = 'session-mismatch';
        else if (!generationCurrent) reason = 'snapshot-mismatch';
        else if (row.receivedAt > now || nativeParseTime(report.observedAt) > now + this.skewMs || nativeParseTime(snapshot.issuedAt) > now + this.skewMs ||
            nativeParseTime(report.observedAt) + this.skewMs < nativeParseTime(snapshot.issuedAt)) reason = 'clock-skew';
        else if (nativeParseTime(snapshot.validUntil)-this.skewMs <= now) reason = 'snapshot-expired';
        else if (expires === null || expires <= now) reason = 'report-expired';
        return { nodeId: row.nodeId, revoked: row.revoked, credentialUntil: iso(row.credentialUntil), credentialWindowOpen,
            bootId: row.bootId, sessionEpoch: row.sessionEpoch, snapshotGeneration: row.snapshotGeneration,
            reportSequence: row.lastReportSequence, receivedAt: iso(row.receivedAt),
            snapshot: snapshot === null ? null : { nodeId: snapshot.nodeId, sessionEpoch: snapshot.sessionEpoch, generation: snapshot.generation,
                issuedAt: iso(nativeParseTime(snapshot.issuedAt))!, validUntil: iso(nativeParseTime(snapshot.validUntil))!, digest: snapshot.digest },
            report: report === null ? null : { nodeId: report.nodeId, bootId: report.bootId, sessionEpoch: report.sessionEpoch,
                sequence: report.sequence, snapshotGeneration: report.snapshotGeneration, observedAt: iso(nativeParseTime(report.observedAt))! },
            observation: { status: reason === 'recent-report' ? 'fresh' : ['report-expired','snapshot-expired'].includes(reason) ? 'stale' : 'unknown',
                reason, expiresAt: iso(expires), reportAgeMs: row.receivedAt === null || row.receivedAt > now ? null : now-row.receivedAt },
            sessionCurrent, snapshotCurrent, source: 'persisted-node-and-agent-report', health: 'unknown' } as const;
    }
    private assignment(row: DiagnosticAssignment, forward: Forward, node: ReturnType<ForwardDiagnostics<Tx>['node']> | undefined,
        slots: DiagnosticSlot[], deleting: boolean, suspended: boolean) {
        tuple(row);
        if (!node || row.forwardId !== forward.id || !isCounter(row.sessionEpoch) || !isCounter(row.snapshotGeneration) ||
            !isCounter(row.forwardRevision) ||
            !roles.includes(row.role) || !['tcp','udp'].includes(row.protocol) || !['prepared','active','draining'].includes(row.phase) ||
            !row.resource || normalizeIp(row.resource.address) !== row.resource.address || !Number.isInteger(row.resource.port) || row.resource.port < 1 || row.resource.port > 65535 ||
            !['tcp','udp'].includes(row.resource.protocol) || !['native.direct.v1','native.relay.v1','native.multihop.v1'].includes(row.driverId) ||
            row.driverSchemaVersion !== 1 || !hash(row.configDigest) || !['none','relay-binding','hop-path'].includes(row.linkKind) ||
            (row.linkKind === 'none' ? row.linkDigest !== null : !hash(row.linkDigest))) corrupt();
        const expectedDriver = row.role === 'direct' ? 'native.direct.v1' : row.role.startsWith('relay-') ? 'native.relay.v1' : 'native.multihop.v1';
        if (row.driverId !== expectedDriver || row.resource.protocol !== (['relay-egress','multihop-transit','multihop-egress'].includes(row.role) ? 'tcp' : row.protocol)) corrupt();
        const target = endpoint(row.target), peerEndpoint = endpoint(row.peerEndpoint), observation = row.observation;
        if (observation !== null && (!['prepared','active','draining','absent'].includes(observation.phase) || !conditions.includes(observation.condition) ||
            observation.errorCode !== null && typeof observation.errorCode !== 'string' || !bool(observation.retryable))) corrupt();
        const report = observation === null ? null : this.reportContext(observation.report,row,node);
        const drain = this.drain(row.drain,row,node);
        const phaseMatches = observation !== null && (observation.phase === row.phase || observation.phase === 'absent');
        const sameIntent = row.forwardRevision === forward.revision;
        if (sameIntent && !forward.spec.protocols.includes(row.protocol)) corrupt();
        const nodeEvidenceMatches = row.sessionEpoch === node.sessionEpoch && row.snapshotGeneration === node.snapshotGeneration;
        const fresh = nodeEvidenceMatches && report?.matchesNodeEvidence === true && node.observation.status === 'fresh' &&
            node.snapshotCurrent && node.sessionCurrent && phaseMatches && !deleting && !suspended && sameIntent;
        const slot = slots.find(slot => slot.nodeId === row.nodeId && slot.protocol === row.resource.protocol && slot.port === row.resource.port);
        return { ...tuple(row), sessionEpoch: row.sessionEpoch, snapshotGeneration: row.snapshotGeneration, forwardRevision: row.forwardRevision,
            role: row.role, protocol: row.protocol, phase: row.phase, driverId: row.driverId, configDigest: row.configDigest,
            resource: { address: row.resource.address, port: row.resource.port, protocol: row.resource.protocol },
            target, peerEndpoint, linkKind: row.linkKind, linkDigest: row.linkDigest,
            relation: sameIntent ? 'current-intent' : 'historical-intent', nodeEvidenceMatches, reportFresh: fresh,
            observation: observation === null ? null : { phase: observation.phase, condition: observation.condition,
                errorCode: code(observation.errorCode), retryable: observation.retryable, nextStep: nextStep(code(observation.errorCode)), ...report!,
                phaseMatches, source: 'agent-reported' as const }, drain,
            reservation: slot === undefined ? 'not-present-in-bounded-owned-slots' : slot.fence === row.bindingFence && slot.deploymentGeneration === row.deploymentGeneration ? 'owned-exact-tuple' : 'owned-different-tuple',
            listeningSocket: 'not-independently-verified', health: 'unknown' } as const;
    }
    private reportContext(context: DiagnosticReportContext, assignment: DiagnosticAssignment, node: ReturnType<ForwardDiagnostics<Tx>['node']>) {
        if (!context || context.nodeId !== assignment.nodeId || !isId(context.bootId) || context.sessionEpoch !== assignment.sessionEpoch ||
            context.snapshotGeneration !== assignment.snapshotGeneration || !isCounter(context.sequence) || !instant(context.observedAt) || !time(context.receivedAt)) corrupt();
        const observedAt = iso(nativeParseTime(context.observedAt))!;
        return { observedAt, receivedAt: iso(context.receivedAt)!, reportSequence: context.sequence,
            sessionEpoch: context.sessionEpoch, snapshotGeneration: context.snapshotGeneration,
            matchesNodeEvidence: context.bootId === node.bootId && context.sessionEpoch === node.sessionEpoch && context.sequence === node.reportSequence &&
                context.snapshotGeneration === node.snapshotGeneration && observedAt === node.report?.observedAt && iso(context.receivedAt) === node.receivedAt };
    }
    private drain(row: DiagnosticDrain | null, assignment: DiagnosticAssignment, node: ReturnType<ForwardDiagnostics<Tx>['node']>) {
        if (row === null) return null;
        if (!row || !instant(row.startedAt) || !instant(row.deadline) || nativeParseTime(row.deadline) < nativeParseTime(row.startedAt) ||
            !isCounter(row.remainingConnections,true) || !['draining','removed'].includes(row.condition)) corrupt();
        return { startedAt: iso(nativeParseTime(row.startedAt))!, deadline: iso(nativeParseTime(row.deadline))!, remainingConnections: row.remainingConnections,
            condition: row.condition, ...this.reportContext(row.report,assignment,node), source: 'agent-reported' };
    }
    private slot(row: DiagnosticSlot) {
        if (!row || !isId(row.nodeId) || !['tcp','udp'].includes(row.protocol) || !Number.isInteger(row.port) || row.port < 1 || row.port > 65535 ||
            !isCounter(row.fence) || !isCounter(row.deploymentGeneration)) corrupt();
        return { nodeId: row.nodeId, protocol: row.protocol, port: row.port, fence: row.fence, deploymentGeneration: row.deploymentGeneration };
    }
    private retirement(row: DiagnosticRetirement) {
        tuple(row);
        if (!isId(row.operationId) || row.removedEpoch !== null && !isCounter(row.removedEpoch,true) ||
            row.retirementGeneration !== null && !isCounter(row.retirementGeneration) || !bool(row.safe)) corrupt();
        return { ...tuple(row), operationId: row.operationId, removedEpoch: row.removedEpoch, retirementGeneration: row.retirementGeneration, safe: row.safe };
    }
    private lease(row: DiagnosticLease, now: number) {
        tuple(row);
        if (!isCounter(row.sessionEpoch) || !time(row.validUntil)) corrupt();
        return { ...tuple(row), sessionEpoch: row.sessionEpoch, validUntil: iso(row.validUntil)!, windowOpen: row.validUntil > now,
            source: 'historical-issued-lease', currentAuthorization: 'not-rechecked' } as const;
    }
    private probe(row: DiagnosticProbe, forward: Forward, nodes: ReturnType<ForwardDiagnostics<Tx>['node']>[],
        listeners: ReturnType<ForwardDiagnostics<Tx>['assignment']>[], now: number, deleting: boolean, suspended: boolean) {
        if (!row || !isId(row.permitId) || !validProbeBinding(row.binding) || row.binding.forwardId !== forward.id ||
            !['issued','consumed','revoked','quarantined'].includes(row.state) || !time(row.issuedAt) || !time(row.expiresAt) || row.expiresAt <= row.issuedAt || row.expiresAt-row.issuedAt > 2000 ||
            (row.state === 'issued' ? row.closedAt !== null : !time(row.closedAt)) || row.closedAt !== null && row.closedAt < row.issuedAt ||
            row.state === 'consumed' && row.closedAt! >= row.expiresAt ||
            row.withdrawnAt !== null && (!time(row.withdrawnAt) || row.closedAt === null || row.withdrawnAt < row.closedAt)) corrupt();
        if (!['tcp-connect-v1','tcp-ingress-connect-v1','tcp-ingress-tls-v1'].includes(row.measurement) ||
            (row.measurement === 'tcp-ingress-tls-v1') !== (row.serviceContext !== null)) corrupt();
        let context: ReturnType<typeof parseProbeServiceContext> | null = null;
        try { context = row.serviceContext === null ? null : parseProbeServiceContext(row.serviceContext); } catch { return corrupt(); }
        if (context !== null && (context.scopeId !== forward.scopeId || row.issuedAt < context.config.validFrom || row.expiresAt > context.config.validUntil)) corrupt();
        const service = context === null ? null : probeServiceSelection(context);
        const point = row.measurement === 'tcp-connect-v1' ? 'agent-direct-egress' : 'agent-local-direct-ingress';
        const binding = row.binding, node = nodes.find(node => node.nodeId === binding.nodeId);
        const assignment = listeners.find(value => value.nodeId === binding.nodeId && value.assignmentId === binding.assignmentId &&
            value.deploymentGeneration === binding.deploymentGeneration && value.bindingFence === binding.bindingFence && value.configDigest === binding.configDigest &&
            value.forwardRevision === binding.forwardRevision && value.snapshotGeneration === binding.snapshotGeneration && value.sessionEpoch === binding.sessionEpoch && value.protocol === 'tcp' && value.role === 'direct');
        const bindingMatchesCurrent = !deleting && !suspended && forward.spec.enabled && binding.forwardRevision === forward.revision &&
            node?.bootId === binding.bootId && node.sessionEpoch === binding.sessionEpoch && Boolean(assignment);
        let result = null;
        if (row.result !== null) {
            if (!row.result || !time(row.result.acceptedAt) || row.result.acceptedAt > now || !hash(row.result.digest) ||
                !row.result.body || typeof row.result.body !== 'object' || Array.isArray(row.result.body) || 'requestId' in row.result.body) corrupt();
            let parsed:NativeDiagnosticProbeResult;
            try { parsed=nativeDiagnosticProbeResult(row.result.body as object); }
            catch { return corrupt(); }
            const body=nativeDiagnosticProbeResultBody(parsed);
            if ((parsed.probeVersion === 1 ? 'tcp-connect-v1' : parsed.measurement) !== row.measurement || parsed.point !== point ||
                parsed.probeVersion === 3 && digest(parsed.service) !== digest(service) ||
                context !== null && parsed.probeVersion !== 3 ||
                parsed.probeVersion === 3 && parsed.tls !== null && (context === null || parsed.tls.leafFingerprint !==
                    nativeBase64Fingerprint(context.config.trust.certificateDer))) corrupt();
            if (digest(body) !== row.result.digest || body.permitId !== row.permitId || digest(body.binding) !== digest(binding) || row.state !== 'consumed' ||
                row.closedAt !== nativeParseTime(body.consumedAt) || row.issuedAt !== nativeParseTime(body.issuedAt) || row.expiresAt !== nativeParseTime(body.expiresAt) ||
                row.result.acceptedAt < nativeParseTime(body.measuredAt) || row.result.acceptedAt >= nativeParseTime(body.validUntil) ||
                row.withdrawnAt !== null && row.result.acceptedAt > row.withdrawnAt) corrupt();
            result = { status: body.status, code: body.code, measuredAt: iso(nativeParseTime(body.measuredAt))!, validUntil: iso(nativeParseTime(body.validUntil))!,
                acceptedAt: iso(row.result.acceptedAt)!, elapsedMs: body.elapsedMs, point: body.point, source: body.source,
                applicationHealth: body.applicationHealth, applicationPayloadBytes: body.applicationPayloadBytes,
                tls: parsed.probeVersion === 3 ? parsed.tls : null,
                windowOpen: now < nativeParseTime(body.validUntil) && now >= row.result.acceptedAt };
        }
        return { permitId: row.permitId, measurement: row.measurement, point, service, binding: { nodeId: binding.nodeId, bootId: binding.bootId, sessionEpoch: binding.sessionEpoch,
            snapshotGeneration: binding.snapshotGeneration, assignmentId: binding.assignmentId, forwardRevision: binding.forwardRevision,
            deploymentGeneration: binding.deploymentGeneration, bindingFence: binding.bindingFence, configDigest: binding.configDigest,
            egressPolicyRevision: binding.egressPolicyRevision }, state: row.state, issuedAt: iso(row.issuedAt)!, expiresAt: iso(row.expiresAt)!,
            closedAt: iso(row.closedAt), withdrawnAt: iso(row.withdrawnAt), bindingMatchesCurrent, result, health: 'unknown', executionAuthorized: false } as const;
    }
    async get(actor: string, scope: string, id: string) {
        if (![actor,scope,id].every(isId)) invalid('Valid diagnostic Scope and Forward required');
        return this.admitted(actor, () => this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope);
            await this.readAccess.forward(tx, actor, scope, id);
            const found = await this.read.forward(tx,scope,id); if (!found) notFound();
            const parsed = parseForward({ id: found.id, scopeId: found.scopeId, revision: found.revision, spec: found.spec });
            if (!parsed.ok || found.id !== id || found.scopeId !== scope || !bool(found.deleting) || !bool(found.recoverySuspended)) corrupt();
            const forward = parsed.value, path = [forward.spec.ingress.nodeId,...(forward.spec.path?.via ?? [])];
            if (path.length > FORWARD_DIAGNOSTIC_LIMITS.nodes) throw new ControlError('UNSUPPORTED_CAPABILITY', 422, 'Diagnostic path exceeds eight-node native bound');
            const operations = page(await this.read.operations(tx,scope,id),8), rawNodes = await this.read.nodes(tx,scope,path);
            const assignments = page(await this.read.assignments(tx,scope,id,path),16), deployment = await this.read.deployment(tx,scope,id);
            const slots = page(await this.read.slots(tx,scope,id),16), retirements = page(await this.read.retirements(tx,scope,id),32);
            const leases = page(await this.read.leases(tx,scope,id),32), probes = page(await this.read.probes(tx,scope,id),8);
            const now = this.clock(); if (!time(now)) corrupt();
            if (!Array.isArray(rawNodes) || rawNodes.length > path.length || rawNodes.some(node => !path.includes(node.nodeId))) corrupt();
            const fullNodeIds = new Set<string>();
            for (const node of rawNodes) {
                try { await this.readAccess.node(tx, actor, scope, node.nodeId, 'diagnostics'); fullNodeIds.add(node.nodeId); }
                catch (error) { if (!(error instanceof ControlError) || error.code !== 'NOT_FOUND') throw error; }
            }
            const nodeViews = unique(rawNodes.map(node => this.node(node,scope,now)),node => node.nodeId);
            const slotViews = unique(slots.items.map(row => this.slot(row)),row => row.nodeId+'/'+row.protocol+'/'+row.port);
            const listenerViews = unique(assignments.items.map(row => this.assignment(row,forward,nodeViews.find(node => node.nodeId === row.nodeId),slotViews,found.deleting,found.recoverySuspended)),identityKey);
            const operationViews = unique(operations.items.map(row => this.operation(row,id)),row => row.id);
            const retirementViews = unique(retirements.items.map(row => this.retirement(row)),identityKey);
            const leaseViews = unique(leases.items.map(row => this.lease(row,now)),row => identityKey(row)+'/'+row.sessionEpoch);
            const probeViews = unique(probes.items.map(row => this.probe(row,forward,nodeViews,listenerViews,now,found.deleting,found.recoverySuspended)),row => row.permitId);
            const adjacentSegments = path.slice(1).map((nodeId,index) => ({ position: index+1, fromNodeId: path[index]!, toNodeId: nodeId,
                carrier: 'tcp-tls', source: 'configured-native-path', connectivity: 'unknown',
                protocols: forward.spec.protocols.map(protocol => {
                    const from = listenerViews.find(row => row.nodeId === path[index] && row.protocol === protocol && row.relation === 'current-intent');
                    const to = listenerViews.find(row => row.nodeId === nodeId && row.protocol === protocol && row.relation === 'current-intent');
                    return { protocol, fromAssignmentId: from?.assignmentId ?? null, toAssignmentId: to?.assignmentId ?? null,
                        identityCorrelated: Boolean(from && to && from.deploymentGeneration === to.deploymentGeneration && from.linkDigest !== null &&
                            from.linkKind === to.linkKind && from.linkDigest === to.linkDigest), peerEndpoint: from?.peerEndpoint ?? null };
                }) }));
            const data = { diagnosticVersion: 1, scopeId: scope, capturedAt: iso(now)!, ...flags, limits: FORWARD_DIAGNOSTIC_LIMITS,
                intent: { forwardId: id, revision: forward.revision, specDigest: digest(forward.spec), enabled: forward.spec.enabled,
                    deleting: found.deleting, recoverySuspended: found.recoverySuspended, protocols: [...forward.spec.protocols],
                    mode: path.length === 1 ? 'direct' : path.length === 2 ? 'relay' : 'multihop', path,
                    listen: { address: forward.spec.ingress.listen.address, port: forward.spec.ingress.listen.port },
                    transport: forward.spec.transport ? { profileId: forward.spec.transport.profileId, configRevision: forward.spec.transport.configRevision } : null },
                operations: { limit: 8, truncated: operations.truncated, items: operationViews }, deployment: this.deployment(deployment,forward),
                nodes: path.map((nodeId,index) => ({ position: index+1, role: path.length === 1 ? 'direct' : index === 0 ? 'ingress' : index === path.length-1 ? 'egress' : 'transit',
                    nodeId, evidence: fullNodeIds.has(nodeId) ? nodeViews.find(node => node.nodeId === nodeId) ?? null : null })),
                listeners: { limit: 16, truncated: assignments.truncated, items: listenerViews }, adjacentSegments,
                target: { nodeId: path.at(-1)!, endpoint: { host: forward.spec.target.host, port: forward.spec.target.port },
                    protocols: [...forward.spec.protocols], source: 'desired-target-and-published-config', connectivity: 'unknown', applicationHealth: 'unknown',
                    configurations: listenerViews.filter(row => row.nodeId === path.at(-1) && row.target !== null).map(row => ({ assignmentId: row.assignmentId,
                        protocol: row.protocol, forwardRevision: row.forwardRevision, matchesIntent: row.relation === 'current-intent' && digest(row.target) === digest(forward.spec.target) })) },
                probe: { support: !forward.spec.path && forward.spec.protocols.includes('tcp') && ipBytes(forward.spec.target.host) ? 'direct-tcp-ip-shape' : 'unsupported-shape',
                    source: 'retained-original-permits-and-agent-results', historyComplete: false, retention: 'ephemeral-original-permits',
                    limit: 8, truncated: probes.truncated, items: probeViews },
                cleanup: { complete: false, source: 'bounded-original-runtime-records',
                    slots: { limit: 16, truncated: slots.truncated, items: slotViews },
                    retirements: { limit: 32, truncated: retirements.truncated, items: retirementViews },
                    leases: { limit: 32, truncated: leases.truncated, items: leaseViews } } };
            const bundle = this.support(data), bytes = jsonUtf8Bytes(bundle);
            if (bytes > FORWARD_DIAGNOSTIC_LIMITS.supportBytes) corrupt();
            const result = deepFreeze({ ...data, support: { redacted: true, sameRead: true, bytes, digest: digest(bundle), bundle } });
            if (jsonUtf8Bytes(result) > FORWARD_DIAGNOSTIC_LIMITS.responseBytes) corrupt();
            return result;
        }));
    }
    private support(data: {
        capturedAt: string; intent: { revision: number; enabled: boolean; deleting: boolean; recoverySuspended: boolean; mode: string; protocols: string[]; path: string[] };
        operations: { limit: number; truncated: boolean; items: ReturnType<ForwardDiagnostics<Tx>['operation']>[] };
        deployment: ReturnType<ForwardDiagnostics<Tx>['deployment']>;
        nodes: { position: number; role: string; nodeId: string; evidence: ReturnType<ForwardDiagnostics<Tx>['node']> | null }[];
        listeners: { limit: number; truncated: boolean; items: ReturnType<ForwardDiagnostics<Tx>['assignment']>[] };
        adjacentSegments: { position: number; fromNodeId: string; toNodeId: string; carrier: string; protocols: { protocol: string; identityCorrelated: boolean }[] }[];
        target: { nodeId: string; protocols: string[]; configurations: { assignmentId: string; protocol: string; forwardRevision: number; matchesIntent: boolean }[] };
        probe: { support: string; limit: number; truncated: boolean; items: ReturnType<ForwardDiagnostics<Tx>['probe']>[] };
        cleanup: { slots: { limit: number; truncated: boolean; items: DiagnosticSlot[] }; retirements: { limit: number; truncated: boolean; items: DiagnosticRetirement[] };
            leases: { limit: number; truncated: boolean; items: ReturnType<ForwardDiagnostics<Tx>['lease']>[] } };
    }) {
        const aliases = new Map<string,string>();
        const alias = (kind: string, value: string | null) => {
            if (value === null) return null;
            const key = kind+'\0'+value;
            if (!aliases.has(key)) aliases.set(key,kind+'-'+(1+[...aliases.keys()].filter(key => key.startsWith(kind+'\0')).length));
            return aliases.get(key)!;
        };
        const binding = (v: { nodeId: string; assignmentId: string; deploymentGeneration: number; bindingFence: number }) => ({ node: alias('node',v.nodeId),
            assignment: alias('assignment',v.assignmentId), deploymentGeneration: v.deploymentGeneration, bindingFence: v.bindingFence });
        return { supportVersion: 1, redacted: true, scope: 'scope-1', forward: 'forward-1', capturedAt: data.capturedAt, ...flags,
            exclusions: ['original-identifiers','network-addresses-and-ports','targets-and-endpoints','profiles-and-config-digests','policies',
                'raw-wire-and-audit-bodies','free-text-errors','actors-and-request-keys','credentials','protected-state','observation-identifiers-and-trust-pins'],
            intent: { revision: data.intent.revision, enabled: data.intent.enabled, deleting: data.intent.deleting, recoverySuspended: data.intent.recoverySuspended,
                mode: data.intent.mode, protocols: data.intent.protocols, nodes: data.intent.path.map(node => alias('node',node)) },
            operations: { limit: data.operations.limit, truncated: data.operations.truncated, items: data.operations.items.map(row => ({ operation: alias('operation',row.id),
                sourceOperation: alias('operation',row.sourceOperationId), targetRevision: row.targetRevision, kind: row.kind, status: row.status,
                createdAt: row.createdAt, updatedAt: row.updatedAt, executionDeadline: row.executionDeadline,
                cleanupPending: row.cleanupPending, recoveryInvalidated: row.recoveryInvalidated, error: row.error })) },
            deployment: data.deployment === null ? null : { generation: data.deployment.generation, targetRevision: data.deployment.targetRevision,
                stage: data.deployment.stage, matchesIntent: data.deployment.matchesIntent, createdAt: data.deployment.createdAt,
                updatedAt: data.deployment.updatedAt, authorizationUntil: data.deployment.authorizationUntil, trafficVerified: false },
            nodes: data.nodes.map(row => ({ node: alias('node',row.nodeId), position: row.position, role: row.role,
                evidence: row.evidence === null ? null : { revoked: row.evidence.revoked, credentialWindowOpen: row.evidence.credentialWindowOpen,
                    sessionEpoch: row.evidence.sessionEpoch, snapshotGeneration: row.evidence.snapshotGeneration, reportSequence: row.evidence.reportSequence,
                    receivedAt: row.evidence.receivedAt, observation: row.evidence.observation, sessionCurrent: row.evidence.sessionCurrent,
                    snapshotCurrent: row.evidence.snapshotCurrent } })),
            listeners: { limit: data.listeners.limit, truncated: data.listeners.truncated, items: data.listeners.items.map(row => ({ ...binding(row),
                sessionEpoch: row.sessionEpoch, snapshotGeneration: row.snapshotGeneration, forwardRevision: row.forwardRevision, role: row.role,
                protocol: row.protocol, physicalProtocol: row.resource.protocol, phase: row.phase, driverId: row.driverId, relation: row.relation,
                nodeEvidenceMatches: row.nodeEvidenceMatches, reportFresh: row.reportFresh, observation: row.observation, drain: row.drain, reservation: row.reservation,
                listeningSocket: 'not-independently-verified' })) },
            adjacentSegments: data.adjacentSegments.map(row => ({ position: row.position, fromNode: alias('node',row.fromNodeId), toNode: alias('node',row.toNodeId),
                carrier: row.carrier, connectivity: 'unknown', protocols: row.protocols.map(value => ({ protocol: value.protocol, identityCorrelated: value.identityCorrelated })) })),
            target: { node: alias('node',data.target.nodeId), protocols: data.target.protocols, connectivity: 'unknown', applicationHealth: 'unknown',
                configurations: data.target.configurations.map(row => ({ assignment: alias('assignment',row.assignmentId), protocol: row.protocol,
                    forwardRevision: row.forwardRevision, matchesIntent: row.matchesIntent })) },
            probe: { support: data.probe.support, limit: data.probe.limit, truncated: data.probe.truncated, historyComplete: false,
                items: data.probe.items.map(row => ({ permit: alias('permit',row.permitId), ...binding(row.binding), sessionEpoch: row.binding.sessionEpoch,
                    snapshotGeneration: row.binding.snapshotGeneration, forwardRevision: row.binding.forwardRevision, state: row.state,
                    issuedAt: row.issuedAt, expiresAt: row.expiresAt, closedAt: row.closedAt, withdrawnAt: row.withdrawnAt,
                    measurement: row.measurement, point: row.point, bindingMatchesCurrent: row.bindingMatchesCurrent,
                    result: row.result === null ? null : { status: row.result.status, code: row.result.code, measuredAt: row.result.measuredAt,
                        validUntil: row.result.validUntil, acceptedAt: row.result.acceptedAt, elapsedMs: row.result.elapsedMs, point: row.result.point,
                        source: row.result.source, applicationHealth: row.result.applicationHealth, applicationPayloadBytes: row.result.applicationPayloadBytes,
                        windowOpen: row.result.windowOpen, tls: row.result.tls === null ? null : {
                            version: row.result.tls.version, alpn: row.result.tls.alpn, verified: row.result.tls.verified } },
                    health: 'unknown', executionAuthorized: false })) },
            cleanup: { complete: false,
                slots: { limit: data.cleanup.slots.limit, truncated: data.cleanup.slots.truncated, items: data.cleanup.slots.items.map(row => ({ node: alias('node',row.nodeId),
                    protocol: row.protocol, fence: row.fence, deploymentGeneration: row.deploymentGeneration })) },
                retirements: { limit: data.cleanup.retirements.limit, truncated: data.cleanup.retirements.truncated, items: data.cleanup.retirements.items.map(row => ({ ...binding(row),
                    operation: alias('operation',row.operationId), removedEpoch: row.removedEpoch, retirementGeneration: row.retirementGeneration, safe: row.safe })) },
                leases: { limit: data.cleanup.leases.limit, truncated: data.cleanup.leases.truncated, items: data.cleanup.leases.items.map(row => ({ ...binding(row),
                    sessionEpoch: row.sessionEpoch, validUntil: row.validUntil, windowOpen: row.windowOpen, source: row.source, currentAuthorization: row.currentAuthorization })) } } };
    }
}
