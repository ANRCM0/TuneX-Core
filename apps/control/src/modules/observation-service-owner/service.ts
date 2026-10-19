import { deepFreeze, isCounter, isId } from '@tunex/core';
import { nativeModuleId as randomUUID, nativeValueDigest as digest, nativeCommandRequest as requestIdentity, nativeWallClockSource,
    nativeMonotonicNow, jsonUtf8Bytes } from '../../compatibility/public.ts';
import { ControlError, invalid, notFound } from '../../framework/public.ts';
import type { IdempotentRequests, ScopeAuthorization, TransactionBoundary } from '../../framework/public.ts';
import { OBSERVATION_SERVICE_LIMITS } from './contracts.ts';
import type { ObservationServiceConfig, ObservationServiceHead, ObservationServiceReceipt, ObservationServiceStore } from './contracts.ts';
import type { ObservationServicesApi } from './api.ts';
import { observationServiceId, observationTime, observationTrust, parseObservationServiceAudit, parseObservationServiceConfig,
    parseObservationServiceHead, parseObservationServiceReceipt, parseObservationServiceRevision } from './values.ts';

const corrupt = (): never => { throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid persisted observation service metadata'); };
function stored<T>(read: () => T): T { try { return read(); } catch { return corrupt(); } }
function identity(actor: string, scope: string, id?: string) {
    if (!isId(actor) || !isId(scope) || id !== undefined && !observationServiceId(id)) invalid('Valid scoped observation service identity required');
}
function next(value: number) {
    if (!isCounter(value + 1)) throw new ControlError('REVISION_EXHAUSTED', 409, 'Observation metadata revision exhausted');
    return value + 1;
}

/** Manager declarations are inert: this owner never dials, signs a permit, reads a private key or calls Runtime. */
export class ObservationServices<Tx> implements ObservationServicesApi {
    private active = 0;
    private requestsActive = 0;
    private readonly actors = new Map<string, { active: boolean; until: number }>();
    private readonly db: TransactionBoundary<Tx>;
    private readonly auth: ScopeAuthorization<Tx>;
    private readonly requests: IdempotentRequests<Tx>;
    private readonly store: ObservationServiceStore<Tx>;
    private readonly clock: () => number;
    readonly measurementAvailable: boolean;
    readonly echoAvailable:boolean;
    constructor(db: TransactionBoundary<Tx>, auth: ScopeAuthorization<Tx>, requests: IdempotentRequests<Tx>,
        store: ObservationServiceStore<Tx>, clock: () => number = nativeWallClockSource(), measurementAvailable = false,echoAvailable=false) {
        this.db = db; this.auth = auth; this.requests = requests; this.store = store; this.clock = clock;
        this.measurementAvailable = measurementAvailable;
        this.echoAvailable=echoAvailable;
    }
    private now() { const at = this.clock(); if (!observationTime(at)) corrupt(); return at; }
    private envelope(scopeId: string, capturedAt: number) {
        return { observationServicesVersion: 1, scopeId, capturedAt, source: 'manager-declared-observation-services', readOnly: true,
            executionAuthorized: false, health: 'unknown', ownership: 'not-verified', networkCheck: 'not-performed', measurementAvailable: this.measurementAvailable,
            echoAvailable:this.echoAvailable,
            consistency: 'read-committed-not-global-snapshot', limits: OBSERVATION_SERVICE_LIMITS } as const;
    }
    private bounded<T>(value: T): T {
        if (jsonUtf8Bytes(value) > OBSERVATION_SERVICE_LIMITS.responseBytes) corrupt();
        return deepFreeze(value);
    }
    async admitRequest<T>(action: () => Promise<T>): Promise<T> {
        if (this.requestsActive >= 2) throw new ControlError('OBSERVATION_SERVICE_BUSY', 429, 'Observation service request capacity unavailable', true);
        this.requestsActive++;
        try { return await action(); } finally { this.requestsActive--; }
    }
    private async admitted<T>(actor: string, action: () => Promise<T>): Promise<T> {
        const now = nativeMonotonicNow();
        for (const [key, value] of this.actors) if (!value.active && value.until <= now) this.actors.delete(key);
        if (this.active >= 2 || this.actors.has(actor) || this.actors.size >= 128)
            throw new ControlError('OBSERVATION_SERVICE_BUSY', 429, 'Observation service capacity or cooldown unavailable', true);
        this.active++; this.actors.set(actor, { active: true, until: Infinity });
        try { return await action(); }
        finally { this.active--; this.actors.set(actor, { active: false, until: nativeMonotonicNow() + 1000 }); }
    }
    private async losses(tx: Tx, scope: string) {
        const value = await this.store.auditLosses(tx, scope); if (!isCounter(value, true)) corrupt(); return value;
    }
    async list(actor: string, scope: string) {
        identity(actor, scope);
        return this.admitted(actor, () => this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope, true);
            const raw = await this.store.list(tx, scope);
            if (!Array.isArray(raw) || raw.length > OBSERVATION_SERVICE_LIMITS.servicesPerScope) corrupt();
            const items = raw.map(value => stored(() => parseObservationServiceHead(value)));
            if (new Set(items.map(value => value.serviceId)).size !== items.length) corrupt();
            return this.bounded({ ...this.envelope(scope, this.now()), items, auditEvicted: await this.losses(tx, scope) });
        }));
    }
    async get(actor: string, scope: string, id: string, configRevision?: number) {
        identity(actor, scope, id);
        if (configRevision !== undefined && (!isCounter(configRevision) || configRevision > OBSERVATION_SERVICE_LIMITS.revisionsPerService))
            invalid('One exact observation configuration revision required');
        return this.admitted(actor, () => this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope, true);
            const raw = await this.store.head(tx, scope, id); if (!raw) notFound();
            const head = stored(() => parseObservationServiceHead(raw)); if (head.serviceId !== id) corrupt();
            const number = configRevision ?? head.configRevision;
            if (number > head.configRevision) notFound();
            const found = await this.store.revision(tx, scope, id, number); if (!found) corrupt();
            const revision = stored(() => parseObservationServiceRevision(found, scope, id));
            if (revision.configRevision !== number) corrupt();
            const rawAudit = await this.store.audits(tx, scope, id);
            if (!Array.isArray(rawAudit) || rawAudit.length > OBSERVATION_SERVICE_LIMITS.auditPage + 1) corrupt();
            const audit = rawAudit.map(value => stored(() => parseObservationServiceAudit(value)));
            // Other services can evict Scope audit rows; this bounded history is not a global snapshot.
            if (audit.some(value => value.serviceId !== id) || new Set(audit.map(value => value.id)).size !== audit.length) corrupt();
            const now = this.now(), config = revision.config;
            const lifecycle = head.archived ? 'archived' : head.recoverySuspended ? 'recovery-suspended' :
                now < config.validFrom ? 'not-yet-valid' : now >= config.validUntil ? 'expired' : 'declared';
            return this.bounded({ ...this.envelope(scope, now), head, revision,
                trust: stored(() => observationTrust(config, scope, id)), lifecycle,
                audit: { items: audit.slice(0, OBSERVATION_SERVICE_LIMITS.auditPage), truncated: audit.length > OBSERVATION_SERVICE_LIMITS.auditPage },
                auditEvicted: await this.losses(tx, scope) });
        }));
    }
    async publish(actor: string, scope: string, id: string, key: string | undefined, expectedRevision: number, input: unknown): Promise<ObservationServiceReceipt> {
        identity(actor, scope, id);
        const config = parseObservationServiceConfig(input, scope, id);
        return this.command(actor, scope, id, key, expectedRevision, config);
    }
    async archive(actor: string, scope: string, id: string, key: string | undefined, expectedRevision: number): Promise<ObservationServiceReceipt> {
        identity(actor, scope, id);
        if (!isCounter(expectedRevision)) invalid('Archival requires an existing observation metadata revision');
        return this.command(actor, scope, id, key, expectedRevision, null);
    }
    private async command(actor: string, scope: string, id: string, key: string | undefined, expectedRevision: number,
        config: ObservationServiceConfig | null): Promise<ObservationServiceReceipt> {
        if (!isCounter(expectedRevision, true)) invalid('Observation metadata CAS required');
        const request = requestIdentity(actor, scope, key, config ? 'PUT' : 'DELETE', `/api/v1/scopes/${scope}/observation-services/${id}`,
            { expectedRevision, ...(config ? { config } : {}) });
        return this.admitted(actor, () => this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope, true);
            const replay = await this.requests.claim<ObservationServiceReceipt>(tx, request);
            if (replay) return this.bounded(stored(() => parseObservationServiceReceipt(replay, id)));
            await this.store.lockScope(tx, scope);
            const raw = await this.store.head(tx, scope, id, true), old = raw ? stored(() => parseObservationServiceHead(raw)) : null;
            if (old && old.serviceId !== id) corrupt();
            if ((old?.revision ?? 0) !== expectedRevision) throw new ControlError('REVISION_CONFLICT', 409, 'Observation metadata revision conflict');
            if (!config && !old) notFound();
            if (config && old?.archived) throw new ControlError('OBSERVATION_SERVICE_ARCHIVED', 409, 'Archived observation service identifiers cannot be reused');
            const found = old ? await this.store.revision(tx, scope, id, old.configRevision) : null;
            if (old && !found) corrupt();
            const previous = found ? stored(() => parseObservationServiceRevision(found, scope, id)) : null;
            if (previous && previous.configRevision !== old!.configRevision) corrupt();
            const now = this.now();
            if (previous && now < previous.createdAt) throw new ControlError('CLOCK_UNCERTAIN', 409, 'Observation command clock moved behind immutable history');
            let head: ObservationServiceHead, configDigest: string, changed: boolean;
            if (config) {
                if (now >= config.validUntil || config.validUntil > now + OBSERVATION_SERVICE_LIMITS.validityMs)
                    throw new ControlError('OBSERVATION_SERVICE_EXPIRED', 409, 'Publication requires a nonexpired service window ending within seven days');
                configDigest = digest(config);
                const configurationChanged = previous?.configDigest !== configDigest;
                changed = configurationChanged || old?.recoverySuspended === true;
                const number = configurationChanged ? (old?.configRevision ?? 0) + 1 : old!.configRevision;
                if (number > OBSERVATION_SERVICE_LIMITS.revisionsPerService) throw new ControlError('RESOURCE_LIMIT', 429, 'Observation immutable revision quota reached');
                if (!old) {
                    const count = await this.store.count(tx, scope);
                    if (!isCounter(count, true) || count > OBSERVATION_SERVICE_LIMITS.servicesPerScope) corrupt();
                    if (count === OBSERVATION_SERVICE_LIMITS.servicesPerScope) throw new ControlError('RESOURCE_LIMIT', 429, 'Observation service quota includes archived identities');
                }
                head = { serviceId: id, revision: changed ? next(expectedRevision) : expectedRevision, configRevision: number,
                    archived: false, recoverySuspended: false };
                if (configurationChanged) await this.store.insertRevision(tx, scope, id,
                    { configRevision: number, config, configDigest, createdBy: actor, createdAt: now });
            } else {
                configDigest = previous!.configDigest; changed = !old!.archived;
                head = { ...old!, revision: changed ? next(expectedRevision) : expectedRevision, archived: true };
            }
            if (changed) {
                await this.store.putHead(tx, scope, head);
                await this.store.audit(tx, scope, { id: randomUUID(), serviceId: id, revision: head.revision, configRevision: head.configRevision,
                    kind: config ? 'publish' : 'archive', actorId: actor, createdAt: now });
            }
            const result: ObservationServiceReceipt = { status: changed ? 202 : 200, body: { ...head, configDigest, changed } };
            await this.requests.respond(tx, request, result);
            return this.bounded(result);
        }));
    }
}
