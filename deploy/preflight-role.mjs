import { X509Certificate, createPrivateKey } from 'node:crypto';
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, readdirSync, realpathSync } from 'node:fs';
import { isIP } from 'node:net';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

const digest = /^([a-zA-Z0-9._-]+(?::[0-9]+)?\/)?[a-zA-Z0-9._/-]+@sha256:[a-f0-9]{64}$/;
const nodeId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const service = Object.freeze({ uid: 10001, gid: 10001 });
const defaults = {
  inspect: path => ({ stat: lstatSync(path), real: realpathSync(path) }),
  read: (path, maximum) => {
    const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    try {
      const stat = fstatSync(fd);
      if (!stat.isFile() || stat.size > maximum) throw new Error();
      const buffer = Buffer.alloc(Math.min(stat.size, maximum) + 1);
      let length = 0;
      while (length < buffer.length) {
        const received = readSync(fd, buffer, length, buffer.length - length, null);
        if (received === 0) break;
        length += received;
      }
      if (length > maximum) throw new Error();
      return buffer.subarray(0, length);
    } finally {
      closeSync(fd);
    }
  },
  list: path => readdirSync(path),
  platform: process.platform,
  now: () => Date.now(),
};

function inside(parent, child) {
  const path = relative(parent, child);
  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith('..' + sep));
}

function accessBits(stat) {
  return stat.uid === service.uid ? (stat.mode >> 6) & 7 :
    stat.gid === service.gid ? (stat.mode >> 3) & 7 : stat.mode & 7;
}

