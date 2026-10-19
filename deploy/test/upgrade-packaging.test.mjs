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
    const command = readFileSync(new URL('../../agent/internal/agentcommand/host.go', import.meta.url), 'utf8');
    const native = readFileSync(new URL('../../agent/internal/agentcli/native.go', import.meta.url), 'utf8');
    assert.match(main, /options := agentcli\.ParseOptions\(\)/);
    assert.match(main, /agentcommand\.Host\{Platform:\s*agentcli\.Native\{\}/);
    assert.match(main, /return host\.Run\(options\)/);
    const inspect = command.indexOf('if options.InspectJournal {');
    const enroll = command.indexOf('if options.Enroll {');
    const lock = command.indexOf('platform.AcquireInstance(');
    assert.ok(inspect >= 0 && enroll >= 0 && lock >= 0, 'canonical command branches must exist');
    assert.ok(inspect < enroll && inspect < lock, 'inspection must return before enrollment and instance locking');
    assert.match(command, /if options\.InspectJournal \{\s*return platform\.InspectJournal\(paths\.Journal, paths\.KeyPath, options\.NodeID\)/);
    assert.match(command, /Journal inspection cannot be combined with state-changing flags/);
    const inspectionStart = native.indexOf('func (Native) InspectJournal(');
    const inspectionEnd = native.indexOf('func (Native) Enroll(');
    assert.ok(inspectionStart >= 0 && inspectionEnd > inspectionStart, 'native inspection owner must exist');
    const inspection = native.slice(inspectionStart, inspectionEnd);
    assert.match(inspection, /state\.InspectRuntimeJournal\(journal, key, node\)/);
    assert.match(inspection, /len\(key\) != 32/);
    assert.doesNotMatch(inspection, /state\.(?:AcquireLock|AtomicWrite|Initialize|Save|Enable)/);
});
