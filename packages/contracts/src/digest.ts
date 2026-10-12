import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const canonicalize: (value: unknown) => string | undefined = createRequire(import.meta.url)('canonicalize');
function assertJson(value: unknown, seen = new Set<object>()): void {
  if (typeof value === 'string') {
    if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) throw new Error('INVALID_CONFIG: Invalid Unicode');
  } else if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('INVALID_CONFIG: Nonfinite number');
  } else if (value !== null && typeof value === 'object') {
    if (seen.has(value)) throw new Error('INVALID_CONFIG: Cyclic JSON');
    seen.add(value);
    for (const [key, child] of Object.entries(value)) { assertJson(key, seen); assertJson(child, seen); }
    seen.delete(value);
  } else if (value !== null && typeof value !== 'boolean') throw new Error('INVALID_CONFIG: Non-JSON value');
}
/** RFC 8785 JCS, pinned library: never use default language JSON serialization for protocol digests. */
export function digest(value: unknown): string {
  assertJson(value);
  const canonical = canonicalize(value);
  if (canonical === undefined) throw new Error('INVALID_CONFIG: Cannot canonicalize value');
  return `sha256:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
}
