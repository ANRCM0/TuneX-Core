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
 assert.match(publishing,/branch=main&event=push&head_sha=\$GITHUB_SHA/);
 assert.match(publishing,/node deploy\/ci-prerequisites\.mjs "\$GITHUB_SHA" "\$workflow"/);
 assert.equal((publishing.match(/node deploy\/ci-prerequisites\.mjs/g)||[]).length,2);
 assert.ok(publishing.lastIndexOf('node deploy/ci-prerequisites.mjs')<publishing.indexOf('docker push'));
 assert.match(publishing,/failure\|cancelled\|timed_out/);
 assert.match(container,/push:\n    branches: \[main\]/);
 assert.doesNotMatch(container,/push:\n    branches: \[main\]\n    paths:/);
});

test('full multi-hop CI has an independent wait budget before the publishing runner starts',()=>{
 const waiting=publishing.slice(publishing.indexOf('  prerequisites:'),publishing.indexOf('  publish:'));
 assert.match(waiting,/timeout-minutes: 65/);
 assert.match(waiting,/deadline=\$\(\(SECONDS \+ 3600\)\)/);
 assert.doesNotMatch(waiting,/packages: write|docker push/);
 assert.match(publishing,/publish:\n    needs: prerequisites\n    runs-on: ubuntu-latest\n    timeout-minutes: 30/);
});

test('GHCR publication never occurs before scanning both actual built images',()=>{
 assert.match(publishing,/packages: write/);
 assert.match(publishing,/--password-stdin/);
 assert.equal((publishing.match(/aquasecurity\/trivy-action@v0\.36\.0/g)||[]).length,2);
 assert.match(publishing,/node deploy\/verify-trivy\.mjs control-trivy\.json agent-trivy\.json/);
 assert.ok(publishing.indexOf('Block both images on missing scans')<publishing.indexOf('Publish both images to GHCR'));
 assert.match(publishing,/Refusing to overwrite existing immutable-source image tag/);
});

test('development images retain per-commit tags and only current main can move dev',()=>{
 assert.match(publishing,/image_tag="dev-\$GITHUB_SHA"/);
 assert.match(publishing,/latest_main=.*gh api/);
 assert.match(publishing,/if: env\.TUNEX_CHANNEL == 'dev'/);
 assert.match(publishing,/\$TUNEX_CONTROL_BASE:dev/);
 assert.match(publishing,/\$TUNEX_AGENT_BASE:dev/);
 assert.match(publishing,/docker buildx imagetools inspect "\$ref"/);
 assert.match(publishing,/sha256:\[a-f0-9\]\{64\}/);
});

test('stable releases alone can promote the newest numeric version to latest',()=>{
 const promotion=publishing.slice(publishing.indexOf('      - name: Move latest aliases'));
 assert.match(promotion,/if: env\.TUNEX_CHANNEL == 'release'/);
 assert.match(promotion,/git fetch --tags origin/);
 assert.match(promotion,/git tag --list 'v\*' \| node deploy\/image-tags\.mjs/);
 assert.ok(promotion.indexOf('[ "$latest_tag" != "$TUNEX_IMAGE_TAG" ]')<promotion.indexOf('docker push'));
 assert.match(promotion,/test "\$latest_digest" = "\$version_digest"/);
 assert.match(publishing,/group: tunex-image-publish-.*'dev' \|\| 'release'/);
});

test('publication has source labels, SBOMs and no automatic deployment',()=>{
 assert.equal((publishing.match(/anchore\/sbom-action@v0\.20\.7/g)||[]).length,2);
 assert.match(publishing,/TUNEX_SOURCE_REVISION="\$GITHUB_SHA"/);
 assert.doesNotMatch(publishing,/docker compose (up|down)|kubectl|ssh .*deploy/);
});
