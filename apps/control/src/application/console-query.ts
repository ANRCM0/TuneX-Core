import { invalid } from './errors.ts';

export type ConsoleListKind = 'nodes' | 'forwards' | 'operations' | 'candidates';
export type ConsoleFilters = Readonly<Record<string, string>>;
export interface ConsolePaging { page: number; limit: number; offset: number }
export const consoleFilterNames: Readonly<Record<ConsoleListKind, readonly string[]>> = {
    nodes: ['idPrefix', 'credential'],
    forwards: ['idPrefix', 'enabled', 'recoverySuspended', 'protocol'],
    operations: ['forwardId', 'kind', 'status'],
    candidates: ['idPrefix', 'nodeId', 'mode', 'protocol'],
};
const enums: Record<string, readonly string[]> = {
    credential: ['valid', 'expired', 'unenrolled', 'revoked'],
    enabled: ['true', 'false'], recoverySuspended: ['true', 'false'],
    protocol: ['tcp', 'udp', 'both'], mode: ['direct', 'relay', 'multihop'],
    status: ['accepted', 'running', 'succeeded', 'failed', 'superseded'],
    kind: ['create', 'update', 'enable', 'disable', 'delete', 'retry', 'policy', 'revoke'],
};

export function validateConsoleFilters(kind: ConsoleListKind, filters: ConsoleFilters): void {
    for (const [key, value] of Object.entries(filters)) {
        if (!consoleFilterNames[kind].includes(key) || typeof value !== 'string' ||
            (enums[key] ? !enums[key]!.includes(value) : !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)))
            invalid('Invalid console filter');
    }
}

export function consolePage(pageText: string | undefined, limitText: string | undefined): ConsolePaging {
    const numeric = (value: string | undefined, fallback: number, maximum: number) => {
        if (value === undefined) return fallback;
        if (!/^[1-9][0-9]*$/.test(value) || Number(value) > maximum) invalid('Invalid pagination parameter');
        return Number(value);
    };
    const page = numeric(pageText, 1, 10000), limit = numeric(limitText, 25, 100);
    return { page, limit, offset: (page - 1) * limit };
}
