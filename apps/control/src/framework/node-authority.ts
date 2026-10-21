import type { Forward } from '@tunex/core';
import { ControlError, invalid, notFound } from './errors.ts';
import type { AuthorizedNodeFacts } from './node-facts.ts';
import type { TransactionBoundary } from './application-ports.ts';
import type { RuntimeNodeResources } from './runtime-resource-ports.ts';
import type { NodeAuthorityStore, NodeAuthorityOptions, NodeCertificateSigner, NodeMachineLookup,
    NodeScopeAuthority, NodeSecrets, NodeAuthorityCodec, NodeUseAuthorization, NodeUseRole } from './node-authority-ports.ts';

/** Coordinates the original Node credential owner; it does not create a new authority. */
export class NodeAuthorityHost<Tx> {
    protected readonly db:TransactionBoundary<Tx>;
    protected readonly identity:NodeScopeAuthority<Tx>;
    protected readonly store:NodeAuthorityStore<Tx>;
    protected readonly runtime:RuntimeNodeResources<Tx>;
    protected readonly secrets:NodeSecrets;
    protected readonly codec:NodeAuthorityCodec;
    protected readonly now:()=>number;
    private readonly useAuthorization:NodeUseAuthorization<Tx>;
    private readonly ca:NodeCertificateSigner;
    private readonly machines:NodeMachineLookup;
    private readonly overlapSeconds:number;
    private readonly relayCredentialSeconds:number;

