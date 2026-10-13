import { compileRelayResources } from '../modules/runtime/relay-planner.ts';
import { RelayEndpoints } from '../modules/relay-endpoints.ts';
import { Transport } from '../modules/transport.ts';
import { randomUUID } from 'node:crypto';
import { decideForwardChange, isCounter, isId, MAX_COUNTER, parseForwardSpec } from '@tunex/core';
import type { Forward } from '@tunex/core';
import { digest } from '@tunex/contracts';
import type { Policy } from '@tunex/contracts';
import { ControlError, invalid } from './errors.ts';
import type { MySqlUnitOfWork, Transaction } from '../infrastructure/mysql.ts';
import type { Identity } from '../modules/identity.ts';
import type { Nodes } from '../modules/nodes.ts';
import { Forwarding } from '../modules/forwarding.ts';
import { Idempotency } from '../modules/idempotency.ts';
import type { Accepted, RequestIdentity } from '../modules/idempotency.ts';
import { RuntimeLedger } from '../modules/runtime/ledger.ts';
import { compileDirect } from '../modules/runtime/planner.ts';
import { RelayCoordinator } from '../modules/runtime/relay-coordinator.ts';
import type { NodePolicy } from '../modules/nodes.ts';
import type { AuthorizedNodeFacts } from '../modules/runtime/planner.ts';
import { json } from '../infrastructure/mysql.ts';
import { tokenHash } from '../modules/identity.ts';
function requestIdentity(actorId: string, scopeId: string, key: string | undefined, method: string, path: string, input: unknown): RequestIdentity {
    if (!isId(actorId) || !isId(scopeId) || !key || !/^[\x21-\x7e]{1,128}$/.test(key))
        invalid('Valid identity, scope and Idempotency-Key required');
    return { actorId, scopeId, key, digest: digest({ method, path, input }) };
}
function revision(value: number): void {
    if (!isCounter(value))
        invalid('Positive safe expectedRevision required');
}
/** Coordinates owner-owned commands inside one durable acceptance transaction. */
export class ControlApplication {
    readonly forwarding = new Forwarding();
    readonly transport:Transport;
    readonly relayEndpoints:RelayEndpoints;
    readonly ledger: RuntimeLedger;
    readonly idempotency = new Idempotency();
    readonly db: MySqlUnitOfWork;
    readonly identity: Identity;
    readonly nodes: Nodes;
    readonly relay: RelayCoordinator;
    constructor(db: MySqlUnitOfWork, identity: Identity, nodes: Nodes, policy?: Policy) {
        this.db=db;this.identity=identity;this.nodes=nodes;
        this.ledger=new RuntimeLedger(policy,nodes);
        this.transport=new Transport(db,identity,this.idempotency,this.forwarding);
        this.relayEndpoints=new RelayEndpoints(db,identity,nodes,this.idempotency,this.forwarding);
        this.relay=new RelayCoordinator(nodes,this.forwarding,this.transport,this.relayEndpoints,this.ledger,policy);
        this.ledger.additionalAssignments=(tx,nodeId,includeAccepted)=>this.relay.assignments(tx,nodeId,includeAccepted);
        this.transport.onGrantChange=async(tx,request,profileId,subject,allowed)=>{
            const operations:string[]=[];
            for(const forward of await this.forwarding.forProfileActor(tx,profileId,subject)){
                await this.lockExecution(tx,forward);
                const canRun=allowed&&await this.executionAllowed(tx,subject,forward);
                if(canRun&&forward.spec.enabled)await this.transitionExecution(tx,subject,forward);
                operations.push(await this.ledger.accept(tx,forward,request,canRun?'policy':'revoke'));
            }
            return operations;
        };
    }
    async planRelay(actorId:string,scopeId:string,input:unknown){
        const parsed=parseForwardSpec(input);if(!parsed.ok)invalid('Valid Forward spec required');const spec=parsed.value;if(spec.path?.via.length!==1||!spec.transport)throw new ControlError('UNSUPPORTED_CAPABILITY',422,'Relay preview requires one egress and locked Transport Profile');
        return this.db.transaction(async tx=>{await this.identity.scope(tx,actorId,scopeId,true);const nodes=[];for(const nodeId of [spec.ingress.nodeId,spec.path!.via[0]!].sort())nodes.push(await this.nodes.authorizedRelayNode(tx,actorId,scopeId,nodeId));const profile=await this.transport.resolve(tx,actorId,scopeId,spec.transport!.profileId,spec.transport!.configRevision),endpoint=await this.relayEndpoints.resolve(tx,spec.path!.via[0]!);const ports=endpoint.config.allowedTcpPorts;const resources=compileRelayResources({id:'preview',scopeId,revision:1,spec},nodes,profile,endpoint,{tcp:ports[0]!,udp:ports[spec.protocols.length===2?1:0]!});return {profile:{profileId:profile.profileId,revision:profile.revision,configDigest:profile.configDigest},endpointRevision:endpoint.revision,resources,executionSupported:false,reserved:false};});
    }
    private async executionAllowed(tx:Transaction,actor:string,forward:Forward):Promise<boolean>{return forward.spec.path?this.relay.canExecute(tx,actor,forward):this.nodes.canExecute(tx,actor,forward);}
    private async transitionExecution(tx:Transaction,actor:string,forward:Forward):Promise<void>{if(forward.spec.path)await this.relay.acceptPlan(tx,actor,forward);else await this.ledger.transition(tx,forward,forward);}
    private async lockExecution(tx:Transaction,forward:Forward):Promise<void>{if(forward.spec.path)await this.relay.lockNodes(tx,forward);else await this.ledger.lockNode(tx,forward.spec.ingress.nodeId);}
    async create(actorId: string, scopeId: string, key: string | undefined, input: unknown): Promise<Accepted> {
        const parsed=parseForwardSpec(input);if(!parsed.ok)invalid('Invalid Forward spec');const spec=parsed.value;
        const request = requestIdentity(actorId, scopeId, key, 'POST', `/api/v1/scopes/${scopeId}/forwards`, spec);
        return this.db.transaction(async (tx) => {
            await this.identity.scope(tx, actorId, scopeId);
            const replay = await this.idempotency.claim(tx, request);
            if (replay) {
                await this.forwarding.record(tx, scopeId, replay.body.forwardId);
                return replay;
            }
            await this.identity.scope(tx, actorId, scopeId, true);
            const forward: Forward = { id: randomUUID(), scopeId, revision: 1, spec };
            let facts:AuthorizedNodeFacts|undefined;
            if(spec.path||spec.transport){if(!spec.path||!spec.transport)throw new ControlError('UNSUPPORTED_CAPABILITY',422,'Relay path and Transport Profile are both required');await this.nodes.authorizedRelayNode(tx,actorId,scopeId,spec.ingress.nodeId);await this.nodes.authorizedRelayNode(tx,actorId,scopeId,spec.path.via[0]!);for(const nodeId of [spec.ingress.nodeId,spec.path.via[0]!].sort())await this.ledger.lockNode(tx,nodeId);}
            else {const authorized=await this.nodes.authorized(tx,actorId,forward);facts=authorized;await this.ledger.lockNode(tx,authorized.nodeId);compileDirect({...forward,spec:{...spec,enabled:true}},authorized,spec.protocols.map(protocol=>({nodeId:authorized.nodeId,forwardId:forward.id,protocol,port:spec.ingress.listen.port,bindingFence:1,deploymentGeneration:1})));}
            const slots = (spec.path||spec.transport)?[]:await this.ledger.reserve(tx, forward);
            if(facts)compileDirect({ ...forward, spec: { ...spec, enabled: true } }, facts, slots);
            await this.forwarding.insert(tx, forward, actorId);
            if(spec.path||spec.transport)await this.relay.acceptPlan(tx,actorId,forward);
            const operationId = await this.ledger.accept(tx, forward, request);
            if(facts)await this.ledger.assertCapacity(tx, this.forwarding, facts);
            else for(const nodeId of await this.relay.nodeIDs(tx,forward))await this.ledger.assertCapacity(tx,this.forwarding,await this.nodes.cleanupFacts(tx,nodeId,scopeId));
            const response: Accepted = { status: 202, body: { forwardId: forward.id, revision: 1, operationId } };
            await this.idempotency.respond(tx, request, response);
            return response;
        });
    }
    async update(actorId: string, scopeId: string, id: string, key: string | undefined, expectedRevision: number, input: unknown): Promise<Accepted> {
        revision(expectedRevision);
        if (!isId(id))
            invalid('Valid Forward ID required');
        const parsed=parseForwardSpec(input);if(!parsed.ok)invalid('Invalid Forward spec');const spec=parsed.value;
        const request = requestIdentity(actorId, scopeId, key, 'PUT', `/api/v1/scopes/${scopeId}/forwards/${id}`, { expectedRevision, spec });
        return this.db.transaction(async (tx) => {
            await this.identity.scope(tx, actorId, scopeId);
            const replay = await this.idempotency.claim(tx, request);
            if (replay)
                return replay;
            await this.identity.scope(tx, actorId, scopeId, true);
            const current = await this.forwarding.currentForUpdate(tx, scopeId, id);
            const decision = decideForwardChange(current, expectedRevision, { kind: 'replace', spec });
            if (!decision.ok)
                throw new ControlError(decision.errors[0]!.code, 409, decision.errors[0]!.message);
            const next = decision.value;
            if (next.spec.ingress.nodeId !== current.spec.ingress.nodeId){const restored=await this.forwarding.record(tx,scopeId,id);const oldNode=await this.nodes.state(tx,current.spec.ingress.nodeId);if(!restored.recoverySuspended||!oldNode.revoked)throw new ControlError('UNSUPPORTED_CAPABILITY',422,'Live Node moves require the later multi-node coordinator');for(const nodeId of [current.spec.ingress.nodeId,next.spec.ingress.nodeId].sort())await this.ledger.lockNode(tx,nodeId);}
            let facts:AuthorizedNodeFacts|undefined;
            if(next.spec.path||next.spec.transport){await this.relay.lockNodes(tx,next);if(next.spec.enabled&&!await this.relay.canExecute(tx,actorId,next))throw new ControlError('AUTHORIZATION_DENIED',403,'Relay execution is not authorized');}
            else {const authorized=await this.nodes.authorized(tx,actorId,next);facts=authorized;await this.ledger.lockNode(tx,authorized.nodeId);compileDirect({...next,spec:{...next.spec,enabled:true}},authorized,next.spec.protocols.map(protocol=>({nodeId:authorized.nodeId,forwardId:next.id,protocol,port:next.spec.ingress.listen.port,bindingFence:1,deploymentGeneration:1})));}
            if (next.revision === current.revision) {
                const response: Accepted = { status: 200, body: { forwardId: id, revision: current.revision, operationId: null } };
                await this.idempotency.respond(tx, request, response);
                return response;
            }
            // Every changed execution gets a fresh generation/fence, even when currently disabled.
            const slots = (next.spec.path||next.spec.transport)?[]:await this.ledger.transition(tx, current, next);
            if(facts)compileDirect({ ...next, spec: { ...next.spec, enabled: true } }, facts, slots);
            await this.forwarding.replace(tx, current, next);
            await this.forwarding.setAuthorizer(tx, next.id, actorId);
            if((next.spec.path||next.spec.transport)&&next.spec.enabled)await this.relay.acceptPlan(tx,actorId,next);
            const kind = !next.spec.enabled ? 'disable' : !current.spec.enabled ? 'enable' : 'update';
            const operationId = await this.ledger.accept(tx, next, request, kind, current.spec);
            if(facts)await this.ledger.assertCapacity(tx, this.forwarding, facts);
            else for(const nodeId of await this.relay.nodeIDs(tx,next))await this.ledger.assertCapacity(tx,this.forwarding,await this.nodes.cleanupFacts(tx,nodeId,scopeId));
            const response: Accepted = { status: 202, body: { forwardId: id, revision: next.revision, operationId } };
            await this.idempotency.respond(tx, request, response);
            return response;
        });
    }
    async remove(actorId: string, scopeId: string, id: string, key: string | undefined, expectedRevision: number): Promise<Accepted> {
        revision(expectedRevision);
        if (!isId(id))
            invalid('Valid Forward ID required');
        const request = requestIdentity(actorId, scopeId, key, 'DELETE', `/api/v1/scopes/${scopeId}/forwards/${id}`, { expectedRevision });
        return this.db.transaction(async (tx) => {
            await this.identity.scope(tx, actorId, scopeId);
            const replay = await this.idempotency.claim(tx, request);
            if (replay)
                return replay;
            await this.identity.scope(tx, actorId, scopeId, true);
            const current = await this.forwarding.currentForUpdate(tx, scopeId, id);
            if(current.spec.path)await this.relay.lockNodes(tx,current);else await this.ledger.lockNode(tx, current.spec.ingress.nodeId);
            if (current.revision !== expectedRevision)
                throw new ControlError('REVISION_CONFLICT', 409, 'Expected revision does not match');
            if (current.revision >= MAX_COUNTER)
                throw new ControlError('REVISION_EXHAUSTED', 409, 'Revision counter exhausted');
            const next = { ...current, revision: current.revision + 1 };
            await this.forwarding.markDeleting(tx, current, next.revision);
            const operationId = await this.ledger.accept(tx, next, request, 'delete', current.spec);
            const facts = await this.nodes.cleanupFacts(tx, next.spec.ingress.nodeId, next.scopeId);
            await this.ledger.assertCapacity(tx, this.forwarding, facts);
            if(next.spec.path)for(const nodeId of (await this.relay.nodeIDs(tx,next)).filter(nodeId=>nodeId!==facts.nodeId))await this.ledger.assertCapacity(tx,this.forwarding,await this.nodes.cleanupFacts(tx,nodeId,scopeId));
            const response: Accepted = { status: 202, body: { forwardId: id, revision: next.revision, operationId } };
            await this.idempotency.respond(tx, request, response);
            return response;
        });
    }
    async retry(actorId: string, scopeId: string, key: string | undefined, sourceOperationId: string, expectedRevision: number): Promise<Accepted> {
        revision(expectedRevision);
        if (!isId(sourceOperationId))
            invalid('Valid Operation ID required');
        const request = requestIdentity(actorId, scopeId, key, 'POST', `/api/v1/scopes/${scopeId}/operations/${sourceOperationId}/retry`, { expectedRevision });
        return this.db.transaction(async (tx) => {
            await this.identity.scope(tx, actorId, scopeId);
            const replay = await this.idempotency.claim(tx, request);
            if (replay)
                return replay;
            await this.identity.scope(tx, actorId, scopeId, true);
            const sourceReference = await this.ledger.read(tx, scopeId, sourceOperationId);
            const forward = await this.forwarding.currentForUpdate(tx, scopeId, sourceReference.forward_id);
            await this.lockExecution(tx,forward);
            const source = await this.ledger.get(tx, scopeId, sourceOperationId);
            if(source.recovery_invalidated)throw new ControlError('OPERATION_SUPERSEDED',409,'Restored operation is not an authoritative deployment attempt');
            if (forward.revision !== expectedRevision || source.target_revision !== forward.revision)
                throw new ControlError('OPERATION_SUPERSEDED', 409, 'Operation no longer targets an editable desired revision');
            if (source.status !== 'failed')
                throw new ControlError('OPERATION_NOT_RETRYABLE', 409, 'Only failed Operations can be retried');
            const facts = forward.spec.path?await this.nodes.authorizedRelayNode(tx,actorId,scopeId,forward.spec.ingress.nodeId):await this.nodes.authorized(tx, actorId, forward);
            await this.lockExecution(tx,forward);
            if (forward.spec.enabled)
                await this.transitionExecution(tx,actorId,forward);
            await this.forwarding.setAuthorizer(tx, forward.id, actorId);
            const operationId = await this.ledger.accept(tx, forward, request, 'retry', source.previous_spec, source.id);
            await this.ledger.assertCapacity(tx, this.forwarding, facts);
            const response: Accepted = { status: 202, body: { forwardId: forward.id, revision: forward.revision, operationId, sourceOperationId: source.id } };
            await this.idempotency.respond(tx, request, response);
            return response;
        });
    }
    async changeNode(actorId: string, scopeId: string, nodeId: string, key: string | undefined, command: {
        kind: 'policy';
        expectedRevision: number;
        policy: NodePolicy;
    } | {
        kind: 'revoke';
    }): Promise<{
        status: 202;
        body: {
            nodeId: string;
            policyRevision: number;
            operationIds: string[];
            latestAuthorizationUntil: string | null;
        };
    }> {
        if (!isId(nodeId))
            invalid('Valid Node ID required');
        const request = requestIdentity(actorId, scopeId, key, command.kind === 'policy' ? 'PUT' : 'POST', `/api/v1/scopes/${scopeId}/nodes/${nodeId}/${command.kind}`, command);
        return this.db.transaction(async (tx) => {
            await this.identity.scope(tx, actorId, scopeId, true);
            const replay = await this.idempotency.claim<{
                status: 202;
                body: {
                    nodeId: string;
                    policyRevision: number;
                    operationIds: string[];
                    latestAuthorizationUntil: string | null;
                };
            }>(tx, request);
            if (replay)
                return replay;
            const node = await this.nodes.management(tx, actorId, scopeId, nodeId);
            let facts = json<import('../modules/runtime/planner.ts').AuthorizedNodeFacts>(node.facts);
            if (command.kind === 'policy')
                facts = await this.nodes.storePolicy(tx, nodeId, command.policy, command.expectedRevision);
            else
                await this.nodes.markRevoked(tx, nodeId);
            const operationIds: string[] = [];
            const affectedNodes=new Set([nodeId]);
            for (const forward of await this.forwarding.forReferencedNode(tx, nodeId)) {
                await this.lockExecution(tx,forward);
                if(forward.spec.path)for(const id of await this.relay.nodeIDs(tx,forward))affectedNodes.add(id);
                const sourceActor = await this.forwarding.authorizer(tx, forward.id);
                const canRun = command.kind === 'policy' && Boolean(sourceActor && await this.executionAllowed(tx, sourceActor, forward));
                if (canRun && forward.spec.enabled)
                    await this.transitionExecution(tx,sourceActor!,forward);
                const operationId = await this.ledger.accept(tx, forward, request, canRun ? 'policy' : 'revoke');
                operationIds.push(operationId);
                if (command.kind === 'policy' && !canRun)
                    await this.ledger.denyIntent(tx, operationId);
            }
            // Revocation must still persist if tombstone capacity prevents a removal snapshot.
            // Rejecting all credentials stops new authority; historical leases retain their cutoff.
            if (command.kind === 'policy')
                await this.ledger.assertCapacity(tx, this.forwarding, facts);
            let maxLease:number|null=null;for(const id of affectedNodes){const until=await this.ledger.maximumAuthorization(tx,id);if(until!==null)maxLease=Math.max(maxLease??0,until);}
            await this.nodes.audit(tx, nodeId, actorId, command.kind === 'policy' ? 'policy_update' : 'node_revocation', { policyRevision: facts.egressPolicyRevision, operationIds, latestAuthorizationUntil: maxLease });
            const response = { status: 202 as const, body: { nodeId, policyRevision: facts.egressPolicyRevision, operationIds, latestAuthorizationUntil: maxLease ? new Date(maxLease + 5000).toISOString() : null } };
            await this.idempotency.respond(tx, request, response);
            return response;
        });
    }
    async changeMember(actorId: string, scopeId: string, subject: string, key: string | undefined, input: {
        expectedRevision: number;
        role: 'manager' | 'viewer' | 'removed';
        token?: string;
    }): Promise<{
        status: 200 | 202;
        body: {
            actorId: string;
            revision: number;
            role: string;
            active: boolean;
            operationIds: string[];
            latestAuthorizationUntil: string | null;
        };
    }> {
        const request = requestIdentity(actorId, scopeId, key, 'PUT', `/api/v1/scopes/${scopeId}/members/${subject}`, { expectedRevision: input.expectedRevision, role: input.role, tokenHash: input.token ? tokenHash(input.token) : null });
        return this.db.transaction(async (tx) => {
            await this.identity.owner(tx, actorId, scopeId);
            const replay = await this.idempotency.claim<{
                status: 200 | 202;
                body: {
                    actorId: string;
                    revision: number;
                    role: string;
                    active: boolean;
                    operationIds: string[];
                    latestAuthorizationUntil: string | null;
                };
            }>(tx, request);
            if (replay)
                return replay;
            const member = await this.identity.changeMember(tx, actorId, scopeId, subject, input.expectedRevision, input.role, input.token);
            const operationIds: string[] = [];
            let cutoff: number | null = null;
            if (member.changed)
                for (const candidate of await this.forwarding.forActor(tx, scopeId, subject)) {
                    await this.lockExecution(tx,candidate);
                    const forward = await this.forwarding.record(tx, scopeId, candidate.id);
                    if (forward.deleting || await this.forwarding.authorizer(tx, forward.id) !== subject)
                        continue;
                    const allowed = input.role === 'manager' && await this.executionAllowed(tx, subject, forward);
                    if (allowed && forward.spec.enabled)
                        await this.transitionExecution(tx,subject,forward);
                    const operationId = await this.ledger.accept(tx, forward, request, allowed ? 'policy' : 'revoke');
                    operationIds.push(operationId);
                    if (allowed) {
                        const facts = await this.nodes.cleanupFacts(tx, forward.spec.ingress.nodeId, scopeId);
                        await this.ledger.assertCapacity(tx, this.forwarding, facts);
                    }
                    for(const nodeId of forward.spec.path?await this.relay.nodeIDs(tx,forward):[forward.spec.ingress.nodeId]){const until=await this.ledger.maximumAuthorization(tx,nodeId);if(until!==null)cutoff=Math.max(cutoff??0,until);}
                }
            const response = { status: member.changed ? 202 as const : 200 as const, body: { actorId: member.actorId, revision: member.revision, role: member.role, active: member.active, operationIds, latestAuthorizationUntil: cutoff ? new Date(cutoff + 5000).toISOString() : null } };
            await this.idempotency.respond(tx, request, response);
            return response;
        });
    }
    async changeNodeGrant(actorId: string, scopeId: string, nodeId: string, subject: string, key: string | undefined, expectedRevision: number, allowed: boolean): Promise<{
        status: 200 | 202;
        body: {
            nodeId: string;
            actorId: string;
            revision: number;
            allowed: boolean;
            operationIds: string[];
            latestAuthorizationUntil: string | null;
        };
    }> {
        const request = requestIdentity(actorId, scopeId, key, 'PUT', `/api/v1/scopes/${scopeId}/nodes/${nodeId}/grants/${subject}`, { expectedRevision, allowed });
        return this.db.transaction(async (tx) => {
            await this.identity.owner(tx, actorId, scopeId);
            const replay = await this.idempotency.claim<{
                status: 200 | 202;
                body: {
                    nodeId: string;
                    actorId: string;
                    revision: number;
                    allowed: boolean;
                    operationIds: string[];
                    latestAuthorizationUntil: string | null;
                };
            }>(tx, request);
            if (replay)
                return replay;
            const grant = await this.nodes.changeGrant(tx, actorId, scopeId, nodeId, subject, expectedRevision, allowed);
            const operationIds: string[] = [];
            const affectedNodes=new Set([nodeId]);
            if (grant.changed)
                for (const forward of await this.forwarding.forActor(tx, scopeId, subject))
                    if (forward.spec.ingress.nodeId === nodeId || forward.spec.path?.via.includes(nodeId)) {
                        await this.lockExecution(tx,forward);
                        if(forward.spec.path)for(const id of await this.relay.nodeIDs(tx,forward))affectedNodes.add(id);
                        if (allowed && forward.spec.enabled)
                            await this.transitionExecution(tx,subject,forward);
                        const operationId = await this.ledger.accept(tx, forward, request, allowed ? 'policy' : 'revoke');
                        operationIds.push(operationId);
                    }
            const facts = await this.nodes.cleanupFacts(tx, nodeId, scopeId);
            if (allowed)
                await this.ledger.assertCapacity(tx, this.forwarding, facts);
            let cutoff:number|null=null;for(const id of affectedNodes){const until=await this.ledger.maximumAuthorization(tx,id);if(until!==null)cutoff=Math.max(cutoff??0,until);}
            const response = { status: grant.changed ? 202 as const : 200 as const, body: { nodeId, actorId: subject, revision: grant.revision, allowed, operationIds, latestAuthorizationUntil: cutoff ? new Date(cutoff + 5000).toISOString() : null } };
            await this.idempotency.respond(tx, request, response);
            return response;
        });
    }
}
