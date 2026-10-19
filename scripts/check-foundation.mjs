import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceReferences, referenceTarget, sourceViolations } from './foundation-boundary-policy.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
function sources(directory) {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap(entry => {
    const path = directory + '/' + entry.name;
    if (['test', 'node_modules', '.cache', 'bin'].includes(entry.name)) return [];
    return entry.isDirectory() ? sources(path) : /\.(?:ts|js|go)$/.test(path) && !/(?:_test\.go|\.test\.(?:ts|js))$/.test(path) ? [path] : [];
  });
}

export function checkFoundationBoundaries() {
  const inventory = JSON.parse(readFileSync(resolve(root, 'docs/architecture/foundation-boundaries-v1.json'), 'utf8'));
  const paths = ['packages/core/src', 'packages/contracts/src', 'apps/control/src', 'apps/web', 'agent/internal', 'agent/cmd', 'examples', 'scripts/ops'].flatMap(sources);
  const errors = [];
  for (const path of paths) {
    const source = readFileSync(resolve(root, path), 'utf8');
    errors.push(...sourceViolations(path, source, inventory));
    for (const reference of sourceReferences(path, source)) {
      const target = referenceTarget(path, reference);
      if (target && !target.startsWith('<') && !existsSync(resolve(root, target))) errors.push(path + ': missing source dependency: ' + reference);
    }
  }
  if (errors.length) throw Error('Foundation source boundaries failed (' + errors.length + '):\n' + errors.join('\n'));
  console.log('Foundation source classification/import/type/private/native boundaries checked: ' + paths.length + ' files');
}

if (process.argv[1] && relative(resolve(process.argv[1]), fileURLToPath(import.meta.url)) === '') checkFoundationBoundaries();
