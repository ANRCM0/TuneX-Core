import { consoleFilterNames, consolePage, validateConsoleFilters } from '../application/console-query.ts';
import type { ConsoleListKind } from '../application/console-query.ts';
import { invalid } from '../application/errors.ts';

/** Reject duplicates and unknown keys rather than silently broadening a query. */
export function consoleQuery(kind: ConsoleListKind, search: URLSearchParams) {
    const filters: Record<string, string> = {};
    for (const [key, value] of search) {
        if (search.getAll(key).length !== 1 || !['page', 'limit', ...consoleFilterNames[kind]].includes(key))
            invalid('Invalid console query parameter');
        if (key !== 'page' && key !== 'limit') filters[key] = value;
    }
    validateConsoleFilters(kind, filters);
    const page = search.get('page') ?? undefined, limit = search.get('limit') ?? undefined;
    consolePage(page, limit);
    return { page, limit, filters };
}
