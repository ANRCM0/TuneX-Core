import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
const cache = new URL('../agent/.cache/', import.meta.url);
mkdirSync(cache, { recursive: true });
const result = spawnSync('go', process.argv.slice(2), {
  cwd: new URL('../agent/', import.meta.url), stdio: 'inherit',
  env: { ...process.env, GOCACHE: fileURLToPath(new URL('go-build/', cache)), GOMODCACHE: fileURLToPath(new URL('go-mod/', cache)) },
});
if (result.error) { console.error(result.error.message); process.exit(1); }
process.exit(result.status ?? 1);
