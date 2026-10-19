import { deepFreeze, isCounter, isId } from '@tunex/core';
import { nativeValueDigest as digest } from '../../compatibility/public.ts';
import { AUDIT_ERROR_CODES } from '../audit-owner/public.ts';
import type { StationAlertConfig, StationAlertEvaluation, StationAlertEvidence, StationAlertFact, StationAlertReason,
    StationAlertState, StationAlertPolicy, StationAlertEvent, StationAlertPolicyAudit } from './contracts.ts';
import { invalid } from '../../framework/public.ts';

export { STATION_ALERT_LIMITS } from './policy.ts';
const maximumTime = 253402300799999;
const reasons: readonly StationAlertReason[] = ['operation-failed','deployment-succeeded','deployment-succeeded-after-failure','operation-in-progress',
    'administrative-state','target-unavailable','recovery-suspended','evidence-unavailable','evidence-invalid','clock-regression',
    'clock-uncertain','report-stale','report-fresh','fresh-baseline-required','instance-changed','credential-expiring',
    'credential-expired','credential-valid','credential-renewed','recovery-not-proven'];
export const STATION_ALERT_REASONS = Object.freeze(reasons);
const time = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= maximumTime;
const hash = (v: unknown): v is string => typeof v === 'string' && /^sha256:[a-f0-9]{64}$/.test(v) && v.length === 71;
const bool = (v: unknown): v is boolean => typeof v === 'boolean';
const nullableTime = (v: unknown) => v === null || time(v);
function closed(input: unknown, keys: string[]): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        ![Object.prototype,null].includes(Object.getPrototypeOf(input)) ||
        Object.keys(input).sort().join(',') !== [...keys].sort().join(',')) invalid('Closed station alert value required');
    return input as Record<string, unknown>;
}
export function emptyStationAlertState(): StationAlertState {
    return deepFreeze({ condition: 'unknown', episode: 0, instanceKey: null, armed: false, openedAt: null,
        opening: null, lastFiring: null, last: null, evaluatedAt: null });
}
export function parseStationAlertConfig(input: unknown): StationAlertConfig {
    const v = closed(input, ['schemaVersion','rule','target','enabled','thresholdSeconds']);
    const target = closed(v.target, ['kind','id']);
    if (v.schemaVersion !== 1 || !bool(v.enabled) || !isId(target.id) || !isCounter(v.thresholdSeconds,true))
        invalid('Invalid station alert policy');
    const threshold = v.thresholdSeconds;
    if (v.rule === 'forward-operation-failed' ? target.kind !== 'forward' || threshold !== 0 :
        v.rule === 'node-report-stale' ? target.kind !== 'node' || threshold < 30 || threshold > 3600 :
        v.rule === 'node-credential-expiring' ? target.kind !== 'node' || threshold < 60 || threshold > 604800 : true)
        invalid('Unsupported station alert rule or threshold');
    return deepFreeze({ schemaVersion: 1, rule: v.rule, target: { kind: target.kind, id: target.id },
        enabled: v.enabled, thresholdSeconds: threshold } as StationAlertConfig);
}
export function parseStationAlertEvidence(input: unknown): StationAlertEvidence {
    if (!input || typeof input !== 'object') invalid('Invalid station alert evidence');
    const kind = (input as { kind?: unknown }).kind;
    if (kind === 'unavailable') {
        const v = closed(input,['kind','targetId']);
        if (!isId(v.targetId)) invalid('Invalid station alert target');
        return deepFreeze({ kind, targetId: v.targetId });
    }
    if (kind === 'node-credential') {
        const v = closed(input,['kind','targetId','credentialUntil']);
        if (!isId(v.targetId) || !time(v.credentialUntil)) invalid('Invalid credential evidence');
        return deepFreeze({ kind, targetId: v.targetId, credentialUntil: v.credentialUntil });
    }
    if (kind === 'node-report') {
        const v = closed(input,['kind','targetId','bootId','sessionEpoch','reportSequence','snapshotGeneration','observedAt','receivedAt','credentialUntil']);
        if (!isId(v.targetId) || !isId(v.bootId) || !isCounter(v.sessionEpoch) || !isCounter(v.reportSequence) ||
            !isCounter(v.snapshotGeneration) || !time(v.observedAt) || !time(v.receivedAt) || !time(v.credentialUntil))
            invalid('Invalid report evidence');
        return deepFreeze({ ...v } as unknown as StationAlertEvidence);
    }
    if (kind === 'operation') {
        const v = closed(input,['kind','targetId','forwardRevision','operationId','targetRevision','operationKind','status',
            'sourceOperationId','createdAt','updatedAt','errorCode','recoveryInvalidated']);
        if (!isId(v.targetId) || !isCounter(v.forwardRevision) || !isId(v.operationId) || !isCounter(v.targetRevision) ||
            !['create','update','enable','disable','delete','retry','policy','revoke'].includes(v.operationKind as string) ||
            !['accepted','running','succeeded','failed','superseded'].includes(v.status as string) ||
            v.sourceOperationId !== null && !isId(v.sourceOperationId) || !time(v.createdAt) || !time(v.updatedAt) ||
            v.updatedAt < v.createdAt || !bool(v.recoveryInvalidated) || v.errorCode !== null && typeof v.errorCode !== 'string')
            invalid('Invalid Operation evidence');
        const errorCode = v.errorCode === null ? null : (AUDIT_ERROR_CODES as readonly string[]).includes(v.errorCode as string) ? v.errorCode : 'OTHER_ERROR';
        return deepFreeze({ ...v, errorCode } as unknown as StationAlertEvidence);
    }
    return invalid('Unsupported station alert evidence');
}
function parseEvaluation(input: unknown): StationAlertEvaluation {
    const v = closed(input,['status','reason','instanceKey','evidence']);
    if (!['clear','firing','unknown'].includes(v.status as string) || !reasons.includes(v.reason as StationAlertReason) ||
        v.instanceKey !== null && !hash(v.instanceKey)) invalid('Invalid alert evaluation');
    return deepFreeze({ status: v.status, reason: v.reason, instanceKey: v.instanceKey,
        evidence: parseStationAlertEvidence(v.evidence) } as StationAlertEvaluation);
}
export function parseStationAlertState(input: unknown): StationAlertState {
    const v = closed(input,['condition','episode','instanceKey','armed','openedAt','opening','lastFiring','last','evaluatedAt']);
    if (!['unknown','clear','firing'].includes(v.condition as string) || !isCounter(v.episode,true) ||
        v.instanceKey !== null && !hash(v.instanceKey) || !bool(v.armed) || !nullableTime(v.openedAt) || !nullableTime(v.evaluatedAt))
        invalid('Invalid station alert state');
    const opening = v.opening === null ? null : parseStationAlertEvidence(v.opening);
    const lastFiring = v.lastFiring === null ? null : parseStationAlertEvidence(v.lastFiring);
    const last = v.last === null ? null : parseEvaluation(v.last);
    if ((v.condition === 'firing') !== (opening !== null && lastFiring !== null && v.openedAt !== null) ||
        v.condition !== 'firing' && (opening !== null || lastFiring !== null || v.openedAt !== null) ||
        (last === null) !== (v.evaluatedAt === null) || v.condition === 'firing' && v.episode === 0 ||
        v.condition === 'firing' && (opening?.kind === 'unavailable' || lastFiring?.kind === 'unavailable' ||
            opening?.kind !== lastFiring?.kind || opening?.targetId !== lastFiring?.targetId) ||
        opening !== null && (opening.kind === 'unavailable' || lastFiring === null || lastFiring.kind !== opening.kind || lastFiring.targetId !== opening.targetId) ||
        v.openedAt !== null && v.evaluatedAt !== null && v.openedAt > v.evaluatedAt)
        invalid('Inconsistent station alert state');
    return deepFreeze({ condition: v.condition, episode: v.episode, instanceKey: v.instanceKey, armed: v.armed,
        openedAt: v.openedAt, opening, lastFiring, last, evaluatedAt: v.evaluatedAt } as StationAlertState);
}
function boundEvidence(config: StationAlertConfig, evidence: StationAlertEvidence): void {
    const expected = config.rule === 'forward-operation-failed' ? 'operation' :
        config.rule === 'node-report-stale' ? 'node-report' : 'node-credential';
    if (evidence.targetId !== config.target.id || evidence.kind !== 'unavailable' && evidence.kind !== expected)
        invalid('Station alert evidence differs from policy target or rule');
}
export function parseStationAlertPolicy(input: unknown): StationAlertPolicy {
    const v = closed(input,['policyId','revision','configRevision','config','configDigest','managedBy','createdAt','updatedAt',
        'silencedUntil','suspended','nextEvaluateAt','state']);
    const config = parseStationAlertConfig(v.config), state = parseStationAlertState(v.state);
    if (!isId(v.policyId) || !isCounter(v.revision) || !isCounter(v.configRevision) || v.configRevision > v.revision || !hash(v.configDigest) ||
        v.configDigest !== digest(config) || !isId(v.managedBy) || !time(v.createdAt) || !time(v.updatedAt) ||
        v.updatedAt < v.createdAt || !nullableTime(v.silencedUntil) || !time(v.nextEvaluateAt) ||
        !['none','recovery','actor-not-authorized'].includes(v.suspended as string)) invalid('Invalid station alert policy record');
    for (const evidence of [state.opening,state.lastFiring,state.last?.evidence]) if (evidence) boundEvidence(config,evidence);
    return deepFreeze({ policyId: v.policyId, revision: v.revision, configRevision: v.configRevision, config,
        configDigest: v.configDigest, managedBy: v.managedBy, createdAt: v.createdAt, updatedAt: v.updatedAt,
        silencedUntil: v.silencedUntil, suspended: v.suspended, nextEvaluateAt: v.nextEvaluateAt, state } as StationAlertPolicy);
}
export function parseStationAlertEvent(input: unknown): StationAlertEvent {
    const v = closed(input,['id','policyId','policyRevision','configRevision','config','configDigest','episode','kind','reason',
        'occurredAt','evidence','opening','silenced','silencedUntil','revision','acknowledgedAt','recoverySuspended']);
    const config = parseStationAlertConfig(v.config), evidence = parseStationAlertEvidence(v.evidence);
    const opening = v.opening === null ? null : parseStationAlertEvidence(v.opening);
    if (!isId(v.id) || !isId(v.policyId) || !isCounter(v.policyRevision) || !isCounter(v.configRevision) ||
        !hash(v.configDigest) || v.configDigest !== digest(config) || !isCounter(v.episode) ||
        !['firing','recovered','invalidated'].includes(v.kind as string) || !reasons.includes(v.reason as StationAlertReason) ||
        !time(v.occurredAt) || !bool(v.silenced) || !nullableTime(v.silencedUntil) || !isCounter(v.revision) ||
        !nullableTime(v.acknowledgedAt) || !bool(v.recoverySuspended) ||
        v.silenced && (v.silencedUntil === null || v.silencedUntil <= v.occurredAt) ||
        v.acknowledgedAt !== null && v.acknowledgedAt < v.occurredAt || evidence.kind === 'unavailable' ||
        opening === null || opening.kind === 'unavailable') invalid('Invalid station alert event');
    boundEvidence(config,evidence); boundEvidence(config,opening);
    return deepFreeze({ id: v.id, policyId: v.policyId, policyRevision: v.policyRevision, configRevision: v.configRevision,
        config, configDigest: v.configDigest, episode: v.episode, kind: v.kind, reason: v.reason, occurredAt: v.occurredAt,
        evidence, opening, silenced: v.silenced, silencedUntil: v.silencedUntil, revision: v.revision,
        acknowledgedAt: v.acknowledgedAt, recoverySuspended: v.recoverySuspended } as StationAlertEvent);
}
export function parseStationAlertPolicyAudit(input: unknown): StationAlertPolicyAudit {
    const v = closed(input,['id','policyId','revision','configRevision','configDigest','kind','actorId','createdAt','eventId']);
    if (!isId(v.id) || !isId(v.policyId) || !isCounter(v.revision) || !isCounter(v.configRevision) || !hash(v.configDigest) ||
        !['publish','silence','acknowledge'].includes(v.kind as string) || !isId(v.actorId) || !time(v.createdAt) ||
        (v.kind === 'acknowledge' ? !isId(v.eventId) : v.eventId !== null)) invalid('Invalid station alert policy audit');
    // Acknowledgement revision is the event CAS, not the current policy revision.
    return deepFreeze({ id: v.id, policyId: v.policyId, revision: v.revision, configRevision: v.configRevision,
        configDigest: v.configDigest, kind: v.kind, actorId: v.actorId, createdAt: v.createdAt, eventId: v.eventId } as StationAlertPolicyAudit);
}
export function evaluateStationAlert(configInput: StationAlertConfig, fact: StationAlertFact | null,
    stateInput: StationAlertState, now: number, clockSkewMs: number): StationAlertEvaluation {
    const config = parseStationAlertConfig(configInput), state = parseStationAlertState(stateInput);
    if (!time(now) || !isCounter(clockSkewMs,true)) invalid('Invalid station alert clock');
    const unavailable = { kind: 'unavailable', targetId: config.target.id } as const;
    const result = (status: StationAlertEvaluation['status'], reason: StationAlertReason,
        evidence: StationAlertEvidence = unavailable, instanceKey: string | null = null): StationAlertEvaluation =>
        deepFreeze({ status, reason, evidence, instanceKey });
    if (state.evaluatedAt !== null && now < state.evaluatedAt) return result('unknown','clock-regression');
    if (!config.enabled) return result('unknown','administrative-state');
    if (!fact) return result('unknown','target-unavailable');
    if (fact.id !== config.target.id || fact.kind !== config.target.kind) return result('unknown','evidence-invalid');
    if (config.rule === 'forward-operation-failed') {
        if (fact.kind !== 'forward') return result('unknown','evidence-invalid');
        if (fact.recoverySuspended) return result('unknown','recovery-suspended');
        if (!fact.enabled || fact.deleting) return result('unknown','administrative-state');
        if (fact.operation === null) return result('unknown','evidence-unavailable');
        let evidence: StationAlertEvidence;
        try { evidence = parseStationAlertEvidence(fact.operation); } catch { return result('unknown','evidence-invalid'); }
        if (evidence.kind !== 'operation' || evidence.targetId !== fact.id || evidence.forwardRevision !== fact.revision ||
            evidence.targetRevision !== fact.revision) return result('unknown','evidence-invalid');
        if (evidence.recoveryInvalidated) return result('unknown','recovery-suspended',evidence);
        if (evidence.createdAt > now + clockSkewMs || evidence.updatedAt > now + clockSkewMs) return result('unknown','clock-uncertain',evidence);
        if (!['create','update','enable','retry'].includes(evidence.operationKind)) return result('unknown','administrative-state',evidence);
        if (evidence.status === 'failed') return result('firing','operation-failed',evidence);
        if (evidence.status !== 'succeeded') return result('unknown',evidence.status === 'superseded' ? 'administrative-state' : 'operation-in-progress',evidence);
        if (state.condition !== 'firing') return result('clear','deployment-succeeded',evidence);
        const previous = state.lastFiring;
        if (previous?.kind !== 'operation' || evidence.operationId === previous.operationId || evidence.createdAt < previous.createdAt ||
            !(evidence.targetRevision > previous.targetRevision || evidence.sourceOperationId === previous.operationId))
            return result('unknown','recovery-not-proven',evidence);
        return result('clear','deployment-succeeded-after-failure',evidence);
    }
    if (fact.kind !== 'node' || !bool(fact.revoked) || fact.credentialUntil !== null && !time(fact.credentialUntil))
        return result('unknown','evidence-invalid');
    if (fact.revoked) return result('unknown','administrative-state');
    if (fact.credentialUntil === null) return result('unknown','evidence-unavailable');
    if (config.rule === 'node-credential-expiring') {
        const evidence = { kind: 'node-credential', targetId: fact.id, credentialUntil: fact.credentialUntil } as const;
        if (fact.credentialUntil <= now) return result('firing','credential-expired',evidence);
        if (fact.credentialUntil - now <= config.thresholdSeconds * 1000) return result('firing','credential-expiring',evidence);
        if (state.condition === 'firing') {
            if (state.lastFiring?.kind !== 'node-credential' || fact.credentialUntil <= state.lastFiring.credentialUntil)
                return result('unknown','recovery-not-proven',evidence);
            return result('clear','credential-renewed',evidence);
        }
        return result('clear','credential-valid',evidence);
    }
    if (!bool(fact.invalidReport) || fact.invalidReport) return result('unknown','evidence-invalid');
    if (!fact.report || fact.credentialUntil <= now) return result('unknown','evidence-unavailable');
    let evidence: StationAlertEvidence;
    try { evidence = parseStationAlertEvidence(fact.report); } catch { return result('unknown','evidence-invalid'); }
    if (evidence.kind !== 'node-report' || evidence.targetId !== fact.id || evidence.credentialUntil !== fact.credentialUntil)
        return result('unknown','evidence-invalid');
    if (evidence.observedAt > now + clockSkewMs || evidence.receivedAt > now + clockSkewMs) return result('unknown','clock-uncertain',evidence);
    const instanceKey = digest({ target: config.target, bootId: evidence.bootId, sessionEpoch: evidence.sessionEpoch });
    const fresh = now - Math.min(evidence.observedAt,evidence.receivedAt) <= config.thresholdSeconds * 1000;
    if (fresh) return result('clear','report-fresh',evidence,instanceKey);
    if (!state.armed || state.instanceKey !== instanceKey) return result('unknown','fresh-baseline-required',evidence,instanceKey);
    return result('firing','report-stale',evidence,instanceKey);
}
export function advanceStationAlert(stateInput: StationAlertState, evaluationInput: StationAlertEvaluation, now: number) {
    const old = parseStationAlertState(stateInput), evaluation = parseEvaluation(evaluationInput);
    if (!time(now)) invalid('Invalid station alert transition time');
    type Event = { kind: 'firing' | 'recovered' | 'invalidated'; reason: StationAlertReason;
        evidence: StationAlertEvidence; opening: StationAlertEvidence | null; episode: number };
    let state: StationAlertState = { ...old }, event: Event | null = null;
    if (old.evaluatedAt !== null && now < old.evaluatedAt) {
        state.last = { status: 'unknown', reason: 'clock-regression', instanceKey: null,
            evidence: { kind: 'unavailable', targetId: evaluation.evidence.targetId } };
        return deepFreeze({ state, event });
    }
    // A new process/session invalidates an old report incident; it does not prove recovery.
    if (evaluation.evidence.kind === 'node-report' && evaluation.instanceKey !== null &&
        old.instanceKey !== null && evaluation.instanceKey !== old.instanceKey) {
        if (old.condition === 'firing') event = { kind: 'invalidated', reason: 'instance-changed',
            evidence: evaluation.evidence, opening: old.opening, episode: old.episode };
        state = { ...emptyStationAlertState(), episode: old.episode };
    }
    state.last = evaluation; state.evaluatedAt = now;
    if (evaluation.instanceKey !== null) state.instanceKey = evaluation.instanceKey;
    if (evaluation.status === 'unknown') return deepFreeze({ state, event });
    if (evaluation.status === 'clear') {
        if (state.condition === 'firing') event = { kind: 'recovered', reason: evaluation.reason,
            evidence: evaluation.evidence, opening: state.opening, episode: state.episode };
        state.condition = 'clear'; state.armed = true; state.openedAt = null; state.opening = null; state.lastFiring = null;
    } else {
        if (state.condition !== 'firing') {
            if (!isCounter(state.episode + 1)) invalid('Station alert episode exhausted');
            state.episode++; state.openedAt = now; state.opening = evaluation.evidence;
            event = { kind: 'firing', reason: evaluation.reason, evidence: evaluation.evidence,
                opening: evaluation.evidence, episode: state.episode };
        }
        state.condition = 'firing'; state.lastFiring = evaluation.evidence;
    }
    return deepFreeze({ state, event });
}
