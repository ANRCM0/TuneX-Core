import { isCounter } from '@tunex/core';
import { consolePage } from '../application/console-query.ts';
import type { ProfileReferenceQuery } from '../application/transport-queries.ts';
import { invalid } from '../application/errors.ts';

export function transportReferenceQuery(search: URLSearchParams): ProfileReferenceQuery {
    const query: ProfileReferenceQuery = {};
    for (const [key, value] of search) {
        if (!['page', 'limit', 'revision', 'targetRevision'].includes(key) || search.getAll(key).length !== 1)
            invalid('Unknown or duplicate Profile reference query parameter');
        if (key === 'page' || key === 'limit') query[key] = value;
        else {
            if (!/^[1-9][0-9]*$/.test(value) || !isCounter(Number(value))) invalid('Canonical locked Profile revision required');
            query[key as 'revision' | 'targetRevision'] = Number(value);
        }
    }
    consolePage(query.page, query.limit);
    return query;
}
