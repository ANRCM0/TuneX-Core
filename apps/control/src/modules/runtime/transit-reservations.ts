import type { Forward } from '@tunex/core';
import { TransitReservations } from '../transit-owner/public.ts';
import type { TransitResource, ReservedTransitResource } from '../transit-owner/public.ts';
import { createMySqlExclusiveReservations, MySqlRuntimeResourceStore } from '../../infrastructure/mysql-runtime-resources.ts';
import { MySqlNodeAuthorityStore } from '../../infrastructure/mysql-node-authority.ts';
import { NodePortLimitPolicy } from '../node-owner/public.ts';
import type { Transaction } from '../../infrastructure/mysql.ts';
import type { RuntimePortReservationPolicy } from '../../framework/public.ts';
export { validateTransitReservationSet } from '../transit-owner/public.ts';

/** Original transaction with an explicit policy over the same MySQL owners. */
export async function reserveTransitResources(
  tx: Transaction, forward: Forward, resources: readonly TransitResource[],
  generation: number,portPolicy:RuntimePortReservationPolicy<Transaction>=new NodePortLimitPolicy(new MySqlNodeAuthorityStore(),new MySqlRuntimeResourceStore()),
): Promise<readonly ReservedTransitResource[]> {
  return new TransitReservations(createMySqlExclusiveReservations(portPolicy)).reserve(tx,forward,resources,generation);
}
