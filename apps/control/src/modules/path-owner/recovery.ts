import type { PathPublicationRecoveryStore } from '../../framework/public.ts';

export const PATH_RECOVERY_INTERFACE_VERSION=1 as const;

/** Preserve plans, history and provenance while suspending restored pending work. */
export class PathPublicationRecovery<Tx> {
    private readonly store:PathPublicationRecoveryStore<Tx>;
    constructor(store:PathPublicationRecoveryStore<Tx>){this.store=store;}
    quarantineRecovery(tx:Tx,at:number):Promise<void> {return this.store.quarantineRecovery(tx,at);}
}
