import { decideForwardChange, deepFreeze, isCounter, isId, MAX_COUNTER, parseForwardSpec } from '@tunex/core';
import type { Forward, ForwardSpec } from '@tunex/core';
import { nativeValueDigest as digest, nativeCommandRequest as requestIdentity, nativeWallClockSource } from '../../compatibility/public.ts';
import { ControlError, invalid } from '../../framework/public.ts';
import type { IdempotentRequests, ScopeAuthorization, ScopeOwnerAuthorization, TransactionBoundary, RequestIdentity, ResourceReadAccess } from '../../framework/public.ts';
import type { ForwardWriter } from './contracts.ts';
import type { ForwardCommandPreparation, ForwardOperationCommands } from './command-ports.ts';
import { parsePathSelection } from '../path-owner/public.ts';
import type { ForwardPathBindings, PathSelection } from '../path-owner/public.ts';
import { parsePathGroupSelection } from '../path-owner/public.ts';
import type { PathGroupSelection } from '../path-owner/public.ts';
import type { ForwardPathGroups } from '../path-owner/public.ts';
import { parsePublicationState } from '../path-owner/public.ts';
import type { PathPublicationForwardPort, PublicationForwardState, PublicationProvenance } from '../path-owner/public.ts';

import type { ForwardAccepted, ForwardOwnerClassified, ForwardCommandApi, ForwardBindingApi } from './command-api.ts';
export type { ForwardAccepted } from './command-api.ts';

function revision(value: number): void {
    if (!isCounter(value)) invalid('Positive safe expectedRevision required');
}

export class ForwardCommands<Tx> implements PathPublicationForwardPort<Tx>, ForwardCommandApi, ForwardBindingApi {
    private readonly db: TransactionBoundary<Tx>;
    private readonly identity: ScopeAuthorization<Tx> & ScopeOwnerAuthorization<Tx>;
    private readonly access: ResourceReadAccess<Tx>;
    private readonly idempotency: IdempotentRequests<Tx>;
    private readonly forwarding: ForwardWriter<Tx>;
    private readonly operations: ForwardOperationCommands<Tx>;
    private readonly execution: ForwardCommandPreparation<Tx>;
    private readonly newId: () => string;
    private readonly clock: () => number;
    private readonly paths: ForwardPathBindings<Tx> | undefined;
    private readonly groups: ForwardPathGroups<Tx> | undefined;
    private readonly publicationProvenance: PublicationProvenance<Tx> | undefined;

    constructor(db: TransactionBoundary<Tx>, identity: ScopeAuthorization<Tx> & ScopeOwnerAuthorization<Tx>, access: ResourceReadAccess<Tx>, idempotency: IdempotentRequests<Tx>,
        forwarding: ForwardWriter<Tx>, operations: ForwardOperationCommands<Tx>, execution: ForwardCommandPreparation<Tx>,
        newId: () => string, paths?: ForwardPathBindings<Tx>, groups?: ForwardPathGroups<Tx>, publicationProvenance?: PublicationProvenance<Tx>,
        clock: () => number = nativeWallClockSource()) {
        for (const method of ['prepareCreate', 'planCreate', 'prepareUpdate', 'planUpdate', 'lock', 'lockOwnership', 'lockRemoval', 'prepareRetry', 'assertCapacity'] as const)
            if (typeof execution?.[method] !== 'function') throw new Error('Forward execution preparation is required');
        this.db = db; this.identity = identity; this.access = access; this.idempotency = idempotency; this.forwarding = forwarding;
        this.operations = operations; this.execution = execution; this.newId = newId; this.paths = paths; this.groups = groups;
        this.publicationProvenance = publicationProvenance;
        this.clock = clock;
    }

