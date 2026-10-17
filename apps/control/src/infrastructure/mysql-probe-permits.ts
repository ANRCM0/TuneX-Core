import { deepFreeze } from '@tunex/core';
import { ControlError } from '../application/errors.ts';
import type { ProbePermitRecord, ProbePermitStore } from '../modules/probe-permit-ports.ts';
import type { ProbeResultRecord } from '../modules/probe-result-ports.ts';
import { validProbePermit } from '../modules/probe-permit-state.ts';
import { json, rows, write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

/** Owns bounded permits, withdrawals, reported result receipts and their SQL-local budget clock. */
export class MySqlProbePermits implements ProbePermitStore<Transaction> {
    async lock(tx: Transaction) {
        const [budget] = await rows<{ observed_at: number }>(tx, 'SELECT observed_at FROM probe_permit_budget WHERE id=1 FOR UPDATE');
        if (!budget) throw new ControlError('PROBE_PERMIT_CORRUPT', 503, 'Probe permit budget is missing');
        const records = await rows<{ id: string; actor_id: string; scope_id: string; binding: unknown;
            instance_id: string; instance_generation: number; fingerprint: string; timeout_ms: number;
            issued_at: number; expires_at: number; state: string; closed_at: number | null }>(tx,
        `SELECT id,actor_id,scope_id,IF(OCTET_LENGTH(binding)<=2048,binding,NULL) binding,
            instance_id,instance_generation,fingerprint,timeout_ms,issued_at,expires_at,state,closed_at
            FROM probe_permits ORDER BY id LIMIT 257 FOR UPDATE`);
        const permits = records.map(row => {
            const value = { id: row.id, actorId: row.actor_id, scopeId: row.scope_id, binding: json(row.binding),
                instanceId: row.instance_id, instanceGeneration: row.instance_generation, fingerprint: row.fingerprint,
                timeoutMs: row.timeout_ms, issuedAt: row.issued_at, expiresAt: row.expires_at, state: row.state, closedAt: row.closed_at };
            if (!validProbePermit(value)) throw new ControlError('PROBE_PERMIT_CORRUPT', 503, 'Invalid persisted Probe permit');
            return deepFreeze(value);
        });
        const withdrawals = await rows<{ permit_id: string; withdrawn_at: number }>(tx,
            'SELECT permit_id,withdrawn_at FROM probe_permit_withdrawals ORDER BY permit_id LIMIT 257 FOR UPDATE');
        return { observedAt: budget.observed_at, records: permits,
            withdrawals: withdrawals.map(row => ({ permitId: row.permit_id, withdrawnAt: row.withdrawn_at })) };
    }
    async clock(tx: Transaction, now: number) {
        const changed = await write(tx, 'UPDATE probe_permit_budget SET observed_at=? WHERE id=1 AND observed_at<=?', [now, now]);
        if (changed !== 1) throw new ControlError('CLOCK_UNCERTAIN', 503, 'Probe budget clock changed');
    }
    async prune(tx: Transaction, expiredBefore: number) {
        if (expiredBefore >= 0) await write(tx, 'DELETE FROM probe_permits WHERE expires_at<=?', [expiredBefore]);
    }
    async insert(tx: Transaction, permit: ProbePermitRecord) {
        if (!validProbePermit(permit) || permit.state !== 'issued')
            throw new ControlError('PROBE_PERMIT_CORRUPT', 503, 'Invalid new Probe permit');
        await write(tx, `INSERT INTO probe_permits(id,actor_id,scope_id,binding,instance_id,instance_generation,
            fingerprint,timeout_ms,issued_at,expires_at,state,closed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
        [permit.id, permit.actorId, permit.scopeId, JSON.stringify(permit.binding), permit.instanceId, permit.instanceGeneration,
            permit.fingerprint, permit.timeoutMs, permit.issuedAt, permit.expiresAt, permit.state, permit.closedAt]);
    }
    async close(tx: Transaction, id: string, state: 'consumed' | 'revoked', at: number) {
        if (!['consumed', 'revoked'].includes(state) || !Number.isSafeInteger(at) || at < 0)
            throw new ControlError('PROBE_PERMIT_CORRUPT', 503, 'Invalid Probe permit closure');
        const changed = await write(tx, "UPDATE probe_permits SET state=?,closed_at=? WHERE id=? AND state='issued'", [state, at, id]);
        if (changed !== 1) throw new ControlError('PROBE_PERMIT_UNAVAILABLE', 409, 'Probe permit already closed');
    }
    async withdraw(tx: Transaction, id: string, at: number) {
        if (!Number.isSafeInteger(at) || at < 0)
            throw new ControlError('PROBE_PERMIT_CORRUPT', 503, 'Invalid Probe withdrawal');
        const changed = await write(tx, `INSERT INTO probe_permit_withdrawals(permit_id,withdrawn_at)
            SELECT id,? FROM probe_permits WHERE id=? AND state='consumed' AND closed_at>=issued_at AND closed_at<=?`, [at, id, at]);
        if (changed !== 1) throw new ControlError('PROBE_PERMIT_UNAVAILABLE', 409, 'Consumed Probe permit required');
    }
    async result(tx: Transaction, permitId: string): Promise<ProbeResultRecord | undefined> {
        const [record] = await rows<{ body: unknown; result_digest: string; accepted_at: number }>(tx,
            'SELECT IF(OCTET_LENGTH(body)<=4096,body,NULL) body,result_digest,accepted_at FROM probe_results WHERE permit_id=? FOR UPDATE', [permitId]);
        return record ? { body: json(record.body), resultDigest: record.result_digest, acceptedAt: record.accepted_at } : undefined;
    }
    async recordResult(tx: Transaction, record: ProbeResultRecord) {
        await write(tx, 'INSERT INTO probe_results(permit_id,body,result_digest,accepted_at) VALUES(?,?,?,?)',
            [record.body.permitId, JSON.stringify(record.body), record.resultDigest, record.acceptedAt]);
    }
    static async quarantineRecovery(tx: Transaction) {
        // Preserve IDs, consumption and the budget clock; never refund restored issuance reservations.
        await write(tx, "UPDATE probe_permits SET state='quarantined',closed_at=? WHERE state='issued'", [Date.now()]);
        await write(tx, `INSERT IGNORE INTO probe_permit_withdrawals(permit_id,withdrawn_at)
            SELECT id,GREATEST(?,closed_at) FROM probe_permits WHERE state='consumed'`, [Date.now()]);
    }
}
