import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkFoundationBoundaries } from '../check-foundation.mjs';
import { classifySource, sourceReferences, sourceViolations } from '../foundation-boundary-policy.mjs';

const inventory = JSON.parse(readFileSync(new URL('../../scripts/config/foundation-boundaries-v1.json', import.meta.url), 'utf8'));
function rejects(path, source, pattern) {
  const errors = sourceViolations(path, source, inventory);
  assert.ok(errors.some(error => pattern.test(error)), path + '\n' + source + '\nExpected ' + pattern + ', got ' + errors.join('\n'));
}

test('the actual production source graph obeys the declared inventory including Web example operator and Go roots', () => {
  // Executes the same canonical scan used by check-boundaries and Actions.
  // Discovery is recursive and reads current sources, not a saved path count.
  assert.doesNotThrow(() => checkFoundationBoundaries());
});

test('all static type and value reference syntaxes retain lower direction and concrete-provider refusal', () => {
  const path = 'apps/control/src/framework/boundary-completeness.ts';
  for (const source of [
    'import { Store } from "../infrastructure/mysql-intent-store.ts";',
    'import type { Store } from "../infrastructure/mysql-intent-store.ts";',
    'import { type Store } from "../infrastructure/mysql-intent-store.ts";',
    'export { Store } from "../infrastructure/mysql-intent-store.ts";',
    'export type { Store } from "../infrastructure/mysql-intent-store.ts";',
    'export { type Store } from "../infrastructure/mysql-intent-store.ts";',
    'export * from "../infrastructure/mysql-intent-store.ts";',
    'export * as adapter from "../infrastructure/mysql-intent-store.ts";',
    'type Store = import("../infrastructure/mysql-intent-store.ts").Store;',
    'const adapter = import("../infrastructure/mysql-intent-store.ts");',
    'const adapter = require("../infrastructure/mysql-intent-store.ts");',
    'import adapter = require("../infrastructure/mysql-intent-store.ts");',
    '/// <reference path="../infrastructure/mysql-intent-store.ts" />\nexport {};',
  ]) rejects(path, source, /lower dependency direction/);
  rejects(path, 'const adapter = import(computed);', /computed module reference/);
  rejects(path, 'const adapter = require(computed);', /computed module reference/);
  assert.deepEqual(sourceReferences(path, '/* import type { X } from "node:fs" */\nconst label = "import(outer)";'), []);
});

test('L0 infrastructure globals and L1 root or private package subpaths cannot become injected contracts', () => {
  for (const source of ['fetch(url);', 'process.env.VALUE;', 'Buffer.from(bytes);', 'new WebSocket(url);',
    'new URL(url);', 'globalThis.fetch(url);', 'Date.now();', 'Date.parse(text);'])
    rejects('packages/core/src/boundary-completeness.ts', source, /platform global|native clock/);
  for (const reference of ['@tunex/contracts', '@tunex/contracts/runtime', '@tunex/contracts/shared'])
    rejects('apps/control/src/framework/boundary-completeness.ts', 'import type { Value } from "' + reference + '";', /lower dependency direction/);
  for (const reference of ['@tunex/core/src/ipv4.ts', '@tunex/contracts/src/types.ts'])
    rejects('apps/control/src/framework/boundary-completeness.ts', 'export type { Value } from "' + reference + '";', /private package subpath/);
});

test('L2 native adapters refuse reverse product value and type references while retaining lower contracts', () => {
  for (const path of ['apps/web/browser-native/rule-console.js', 'apps/control/src/compatibility/boundary-completeness.ts']) {
    const reference = path.startsWith('apps/web/') ? '../rule-command-owner/public.js' : '../modules/forward-owner/public.ts';
    for (const source of [
      `import { Product } from '${reference}';`, `import type { Product } from '${reference}';`,
      `export { Product } from '${reference}';`, `export type { Product } from '${reference}';`,
      `export * from '${reference}';`, `type Product = import('${reference}').Product;`,
      `const product = import('${reference}');`, `const product = require('${reference}');`,
    ]) rejects(path, source, /adapter imports product implementation or type/);
  }
  rejects('agent/internal/platformclock/boundary_completeness.go',
    'package platformclock\nimport "github.com/tunex/vnext/agent/internal/agentcommand"', /adapter imports product implementation or type/);
  assert.deepEqual(sourceViolations('apps/control/src/compatibility/boundary-completeness.ts',
    'import type { RuntimeHost } from "../framework/public.ts";', inventory), []);
  assert.deepEqual(sourceViolations('agent/internal/platformclock/boundary_completeness.go',
    'package platformclock\nimport "github.com/tunex/vnext/agent/internal/executiontime"', inventory), []);
});

