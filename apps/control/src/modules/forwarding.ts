import { ForwardStateService } from './forward-owner/public.ts';
import { MySqlForwardIntentStore } from '../infrastructure/mysql-intent-store.ts';
import { nativeStoredValues } from '../compatibility/public.ts';
import type { Transaction } from '../infrastructure/mysql.ts';

/** Old zero-argument entry binds storage for the same Forward intent owner. */
export class Forwarding extends ForwardStateService<Transaction> {
    constructor(){super({store:new MySqlForwardIntentStore(),values:nativeStoredValues});}
}
