import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const repository = fileURLToPath(new URL('../../../', import.meta.url));
const schemas = 'docs/protocol/schemas/';
const normalize = (value: string) => value.replaceAll('\r\n', '\n');
const generated = [
    ['adp-v2-direct', 'contracts', 'schema.json'],
    ['native-relay-v1', 'relaycontracts', 'schema.json'],
    ['adp-v3-relay', 'adp3relay', 'schema.json'],
    ['adp-v3-execution', 'adp3', 'execution.schema.json'],
    ['adp-v3-execution', 'adp3execution', 'schema.json'],
    ['probe-negotiation-v1', 'probenegotiation', 'schema.json'],
    ['probe-instance-v1', 'probeinstance', 'schema.json'],
    ['probe-claim-v1', 'probeclaim', 'schema.json'],
    ['probe-delivery-v1', 'probedelivery', 'schema.json'],
    ['probe-result-v1', 'proberesult', 'schema.json'],
] as const;
const entries = ['.', './shared', './policy', './execution-observation', './execution-values', './runtime',
    './probe', './observability', './experimental/transit', './legacy/adp2', './staged/probe-echo'];
const allNative = ['.'];
// This expectation is independently written from the public source graph. Type imports
// do not make an entry depend on the referenced family's native loader.
const dependencies: Record<string, string[]> = {
    'adp-v2-direct.schema.json': [...allNative, './shared', './runtime', './experimental/transit', './legacy/adp2'],
    'adp-v3-runtime.schema.json': [...allNative, './runtime'],
    'adp-v3-execution.schema.json': [...allNative, './runtime'],
    'native-relay-v1.schema.json': [...allNative, './runtime'],
    'adp-v3-relay.schema.json': [...allNative, './runtime'],
    'transit-v1.schema.json': [...allNative, './experimental/transit'],
    'adp-v3-transit.schema.json': [...allNative, './experimental/transit'],
    'adp-v3-transit-negotiation.schema.json': [...allNative, './experimental/transit'],
    'adp-v3-transit-delivery.schema.json': [...allNative, './experimental/transit'],
    'probe-negotiation-v1.schema.json': [...allNative, './probe'],
    'probe-instance-v1.schema.json': [...allNative, './probe'],
    'probe-claim-v1.schema.json': [...allNative, './probe'],
    'probe-delivery-v1.schema.json': [...allNative, './probe'],
    'probe-result-v1.schema.json': [...allNative, './probe'],
    'probe-types-v2.schema.json': [...allNative, './probe'],
    'probe-services-v3.schema.json': [...allNative, './probe', './staged/probe-echo'],
    'probe-echo-v4.schema.json': [...allNative, './staged/probe-echo'],
    'telemetry-v1.schema.json': [], 'forward-telemetry-v1.schema.json': [],
    'host-telemetry-v1.schema.json': [], 'probe-telemetry-v1.schema.json': [],
    'native-drivers-v1.json': [...allNative, './runtime'],
};
const invoke = (root: string, script: string, args: string[] = []) => spawnSync(process.execPath,
    [join(root, 'scripts', script), ...args], { cwd: root, encoding: 'utf8', timeout: 30000 });
const successful = (result: ReturnType<typeof invoke>, label: string) => {
    assert.equal(result.error, undefined, label);
    assert.equal(result.status, 0, label + '\n' + result.stderr + result.stdout);
};
function copy(root: string, path: string) {
    const target = join(root, path); mkdirSync(dirname(target), { recursive: true });
    cpSync(join(repository, path), target, { recursive: true });
}
function files(root: string, prefix = ''): Map<string, string> {
    const output = new Map<string, string>();
    for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
        const path = join(prefix, entry.name);
        if (entry.isDirectory()) for (const [key, value] of files(root, path)) output.set(key, value);
        else output.set(path, readFileSync(join(root, path), 'hex'));
    }
    return output;
}

