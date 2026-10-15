import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseTransitIntent } from '../src/transit.ts';
import { parseRelayAssignment } from '../src/relay.ts';

const vector = JSON.parse(readFileSync(new URL('../../../docs/protocol/fixtures/transit-v1.json',import.meta.url),'utf8')) as {
 cases: {name:string;raw:string;valid:boolean}[];
};
for (const sample of vector.cases) {
 test(`shared proposed Transit v1: ${sample.name}`, () => {
  if (sample.valid) {
   const value = parseTransitIntent(sample.raw);
   assert.equal(value.role, 'relay-transit');
   assert.equal(value.driver, 'native.transit.v1');
   assert.ok(Object.isFrozen(value));
   assert.ok(Object.isFrozen(value.upstream));
   assert.ok(Object.isFrozen(value.downstream.endpoint));
  } else assert.throws(() => parseTransitIntent(sample.raw));
 });
}
test('existing ADP/3 runtime and Relay assignment parsers do not admit Transit intents', () => {
 const raw = JSON.parse(vector.cases[0]!.raw);
 assert.throws(() => parseRelayAssignment('Assignment', JSON.stringify(raw)));
 // A role spoof on a known-good deployed Relay contract must also fail.
 const old = JSON.parse(readFileSync(new URL('../../../docs/protocol/fixtures/adp-v3-relay.json',import.meta.url),'utf8'));
 const assignment = JSON.parse(old.cases.find((v:{name:string})=>v.name==='assignment-structure').raw);
 assignment.role = 'relay-transit';
 assignment.driver.config.role = 'relay-transit';
 assert.throws(()=>parseRelayAssignment('Assignment',JSON.stringify(assignment)));
});
