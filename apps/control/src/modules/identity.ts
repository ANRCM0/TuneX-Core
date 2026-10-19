import { IdentityService } from './identity-owner/public.ts';
import { MySqlIdentityStore, MySqlIdentityAccountLookup } from '../infrastructure/mysql-identity.ts';
import { nativeNodeSecrets } from '../infrastructure/identity-secrets.ts';
import { nativeIdentityCodec } from '../compatibility/public.ts';
import type { MySqlUnitOfWork, Transaction } from '../infrastructure/mysql.ts';

export { tokenHash, validBearerToken, newToken } from '../infrastructure/identity-secrets.ts';

/** Existing constructor binds providers for the same identity owner and tables. */
export class Identity extends IdentityService<Transaction> {
    constructor(db:MySqlUnitOfWork) {
        super({db,store:new MySqlIdentityStore(),accounts:new MySqlIdentityAccountLookup(db),
            secrets:nativeNodeSecrets,codec:nativeIdentityCodec,now:()=>Date.now()});
    }
}
