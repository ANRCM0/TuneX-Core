import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import type { ForwardSpec } from '@tunex/core';
import type { RelayProfileConfig } from '@tunex/contracts';
import { withBrowser } from './probe-console.ts';
import type { ConsoleFixture } from './probe-console.ts';
import { verifyProfileBatchConsole } from './profile-batch-console.ts';

interface TunnelFixture extends ConsoleFixture {
    sourceId: string; revision: number; spec: ForwardSpec; profile: RelayProfileConfig; unusedListenPort: number;
    traffic(port: number): Promise<void>;
    closed(port: number): Promise<void>;
}

/** Runs only against the existing real Linux Relay fixture, never a mocked browser API. */
export async function verifyTunnelConsole(fixture: TunnelFixture) {
    return withBrowser(fixture, async (page, context) => {
        const base = '/api/v1/scopes/' + fixture.scope + '/', headers = { authorization: 'Bearer ' + fixture.token };
        const profileId = fixture.spec.transport!.profileId, profilePath = base + 'transport-profiles/' + profileId;
        const sourcePath = base + 'forwards/' + fixture.sourceId, egress = fixture.spec.path!.via.at(-1)!;
        async function get(resource: string) {
            const response = await context.request.get(fixture.url + base + resource, { headers, timeout: 5000, maxRedirects: 0 });
            assert.equal(response.status(), 200); return response.json();
        }
        async function succeeded(id: string) {
            const deadline = Date.now() + 60000;
            while (Date.now() < deadline) {
                const operation = await get('operations/' + id);
                if (operation.status === 'succeeded') return;
                assert.notEqual(operation.status, 'failed'); assert.notEqual(operation.status, 'superseded');
                await sleep(250);
            }
            throw Error('Real Relay Console Operation timed out');
        }
        let writes = 0, previews = 0;
        page.on('request', request => {
            const path = new URL(request.url()).pathname;
            if (path === base + 'relay-plan' && request.method() === 'POST') previews++;
            else if (path.startsWith(base) && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method())) writes++;
        });
        async function tunnel(node: string, total: number) {
            await page.locator('[data-view="available"]').click();
            await page.locator('[data-action="node-tunnel"][data-id="' + node + '"]').click();
            await page.waitForFunction(() => document.getElementById('tunnel-status')?.textContent?.includes('peerCredentials'));
            await page.waitForFunction(count => document.getElementById('tunnel-references-meta')?.textContent?.includes('total ' + count + '.'), total);
            assert.match((await page.locator('#tunnel-state').textContent())!, /health UNKNOWN.*no network check/);
            const data = JSON.parse((await page.locator('#tunnel-status').textContent())!);
            assert.equal(data.nodeId, node); assert.ok(data.peerCredentials.recordedWindowCount >= 1 && data.peerCredentials.recordedWindowCount <= 2);
            assert.ok(data.peerCredentials.items.length > 0 && data.peerCredentials.items.length <= 4);
            assert.doesNotMatch(JSON.stringify(data), /BEGIN CERTIFICATE|PRIVATE KEY|enrollmentToken|lastReport\"/);
            assert.equal((await page.locator('#tunnel-reference-rows tr').count()), total);
            return data;
        }
        const initial = await tunnel(egress, 1); assert.equal(initial.endpoint.revision, 1);
        assert.match((await page.locator('#tunnel-reference-rows').textContent())!, /egress.*previous:/);
        await page.screenshot({ path: fixture.directory + '/console-tunnel-metadata-desktop.png', fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        await page.screenshot({ path: fixture.directory + '/console-tunnel-metadata-mobile.png', fullPage: true });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.locator('#tunnel-reference-rows button').click();
        await page.locator('#deployment-dialog').waitFor({ state: 'visible' });
        assert.match((await page.locator('#deployment-state').textContent())!, /active/);
        await page.locator('#deployment-close').click(); assert.equal(writes, 0); assert.equal(previews, 0);

        await page.locator('[data-view="relay"]').click();
        await page.locator('#relay-profile-rows tr').filter({ hasText: profileId }).waitFor();
        await page.locator('#relay-profile-id').fill(profileId);
        const profileForm = page.locator('#relay-profile-form');
        await profileForm.locator('[name="protocol"]').selectOption('both');
        for (const name of ['handshakeTimeoutSeconds', 'idleTimeoutSeconds', 'maxFrameBytes', 'maxUdpDatagramBytes', 'maxConnectionsPerNode'] as const)
            await profileForm.locator('[name="' + name + '"]').fill(String(fixture.profile[name]));
        await profileForm.locator('[name="idleTimeoutSeconds"]').fill(String(fixture.profile.idleTimeoutSeconds + 1));
        const [published] = await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === profilePath && response.request().method() === 'PUT'),
            profileForm.locator('button[type="submit"]').click()
        ]);
        assert.equal(published.status(), 202); assert.equal((await published.json()).revision, 2);
        assert.equal(writes, 1);
        const unchanged = await get('forwards/' + fixture.sourceId);
        assert.equal(unchanged.desired.revision, fixture.revision); assert.equal(unchanged.desired.spec.transport.configRevision, 1);
        await page.locator('#relay-profile-rows tr').filter({ hasText: profileId }).filter({ hasText: 'r2' }).locator('button').nth(1).click();
        await page.waitForFunction(() => document.getElementById('transport-references-meta')?.textContent?.includes('total 1'));
        await page.locator('#transport-target-revision').fill('1');
        const [inspected] = await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === profilePath && new URL(response.url()).search === '?revision=1'),
            page.locator('#transport-revision-inspect').click()
        ]);
        assert.equal(inspected.status(), 200); assert.equal((await inspected.json()).revision, 1);
        await page.locator('#detail-dialog').waitFor({ state: 'visible' }); await page.locator('#close-detail').click();
        await page.locator('#transport-target-revision').fill('2');
        const [impact] = await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === profilePath + '/references' && new URL(response.url()).searchParams.has('targetRevision')),
            page.locator('#transport-references-preview').click()
        ]);
        assert.equal(impact.status(), 200); const proposed = await impact.json();
        assert.equal(proposed.target.revision, 2); assert.equal(proposed.items[0].forwardId, fixture.sourceId);
        assert.equal(proposed.items[0].expectedRevision, fixture.revision); assert.equal(proposed.reserved, false); assert.equal(proposed.fullPlanAuthorization, false);
        await page.getByRole('button', { name: 'Load Editor', exact: true }).click();
        await page.waitForFunction(revision => document.getElementById('relay-submit')?.textContent?.includes('r' + revision), fixture.revision);
        assert.equal(await page.locator('#relay-submit').isDisabled(), true); assert.equal(writes, 1); assert.equal(previews, 0);
        const [planned] = await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === base + 'relay-plan'), page.locator('#relay-preview').click()
        ]);
        assert.equal(planned.status(), 200); assert.equal(planned.request().postDataJSON().transport.configRevision, 2);
        assert.equal((await planned.json()).reserved, false);
        await page.waitForFunction(() => !(document.getElementById('relay-submit') as HTMLButtonElement).disabled);
        const [updated] = await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === sourcePath && response.request().method() === 'PUT'), page.locator('#relay-submit').click()
        ]);
        assert.equal(updated.status(), 202); const accepted = await updated.json();
        assert.equal(updated.request().postDataJSON().expectedRevision, fixture.revision);
        assert.deepEqual(updated.request().postDataJSON().spec.path, fixture.spec.path);
        assert.equal(accepted.revision, fixture.revision + 1); await succeeded(accepted.operationId);
        await fixture.traffic(fixture.spec.ingress.listen.port);
        assert.equal(writes, 2); assert.equal(previews, 1);

        await page.locator('[data-view="forwards"]').click();
        await page.locator('[data-action="forward-copy"][data-id="' + fixture.sourceId + '"]').click();
        await page.waitForFunction(() => document.getElementById('relay-submit')?.textContent?.includes('复制为新'));
        assert.equal(await page.locator('#relay-forward-form [name="enabled"]').isChecked(), false);
        assert.equal(await page.locator('#relay-listen-port').inputValue(), ''); assert.equal(await page.locator('#relay-ingress').isDisabled(), false);
        assert.equal(writes, 2); assert.equal(previews, 1);
        await page.locator('#relay-listen-port').selectOption(String(fixture.unusedListenPort));
        const [copyPlan] = await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === base + 'relay-plan'), page.locator('#relay-preview').click()
        ]);
        assert.equal(copyPlan.status(), 200); assert.equal(copyPlan.request().postDataJSON().transport.configRevision, 2);
        await page.waitForFunction(() => !(document.getElementById('relay-submit') as HTMLButtonElement).disabled);
        const [created] = await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === base + 'forwards' && response.request().method() === 'POST'), page.locator('#relay-submit').click()
        ]);
        assert.equal(created.status(), 202); const copy = await created.json();
        const copySpec = created.request().postDataJSON();
        assert.equal(copySpec.enabled, false); assert.deepEqual(copySpec.path, fixture.spec.path);
        assert.equal(copySpec.transport.configRevision, 2); assert.equal(copySpec.ingress.listen.port, fixture.unusedListenPort);
        assert.notEqual(copy.forwardId, fixture.sourceId); assert.equal(copy.revision, 1); await succeeded(copy.operationId);
        await fixture.closed(fixture.unusedListenPort);
        const copiedMetadata = await tunnel(egress, 2);
        assert.equal(copiedMetadata.endpoint.revision, 1);
        assert.match((await page.locator('#tunnel-reference-rows').textContent())!, /disabled/);
        await page.screenshot({ path: fixture.directory + '/console-tunnel-disabled-copy-references.png', fullPage: true });
        await page.locator('#tunnel-close').click();
        await page.locator('[data-view="forwards"]').click();
        const copyPath = base + 'forwards/' + copy.forwardId;
        const [enabled] = await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === copyPath && response.request().method() === 'PUT'),
            page.locator('[data-action="forward-toggle"][data-id="' + copy.forwardId + '"]').click()
        ]);
        assert.equal(enabled.status(), 202); assert.equal(enabled.request().postDataJSON().expectedRevision, 1);
        await succeeded((await enabled.json()).operationId); await fixture.traffic(fixture.unusedListenPort);
        const batches = await verifyProfileBatchConsole(page, context, { ...fixture, profileId, sourceId: fixture.sourceId,
            sourceRevision: fixture.revision + 1, copyId: copy.forwardId, copyRevision: 2, idleTimeoutSeconds: fixture.profile.idleTimeoutSeconds,
            verifySourceTraffic: () => fixture.traffic(fixture.spec.ingress.listen.port) });
        await page.locator('[data-view="forwards"]').click();
        // Do not click a stale list row while the preceding request handler still refreshes it.
        await page.waitForFunction(id => document.querySelector('[data-action="forward-toggle"][data-id="' + id + '"]')?.textContent === '启用', copy.forwardId);
        const [deleted] = await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === copyPath && response.request().method() === 'DELETE'),
            page.locator('[data-action="forward-delete"][data-id="' + copy.forwardId + '"]').click()
        ]);
        assert.equal(deleted.status(), 202); assert.equal(deleted.request().postDataJSON().expectedRevision, batches.copyRevision);
        await succeeded((await deleted.json()).operationId); await fixture.closed(fixture.unusedListenPort);
        const final = await get('forwards/' + fixture.sourceId);
        assert.equal(final.desired.revision, fixture.revision + 3); assert.equal(final.desired.spec.transport.configRevision, 4);
        assert.equal(writes, 11); assert.equal(previews, 5, 'No hidden plan or command replay');
        return { revision: final.desired.revision as number, spec: final.desired.spec as ForwardSpec,
            evidence: { browser: 'Chromium', topology: 'two real Linux Relay Agents on one host', tunnelQueryMetadataOnly: true,
                immutableInspection: 1, referencedProfileSwitch: true, freshPlanChecks: previews, explicitIntentAttempts: writes, profileBatches: batches.evidence,
                disabledCopy: true, tcpUdpVerifiedAfterSwitchAndCopy: true, cleanupVerified: true, physicalHostAcceptance: false } };
    });
}
