import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const candidate=readFileSync(new URL('../../.github/workflows/candidate-images.yml', import.meta.url),'utf8');
const containers=readFileSync(new URL('../../.github/workflows/container.yml', import.meta.url),'utf8');
test('manual-only candidate gate checks SHA and exact successful VNext workflows',()=>{
 assert.match(candidate,/workflow_dispatch:/);
 assert.doesNotMatch(candidate,/\npush:/);
 assert.match(candidate,/github\.ref == 'refs\/heads\/main'/);
 assert.match(candidate,/GITHUB_SHA.*EXPECTED_SHA/);
 assert.match(candidate,/ci\.yml container\.yml/);
 assert.match(candidate,/\.head_sha==\$sha and \.conclusion=="success"/);
 assert.match(candidate,/--password-stdin/);
});
test('release forbids overwriting previously published candidate tags',()=>{
 assert.match(candidate,/docker manifest inspect "\$image"/);
 assert.match(candidate,/Candidate tag already exists; refuse overwrite/);
});
test('real release scan gates both images before the first docker push',()=>{
 assert.equal((candidate.match(/aquasecurity\/trivy-action@v0\.36\.0/g)||[]).length,2);
 assert.equal((candidate.match(/exit-code: '1'/g)||[]).length,2);
 assert.equal((candidate.match(/ignore-unfixed: true/g)||[]).length,2);
 assert.ok(candidate.indexOf('Reject fixable CRITICAL vulnerabilities in Agent candidate')<candidate.indexOf('docker push'));
});
test('PR scanner produces artifact-backed reports instead of silently passing',()=>{
 assert.equal((containers.match(/aquasecurity\/trivy-action@v0\.36\.0/g)||[]).length,2);
 assert.match(containers,/Validate both scanner reports were actually produced/);
 assert.match(containers,/Preserve scan reports for security review/);
});