    async classifyOwner(actorId:string,scopeId:string,id:string,key:string|undefined,expectedRevision:number,ownerActorId:string):Promise<ForwardOwnerClassified> {
        revision(expectedRevision);
        if(![actorId,scopeId,id,ownerActorId].every(isId))invalid('Valid Forward ownership classification identity required');
        const request=requestIdentity(actorId,scopeId,key,'POST',`/api/v1/scopes/${scopeId}/forwards/${id}/classify-owner`,{expectedRevision,ownerActorId});
        return this.db.transaction(async tx=>{
            await this.identity.owner(tx,actorId,scopeId);
            const replay=await this.idempotency.claim<ForwardOwnerClassified>(tx,request);
            await this.identity.scope(tx,ownerActorId,scopeId,true);
            if(replay){await this.access.forward(tx,actorId,scopeId,id);return replay;}
            const at=this.clock(),eventId=this.newId();
            if(!Number.isSafeInteger(at)||at<0||at>8640000000000000||!isId(eventId))
                throw new ControlError('INTEGRITY_FAILURE',409,'Invalid ownership classification audit identity or time');
            const current=await this.forwarding.ownershipForUpdate(tx,scopeId,id);
            await this.execution.lockOwnership(tx,current);
            await this.forwarding.classifyOwner(tx,scopeId,id,expectedRevision,actorId,ownerActorId,eventId,at);
            const response:ForwardOwnerClassified={status:200,body:{forwardId:id,revision:expectedRevision,ownerActorId,classified:true,operationId:null}};
            await this.idempotency.respond(tx,request,response);return response;
        });
    }

    async create(actorId: string, scopeId: string, key: string | undefined, input: unknown): Promise<ForwardAccepted> {
        const parsed = parseForwardSpec(input); if (!parsed.ok) invalid('Invalid Forward spec'); const spec = parsed.value;
        const request = requestIdentity(actorId, scopeId, key, 'POST', `/api/v1/scopes/${scopeId}/forwards`, spec);
        return this.db.transaction(async tx => {
            await this.identity.scope(tx, actorId, scopeId);
            const replay = await this.idempotency.claim<ForwardAccepted>(tx, request);
            if (replay) {
                await this.access.forward(tx, actorId, scopeId, replay.body.forwardId);
                return replay;
            }
            await this.identity.scope(tx, actorId, scopeId, true);
            return this.acceptCreate(tx, request, spec);
        });
    }

