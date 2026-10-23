import { ControlError } from '../framework/public.ts';
import type { AccountCredentialStore, AccountCredentialRecord, AccountCredentialSummary } from '../framework/public.ts';
import { rows, write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

export class MySqlAccountCredentialStore implements AccountCredentialStore<Transaction> {
    async account(tx: Transaction, actorId: string, lock: 'share' | 'update'): Promise<AccountCredentialRecord | undefined> {
        const result = (await rows<{ token_hash: string }>(tx,
            'SELECT token_hash FROM accounts WHERE id=? ' + (lock === 'update' ? 'FOR UPDATE' : 'FOR SHARE'), [actorId]))[0];
        return result && { tokenHash: result.token_hash };
    }
    async summary(tx: Transaction, actorId: string): Promise<AccountCredentialSummary> {
        const result = (await rows<{ n: number; last_at: number | null }>(tx,
            'SELECT COUNT(*) n,MAX(created_at) last_at FROM account_credential_events WHERE actor_id=?', [actorId]))[0]!;
        return { eventCount: result.n, lastRotatedAt: result.last_at };
    }
    async replaceCurrent(tx: Transaction, actorId: string, currentHash: string, nextHash: string): Promise<boolean> {
        try {
            return await write(tx, 'UPDATE accounts SET token_hash=? WHERE id=? AND token_hash=?', [nextHash, actorId, currentHash]) === 1;
        } catch (error) {
            if ((error as { code?: string }).code === 'ER_DUP_ENTRY')
                throw new ControlError('ACCOUNT_CREDENTIAL_CONFLICT', 409, 'The requested account credential cannot be used');
            throw error;
        }
    }
    async rotated(tx: Transaction, eventId: string, actorId: string, at: number): Promise<void> {
        await write(tx, 'INSERT INTO account_credential_events(id,actor_id,kind,created_at) VALUES(?,?,?,?)',
            [eventId, actorId, 'credential_rotated', at]);
    }
}
