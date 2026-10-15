import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const ts = readFileSync(new URL('../docs/protocol/schemas/adp-v3-transit.schema.json', import.meta.url), 'utf8');
const go = readFileSync(new URL('../agent/internal/adp3transit/schema.json', import.meta.url), 'utf8');
assert.equal(go.replaceAll('\r\n','\n'), ts.replaceAll('\r\n','\n'),
  'Embedded Go Transit ADP/3 schema differs from the authoritative contract');

const runtime = JSON.parse(readFileSync(new URL('../docs/protocol/schemas/adp-v3-runtime.schema.json', import.meta.url), 'utf8'));
assert.equal(runtime.$defs.assignment.properties.role.enum.includes('relay-transit'), false,
  'Production Runtime Assignment accidentally admitted Transit');
assert.equal(runtime.$defs.driver.properties.id.enum.includes('native.transit.v1'), false,
  'Production Runtime driver accidentally admitted Transit');
const transit = JSON.parse(ts);
assert.equal(transit.$defs.Assignment.properties.extensionVersion.const, 1);
assert.equal(transit.$defs.Snapshot.properties.kind.const, 'transit-snapshot');
const negotiation=readFileSync(new URL('../docs/protocol/schemas/adp-v3-transit-negotiation.schema.json',import.meta.url),'utf8');
const embedded=readFileSync(new URL('../agent/internal/transitnegotiation/schema.json',import.meta.url),'utf8');
assert.equal(embedded.replaceAll('\\r\\n','\\n'),negotiation.replaceAll('\\r\\n','\\n'),
  'Transit mTLS negotiation Go schema differs');
const response=JSON.parse(negotiation).$defs.Response;
assert.equal(response.properties.executionEnabled.const,false);
assert.equal(response.properties.state.const,'contract-only');
console.log('Transit contract-only mTLS negotiation parity and runtime isolation verified.');
