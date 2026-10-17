import { isCounter } from '@tunex/core';
import { invalid } from '../application/errors.ts';
import { consolePage } from '../application/console-query.ts';

export function pathTemplateListQuery(search: URLSearchParams) {
    const query: { page?: string; limit?: string; prefix?: string } = {};
    for (const [name, value] of search) {
        if (!['page', 'limit', 'prefix'].includes(name) || search.getAll(name).length !== 1) invalid('Unknown or duplicate PathTemplate list query');
        query[name as keyof typeof query] = value;
    }
    consolePage(query.page, query.limit); return query;
}
export function pathTemplateRevisionQuery(search: URLSearchParams): number | undefined {
    for (const [name] of search) if (name !== 'revision' || search.getAll(name).length !== 1) invalid('Only one exact template revision is supported');
    const value = search.get('revision');
    if (value === null) return undefined;
    if (!/^[1-9][0-9]*$/.test(value) || !isCounter(Number(value))) invalid('Canonical PathTemplate revision required');
    return Number(value);
}
