import { json, rows } from './mysql.ts';
import type { Transaction } from './mysql.ts';
import type { ProbeMachineEvidence, ProbeMachineReader } from '../modules/probe-negotiation-ports.ts';

export class MySqlProbeMachineReader implements ProbeMachineReader<Transaction> {
    async read(tx: Transaction, nodeId: string, fingerprint: string): Promise<ProbeMachineEvidence | undefined> {
        const [current] = await rows<{
            node_id: string; boot_id: string | null; session_epoch: number;
            revoked: number; credential_revoked: number | null; credential_until: number | null;
            valid_until: number | null; retire_after: number | null; facts: unknown;
        }>(tx, `SELECT r.node_id,r.boot_id,r.session_epoch,n.revoked,n.credential_until,n.facts,
                c.revoked credential_revoked,c.valid_until,c.retire_after
            FROM runtime_nodes r JOIN nodes n ON n.id=r.node_id
            LEFT JOIN node_credentials c ON c.node_id=r.node_id AND c.fingerprint=?
            WHERE r.node_id=? FOR SHARE`, [fingerprint, nodeId]);
        if (!current) return undefined;
        const facts = json<{ capabilities?: unknown } | null>(current.facts);
        const capabilities = Array.isArray(facts?.capabilities) ?
            facts.capabilities.filter((capability): capability is string => typeof capability === 'string') : [];
        return { nodeId: current.node_id, bootId: current.boot_id, sessionEpoch: current.session_epoch,
            revoked: current.revoked !== 0, credentialRevoked: current.credential_revoked !== 0,
            nodeCredentialUntil: current.credential_until ?? 0, credentialUntil: current.valid_until ?? 0,
            retireAfter: current.retire_after, capabilities };
    }
}
