import type { StationAlertRecoveryStore } from '../../framework/public.ts';
import type { StationAlertState } from './contracts.ts';

export const STATION_ALERT_RECOVERY_INTERFACE_VERSION=1 as const;

export class StationAlertRecovery<Tx> {
    private readonly store:StationAlertRecoveryStore<Tx>;
    private readonly encode:(state:StationAlertState)=>string;
    constructor(store:StationAlertRecoveryStore<Tx>,encode:(state:StationAlertState)=>string) {this.store=store;this.encode=encode;}

    async quarantineRecovery(tx:Tx):Promise<void> {
        const state:StationAlertState={condition:'unknown',episode:0,instanceKey:null,armed:false,openedAt:null,
            opening:null,lastFiring:null,last:null,evaluatedAt:null};
        await this.store.quarantineRecovery(tx,this.encode(state));
    }
}
