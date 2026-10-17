import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Page, BrowserContext } from 'playwright';
import type { ForwardSpec } from '@tunex/core';
import type { ConsoleFixture } from './probe-console.ts';

interface PathSwitchFixture extends ConsoleFixture {
    copyId: string; spec: ForwardSpec; revision: number;
    traffic(port: number): Promise<void>;
    succeeded(id: string): Promise<void>;
}

/** Real owner/Runtime/Agent switch on the existing copy; source rule remains independent. */
export async function verifyPathSwitchConsole(page: Page, context: BrowserContext, fixture: PathSwitchFixture) {
    const base = '/api/v1/scopes/' + fixture.scope + '/', templateId = 'console-manual-path';
    const templatePath = base + 'path-templates/' + templateId, forwardPath = base + 'forwards/' + fixture.copyId + '/path-binding';
    const nodes = [fixture.spec.ingress.nodeId, ...fixture.spec.path!.via], profile = fixture.spec.transport!;
    const headers = { authorization: 'Bearer ' + fixture.token }, intents: { method: string; path: string; key: string | undefined; body: any }[] = [];
    let plans = 0, proposals = 0;
    page.on('request', request => {
        const path = new URL(request.url()).pathname;
        if (request.method() === 'POST' && path === base + 'relay-plan') plans++;
        if (request.method() === 'POST' && path === base + 'forwards/' + fixture.copyId + '/path-preview') proposals++;
        if ([templatePath, forwardPath].includes(path) && ['PUT', 'DELETE'].includes(request.method()))
            intents.push({ method: request.method(), path, key: request.headers()['idempotency-key'], body: request.postDataJSON() });
    });
    async function get(resource: string) {
        const response = await context.request.get(fixture.url + base + resource, { headers, timeout: 5000, maxRedirects: 0 });
        assert.equal(response.status(), 200); return response.json();
    }
    async function publish(path: string[], expected: number) {
        await page.locator('#path-template-id').fill(templateId); await page.locator('#path-template-expected').fill(String(expected));
        await page.locator('#path-template-nodes').fill(path.join('\n')); await page.locator('#path-template-protocol').selectOption('both');
        await page.locator('#path-template-profile').fill(profile.profileId); await page.locator('#path-template-profile-revision').fill(String(profile.configRevision));
        await page.locator('#path-template-capture').click();
        await page.waitForFunction(() => document.getElementById('path-template-state')?.textContent?.includes('Endpoint revisions captured'));
        const [response] = await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === templatePath && response.request().method() === 'PUT'),
            page.locator('#path-template-publish').click()
        ]);
        assert.equal(response.status(), 202); const result = await response.json(); assert.equal(result.revision, expected + 1);
        await page.waitForFunction(() => !(document.getElementById('path-template-id') as HTMLInputElement).disabled);
        return result;
    }
    async function prepare(templateRevision: number, forwardRevision: number) {
        await page.locator('#path-switch-forward').fill(fixture.copyId); await page.locator('#path-switch-expected').fill(String(forwardRevision));
        await page.locator('#path-switch-template').fill(templateId); await page.locator('#path-switch-revision').fill(String(templateRevision));
        await page.locator('#path-switch-lock').click();
        await page.waitForFunction(() => /^sha256:[a-f0-9]{64}$/.test((document.getElementById('path-switch-digest') as HTMLInputElement).value));
        await page.locator('#path-switch-prepare').click();
        await page.waitForFunction(() => !(document.getElementById('path-switch-submit') as HTMLButtonElement).disabled);
        const displayed = JSON.parse((await page.locator('#path-switch-proposal').textContent())!);
        assert.equal(displayed.expectedRevision, forwardRevision); assert.equal(displayed.template.revision, templateRevision);
        assert.equal(displayed.reserved, false); assert.equal(displayed.executionAuthorized, false);
        assert.deepEqual(displayed.proposedSpec.target, fixture.spec.target); assert.deepEqual(displayed.proposedSpec.ingress, fixture.spec.ingress);
        assert.equal(displayed.proposedSpec.enabled, true); return displayed;
    }
    async function apply(status: number) {
        const [response] = await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === forwardPath && response.request().method() === 'PUT'),
            page.locator('#path-switch-submit').click()
        ]);
        const value = await response.json(); assert.equal(response.status(), status, JSON.stringify(value));
        await page.waitForFunction(() => !(document.getElementById('path-switch-forward') as HTMLInputElement).disabled);
        return value;
    }
    async function ready(path: string[]) {
        const deadline = Date.now() + 120000;
        while (Date.now() < deadline) {
            const deployment = (await get('forwards/' + fixture.copyId + '/deployment')).deployment;
            if (deployment?.stage === 'active' && deployment.renewalAllowed && deployment.nodes.length === path.length &&
                deployment.nodes.every((node: any) => node.ready && node.reportFresh)) {
                assert.deepEqual(deployment.nodes.map((node: any) => node.nodeId).sort(), [...path].sort());
                for (const [index, nodeId] of path.entries()) {
                    const role = path.length === 2 ? (index === 0 ? 'relay-ingress' : 'relay-egress') :
                        index === 0 ? 'multihop-ingress' : index === path.length - 1 ? 'multihop-egress' : 'multihop-transit';
                    assert.equal(deployment.nodes.find((node: any) => node.nodeId === nodeId)?.role, role);
                }
                if (path.length > 2) {
                    assert.deepEqual(deployment.nodes.map((node: any) => node.nodeId), path);
                    assert.deepEqual(deployment.activationOrder, [...path].reverse());
                }
                return deployment;
            }
            await sleep(250);
        }
        throw Error('Real path-switch deployment did not converge');
    }

    await page.locator('[data-view="relay"]').click();
    const first = await publish(nodes, 0); assert.equal(first.changed, true);
    const baseline = await get('forwards/' + fixture.copyId + '/deployment');
    await prepare(1, fixture.revision); const bound = await apply(200);
    assert.equal(bound.revision, fixture.revision); assert.equal(bound.operationId, null); assert.equal(bound.pathBinding.sequence, 1);
    assert.equal((await get('forwards/' + fixture.copyId + '/deployment')).deployment.generation, baseline.deployment.generation);
    assert.deepEqual((await get('forwards/' + fixture.copyId)).desired.spec, fixture.spec);

    const shorter = [nodes[0]!, nodes.at(-1)!], second = await publish(shorter, 1);
    assert.notEqual(first.configDigest, second.configDigest);
    const beforeSwitch = await get('forwards/' + fixture.copyId);
    assert.equal(beforeSwitch.desired.revision, fixture.revision); assert.deepEqual(beforeSwitch.desired.spec.path.via, nodes.slice(1));
    await page.locator('#path-switch-revision').fill('2'); await page.locator('#path-switch-lock').click();
    await page.waitForFunction(() => document.getElementById('path-switch-state')?.textContent?.includes('Exact immutable template inspected'));
    await page.locator('#path-switch-references').click();
    await page.waitForFunction(() => document.getElementById('path-switch-page')?.textContent?.includes('total 1.'));
    assert.match((await page.locator('#path-switch-rows').textContent())!, /explicit change available/);
    const impact = await get('path-templates/' + templateId + '/references?targetRevision=2');
    assert.equal(impact.total, 1); assert.equal(impact.items[0].forwardId, fixture.copyId); assert.equal(impact.items[0].expectedRevision, fixture.revision);
    assert.deepEqual(impact.items[0].proposedSpec.path.via, [nodes.at(-1)]); assert.equal(impact.reserved, false);
    await prepare(2, fixture.revision);
    let lost = false, accepted: any;
    await page.route('**' + forwardPath, async route => {
        if (lost || route.request().method() !== 'PUT') { await route.continue(); return; }
        lost = true; const response = await route.fetch({ maxRedirects: 0, timeout: 5000 });
        assert.equal(response.status(), 202); accepted = await response.json(); await route.abort('failed');
    });
    await page.locator('#path-switch-submit').click();
    await page.waitForFunction(() => document.getElementById('path-switch-state')?.textContent?.includes('uncertain'));
    assert.equal(await page.locator('#path-switch-revision').isDisabled(), true);
    const checksBeforeReplay = plans;
    assert.deepEqual(await apply(202), accepted); assert.equal(plans, checksBeforeReplay);
    await page.unroute('**' + forwardPath);
    assert.equal(accepted.revision, fixture.revision + 1); assert.equal(accepted.pathBinding.sequence, 2);
    await fixture.succeeded(accepted.operationId); const shortDeployment = await ready(shorter);
    assert.ok(shortDeployment.generation > baseline.deployment.generation);
    await fixture.traffic(fixture.spec.ingress.listen.port);
    await page.screenshot({ path: fixture.directory + '/console-multihop-switch-short-path.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: fixture.directory + '/console-multihop-switch-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });

    // This is a new explicit replace back to an authorized immutable path, never automatic compensation or an old Snapshot replay.
    await prepare(1, accepted.revision); const restored = await apply(202);
    assert.equal(restored.revision, fixture.revision + 2); assert.equal(restored.pathBinding.sequence, 3);
    await fixture.succeeded(restored.operationId); const restoredDeployment = await ready(nodes);
    assert.ok(restoredDeployment.generation > shortDeployment.generation); await fixture.traffic(fixture.spec.ingress.listen.port);
    const final = await get('forwards/' + fixture.copyId); assert.deepEqual(final.desired.spec, fixture.spec);
    const provenance = await get('forwards/' + fixture.copyId + '/path-binding');
    assert.equal(provenance.history.length, 3); assert.deepEqual(provenance.history.map((record: any) => record.revision), [1, 2, 1]);
    assert.deepEqual(provenance.history.map((record: any) => record.forwardRevision), [fixture.revision, fixture.revision + 1, fixture.revision + 2]);
    assert.deepEqual(provenance.history[1].expandedSpec.path.via, [nodes.at(-1)]);

    await page.locator('#path-template-archive').click();
    await page.waitForFunction(() => document.getElementById('path-template-state')?.textContent?.includes('Archived r2'));
    const archived = await get('path-templates/' + templateId + '/references?targetRevision=1');
    assert.equal(archived.archived, true); assert.equal(archived.total, 1); assert.equal(archived.items[0].unavailableReason, 'TEMPLATE_ARCHIVED');
    assert.deepEqual((await get('forwards/' + fixture.copyId)).desired.spec, fixture.spec); await fixture.traffic(fixture.spec.ingress.listen.port);
    const bindingAttempts = intents.filter(intent => intent.path === forwardPath);
    assert.equal(bindingAttempts.length, 4); assert.deepEqual(bindingAttempts[1], bindingAttempts[2]);
    assert.equal(new Set(bindingAttempts.map(intent => intent.key)).size, 3); assert.equal(intents.length, 7);
    assert.ok(intents.every(intent => intent.key)); assert.equal(plans, 3); assert.equal(proposals, 3);
    return { revision: restored.revision, evidence: { sameSpecAttachmentWithoutOperation: true, immutableBindingHistory: 3,
        realShorterPath: shorter, explicitRestoredPath: nodes, sameKeyCommittedLossReplay: true, freshRelayPlanChecks: plans,
        pathProposals: proposals, pathCommandAttempts: bindingAttempts.length, metadataCommands: 3, tcpUdpAfterEachSwitch: true,
        archiveDidNotRewriteOrRevokeExpandedRule: true, physicalHostAcceptance: false, interruptionMeasured: false } };
}
