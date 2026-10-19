import { isPort, ipBytes, normalizeIp, normalizeTargetHost } from '@tunex/core';
import { invalid } from '../framework/public.ts';
import type { RuntimeRelayEndpointConfig as RelayEndpoint } from '../framework/public.ts';
export type { RuntimeRelayEndpointConfig as RelayEndpoint, RuntimeRelayEndpoint as ResolvedEndpoint } from '../framework/public.ts';

export function parseRelayEndpoint(input: unknown): RelayEndpoint {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).sort().join(',') !== 'advertisedHost,allowedTcpPorts,listenAddress')
        invalid('Explicit Relay endpoint fields required');
    const value = input as Record<string, unknown>;
    const address = typeof value.listenAddress === 'string' ? normalizeIp(value.listenAddress) : undefined;
    const host = typeof value.advertisedHost === 'string' ? normalizeTargetHost(value.advertisedHost) : undefined;
    const bytes = host ? ipBytes(host) : undefined;
    if (bytes && (bytes.every(byte => byte === 0) || bytes.length === 4 && bytes[0]! >= 224 || bytes.length === 16 && bytes[0] === 255))
        invalid('Relay endpoint must identify a unicast host');
    if (!address || !host || !Array.isArray(value.allowedTcpPorts) || value.allowedTcpPorts.length < 1 || value.allowedTcpPorts.length > 256 ||
        value.allowedTcpPorts.some(p => !isPort(p)) || new Set(value.allowedTcpPorts).size !== value.allowedTcpPorts.length)
        invalid('Canonical IP listener, reachable host and bounded unique TCP ports required');
    return { listenAddress: address, advertisedHost: host, allowedTcpPorts: [...value.allowedTcpPorts as number[]].sort((a, b) => a - b) };
}
