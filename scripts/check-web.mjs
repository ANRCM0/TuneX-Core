import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

async function productionJavaScript(directory) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = new URL(entry.name, directory);
    if (entry.isDirectory() && entry.name !== 'test') {
      files.push(...await productionJavaScript(new URL(entry.name + '/', directory)));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fileURLToPath(path));
    }
  }
  return files;
}

// Parse every production module without importing it or executing browser code.
const files = await productionJavaScript(new URL('../apps/web/', import.meta.url));
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('Web production JavaScript syntax checked: ' + files.length + ' files');
