import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import type { ForwardSpec } from '@tunex/core';
import type { RelayProfileConfig } from '@tunex/contracts';
import { withBrowser } from './probe-console.ts';
import type { ConsoleFixture } from './probe-console.ts';
import { verifyPathTemplateConsole } from './path-template-console.ts';
import { verifyPathSwitchConsole } from './path-switch-console.ts';
import { verifyPathBatchConsole } from './path-batch-console.ts';

interface MultihopConsoleFixture extends ConsoleFixture {
    sourceId: string; revision: number; spec: ForwardSpec; profile: RelayProfileConfig; copyPort: number; batchPort: number;
    traffic(port: number): Promise<void>;
    closed(port: number): Promise<void>;
    slots(id: string, retained: boolean, businessPort?: number): Promise<void>;
    onlySourceReservations(): Promise<void>;
}

/** Extends the real multi-Agent fixture; no mocked API or production feature enablement. */
export async function verifyMultihopConsole(fixture: MultihopConsoleFixture) {
    return withBrowser(fixture, async (page, context) => {
        const base = '/api/v1/scopes/' + fixture.scope + '/', headers = { authorization: 'Bearer ' + fixture.token };
        const profileId = fixture.spec.transport!.profileId, path = [fixture.spec.ingress.nodeId, ...fixture.spec.path!.via];
        const source = 'forwards/' + fixture.sourceId, sourcePath = base + source;
        assert.ok([3, 4, 8].includes(path.length)); assert.equal(new Set(path).size, path.length);
        assert.equal(fixture.spec.transport!.configRevision, 1);
        async function get(resource: string) {
            const response = await context.request.get(fixture.url + base + resource, { headers, timeout: 5000, maxRedirects: 0 });
            assert.equal(response.status(), 200); return response.json();
        }
        async function succeeded(id: string) {
            assert.equal(typeof id, 'string');
            const deadline = Date.now() + 120000;
            while (Date.now() < deadline) {
                const operation = await get('operations/' + id);
                if (operation.status === 'succeeded') return;
                assert.notEqual(operation.status, 'failed'); assert.notEqual(operation.status, 'superseded');
                await sleep(250);
            }
            throw Error('Real multi-hop Console Operation timed out');
        }
        async function readyDeployment(resource: string) {
            const deadline = Date.now() + 120000;
            while (Date.now() < deadline) {
                const deployment = (await get(resource + '/deployment')).deployment;
                if (deployment?.stage === 'active' && deployment.renewalAllowed && deployment.nodes.length === path.length &&
                    deployment.nodes.every((node: any) => node.ready && node.reportFresh)) return deployment;
                await sleep(250);
            }
            throw Error('Real multi-hop Console deployment did not become ready');
        }
        const expected = { ...fixture.spec, enabled: false,
            ingress: { ...fixture.spec.ingress, listen: { ...fixture.spec.ingress.listen, port: fixture.copyPort } } };
        let writes = 0, previews = 0, pathPreviews = 0;
        const commands: { method: string; path: string; key: string | undefined; body: unknown }[] = [];
        page.on('request', request => {
            const pathname = new URL(request.url()).pathname;
            if (pathname === base + 'relay-plan' && request.method() === 'POST') previews++;
            else if (pathname.endsWith('/path-preview') && pathname.startsWith(base) && request.method() === 'POST') pathPreviews++;
            else if (pathname.startsWith(base) && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method())) {
                writes++; commands.push({ method: request.method(), path: pathname,
                    key: request.headers()['idempotency-key'], body: request.postDataJSON() });
            }
        });

        // Publish a newer current Profile so copying cannot accidentally use "latest".
        await page.locator('[data-view="relay"]').click();
        await page.locator('#relay-profile-rows tr').filter({ hasText: profileId }).waitFor();
        await page.locator('#relay-profile-id').fill(profileId);
        const form = page.locator('#relay-profile-form');
        await form.locator('[name="protocol"]').selectOption('both');
        for (const name of ['handshakeTimeoutSeconds', 'idleTimeoutSeconds', 'maxFrameBytes', 'maxUdpDatagramBytes', 'maxConnectionsPerNode'] as const)
            await form.locator('[name="' + name + '"]').fill(String(fixture.profile[name]));
        await form.locator('[name="idleTimeoutSeconds"]').fill(String(fixture.profile.idleTimeoutSeconds + 1));
        const [published] = await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === base + 'transport-profiles/' + profileId && response.request().method() === 'PUT'),
            form.locator('button[type="submit"]').click()
        ]);
        assert.equal(published.status(), 202); assert.equal((await published.json()).revision, 2);
        await page.waitForFunction(id => [...(document.getElementById('relay-profile-rows')?.children ?? [])]
            .some(row => row.textContent?.includes(id) && row.textContent?.includes('r2')), profileId);
        const unchanged = await get(source);
        assert.equal(unchanged.desired.revision, fixture.revision); assert.deepEqual(unchanged.desired.spec, fixture.spec);

        await page.locator('[data-view="forwards"]').click();
        await page.locator('[data-action="forward-copy"][data-id="' + fixture.sourceId + '"]').click();
        await page.waitForFunction(() => document.getElementById('relay-submit')?.textContent?.includes('\u590d\u5236\u4e3a\u65b0'));
        assert.equal(await page.locator('#relay-forward-form [name="enabled"]').isChecked(), false);
        assert.equal(await page.locator('#relay-listen-port').inputValue(), '');
        assert.equal(await page.locator('#relay-ingress').isDisabled(), false);
        assert.equal(await page.locator('#relay-ingress').inputValue(), path[0]);
        assert.equal(await page.locator('#relay-egress').inputValue(), path.at(-1));
        assert.equal(await page.locator('#multihop-controls').isVisible(), true);
        const intermediateOrder = () => page.locator('#multihop-path li span').allTextContents();
        const shortId = (id: string) => id.length > 21 ? id.slice(0, 18) + '\u2026' : id;
        assert.deepEqual(await intermediateOrder(), path.slice(1, -1).map(shortId));
        assert.equal(await page.locator('#relay-submit').isDisabled(), true);
        assert.equal(writes, 1); assert.equal(previews, 0); await fixture.onlySourceReservations();
        await page.locator('#relay-listen-port').selectOption(String(fixture.copyPort));

        async function preview() {
            const [response] = await Promise.all([
                page.waitForResponse(response => new URL(response.url()).pathname === base + 'relay-plan' && response.request().method() === 'POST'),
                page.locator('#relay-preview').click()
            ]);
            assert.equal(response.status(), 200); assert.deepEqual(response.request().postDataJSON(), expected);
            const plan = await response.json();
            assert.equal(plan.reserved, false); assert.equal(plan.executionSupported, false); assert.equal(plan.runtimeEnabled, true);
            assert.equal(plan.profile.profileId, profileId); assert.equal(plan.profile.revision, 1);
            assert.deepEqual(plan.path, path); assert.equal(plan.resources.length, path.length * 2);
            await page.waitForFunction(() => !(document.getElementById('relay-submit') as HTMLButtonElement).disabled);
            await fixture.onlySourceReservations();
        }
        await preview();
        if (path.length > 3) {
            await page.getByRole('button', { name: '\u4e0b\u79fb ' + path[1], exact: true }).click();
            assert.deepEqual(await intermediateOrder(), [path[2]!, path[1]!, ...path.slice(3, -1)].map(shortId));
            assert.equal(await page.locator('#relay-submit').isDisabled(), true);
            assert.equal(await page.locator('#relay-preview-output').isVisible(), false);
            await page.getByRole('button', { name: '\u4e0a\u79fb ' + path[1], exact: true }).click();
            assert.deepEqual(await intermediateOrder(), path.slice(1, -1).map(shortId));
        } else {
            const host = page.locator('#relay-forward-form [name="targetHost"]');
            await host.fill('127.0.0.1'); assert.equal(await page.locator('#relay-submit').isDisabled(), true);
            await host.fill(fixture.spec.target.host);
        }
        assert.equal(writes, 1); assert.equal(previews, 1, 'Draft changes cannot dispatch a new plan or command');
        await preview();
        await page.screenshot({ path: fixture.directory + '/console-multihop-copy-plan-desktop.png', fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        await page.screenshot({ path: fixture.directory + '/console-multihop-copy-plan-mobile.png', fullPage: true });
        await page.setViewportSize({ width: 1440, height: 1000 });
        const [created] = await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === base + 'forwards' && response.request().method() === 'POST'),
            page.locator('#relay-submit').click()
        ]);
        assert.equal(created.status(), 202); assert.deepEqual(created.request().postDataJSON(), expected);
        const copy = await created.json(), copyResource = 'forwards/' + copy.forwardId, copyPath = base + copyResource;
        assert.notEqual(copy.forwardId, fixture.sourceId); assert.equal(copy.revision, 1); await succeeded(copy.operationId);
        await fixture.slots(copy.forwardId, true); await fixture.closed(fixture.copyPort);

        const middle = path[1]!;
        await page.locator('[data-view="nodes"]').click();
        await page.locator('[data-action="node-tunnel"][data-id="' + middle + '"]').click();
        await page.waitForFunction(() => document.getElementById('tunnel-references-meta')?.textContent?.includes('total 2.'));
        assert.match((await page.locator('#tunnel-reference-rows').textContent())!, /transit.*previous:.*next:/);
        const references = await get('nodes/' + middle + '/tunnel/references?page=1&limit=25');
        assert.equal(references.total, 2);
        const reference = references.items.find((item: any) => item.forwardId === copy.forwardId);
        assert.equal(reference.enabled, false); assert.equal(reference.role, 'transit'); assert.deepEqual(reference.path, path);
        assert.equal(reference.previousNodeId, path[0]); assert.equal(reference.nextNodeId, path[2]);
        assert.equal(reference.configRevision, 1);
        await page.screenshot({ path: fixture.directory + '/console-multihop-disabled-copy-transit.png', fullPage: true });
        await page.locator('#tunnel-close').click();
        await page.locator('[data-view="forwards"]').click();
        const rowToggle = page.locator('[data-action="forward-toggle"][data-id="' + copy.forwardId + '"]');
        await page.waitForFunction(id => document.querySelector('[data-action="forward-toggle"][data-id="' + id + '"]')?.textContent === '\u542f\u7528', copy.forwardId);
        const [enabled] = await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === copyPath && response.request().method() === 'PUT'), rowToggle.click()
        ]);
        assert.equal(enabled.status(), 202); assert.deepEqual(enabled.request().postDataJSON(), { expectedRevision: 1, spec: { ...expected, enabled: true } });
        const enable = await enabled.json(); assert.equal(enable.revision, 2); await succeeded(enable.operationId);
        const deployed = await readyDeployment(copyResource);
        assert.equal(deployed.stage, 'active'); assert.equal(deployed.renewalAllowed, true); assert.equal(deployed.activatedCount, path.length);
        assert.deepEqual(deployed.nodes.map((node: any) => node.nodeId), path);
        assert.deepEqual(deployed.activationOrder, [...path].reverse()); assert.equal(deployed.trafficVerified, false);
        assert.ok(deployed.nodes.every((node: any, index: number) => node.ready && node.reportFresh &&
            node.role === (index === 0 ? 'multihop-ingress' : index === path.length - 1 ? 'multihop-egress' : 'multihop-transit')));
        await fixture.traffic(fixture.copyPort); await fixture.traffic(fixture.spec.ingress.listen.port);
        await page.locator('[data-action="forward-deployment"][data-id="' + copy.forwardId + '"]').click();
        await page.locator('#deployment-dialog').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#deployment-topology li').count(), path.length);
        await page.screenshot({ path: fixture.directory + '/console-multihop-copy-active-deployment.png', fullPage: true });
        await page.locator('#deployment-close').click();

        const pathSwitch = await verifyPathSwitchConsole(page, context, { ...fixture, copyId: copy.forwardId,
            revision: enable.revision, spec: { ...expected, enabled: true }, succeeded });
        const pathBatch = await verifyPathBatchConsole(page, context, { ...fixture, copyId: copy.forwardId,
            revision: pathSwitch.revision, spec: { ...expected, enabled: true }, succeeded });
        await fixture.slots(copy.forwardId, true); await fixture.traffic(fixture.spec.ingress.listen.port);
        await page.locator('[data-view="forwards"]').click();

        await page.waitForFunction(id => document.querySelector('[data-action="forward-toggle"][data-id="' + id + '"]')?.textContent === '\u505c\u7528', copy.forwardId);
        const [disabled] = await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === copyPath && response.request().method() === 'PUT'), rowToggle.click()
        ]);
        assert.equal(disabled.status(), 202); assert.deepEqual(disabled.request().postDataJSON(), { expectedRevision: pathBatch.revision, spec: expected });
        const disable = await disabled.json(); assert.equal(disable.revision, pathBatch.revision + 1); await succeeded(disable.operationId);
        await fixture.closed(fixture.copyPort); await fixture.slots(copy.forwardId, true);
        await page.waitForFunction(id => document.querySelector('[data-action="forward-toggle"][data-id="' + id + '"]')?.textContent === '\u542f\u7528', copy.forwardId);
        const [deleted] = await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === copyPath && response.request().method() === 'DELETE'),
            page.locator('[data-action="forward-delete"][data-id="' + copy.forwardId + '"]').click()
        ]);
        assert.equal(deleted.status(), 202); assert.deepEqual(deleted.request().postDataJSON(), { expectedRevision: disable.revision });
        await succeeded((await deleted.json()).operationId); await fixture.closed(fixture.copyPort);
        await fixture.slots(copy.forwardId, false); await fixture.onlySourceReservations(); await fixture.traffic(fixture.spec.ingress.listen.port);
        const final = await get(source); assert.equal(final.desired.revision, fixture.revision); assert.deepEqual(final.desired.spec, fixture.spec);
        assert.equal((await get('transport-profiles/' + profileId)).revision, 2);
        assert.equal(writes, 16); assert.equal(previews, 8); assert.equal(pathPreviews, 7); assert.equal(commands.some(command => command.path === sourcePath), false);
        assert.ok(commands.every(command => command.key)); assert.equal(new Set(commands.map(command => command.key)).size, 14);
        assert.deepEqual(commands.filter(command => command.path === sourcePath || command.path === copyPath || command.path === base+'forwards' || command.path === base+'transport-profiles/'+profileId).map(command => command.method), ['PUT', 'POST', 'PUT', 'PUT', 'DELETE']);
        const templates = await verifyPathTemplateConsole(page, context, fixture, path, profileId);
        await fixture.onlySourceReservations(); await fixture.traffic(fixture.spec.ingress.listen.port);
        const afterTemplates = await get(source);
        assert.equal(afterTemplates.desired.revision, fixture.revision); assert.deepEqual(afterTemplates.desired.spec, fixture.spec);
        assert.equal((await get('transport-profiles/' + profileId)).revision, 2);
        assert.equal(writes, 21); assert.equal(previews, 8); assert.equal(pathPreviews, 7); assert.equal(new Set(commands.map(command => command.key)).size, 18);
        assert.equal(commands.some(command => command.path === sourcePath), false);
        return { browser: 'Chromium', nodeCount: path.length, topology: 'independent real Linux Agent processes on one host',
            physicalHostAcceptance: false, defaultOffOptIn: true, profileCurrentRevision: 2, retainedProfileRevision: 1,
            sourceUnchanged: true, orderedPathRetained: true, draftInvalidation: path.length > 3 ? 'transit-reorder-and-restore' : 'target-edit-and-restore',
            freshPlanChecks: previews, pathProposals: pathPreviews, explicitIntentAttempts: writes, disabledCopy: true, disabledResourcesRetained: true,
            tcpUdpVerifiedForSourceAndCopy: true, copyCleanupVerified: true, pathSwitch: pathSwitch.evidence, pathBatch: pathBatch.evidence, templates };
    });
}
