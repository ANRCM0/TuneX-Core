import { invalid } from '../framework/public.ts';
import type { ReadPageWindow } from '../framework/public.ts';

/** mysql2.execute binds numbers as DOUBLE, which MySQL may reject in LIMIT/OFFSET.
 * Only validated bounded integers are interpolated; other values stay bound.
 */
export function consolePageSql(paging:ReadPageWindow):string {
    if (!Number.isSafeInteger(paging.page) || paging.page < 1 || paging.page > 10000 ||
        !Number.isSafeInteger(paging.limit) || paging.limit < 1 || paging.limit > 100 ||
        !Number.isSafeInteger(paging.offset) || paging.offset !== (paging.page - 1) * paging.limit)
        invalid('Invalid bounded pagination');
    return `LIMIT ${paging.limit} OFFSET ${paging.offset}`;
}
