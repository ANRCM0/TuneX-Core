import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { createApp } from '../src/api/app.ts';
import { ControlError } from '../src/framework/public.ts';
import type { ControlApplication } from '../src/application/control.ts';
import type { RuntimeController } from '../src/modules/runtime/controller.ts';
import type { AuthorityStore } from '../src/infrastructure/authority.ts';

test('every distributed Web JavaScript leaf is served byte-exactly with security headers and fixed-path refusal', async () => {
  const control = { identity: { authenticate: async () => { throw new ControlError('UNAUTHENTICATED', 401, 'identity required'); } } } as unknown as ControlApplication;
  const authority = { allow: async () => undefined, read: async () => ({ maintenance: false }) } as unknown as AuthorityStore;
  const app = createApp(control, {} as RuntimeController, authority);
  const root = new URL('../../web/', import.meta.url);
  async function leaves(directory: URL, prefix = ''): Promise<string[]> {
    const files: string[] = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === 'test') continue;
      if (entry.isDirectory()) files.push(...await leaves(new URL(entry.name + '/', directory), prefix + entry.name + '/'));
      else if (entry.name.endsWith('.js')) files.push(prefix + entry.name);
    }
    return files;
  }
  const paths = await leaves(root);
  assert.ok(paths.includes('rule-command-owner/service.js'));
  assert.ok(paths.includes('browser-native/control-console.js'));
  for (const path of paths) {
    const response = await app.request('/console/' + path);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('content-type'), 'text/javascript; charset=utf-8', path);
    assert.equal(response.headers.get('cache-control'), 'no-store', path);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff', path);
    assert.equal(response.headers.get('x-frame-options'), 'DENY', path);
    assert.match(response.headers.get('content-security-policy') ?? '', /connect-src 'self'/, path);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(new URL(path, root)), path);
  }
  for (const path of ['future.js', 'console-model-owner/private.js', 'browser-native/future.js']) {
    assert.equal((await app.request('/console/' + path)).status, 404, path);
  }
});
