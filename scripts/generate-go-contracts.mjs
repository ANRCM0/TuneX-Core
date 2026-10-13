import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const root = new URL('../', import.meta.url);
const capitalize = name => name[0].toUpperCase() + name.slice(1);
function typeOf(def) {
  if (def.$ref) return capitalize(def.$ref.split('/').at(-1));
  if (def.type === 'array') return `[]${typeOf(def.items)}`;
  if (def.type === 'string' || typeof def.const === 'string' || def.enum?.every(value => typeof value === 'string')) return 'string';
  if (def.type === 'boolean' || typeof def.const === 'boolean') return 'bool';
  if (def.type === 'integer' || typeof def.const === 'number') return 'uint64';
  if (def.oneOf?.every(part => part.type === 'string')) return 'string';
  if (def.anyOf?.some(part => part.type === 'null')) return `*${typeOf(def.anyOf.find(part => part.type !== 'null'))}`;
  throw new Error(`Unsupported contract schema: ${JSON.stringify(def)}`);
}
function generate(schemaPath, directory, packageName) {
const raw = readFileSync(new URL(schemaPath, root), 'utf8');
const schema = JSON.parse(raw);
let source = `// Code generated from ${schemaPath}. DO NOT EDIT.\npackage ${packageName}\n\n`;
for (const [name, def] of Object.entries(schema.$defs)) {
  if (def.type === 'object') {
    source += `type ${capitalize(name)} struct {\n`;
    for (const [key, field] of Object.entries(def.properties)) {
      let goType = typeOf(field);
      if (!def.required.includes(key) && !goType.startsWith('*')) goType = `*${goType}`;
      source += `  ${capitalize(key)} ${goType} \`json:"${key}${def.required.includes(key) ? '' : ',omitempty'}"\`\n`;
    }
    source += '}\n\n';
  } else source += `type ${capitalize(name)} = ${typeOf(def)}\n\n`;
}
const formatted = spawnSync('gofmt', [], { input: source, encoding: 'utf8' });
if (formatted.status !== 0) throw new Error(formatted.stderr || 'gofmt unavailable');
mkdirSync(new URL(directory, root), { recursive: true });
for (const [name, contents] of [['schema.json', raw], ['types_generated.go', formatted.stdout]]) {
  const path = new URL(`${directory}${name}`, root);
  if (process.argv.includes('--check')) {
    if (readFileSync(path, 'utf8').replaceAll('\r\n', '\n') !== contents.replaceAll('\r\n', '\n')) throw new Error(`Generated contract out of date: ${name}`);
  } else writeFileSync(path, contents);
}
}
generate('docs/protocol/schemas/adp-v2-direct.schema.json', 'agent/internal/contracts/', 'contracts');
generate('docs/protocol/schemas/native-relay-v1.schema.json', 'agent/internal/relaycontracts/', 'relaycontracts');
generate('docs/protocol/schemas/adp-v3-relay.schema.json', 'agent/internal/adp3relay/', 'adp3relay');
generate('docs/protocol/schemas/adp-v3-runtime.schema.json', 'agent/internal/adp3/', 'adp3');
console.log('Go schemas and types match authoritative ADP/2, ADP/3 Relay resources and Relay v1 contracts.');