// Only fixed labels and messages leave this function. Filesystem/crypto errors
// may contain protected paths or values and are never included in the report.
export function rolePreflight(env, options, dependencies = {}) {
  const io = { ...defaults, ...dependencies };
  const checks = [];
  const add = (code, status, subject, message, required = true) =>
    checks.push({ code, status, subject, message, required });
  const fail = (code, subject, message) => add(code, 'failed', subject, message);
  const pass = (code, subject, message) => add(code, 'passed', subject, message);
  const unchecked = (code, subject, message, required = false) =>
    add(code, 'not-checked', subject, message, required);
  const finish = () => ({
    version: 1, scope: 'local-static',
    role: ['control', 'agent'].includes(options?.role) ? options.role : null,
    phase: ['initial', 'existing'].includes(options?.phase ?? 'existing') ? options?.phase ?? 'existing' : null,
    service,
    status: checks.some(c => c.status === 'failed') ? 'rejected' :
      checks.some(c => c.required && c.status === 'not-checked') ? 'incomplete' : 'passed',
    runtimeReady: false, checks,
  });
  const role = options?.role, phase = options?.phase ?? 'existing';
  if (!['control', 'agent'].includes(role) || !['initial', 'existing'].includes(phase)) {
    fail('INVALID_OPTIONS', 'arguments', 'Select control or agent and initial or existing phase');
    return finish();
  }
  const now = io.now();
  if (!Number.isFinite(now)) {
    fail('INVALID_CLOCK', 'local-time', 'Local certificate comparison time is unavailable');
    return finish();
  }
  if (io.platform !== 'linux') {
    unchecked('HOST_PERMISSIONS_UNCHECKED', 'filesystem',
      'Run on the Linux deployment host; POSIX modes cannot prove container access here', true);
  }

  function permissions(stat, subject, requested, sensitive = false) {
    if (io.platform !== 'linux') return;
    if (![stat.mode, stat.uid, stat.gid].every(Number.isSafeInteger)) {
      unchecked('HOST_PERMISSIONS_UNCHECKED', subject, 'POSIX ownership and mode are unavailable', true);
      return;
    }
    if ((stat.mode & 0o022) !== 0) {
      fail('UNSAFE_PERMISSIONS', subject, 'Group/world write permission is not allowed');
    }
    if ((accessBits(stat) & requested) !== requested) {
      fail('SERVICE_ACCESS_DENIED', subject, 'Required mode bits for service UID/GID 10001 are missing');
    }
    if (sensitive && ((stat.mode & 0o077) !== 0 || stat.uid !== service.uid)) {
      fail('PRIVATE_FILE_PERMISSIONS', subject, 'Protected files require service ownership and owner-only access');
    }
  }

  function directory(variable, writable) {
    const path = env[variable];
    if (typeof path !== 'string' || !isAbsolute(path)) {
      fail('ABSOLUTE_DIRECTORY_REQUIRED', variable, 'An absolute existing directory is required');
      return null;
    }
    try {
      const inspected = io.inspect(path);
      if (!inspected.stat.isDirectory() || inspected.stat.isSymbolicLink()) {
        fail('REAL_DIRECTORY_REQUIRED', variable, 'An existing directory, not a symlink, is required');
        return null;
      }
      permissions(inspected.stat, variable, writable ? 7 : 5);
      pass('DIRECTORY_FOUND', variable, 'Directory exists');
      return { path: resolve(path), real: inspected.real, subject: variable };
    } catch {
      fail('DIRECTORY_UNAVAILABLE', variable, 'Cannot inspect the directory');
      return null;
    }
  }

  function disjoint(first, second) {
    if (first && second && (inside(first.real, second.real) || inside(second.real, first.real))) {
      fail('DIRECTORY_OVERLAP', 'mounts', 'State and trust/secret directories must be disjoint');
    }
  }

  function file(root, name, sensitive = false, maxBytes = 256 * 1024, writableParent = false) {
    if (!root) return null;
    const subject = root.subject + '/' + name;
    try {
      const path = join(root.path, name), expected = join(root.real, name);
      const parts = name.split('/');
      for (let length = 1; length < parts.length; length++) {
        const parent = io.inspect(join(root.path, ...parts.slice(0, length)));
        if (!parent.stat.isDirectory() || parent.stat.isSymbolicLink() ||
            parent.real !== join(root.real, ...parts.slice(0, length))) {
          fail('UNSAFE_FILE_PATH', subject, 'Protected paths cannot traverse symlinks');
          return null;
        }
        permissions(parent.stat, subject + ':parent', writableParent ? 7 : 5);
      }
      const { stat, real } = io.inspect(path);
      if (!stat.isFile() || stat.isSymbolicLink() || real !== expected) {
        fail('REGULAR_FILE_REQUIRED', subject, 'A regular file inside the mounted directory is required');
        return null;
      }
      permissions(stat, subject, 4, sensitive);
      if (!Number.isSafeInteger(stat.size) || stat.size < 1 || stat.size > maxBytes) {
        fail('INVALID_FILE_SIZE', subject, 'File is empty or exceeds its supported size');
        return null;
      }
      const value = io.read(path, maxBytes);
      if (!Buffer.isBuffer(value) || value.length !== stat.size) {
        fail('FILE_CHANGED', subject, 'File changed during inspection; inspect again while configuration is stable');
        return null;
      }
      pass('FILE_FOUND', subject, 'Required file is present and bounded');
      return value;
    } catch {
      fail('FILE_UNAVAILABLE', subject, 'Cannot inspect or read the required file');
      return null;
    }
  }

  function certificate(root, name, ca = false) {
    const bytes = file(root, name);
    if (!bytes) return null;
    try {
      const certificate = new X509Certificate(bytes);
      if (certificate.ca !== ca) {
        fail('CERTIFICATE_PURPOSE', name, ca ? 'A CA certificate is required' : 'A leaf certificate is required');
      }
      const start = Date.parse(certificate.validFrom), end = Date.parse(certificate.validTo);
      if (!Number.isFinite(start) || !Number.isFinite(end) || now < start || now >= end) {
        fail('CERTIFICATE_EXPIRED_OR_NOT_YET_VALID', name, 'Certificate is outside its validity interval');
      } else {
        pass('CERTIFICATE_TIME_VALID', name, 'Certificate is valid at the local comparison time');
      }
      return certificate;
    } catch {
      fail('CERTIFICATE_INVALID', name, 'Cannot parse the configured certificate');
      return null;
    }
  }

  function privateKey(root, name, certificate) {
    const bytes = file(root, name, true);
    if (!bytes || !certificate) return;
    try {
      if (!certificate.checkPrivateKey(createPrivateKey(bytes))) {
        fail('PRIVATE_KEY_MISMATCH', name, 'Private key does not match its certificate');
      } else {
        pass('PRIVATE_KEY_MATCHED', name, 'Private key matches its certificate');
      }
    } catch {
      fail('PRIVATE_KEY_INVALID', name, 'Cannot read the unencrypted service private key');
    }
  }

  function signedBy(certificate, ca, purpose, name) {
    if (!certificate || !ca) return;
    try {
      if (!certificate.checkIssued(ca) || !certificate.verify(ca.publicKey)) {
        fail('CERTIFICATE_TRUST_MISMATCH', name, 'Leaf certificate is not signed by the configured CA');
      } else {
        pass('CERTIFICATE_SIGNATURE_VALID', name, 'Leaf certificate signature matches the configured CA');
      }
      if (certificate.keyUsage?.length &&
          !certificate.keyUsage.includes(purpose) && !certificate.keyUsage.includes('2.5.29.37.0')) {
        fail('CERTIFICATE_PURPOSE', name, 'Certificate extended key usage does not allow this role');
      }
    } catch {
      fail('CERTIFICATE_TRUST_MISMATCH', name, 'Cannot verify the certificate against the configured CA');
    }
  }

  function controlURL() {
    try {
      if (options.controlURL && env.TUNEX_CONTROL_URL && options.controlURL !== env.TUNEX_CONTROL_URL) {
        fail('CONTROL_URL_CONFLICT', 'Control URL', 'The override must match the configured service origin');
        return null;
      }
      const text = options.controlURL ?? env.TUNEX_CONTROL_URL;
      if (typeof text !== 'string' || text.length > 2048) throw new Error();
      const url = new URL(text);
      if (url.protocol !== 'https:' || !url.hostname || url.username || url.password ||
          url.pathname !== '/' || url.search || url.hash) throw new Error();
      pass('CONTROL_URL_VALID', 'Control URL', 'An HTTPS origin without credentials is configured');
      return url;
    } catch {
      fail('CONTROL_URL_INVALID', 'Control URL', 'Provide the actual HTTPS Control origin without credentials, path or query');
      return null;
    }
  }

  const image = role === 'control' ? 'TUNEX_CONTROL_IMAGE' : 'TUNEX_AGENT_IMAGE';
  if (typeof env[image] !== 'string' || env[image].trim() !== env[image] || !digest.test(env[image])) {
    fail('IMMUTABLE_IMAGE_REQUIRED', image, 'An immutable registry @sha256 digest is required');
  } else pass('IMMUTABLE_IMAGE_CONFIGURED', image, 'Registry digest is configured; publication is not checked');

  const state = directory(role === 'control' ? 'TUNEX_CONTROL_STATE_DIR' : 'TUNEX_AGENT_STATE_DIR', true);
  const trust = directory(role === 'control' ? 'TUNEX_CONTROL_PKI_DIR' : 'TUNEX_AGENT_SECRETS_DIR',
    role === 'agent' && phase === 'initial');
  disjoint(state, trust);
  if (phase === 'initial' && state) {
    try {
      if (io.list(state.path).length !== 0) {
        fail('INITIAL_STATE_NOT_EMPTY', state.subject, 'Initial setup requires an empty state directory; never erase existing state');
      } else pass('INITIAL_STATE_EMPTY', state.subject, 'No existing local state was found; database freshness is not established');
    } catch {
      fail('DIRECTORY_UNAVAILABLE', state.subject, 'Cannot inspect initial state directory contents');
    }
  }
  const url = controlURL();
  if (role === 'control') {
    try {
      const database = new URL(env.TUNEX_DATABASE_URL);
      if (database.protocol !== 'mysql:' || !database.hostname || database.pathname.length < 2) throw new Error();
      pass('DATABASE_URL_VALID', 'TUNEX_DATABASE_URL', 'A MySQL database is configured; connectivity and contents are not checked');
    } catch {
      fail('DATABASE_URL_INVALID', 'TUNEX_DATABASE_URL', 'A MySQL URL with an explicit database is required');
    }
    if (env.TUNEX_AUTHORITY_INITIALIZE === '1') {
      fail('INITIALIZATION_FLAG_RETAINED', 'TUNEX_AUTHORITY_INITIALIZE', 'Do not retain one-time initialization in the service environment');
    }
    const ca = certificate(trust, 'ca.pem', true);
    const server = certificate(trust, 'server.pem');
    privateKey(trust, 'ca.key', ca);
    privateKey(trust, 'server.key', server);
    signedBy(server, ca, '1.3.6.1.5.5.7.3.1', 'server.pem');
    if (server && url) {
      const host = url.hostname.replace(/^\[|\]$/g, '');
      try {
        const matched = isIP(host) ? server.checkIP(host) :
          server.checkHost(host, { subject: 'never', wildcards: false });
        if (!matched) fail('CONTROL_SAN_MISMATCH', 'server.pem', 'Certificate SAN does not match the configured Control host');
        else pass('CONTROL_SAN_MATCHED', 'server.pem', 'Certificate SAN matches the configured Control host');
      } catch {
        fail('CONTROL_SAN_MISMATCH', 'server.pem', 'Cannot match the configured Control host against the certificate SAN');
      }
    }
    if (phase === 'existing') {
      file(state, 'authority/state.json', true, 16384, true);
      const key = file(state, 'authority-secrets/key', true, 32);
      if (key && key.length !== 32) fail('PROTECTION_KEY_INVALID', 'Authority key', 'Protection key must contain exactly 32 bytes');
    }
  } else {
    if (typeof env.TUNEX_NODE_ID !== 'string' || env.TUNEX_NODE_ID.trim() !== env.TUNEX_NODE_ID ||
        !nodeId.test(env.TUNEX_NODE_ID)) fail('NODE_ID_INVALID', 'TUNEX_NODE_ID', 'A registered Node ID is required');
    const ca = certificate(trust, 'control-ca.pem', true);
    if (phase === 'existing') {
      const node = certificate(state, 'node.pem');
      privateKey(state, 'private.pem', node);
      signedBy(node, ca, '1.3.6.1.5.5.7.3.2', 'node.pem');
      if (node && node.toLegacyObject().subject?.CN !== env.TUNEX_NODE_ID) {
        fail('NODE_IDENTITY_MISMATCH', 'node.pem', 'Machine certificate identity differs from the configured Node');
      }
      file(state, 'journal.json', true, 6 * 1024 * 1024);
      const key = file(trust, 'journal.key', true, 32);
      if (key && key.length !== 32) fail('PROTECTION_KEY_INVALID', 'Journal key', 'Protection key must contain exactly 32 bytes');
    } else if (trust) {
      try {
        if (io.list(trust.path).some(name => name !== 'control-ca.pem')) {
          fail('INITIAL_SECRETS_NOT_EMPTY', trust.subject, 'Enrollment secrets directory may contain only the trusted Control CA');
        }
      } catch {
        fail('DIRECTORY_UNAVAILABLE', trust.subject, 'Cannot inspect enrollment secrets directory contents');
      }
    }
    unchecked('REMOTE_TLS_UNCHECKED', 'Control TLS', 'No connection was made; remote SAN, mTLS and reachability remain unverified');
  }
  unchecked('PROTECTED_STATE_UNCHECKED', 'protected state', 'Presence is checked; the service must authenticate state and enforce its high-water');
  unchecked('CLOCK_SYNC_UNCHECKED', 'clock', 'No OS synchronization check was run; local wall time is not synchronization evidence');
  unchecked('MOUNTS_UNCHECKED', 'mounts', 'Actual mount flags, ACLs, labels and UID mappings must be checked on the deployment host');
  unchecked('NETWORK_UNCHECKED', 'network', 'No sockets, database connection, listener or end-to-end traffic was tested');
  return finish();
}

export function parsePreflightArguments(args) {
  const options = { phase: 'existing', json: false };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const name = args[i];
    if (seen.has(name)) throw new Error('INVALID_OPTIONS');
    seen.add(name);
    if (name === '--json' || name === '--help') {
      options[name.slice(2)] = true;
    } else if (['--role', '--phase', '--control-url'].includes(name)) {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error('INVALID_OPTIONS');
      const key = name === '--control-url' ? 'controlURL' : name.slice(2);
      options[key] = value;
    } else throw new Error('INVALID_OPTIONS');
  }
  return options;
}
