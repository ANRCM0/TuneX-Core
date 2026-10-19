import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifySource, sourceReferences, sourceViolations } from '../foundation-boundary-policy.mjs';

const inventory = JSON.parse(readFileSync(new URL('../../docs/architecture/foundation-boundaries-v1.json', import.meta.url), 'utf8'));
const lower = 'apps/control/src/framework/mutation-fixture.ts';
function rejected(path, source, reason) {
  assert.ok(sourceViolations(path, source, inventory).some(error => reason.test(error)), 'Expected rejection: ' + reason);
}

test('L0/L1 reject value, type-only, inline import type and re-export dependencies on outer owners', () => {
  for (const source of [
    'import { service } from "../modules/probe-owner/public.ts";',
    'import type { Api } from "../modules/probe-owner/public.ts";',
    'type Api = import("../modules/probe-owner/public.ts").Api;',
    'export type { Api } from "../modules/probe-owner/public.ts";',
    'export * from "../modules/probe-owner/public.ts";',
  ]) rejected(lower, source, /lower dependency direction/);
  rejected('packages/core/src/mutation-fixture.ts', 'import type { Port } from "../../../apps/control/src/framework/public.ts";', /lower dependency direction/);
});

test('dynamic import, require, triple slash native types and computed references cannot bypass lower boundaries', () => {
  for (const source of ['const x = import("node:fs");', 'const x = require("node:fs");', 'import fs = require("node:fs");',
    '/// <reference types="node" />\nexport {};']) rejected(lower, source, /lower dependency direction/);
  rejected(lower, 'const x = import(selectedModule);', /computed module reference/);
  assert.deepEqual(sourceReferences('fixture.ts', '// import "node:fs";\nconst text = "node:fs";'), []);
});

test('package private paths and direct private Core leaves remain closed', () => {
  rejected(lower, 'import type { Primitive } from "@tunex/core/src/primitives.ts";', /private package subpath/);
  rejected(lower, 'import type { Primitive } from "../../../../packages/core/src/primitives.ts";', /private Core dependency/);
  rejected(lower, 'import type { Native } from "@tunex/contracts/src/probe.ts";', /private package subpath/);
  assert.deepEqual(sourceViolations(lower, 'import type { Forward } from "@tunex/core";', inventory), []);
});

test('unclassified production paths are refused instead of inheriting a module-directory exemption', () => {
  rejected('apps/control/src/modules/future-owner/service.ts', 'export const x = 1;', /unclassified production/);
  rejected('apps/web/future-native.js', 'export const x = 1;', /unclassified production/);
  rejected('scripts/ops/future-command.ts', 'export const x = 1;', /unclassified production/);
});

test('cross-owner private value/type/re-export paths and example private imports are rejected', () => {
  const path = 'apps/control/src/modules/probe-owner/fixture.ts';
  for (const source of [
    'import { Identity } from "../identity-owner/service.ts";',
    'import type { Identity } from "../identity-owner/contracts.ts";',
    'export type { Identity } from "../identity-owner/contracts.ts";',
    'type Identity = import("../identity-owner/contracts.ts").Identity;',
  ]) rejected(path, source, /cross-owner private/);
  rejected('examples/foundation-extension/module.ts', 'import type { Identity } from "../../apps/control/src/modules/identity-owner/contracts.ts";', /cross-owner private/);
  assert.deepEqual(sourceViolations(path, 'import type { Identity } from "../identity-owner/public.ts";', inventory), []);
});

test('framework private implementations and direct storage are not product extension points', () => {
  const path = 'apps/control/src/modules/probe-owner/fixture.ts';
  rejected(path, 'import { Host } from "../../framework/runtime-host.ts";', /private framework/);
  rejected(path, 'import { Store } from "../../infrastructure/mysql-probe-permit-store.ts";', /concrete storage/);
  rejected(path, 'import { Native } from "../../compatibility/native-codecs.ts";', /private native adapter/);
  rejected(path, 'import fs from "node:fs";', /external\/native implementation/);
});

test('lower platform globals/types and native date/parser operations are rejected', () => {
  for (const source of ['type Signal = AbortSignal;', 'type BufferType = Buffer;', 'process.platform;',
    'const now = Date.now();', 'const now = new Date();', 'const value = JSON.parse(input);',
    'const body = JSON.stringify(input);', 'fetch(url);', 'globalThis.fetch(url);', 'globalThis.Date.now();']) rejected(lower, source, /platform global|native clock|native Date/);
  assert.deepEqual(sourceViolations(lower, 'interface Store { history(window: number): void; }', inventory), []);
  assert.deepEqual(sourceViolations('packages/core/src/forward.ts', 'const same = JSON.stringify(before) === JSON.stringify(after);', inventory), []);
  rejected('packages/core/src/forward.ts', 'const value = JSON.parse(input);', /native clock\/parser/);
});

test('Go lower contracts refuse native tags, parser imports and platform clock reads', () => {
  const path = 'agent/internal/executionidentity/mutation_fixture.go';
  rejected(path, 'package executionidentity\ntype Record struct { Secret string `json:"secret"` }', /native serialization tags/);
  rejected(path, 'package executionidentity\nimport "encoding/json"', /native\/external dependency/);
  rejected(path, 'package executionidentity\nimport "time"\nfunc now() { time.Now() }', /native clock\/platform\/parser/);
  rejected(path, 'package executionidentity\nimport clock "time"\nfunc now() { clock.Now() }', /native clock\/platform\/parser/);
  rejected(path, 'package executionidentity\nimport "runtime"\nvar platform = runtime.GOOS', /native\/external dependency|native clock\/platform/);
  assert.deepEqual(sourceViolations(path, 'package executionidentity\nimport "maps"\nimport "time"\ntype Facts struct { At time.Time }', inventory), []);
});

test('independent browser owners require explicit effects instead of native globals or private sibling services', () => {
  const path = 'apps/web/rule-command-owner/service.js';
  for (const source of ['fetch(url);', 'new AbortController();', 'Date.now();', 'document.createElement("button");'])
    rejected(path, source, /platform global|native clock/);
  rejected(path, 'import { model } from "../console-model-owner/service.js";', /cross-owner private/);
});

test('named operator bindings remain classified but cannot reach product-private implementation leaves', () => {
  assert.equal(classifySource('scripts/ops/recovery.ts', inventory).binding, true);
  assert.equal(classifySource('scripts/ops/upgrade.ts', inventory).binding, true);
  const path = 'scripts/ops/recovery.ts';
  rejected(path, 'import { Owner } from "../../apps/control/src/modules/probe-owner/permits.ts";', /cross-owner private/);
  assert.deepEqual(sourceViolations(path, 'import { RecoveryWorkflow } from "../../apps/control/src/modules/recovery-owner/public.ts";', inventory), []);
});

test('classification and binding records cannot exempt lower native dependencies or historical imports', () => {
  const changed = { ...inventory, compositionRoots: [...inventory.compositionRoots, lower] };
  assert.ok(sourceViolations(lower, 'import type { Native } from "node:fs";', changed).some(error => /lower dependency direction/.test(error)));
  rejected('scripts/ops/recovery.ts', 'import { Legacy } from "../../legacy/v2/kernel.ts";', /historical implementation/);
});
