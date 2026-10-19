import { nativeValueDigest as digest, parseProbeServiceContext, parseProbeEchoServiceContext, nativeWallClockSource } from '../../compatibility/public.ts';
import { ControlError } from '../../framework/public.ts';
import { parseProbeServiceReference, observationTime, parseObservationServiceHead,
    parseObservationServiceRevision } from '../observation-service-owner/public.ts';
export { parseProbeServiceReference } from '../observation-service-owner/public.ts';
import type { ScopeAuthorization } from '../../framework/public.ts';
import type { ObservationServiceReadPort } from '../observation-service-owner/public.ts';
import type { ProbeServiceReference, ProbeServiceResolver,ProbeEchoServiceResolver } from './service-contracts.ts';

const unavailable = (): never => { throw new ControlError('PROBE_PERMIT_UNAVAILABLE', 409, 'Current authorized observation service declaration required'); };
function stored<T>(read: () => T): T {
    try { return read(); } catch { throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid observation service declaration for Probe'); }
}

/** Pins public trust through its real metadata owner. No network, credentials or Runtime writes. */
export class ProbeObservationServices<Tx> implements ProbeServiceResolver<Tx>,ProbeEchoServiceResolver<Tx> {
    private readonly auth: ScopeAuthorization<Tx>;
    private readonly store: ObservationServiceReadPort<Tx>;
    private readonly clock: () => number;
    constructor(auth: ScopeAuthorization<Tx>, store: ObservationServiceReadPort<Tx>, clock: () => number = nativeWallClockSource()) {
        this.auth = auth; this.store = store; this.clock = clock;
    }
    async resolve(tx: Tx, actor: string, scope: string, input: ProbeServiceReference) {
        const context=await this.current(tx,actor,scope,input);
        if(context.config.version!==1)throw new ControlError('UNSUPPORTED_CAPABILITY',422,'TLS Probe requires configuration version one');
        return stored(()=>parseProbeServiceContext(context));
    }
    async resolveEcho(tx:Tx,actor:string,scope:string,input:ProbeServiceReference,protocol:'tcp'|'udp') {
        const context=await this.current(tx,actor,scope,input);
        if(context.config.version!==2||!context.config.endpoint.protocols.includes(protocol))
            throw new ControlError('UNSUPPORTED_CAPABILITY',422,'Echo Probe requires configuration version two and its declared transport');
        return stored(()=>parseProbeEchoServiceContext(context));
    }
    private async current(tx:Tx,actor:string,scope:string,input:ProbeServiceReference) {
        const reference = parseProbeServiceReference(input);
        await this.auth.scope(tx, actor, scope, true);
        const raw = await this.store.head(tx, scope, reference.serviceId);
        if (!raw) unavailable();
        const head = stored(() => parseObservationServiceHead(raw));
        if (head.serviceId !== reference.serviceId || head.archived || head.recoverySuspended ||
            head.revision !== reference.revision || head.configRevision !== reference.configRevision) unavailable();
        const found = await this.store.revision(tx, scope, reference.serviceId, reference.configRevision);
        if (!found) unavailable();
        const revision = stored(() => parseObservationServiceRevision(found, scope, reference.serviceId));
        if (revision.configRevision !== reference.configRevision || revision.configDigest !== reference.configDigest) unavailable();
        const now = this.clock();
        if (!observationTime(now) || now < revision.createdAt) throw new ControlError('CLOCK_UNCERTAIN', 409, 'Observation service clock requires review');
        if (now < revision.config.validFrom || now >= revision.config.validUntil) unavailable();
        const context = { scopeId: scope, ...reference, config: revision.config };
        return { ...context, contextDigest: digest(context) };
    }
}
