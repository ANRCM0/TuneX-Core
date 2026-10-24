import type { AccountCredentialStore, IdentityAccess, IdentityValueCodec, NodeSecrets, TransactionBoundary } from '../../framework/public.ts';

export const ACCOUNT_CREDENTIAL_API_INTERFACE_VERSION = 1 as const;
export const ACCOUNT_CREDENTIAL_EVENT_LIMIT = 1024;

export interface AccountCredentialView {
    readonly credentialVersion: 1;
    readonly actorId: string;
    readonly kind: 'bearer';
    readonly scope: 'account-global';
    readonly history: { readonly source: 'self-service-rotation'; readonly retained: number; readonly limit: 1024; readonly lastSelfRotatedAt: number | null };
    readonly agentCredentialsChanged: false;
}
export interface AccountCredentialRotation extends AccountCredentialView { readonly changed: boolean }
export interface AccountCredentialApi {
    get(header: string | undefined): Promise<AccountCredentialView>;
    rotate(header: string | undefined, input: unknown): Promise<AccountCredentialRotation>;
}
export interface AccountCredentialOptions<Tx> {
    readonly db: TransactionBoundary<Tx>;
    readonly store: AccountCredentialStore<Tx>;
    readonly identity: Pick<IdentityAccess<Tx>, 'authenticate'>;
    readonly codec: Pick<IdentityValueCodec, 'bearer' | 'validBearer'>;
    readonly secrets: Pick<NodeSecrets, 'tokenHash' | 'newID'>;
    readonly now: () => number;
}
