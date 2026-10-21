import { deepFreeze, isCounter, isId } from '@tunex/core';
import { nativeValueDigest as digest, nativeCommandRequest as requestIdentity, nativeIsoTime, nativeWallClockSource } from '../../compatibility/public.ts';
import { pageWindow as consolePage } from '../../framework/public.ts';
import { ControlError, invalid, notFound } from '../../framework/public.ts';
import type { IdempotentRequests, ScopeAuthorization, ScopeOwnerAuthorization, TransactionBoundary, ResourceReadAccess } from '../../framework/public.ts';
import { parsePathTemplate, pathRequirements } from './template-values.ts';
import { PATH_TEMPLATE_LIMITS, pathTemplateHash as hash, validateTemplateHead, validateTemplateRevision } from './template-state.ts';
export { PATH_TEMPLATE_LIMITS, validateTemplateHead, validateTemplateRevision } from './template-state.ts';
import type { PathTemplateConfig } from './template-contracts.ts';
import type { PathTemplateReader, PathTemplateReferences, PathTemplateWriter } from './template-contracts.ts';
import type { PathTemplateQueryApi, PathTemplateCommandApi, TemplateResponse, TemplateOwnerClassified } from './template-api.ts';

function identity(actor: string, scope: string, id?: string) {
    if (![actor, scope, ...(id === undefined ? [] : [id])].every(isId)) invalid('Valid PathTemplate identity required');
}
export class PathTemplateQueries<Tx> implements PathTemplateQueryApi {
    private readonly db: TransactionBoundary<Tx>;
    private readonly auth: ScopeAuthorization<Tx>;
    private readonly access: ResourceReadAccess<Tx>;
    private readonly read: PathTemplateReader<Tx>;
    constructor(db: TransactionBoundary<Tx>, auth: ScopeAuthorization<Tx>, access: ResourceReadAccess<Tx>, read: PathTemplateReader<Tx>) {
        this.db = db; this.auth = auth; this.access = access; this.read = read;
    }
    async list(actor: string, scope: string, input: { page?: string | undefined; limit?: string | undefined; prefix?: string | undefined } = {}) {
        identity(actor, scope);
        if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
            Object.keys(input).some(key => !['page', 'limit', 'prefix'].includes(key)) ||
            input.page !== undefined && typeof input.page !== 'string' || input.limit !== undefined && typeof input.limit !== 'string' ||
            input.prefix !== undefined && (typeof input.prefix !== 'string' || input.prefix.length > 128 || input.prefix !== '' && !isId(input.prefix)))
            invalid('Bounded PathTemplate query required');
        const paging = Object.freeze(consolePage(input.page, input.limit)), prefix = input.prefix ?? '';
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope);
            const principal = await this.access.principal(tx, actor, scope);
            const result = await this.read.list(tx, scope, principal, paging, prefix);
            if (!Number.isSafeInteger(result.total) || result.total < 0 || result.total > PATH_TEMPLATE_LIMITS.templatesPerScope ||
                result.items.length > paging.limit || new Set(result.items.map(item => item.templateId)).size !== result.items.length ||
                result.items.some(item => !item.templateId.startsWith(prefix)))
                throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid bounded PathTemplate page');
            return deepFreeze({ ...paging, total: result.total, items: result.items.map(item => validateTemplateHead(item)), source: 'persisted-control-state', executionAuthorized: false });
        });
    }
    async get(actor: string, scope: string, id: string, requestedRevision?: number) {
        identity(actor, scope, id);
        if (requestedRevision !== undefined && !isCounter(requestedRevision)) invalid('Canonical PathTemplate revision required');
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope);
            await this.access.owned(tx, actor, scope, 'path-template', id, true);
            const current = await this.read.head(tx, scope, id); if (!current) notFound();
            const metadata = validateTemplateHead(current, id), number = requestedRevision ?? metadata.currentRevision;
            const stored = await this.read.revision(tx, scope, id, number); if (!stored) notFound();
            const record = validateTemplateRevision(stored, number);
            return deepFreeze({ ...metadata, ...record, createdAt: nativeIsoTime(record.createdAt),
                capabilityRequirements: pathRequirements(record.config), source: 'persisted-control-state',
                referenceAuthorization: 'not-rechecked-by-this-query', executionAuthorized: false, reserved: false, bindingCreated: false });
        });
    }
}

