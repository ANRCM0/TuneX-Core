import { ControlError } from '../framework/public.ts';
import type { OwnedResourceKind, ResourceAccessStore, ResourceNodeReadRecord, ResourceOwnershipRecord } from '../framework/public.ts';
import { rows } from './mysql.ts';
import type { Transaction } from './mysql.ts';

const sources: Record<OwnedResourceKind, readonly [string, string, string]> = {
    forward: ['forwards', 'id', 'owner_actor_id'],
    'path-template': ['path_templates', 'template_id', 'owner_actor_id'],
    'path-group': ['path_groups', 'group_id', 'owner_actor_id'],
    'ingress-group': ['ingress_groups', 'group_id', 'owner_actor_id'],
    'path-publication': ['path_publications', 'batch_id', 'created_by'],
    'ingress-deployment': ['ingress_deployments', 'batch_id', 'created_by'],
    'ingress-migration': ['ingress_migrations', 'batch_id', 'created_by'],
    'probe-plan': ['probe_plans', 'plan_id', 'created_by'],
    'probe-run': ['probe_runs', 'probe_id', 'actor_id'],
};

/** Raw original-table claims only; the injected product owner decides policy. */
export class MySqlResourceAccessStore implements ResourceAccessStore<Transaction> {
    async scopeOwner(tx: Transaction, scopeId: string) {
        return (await rows<{ownerActorId: string}>(tx,
            'SELECT owner_id ownerActorId FROM scopes WHERE id=? FOR SHARE', [scopeId]))[0];
    }
    async ownership(tx: Transaction, scopeId: string, kind: OwnedResourceKind, id: string): Promise<ResourceOwnershipRecord | undefined> {
        const source = sources[kind];
        if (!source) throw new ControlError('INTEGRITY_FAILURE', 409, 'Unknown ownership source');
        const [table, key, owner] = source;
        return (await rows<ResourceOwnershipRecord>(tx,
            `SELECT ${owner} ownerActorId FROM ${table} WHERE scope_id=? AND ${key}=? FOR SHARE`, [scopeId, id]))[0];
    }
    async node(tx: Transaction, actorId: string, scopeId: string, nodeId: string): Promise<ResourceNodeReadRecord | undefined> {
        const record = (await rows<{ownerActorId: string | null; source: ResourceNodeReadRecord['source']; granted: number}>(tx,
            `SELECT n.owner_actor_id ownerActorId,n.resource_source source,
             EXISTS(SELECT 1 FROM node_grants g WHERE g.node_id=n.id AND g.actor_id=?) granted
             FROM nodes n WHERE n.scope_id=? AND n.id=? FOR SHARE`, [actorId, scopeId, nodeId]))[0];
        return record && { ...record, granted: record.granted === 1 };
    }
}
