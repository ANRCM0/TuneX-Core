import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Transaction } from '../src/infrastructure/mysql.ts';
import { Forwarding } from '../src/modules/forwarding.ts';
import type { Nodes } from '../src/modules/nodes.ts';
import type { RelayEndpoints } from '../src/modules/relay-endpoints.ts';
import type { TransportProfileResolver } from '../src/modules/transport-ports.ts';
import type { RuntimeLedger } from '../src/modules/runtime/ledger.ts';
import { compileMultihopResources } from '../src/modules/runtime/multihop-plan.ts';
import { RelayCoordinator } from '../src/modules/runtime/relay-coordinator.ts';
import { multihopFixture } from './fixtures/multihop.ts';
import { ControlError } from '../src/application/errors.ts';
import type { NodeUseRole } from '../src/framework/node-authority-ports.ts';
import type { Forward } from '@tunex/core';

for (const count of [3, 4, 8]) test(`${count}-Node coordinator extracts domain intent from stored Forward metadata`, async () => {
  const input = multihopFixture(count), before = JSON.stringify(input);
  const tx = {
    execute: async (sql: string, args: unknown[]) => {
      if (sql === 'SELECT * FROM forwards WHERE id=? AND scope_id=?') {
        assert.deepEqual(args, [input.forward.id, input.forward.scopeId]);
        return [[{
          id: input.forward.id, scope_id: input.forward.scopeId, owner_actor_id: 'owner', revision: input.forward.revision,
          spec: JSON.stringify(input.forward.spec), deleting: 0, recovery_suspended: 0,
        }], []];
      }
      if (sql === 'SELECT session_epoch FROM runtime_nodes WHERE node_id=?') {
        const node = input.nodes.find(node => node.facts.nodeId === args[0])!;
        return [[{ session_epoch: node.sessionEpoch }], []];
      }
      throw new Error('Unexpected SQL ' + sql);
    },
  } as unknown as Transaction;
  const nodes = {
    reservationPorts: async (current: Transaction, actor: string, scope: string, id: string, ports: readonly number[]) => {
      assert.equal(current, tx);
      assert.equal(actor, 'owner');
      assert.equal(scope, input.forward.scopeId);
      const endpoint = input.endpoints.find(endpoint => endpoint.nodeId === id)!;
      assert.deepEqual(ports, endpoint.config.allowedTcpPorts);
      return ports;
    },
    authorizedRelayNode: async (_tx: Transaction, actor: string, scope: string, id: string, role: NodeUseRole, forward?: Forward) => {
      assert.equal(_tx, tx);
      assert.equal(actor, 'owner');
      assert.equal(scope, input.forward.scopeId);
      const path = [input.forward.spec.ingress.nodeId, ...input.forward.spec.path!.via];
      assert.equal(role, id === path[0] ? 'ingress' : id === path.at(-1) ? 'egress' : 'transit');
      assert.deepEqual(forward, { ...input.forward, ownerActorId: 'owner', deleting: false, recoverySuspended: false });
      return input.nodes.find(node => node.facts.nodeId === id)!.facts;
    },
    facts: async (_tx: Transaction, id: string) => ({ credentialUntil: input.nodes.find(node => node.facts.nodeId === id)!.credentialUntil }),
    relayCredentialFacts: async (_tx: Transaction, id: string) => input.nodes.find(node => node.facts.nodeId === id)!.peers,
  } as unknown as Nodes;
  const transport: TransportProfileResolver<Transaction> = {
    resolve: async (_tx: Transaction, actor: string, scope: string, id: string, revision: number) => {
      assert.equal(_tx, tx);
      assert.equal(actor, 'owner');
      assert.equal(scope, input.forward.scopeId);
      assert.equal(id, input.profile.profileId);
      assert.equal(revision, input.profile.revision);
      return input.profile;
    },
  };
  const endpoints = {
    resolve: async (_tx: Transaction, id: string) => input.endpoints.find(endpoint => endpoint.nodeId === id)!,
  } as unknown as RelayEndpoints;
  const forwarding = new Forwarding();
  const ledger = {} as RuntimeLedger;
  const coordinator = new RelayCoordinator(nodes, forwarding, transport, endpoints, ledger, undefined, true);
  const stored = await forwarding.record(tx, input.forward.scopeId, input.forward.id), storedBefore = JSON.stringify(stored);
  assert.equal(stored.deleting, false);
  assert.equal(stored.ownerActorId, 'owner');
  assert.equal(stored.recoverySuspended, false);
  assert.throws(() => compileMultihopResources({ ...input, forward: stored }), /INVALID_CONFIG: Locked multi-hop Forward required/);
  assert.equal(await coordinator.canExecute(tx, 'owner', stored), true);
  const preview = await coordinator.preview(tx, 'owner', stored);
  assert.deepEqual(preview.resources, compileMultihopResources(input));
  assert.deepEqual(preview.path, [input.forward.spec.ingress.nodeId, ...input.forward.spec.path!.via]);
  assert.equal(preview.reserved, false);
  const disabled = new RelayCoordinator(nodes, forwarding, transport, endpoints, ledger, undefined, false);
  assert.equal(await disabled.canExecute(tx, 'owner', stored), false);
  const denial = new ControlError('AUTHORIZATION_DENIED', 403, 'Profile grant denied');
  const deniedProfile: TransportProfileResolver<Transaction> = {
    resolve: async (current, actor, scope, id, revision) => {
      assert.equal(current, tx); assert.equal(actor, 'owner'); assert.equal(scope, stored.scopeId);
      assert.equal(id, input.profile.profileId); assert.equal(revision, input.profile.revision);
      throw denial;
    },
  };
  const rejected = new RelayCoordinator(nodes, forwarding, deniedProfile, endpoints, ledger, undefined, true);
  assert.equal(await rejected.canExecute(tx, 'owner', stored), false);
  await assert.rejects(rejected.preview(tx, 'owner', stored), error => error === denial);
  assert.equal(JSON.stringify(stored), storedBefore);
  assert.equal(JSON.stringify(input), before);
});
