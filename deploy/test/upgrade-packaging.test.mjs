import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('Control packages ops tools and container CI resolves the assessor without network', () => {
    const docker = readFileSync(new URL('../Dockerfile.control', import.meta.url), 'utf8');
    assert.match(docker, /COPY scripts\/ops \.\/scripts\/ops/);
    const workflow = readFileSync(new URL('../../.github/workflows/container.yml', import.meta.url), 'utf8');
    assert.match(workflow, /docker run --rm --network none .*import\('\.\/scripts\/ops\/upgrade-inspect\.ts'\)/);
});
test('Agent inspection branches before enrollment and instance lock acquisition', () => {
    const main = readFileSync(new URL('../../agent/cmd/tunex-agent/main.go', import.meta.url), 'utf8');
    assert.ok(main.indexOf('if *inspectJournal {') < main.indexOf('if *enroll {'));
    assert.ok(main.indexOf('if *inspectJournal {') < main.indexOf('state.AcquireLock('));
    assert.match(main, /state\.InspectRuntimeJournal/);
});
