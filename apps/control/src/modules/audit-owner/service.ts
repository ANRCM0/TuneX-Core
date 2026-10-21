import { deepFreeze, isCounter, isId } from '@tunex/core';
import { nativeValueDigest as digest, nativeParseJson as parseJson, nativeParseTime, nativeIsoTime, nativeMonotonicNow, nativeWallClockSource, jsonUtf8Bytes, nativeJsonBase64Url, nativeBase64UrlText } from '../../compatibility/public.ts';
import { ControlError, invalid } from '../../framework/public.ts';
import type { ScopeAuthorization, ScopeOwnerAuthorization, TransactionBoundary } from '../../framework/public.ts';
import type { AuditEventsApi } from './api.ts';
import { AUDIT_ERROR_CODES, AUDIT_KINDS, AUDIT_SOURCES } from './contracts.ts';
import type { AuditErrorCode, AuditFilters, AuditPosition, AuditReadPort, AuditReadQuery, AuditRecord, AuditSource } from './contracts.ts';

import { AUDIT_LIMITS, AUDIT_COVERAGE } from './policy.ts';
export { AUDIT_LIMITS, AUDIT_COVERAGE } from './policy.ts';
const flags = { source: 'persisted-owner-records', readOnly: true, executionAuthorized: false, health: 'unknown',
    networkCheck: 'not-performed', consistency: 'read-committed-not-global-snapshot' } as const;
const sourceSet = new Set<string>(AUDIT_SOURCES), codeSet = new Set<string>(AUDIT_ERROR_CODES);
const recordKeys = ['occurredAt','source','key','kind','recordType','timeMeaning','actorId','actorAttribution','subjectId',
    'entityKind','entityId','revision','revisionKind','sequence','position','nodeId','nodeAssociation','forwardId','operationId',
    'outcome','errorCode','retryable','recoveryInvalidated'];
const queryKeys = ['from','to','limit','cursor','actorId','nodeId','forwardId','operationId','errorCode','source'];
const time = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 253402300799999;
const hash = (v: unknown): v is string => typeof v === 'string' && v.length === 71 && /^sha256:[a-f0-9]{64}$/.test(v);
const nullableId = (v: unknown) => v === null || isId(v);
const nullableCounter = (v: unknown) => v === null || isCounter(v);
const nullableBool = (v: unknown) => v === null || typeof v === 'boolean';
const corrupt = (): never => { throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid bounded audit projection'); };
const plain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(v));
function exact(v: unknown, keys: readonly string[]): v is Record<string, unknown> {
    return plain(v) && Object.keys(v).sort().join(',') === [...keys].sort().join(',');
}
function textOrder(a: string, b: string) { return a < b ? -1 : a > b ? 1 : 0; }
function order(a: AuditPosition, b: AuditPosition) {
    return a.occurredAt - b.occurredAt || textOrder(a.source, b.source) || textOrder(a.key, b.key);
}
function position(row: AuditPosition): AuditPosition { return { occurredAt: row.occurredAt, source: row.source, key: row.key }; }
function queryTime(value: string): number {
    const at = nativeParseTime(value);
    if (!time(at) || nativeIsoTime(at) !== value) invalid('Canonical UTC audit bounds required');
    return at;
}
function encodeCursor(queryDigest: string, row: AuditPosition): string {
    return nativeJsonBase64Url({ version: 1, queryDigest, position: position(row) });
}
function decodeCursor(value: string | undefined, queryDigest: string, query: Pick<AuditReadQuery, 'from' | 'to' | 'filters'>): AuditPosition | null {
    if (value === undefined) return null;
    if (!value || value.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(value)) invalid('Invalid audit cursor');
    try {
        const v = parseJson(nativeBase64UrlText(value), 1024);
        if (!exact(v, ['version','queryDigest','position']) || v.version !== 1 || v.queryDigest !== queryDigest ||
            !exact(v.position, ['occurredAt','source','key'])) invalid('Audit cursor differs from the selected query');
        const p = v.position;
        if (!time(p.occurredAt) || p.occurredAt < query.from || p.occurredAt >= query.to ||
            typeof p.source !== 'string' || !sourceSet.has(p.source) || !hash(p.key) ||
            query.filters.source !== undefined && p.source !== query.filters.source) invalid('Audit cursor is outside the selected window');
        const result: AuditPosition = { occurredAt: p.occurredAt, source: p.source as AuditSource, key: p.key };
        if (encodeCursor(queryDigest, result) !== value) invalid('Canonical audit cursor required');
        return result;
    } catch { return invalid('Invalid audit cursor'); }
}

