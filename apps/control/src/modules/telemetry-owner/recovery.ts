import type { TelemetryRecoveryStore } from '../../framework/public.ts';

export const TELEMETRY_RECOVERY_INTERFACE_VERSION=1 as const;

export class TelemetryRecovery<Tx> {
    private readonly store:TelemetryRecoveryStore<Tx>;
    constructor(store:TelemetryRecoveryStore<Tx>) {this.store=store;}

    quarantineRecovery(tx:Tx):Promise<void> {
        return this.store.quarantineRecovery(tx);
    }
}
