export const ACCOUNT_CREDENTIAL_STORE_INTERFACE_VERSION = 1 as const;

export interface AccountCredentialRecord { readonly tokenHash: string }
export interface AccountCredentialSummary { readonly eventCount: number; readonly lastRotatedAt: number | null }

/** Effects on the original account and its own audit, inside the supplied transaction. */
export interface AccountCredentialStore<Tx> {
    account(tx: Tx, actorId: string, lock: 'share' | 'update'): Promise<AccountCredentialRecord | undefined>;
    summary(tx: Tx, actorId: string): Promise<AccountCredentialSummary>;
    replaceCurrent(tx: Tx, actorId: string, currentHash: string, nextHash: string): Promise<boolean>;
    rotated(tx: Tx, eventId: string, actorId: string, at: number): Promise<void>;
}