/** A merged owner-record view, not a new authoritative event store or execution service. */
export class AuditEvents<Tx> implements AuditEventsApi {
    private readonly db: TransactionBoundary<Tx>;
    private readonly auth: ScopeAuthorization<Tx> & ScopeOwnerAuthorization<Tx>;
    private readonly read: AuditReadPort<Tx>;
    private readonly clock: () => number;
    private requests = 0;
    private active = 0;
    private readonly actors = new Map<string, { active: boolean; until: number }>();
    constructor(db: TransactionBoundary<Tx>, auth: ScopeAuthorization<Tx> & ScopeOwnerAuthorization<Tx>, read: AuditReadPort<Tx>, clock: () => number = nativeWallClockSource()) {
        this.db = db; this.auth = auth; this.read = read; this.clock = clock;
    }
    async admitReadRequest<T>(action: () => Promise<T>): Promise<T> {
        if (this.requests >= AUDIT_LIMITS.activeRequests) throw new ControlError('AUDIT_BUSY', 429, 'Audit request capacity unavailable', true);
        this.requests++;
        try { return await action(); } finally { this.requests--; }
    }
    private async admitted<T>(actor: string, action: () => Promise<T>): Promise<T> {
        const now = nativeMonotonicNow();
        for (const [key,value] of this.actors) if (!value.active && value.until <= now) this.actors.delete(key);
        if (this.active >= AUDIT_LIMITS.activeRequests || this.actors.has(actor) || this.actors.size >= AUDIT_LIMITS.actorKeys)
            throw new ControlError('AUDIT_BUSY', 429, 'Audit read capacity or cooldown unavailable', true);
        this.active++; this.actors.set(actor, { active: true, until: Infinity });
        try { return await action(); }
        finally { this.active--; this.actors.set(actor, { active: false, until: nativeMonotonicNow() + AUDIT_LIMITS.cooldownMs }); }
    }
    private row(row: AuditRecord, source: AuditSource, query: AuditReadQuery): AuditRecord {
        if (!exact(row, recordKeys) || row.source !== source || !time(row.occurredAt) || row.occurredAt < query.from || row.occurredAt >= query.to ||
            !hash(row.key) || typeof row.kind !== 'string' || !AUDIT_KINDS[source].includes(row.kind) ||
            !['owner-event','immutable-provenance','owner-attempt','latest-operation-state'].includes(row.recordType) ||
            !['recorded-at','latest-operation-update'].includes(row.timeMeaning) || !nullableId(row.actorId) || !nullableId(row.subjectId) ||
            !['initiator','unattributed','unattributed-recovery','requester-not-status-actor'].includes(row.actorAttribution) ||
            !['scope-access','node','transport-profile','path-template','forward','path-group','path-publication','ingress-group',
                'ingress-deployment','ingress-migration'].includes(row.entityKind) || !isId(row.entityId) ||
            !nullableCounter(row.revision) || ![null,'access','grant','config','forward','batch','resource'].includes(row.revisionKind) ||
            !nullableCounter(row.sequence) || !nullableCounter(row.position) || !nullableId(row.nodeId) ||
            !['explicit-node','immutable-forward-spec','immutable-template-config','immutable-group-definition','none'].includes(row.nodeAssociation) ||
            !nullableId(row.forwardId) || !nullableId(row.operationId) ||
            !['recorded','accepted','rejected','running','succeeded','failed','superseded'].includes(row.outcome) ||
            row.errorCode !== null && !codeSet.has(row.errorCode) || !nullableBool(row.retryable) || !nullableBool(row.recoveryInvalidated)) corrupt();
        if (query.before && order(row, query.before) >= 0 ||
            query.filters.actorId !== undefined && row.actorId !== query.filters.actorId ||
            query.filters.forwardId !== undefined && row.forwardId !== query.filters.forwardId ||
            query.filters.operationId !== undefined && row.operationId !== query.filters.operationId ||
            query.filters.errorCode !== undefined && row.errorCode !== query.filters.errorCode ||
            query.filters.nodeId !== undefined && (row.nodeAssociation === 'none' ||
                row.nodeAssociation === 'explicit-node' && row.nodeId !== query.filters.nodeId) ||
            (row.nodeAssociation === 'explicit-node') !== (row.nodeId !== null) ||
            (row.actorAttribution === 'unattributed' || row.actorAttribution === 'unattributed-recovery') && row.actorId !== null ||
            row.actorAttribution === 'initiator' && row.actorId === null ||
            (row.revision === null) !== (row.revisionKind === null)) corrupt();
        const operation = source === 'operation';
        if (operation !== (row.recordType === 'latest-operation-state') || operation !== (row.timeMeaning === 'latest-operation-update') ||
            operation !== (row.actorAttribution === 'requester-not-status-actor')) corrupt();
        if (['path-publication','ingress-deployment','ingress-migration'].includes(source) &&
            (row.forwardId !== null || row.operationId !== null || row.position !== null)) corrupt();
        if (source === 'resource-limits' && (row.entityKind !== 'node' || row.entityId !== row.nodeId ||
            row.nodeAssociation !== 'explicit-node' || row.revisionKind !== 'resource' || row.revision === null ||
            row.actorAttribution !== 'initiator' || row.subjectId === null || row.recordType !== 'owner-event' ||
            row.outcome !== 'recorded' || row.forwardId !== null || row.operationId !== null || row.sequence !== null ||
            row.position !== null || row.errorCode !== null || row.retryable !== null || row.recoveryInvalidated !== null)) corrupt();
        // Reconstruct the closed DTO rather than spreading persisted objects into the response.
        return { occurredAt: row.occurredAt, source, key: row.key, kind: row.kind, recordType: row.recordType, timeMeaning: row.timeMeaning,
            actorId: row.actorId, actorAttribution: row.actorAttribution, subjectId: row.subjectId, entityKind: row.entityKind, entityId: row.entityId,
            revision: row.revision, revisionKind: row.revisionKind, sequence: row.sequence, position: row.position, nodeId: row.nodeId,
            nodeAssociation: row.nodeAssociation, forwardId: row.forwardId, operationId: row.operationId, outcome: row.outcome,
            errorCode: row.errorCode, retryable: row.retryable, recoveryInvalidated: row.recoveryInvalidated };
    }
    async query(actor: string, scope: string, input: Record<string, string | undefined>) {
        if (!isId(actor) || !isId(scope) || !plain(input) || Object.keys(input).some(key => !queryKeys.includes(key)) ||
            Object.values(input).some(value => value !== undefined && typeof value !== 'string')) invalid('Closed audit query and Scope required');
        const now = this.clock();
        if (!time(now)) corrupt();
        if (input.cursor !== undefined && (input.from === undefined || input.to === undefined)) invalid('Audit cursor requires the frozen explicit window');
        const to = input.to === undefined ? now : queryTime(input.to);
        const from = input.from === undefined ? Math.max(0, to - AUDIT_LIMITS.defaultWindowMs) : queryTime(input.from);
        const limit = input.limit === undefined ? 25 : /^[1-9][0-9]?$/.test(input.limit) && !/\s/.test(input.limit) ? Number(input.limit) : NaN;
        if (from >= to || to - from > AUDIT_LIMITS.maxWindowMs || !Number.isSafeInteger(limit) || limit < 1 || limit > AUDIT_LIMITS.maxPageSize)
            invalid('Bounded audit UTC window and page size required');
        const filters: AuditFilters = {};
        for (const key of ['actorId','nodeId','forwardId','operationId'] as const) if (input[key] !== undefined) {
            if (!isId(input[key])) invalid('Exact audit identity filter required');
            filters[key] = input[key];
        }
        if (input.errorCode !== undefined) {
            if (!codeSet.has(input.errorCode)) invalid('Allowlisted audit error code required');
            filters.errorCode = input.errorCode as AuditErrorCode;
        }
        if (input.source !== undefined) {
            if (!sourceSet.has(input.source)) invalid('Known audit source required');
            filters.source = input.source as AuditSource;
        }
        const frozen = deepFreeze(filters), queryDigest = digest({ scope, from, to, limit, filters: frozen });
        const query = deepFreeze({ from, to, limit, filters: frozen, before: decodeCursor(input.cursor, queryDigest, { from, to, filters: frozen }) });
        const sources: readonly AuditSource[] = frozen.source === undefined ? AUDIT_SOURCES : [frozen.source];
        return this.admitted(actor, () => this.db.transaction(async tx => {
            await this.auth.owner(tx, actor, scope);
            const merged: AuditRecord[] = [];
            // A single supplied connection reads each family; no parallel connections or retry loop.
            for (const source of sources) {
                const rows = await this.read.source(tx, scope, source, query);
                if (!Array.isArray(rows) || rows.length > limit + 1) corrupt();
                let previous: AuditPosition | null = query.before;
                for (const raw of rows) {
                    const row = this.row(raw, source, query);
                    if (previous && order(row, previous) >= 0) corrupt();
                    previous = position(row); merged.push(row);
                }
            }
            merged.sort((a,b) => order(b,a));
            for (let i = 1; i < merged.length; i++) if (order(merged[i - 1]!, merged[i]!) <= 0) corrupt();
            const items = merged.slice(0, limit), hasMore = merged.length > limit;
            const at = this.clock(); if (!time(at)) corrupt();
            const result = deepFreeze({ auditVersion: 1, scopeId: scope, capturedAt: nativeIsoTime(at), ...flags,
                window: { from: nativeIsoTime(from), to: nativeIsoTime(to) }, filters: frozen, limit,
                items: items.map(row => ({ ...row, occurredAt: nativeIsoTime(row.occurredAt) })),
                nextCursor: hasMore ? encodeCursor(queryDigest, items[items.length - 1]!) : null, hasMore,
                coverage: { sources: [...sources], ...AUDIT_COVERAGE }, limits: AUDIT_LIMITS });
            if (jsonUtf8Bytes(result) > AUDIT_LIMITS.maxResponseBytes) corrupt();
            return result;
        }));
    }
}
