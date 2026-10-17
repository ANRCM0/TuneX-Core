import { isId } from '@tunex/core';
import { ControlError, invalid } from './errors.ts';
import { observeNodeReport } from '../modules/node-report-observation.ts';
import type { AuthorizedNodeReportReader, NodeObservationContext, NodeObservationPolicy,
    NodeReportObservation } from '../modules/observation-ports.ts';

export const NODE_OBSERVATION_LIMITS = Object.freeze({
    maxActive: 8, maxActors: 256, cooldownMs: 1000, maxResultBytes: 4096,
    defaultTimeoutMs: 2000, minTimeoutMs: 100, maxTimeoutMs: 2000,
});

/** A bounded, passive observation host, separate from deployment and active network probing. */
export class NodeObservations {
    private readonly read: AuthorizedNodeReportReader['read'];
    private readonly policy: NodeObservationPolicy;
    private readonly actors = new Map<string, { active: boolean; until: number }>();
    private readonly nodes = new Set<string>();
    private active = 0;

    constructor(reader: AuthorizedNodeReportReader, policy: NodeObservationPolicy) {
        if (!Number.isSafeInteger(policy.freshnessMs) || policy.freshnessMs < 1 ||
            !Number.isSafeInteger(policy.clockSkewMs) || policy.clockSkewMs < 0)
            invalid('Invalid observation timing policy');
        this.read = reader.read.bind(reader);
        this.policy = Object.freeze({ freshnessMs: Math.min(policy.freshnessMs, 300000), clockSkewMs: policy.clockSkewMs });
    }

    async observe(actorId: string, scopeId: string, nodeId: string, input: unknown,
        signal?: AbortSignal): Promise<NodeReportObservation> {
        if (!isId(actorId) || !isId(scopeId) || !isId(nodeId)) invalid('Valid observation identity required');
        if (!input || typeof input !== 'object' || Array.isArray(input) ||
            ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
            Object.keys(input).some(key => !['source', 'version', 'timeoutMs'].includes(key)))
            invalid('Closed observation request required');
        const command = input as Record<string, unknown>;
        const timeoutMs = command.timeoutMs === undefined ? NODE_OBSERVATION_LIMITS.defaultTimeoutMs : command.timeoutMs;
        if (command.source !== 'persisted-agent-report' || command.version !== 1 ||
            typeof timeoutMs !== 'number' || !Number.isSafeInteger(timeoutMs) ||
            timeoutMs < NODE_OBSERVATION_LIMITS.minTimeoutMs || timeoutMs > NODE_OBSERVATION_LIMITS.maxTimeoutMs)
            invalid('Supported observation source/version and bounded timeoutMs required');
        if (signal?.aborted) throw this.cancelled();
        const start = performance.now(), key = scopeId + '\0' + nodeId;
        for (const [actor, state] of this.actors) if (!state.active && state.until <= start) this.actors.delete(actor);
        if (this.active >= NODE_OBSERVATION_LIMITS.maxActive || this.nodes.has(key) || this.actors.has(actorId) ||
            this.actors.size >= NODE_OBSERVATION_LIMITS.maxActors)
            throw new ControlError('OBSERVATION_BUSY', 429, 'Observation budget exhausted; retry later', true);
        this.active++;
        this.nodes.add(key);
        this.actors.set(actorId, { active: true, until: Infinity });
        const controller = new AbortController(), deadline = start + timeoutMs;
        const context: NodeObservationContext = Object.freeze({
            actorId, scopeId, nodeId, deadlineAt: Date.now() + timeoutMs, signal: controller.signal,
        });
        const abort = (error: ControlError) => { if (!controller.signal.aborted) controller.abort(error); };
        const timeout = () => abort(new ControlError('OBSERVATION_TIMEOUT', 503, 'Observation deadline exceeded', true));
        const onCancel = () => abort(this.cancelled());
        let rejectStopped: (error: unknown) => void;
        const stopped = new Promise<never>((_, reject) => { rejectStopped = reject; });
        controller.signal.addEventListener('abort', () => rejectStopped(controller.signal.reason), { once: true });
        const timer = setTimeout(timeout, timeoutMs);
        signal?.addEventListener('abort', onCancel, { once: true });
        if (signal?.aborted) onCancel();
        const work = Promise.resolve().then(async () => {
            controller.signal.throwIfAborted();
            const evidence = await this.read(context);
            if (performance.now() >= deadline) timeout();
            controller.signal.throwIfAborted();
            const result = observeNodeReport(evidence, scopeId, nodeId, Date.now(), this.policy);
            if (new TextEncoder().encode(JSON.stringify(result)).length > NODE_OBSERVATION_LIMITS.maxResultBytes)
                throw new ControlError('OBSERVATION_INVALID_RESULT', 503, 'Observation result exceeds budget', true);
            return result;
        });
        // A timed-out reader keeps its slot until it actually stops; a late result cannot free capacity early.
        const release = () => {
            this.active--;
            this.nodes.delete(key);
            this.actors.set(actorId, { active: false, until: performance.now() + NODE_OBSERVATION_LIMITS.cooldownMs });
        };
        void work.then(release, release);
        try {
            return await Promise.race([work, stopped]);
        } catch (error) {
            if (controller.signal.aborted) throw controller.signal.reason;
            if (error instanceof ControlError) {
                if (error.code === 'NOT_FOUND') throw new ControlError('NOT_FOUND', 404, 'Resource not found');
                if (error.code === 'AUTHORIZATION_DENIED')
                    throw new ControlError('AUTHORIZATION_DENIED', 403, 'Observation permission denied');
                if (error.code === 'OBSERVATION_INVALID_RESULT')
                    throw new ControlError('OBSERVATION_INVALID_RESULT', 503, 'Invalid observation evidence', true);
            }
            throw new ControlError('OBSERVATION_FAILED', 503, 'Observation source unavailable', true);
        } finally {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onCancel);
        }
    }

    private cancelled(): ControlError {
        return new ControlError('OBSERVATION_CANCELLED', 409, 'Observation cancelled', true);
    }
}