    constructor(options:NodeAuthorityOptions<Tx>) {
        const {overlapSeconds,relayCredentialSeconds}=options;
        if(!Number.isInteger(overlapSeconds)||overlapSeconds<1||overlapSeconds>300)
            throw new Error('Credential overlap must be 1..300 seconds');
        if(!Number.isInteger(relayCredentialSeconds)||relayCredentialSeconds<60||relayCredentialSeconds>86400)
            throw new Error('Relay credential authority must be 60..86400 seconds');
        if(typeof options.codec?.formatTime!=='function')throw new Error('Node authority time codec is required');
        if(typeof options.codec.validEnrollmentToken!=='function'||typeof options.codec.validCredentialRequest!=='function'||
            typeof options.codec.supportsDirectRuntime!=='function'||typeof options.codec.relayFingerprint!=='function')
            throw new Error('Node authority native codec is required');
        this.db=options.db;this.identity=options.identity;this.store=options.store;this.runtime=options.resources;
        this.secrets=options.secrets;this.codec=options.codec;this.now=options.now;this.ca=options.signer;this.machines=options.machine;
        this.overlapSeconds=overlapSeconds;this.relayCredentialSeconds=relayCredentialSeconds;
        this.useAuthorization=options.useAuthorization;
    }
    async enroll(nodeId: string, token: string, csr: string): Promise<{
        certificate: string;
        ca: string;
    }> {
        if (!this.codec.isId(nodeId) || !this.codec.validEnrollmentToken(token) || !this.codec.validCredentialRequest(csr))
            invalid('Invalid enrollment input');
        const csrDigest = this.codec.digest({ csr });
        return this.db.transaction(async (tx) => {
            const node = await this.store.enrollment(tx,nodeId,this.secrets.tokenHash(token));
            if (!node || node.revoked || node.enrollment_until <= this.now())
                throw new ControlError('AUTHORIZATION_DENIED', 403, 'Enrollment rejected');
            if (node.csr_digest) {
                if (node.csr_digest !== csrDigest)
                    throw new ControlError('ENROLLMENT_USED', 409, 'Token already exchanged');
                return this.codec.readValue(node.enrollment_response);
            }
            const signed = await this.ca.sign(nodeId, csr);
            const response = { certificate: signed.certificate, ca: signed.ca };
            if (node.enrollment_until <= this.now())
                throw new ControlError('AUTHORIZATION_DENIED', 403, 'Enrollment token expired before acceptance');
            await this.store.acceptEnrollment(tx,nodeId,csrDigest,signed,response);
            await this.store.insertCredential(tx,nodeId,signed,this.now());
            return response;
        });
    }
    async machine(fingerprint: string): Promise<string> {
        const row = await this.machines.machine(fingerprint,this.now(),this.now());
        if (!row)
            throw new ControlError('AUTHORIZATION_DENIED', 403, 'Node credential rejected');
        return row.node_id;
    }
    async credential(tx: Tx, nodeId: string, fingerprint: string): Promise<number> {
        const row = await this.store.credential(tx,nodeId,fingerprint);
        const until = row ? Math.min(row.valid_until, row.retire_after ?? row.valid_until) : 0;
        if (until <= this.now())
            throw new ControlError('AUTHORIZATION_DENIED', 403, 'Node credential expired or withdrawn');
        return until;
    }
    async state(tx: Tx, nodeId: string): Promise<{
        facts: AuthorizedNodeFacts;
        credentialUntil: number;
        revoked: boolean;
    }> {
        const node = await this.store.state(tx,nodeId);
        if (!node)
            notFound();
        return { facts: this.codec.readValue(node.facts), credentialUntil: node.credential_until ?? 0, revoked: Boolean(node.revoked) };
    }
    async facts(tx: Tx, nodeId: string): Promise<{
        facts: AuthorizedNodeFacts;
        credentialUntil: number;
    }> {
        const state = await this.state(tx, nodeId);
        if (state.revoked || state.credentialUntil <= this.now())
            throw new ControlError('AUTHORIZATION_DENIED', 403, 'Node authorization expired');
        return state;
    }
    async cleanupFacts(tx: Tx, nodeId: string, scopeId: string): Promise<AuthorizedNodeFacts> {
        const state = await this.state(tx, nodeId);
        if (state.facts.scopeId !== scopeId)
            notFound();
        return state.facts;
    }
    async authorized(tx: Tx, actor: string, forward: Forward): Promise<AuthorizedNodeFacts> {
        await this.identity.scope(tx, actor, forward.scopeId, true);
        const grant = await this.store.scopeGrant(tx,forward.spec.ingress.nodeId,actor,forward.scopeId);
        if (!grant)
            notFound();
        if(!await this.useAllowed(tx,actor,forward.scopeId,forward.spec.ingress.nodeId,'ingress',forward))notFound();
        const { facts } = await this.facts(tx, forward.spec.ingress.nodeId);
        if (!this.intentAllowed(facts, forward))
            throw new ControlError('AUTHORIZATION_DENIED', 403, 'Forward violates Node network policy');
        return facts;
    }
    private useAllowed(tx:Tx,actor:string,scopeId:string,nodeId:string,role:NodeUseRole,forward?:Forward):Promise<boolean>{
        if(!['ingress','transit','egress'].includes(role)||!this.useAuthorization)return Promise.resolve(false);
        return this.useAuthorization.allowed(tx,actor,scopeId,nodeId,role,forward);
    }
    async authorizedRelayNode(tx:Tx,actor:string,scopeId:string,nodeId:string,role:NodeUseRole,forward?:Forward):Promise<AuthorizedNodeFacts>{
        if(!this.codec.isId(nodeId))invalid('Valid Relay Node ID required');await this.identity.scope(tx,actor,scopeId,true);const grant=await this.store.relayGrant(tx,nodeId,scopeId,actor);if(!grant||!await this.useAllowed(tx,actor,scopeId,nodeId,role,forward))notFound();const {facts}=await this.facts(tx,nodeId);return facts;
    }
    hasGrant(tx:Tx,nodeId:string,actorId:string):Promise<boolean> { return this.store.hasGrant(tx,nodeId,actorId); }
    async canExecute(tx: Tx, actorId: string, forward: Forward): Promise<boolean> {
        if (!await this.identity.executing(tx, actorId, forward.scopeId) || !await this.hasGrant(tx, forward.spec.ingress.nodeId, actorId))
            return false;
        if(!await this.useAllowed(tx,actorId,forward.scopeId,forward.spec.ingress.nodeId,'ingress',forward))return false;
        const node = await this.state(tx, forward.spec.ingress.nodeId);
        return !node.revoked && node.credentialUntil > this.now() && this.intentAllowed(node.facts, forward);
    }
    intentAllowed(facts: AuthorizedNodeFacts, forward: Forward): boolean {
        return facts.nodeId === forward.spec.ingress.nodeId && facts.scopeId === forward.scopeId && facts.allowedListenerAddresses.includes(forward.spec.ingress.listen.address) && facts.allowedPorts.includes(forward.spec.ingress.listen.port) && this.codec.supportsDirectRuntime(facts) && forward.spec.protocols.every(protocol => facts.capabilities.includes(protocol)) && this.codec.targetAllowed(forward.spec.target.host, facts);
    }
    async capabilities(tx:Tx,nodeId:string,capabilities:string[]):Promise<void> { const {facts}=await this.facts(tx,nodeId);await this.store.setFacts(tx,nodeId,{...facts,capabilities}); }
    audit(tx:Tx,nodeId:string,actor:string|null,kind:'credential_rotation'|'policy_update'|'node_revocation'|'relay_endpoint_update'|'relay_credential_issue'|'resource_classification',details:unknown):Promise<void> { return this.store.securityEvent(tx,this.secrets.newID(),nodeId,actor,kind,this.now(),details); }
    async relayCredential(nodeId:string,fingerprint:string,epoch:number,requestId:string,csr:string):Promise<{nodeId:string;certificate:string;ca:string;fingerprint:string;validUntil:string;certificateNotAfter:string;overlapUntil:string|null}>{
        if(!this.codec.isId(requestId)||!this.codec.validCredentialRequest(csr))invalid('Valid Relay request ID and CSR required');const requestDigest=this.codec.digest({csr});
        return this.db.transaction(async tx=>{await this.runtime.lockNode(tx,nodeId,epoch);const node=await this.store.currentForUpdate(tx,nodeId);if(!node||node.revoked)throw new ControlError('AUTHORIZATION_DENIED',403,'Node is revoked');const machineUntil=await this.credential(tx,nodeId,fingerprint);
            const previous=await this.store.relayReplay(tx,nodeId,requestId);if(previous){if(previous.request_digest!==requestDigest)throw new ControlError('IDEMPOTENCY_CONFLICT',409,'Relay CSR request differs');return this.codec.readValue(previous.response);}
            if(node.credential_fingerprint!==fingerprint)throw new ControlError('CREDENTIAL_SUPERSEDED',409,'Current machine credential required for Relay issuance');
            const active=await this.store.activeRelayCredentials(tx,nodeId,this.now(),this.now());if(active.length>=2)throw new ControlError('RESOURCE_LIMIT',429,'At most two Relay credentials may overlap');
            const signed=await this.ca.sign(nodeId,csr,'relay');await this.credential(tx,nodeId,fingerprint);const now=this.now(),until=Math.min(signed.until,machineUntil,now+this.relayCredentialSeconds*1000);if(until<=now)throw new ControlError('AUTHORIZATION_DENIED',403,'Relay credential has no remaining authority');
            const overlap=Math.min(until,now+this.overlapSeconds*1000);await this.store.retireRelayCredentials(tx,nodeId,overlap);await this.store.insertRelayCredential(tx,nodeId,signed,now,until);const response={nodeId,certificate:signed.certificate,ca:signed.ca,fingerprint:signed.fingerprint,validUntil:this.codec.formatTime(until),certificateNotAfter:this.codec.formatTime(signed.until),overlapUntil:active.length?this.codec.formatTime(overlap):null};await this.store.saveRelayRequest(tx,nodeId,requestId,requestDigest,fingerprint,response);await this.audit(tx,nodeId,null,'relay_credential_issue',{fingerprint:signed.fingerprint,validUntil:until,overlapUntil:active.length?overlap:null});return response;
        });
    }
    async relayCredentialFacts(tx:Tx,nodeId:string,currentOnly=false):Promise<{fingerprint:string;certificate:string;validUntil:number}[]>{
        const node=await this.state(tx,nodeId);if(node.revoked||node.credentialUntil<=this.now())throw new ControlError('AUTHORIZATION_DENIED',403,'Node authorization expired');const credentials=await this.store.relayCredentials(tx,nodeId,this.now(),this.now(),currentOnly);if(credentials.length<1||credentials.length>2)throw new ControlError('AUTHORIZATION_DENIED',403,'Bounded Relay credentials required');return credentials.map(c=>({fingerprint:this.codec.relayFingerprint(c.fingerprint),certificate:c.certificate,validUntil:Math.min(c.valid_until,c.retire_after??c.valid_until,node.credentialUntil)}));
    }
    async rotate(nodeId: string, fingerprint: string, epoch: number, requestId: string, csr: string): Promise<{
        certificate: string;
        ca: string;
        fingerprint: string;
        validUntil: string;
        oldCredentialUntil: string;
    }> {
        if (!this.codec.isId(requestId) || !this.codec.validCredentialRequest(csr))
            invalid('Valid request ID and CSR required');
        const requestDigest = this.codec.digest({ csr });
        return this.db.transaction(async (tx) => {
            await this.runtime.lockNode(tx, nodeId, epoch);
            const current = await this.store.currentForUpdate(tx,nodeId);
            if (!current || current.revoked)
                throw new ControlError('AUTHORIZATION_DENIED', 403, 'Node revoked');
            await this.credential(tx, nodeId, fingerprint);
            const replay = await this.store.rotationReplay(tx,nodeId,requestId);
            if (replay) {
                if (replay.request_digest !== requestDigest)
                    throw new ControlError('IDEMPOTENCY_CONFLICT', 409, 'Rotation request changed');
                return this.codec.readValue(replay.response);
            }
            if (current.credential_fingerprint !== fingerprint)
                throw new ControlError('CREDENTIAL_SUPERSEDED', 409, 'Only current credential may initiate another rotation');
            const signed = await this.ca.sign(nodeId, csr);
            await this.credential(tx, nodeId, fingerprint);
            const now = this.now();
            const overlap = Math.min(current.credential_until ?? now, now + this.overlapSeconds * 1000);
            await this.store.insertCredential(tx,nodeId,signed,now);
            await this.store.retireCredential(tx,nodeId,fingerprint,overlap);
            await this.store.setCurrentCredential(tx,nodeId,signed);
            const response = { certificate: signed.certificate, ca: signed.ca, fingerprint: signed.fingerprint, validUntil: this.codec.formatTime(signed.until), oldCredentialUntil: this.codec.formatTime(overlap) };
            await this.store.saveRotation(tx,nodeId,requestId,requestDigest,fingerprint,response);
            await this.audit(tx, nodeId, null, 'credential_rotation', { oldFingerprint: fingerprint, newFingerprint: signed.fingerprint, overlapUntil: overlap });
            return response;
        });
    }
}