test('the real schema generators check all ten exact schema/declaration targets and execution aliases without rewriting other source roles', () => {
    const root = mkdtempSync(join(tmpdir(), 'tunex-generator-matrix-'));
    try {
        copy(root, schemas);
        for (const name of ['generate-go-contracts.mjs', 'generate-multihop-schema.mjs']) copy(root, 'scripts/' + name);
        for (const [, owner, schema] of generated) {
            copy(root, `agent/internal/${owner}/${schema}`);
            copy(root, `agent/internal/${owner}/types_generated.go`);
        }
        const before = files(root);
        successful(invoke(root, 'generate-multihop-schema.mjs', ['--check']), 'separate execution schema');
        successful(invoke(root, 'generate-go-contracts.mjs', ['--check']), 'all ten generated schema/type pairs');
        assert.deepEqual(files(root), before, 'check mode preserves every staged byte');
        for (const [source, owner, schema] of generated) {
            assert.equal(normalize(readFileSync(join(root, `agent/internal/${owner}/${schema}`), 'utf8')),
                normalize(readFileSync(join(root, schemas + source + '.schema.json'), 'utf8')), owner);
        }
        const schema = JSON.parse(readFileSync(join(root, schemas + 'adp-v3-execution.schema.json'), 'utf8'));
        const aliases = normalize(readFileSync(join(root, 'agent/internal/adp3/types_generated.go'), 'utf8'));
        const expected = Object.keys(schema.$defs).map(name => {
            const capitalized = name[0]!.toUpperCase() + name.slice(1);
            return `type ${capitalized} = adp3execution.${capitalized}`;
        });
        assert.deepEqual(aliases.split('\n').filter(line => line.startsWith('type ')), expected,
            'every execution definition aliases the canonical execution owner, in schema order');
        assert.match(aliases, /import "github.com\/tunex\/vnext\/agent\/internal\/adp3execution"/);
        // A changed canonical declaration, alias or the otherwise unembedded generator
        // schema must each fail the actual generator, rather than a test-side replica.
        for (const path of ['agent/internal/adp3execution/types_generated.go',
            'agent/internal/adp3/types_generated.go', 'agent/internal/adp3execution/schema.json']) {
            const original = readFileSync(join(root, path));
            writeFileSync(join(root, path), original.toString('utf8') + '\n// incompatible\n');
            const result = invoke(root, 'generate-go-contracts.mjs', ['--check']);
            assert.equal(result.error, undefined);
            assert.notEqual(result.status, 0, path);
            assert.match(result.stderr, /Generated contract out of date/);
            writeFileSync(join(root, path), original);
        }
        assert.deepEqual(files(root), before);
    } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the actual Transit comparator accepts uniform checkout CRLF and rejects each parity and contract-only Runtime mutation', () => {
    const root = mkdtempSync(join(tmpdir(), 'tunex-transit-comparator-'));
    try {
        copy(root, 'scripts/check-transit-adp-schema.mjs');
        const pairs = [
            ['adp-v3-transit', 'adp3transit'], ['adp-v3-transit-negotiation', 'transitnegotiation'],
            ['adp-v3-transit-delivery', 'transitdelivery'],
        ];
        copy(root, schemas + 'adp-v3-runtime.schema.json');
        for (const [name, owner] of pairs) {
            copy(root, schemas + name + '.schema.json'); copy(root, `agent/internal/${owner}/schema.json`);
            const embedded = join(root, `agent/internal/${owner}/schema.json`);
            writeFileSync(embedded, normalize(readFileSync(embedded, 'utf8')).replaceAll('\n', '\r\n'));
        }
        successful(invoke(root, 'check-transit-adp-schema.mjs'), 'mixed LF/CRLF copies');
        for (const [, owner] of pairs) {
            const embedded = join(root, `agent/internal/${owner}/schema.json`), original = readFileSync(embedded);
            writeFileSync(embedded, original.toString('utf8') + '\n');
            assert.notEqual(invoke(root, 'check-transit-adp-schema.mjs').status, 0, owner + ' byte drift');
            writeFileSync(embedded, original);
        }
        const mutations: [string, string | null, (schema: any) => void][] = [
            ['adp-v3-runtime', null, schema => schema.$defs.assignment.properties.role.enum.push('relay-transit')],
            ['adp-v3-runtime', null, schema => schema.$defs.driver.properties.id.enum.push('native.transit.v1')],
            ['adp-v3-transit', 'adp3transit', schema => schema.$defs.Assignment.properties.extensionVersion.const = 2],
            ['adp-v3-transit', 'adp3transit', schema => schema.$defs.Snapshot.properties.kind.const = 'snapshot'],
            ['adp-v3-transit-negotiation', 'transitnegotiation', schema => schema.$defs.Response.properties.executionEnabled.const = true],
            ['adp-v3-transit-negotiation', 'transitnegotiation', schema => schema.$defs.Response.properties.state.const = 'active'],
            ['adp-v3-transit-delivery', 'transitdelivery', schema => schema.$defs.Command.properties.executionEnabled.const = true],
            ['adp-v3-transit-delivery', 'transitdelivery', schema => schema.$defs.Ack.properties.executionEnabled.const = true],
            ['adp-v3-transit-delivery', 'transitdelivery', schema => schema.$defs.Report.properties.condition.const = 'active'],
        ];
        for (const [name, owner, mutate] of mutations) {
            const source = join(root, schemas + name + '.schema.json'), original = readFileSync(source);
            const embedded = owner && join(root, `agent/internal/${owner}/schema.json`);
            const originalEmbedded = embedded && readFileSync(embedded);
            const changed = JSON.parse(original.toString('utf8')); mutate(changed);
            writeFileSync(source, JSON.stringify(changed)); if (embedded) writeFileSync(embedded, JSON.stringify(changed));
            assert.notEqual(invoke(root, 'check-transit-adp-schema.mjs').status, 0, name + ' semantic refusal');
            writeFileSync(source, original); if (embedded && originalEmbedded) writeFileSync(embedded, originalEmbedded);
        }
    } finally { rmSync(root, { recursive: true, force: true }); }
});

