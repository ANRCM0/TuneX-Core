import type { StationAlertPolicy, StationAlertEvent } from './contracts.ts';

/** Derived event handoff joins the producer's original transaction. */
export interface StationEventHandoff<Tx> {
    enqueueIn(tx: Tx, scope: string, policy: StationAlertPolicy, event: StationAlertEvent, now: number): Promise<void>;
}
