import type { Forward } from '@tunex/core';
import { TransitReservations } from '../transit-owner/public.ts';
import type { TransitResource, ReservedTransitResource } from '../transit-owner/public.ts';
import { createMySqlExclusiveReservations } from '../../infrastructure/mysql-runtime-resources.ts';
import type { Transaction } from '../../infrastructure/mysql.ts';
export { validateTransitReservationSet } from '../transit-owner/public.ts';

const reservations=new TransitReservations(createMySqlExclusiveReservations());

/** Legacy function with the original transaction, resource owner and late defaults. */
export async function reserveTransitResources(
  tx: Transaction, forward: Forward, resources: readonly TransitResource[],
  generation: number,
): Promise<readonly ReservedTransitResource[]> {
  return reservations.reserve(tx,forward,resources,generation);
}
