import { randomUUID } from 'node:crypto';
import { isId, isCounter, isPort, normalizeIp } from '@tunex/core';
import type { Forward } from '@tunex/core';
import { digest, validCidr } from '@tunex/contracts';
import { ControlError, invalid, notFound } from '../application/errors.ts';
import { json, rows, write } from '../infrastructure/mysql.ts';
import type { MySqlUnitOfWork, Transaction } from '../infrastructure/mysql.ts';
import type { NodeCertificateAuthority } from '../infrastructure/pki.ts';
import { newToken, tokenHash } from './identity.ts';
import type { Identity } from './identity.ts';
import type { AuthorizedNodeFacts } from './runtime/planner.ts';

export type NodePolicy = Omit<AuthorizedNodeFacts, 'nodeId' | 'scopeId' | 'capabilities'>;
export interface NodeRecord { id: string; scope_id: string; credential_until: number | null; facts: unknown; revoked: number }
export class Nodes {
  private readonly db: MySqlUnitOfWork;private readonly identity: Identity;private readonly ca: NodeCertificateAuthority;
  constructor(db: MySqlUnitOfWork, identity: Identity, ca: NodeCertificateAuthority) { this.db=db;this.identity=identity;this.ca=ca; }
  async provision(actor: string, scope: string, policy: NodePolicy): Promise<{ nodeId: string; enrollmentToken: string; expiresAt: string }> {
    if (!policy || Object.keys(policy).some(key => !['allowedListenerAddresses','allowedPorts','egressPolicyRevision','allowedDestinationCidrs','allowMetadataTargets'].includes(key)) || !Array.isArray(policy.allowedListenerAddresses) || policy.allowedListenerAddresses.length === 0 || policy.allowedListenerAddresses.some(address => typeof address !== 'string' || normalizeIp(address) !== address) || !Array.isArray(policy.allowedPorts) || policy.allowedPorts.length === 0 || policy.allowedPorts.some(port => !isPort(port)) || !isCounter(policy.egressPolicyRevision) || !Array.isArray(policy.allowedDestinationCidrs) || policy.allowedDestinationCidrs.length === 0 || policy.allowedDestinationCidrs.length > 256 || policy.allowedDestinationCidrs.some(cidr => typeof cidr !== 'string' || !validCidr(cidr)) || typeof policy.allowMetadataTargets !== 'boolean') invalid('Invalid Node policy');
    const nodeId = randomUUID(), token = newToken(), until = Date.now()+600000;
    await this.db.transaction(async tx => {
      await this.identity.scope(tx, actor, scope, true);
      const facts: AuthorizedNodeFacts = { ...policy, nodeId, scopeId: scope, capabilities: [] };
      await write(tx, 'INSERT INTO nodes(id,scope_id,enrollment_hash,enrollment_until,facts) VALUES(?,?,?,?,?)', [nodeId, scope, tokenHash(token), until, JSON.stringify(facts)]);
      await write(tx, 'INSERT INTO node_grants(node_id,actor_id) VALUES(?,?)', [nodeId, actor]);
      await write(tx, 'INSERT INTO runtime_nodes(node_id) VALUES(?)', [nodeId]);
    });
    return { nodeId, enrollmentToken: token, expiresAt: new Date(until).toISOString() };
  }
  async enroll(nodeId: string, token: string, csr: string): Promise<{ certificate: string; ca: string }> {
    if (!isId(nodeId) || typeof token !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(token) || typeof csr !== 'string' || csr.length > 16384 || !csr.startsWith('-----BEGIN CERTIFICATE REQUEST-----')) invalid('Invalid enrollment input');
    const csrDigest = digest({ csr });
    return this.db.transaction(async tx => {
      const node = (await rows<NodeRecord & { enrollment_until: number; csr_digest: string | null; enrollment_response: unknown }>(tx, 'SELECT * FROM nodes WHERE id=? AND enrollment_hash=? FOR UPDATE', [nodeId, tokenHash(token)]))[0];
      if (!node || node.revoked || node.enrollment_until <= Date.now()) throw new ControlError('AUTHORIZATION_DENIED', 403, 'Enrollment rejected');
      if (node.csr_digest) {
        if (node.csr_digest !== csrDigest) throw new ControlError('ENROLLMENT_USED', 409, 'Token already exchanged');
        return json(node.enrollment_response);
      }
      const signed = await this.ca.sign(nodeId, csr);
      const response = { certificate: signed.certificate, ca: signed.ca };
      await write(tx, 'UPDATE nodes SET csr_digest=?,credential_fingerprint=?,credential_until=?,enrollment_response=? WHERE id=?', [csrDigest, signed.fingerprint, signed.until, JSON.stringify(response), nodeId]);
      return response;
    });
  }
  async machine(fingerprint: string): Promise<string> {
    const node = (await rows<{ id: string }>(this.db.pool, 'SELECT id FROM nodes WHERE credential_fingerprint=? AND revoked=FALSE AND credential_until>?', [fingerprint, Date.now()]))[0];
    if (!node) throw new ControlError('AUTHORIZATION_DENIED', 403, 'Node credential rejected');
    return node.id;
  }
  async authorized(tx: Transaction, actor: string, forward: Forward): Promise<AuthorizedNodeFacts> {
    const node = (await rows<NodeRecord>(tx, 'SELECT n.* FROM nodes n JOIN node_grants g ON n.id=g.node_id WHERE n.id=? AND n.scope_id=? AND g.actor_id=? FOR SHARE', [forward.spec.ingress.nodeId, forward.scopeId, actor]))[0];
    if (!node) notFound();
    if (node.revoked || !node.credential_until || node.credential_until <= Date.now()) throw new ControlError('AUTHORIZATION_DENIED', 403, 'Node is not enrolled or credential expired');
    return json(node.facts);
  }
  async facts(tx: Transaction, nodeId: string): Promise<{ facts: AuthorizedNodeFacts; credentialUntil: number }> {
    const node = (await rows<NodeRecord>(tx, 'SELECT * FROM nodes WHERE id=? FOR SHARE', [nodeId]))[0];
    if (!node || node.revoked || !node.credential_until || node.credential_until <= Date.now()) throw new ControlError('AUTHORIZATION_DENIED', 403, 'Node authorization expired');
    return { facts: json(node.facts), credentialUntil: node.credential_until };
  }
  async capabilities(tx: Transaction, nodeId: string, capabilities: string[]): Promise<void> {
    const current = await this.facts(tx, nodeId);
    await write(tx, 'UPDATE nodes SET facts=? WHERE id=?', [JSON.stringify({ ...current.facts, capabilities }), nodeId]);
  }
}
