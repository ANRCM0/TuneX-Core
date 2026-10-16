import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePreflightArguments, rolePreflight } from '../preflight-role.mjs';

let temporary, materials;
before(() => {
  temporary = mkdtempSync(join(tmpdir(), 'tunex-preflight-'));
  const openssl = args => execFileSync('openssl', args, { cwd: temporary, stdio: 'pipe' });
  openssl(['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes',
    '-keyout', 'ca.key', '-out', 'ca.pem', '-days', '2', '-subj', '/CN=Preflight Test CA',
    '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign']);
  openssl(['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes',
    '-keyout', 'other-ca.key', '-out', 'other-ca.pem', '-days', '2', '-subj', '/CN=Foreign Test CA',
    '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign']);
  for (const [name, subject, extensions] of [
    ['server', 'control.example', 'subjectAltName=DNS:control.example,IP:127.0.0.1\nextendedKeyUsage=serverAuth'],
    ['node', 'node-1', 'extendedKeyUsage=clientAuth'],
    ['foreign', 'other-node', 'extendedKeyUsage=clientAuth'],
  ]) {
    openssl(['req', '-new', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes',
      '-keyout', name + '.key', '-out', name + '.csr', '-subj', '/CN=' + subject]);
    writeFileSync(join(temporary, name + '.ext'), 'basicConstraints=critical,CA:FALSE\nkeyUsage=digitalSignature\n' + extensions);
    openssl(['x509', '-req', '-in', name + '.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key',
      '-set_serial', String({ server: 2, node: 3, foreign: 4 }[name]), '-days', '1',
      '-extfile', name + '.ext', '-out', name + '.pem']);
  }
  materials = Object.fromEntries(['ca.key', 'ca.pem', 'other-ca.pem', 'server.key', 'server.pem', 'node.key',
    'node.pem', 'foreign.key', 'foreign.pem'].map(name => [name, readFileSync(join(temporary, name))]));
});
after(() => { if (temporary) rmSync(temporary, { recursive: true, force: true }); });

function fixture(role = 'control', phase = 'existing') {
  const root = resolve('preflight-test-fixture');
  const state = join(root, role, 'state'), trust = join(root, role, 'trust');
  const entries = new Map();
  const directory = path => entries.set(path, { type: 'directory', mode: 0o700, uid: 10001, gid: 10001 });
  const file = (path, raw, privateFile = true) => entries.set(path, {
    type: 'file', mode: privateFile ? 0o600 : 0o644, uid: 10001, gid: 10001, raw: Buffer.from(raw),
  });
  directory(state); directory(trust);
  const env = { TUNEX_CONTROL_URL: 'https://control.example:41001' };
  env[role === 'control' ? 'TUNEX_CONTROL_IMAGE' : 'TUNEX_AGENT_IMAGE'] =
    'registry.example:5000/tunex/' + role + '@sha256:' + 'a'.repeat(64);
  if (role === 'control') {
    Object.assign(env, { TUNEX_CONTROL_STATE_DIR: state, TUNEX_CONTROL_PKI_DIR: trust,
      TUNEX_DATABASE_URL: 'mysql://user:database-secret@database.example/tunex' });
    for (const name of ['ca.pem', 'ca.key', 'server.pem', 'server.key']) {
      file(join(trust, name), materials[name], name.endsWith('.key'));
    }
    if (phase === 'existing') {
      directory(join(state, 'authority')); directory(join(state, 'authority-secrets'));
      file(join(state, 'authority', 'state.json'), '{"protected":"service-verifies-mac"}');
      file(join(state, 'authority-secrets', 'key'), Buffer.alloc(32, 1));
    }
  } else {
    Object.assign(env, { TUNEX_AGENT_STATE_DIR: state, TUNEX_AGENT_SECRETS_DIR: trust, TUNEX_NODE_ID: 'node-1' });
    file(join(trust, 'control-ca.pem'), materials['ca.pem'], false);
    if (phase === 'existing') {
      file(join(state, 'node.pem'), materials['node.pem'], false);
      file(join(state, 'private.pem'), materials['node.key']);
      file(join(state, 'journal.json'), '{"protected":"agent-verifies-mac"}');
      file(join(trust, 'journal.key'), Buffer.alloc(32, 2));
    }
  }
  const io = {
    platform: 'linux',
    inspect: path => {
      const entry = entries.get(path);
      if (!entry) throw new Error('missing private filesystem path');
      return { real: entry.real ?? path, stat: {
        ...entry, size: entry.raw?.length ?? 0,
        isDirectory: () => entry.type === 'directory',
        isFile: () => entry.type === 'file',
        isSymbolicLink: () => entry.type === 'symlink',
      } };
    },
    read: path => entries.get(path).raw,
    list: path => [...entries.keys()].filter(name => name.startsWith(path + '/') ||
      name.startsWith(path + '\\')).map(name => name.slice(path.length + 1).split(/[\\/]/)[0]),
  };
  return { env, io, entries, state, trust, file, options: { role, phase },
    run() { return rolePreflight(env, this.options, io); } };
}
const failed = (report, code) => report.checks.some(c => c.status === 'failed' && c.code === code);

