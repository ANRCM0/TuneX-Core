import { invalid, pageWindow } from '../../framework/public.ts';

import type { ConsoleListKind, ConsoleFilters, ConsolePaging } from './contracts.ts';
export type { ConsoleListKind, ConsoleFilters, ConsolePaging } from './contracts.ts';

export const consoleFilterNames: Readonly<Record<ConsoleListKind, readonly string[]>> = {
    nodes: ['idPrefix', 'credential', 'resourceSource', 'ownership'],
    forwards: ['idPrefix', 'enabled', 'recoverySuspended', 'protocol', 'ownership'],
    operations: ['forwardId', 'kind', 'status'],
    candidates: ['idPrefix', 'nodeId', 'mode', 'protocol', 'role'],
};
const enums: Record<string, readonly string[]> = {
    resourceSource:['private','admin-shared','legacy-unclassified'],
    ownership:['mine','available'],
    role: ['ingress', 'transit', 'egress'],
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
    return pageWindow(pageText,limitText);
}
