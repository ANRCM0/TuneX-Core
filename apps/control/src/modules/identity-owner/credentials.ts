import { ControlError, invalid } from '../../framework/public.ts';
import { ACCOUNT_CREDENTIAL_EVENT_LIMIT } from './credential-contracts.ts';
import type { AccountCredentialApi, AccountCredentialOptions, AccountCredentialRotation, AccountCredentialView } from './credential-contracts.ts';

export class IdentityCredentials<Tx> implements AccountCredentialApi {
    private readonly options: AccountCredentialOptions<Tx>;
    constructor(options: AccountCredentialOptions<Tx>) { this.options = options; }

    private async current(tx: Tx, actorId: string, header: string | undefined, lock: 'share' | 'update'): Promise<string> {
        const { codec, secrets, store } = this.options;
        const token = codec.bearer(header);
        const record = await store.account(tx, actorId, lock);
        if (!token || !record || record.tokenHash !== secrets.tokenHash(token))
            throw new ControlError('UNAUTHENTICATED', 401, 'Current account credential required');
        return record.tokenHash;
    }
    private async view(tx: Tx, actorId: string): Promise<AccountCredentialView> {
        const summary = await this.options.store.summary(tx, actorId);
        if (!Number.isSafeInteger(summary.eventCount) || summary.eventCount < 0 || summary.eventCount > ACCOUNT_CREDENTIAL_EVENT_LIMIT ||
            (summary.eventCount === 0) !== (summary.lastRotatedAt === null) ||
            summary.lastRotatedAt !== null && (!Number.isSafeInteger(summary.lastRotatedAt) || summary.lastRotatedAt < 0 || summary.lastRotatedAt > 253402300799999))
            throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid account credential history');
        return { credentialVersion: 1, actorId, kind: 'bearer', scope: 'account-global',
            history: { source: 'self-service-rotation', retained: summary.eventCount, limit: 1024, lastSelfRotatedAt: summary.lastRotatedAt }, agentCredentialsChanged: false };
    }
    async get(header: string | undefined): Promise<AccountCredentialView> {
        const actorId = await this.options.identity.authenticate(header);
        return this.options.db.transaction(async tx => {
            await this.current(tx, actorId, header, 'share');
            return this.view(tx, actorId);
        });
    }
    async rotate(header: string | undefined, input: unknown): Promise<AccountCredentialRotation> {
        const actorId = await this.options.identity.authenticate(header);
        if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
            Object.keys(input).sort().join(',') !== 'credentialVersion,newToken') invalid('Closed account credential request required');
        const value = input as { credentialVersion: unknown; newToken: unknown };
        if (value.credentialVersion !== 1 || !this.options.codec.validBearer(value.newToken)) invalid('Valid new account bearer credential required');
        const nextHash = this.options.secrets.tokenHash(value.newToken);
        return this.options.db.transaction(async tx => {
            const currentHash = await this.current(tx, actorId, header, 'update');
            const before = await this.view(tx, actorId);
            if (currentHash === nextHash) return { ...before, changed: false };
            if (before.history.retained >= ACCOUNT_CREDENTIAL_EVENT_LIMIT)
                throw new ControlError('ACCOUNT_CREDENTIAL_CAPACITY', 429, 'Account credential history requires reviewed maintenance');
            const at = this.options.now();
            if (!Number.isSafeInteger(at) || at < 0 || at > 253402300799999)
                throw new ControlError('INTEGRITY_FAILURE', 409, 'Invalid account credential rotation time');
            if (!await this.options.store.replaceCurrent(tx, actorId, currentHash, nextHash))
                throw new ControlError('UNAUTHENTICATED', 401, 'Account credential changed during rotation');
            await this.options.store.rotated(tx, this.options.secrets.newID(), actorId, at);
            return { ...await this.view(tx, actorId), changed: true };
        });
    }
}
