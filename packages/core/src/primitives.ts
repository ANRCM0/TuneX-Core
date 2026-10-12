/** Dependency-free primitive checks shared by domain and protocol validation. */
export const MAX_COUNTER = 9007199254740991;
export function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 128 && !/[\r\n]/.test(value) && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
}
export function isCounter(value: unknown, allowZero = false): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= (allowZero ? 0 : 1);
}
export function isPort(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535;
}
export function ipv4Bytes(value: string): readonly number[] | undefined {
  const fields = value.split('.');
  if (fields.length !== 4 || fields.some(field => !/^(0|[1-9][0-9]{0,2})$/.test(field) || Number(field) > 255)) return undefined;
  return fields.map(Number);
}
export function ipBytes(value: string): readonly number[] | undefined {
  const v4 = ipv4Bytes(value);
  if (v4) return v4;
  if (!value.includes(':') || /[^0-9a-fA-F:.]/.test(value)) return undefined;
  let input = value;
  if (input.includes('.')) {
    const boundary = input.lastIndexOf(':');
    const tail = ipv4Bytes(input.slice(boundary + 1));
    if (!tail) return undefined;
    input = `${input.slice(0, boundary)}:${((tail[0]! << 8) | tail[1]!).toString(16)}:${((tail[2]! << 8) | tail[3]!).toString(16)}`;
  }
  const halves = input.split('::');
  if (halves.length > 2) return undefined;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const count = left.length + right.length;
  if (halves.length === 1 ? count !== 8 : count >= 8) return undefined;
  if ([...left, ...right].some(field => !/^[0-9a-fA-F]{1,4}$/.test(field))) return undefined;
  const words = [...left, ...Array<string>(8 - count).fill('0'), ...right];
  return words.flatMap(field => { const word = Number.parseInt(field, 16); return [word >> 8, word & 255]; });
}
export function normalizeIp(value: string): string | undefined {
  const bytes = ipBytes(value);
  if (!bytes) return undefined;
  if (bytes.length === 4) return bytes.join('.');
  if (bytes.slice(0, 10).every(byte => byte === 0) && bytes[10] === 255 && bytes[11] === 255) return `::ffff:${bytes.slice(12).join('.')}`;
  const words = Array.from({ length: 8 }, (_, i) => ((bytes[2 * i]! << 8) | bytes[2 * i + 1]!).toString(16));
  let bestStart = -1, bestLength = 1;
  for (let i = 0; i < 8;) {
    if (words[i] !== '0') { i++; continue; }
    const start = i;
    while (words[i] === '0' && i < 8) i++;
    if (i - start > bestLength) { bestStart = start; bestLength = i - start; }
  }
  if (bestStart < 0) return words.join(':');
  return `${words.slice(0, bestStart).join(':')}::${words.slice(bestStart + bestLength).join(':')}`;
}
export function normalizeTargetHost(input: unknown): string | undefined {
  if (typeof input !== 'string' || input.length === 0 || /[^A-Za-z0-9.:-]/.test(input)) return undefined;
  const ip = normalizeIp(input);
  if (ip) {
    const bytes = ipBytes(ip)!;
    if (bytes.every(byte => byte === 0)) return undefined;
    if (bytes.length === 16 && bytes.slice(0, 10).every(byte => byte === 0) && bytes[10] === 255 && bytes[11] === 255 && bytes.slice(12).every(byte => byte === 0)) return undefined;
    return ip;
  }
  const host = input.toLowerCase().replace(/\.$/, '');
  if (host.length > 253 || /^[0-9.]+$/.test(host)) return undefined;
  if (host.split('.').some(label => label.length < 1 || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) return undefined;
  return host;
}
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
