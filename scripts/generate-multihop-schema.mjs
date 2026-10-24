import {readFileSync, writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const schema = JSON.parse(readFileSync(new URL('packages/contracts/schemas/adp-v3-runtime.schema.json', root), 'utf8'));
schema.$id = 'urn:tunex:adp:3:execution:1';
schema.title = 'ADP/3 complete mixed execution extension 1';
schema.description = 'Explicit opt-in mixed Direct/Relay/multi-hop snapshots; old Runtime schemas reject this extension.';
const d = schema.$defs;
const ref = name => ({$ref: `#/$defs/${name}`});
const object = properties => ({type: 'object', additionalProperties: false, properties, required: Object.keys(properties)});
d.hopNode = object({nodeId: ref('id'), assignmentId: ref('id'), sessionEpoch: ref('counter'),
  bindingFence: ref('counter'), peerFingerprint: ref('digest'), listenAddress: {type: 'string', minLength: 2, maxLength: 128},
  host: {type: 'string', minLength: 1, maxLength: 253}, port: {type: 'integer', minimum: 1, maximum: 65535}});
d.hopConfig = object({scopeId: ref('id'), forwardId: ref('id'), forwardRevision: ref('counter'),
  deploymentGeneration: ref('counter'), profileId: ref('id'), profileRevision: ref('counter'),
  profileDigest: ref('digest'), pathDigest: ref('digest'), protocol: ref('protocol'),
  hopIndex: {type: 'integer', minimum: 0, maximum: 7},
  path: {type: 'array', minItems: 3, maxItems: 8, items: ref('hopNode')},
  profile: ref('ProfileConfig'), target: ref('target'), egressPolicyRevision: ref('counter'),
  allowedDestinationCidrs: d.directConfig.properties.allowedDestinationCidrs,
  allowMetadataTargets: {type: 'boolean'}});
d.multihopConfig = object({hop: ref('hopConfig')});
d.runtimeConfig.properties.hop = ref('hopConfig');
d.runtimeConfig.oneOf.push(ref('multihopConfig'));
d.driver.properties.id.enum.push('native.multihop.v1');
d.driver.oneOf.push({properties: {id: {const: 'native.multihop.v1'}, config: ref('multihopConfig')}, required: ['id', 'config']});
const roles = ['multihop-ingress', 'multihop-transit', 'multihop-egress'];
d.assignment.properties.role.enum.push(...roles);
d.tombstone.properties.role.enum.push(...roles);
d.Snapshot.properties.executionExtension = {const: 1};
d.Snapshot.required.push('executionExtension');
const output = new URL('packages/contracts/schemas/adp-v3-execution.schema.json', root);
const raw = JSON.stringify(schema, null, 2) + '\n';
if (process.argv.includes('--check')) assert.equal(readFileSync(output, 'utf8').replaceAll('\r\n', '\n'), raw);
else writeFileSync(output, raw);
