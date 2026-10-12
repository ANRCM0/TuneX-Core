import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
function files(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap(entry => {
    const full = resolve(path, entry.name);
    if (['node_modules', '.cache', 'bin'].includes(entry.name)) return [];
    return entry.isDirectory() ? files(full) : [full];
  });
}
for (const file of files(resolve(root, 'packages/core/src'))) {
  const source = readFileSync(file, 'utf8');
  const references = [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\()\s*['"]([^'"]+)['"]/g)];
  for (const [, name] of references) {
    if (!name.startsWith('./') || !resolve(dirname(file), name).startsWith(resolve(root, 'packages/core/src') + '/'.replace('/', process.platform === 'win32' ? '\\' : '/'))) throw new Error(`Core dependency boundary violated: ${file}: ${name}`);
  }
  if (/\b(?:process|fetch|Buffer|Bun|Deno|PrismaClient|WebSocket)\b/.test(source)) throw new Error(`Core uses infrastructure globals: ${file}`);
}
const coreManifest = JSON.parse(readFileSync(resolve(root, 'packages/core/package.json'), 'utf8'));
if (Object.keys(coreManifest.dependencies ?? {}).length) throw new Error('Core must not depend on infrastructure packages');
for (const base of ['packages', 'apps', 'agent']) for (const file of files(resolve(root, base))) {
  if (!/\.(?:ts|go)$/.test(file)) continue;
  if (/['"][^'"\r\n]*legacy[\\/]v2[\\/]/.test(readFileSync(file, 'utf8'))) throw new Error(`VNext references historical source: ${file}`);
}
for (const file of [resolve(root, 'README.md'), ...files(resolve(root, 'docs')).filter(path => path.endsWith('.md'))]) {
  for (const [, target] of readFileSync(file, 'utf8').matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    if (/^(?:https?:|mailto:|#)/.test(target)) continue;
    const path = target.split('#')[0];
    if (path && !existsSync(resolve(dirname(file), path))) throw new Error(`Broken documentation link: ${file}: ${target}`);
  }
}
console.log('Core dependency boundaries, VNext source isolation and documentation links passed.');
