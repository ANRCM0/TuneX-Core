#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const failures = [];
async function files(relative) {
  let entries;
  try { entries = await readdir(resolve(root, relative), { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const found = [];
  for (const entry of entries) {
    if (['node_modules', 'dist', '.next', '__pycache__', 'evidence'].includes(entry.name)) continue;
    const path = `${relative}/${entry.name}`;
    if (entry.isDirectory()) found.push(...await files(path));
    else if (entry.isFile()) found.push(path);
  }
  return found;
}
for (const removed of ['third_party/forwardx', 'agent/internal/linkrunner', 'backend/src/integrations/forwardx']) {
  if ((await files(removed)).length) failures.push(`${removed}: active retired source exists`);
}
const forbidden = /TUNEX_FXP_[A-Z_]+|TUNEX_TEST_FXP_BINARY|forwardx-fxp|tunex-fxp|forward\.link\.fxp\.v1|compileFxpLink|(?:from\s*["'][^"']*|github\.com\/tunex\/agent\/internal\/)linkrunner|integrations\/forwardx/;
const active = ['Dockerfile', 'agent/Dockerfile', 'backend/Dockerfile', '.env.example', '.env.production.example',
  'docker-compose.yaml', 'docker-compose.prod.yaml', 'docker-compose.standalone.yaml',
  'backend/prisma/schema.prisma', 'backend/package.json', 'backend/bun.lock', 'web/package.json', 'web/package-lock.json',
  ...await files('.github'), ...await files('agent'), ...await files('backend/src'), ...await files('backend/tests'),
  ...await files('web/src'), ...await files('shared'), ...await files('scripts')];
for (const path of active) {
  if (path === 'scripts/ci/native-dependency-check.mjs') continue;
  if (!/\.(?:go|ts|tsx|mjs|js|sh|py|ya?ml|json|lock|prisma)$/.test(path) && !/Dockerfile$|\.example$/.test(path)) continue;
  const source = await readFile(resolve(root, path), 'utf8');
  if (forbidden.test(source)) failures.push(`${path}: retired runtime dependency`);
}
for (const path of ['.gitignore', '.dockerignore']) {
  const source = await readFile(resolve(root, path), 'utf8');
  if (!/^Forwardx\/$/m.test(source)) failures.push(`${path}: reference checkout is not excluded`);
}
const module = await readFile(resolve(root, 'agent/go.mod'), 'utf8');
if (/^\s*(?:require|replace)\b/m.test(module)) failures.push('agent/go.mod: Agent must remain standard-library-only');
if (failures.length) { for (const issue of failures) console.error(issue); process.exitCode = 1; }
else console.log(`native dependency audit passed (${active.length} active files; historical notices retained)`);
