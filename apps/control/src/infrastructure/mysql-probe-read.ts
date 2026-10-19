import { parseRuntimeMessage } from '@tunex/contracts/runtime';
import { json, rows } from './mysql.ts';
import type { Transaction } from './mysql.ts';
import type { NativePublishedRuntimeReader as PublishedRuntimeReader, NativePublishedRuntimeEvidence as PublishedRuntimeEvidence } from '../compatibility/public.ts';

/** One published Snapshot projection, scoped before any body leaves MySQL. No commands or network work. */
export class MySqlProbeReader implements PublishedRuntimeReader<Transaction> {
    private readonly locking: boolean;
    constructor(locking = false) { this.locking = locking; }
    async read(tx: Transaction, scopeId: string, nodeId: string): Promise<PublishedRuntimeEvidence | undefined> {
        const [record] = await rows<{
            boot_id: string | null; session_epoch: number; snapshot_generation: number;
            credential_until: number | null; valid_until: number; body: unknown;
        }>(tx, `SELECT r.boot_id,r.session_epoch,r.snapshot_generation,n.credential_until,s.valid_until,s.body
            FROM nodes n JOIN runtime_nodes r ON r.node_id=n.id
            JOIN snapshots s ON s.node_id=n.id AND s.generation=r.snapshot_generation AND s.session_epoch=r.session_epoch
            WHERE n.id=? AND n.scope_id=? AND n.revoked=FALSE AND OCTET_LENGTH(s.body)<=1048576${this.locking ? ' FOR SHARE' : ''}`, [nodeId, scopeId]);
        if (!record) return undefined;
        const snapshot = parseRuntimeMessage('Snapshot', JSON.stringify(json(record.body)), 1048576);
        if (snapshot.nodeId !== nodeId || snapshot.sessionEpoch !== record.session_epoch ||
            snapshot.snapshotGeneration !== record.snapshot_generation || Date.parse(snapshot.validUntil) !== record.valid_until)
            return undefined;
        return { bootId: record.boot_id, sessionEpoch: record.session_epoch,
            credentialUntil: record.credential_until ?? 0, snapshot };
    }
}
