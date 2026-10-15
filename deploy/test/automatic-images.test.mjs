import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const publishing=readFileSync(new URL('../../.github/workflows/images.yml',import.meta.url),'utf8');
const container=readFileSync(new URL('../../.github/workflows/container.yml',import.meta.url),'utf8');

test('only pushes to main or pushed v* tags enter automatic publication',()=>{
 assert.match(publishing,/on:\n  push:\n    branches: \[main\]\n    tags:\n      - 'v\*'/);
 assert.doesNotMatch(publishing,/workflow_dispatch:/);
 assert.match(publishing,/refs\/heads\/main/);
 assert.match(publishing,/refs\/tags\/v\*/);
 assert.match(publishing,/Stable release requires vMAJOR.MINOR.PATCH/);
 assert.match(publishing,/git merge-base --is-ancestor "\$GITHUB_SHA" origin\/main/);
});

test('publication requires prior exact-commit successful push checks',()=>{
 assert.match(publishing,/for workflow in ci\.yml container\.yml/);
 assert.match(publishing,/\.head_sha==\$sha and \.event=="push" and \.head_branch=="main"/);
 assert.match(publishing,/elif \.status!="completed" then "pending"/);
 assert.match(publishing,/failure\|cancelled\|timed_out/);
 assert.match(container,/push:\n    branches: \[main\]/);
 assert.doesNotMatch(container,/push:\n    branches: \[main\]\n    paths:/);
});

test('GHCR publication never occurs before scanning both actual built images',()=>{
 assert.match(publishing,/packages: write/);
 assert.match(publishing,/--password-stdin/);
 assert.equal((publishing.match(/aquasecurity\/trivy-action@v0\.36\.0/g)||[]).length,2);
 assert.match(publishing,/node deploy\/verify-trivy\.mjs control-trivy\.json agent-trivy\.json/);
 assert.ok(publishing.indexOf('Block both images on missing scans')<publishing.indexOf('Publish both images to GHCR'));
 assert.match(publishing,/Refusing to overwrite existing immutable-source image tag/);
});

test('development images retain per-commit tags; stable release tags do not move aliases',()=>{
 assert.match(publishing,/image_tag="dev-\$GITHUB_SHA"/);
 assert.match(publishing,/latest_main=.*gh api/);
 assert.match(publishing,/if: env\.TUNEX_CHANNEL == 'dev'/);
 assert.match(publishing,/\$TUNEX_CONTROL_BASE:dev/);
 assert.match(publishing,/\$TUNEX_AGENT_BASE:dev/);
 assert.match(publishing,/docker buildx imagetools inspect "\$ref"/);
 assert.match(publishing,/sha256:\[a-f0-9\]\{64\}/);
});

test('publication has source labels, SBOMs and no automatic deployment',()=>{
 assert.equal((publishing.match(/anchore\/sbom-action@v0\.20\.7/g)||[]).length,2);
 assert.match(publishing,/TUNEX_SOURCE_REVISION="\$GITHUB_SHA"/);
 assert.doesNotMatch(publishing,/docker compose (up|down)|kubectl|ssh .*deploy/);
});
