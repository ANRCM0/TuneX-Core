import { deepFreeze } from '@tunex/core';
import { NATIVE_DRIVER_CATALOG, NATIVE_DRIVER_CATALOG_DIGEST } from '@tunex/contracts';
import type { ScopeAuthorization, TransactionBoundary } from './ports.ts';

/** Catalog declarations and process gates, deliberately separate from Node evidence and authorization. */
export class NativeDrivers<Tx> {
    private readonly db: TransactionBoundary<Tx>;
    private readonly identity: ScopeAuthorization<Tx>;
    private readonly multihopEnabled: boolean;
    private readonly probeIssuanceEnabled: boolean;
    constructor(db: TransactionBoundary<Tx>, identity: ScopeAuthorization<Tx>, multihopEnabled = false, probeIssuanceEnabled = false) {
        this.db = db; this.identity = identity; this.multihopEnabled = multihopEnabled; this.probeIssuanceEnabled = probeIssuanceEnabled;
    }
    async list(actor: string, scope: string) {
        return this.db.transaction(async tx => {
            await this.identity.scope(tx, actor, scope);
            return deepFreeze({ version: 1, catalogDigest: NATIVE_DRIVER_CATALOG_DIGEST, source: 'declared-native-implementation',
                authorized: false, reserved: false, nodeEvidence: 'not-included', platformAcceptance: 'not-inferred',
                protocolCapabilityCheck: 'each-requested-business-protocol', probeIssuanceEnabled: this.probeIssuanceEnabled,
                drivers: NATIVE_DRIVER_CATALOG.drivers.map(d => ({ ...d, controlEnabled: d.controlGate !== 'multihop' || this.multihopEnabled })) });
        });
    }
}
