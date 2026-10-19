import { ipBytes } from '@tunex/core';
import type { AuthorizedNodeFacts } from '../framework/public.ts';
function unmap(bytes: readonly number[]): readonly number[] { return bytes.length === 16 && bytes.slice(0, 10).every(byte => byte === 0) && bytes[10] === 255 && bytes[11] === 255 ? bytes.slice(12) : bytes; }
function contains(cidr: string, bytes: readonly number[]): boolean {
    const [network, length] = cidr.split('/');
    const address = ipBytes(network!);
    const bits = Number(length);
    if (!address || address.length !== bytes.length)
        return false;
    return address.every((byte, index) => { const used = Math.max(0, Math.min(8, bits - index * 8)); const mask = used ? 255 << (8 - used) : 0; return (byte & mask) === (bytes[index]! & mask); });
}
/** Literal IP checks are deterministic; DNS targets are rechecked by Agent at each numeric-IP dial. */
export function targetAllowed(host: string, facts: Pick<AuthorizedNodeFacts, 'allowedDestinationCidrs' | 'allowMetadataTargets'>): boolean {
    const literal = ipBytes(host);
    if (!literal)
        return true;
    const bytes = unmap(literal);
    if (bytes.every(byte => byte === 0))
        return false;
    const metadata = ['169.254.0.0/16', '100.100.100.200/32', 'fd00:ec2::254/128', 'fe80::/10'];
    if (!facts.allowMetadataTargets && metadata.some(cidr => contains(cidr, bytes)))
        return false;
    if (bytes.length === 4 && bytes[0]! >= 224 || bytes.length === 16 && bytes[0] === 255)
        return false;
    return facts.allowedDestinationCidrs.some(cidr => contains(cidr, bytes));
}
