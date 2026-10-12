interface Instant { seconds: number; fraction: string }
function instant(value: string): Instant {
  const match = /^(\d{4}-\d{2}-\d{2})[Tt](\d{2}:\d{2}:\d{2})(?:\.(\d+))?Z$/.exec(value);
  const seconds = match ? Date.parse(`${match[1]}T${match[2]}Z`) / 1000 : NaN;
  if (!Number.isFinite(seconds)) throw new Error('INVALID_CONFIG: Unrepresentable UTC timestamp');
  return { seconds, fraction: (match![3] ?? '').replace(/0+$/, '') };
}
function compare(a: Instant, b: Instant): number {
  if (a.seconds !== b.seconds) return Math.sign(a.seconds - b.seconds);
  const length = Math.max(a.fraction.length, b.fraction.length);
  const left = a.fraction.padEnd(length, '0'), right = b.fraction.padEnd(length, '0');
  return left < right ? -1 : left > right ? 1 : 0;
}
/** Reject unrepresentable UTC times (including leap seconds); compare fractional seconds without Date.parse truncation. */
export function compareTimes(a: string, b: string): number { return compare(instant(a), instant(b)); }
export function validateTime(value: string): void { instant(value); }
export function withinLease(issued: string, valid: string, leaseSeconds: number): boolean {
  const start = instant(issued), end = instant(valid);
  return compare(start, end) < 0 && compare(end, { seconds: start.seconds + leaseSeconds, fraction: start.fraction }) <= 0;
}
