import { deepFreeze, isCounter, isId } from '@tunex/core';
import { ControlError, invalid } from '../../framework/public.ts';
import { nativeCommandRequest as requestIdentity, nativeIsoTime, probeServiceSelection, parseProbeServiceContext } from '../../compatibility/public.ts';
import type { IdempotentRequests, ScopeAuthorization, TransactionBoundary } from '../../framework/public.ts';
import type { ProbePermitOwner } from './owner-contracts.ts';
import type { ForwardProbeApi, ProbeAcceptance, AnyProbeAcceptance } from './command-api.ts';
export type { ProbeAcceptance, IngressProbeAcceptance, ServiceProbeAcceptance, AnyProbeAcceptance } from './command-api.ts';
import { PROBE_INGRESS_MEASUREMENT } from './measurement-contracts.ts';
import { parseProbeServiceReference } from '../observation-service-owner/public.ts';

function probeCommand(forward:string,input:unknown) {
    if (!isId(forward) || !input || typeof input !== 'object' || Array.isArray(input) ||
        ![Object.prototype,null].includes(Object.getPrototypeOf(input)) ||
        Object.keys(input).some(k=>!['version','kind','expectedRevision','timeoutMs','service'].includes(k))) invalid('Closed Forward Probe request required');
    const raw=input as Record<string,unknown>,timeoutMs=raw.timeoutMs===undefined?1000:raw.timeoutMs;
    if(raw.version!==1||!['tcp-connect','tcp-ingress-connect','tcp-ingress-tls'].includes(raw.kind as string)||!isCounter(raw.expectedRevision)||typeof timeoutMs!=='number'||!Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>2000)
        invalid('Supported Probe request and bounded timeout required');
    const service=raw.kind==='tcp-ingress-tls'?parseProbeServiceReference(raw.service):undefined;
    if(raw.kind!=='tcp-ingress-tls'&&Object.hasOwn(raw,'service'))invalid('Only TLS Probe accepts a controlled service reference');
    return Object.freeze({version:1,kind:raw.kind as 'tcp-connect'|'tcp-ingress-connect'|'tcp-ingress-tls',expectedRevision:raw.expectedRevision,timeoutMs,...(service?{service}:{})});
}

/** Explicit manager command; retries replay acceptance, never recreate or extend a task. */
export class ForwardProbes<Tx> implements ForwardProbeApi {
    private readonly db: TransactionBoundary<Tx>;
    private readonly identity: ScopeAuthorization<Tx>;
    private readonly requests: IdempotentRequests<Tx>;
    private readonly permits: Pick<ProbePermitOwner<Tx>, 'issueCurrentIn' | 'inspect' | 'revoke'>;
    readonly enabled: boolean;
    readonly ingressEnabled:boolean;
    readonly servicesEnabled:boolean;
    constructor(db: TransactionBoundary<Tx>, identity: ScopeAuthorization<Tx>, requests: IdempotentRequests<Tx>,
        permits: Pick<ProbePermitOwner<Tx>, 'issueCurrentIn' | 'inspect' | 'revoke'>, enabled = false,ingressEnabled=false,servicesEnabled=false) {
        this.db = db; this.identity = identity; this.requests = requests; this.permits = permits; this.enabled = enabled;this.ingressEnabled=enabled&&ingressEnabled;
        this.servicesEnabled=this.ingressEnabled&&servicesEnabled;
    }

    async create(actor: string, scope: string, forward: string, key: string | undefined, input: unknown): Promise<AnyProbeAcceptance> {
        const command = probeCommand(forward,input);
        const request = requestIdentity(actor, scope, key, 'POST', `/api/v1/scopes/${scope}/forwards/${forward}/probes`, command);
        return this.db.transaction(async tx => {
            await this.identity.scope(tx, actor, scope, true);
            const replay = await this.requests.claim<AnyProbeAcceptance>(tx, request);
            if (replay) return deepFreeze(replay);
            const response=await this.issueIn(tx,actor,scope,forward,command);
            await this.requests.respond(tx, request, response);
            return deepFreeze(response);
        });
    }
    /** A finite plan supplies its transaction and a narrowing deadline; only this owner issues the permit. */
    async issueIn(tx:Tx,actor:string,scope:string,forward:string,input:unknown,notAfter?:number):Promise<AnyProbeAcceptance> {
        const command=probeCommand(forward,input);
        if (!this.enabled) throw new ControlError('PROBE_DISABLED',409,'Probe execution issuance is disabled');
        if(command.kind==='tcp-ingress-connect'&&!this.ingressEnabled)throw new ControlError('PROBE_DISABLED',409,'Ingress Probe execution issuance is disabled');
        if(command.kind==='tcp-ingress-tls'&&!this.servicesEnabled)throw new ControlError('PROBE_DISABLED',409,'Controlled service TLS Probe issuance is disabled');
        const permit=await this.permits.issueCurrentIn(tx,actor,scope,forward,command,notAfter);
        const body:ProbeAcceptance['body']={probeId:permit.id,forwardId:forward,issuedAt:nativeIsoTime(permit.issuedAt),
            expiresAt:nativeIsoTime(permit.expiresAt),dispatch:'agent-poll',executionEnabled:false};
        if(command.kind==='tcp-ingress-tls') {
            if(!permit.serviceContext)throw new ControlError('INTEGRITY_FAILURE',409,'TLS Probe service context is missing');
            return deepFreeze({status:202,body:{...body,probeVersion:3,measurement:'tcp-ingress-tls-v1',taskKind:'tcp-ingress-tls',
                point:'agent-local-direct-ingress',capability:'probe.tcp-ingress-tls.v1',service:probeServiceSelection(parseProbeServiceContext(permit.serviceContext))}});
        }
        if(command.kind==='tcp-ingress-connect')return deepFreeze({status:202,body:{...body,probeVersion:2,
            measurement:PROBE_INGRESS_MEASUREMENT,taskKind:'tcp-ingress-connect',point:'agent-local-direct-ingress',capability:'probe.tcp-ingress-connect.v1'}});
        return deepFreeze({status:202,body});
    }
    inspect(actor: string, scope: string, id: string) { return this.permits.inspect(actor, scope, id); }
    revoke(actor: string, scope: string, id: string) { return this.permits.revoke(actor, scope, id); }
}
