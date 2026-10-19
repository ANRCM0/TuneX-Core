import type { Forward } from '@tunex/core';
import type { Policy, ForwardRuntimeStatus } from '../framework/public.ts';
import { nativeRuntimeStatusCodec } from '../compatibility/public.ts';
import { RuntimeStatusQueries } from '../modules/runtime-status-owner/public.ts';
import { MySqlRuntimeStatusStore } from './mysql-runtime-status-store.ts';
import type { Transaction } from './mysql.ts';

/** Legacy constructor and prototype entry over the one product projection and raw SQL adapter. */
export class MySqlRuntimeObservations extends RuntimeStatusQueries<Transaction> {
    constructor(policy:Policy) {super(new MySqlRuntimeStatusStore(),nativeRuntimeStatusCodec,policy);}
    async status(tx:Transaction,forward:Forward):Promise<ForwardRuntimeStatus> {return super.status(tx,forward);}
}
