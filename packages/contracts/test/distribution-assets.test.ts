import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, cpSync, symlinkSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { Ajv2020 } from 'ajv/dist/2020.js';

const sourceRoot = new URL('../../../packages/contracts/schemas/', import.meta.url);
const pairs = [
  ['adp-v2-direct', 'contracts/schema.json'], ['adp-v3-runtime', 'adp3/schema.json'],
  ['adp-v3-execution', 'adp3/execution.schema.json'], ['adp-v3-execution', 'adp3execution/schema.json'],
  ['native-relay-v1', 'relaycontracts/schema.json'], ['adp-v3-relay', 'adp3relay/schema.json'],
  ['transit-v1', 'transitcontracts/schema.json'], ['adp-v3-transit', 'adp3transit/schema.json'],
  ['adp-v3-transit-negotiation', 'transitnegotiation/schema.json'], ['adp-v3-transit-delivery', 'transitdelivery/schema.json'],
  ['probe-negotiation-v1', 'probenegotiation/schema.json'], ['probe-instance-v1', 'probeinstance/schema.json'],
  ['probe-claim-v1', 'probeclaim/schema.json'], ['probe-delivery-v1', 'probedelivery/schema.json'],
  ['probe-result-v1', 'proberesult/schema.json'], ['probe-types-v2', 'probetypes/schema.json'],
  ['probe-services-v3', 'probeservices/schema.json'], ['probe-echo-v4', 'probeecho/schema.json'],
] as const;

test('all native schema copies preserve source bytes modulo checkout line endings, including the separate execution generator output', () => {
  for (const [source, copy] of pairs) {
    const expected = readFileSync(new URL(source + '.schema.json', sourceRoot), 'utf8');
    const actual = readFileSync(new URL('../../../agent/internal/' + copy, import.meta.url), 'utf8');
    assert.equal(actual.replace(/\r\n/g, '\n'), expected.replace(/\r\n/g, '\n'), copy);
  }
});

test('all twenty-one schema resources compile every local definition without remote resolution', () => {
  const files = readdirSync(sourceRoot).filter(name => name.endsWith('.schema.json'));
  assert.equal(files.length, 21);
  const ids = new Set<string>();
  const addFormats: (ajv: Ajv2020) => void = createRequire(import.meta.url)('ajv-formats');
  for (const file of files) {
    const schema = JSON.parse(readFileSync(new URL(file, sourceRoot), 'utf8')) as { $id: string; $defs?: Record<string, unknown> };
    assert.equal(ids.has(schema.$id), false, file); ids.add(schema.$id);
    const ajv = new Ajv2020({ strict: true, allErrors: true }); addFormats(ajv); ajv.addSchema(schema);
    for (const name of Object.keys(schema.$defs ?? {})) {
      assert.doesNotThrow(() => ajv.compile({ $ref: schema.$id + '#/$defs/' + name }), file + ':' + name);
    }
  }
  assert.ok(ids.has('urn:tunex:adp:3:runtime'));
  assert.ok(ids.has('urn:tunex:adp:3:execution:1'));
  assert.ok(ids.has('urn:tunex:relay:1'));
  assert.ok(ids.has('urn:tunex:adp:3:relay'));
});

test('all eleven declared package entries initialize through their actual public export targets', async () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { exports: Record<string, string> };
  assert.equal(Object.keys(manifest.exports).length, 11);
  for (const [entry, target] of Object.entries(manifest.exports)) {
    const module = await import(new URL(target, new URL('../', import.meta.url)).href);
    assert.equal(typeof module, 'object', entry);
  }
});

test('staged native package initialization refuses missing or malformed schema/catalog while lower common entries remain loadable', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'tunex-contract-assets-'));
  const packageRoot = join(temporary, 'packages', 'contracts');
  try {
    mkdirSync(packageRoot, { recursive: true });
    writeFileSync(join(temporary, 'package.json'), '{"type":"module"}');
    cpSync(new URL('../src/', import.meta.url), join(packageRoot, 'src'), { recursive: true });
    cpSync(new URL('../data/', import.meta.url), join(packageRoot, 'data'), { recursive: true });
    const schemas = join(temporary, 'packages', 'contracts', 'schemas');
    mkdirSync(schemas, { recursive: true }); cpSync(sourceRoot, schemas, { recursive: true });
    symlinkSync(fileURLToPath(new URL('../../../node_modules/', import.meta.url)), join(temporary, 'node_modules'), 'junction');
    const run = (entries: string[]) => spawnSync(process.execPath, ['--input-type=module', '-e',
      'for (const entry of process.argv.slice(1)) await import(entry)',
      ...entries.map(entry => pathToFileURL(join(packageRoot, 'src', entry + '.ts')).href)], { encoding: 'utf8', timeout: 30000 });
    for (const [asset, pattern] of [
      [join(schemas, 'adp-v3-runtime.schema.json'), /adp-v3-runtime\.schema\.json/],
      [join(packageRoot, 'data', 'native-drivers-v1.json'), /native-drivers-v1\.json/],
    ] as const) {
      const saved = readFileSync(asset); rmSync(asset);
      const lower = run(['policy', 'execution-observation', 'execution-values']);
      assert.equal(lower.status, 0, lower.stderr);
      const absent = run(['runtime']);
      assert.notEqual(absent.status, 0); assert.match(absent.stderr, pattern);
      writeFileSync(asset, '{ malformed JSON');
      const malformed = run(['runtime']);
      assert.notEqual(malformed.status, 0); assert.match(malformed.stderr, /SyntaxError|INVALID_CONFIG|Unexpected|JSON/);
      writeFileSync(asset, saved);
    }
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