test('each existing role passes using only its own variables and real certificates', () => {
  for (const role of ['control', 'agent']) {
    const report = fixture(role).run();
    assert.equal(report.status, 'passed', JSON.stringify(report));
    assert.equal(report.scope, 'local-static');
    assert.equal(report.runtimeReady, false);
    assert.ok(report.checks.some(c => c.code === 'CLOCK_SYNC_UNCHECKED' && c.status === 'not-checked'));
    assert.ok(report.checks.some(c => c.code === 'PROTECTED_STATE_UNCHECKED'));
  }
});
test('initial setup checks differ from existing service requirements', () => {
  for (const role of ['control', 'agent']) {
    const setup = fixture(role, 'initial');
    assert.equal(setup.run().status, 'passed');
    setup.options.phase = 'existing';
    assert.equal(setup.run().status, 'rejected');
    assert.ok(failed(setup.run(), 'FILE_UNAVAILABLE'));
  }
});
test('initial phase refuses existing state and retained enrollment key', () => {
  const control = fixture('control');
  control.options.phase = 'initial';
  assert.ok(failed(control.run(), 'INITIAL_STATE_NOT_EMPTY'));
  const agent = fixture('agent', 'initial');
  agent.file(join(agent.trust, 'journal.key'), Buffer.alloc(32));
  assert.ok(failed(agent.run(), 'INITIAL_SECRETS_NOT_EMPTY'));
});
test('missing or unsupported role and phase reject without reading protected files', () => {
  const io = { inspect() { assert.fail('unexpected file read'); } };
  for (const options of [undefined, {}, { role: 'combined' }, { role: 'agent', phase: 'reset' }]) {
    assert.ok(failed(rolePreflight({}, options, io), 'INVALID_OPTIONS'));
  }
  assert.doesNotMatch(JSON.stringify(rolePreflight({}, { role: 'private-secret', phase: 'other-secret' }, io)),
    /private-secret|other-secret/);
});
test('a CLI origin cannot silently replace the configured service origin', () => {
  const setup = fixture('agent');
  setup.options.controlURL = 'https://different.example';
  assert.ok(failed(setup.run(), 'CONTROL_URL_CONFLICT'));
});
test('image tag and credential-bearing Control URL are rejected without reflecting values', () => {
  const setup = fixture();
  setup.env.TUNEX_CONTROL_IMAGE = 'tunex:latest';
  setup.env.TUNEX_CONTROL_URL = 'https://owner:url-secret@control.example';
  const report = setup.run();
  assert.ok(failed(report, 'IMMUTABLE_IMAGE_REQUIRED'));
  assert.ok(failed(report, 'CONTROL_URL_INVALID'));
  assert.doesNotMatch(JSON.stringify(report), /url-secret|database-secret|PRIVATE KEY/);
});
test('Control URL requires an origin and exact SAN; CN fallback is not accepted', () => {
  const setup = fixture();
  for (const url of ['http://control.example', 'https://control.example/agent', 'https://control.example/?token=secret']) {
    setup.env.TUNEX_CONTROL_URL = url;
    assert.ok(failed(setup.run(), 'CONTROL_URL_INVALID'));
  }
  setup.env.TUNEX_CONTROL_URL = 'https://other.example';
  assert.ok(failed(setup.run(), 'CONTROL_SAN_MISMATCH'));
  setup.env.TUNEX_CONTROL_URL = 'https://127.0.0.1';
  assert.equal(setup.run().status, 'passed');
  setup.file(join(setup.trust, 'server.pem'), materials['node.pem'], false);
  setup.env.TUNEX_CONTROL_URL = 'https://node-1';
  assert.ok(failed(setup.run(), 'CONTROL_SAN_MISMATCH'));
});
test('certificate expiry, future validity and wrong certificate purpose are rejected', () => {
  const setup = fixture();
  setup.io.now = () => Date.now() + 3 * 86400 * 1000;
  assert.ok(failed(setup.run(), 'CERTIFICATE_EXPIRED_OR_NOT_YET_VALID'));
  setup.io.now = () => Date.now() - 3 * 86400 * 1000;
  assert.ok(failed(setup.run(), 'CERTIFICATE_EXPIRED_OR_NOT_YET_VALID'));
  delete setup.io.now;
  setup.file(join(setup.trust, 'server.pem'), materials['node.pem'], false);
  assert.ok(failed(setup.run(), 'CERTIFICATE_PURPOSE'));
});
test('private key mismatch, malformed certificate and machine identity mismatch reject', () => {
  const setup = fixture('agent');
  setup.file(join(setup.state, 'private.pem'), materials['foreign.key']);
  assert.ok(failed(setup.run(), 'PRIVATE_KEY_MISMATCH'));
  setup.file(join(setup.state, 'node.pem'), materials['foreign.pem'], false);
  assert.ok(failed(setup.run(), 'NODE_IDENTITY_MISMATCH'));
  setup.file(join(setup.state, 'node.pem'), 'not a certificate: private-secret', false);
  const report = setup.run();
  assert.ok(failed(report, 'CERTIFICATE_INVALID'));
  assert.doesNotMatch(JSON.stringify(report), /private-secret/);
});
test('a leaf cannot replace the trusted CA', () => {
  const setup = fixture('agent');
  setup.file(join(setup.trust, 'control-ca.pem'), materials['foreign.pem'], false);
  const report = setup.run();
  assert.ok(failed(report, 'CERTIFICATE_PURPOSE'));
  assert.ok(failed(report, 'CERTIFICATE_TRUST_MISMATCH'));
});
test('an unrelated valid CA cannot authorize the enrolled machine certificate', () => {
  const setup = fixture('agent');
  setup.file(join(setup.trust, 'control-ca.pem'), materials['other-ca.pem'], false);
  const report = setup.run();
  assert.ok(failed(report, 'CERTIFICATE_TRUST_MISMATCH'));
  assert.ok(!failed(report, 'CERTIFICATE_PURPOSE'));
});
test('missing journal and wrong protection key size are detected without initialization', () => {
  const setup = fixture('agent');
  setup.entries.delete(join(setup.state, 'journal.json'));
  setup.file(join(setup.trust, 'journal.key'), Buffer.alloc(31));
  assert.ok(failed(setup.run(), 'FILE_UNAVAILABLE'));
  assert.ok(failed(setup.run(), 'PROTECTION_KEY_INVALID'));
  assert.equal(setup.entries.has(join(setup.state, 'journal.json')), false);
});
test('service UID access, private-file permissions and writable authority parent are checked', () => {
  const setup = fixture();
  setup.entries.get(setup.state).uid = 0;
  setup.entries.get(join(setup.trust, 'ca.key')).mode = 0o644;
  setup.entries.get(join(setup.state, 'authority')).mode = 0o500;
  const report = setup.run();
  assert.ok(failed(report, 'SERVICE_ACCESS_DENIED'));
  assert.ok(failed(report, 'PRIVATE_FILE_PERMISSIONS'));
  assert.ok(report.checks.some(c => c.code === 'SERVICE_ACCESS_DENIED' && c.subject.endsWith(':parent')));
});
test('directory overlap, write permissions and symlink traversal are refused', () => {
  const setup = fixture();
  setup.entries.get(setup.trust).real = join(setup.state, 'pki');
  setup.entries.get(setup.state).mode = 0o777;
  setup.entries.get(join(setup.state, 'authority')).type = 'symlink';
  const report = setup.run();
  assert.ok(failed(report, 'DIRECTORY_OVERLAP'));
  assert.ok(failed(report, 'UNSAFE_PERMISSIONS'));
  assert.ok(failed(report, 'UNSAFE_FILE_PATH'));
});
test('non-Linux inspection is incomplete instead of proving Linux container permissions', () => {
  const setup = fixture();
  setup.io.platform = 'win32';
  const report = setup.run();
  assert.equal(report.status, 'incomplete');
  assert.ok(report.checks.some(c => c.code === 'HOST_PERMISSIONS_UNCHECKED' && c.required));
});
test('file changes and exceptions never leak protected values', () => {
  const setup = fixture();
  setup.io.read = () => { throw new Error('password=do-not-leak'); };
  const report = setup.run();
  assert.equal(report.status, 'rejected');
  assert.doesNotMatch(JSON.stringify(report), /do-not-leak|database-secret/);
  setup.io.read = () => Buffer.alloc(0);
  assert.ok(failed(setup.run(), 'FILE_CHANGED'));
});
test('a retained authority initialization flag is rejected', () => {
  const setup = fixture();
  setup.env.TUNEX_AUTHORITY_INITIALIZE = '1';
  assert.ok(failed(setup.run(), 'INITIALIZATION_FLAG_RETAINED'));
});
test('argument parser rejects duplicate, missing and unknown options', () => {
  assert.deepEqual(parsePreflightArguments(['--role', 'agent', '--phase', 'initial', '--json']),
    { role: 'agent', phase: 'initial', json: true });
  for (const args of [['--role'], ['--reset'], ['--phase', 'initial', '--phase', 'existing'],
    ['--role', 'agent', '--role', 'control']]) assert.throws(() => parsePreflightArguments(args));
});
test('CLI entry point runs for an absolute path and returns redacted machine output', () => {
  const script = fileURLToPath(new URL('../preflight.mjs', import.meta.url));
  assert.match(execFileSync(process.execPath, [script, '--help'], { encoding: 'utf8' }), /Usage:/);
  try {
    execFileSync(process.execPath, [script, '--role', 'unsupported', '--json'], { encoding: 'utf8', stdio: 'pipe' });
    assert.fail('Invalid role must fail');
  } catch (error) {
    assert.equal(error.status, 1);
    const report = JSON.parse(error.stdout);
    assert.equal(report.status, 'rejected');
    assert.equal(report.runtimeReady, false);
  }
});
