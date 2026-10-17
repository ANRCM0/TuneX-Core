import { consolePage } from '../application/console-query.ts';
import type { TunnelPaging } from '../application/tunnel-queries.ts';
import { invalid } from '../application/errors.ts';

export function tunnelReferenceQuery(search: URLSearchParams): TunnelPaging {
    const query: TunnelPaging = {};
    for (const [key, value] of search) {
        if (!['page', 'limit'].includes(key) || search.getAll(key).length !== 1) invalid('Unknown or duplicate tunnel reference parameter');
        query[key as 'page' | 'limit'] = value;
    }
    consolePage(query.page, query.limit);
    return query;
}