test('all eleven actual package entries preserve complete eager dependency failure and telemetry specification independence in the distributed COPY tree', () => {
    const root = mkdtempSync(join(tmpdir(), 'tunex-native-distribution-'));
    try {
        copy(root, 'packages/contracts'); copy(root, 'packages/core'); copy(root, schemas);
        copy(root, 'package.json'); copy(root, 'package-lock.json');
        const modules = join(root, 'node_modules'); mkdirSync(join(modules, '@tunex'), { recursive: true });
        for (const name of ['contracts', 'core']) symlinkSync(join(root, 'packages', name), join(modules, '@tunex', name), 'junction');
        for (const name of ['ajv', 'ajv-formats', 'canonicalize']) symlinkSync(join(repository, 'node_modules', name), join(modules, name), 'junction');
        const manifest = JSON.parse(readFileSync(join(root, 'packages/contracts/package.json'), 'utf8'));
        assert.deepEqual(Object.keys(manifest.exports), entries, 'all supported entries are explicitly classified');
        assert.deepEqual(readdirSync(join(root, schemas)).filter(name => name.endsWith('.schema.json')).sort(),
            Object.keys(dependencies).filter(name => name.endsWith('.schema.json')).sort(), 'all twenty-one source roles');
        const runner = join(root, 'matrix.mjs');
        writeFileSync(runner, `import assert from 'node:assert/strict';
const expected = JSON.parse(process.argv[2]);
for (const [entry, fails] of Object.entries(expected)) {
    let failure;
    try { await import('@tunex/contracts' + (entry === '.' ? '' : entry.slice(1))); } catch (error) { failure = error; }
    assert.equal(Boolean(failure), fails, entry + ': ' + String(failure));
    if (fails) assert.match(String(failure), /ENOENT|JSON|Unexpected|SyntaxError|INVALID_CONFIG|schema|reference|ref /i);
}
`);
        const run = (failed: string[]) => spawnSync(process.execPath, [runner,
            JSON.stringify(Object.fromEntries(entries.map(entry => [entry, failed.includes(entry)])))],
            { cwd: root, encoding: 'utf8', timeout: 30000 });
        successful(run([]), 'all package exports initialize with original assets');
        for (const [asset, affected] of Object.entries(dependencies)) {
            const path = asset === 'native-drivers-v1.json' ? join(root, 'packages/contracts/data', asset) : join(root, schemas, asset);
            const original = readFileSync(path);
            try {
                rmSync(path); successful(run(affected), asset + ': missing dependency matrix');
                writeFileSync(path, '{ malformed JSON'); successful(run(affected), asset + ': malformed dependency matrix');
                // Valid JSON with missing definitions exercises actual eager schema compilation,
                // distinct from JSON syntax refusal; catalog semantic refusal is also retained.
                writeFileSync(path, '{}'); successful(run(affected), asset + ': invalid schema/catalog matrix');
            } finally { writeFileSync(path, original); }
        }
        // Removing all native assets together leaves the four handwritten telemetry
        // parsers and three lower common public imports independently loadable.
        for (const asset of Object.keys(dependencies)) {
            const path = asset === 'native-drivers-v1.json' ? join(root, 'packages/contracts/data', asset) : join(root, schemas, asset);
            rmSync(path);
        }
        successful(run(entries.filter(entry => !['./policy', './execution-observation', './execution-values', './observability'].includes(entry))),
            'three lower common entries and handwritten observability require no native assets');
    } finally { rmSync(root, { recursive: true, force: true }); }
});