    private async acceptCreate(tx: Tx, request: RequestIdentity, spec: ForwardSpec, selection?: PathSelection, respond = true): Promise<ForwardAccepted> {
        const forward: Forward = { id: this.newId(), scopeId: request.scopeId, revision: 1, spec };
        await this.execution.prepareCreate(tx, request.actorId, forward);
        await this.forwarding.insert(tx, forward, request.actorId);
        await this.execution.planCreate(tx, request.actorId, forward);
        const operationId = await this.operations.accept(tx, forward, request, 'create');
        await this.execution.assertCapacity(tx, forward);
        const pathBinding = selection ? await this.paths!.accept(tx, request.actorId, forward, selection) : undefined;
        const response: ForwardAccepted = { status: 202, body: { forwardId: forward.id, revision: 1, operationId, ...(pathBinding ? { pathBinding } : {}) } };
        if (respond) await this.idempotency.respond(tx, request, response);
        return response;
    }
    async previewIngressIn(tx: Tx, actor: string, scope: string, input: ForwardSpec, selectionInput: PathSelection) {
        if (![actor,scope].every(isId)) invalid('Valid ingress creation identity required');
        const parsed = parseForwardSpec(input); if (!parsed.ok) invalid('Valid ingress creation spec required');
        const template = parsePathSelection(selectionInput), paths = this.paths;
        if (!paths || typeof paths.resolveCreateIn !== 'function') throw new Error('Original native path creation owner is required');
        await this.identity.scope(tx, actor, scope, true);
        const spec = await paths.resolveCreateIn(tx, actor, scope, parsed.value, template);
        return deepFreeze({ spec, specDigest: digest(spec) });
    }
    async createIngressIn(tx: Tx, request: RequestIdentity, input: ForwardSpec, selectionInput: PathSelection) {
        const frozen = parseForwardSpec(input); if (!frozen.ok) invalid('Valid frozen ingress spec required');
        const template = parsePathSelection(selectionInput), preview = await this.previewIngressIn(tx, request.actorId, request.scopeId, frozen.value, template);
        if (preview.specDigest !== digest(frozen.value)) throw new ControlError('PUBLICATION_STATE_CHANGED', 409, 'Frozen ingress spec differs from its exact authorized template');
        const accepted = await this.acceptCreate(tx, request, preview.spec, template, false);
        const forward: Forward = { id: accepted.body.forwardId, scopeId: request.scopeId, revision: accepted.body.revision, spec: preview.spec };
        return deepFreeze({ accepted, state: await this.publicationState(tx, forward) });
    }
    async compensateIngressIn(tx: Tx, request: RequestIdentity, input: PublicationForwardState) {
        const expected = parsePublicationState(input), current = await this.publicationCurrent(tx, request.actorId, request.scopeId, expected.forwardId, expected.revision);
        if (digest(await this.publicationState(tx, current)) !== digest(expected))
            throw new ControlError('PUBLICATION_STATE_CHANGED', 409, 'Created ingress Forward or exact provenance changed before compensation');
        const accepted = await this.acceptRemove(tx, request, current, expected.revision, false);
        const next: Forward = { ...current, revision: accepted.body.revision };
        return deepFreeze({ accepted, state: await this.publicationState(tx, next), deleting: true as const });
    }
    async removeIngressIn(tx: Tx, request: RequestIdentity, accepted: PublicationForwardState) {
        return this.compensateIngressIn(tx, request, accepted);
    }
    async inspectIngressIn(tx: Tx, actor: string, scope: string, input: PublicationForwardState): Promise<PublicationForwardState> {
        const expected = parsePublicationState(input), current = await this.publicationCurrent(tx, actor, scope, expected.forwardId, expected.revision);
        const state = await this.publicationState(tx, current);
        if (digest(state) !== digest(expected)) throw new ControlError('PUBLICATION_STATE_CHANGED', 409, 'Ingress Forward or exact provenance changed before migration inspection');
        return state;
    }
    async previewIngressUpdateIn(tx: Tx, actor: string, scope: string, beforeInput: PublicationForwardState, desired: ForwardSpec, selectionInput: PathSelection) {
        const before = parsePublicationState(beforeInput), parsed = parseForwardSpec(desired);
        if (!parsed.ok) invalid('Valid ingress migration spec required');
        const template = parsePathSelection(selectionInput), paths = this.paths;
        if (!paths || typeof paths.resolveCreateIn !== 'function') throw new Error('Original native path creation owner is required');
        const current = await this.publicationCurrent(tx, actor, scope, before.forwardId, before.revision), source = await this.publicationState(tx, current);
        if (digest(source) !== digest(before)) throw new ControlError('PUBLICATION_STATE_CHANGED', 409, 'Ingress Forward or exact provenance changed before migration');
        if (parsed.value.ingress.nodeId !== current.spec.ingress.nodeId || digest(parsed.value.protocols) !== digest(source.spec.protocols))
            throw new ControlError('UNSUPPORTED_CAPABILITY', 422, 'Ingress migration updates require the same ingress Node and business protocol set');
        if (!parsed.value.path || !parsed.value.transport || digest({ ...source.spec, path: parsed.value.path, transport: parsed.value.transport }) !== digest(parsed.value))
            throw new ControlError('UNSUPPORTED_CAPABILITY', 422, 'Ingress migration updates may change only the exact path and Profile');
        const spec = await paths.resolveCreateIn(tx, actor, scope, parsed.value, template);
        return deepFreeze({ source, spec, specDigest: digest(spec) });
    }
    async updateIngressIn(tx: Tx, request: RequestIdentity, before: PublicationForwardState, desired: ForwardSpec, selectionInput: PathSelection) {
        const template = parsePathSelection(selectionInput), parsed = parseForwardSpec(desired);
        if (!parsed.ok) invalid('Valid frozen ingress migration spec required');
        const preview = await this.previewIngressUpdateIn(tx, request.actorId, request.scopeId, before, parsed.value, template);
        if (preview.specDigest !== digest(parsed.value)) throw new ControlError('PUBLICATION_STATE_CHANGED', 409, 'Frozen ingress migration spec differs from its exact authorized template');
        const current: Forward = { id: preview.source.forwardId, scopeId: request.scopeId, revision: preview.source.revision, spec: preview.source.spec };
        const decision = decideForwardChange(current, current.revision, { kind: 'replace', spec: preview.spec });
        if (!decision.ok) throw new ControlError(decision.errors[0]!.code, 409, decision.errors[0]!.message);
        const next = decision.value, accepted = await this.acceptUpdate(tx, request.actorId, current, next, request, template, undefined, false);
        return deepFreeze({ accepted, state: await this.publicationState(tx, next) });
    }

