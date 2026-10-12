function safeIntegerToken(token: string): boolean {
  if (token.length > 128) return false;
  const match = /^(-?)([0-9]+)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$/.exec(token);
  if (!match) return false;
  let coefficient = BigInt(match[2]! + (match[3] ?? ''));
  if (coefficient === 0n) return true;
  const scale = Number(match[4] ?? 0) - (match[3]?.length ?? 0);
  if (!Number.isSafeInteger(scale) || Math.abs(scale) > 128) return false;
  if (scale >= 0) { if (scale > 16) return false; coefficient *= 10n ** BigInt(scale); }
  else { const divisor = 10n ** BigInt(-scale); if (coefficient % divisor !== 0n) return false; coefficient /= divisor; }
  return coefficient <= 9007199254740991n;
}
/** A bounded JSON reader preserving evidence of duplicate keys before ordinary JSON.parse loses it. */
export function parseJson(raw: string, maxBytes = 4194304): unknown {
  if (Buffer.byteLength(raw, 'utf8') > maxBytes) throw new Error('RESOURCE_LIMIT: JSON body too large');
  let cursor = 0;
  function whitespace(): void { while (/^[\x20\x09\x0a\x0d]$/.test(raw[cursor] ?? '')) cursor++; }
  function string(): string {
    const start = cursor++;
    while (cursor < raw.length) {
      if (raw[cursor] === '\\') { cursor += 2; continue; }
      if (raw[cursor++] === '"') {
        const result: unknown = JSON.parse(raw.slice(start, cursor));
        if (typeof result !== 'string' || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(result)) throw new Error('INVALID_CONFIG: Invalid Unicode');
        return result;
      }
    }
    throw new Error('INVALID_CONFIG: Unterminated string');
  }
  function value(depth: number): unknown {
    if (depth > 64) throw new Error('RESOURCE_LIMIT: JSON nesting too deep');
    whitespace();
    const token = raw[cursor];
    if (token === '"') return string();
    if (token === '{') {
      cursor++; whitespace(); const object = Object.create(null) as Record<string, unknown>; const keys = new Set<string>();
      if (raw[cursor] === '}') { cursor++; return object; }
      while (true) {
        whitespace(); if (raw[cursor] !== '"') throw new Error('INVALID_CONFIG: Expected object key');
        const key = string();
        if (keys.has(key)) throw new Error('INTEGRITY_FAILURE: Duplicate JSON key');
        keys.add(key); whitespace(); if (raw[cursor++] !== ':') throw new Error('INVALID_CONFIG: Expected colon');
        object[key] = value(depth + 1); whitespace();
        const separator = raw[cursor++]; if (separator === '}') return object;
        if (separator !== ',') throw new Error('INVALID_CONFIG: Expected object separator');
      }
    }
    if (token === '[') {
      cursor++; whitespace(); const array: unknown[] = [];
      if (raw[cursor] === ']') { cursor++; return array; }
      while (true) {
        array.push(value(depth + 1)); whitespace(); const separator = raw[cursor++];
        if (separator === ']') return array;
        if (separator !== ',') throw new Error('INVALID_CONFIG: Expected array separator');
      }
    }
    const match = /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(raw.slice(cursor));
    if (!match) throw new Error('INVALID_CONFIG: Invalid JSON token');
    cursor += match[0].length;
    const scalar: unknown = JSON.parse(match[0]);
    if (typeof scalar === 'number' && (!Number.isFinite(scalar) || !safeIntegerToken(match[0]))) throw new Error('INVALID_CONFIG: Expected an exact safe integer');
    return scalar;
  }
  const result = value(0); whitespace();
  if (cursor !== raw.length) throw new Error('INVALID_CONFIG: Trailing JSON data');
  return result;
}
