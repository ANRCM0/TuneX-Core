import type { LockedMachineSession, MachineSessionLockReader } from '../framework/public.ts';
import { rows } from './mysql.ts';
import type { Transaction } from './mysql.ts';

/** Original Transit negotiation lock/query, deliberately without eager JSON normalization. */
export class MySqlTransitMachineReader implements MachineSessionLockReader<Transaction> {
    async read(tx:Transaction,nodeId:string,fingerprint:string):Promise<LockedMachineSession|undefined> {
        return (await rows<LockedMachineSession>(tx,
            `SELECT r.session_epoch,r.boot_id,n.revoked node_revoked,n.credential_until,n.facts,
          c.revoked credential_revoked,c.valid_until,c.retire_after
         FROM runtime_nodes r
         JOIN nodes n ON n.id=r.node_id
         LEFT JOIN node_credentials c ON c.node_id=r.node_id AND c.fingerprint=?
         WHERE r.node_id=? FOR UPDATE`,
            [fingerprint,nodeId]))[0];
    }
}