    async update(actorId: string, scopeId: string, id: string, key: string | undefined, expectedRevision: number,
        input: unknown): Promise<ForwardAccepted> {
        revision(expectedRevision);
        if (!isId(id)) invalid('Valid Forward ID required');
        const parsed = parseForwardSpec(input); if (!parsed.ok) invalid('Invalid Forward spec'); const spec = parsed.value;
        const request = requestIdentity(actorId, scopeId, key, 'PUT', `/api/v1/scopes/${scopeId}/forwards/${id}`, { expectedRevision, spec });
        return this.db.transaction(async tx => {
            await this.identity.scope(tx, actorId, scopeId);
            const replay = await this.idempotency.claim<ForwardAccepted>(tx, request);
            if (replay) { await this.access.forward(tx, actorId, scopeId, replay.body.forwardId); return replay; }
            await this.identity.scope(tx, actorId, scopeId, true);
            await this.access.forward(tx, actorId, scopeId, id);
            const current = await this.forwarding.currentForUpdate(tx, scopeId, id);
            const decision = decideForwardChange(current, expectedRevision, { kind: 'replace', spec });
            if (!decision.ok) throw new ControlError(decision.errors[0]!.code, 409, decision.errors[0]!.message);
            const next = decision.value;
            return this.acceptUpdate(tx, actorId, current, next, request);
        });
    }

    async applyPath(actorId: string, scopeId: string, id: string, key: string | undefined, expectedRevision: number,
        input: unknown): Promise<ForwardAccepted> {
        revision(expectedRevision);
        if (!isId(id)) invalid('Valid Forward ID required');
        const selection = parsePathSelection(input);
        const paths = this.paths; if (!paths) throw new Error('Original path binding preparation is required');
        const request = requestIdentity(actorId, scopeId, key, 'PUT', `/api/v1/scopes/${scopeId}/forwards/${id}/path-binding`, { expectedRevision, template: selection });
        return this.db.transaction(async tx => {
            await this.identity.scope(tx, actorId, scopeId, true);
            const replay = await this.idempotency.claim<ForwardAccepted>(tx, request); if (replay) { await this.access.forward(tx, actorId, scopeId, replay.body.forwardId); return replay; }
            const current = await this.forwarding.currentForUpdate(tx, scopeId, id);
            await this.access.owned(tx, actorId, scopeId, 'forward', id);
            if (current.revision !== expectedRevision || (await this.forwarding.record(tx, scopeId, id)).recoverySuspended)
                throw new ControlError('REVISION_CONFLICT', 409, 'Forward changed or recovery suspended');
            const spec = await paths.resolve(tx, actorId, current, selection);
            const decision = decideForwardChange(current, expectedRevision, { kind: 'replace', spec });
            if (!decision.ok) throw new ControlError(decision.errors[0]!.code, 409, decision.errors[0]!.message);
            return this.acceptUpdate(tx, actorId, current, decision.value, request, selection);
        });
    }

    async applyGroup(actorId: string, scopeId: string, id: string, key: string | undefined, expectedRevision: number,
        input: unknown): Promise<ForwardAccepted> {
        revision(expectedRevision);
        if (!isId(id)) invalid('Valid Forward ID required');
        const group = parsePathGroupSelection(input), paths = this.paths, groups = this.groups;
        if (!paths || !groups) throw new Error('Original path and group binding preparation is required');
        const request = requestIdentity(actorId, scopeId, key, 'PUT', `/api/v1/scopes/${scopeId}/forwards/${id}/path-group-binding`, { expectedRevision, group });
        return this.db.transaction(async tx => {
            await this.identity.scope(tx, actorId, scopeId, true);
            const replay = await this.idempotency.claim<ForwardAccepted>(tx, request); if (replay) { await this.access.forward(tx, actorId, scopeId, replay.body.forwardId); return replay; }
            const current = await this.forwarding.currentForUpdate(tx, scopeId, id);
            await this.access.owned(tx, actorId, scopeId, 'forward', id);
            if (current.revision !== expectedRevision || (await this.forwarding.record(tx, scopeId, id)).recoverySuspended)
                throw new ControlError('REVISION_CONFLICT', 409, 'Forward changed or recovery suspended');
            const selection = await groups.resolve(tx, actorId, current, group);
            const spec = await paths.resolve(tx, actorId, current, selection);
            const decision = decideForwardChange(current, expectedRevision, { kind: 'replace', spec });
            if (!decision.ok) throw new ControlError(decision.errors[0]!.code, 409, decision.errors[0]!.message);
            return this.acceptUpdate(tx, actorId, current, decision.value, request, selection, group);
        });
    }

