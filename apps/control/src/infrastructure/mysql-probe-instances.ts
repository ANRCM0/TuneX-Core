import { isCounter, isId } from '@tunex/core';
import { ControlError } from '../application/errors.ts';
import { rows, write } from './mysql.ts';
import type { Transaction } from './mysql.ts';
import type { ProbeInstanceRecord, ProbeInstanceStore } from '../modules/probe-instance-ports.ts';

interface Row {
    node_id: string; generation: number; boot_id: string | null; session_epoch: number | null;
    fingerprint: string | null; instance_id: string | null; state: string;
    registered_at: number | null; expires_at: number | null; revoked_at: number | null;
}
function record(row: Row | undefined, nodeId: string): ProbeInstanceRecord | undefined {
    if (!row) return undefined;
    const empty = row.state === 'empty' && row.generation === 0 &&
        [row.boot_id, row.session_epoch, row.fingerprint, row.instance_id, row.registered_at, row.expires_at, row.revoked_at].every(v => v === null);
    if (row.node_id === nodeId && empty) return undefined;
    if (row.node_id !== nodeId || !isId(row.node_id) || !isId(row.boot_id) ||
        !isCounter(row.session_epoch) || !isCounter(row.generation) ||
        typeof row.fingerprint !== 'string' || row.fingerprint.length !== 64 || !/^[0-9a-f]{64}$/.test(row.fingerprint) ||
        typeof row.instance_id !== 'string' || row.instance_id.length !== 64 || !/^[0-9a-f]{64}$/.test(row.instance_id) ||
        !['registered', 'revoked', 'quarantined'].includes(row.state) ||
        !Number.isSafeInteger(row.registered_at) || row.registered_at! < 0 ||
        !Number.isSafeInteger(row.expires_at) || row.expires_at! <= row.registered_at! ||
        row.expires_at! - row.registered_at! > 30000 ||
        (row.state === 'registered' ? row.revoked_at !== null : !Number.isSafeInteger(row.revoked_at) || row.revoked_at! < 0))
        throw new ControlError('PROBE_INSTANCE_CORRUPT', 503, 'Invalid persisted Probe instance; operator review required');
    return { nodeId: row.node_id, generation: row.generation, bootId: row.boot_id!, sessionEpoch: row.session_epoch!,
        fingerprint: row.fingerprint, instanceId: row.instance_id, state: row.state as ProbeInstanceRecord['state'],
        registeredAt: row.registered_at!, expiresAt: row.expires_at!, revokedAt: row.revoked_at };
}

/** Owns only probe_instances; never obtains a connection or changes Runtime authority. */
export class MySqlProbeInstances implements ProbeInstanceStore<Transaction> {
    async readCurrent(tx: Transaction, nodeId: string): Promise<ProbeInstanceRecord | undefined> {
        return record((await rows<Row>(tx, 'SELECT * FROM probe_instances WHERE node_id=? FOR SHARE', [nodeId]))[0], nodeId);
    }
    async read(tx: Transaction, nodeId: string): Promise<ProbeInstanceRecord | undefined> {
        return record((await rows<Row>(tx, 'SELECT * FROM probe_instances WHERE node_id=?', [nodeId]))[0], nodeId);
    }
    async lock(tx: Transaction, nodeId: string): Promise<ProbeInstanceRecord | undefined> {
        // The no-op upsert serializes an absent slot; its seed is rolled back if acceptance fails.
        await write(tx, 'INSERT INTO probe_instances(node_id) VALUES(?) ON DUPLICATE KEY UPDATE node_id=VALUES(node_id)', [nodeId]);
        return record((await rows<Row>(tx, 'SELECT * FROM probe_instances WHERE node_id=? FOR UPDATE', [nodeId]))[0], nodeId);
    }
    async replace(tx: Transaction, expectedGeneration: number, next: ProbeInstanceRecord): Promise<void> {
        record({ node_id: next.nodeId, generation: next.generation, boot_id: next.bootId, session_epoch: next.sessionEpoch,
            fingerprint: next.fingerprint, instance_id: next.instanceId, state: next.state,
            registered_at: next.registeredAt, expires_at: next.expiresAt, revoked_at: next.revokedAt }, next.nodeId);
        const closing = next.generation === expectedGeneration && next.state === 'revoked';
        if (!Number.isSafeInteger(expectedGeneration) || expectedGeneration < 0 ||
            !(closing || next.generation === expectedGeneration + 1 && next.state === 'registered'))
            throw new ControlError('PROBE_INSTANCE_CONFLICT', 409, 'Invalid Probe ownership transition');
        const match = closing ? " AND state='registered' AND boot_id=? AND session_epoch=? AND fingerprint=? AND instance_id=? AND registered_at=? AND expires_at=?" : '';
        const changed = await write(tx, `UPDATE probe_instances SET generation=?,boot_id=?,session_epoch=?,fingerprint=?,
            instance_id=?,state=?,registered_at=?,expires_at=?,revoked_at=? WHERE node_id=? AND generation=?${match}`,
        [next.generation, next.bootId, next.sessionEpoch, next.fingerprint, next.instanceId, next.state,
            next.registeredAt, next.expiresAt, next.revokedAt, next.nodeId, expectedGeneration,
            ...(closing ? [next.bootId, next.sessionEpoch, next.fingerprint, next.instanceId, next.registeredAt, next.expiresAt] : [])]);
        if (changed !== 1) throw new ControlError('PROBE_INSTANCE_CONFLICT', 409, 'Probe instance changed');
    }
    static async quarantineRecovery(tx: Transaction): Promise<void> {
        await write(tx, "UPDATE probe_instances SET state='quarantined',revoked_at=? WHERE generation>0", [Date.now()]);
    }
}
