import type { RecoveryQuarantineContext, RecoveryQuarantineOptions } from './contracts.ts';

/** One supplied transaction, with each mutation retained by its original owner. */
export class RecoveryQuarantine<Tx> {
    private readonly options:RecoveryQuarantineOptions<Tx>;
    constructor(options:RecoveryQuarantineOptions<Tx>){this.options=options;}
    async run(tx:Tx,context:RecoveryQuarantineContext):Promise<void> {
        const {owners,effects,events}=this.options;
        context.acceptCredentials(await owners.identity(tx));
        await owners.transport(tx);
        await owners.relay(tx);
        await owners.nodes(tx);
        await owners.telemetry(tx);
        await owners.station(tx);
        await owners.notification(tx);
        await owners.probeHistory(tx);
        await owners.probePlans(tx);
        await owners.probeQualifications(tx);
        await owners.observationServices(tx);
        const publicationRecoveryAt=effects.now();
        await owners.pathPublications(tx,publicationRecoveryAt);
        await owners.ingressDeployments(tx,publicationRecoveryAt);
        await owners.ingressMigrations(tx,publicationRecoveryAt);
        await owners.probeInstances(tx);
        await owners.probePermits(tx);
        await owners.forwards(tx);
        await owners.ledger(tx);
        await owners.idempotency(tx);
        await events.record(tx,context.recoveryId,effects.now(),effects.encode({backupId:context.manifest.id,
            sourceDatabase:context.manifest.database,oldTrust:context.manifest.trustDigest,
            newTrust:context.newTrustDigest,authorizationCutoff:context.authority.latestValidUntil,reviewRequired:true}));
    }
}