    private async acceptUpdate(tx: Tx, actorId: string, current: Forward, next: Forward, request: RequestIdentity,
        selection?: PathSelection, group?: PathGroupSelection, respond = true): Promise<ForwardAccepted> {
        const record = await this.forwarding.record(tx, current.scopeId, current.id);
        const governanceStop = record.ownerActorId !== actorId && current.spec.enabled && !next.spec.enabled &&
            !selection && !group && digest({ ...current.spec, enabled: false }) === digest(next.spec);
        await this.access.owned(tx, actorId, current.scopeId, 'forward', current.id, governanceStop);
        const recoverySuspended = next.spec.ingress.nodeId !== current.spec.ingress.nodeId ?
            (await this.forwarding.record(tx, current.scopeId, current.id)).recoverySuspended : false;
        await this.execution.prepareUpdate(tx, actorId, current, next, recoverySuspended);
        let operationId: string | null = null;
        if (next.revision !== current.revision) {
            await this.forwarding.replace(tx, current, next);
            if (!selection) {
                await this.groups?.preserve(tx, current, next);
                await this.paths?.preserve(tx, current, next);
            }
            if (!governanceStop) await this.forwarding.setAuthorizer(tx, next.id, actorId);
            await this.execution.planUpdate(tx, actorId, next);
            const kind = !next.spec.enabled ? 'disable' : !current.spec.enabled ? 'enable' : 'update';
            operationId = await this.operations.accept(tx, next, request, kind, current.spec);
            await this.execution.assertCapacity(tx, next);
        }
        // Exact-path attachment can change provenance without restarting an unchanged Forward.
        if (selection && !group) await this.groups?.detach(tx, current);
        const pathBinding = selection ? await this.paths!.accept(tx, actorId, next, selection) : undefined;
        const pathGroupBinding = group ? await this.groups!.accept(tx, actorId, next, group, pathBinding!) : undefined;
        const response: ForwardAccepted = { status: operationId ? 202 : 200, body: { forwardId: next.id, revision: next.revision, operationId,
            ...(pathBinding ? { pathBinding } : {}), ...(pathGroupBinding ? { pathGroupBinding } : {}) } };
        if (respond) await this.idempotency.respond(tx, request, response);
        return response;
    }

