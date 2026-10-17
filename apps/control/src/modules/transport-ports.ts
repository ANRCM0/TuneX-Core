import type { RelayProfileConfig } from '@tunex/contracts';
import type { RequestIdentity } from '../application/ports.ts';

export interface ResolvedProfile {
    profileId: string;
    revision: number;
    config: RelayProfileConfig;
    configDigest: string;
}

/** Resolve one authorized immutable revision inside the owner's transaction. */
export interface TransportProfileResolver<Tx> {
    resolve(tx: Tx, actor: string, scopeId: string, profileId: string, revision: number): Promise<ResolvedProfile>;
}

export interface TransportGrantCommand {
    readonly actorId: string;
    readonly scopeId: string;
    readonly profileId: string;
    readonly subject: string;
    readonly expectedRevision: number;
    readonly allowed: boolean;
}

export interface TransportGrantState {
    readonly profileId: string;
    readonly actorId: string;
    readonly revision: number;
    readonly allowed: boolean;
    readonly changed: boolean;
}

/** Owner mutation only; the application must reconcile effects before committing. */
export interface TransportGrantWriter<Tx> {
    applyGrant(tx: Tx, command: TransportGrantCommand): Promise<TransportGrantState>;
}

export interface TransportGrantEffects<Tx> {
    reconcile(tx: Tx, request: RequestIdentity, grant: TransportGrantState): Promise<string[]>;
}
