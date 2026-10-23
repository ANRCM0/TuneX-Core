import { deepFreeze, isId, parseForward } from '@tunex/core';
import { ControlError, invalid } from '../../framework/public.ts';
import type { ResourceReadAccess, ScopeAuthorization, TransactionBoundary } from '../../framework/public.ts';
import type { ForwardProbePlanApi } from './command-api.ts';
import type { ForwardProbeCapabilitiesApi } from './capability-api.ts';
import type { ForwardProbeCapabilityItem, ForwardProbeCapabilityView, ForwardProbeIssuanceState } from './capability-contracts.ts';
import type { ProbeIntents } from './plan-contracts.ts';
import { PROBE_ECHO_MEASUREMENTS, probeMeasurement } from './measurements.ts';

type Preflight = ForwardProbeCapabilityItem['preflight'];

/** Reuses the original read authorizer. No permit, execution budget or Agent method is supplied. */
export class ForwardProbeCapabilities<Tx> implements ForwardProbeCapabilitiesApi {
    private activeReads = 0;
    private readonly db:TransactionBoundary<Tx>;
    private readonly identity:ScopeAuthorization<Tx>;
    private readonly access:ResourceReadAccess<Tx>;
    private readonly intents:ProbeIntents<Tx>;
    private readonly plans:ForwardProbePlanApi;
    private readonly issuance:ForwardProbeIssuanceState;
    constructor(db: TransactionBoundary<Tx>, identity: ScopeAuthorization<Tx>,
        access: ResourceReadAccess<Tx>, intents: ProbeIntents<Tx>,
        plans: ForwardProbePlanApi, issuance: ForwardProbeIssuanceState) {
        this.db=db;this.identity=identity;this.access=access;this.intents=intents;this.plans=plans;this.issuance=issuance;
    }

    async get(actor: string, scope: string, id: string): Promise<ForwardProbeCapabilityView> {
        if (!isId(actor) || !isId(scope) || !isId(id)) invalid('Valid Probe capability identity required');
        if (this.activeReads >= 4)
            throw new ControlError('PROBE_CAPABILITY_BUSY', 429, 'Probe capability read capacity unavailable', true);
        this.activeReads++;
        try { return await this.read(actor, scope, id); }
        finally { this.activeReads--; }
    }

