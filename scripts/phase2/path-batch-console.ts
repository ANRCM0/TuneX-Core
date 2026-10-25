import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import type { BrowserContext, Page } from 'playwright';
import type { ForwardSpec } from '@tunex/core';
import type { ConsoleFixture } from './probe-console.ts';

interface PathBatchFixture extends ConsoleFixture {
    copyId: string; revision: number; spec: ForwardSpec; batchPort: number;
    succeeded(id: string): Promise<void>;
    traffic(port: number): Promise<void>;
    closed(port: number): Promise<void>;
    slots(id: string, retained: boolean, businessPort?: number): Promise<void>;
}

/** Independent original commands, real owners/Agents; fixture writes are not browser attempts. */
export async function verifyPathBatchConsole(page: Page, context: BrowserContext, fixture: PathBatchFixture) {
    if (process.platform !== 'linux' || process.env.GITHUB_ACTIONS !== 'true') throw Error('Path batch browser acceptance is Actions-only');
    const base = '/api/v1/scopes/' + fixture.scope + '/', templateId = 'console-batch-path';
    const nodes = [fixture.spec.ingress.nodeId, ...fixture.spec.path!.via], profile = fixture.spec.transport!;
    const headers = { authorization: 'Bearer ' + fixture.token }, attempts: { path: string; key: string | undefined; body: any }[] = [];
    let proposals = 0, plans = 0, fixtureWrites = 0;
    const record = (request: import('playwright').Request) => {
        const path = new URL(request.url()).pathname;
        if (path === base + 'relay-plan' && request.method() === 'POST') plans++;
        if (path.startsWith(base + 'forwards/') && path.endsWith('/path-preview') && request.method() === 'POST') proposals++;
        if (path.startsWith(base + 'forwards/') && path.endsWith('/path-binding') && request.method() === 'PUT')
            attempts.push({ path, key: request.headers()['idempotency-key'], body: request.postDataJSON() });
    };
    page.on('request', record);
    async function call(method: string, resource: string, data?: unknown, status = 200) {
        if (method !== 'GET') fixtureWrites++;
        const response = await context.request.fetch(fixture.url + base + resource, { method,
            headers: { ...headers, 'idempotency-key': randomUUID() }, ...(data === undefined ? {} : { data }), timeout: 5000, maxRedirects: 0 });
        assert.equal(response.status(), status); return response.json();
    }
    async function publish(path: string[], expectedRevision: number) {
        const endpoints = [];
        for (const nodeId of path.slice(1)) {
            const endpoint = await call('GET', 'nodes/' + nodeId + '/relay-endpoint');
            endpoints.push({ nodeId, revision: endpoint.revision });
        }
        return call('PUT', 'path-templates/' + templateId, { expectedRevision, config: {
            version: 1, nodes: path, protocols: fixture.spec.protocols, endpoints, transport: profile
        } }, 202);
    }
    async function prepare(revision: number, orderedIds: string[]) {
        await page.locator('[data-view="relay"]').click();
        await page.locator('#path-switch-template').fill(templateId); await page.locator('#path-switch-revision').fill(String(revision));
        await page.locator('#path-switch-lock').click();
        await page.waitForFunction(() => document.getElementById('path-switch-state')?.textContent?.includes('Exact immutable template inspected'));
        await page.locator('#path-switch-references').click();
        await page.waitForFunction(() => document.getElementById('path-switch-page')?.textContent?.includes('total 2.'));
        for (const id of orderedIds) await page.getByRole('checkbox', { name: 'Select Path Impact Forward ' + id, exact: true }).check();
        const before = { attempts: attempts.length, proposals, plans };
        await page.locator('#path-switch-batch-prepare').click(); await page.locator('#rule-command-dialog').waitFor({ state: 'visible' });
        assert.deepEqual({ attempts: attempts.length, proposals, plans }, before, 'Preparing the batch must send no hidden preflight or write');
        assert.equal(await page.locator('#rule-command-start').isDisabled(), true);
        assert.match((await page.locator('#rule-command-title').textContent())!, new RegExp('Explicit Path ' + templateId + ' -> r' + revision));
        const displayed = JSON.parse((await page.locator('#rule-command-rows tr').first().locator('pre').textContent())!);
        assert.equal(displayed.command.template.revision, revision); assert.equal(displayed.command.expectedRevision,
            (await call('GET', 'forwards/' + orderedIds[0])).desired.revision);
        assert.deepEqual(displayed.proposedSpec.target, displayed.sourceSpec.target);
        assert.deepEqual(displayed.proposedSpec.ingress, displayed.sourceSpec.ingress);
        assert.equal(displayed.proposedSpec.enabled, displayed.sourceSpec.enabled);
    }
    const result = async (id: string) => JSON.parse((await page.locator('#rule-command-rows tr').filter({ hasText: id }).locator('td').nth(2).locator('pre').textContent())!);
    async function ready(path: string[]) {
        const deadline = Date.now() + 120000;
        while (Date.now() < deadline) {
            const deployment = (await call('GET', 'forwards/' + fixture.copyId + '/deployment')).deployment;
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
        throw Error('Real path batch deployment did not converge');
    }

    const first = await publish(nodes, 0), template = (revision: number, configDigest: string) => ({ templateId, revision, configDigest });
    const extraSpec = { ...fixture.spec, enabled: false, ingress: { ...fixture.spec.ingress, listen: { ...fixture.spec.ingress.listen, port: fixture.batchPort } } };
    const extra = await call('POST', 'forwards', extraSpec, 202); await fixture.succeeded(extra.operationId);
    const extraResource = 'forwards/' + extra.forwardId, activeResource = 'forwards/' + fixture.copyId;
    for (const [resource, expectedRevision] of [[activeResource, fixture.revision], [extraResource, extra.revision]] as const) {
        const bound = await call('PUT', resource + '/path-binding', { expectedRevision, template: template(1, first.configDigest) });
        assert.equal(bound.operationId, null); assert.equal(bound.revision, expectedRevision);
    }
    await fixture.slots(extra.forwardId, true, fixture.batchPort); await fixture.closed(fixture.batchPort);
    const shorter = [nodes[0]!, nodes.at(-1)!]; await publish(shorter, 1);
    const unchanged = await call('GET', activeResource); assert.equal(unchanged.desired.revision, fixture.revision);
    assert.deepEqual(unchanged.desired.spec, fixture.spec);
    await prepare(2, [fixture.copyId, extra.forwardId]);
    // This explicit fixture writer races the frozen disabled rule; no browser refresh may substitute its CAS.
    const racedSpec = { ...extraSpec, target: { ...extraSpec.target, port: extraSpec.target.port === 65535 ? 65534 : extraSpec.target.port + 1 } };
    const raced = await call('PUT', extraResource, { expectedRevision: extra.revision, spec: racedSpec }, 202); await fixture.succeeded(raced.operationId);
    await page.locator('#rule-command-consent').check(); await page.locator('#rule-command-start').click();
    await page.waitForFunction(() => {
        return document.querySelectorAll('#rule-command-rows [data-state="accepted"]').length === 1 && document.querySelectorAll('#rule-command-rows [data-state="rejected"]').length === 1;
    });
    assert.equal(proposals, 2); assert.equal(plans, 1); assert.equal(attempts.length, 1);
    assert.match((await page.locator('#rule-command-rows tr').filter({ hasText: extra.forwardId }).textContent())!, /REVISION_CONFLICT/);
    const short = await result(fixture.copyId); assert.equal(short.revision, fixture.revision + 1);
    await fixture.succeeded(short.operationId); const shortDeployment = await ready(shorter); await fixture.traffic(fixture.spec.ingress.listen.port);
    assert.deepEqual((await call('GET', extraResource)).desired.spec, racedSpec); await fixture.closed(fixture.batchPort);
    await page.screenshot({ path: fixture.directory + '/console-multihop-path-batch-partial.png', fullPage: true });
    await page.locator('#rule-command-close').click();

    // New exact revision, explicit fresh consent. Restoring the active path is not automatic compensation.
    await publish(nodes, 2); await prepare(3, [fixture.copyId, extra.forwardId]);
    const activePath = base + activeResource + '/path-binding'; let lost = false, committed: any;
    await page.route('**' + activePath, async route => {
        if (route.request().method() !== 'PUT' || lost) { await route.continue(); return; }
        lost = true; const response = await route.fetch({ maxRedirects: 0, timeout: 5000 });
        assert.equal(response.status(), 202); committed = await response.json(); await route.abort('failed');
    });
    await page.locator('#rule-command-consent').check(); await page.locator('#rule-command-start').click();
    await page.waitForFunction(() => document.querySelectorAll('#rule-command-rows [data-state="uncertain"]').length === 1);
    assert.equal(proposals, 3); assert.equal(plans, 2); assert.equal(attempts.length, 2);
    assert.equal(await page.locator('#rule-command-rows tr').filter({ hasText: extra.forwardId }).locator('[data-state="pending"]').count(), 1);
    assert.equal(await page.locator('#rule-command-start').isDisabled(), true);
    await page.screenshot({ path: fixture.directory + '/console-multihop-path-batch-uncertain.png', fullPage: true });
    await page.locator('#rule-command-consent').check(); await page.getByRole('button', { name: '重试原请求', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('#rule-command-rows [data-state="accepted"]').length === 1);
    assert.equal(proposals, 3); assert.equal(plans, 2); assert.equal(attempts.length, 3); assert.deepEqual(attempts[1], attempts[2]);
    assert.deepEqual(await result(fixture.copyId), committed); assert.equal(committed.revision, fixture.revision + 2);
    assert.equal(await page.locator('#rule-command-start').isDisabled(), true, 'Replaying one row must not resume the tail');
    await fixture.succeeded(committed.operationId); const fullDeployment = await ready(nodes);
    assert.ok(fullDeployment.generation > shortDeployment.generation); await fixture.traffic(fixture.spec.ingress.listen.port);
    await page.unroute('**' + activePath);
    const extraDeployment = (await call('GET', extraResource + '/deployment')).deployment;
    await page.locator('#rule-command-consent').check(); await page.locator('#rule-command-start').click();
    await page.waitForFunction(() => {
        return document.querySelectorAll('#rule-command-rows [data-state="accepted"]').length === 1 && document.querySelectorAll('#rule-command-rows [data-state="unchanged"]').length === 1;
    });
    const metadataOnly = await result(extra.forwardId); assert.equal(metadataOnly.revision, raced.revision); assert.equal(metadataOnly.operationId, null);
    assert.equal(metadataOnly.pathBinding.revision, 3); assert.equal(metadataOnly.pathBinding.sequence, 2); assert.equal(metadataOnly.pathBinding.changed, true);
    assert.equal((await call('GET', extraResource + '/deployment')).deployment?.generation ?? null, extraDeployment?.generation ?? null);
    assert.deepEqual((await call('GET', extraResource)).desired.spec, racedSpec); await fixture.closed(fixture.batchPort);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: fixture.directory + '/console-multihop-path-batch-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.locator('#rule-command-close').click();

    assert.equal(proposals, 4); assert.equal(plans, 3); assert.equal(attempts.length, 4);
    assert.equal(new Set(attempts.map(attempt => attempt.key)).size, 3); assert.ok(attempts.every(attempt => attempt.key));
    assert.deepEqual((await call('GET', activeResource)).desired.spec, fixture.spec);
    const provenance = await call('GET', activeResource + '/path-binding');
    assert.deepEqual(provenance.history.slice(-3).map((record: any) => [record.templateId, record.revision]), [[templateId, 1], [templateId, 2], [templateId, 3]]);
    assert.equal(provenance.binding.revision, 3); await fixture.slots(fixture.copyId, true);
    const deleted = await call('DELETE', extraResource, { expectedRevision: raced.revision }, 202); await fixture.succeeded(deleted.operationId);
    await fixture.slots(extra.forwardId, false); await fixture.closed(fixture.batchPort);
    await call('DELETE', 'path-templates/' + templateId, { expectedRevision: 3 }, 202);
    assert.deepEqual((await call('GET', activeResource)).desired.spec, fixture.spec); await fixture.traffic(fixture.spec.ingress.listen.port);
    assert.equal(fixtureWrites, 9); page.off('request', record);
    return { revision: committed.revision as number, evidence: { selectedRules: 2, independentPartialCASRejection: true,
        fixtureSetupAndCleanupWrites: fixtureWrites, fixtureExternalCASRaceWrites: 1, uiPathProposals: proposals, uiRelayPlans: plans,
        uiPathCommandAttempts: attempts.length, sameKeyCommittedResponseReplay: true, replayDidNotResumeTailOrRecheck: true,
        metadataOnlyTailHadNoOperation: true, disabledExtraResourcesReclaimed: true, realCopyTcpUdpVerified: true,
        physicalHostAcceptance: false, interruptionMeasured: false } };
}