test('Control and browser product owners reject native platform branches including computed and aliased reads', () => {
  const sources = [
    'if (process.platform === "win32") windows();',
    'switch (process.arch) { case "arm64": arm(); }',
    'const value = globalThis.process["platform"] === "linux" ? linux() : other();',
    'const { platform: operatingSystem } = process; if (operatingSystem === "linux") linux();',
    'const nativeProcess = process; if (nativeProcess.platform === "linux") linux();',
    'if (navigator.platform === "Win32") windows();',
    'if (globalThis["navigator"]["userAgentData"].platform === "Windows") windows();',
    'if (Deno.build.os === "windows") windows();',
    'if (facts.platform === "windows") windows();',
    'if ("linux" !== facts["os"]) other();',
    'const choice = facts.arch === "arm64" ? arm() : other();',
    'switch (facts["platform"]) { case "windows": windows(); }',
    'switch (facts.architecture) { case "arm64": arm(); }',
  ];
  for (const path of ['apps/control/src/modules/identity-owner/boundary-completeness.ts', 'apps/web/console-model-owner/service.js']) {
    assert.equal(classifySource(path, inventory).layer, 'L3');
    assert.equal(classifySource(path, inventory).binding, false);
    for (const source of sources) rejects(path, source, /product native platform/);
    assert.deepEqual(sourceViolations(path, 'export function choose(facts) { return facts.supported ? 1 : 2; }', inventory), []);
    assert.deepEqual(sourceViolations(path, 'export function display(facts) { return { platform: facts.platform, arch: facts["arch"] }; }', inventory), []);
  }
});

test('Go product owners reject native OS and architecture selection through imports aliases dot imports and build files', () => {
  const path = 'agent/internal/agentcommand/boundary_completeness.go';
  assert.equal(classifySource(path, inventory).layer, 'L3');
  assert.equal(classifySource(path, inventory).binding, false);
  for (const source of [
    'package agentcommand\nimport "runtime"\nfunc choose() { if runtime.GOOS == "windows" { windows() } }',
    'package agentcommand\nimport rt "runtime"\nfunc choose() { switch rt.GOARCH { case "arm64": arm() } }',
    'package agentcommand\nimport (\n rt "runtime"\n)\nvar selected = rt.GOOS',
    'package agentcommand\nimport . "runtime"\nvar selected = GOOS',
    'package agentcommand\nfunc choose(facts Facts) bool { return facts.Platform == "windows" }',
    'package agentcommand\nfunc choose(facts Facts) bool { return "linux" != facts.OS }',
    'package agentcommand\nfunc choose(facts Facts) { switch facts.Arch { case "arm64": arm() } }',
    'package agentcommand\nfunc choose(facts Facts) { switch facts.OperatingSystem { case "windows": windows() } }',
  ]) rejects(path, source, /product native platform/);
  for (const source of ['//go:build linux && amd64\npackage agentcommand', '// +build windows\npackage agentcommand'])
    rejects(path, source, /platform-specific source selection/);
  rejects('agent/internal/agentcommand/fixture_linux_amd64.go', 'package agentcommand', /platform-specific source selection/);
  assert.deepEqual(sourceViolations(path, 'package agentcommand\nfunc choose(facts Facts) bool { return facts.Supported }', inventory), []);
  assert.deepEqual(sourceViolations(path, 'package agentcommand\nfunc display(facts Facts) string { return facts.Platform }', inventory), []);
  assert.deepEqual(sourceViolations(path, 'package agentcommand\n// runtime.GOOS is adapter-owned\nvar label = "runtime.GOOS"', inventory), []);
});

test('only explicitly named bindings retain native selection and lower classifications cannot be exempted by a binding label', () => {
  const binding = 'apps/control/src/modules/identity.ts';
  assert.equal(classifySource(binding, inventory).binding, true);
  assert.deepEqual(sourceViolations(binding, 'if (process.platform === "win32") bind();', inventory), []);
  const lower = 'apps/control/src/framework/boundary-completeness.ts';
  const changed = { ...inventory, compositionRoots: [...inventory.compositionRoots, lower] };
  assert.ok(sourceViolations(lower, 'import type { Native } from "node:fs";', changed).some(error => /lower dependency direction/.test(error)));
  for (const path of ['apps/control/src/modules/new-owner/service.ts', 'apps/web/new-owner/service.js',
    'agent/internal/newowner/service.go', 'scripts/ops/new-command.ts']) rejects(path, 'export {};', /unclassified production/);
  rejects('apps/control/src/modules/identity-owner/boundary-completeness.ts',
    'export type { Secret } from "../node-owner/contracts.ts";', /cross-owner private/);
});