    private async read(actor: string, scope: string, id: string): Promise<ForwardProbeCapabilityView> {
        const record = await this.db.transaction(async tx => {
            await this.identity.scope(tx, actor, scope, true);
            await this.access.owned(tx, actor, scope, 'forward', id);
            const current = await this.intents.record(tx, scope, id);
            const parsed = parseForward({ id: current.id, scopeId: current.scopeId, revision: current.revision, spec: current.spec });
            if (!parsed.ok || parsed.value.id !== id || parsed.value.scopeId !== scope)
                throw new ControlError('INTEGRITY_FAILURE', 409, 'Stored Forward cannot be classified');
            return { forward: parsed.value, deleting: current.deleting, recoverySuspended: current.recoverySuspended };
        });
        const forward = record.forward;
        const mode = !forward.spec.path?.via.length ? 'direct' : forward.spec.path.via.length === 1 ? 'relay' : 'multihop';
        const originalDirect = !forward.spec.path && !forward.spec.transport;
        const inactive = record.deleting || record.recoverySuspended || !forward.spec.enabled;
        const items: ForwardProbeCapabilityItem[] = [];
        for (const measurement of PROBE_ECHO_MEASUREMENTS) {
            const description = probeMeasurement(measurement);
            const echo = description.taskKind === 'tcp-ingress-echo' || description.taskKind === 'udp-ingress-echo';
            const protocol = description.taskKind === 'udp-ingress-echo' ? 'udp' : 'tcp';
            const enabled = description.taskKind === 'tcp-connect' ? this.issuance.enabled :
                description.taskKind === 'tcp-ingress-connect' ? this.issuance.ingressEnabled : this.issuance.servicesEnabled;
            const issuance = echo ? 'not-dispatchable' : enabled ? 'enabled' : 'disabled';
            let preflight: Preflight;
            if (!originalDirect) preflight = {
                state: 'unsupported', expiresAt: null, reason: { code: 'UNSUPPORTED_CAPABILITY',
                    message: 'Active Probe execution supports the original Direct transport only. Relay, multihop and configured transport profiles have no controlled business-path Probe in this command.' },
            };
            else if (!forward.spec.protocols.includes(protocol)) preflight = {
                state: 'unsupported', expiresAt: null, reason: { code: 'UNSUPPORTED_CAPABILITY', message: `This Forward does not enable ${protocol.toUpperCase()}.` },
            };
            else if (inactive) preflight = {
                state: 'unavailable', expiresAt: null, reason: { code: 'PROBE_UNAVAILABLE', message: 'Probe requires an enabled Forward that is neither deleting nor recovery suspended.' },
            };
            else if (description.taskKind === 'tcp-connect' || description.taskKind === 'tcp-ingress-connect')
                preflight = await this.preflight(actor, scope, id, forward.revision, description.taskKind);
            else preflight = {
                state: 'requires-controlled-service', expiresAt: null, reason: { code: 'CONTROLLED_SERVICE_REQUIRED',
                    message: 'An exact registered observation service is required. Submit its current reference to the original Probe planner for authorization; this query has not checked the service or current execution binding.' },
            };
            items.push({ ...description, protocol, endToEnd: false, health: 'unknown',
                transportSupport: originalDirect ? 'supported' : 'unsupported', issuance,
                issuanceReason: echo ? 'The original ForwardProbes command does not accept echo kinds; planner support does not enable dispatch.' :
                    enabled ? 'The original command switch is enabled. Permit issuance, current authorization and Agent execution are still checked by their original owners.' :
                        'The original command switch is disabled. Read-only preflight does not enable issuance.',
                preflight });
        }
        return deepFreeze({ capabilityVersion: 1, scopeId: scope, forwardId: id, forwardRevision: forward.revision, mode,
            readOnly: true, networkCheck: 'not-performed', executionAuthorized: false, endToEnd: false,
            health: 'unknown', consistency: 'read-committed-not-global-snapshot', items,
            diagnostics: { apiPath: `/api/v1/scopes/${encodeURIComponent(scope)}/forwards/${encodeURIComponent(id)}/diagnostics`,
                source: 'persisted-control-and-agent-state', readOnly: true, networkCheck: 'not-performed', health: 'unknown',
                description: 'Inspect persisted per-node bindings, adjacent segments, target configuration, operations and historical Probe evidence. Passive diagnostics do not verify end-to-end traffic or application health.' },
        });
    }

    private async preflight(actor: string, scope: string, id: string, revision: number,
        kind: 'tcp-connect' | 'tcp-ingress-connect'): Promise<Preflight> {
        try {
            const plan = await this.plans.plan(actor, scope, id, { version: 1, kind, expectedRevision: revision, timeoutMs: 1000 });
            return { state: 'available', expiresAt: plan.expiresAt, reason: { code: 'PREFLIGHT_AVAILABLE',
                message: kind === 'tcp-connect' ? 'The original planner accepted Agent-to-target TCP connect preflight. It does not traverse the ingress or prove application health.' :
                    'The original planner accepted Agent-local Direct listener connect preflight. A local connection does not prove external reachability or end-to-end business health.' } };
        } catch (error) {
            if (!(error instanceof ControlError)) throw error;
            if (error.code === 'UNSUPPORTED_CAPABILITY' && (error.status === 409 || error.status === 422))
                return { state: 'unsupported', expiresAt: null, reason: { code: error.code, message: error.message } };
            if ((error.code === 'PROBE_UNAVAILABLE' || error.code === 'REVISION_CONFLICT') && error.status === 409)
                return { state: 'unavailable', expiresAt: null, reason: { code: error.code, message: error.message } };
            throw error;
        }
    }
}