    private async publicationCurrent(tx: Tx, actor: string, scope: string, id: string, expectedRevision: number): Promise<Forward> {
        revision(expectedRevision);
        if (![actor,scope,id].every(isId)) invalid('Valid publication Forward identity required');
        await this.identity.scope(tx, actor, scope, true);
        await this.access.owned(tx, actor, scope, 'forward', id);
        const current = await this.forwarding.currentForUpdate(tx, scope, id), record = await this.forwarding.record(tx, scope, id);
        if (current.revision !== expectedRevision || record.deleting || record.recoverySuspended)
            throw new ControlError('PUBLICATION_STATE_CHANGED', 409, 'Publication Forward changed, deleting or recovery suspended');
        return current;
    }
    private async publicationState(tx: Tx, forward: Forward): Promise<PublicationForwardState> {
        const provenance = this.publicationProvenance;
        if (!provenance) throw new Error('Original publication provenance owner is required');
        const current = await provenance.current(tx, forward);
        try { return parsePublicationState({ forwardId: forward.id, revision: forward.revision, spec: forward.spec, specDigest: digest(forward.spec), ...current }); }
        catch { throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid original Forward publication state'); }
    }
    async previewPublicationIn(tx: Tx, actor: string, scope: string, forwardId: string, expectedRevision: number, input: PathGroupSelection) {
        const group = parsePathGroupSelection(input), paths = this.paths, groups = this.groups;
        if (!paths || !groups) throw new Error('Original path and group binding preparation is required');
        const current = await this.publicationCurrent(tx, actor, scope, forwardId, expectedRevision), source = await this.publicationState(tx, current);
        const template = await groups.resolve(tx, actor, current, group), proposedSpec = await paths.resolve(tx, actor, current, template);
        return deepFreeze({ source, template, proposedSpec, proposedDigest: digest(proposedSpec) });
    }
    async applyPublicationIn(tx: Tx, request: RequestIdentity, input: PublicationForwardState, selection: PathGroupSelection) {
        const source = parsePublicationState(input), group = parsePathGroupSelection(selection), paths = this.paths, groups = this.groups;
        if (!paths || !groups) throw new Error('Original path and group binding preparation is required');
        const current = await this.publicationCurrent(tx, request.actorId, request.scopeId, source.forwardId, source.revision);
        if (digest(await this.publicationState(tx, current)) !== digest(source))
            throw new ControlError('PUBLICATION_STATE_CHANGED', 409, 'Forward or exact provenance changed since publication preview');
        const template = await groups.resolve(tx, request.actorId, current, group), spec = await paths.resolve(tx, request.actorId, current, template);
        const decision = decideForwardChange(current, source.revision, { kind: 'replace', spec });
        if (!decision.ok) throw new ControlError(decision.errors[0]!.code, 409, decision.errors[0]!.message);
        const next = decision.value, accepted = await this.acceptUpdate(tx, request.actorId, current, next, request, template, group, false);
        return deepFreeze({ accepted, state: await this.publicationState(tx, next) });
    }
    async compensatePublicationIn(tx: Tx, request: RequestIdentity, acceptedInput: PublicationForwardState, sourceInput: PublicationForwardState) {
        const expected = parsePublicationState(acceptedInput), source = parsePublicationState(sourceInput), paths = this.paths, groups = this.groups, provenance = this.publicationProvenance;
        if (!paths || !groups || !provenance) throw new Error('Original path, group and publication provenance owners are required');
        if (source.forwardId !== expected.forwardId) invalid('Compensation must target the original Forward');
        const current = await this.publicationCurrent(tx, request.actorId, request.scopeId, expected.forwardId, expected.revision);
        if (digest(await this.publicationState(tx, current)) !== digest(expected))
            throw new ControlError('PUBLICATION_STATE_CHANGED', 409, 'Accepted Forward or exact provenance changed before compensation');
        await provenance.authorizeRestoration(tx, request.actorId, { ...current, spec: source.spec });
        let template: PathSelection | undefined, group: PathGroupSelection | undefined;
        if (source.path) {
            template = parsePathSelection({ templateId: source.path.templateId, revision: source.path.revision, configDigest: source.path.configDigest });
            if (source.group) {
                group = parsePathGroupSelection({ groupId: source.group.groupId, revision: source.group.revision, configDigest: source.group.configDigest, candidateId: source.group.candidateId });
                const selected = await groups.resolve(tx, request.actorId, current, group);
                if (digest(selected) !== digest(template)) throw new ControlError('INTEGRITY_FAILURE', 409, 'Original group and path selections differ');
            }
            const expanded = typeof paths.resolveCreateIn === 'function' ?
                await paths.resolveCreateIn(tx, request.actorId, request.scopeId, source.spec, template) :
                await paths.resolve(tx, request.actorId, current, template);
            if (digest(expanded) !== source.specDigest) throw new ControlError('PUBLICATION_STATE_CHANGED', 409, 'Original full spec does not match the authorized restoration path');
        }
        const decision = decideForwardChange(current, expected.revision, { kind: 'replace', spec: source.spec });
        if (!decision.ok) throw new ControlError(decision.errors[0]!.code, 409, decision.errors[0]!.message);
        const next = decision.value;
        // Remove only current metadata, before replacing topology; immutable history remains intact.
        if (!group) await groups.detach(tx, current);
        if (!template) await provenance.detachPath(tx, current);
        const accepted = await this.acceptUpdate(tx, request.actorId, current, next, request, template, group, false);
        return deepFreeze({ accepted, state: await this.publicationState(tx, next) });
    }

    async remove(actorId: string, scopeId: string, id: string, key: string | undefined, expectedRevision: number): Promise<ForwardAccepted> {
        revision(expectedRevision);
        if (!isId(id)) invalid('Valid Forward ID required');
        const request = requestIdentity(actorId, scopeId, key, 'DELETE', `/api/v1/scopes/${scopeId}/forwards/${id}`, { expectedRevision });
        return this.db.transaction(async tx => {
            await this.identity.scope(tx, actorId, scopeId);
            const replay = await this.idempotency.claim<ForwardAccepted>(tx, request);
            if (replay) { await this.access.forward(tx, actorId, scopeId, replay.body.forwardId); return replay; }
            await this.identity.scope(tx, actorId, scopeId, true);
            await this.access.forward(tx, actorId, scopeId, id);
            const current = await this.forwarding.currentForUpdate(tx, scopeId, id);
            return this.acceptRemove(tx, request, current, expectedRevision);
        });
    }

    private async acceptRemove(tx: Tx, request: RequestIdentity, current: Forward, expectedRevision: number, respond = true): Promise<ForwardAccepted> {
        await this.access.owned(tx, request.actorId, current.scopeId, 'forward', current.id, true);
        await this.execution.lockRemoval(tx, current);
        if (current.revision !== expectedRevision) throw new ControlError('REVISION_CONFLICT', 409, 'Expected revision does not match');
        if (current.revision >= MAX_COUNTER) throw new ControlError('REVISION_EXHAUSTED', 409, 'Revision counter exhausted');
        const next = { ...current, revision: current.revision + 1 };
        await this.forwarding.markDeleting(tx, current, next.revision);
        const operationId = await this.operations.accept(tx, next, request, 'delete', current.spec);
        await this.execution.assertCapacity(tx, next);
        const response: ForwardAccepted = { status: 202, body: { forwardId: current.id, revision: next.revision, operationId } };
        if (respond) await this.idempotency.respond(tx, request, response);
        return response;
    }

    async retry(actorId: string, scopeId: string, key: string | undefined, sourceOperationId: string,
        expectedRevision: number): Promise<ForwardAccepted> {
        revision(expectedRevision);
        if (!isId(sourceOperationId)) invalid('Valid Operation ID required');
        const request = requestIdentity(actorId, scopeId, key, 'POST', `/api/v1/scopes/${scopeId}/operations/${sourceOperationId}/retry`, { expectedRevision });
        return this.db.transaction(async tx => {
            await this.identity.scope(tx, actorId, scopeId);
            const replay = await this.idempotency.claim<ForwardAccepted>(tx, request);
            if (replay) { await this.access.forward(tx, actorId, scopeId, replay.body.forwardId); return replay; }
            await this.identity.scope(tx, actorId, scopeId, true);
            const reference = await this.operations.read(tx, scopeId, sourceOperationId);
            const forward = await this.forwarding.currentForUpdate(tx, scopeId, reference.forward_id);
            await this.access.owned(tx, actorId, scopeId, 'forward', forward.id);
            await this.execution.lock(tx, forward);
            const source = await this.operations.get(tx, scopeId, sourceOperationId);
            if (source.recovery_invalidated)
                throw new ControlError('OPERATION_SUPERSEDED', 409, 'Restored operation is not an authoritative deployment attempt');
            if (forward.revision !== expectedRevision || source.target_revision !== forward.revision)
                throw new ControlError('OPERATION_SUPERSEDED', 409, 'Operation no longer targets an editable desired revision');
            if (source.status !== 'failed')
                throw new ControlError('OPERATION_NOT_RETRYABLE', 409, 'Only failed Operations can be retried');
            await this.execution.prepareRetry(tx, actorId, forward);
            await this.forwarding.setAuthorizer(tx, forward.id, actorId);
            const operationId = await this.operations.accept(tx, forward, request, 'retry', source.previous_spec, source.id);
            await this.execution.assertCapacity(tx, forward);
            const response: ForwardAccepted = { status: 202, body: { forwardId: forward.id, revision: forward.revision,
                operationId, sourceOperationId: source.id } };
            await this.idempotency.respond(tx, request, response);
            return response;
        });
    }
}
