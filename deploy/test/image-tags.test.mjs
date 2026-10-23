import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { latestStableTag } from '../image-tags.mjs';

test('latest stable version uses numeric SemVer order independently of tag creation order', () => {
  assert.equal(latestStableTag(['v1.9.20', 'v1.10.0', 'v1.2.100', 'v0.99.99']), 'v1.10.0');
  assert.equal(latestStableTag(['v2.0.0', 'v1.999.999', 'v0.1.0']), 'v2.0.0');
  assert.equal(latestStableTag(['v0.1.0', 'v0.1.9', 'v0.1.10', 'v0.1.9']), 'v0.1.10');
});

test('prereleases, mutable aliases, leading-zero versions and malformed tags cannot own latest', () => {
  assert.equal(latestStableTag(['v0.1.0', 'v9.0.0-rc.1', 'v9.0.0+build', 'v09.0.0',
    'v9.00.0', 'v9.0.00', 'latest', 'dev', '9.0.0', 'v9.0', ' v9.0.0', 'v9.0.0\n']), 'v0.1.0');
  assert.equal(latestStableTag(['v0.0.0', 'v1.0.0-rc.1']), 'v0.0.0');
  assert.equal(latestStableTag([]), null);
  assert.equal(latestStableTag(['v0.1.0-rc.1', 'dev']), null);
});

test('large valid version components retain exact order without floating-point rounding', () => {
  assert.equal(latestStableTag(['v9007199254740993.0.0', 'v9007199254740992.999.999']),
    'v9007199254740993.0.0');
  assert.equal(latestStableTag(['v1.9007199254740993.0', 'v1.9007199254740992.999']),
    'v1.9007199254740993.0');
  assert.throws(() => latestStableTag(null), /Expected Git tag names/);
  assert.throws(() => latestStableTag(['v0.1.0', 1]), /Expected Git tag names/);
});

test('CLI accepts the actual newline-delimited Git output and fails closed without a stable tag', () => {
  const script = fileURLToPath(new URL('../image-tags.mjs', import.meta.url));
  const accepted = spawnSync(process.execPath, [script], {
    input: 'v0.1.0-rc.1\r\nv0.1.0\r\nv0.2.0\r\nv0.1.9\r\n', encoding: 'utf8',
  });
  assert.equal(accepted.status, 0);
  assert.equal(accepted.stdout, 'v0.2.0\n');
  for (const input of ['', 'v0.1.0-rc.1\n', 'x'.repeat(1024 * 1024 + 1)]) {
    const rejected = spawnSync(process.execPath, [script], { input, encoding: 'utf8' });
    assert.equal(rejected.status, 1);
    assert.equal(rejected.stdout, '');
  }
});
