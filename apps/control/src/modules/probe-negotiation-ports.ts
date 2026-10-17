/** Credential/session evidence, never a Snapshot, permit issuer or connection owner. */
export interface ProbeMachineEvidence {
    readonly nodeId: string;
    readonly bootId: string | null;
    readonly sessionEpoch: number;
    readonly revoked: boolean;
    readonly credentialRevoked: boolean;
    readonly nodeCredentialUntil: number;
    readonly credentialUntil: number;
    readonly retireAfter: number | null;
    readonly capabilities: readonly string[];
}
export interface ProbeMachineReader<Tx> {
    read(tx: Tx, nodeId: string, fingerprint: string): Promise<ProbeMachineEvidence | undefined>;
}
