import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRuntimeMessage } from '../src/adp3.ts';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { createRequire } from 'node:module';

const fixture=JSON.parse(readFileSync(new URL('../../../docs/protocol/fixtures/adp-v3-execution.json',import.meta.url),'utf8')) as {cases:{name:string;raw:string;valid:boolean}[]};
for(const item of fixture.cases)test(`execution extension TS conformance: ${item.name}`,()=>{
  if(item.valid)assert.doesNotThrow(()=>parseRuntimeMessage('Snapshot',item.raw));
  else assert.throws(()=>parseRuntimeMessage('Snapshot',item.raw));
});
test('legacy Runtime schema rejects the explicit execution extension',()=>{
  const ajv=new Ajv2020({strict:true});
  createRequire(import.meta.url)('ajv-formats')(ajv);
  const schema=JSON.parse(readFileSync(new URL('../../../docs/protocol/schemas/adp-v3-runtime.schema.json',import.meta.url),'utf8'));
  ajv.addSchema(schema);const validate=ajv.compile({$ref:schema.$id+'#/$defs/Snapshot'});
  assert.equal(validate(JSON.parse(fixture.cases.find(c=>c.name==='mixed-direct-relay-multihop')!.raw)),false);
});
