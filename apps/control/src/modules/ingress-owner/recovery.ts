import type { IngressDeploymentRecoveryStore, IngressMigrationRecoveryStore } from '../../framework/public.ts';

export const INGRESS_RECOVERY_INTERFACE_VERSION=1 as const;

/** Recovery invalidates durable batches without replaying definitions or lineage. */
export class IngressRecovery<Tx> {
    private readonly deployments:IngressDeploymentRecoveryStore<Tx>;
    private readonly migrations:IngressMigrationRecoveryStore<Tx>;
    constructor(deployments:IngressDeploymentRecoveryStore<Tx>,migrations:IngressMigrationRecoveryStore<Tx>){this.deployments=deployments;this.migrations=migrations;}
    quarantineDeployments(tx:Tx,at:number):Promise<void> {return this.deployments.quarantineRecovery(tx,at);}
    quarantineMigrations(tx:Tx,at:number):Promise<void> {return this.migrations.quarantineRecovery(tx,at);}
}
