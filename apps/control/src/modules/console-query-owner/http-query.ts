import { nativeConsoleQuery } from '../../compatibility/public.ts';
import type { NativeQuerySearch } from '../../compatibility/public.ts';
import { consoleFilterNames, validateConsoleFilters } from './rules.ts';
import type { ConsoleListKind } from './contracts.ts';

/** The native codec calls owner filters before the original page validation. */
export function consoleQuery(kind: ConsoleListKind, search: NativeQuerySearch) {
    return nativeConsoleQuery(kind, search, consoleFilterNames, validateConsoleFilters);
}
