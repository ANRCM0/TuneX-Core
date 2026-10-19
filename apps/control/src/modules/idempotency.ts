import { IdempotencyHost } from '../framework/public.ts';
import { MySqlIdempotencyStore } from '../infrastructure/mysql-intent-store.ts';
import { nativeStoredValues } from '../compatibility/public.ts';
import type { Transaction } from '../infrastructure/mysql.ts';
import type { ForwardAccepted as Accepted } from './forward-owner/public.ts';
export type { RequestIdentity } from '../framework/public.ts';
export type { ForwardAccepted as Accepted } from './forward-owner/public.ts';

/** Retain the old default response type without coupling the lower host to Forward commands. */
export class Idempotency extends IdempotencyHost<Transaction,Accepted> {
    constructor(){super(new MySqlIdempotencyStore(),nativeStoredValues);}
}
