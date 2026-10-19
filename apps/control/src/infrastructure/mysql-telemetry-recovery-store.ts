import type { TelemetryRecoveryStore } from '../framework/public.ts';
import { write } from './mysql.ts';
import type { Transaction } from './mysql.ts';

export class MySqlTelemetryRecoveryStore implements TelemetryRecoveryStore<Transaction> {
    async quarantineRecovery(tx:Transaction):Promise<void> {
        // Operational ingestion cursors reset; retained samples stay historical.
        await write(tx,'DELETE FROM telemetry_heads');
        await write(tx,'UPDATE telemetry_points SET recovery_suspended=TRUE WHERE recovery_suspended=FALSE');
        await write(tx,'DELETE FROM telemetry_rollup_cursors');
        await write(tx,'UPDATE telemetry_rollup_buckets SET recovery_suspended=TRUE WHERE recovery_suspended=FALSE');
        await write(tx,'DELETE FROM probe_telemetry_heads');
        await write(tx,'UPDATE probe_telemetry_points SET recovery_suspended=TRUE WHERE recovery_suspended=FALSE');
        await write(tx,'DELETE FROM host_telemetry_heads');
        await write(tx,'UPDATE host_telemetry_points SET recovery_suspended=TRUE WHERE recovery_suspended=FALSE');
        await write(tx,'DELETE FROM forward_telemetry_heads');
        await write(tx,'UPDATE forward_telemetry_points SET recovery_suspended=TRUE WHERE recovery_suspended=FALSE');
    }
}
