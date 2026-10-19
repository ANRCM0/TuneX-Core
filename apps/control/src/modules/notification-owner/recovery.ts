import type { NotificationRecoveryStore } from '../../framework/public.ts';

export const NOTIFICATION_RECOVERY_INTERFACE_VERSION=1 as const;

export class NotificationRecovery<Tx> {
    private readonly store:NotificationRecoveryStore<Tx>;
    private readonly now:()=>number;
    constructor(store:NotificationRecoveryStore<Tx>,now:()=>number) {this.store=store;this.now=now;}

    async quarantineRecovery(tx:Tx):Promise<void> {
        await this.store.suspendEndpoints(tx);
        const at=this.now();
        await this.store.quarantineDeliveries(tx,at);
    }
}