export class PathTemplateCommands<Tx> implements PathTemplateCommandApi {
    private readonly db: TransactionBoundary<Tx>;
    private readonly auth: ScopeAuthorization<Tx> & ScopeOwnerAuthorization<Tx>;
    private readonly access: ResourceReadAccess<Tx>;
    private readonly requests: IdempotentRequests<Tx>;
    private readonly store: PathTemplateWriter<Tx>;
    private readonly references: PathTemplateReferences<Tx>;
    private readonly clock: () => number;
    constructor(db: TransactionBoundary<Tx>, auth: ScopeAuthorization<Tx> & ScopeOwnerAuthorization<Tx>, access: ResourceReadAccess<Tx>, requests: IdempotentRequests<Tx>,
        store: PathTemplateWriter<Tx>, references: PathTemplateReferences<Tx>, clock: () => number = nativeWallClockSource()) {
        this.db = db; this.auth = auth; this.access = access; this.requests = requests; this.store = store; this.references = references; this.clock = clock;
    }
    async classifyOwner(actor:string,scope:string,id:string,key:string|undefined,expectedRevision:number,ownerActorId:string):Promise<TemplateOwnerClassified> {
        identity(actor,scope,id);
        if(!isId(ownerActorId)||!isCounter(expectedRevision)||expectedRevision>PATH_TEMPLATE_LIMITS.revisionsPerTemplate)
            invalid('Exact template revision and target owner required');
        const request=requestIdentity(actor,scope,key,'POST',`/api/v1/scopes/${scope}/path-templates/${id}/classify-owner`,{expectedRevision,ownerActorId});
        return this.db.transaction(async tx=>{
            await this.auth.owner(tx,actor,scope);
            const replay=await this.requests.claim<TemplateOwnerClassified>(tx,request);
            if(replay){
                await this.auth.scope(tx,ownerActorId,scope,true);
                await this.access.owned(tx,actor,scope,'path-template',id,true);return replay;
            }
            await this.store.lockScope(tx,scope);
            await this.auth.scope(tx,ownerActorId,scope,true);
            const found=await this.store.head(tx,scope,id,true);if(!found)notFound();
            const current=validateTemplateHead(found,id);
            if(current.currentRevision!==expectedRevision||current.ownerActorId!==null)
                throw new ControlError('REVISION_CONFLICT',409,'Template revision changed or ownership is already classified');
            const at=this.clock();
            if(!Number.isSafeInteger(at)||at<0||at>8640000000000000)
                throw new ControlError('INTEGRITY_FAILURE',409,'Invalid template classification time');
            if(await this.store.classifyOwner(tx,scope,id,expectedRevision,ownerActorId)!==1)
                throw new ControlError('REVISION_CONFLICT',409,'Template ownership classification raced');
            await this.store.auditOwnership(tx,scope,id,actor,ownerActorId,expectedRevision,at);
            const response:TemplateOwnerClassified={status:200,body:{templateId:id,revision:expectedRevision,ownerActorId,classified:true}};
            await this.requests.respond(tx,request,response);return response;
        });
    }
    async publish(actor: string, scope: string, id: string, key: string | undefined, expectedRevision: number, input: unknown) {
        const config = parsePathTemplate(input);
        return this.command(actor, scope, id, key, expectedRevision, config);
    }
    async archive(actor: string, scope: string, id: string, key: string | undefined, expectedRevision: number) {
        if (expectedRevision === 0) invalid('Archival requires an existing template revision');
        return this.command(actor, scope, id, key, expectedRevision, null);
    }
    private async command(actor: string, scope: string, id: string, key: string | undefined, expectedRevision: number, config: PathTemplateConfig | null): Promise<TemplateResponse> {
        identity(actor, scope, id);
        if (!isCounter(expectedRevision, true) || !key || !/^[\x21-\x7e]{1,128}$/.test(key)) invalid('CAS and Idempotency-Key required');
        const request = { actorId: actor, scopeId: scope, key, digest: digest({ method: config ? 'PUT' : 'DELETE', path: `/api/v1/scopes/${scope}/path-templates/${id}`, expectedRevision, ...(config ? { config } : {}) }) };
        return this.db.transaction(async tx => {
            await this.auth.scope(tx, actor, scope, true);
            const replay = await this.requests.claim<TemplateResponse>(tx, request); if (replay) { await this.access.owned(tx, actor, scope, 'path-template', id, true); return replay; }
            // Serializes creation quotas and both CAS/archival before any reference resolution.
            await this.store.lockScope(tx, scope);
            const found = await this.store.head(tx, scope, id, true), current = found ? validateTemplateHead(found, id) : null;
            if (current) await this.access.owned(tx, actor, scope, 'path-template', id, config === null);
            if ((current?.currentRevision ?? 0) !== expectedRevision) throw new ControlError('REVISION_CONFLICT', 409, 'PathTemplate revision conflict');
            if (!config && !current) notFound();
            if (config && current?.archived) throw new ControlError('TEMPLATE_ARCHIVED', 409, 'Archived template identifiers cannot be reused');
            const old = current ? await this.store.revision(tx, scope, id, current.currentRevision) : null;
            if (current && !old) throw new ControlError('INTEGRITY_FAILURE', 409, 'Current PathTemplate revision is missing');
            if (old) validateTemplateRevision(old, current!.currentRevision);
            let changed = false, number = expectedRevision, configDigest = old?.configDigest ?? '';
            const at = this.clock();
            if (!Number.isSafeInteger(at) || at < 0 || at > 8640000000000000) throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid template command time');
            if (config) {
                const resolved = await this.references.validate(tx, actor, scope, config);
                if (!hash(resolved.profileDigest)) throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid immutable Profile digest');
                configDigest = digest({ config, profileDigest: resolved.profileDigest }); changed = old?.configDigest !== configDigest;
                if (changed) {
                    number++;
                    if (number > PATH_TEMPLATE_LIMITS.revisionsPerTemplate) throw new ControlError('RESOURCE_LIMIT', 429, 'PathTemplate immutable revision limit reached');
                    if (!current && await this.store.count(tx, scope) >= PATH_TEMPLATE_LIMITS.templatesPerScope)
                        throw new ControlError('RESOURCE_LIMIT', 429, 'Scope PathTemplate limit reached, including archived identifiers');
                    await this.store.publish(tx, scope, id, { revision: number, config, profileDigest: resolved.profileDigest, configDigest, createdBy: actor, createdAt: at });
                }
            } else { changed = !current!.archived; if (changed) await this.store.archive(tx, scope, id); }
            if (changed) await this.store.audit(tx, scope, id, actor, number, config ? 'publish' : 'archive', at);
            const response: TemplateResponse = { status: changed ? 202 : 200, body: { templateId: id, revision: number, configDigest, archived: !config, changed } };
            await this.requests.respond(tx, request, response); return response;
        });
    }
}
