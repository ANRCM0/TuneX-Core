export interface ProbeInstanceRecord {
    readonly nodeId: string;
    readonly bootId: string;
    readonly sessionEpoch: number;
    readonly fingerprint: string;
    readonly instanceId: string;
    /** Advances on replacement, never on replay, revocation or recovery quarantine. */
    readonly generation: number;
    readonly state: 'registered' | 'revoked' | 'quarantined';
    readonly registeredAt: number;
    readonly expiresAt: number;
    readonly revokedAt: number | null;
}

/** Uses only the caller's transaction. Lock serializes first registration as well as replacement. */
export interface ProbeInstanceStore<Tx> {
    read(tx: Tx, nodeId: string): Promise<ProbeInstanceRecord | undefined>;
    lock(tx: Tx, nodeId: string): Promise<ProbeInstanceRecord | undefined>;
    replace(tx: Tx, expectedGeneration: number, next: ProbeInstanceRecord): Promise<void>;
}
