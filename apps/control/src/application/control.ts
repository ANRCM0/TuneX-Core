import { randomUUID } from 'node:crypto';
import { isId, parseForwardSpec } from '@tunex/core';
import type { Forward } from '@tunex/core';
import { digest } from '@tunex/contracts';
import { ControlError, invalid } from './errors.ts';
import type { MySqlUnitOfWork } from '../infrastructure/mysql.ts';
import type { Identity } from '../modules/identity.ts';
import type { Nodes } from '../modules/nodes.ts';
import { Forwarding } from '../modules/forwarding.ts';
import { Idempotency } from '../modules/idempotency.ts';
import type { Accepted, RequestIdentity } from '../modules/idempotency.ts';
import { RuntimeLedger } from '../modules/runtime/ledger.ts';
import { compileDirect } from '../modules/runtime/planner.ts';
export class ControlApplication {
  readonly forwarding = new Forwarding(); readonly ledger = new RuntimeLedger(); readonly idempotency = new Idempotency();
  readonly db:MySqlUnitOfWork;readonly identity:Identity;readonly nodes:Nodes;
  constructor(db: MySqlUnitOfWork, identity: Identity, nodes: Nodes) { this.db=db;this.identity=identity;this.nodes=nodes; }
  async create(actorId: string, scopeId: string, key: string | undefined, input: unknown): Promise<Accepted> {
    if (!isId(scopeId) || !key || !/^[\x21-\x7e]{1,128}$/.test(key)) invalid('Valid scope and Idempotency-Key required');
    const parsed = parseForwardSpec(input); if (!parsed.ok) invalid('Invalid Forward spec');
    const spec = parsed.value;
    if (spec.protocols.length !== 1 || spec.protocols[0] !== 'tcp' || !spec.enabled || spec.path || spec.transport) throw new ControlError('UNSUPPORTED_CAPABILITY', 422, 'Phase 1 supports enabled direct TCP creation');
    const request: RequestIdentity = { scopeId, actorId, key, digest: digest({ method: 'POST', path: `/api/v1/scopes/${scopeId}/forwards`, input: spec }) };
    return this.db.transaction(async tx => {
      await this.identity.scope(tx, actorId, scopeId);
      const replay = await this.idempotency.claim(tx, request);
      if (replay) { await this.forwarding.get(tx, scopeId, replay.body.forwardId); return replay; }
      await this.identity.scope(tx,actorId,scopeId,true);
      const forward: Forward = { id: randomUUID(), scopeId, revision: 1, spec };
      const facts = await this.nodes.authorized(tx, actorId, forward);
      compileDirect(forward,facts,forward.spec.protocols.map(protocol=>({nodeId:facts.nodeId,forwardId:forward.id,protocol,port:forward.spec.ingress.listen.port,bindingFence:1,deploymentGeneration:1})));
      // Node serialization also bounds capacity checks and snapshot publication against concurrent acceptance.
      await this.ledger.lockNode(tx,facts.nodeId);
      const slots = await this.ledger.reserve(tx, forward);
      compileDirect(forward, facts, slots);
      await this.forwarding.insert(tx, forward);
      const operationId = await this.ledger.accept(tx, forward, request);
      await this.ledger.assertCapacity(tx,this.forwarding,facts);
      const response: Accepted = { status: 202, body: { forwardId: forward.id, revision: 1, operationId } };
      await this.idempotency.respond(tx, request, response);
      return response;
    });
  }
}
