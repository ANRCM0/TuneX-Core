import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { compareTimes, digest, parseJson, parseMessage, validateStructure, validCidr, withinLease } from '../src/index.ts';
import type { Messages } from '../src/index.ts';

interface FixtureCase { name: string; schema: keyof Messages; payload: unknown }
const fixture = JSON.parse(readFileSync(new URL('../../../packages/contracts/fixtures/adp-v2-direct.json', import.meta.url), 'utf8')) as { valid: FixtureCase[]; invalid: FixtureCase[] };
for (const item of fixture.valid) test(`authoritative valid: ${item.name}`, () => {
  const raw = JSON.stringify(item.payload);
  assert.equal(validateStructure(item.schema, raw), true);
  assert.doesNotThrow(() => parseMessage(item.schema, raw));
});
for (const item of fixture.invalid) test(`authoritative invalid: ${item.name}`, () => {
  const raw = JSON.stringify(item.payload);
  assert.equal(validateStructure(item.schema, raw), false);
  assert.throws(() => parseMessage(item.schema, raw));
});
const supplement = JSON.parse(readFileSync(new URL('./fixtures/conformance.json', import.meta.url), 'utf8')) as { cases: { name: string; schema: keyof Messages; raw: string; structural: boolean; semantic: boolean }[] };
for (const item of supplement.cases) test(`shared conformance: ${item.name}`, () => {
  assert.equal(validateStructure(item.schema, item.raw), item.structural);
  if (item.semantic) assert.doesNotThrow(() => parseMessage(item.schema, item.raw));
  else assert.throws(() => parseMessage(item.schema, item.raw));
});
test('RFC 8785 number and Unicode sorting vectors', () => {
  const value = { numbers: [333333333.33333329, 1e30, 4.50, 2e-3, 1e-27] };
  const expected = '{"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27]}';
  assert.equal(digest(value), `sha256:${createHash('sha256').update(expected).digest('hex')}`);
  const keys = { '\ufb33': 7, '😀': 6, '\u0080': 3, '€': 5, '1': 2, '\r': 1, 'ö': 4 };
  const sorted = '{"\\r":1,"1":2,"\u0080":3,"ö":4,"€":5,"😀":6,"דּ":7}';
  assert.equal(digest(keys), `sha256:${createHash('sha256').update(sorted).digest('hex')}`);
  assert.throws(() => digest({ text: '\ud800' }));
});
test('bounded JSON fails closed before any domain state is used', () => {
  assert.throws(() => parseJson('[]', 1), /RESOURCE_LIMIT/);
  assert.throws(() => parseJson('['.repeat(66) + '0' + ']'.repeat(66)), /RESOURCE_LIMIT/);
  assert.throws(() => parseJson('{"a":1,"\\u0061":2}'), /Duplicate/);
  assert.throws(() => parseJson('9007199254740991.1'), /exact safe integer/);
  assert.throws(() => parseJson('1e-999'), /exact safe integer/);
  assert.equal(parseJson('2.0'), 2);
});
test('precise timestamp comparison and lease upper bound', () => {
  assert.equal(compareTimes('2026-10-12T08:00:00.000000001Z', '2026-10-12T08:00:00.000000002Z'), -1);
  assert.equal(compareTimes('2026-10-12T08:00:00.1Z', '2026-10-12T08:00:00.1000Z'), 0);
  assert.equal(withinLease('2026-10-12T08:00:00.1Z', '2026-10-12T08:05:00.100000001Z', 300), false);
  assert.throws(() => compareTimes('2025-12-31T23:59:60Z', '2026-01-01T00:00:00Z'));
});
test('CIDR requires a network, proper prefix, and IP family', () => {
  for (const value of ['0.0.0.0/0', '10.0.0.0/24', '::/0', '2001:db8::/32']) assert.equal(validCidr(value), true);
  for (const value of ['10.0.0.1/24', '127.0.0.1/33', '::1/64', '10.0.0.0/024', '0.0.0.0/-1', 'invalid/24']) assert.equal(validCidr(value), false);
});
