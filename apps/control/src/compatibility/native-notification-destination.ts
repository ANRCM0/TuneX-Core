import { isIP } from 'node:net';
import { ControlError } from '../framework/public.ts';

export function parseNotificationDestinationUrl(value: string): { url: string; hostname: string; path: string } {
    const denied = (): never => { throw new ControlError('INVALID_CONFIG',422,'Controlled public HTTPS destination required'); };
    if (typeof value !== 'string' || Buffer.byteLength(value,'utf8') > 2048 ||
        /[^\x21-\x7e]|[\\?#]/.test(value) || !value.startsWith('https://')) return denied();
    let parsed: URL;
    try { parsed = new URL(value); } catch { return denied(); }
    const hostname = parsed.hostname;
    if (parsed.protocol !== 'https:' || parsed.port !== '' && parsed.port !== '443' || parsed.username || parsed.password ||
        value.slice(8).split('/')[0]!.includes('@') || parsed.search || parsed.hash || isIP(hostname) ||
        hostname.length > 253 || !hostname.includes('.') || hostname.endsWith('.') ||
        hostname.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
        !/^[a-z]/.test(hostname.split('.').at(-1)!) ||
        /(?:^|\.)(?:localhost|local|internal|home|lan|test|invalid|example|onion|arpa)$/.test(hostname)) return denied();
    if (Buffer.byteLength(parsed.href,'utf8') > 2048) return denied();
    return { url: parsed.href, hostname, path: parsed.pathname };
}
