import assert from 'node:assert/strict';
import type { BrowserContext, Page } from 'playwright';
import type { ConsoleFixture } from './probe-console.ts';

/** Metadata follow-up within the existing real multi-hop browser session, not another execution path. */
export async function verifyPathTemplateConsole(page: Page, context: BrowserContext, fixture: ConsoleFixture,
    nodes: string[], profileId: string) {
    const base = '/api/v1/scopes/' + fixture.scope + '/', templateId = 'console-native-path', resource = 'tunnels/' + templateId;
    const pathname = base + resource, headers = { authorization: 'Bearer ' + fixture.token };
    const attempts: { method: string; key: string | undefined; body: unknown }[] = [];
    let capturedReads = 0;
    page.on('request', request => {
        const path = new URL(request.url()).pathname;
        if (path === pathname && ['PUT', 'DELETE'].includes(request.method()))
            attempts.push({ method: request.method(), key: request.headers()['idempotency-key'], body: request.postDataJSON() });
        if (nodes.slice(1).some(node => path === base + 'nodes/' + node + '/relay-endpoint') && request.method() === 'GET') capturedReads++;
    });
    async function get(revision?: number) {
        const response = await context.request.get(fixture.url + pathname + (revision ? '?revision=' + revision : ''),
            { headers, timeout: 5000, maxRedirects: 0 });
        assert.equal(response.status(), 200); return response.json();
    }
    async function command(method: 'PUT' | 'DELETE', button: string, status: number) {
        const [response] = await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === pathname && response.request().method() === method),
            page.locator('#path-template-' + button).click()
        ]);
        assert.equal(response.status(), status);
        const body = await response.json();
        await page.waitForFunction(() => !(document.getElementById('path-template-id') as HTMLInputElement).disabled);
        return body;
    }
    async function capture() {
        await page.locator('#path-template-capture').click();
        await page.waitForFunction(() => document.getElementById('path-template-state')?.textContent?.includes('Endpoint revisions captured'));
        const locks = JSON.parse((await page.locator('#path-template-endpoints').textContent())!);
        assert.deepEqual(locks.map((item: any) => item.nodeId), nodes.slice(1));
        assert.ok(locks.every((item: any) => Number.isSafeInteger(item.revision) && item.revision > 0)); return locks;
    }
    await page.locator('[data-view="relay"]').click();
    await page.locator('#path-template-id').fill(templateId);
    await page.locator('#path-template-expected').fill('0');
    await page.locator('#path-template-nodes').fill(nodes.join('\n'));
    await page.locator('#path-template-profile').fill(profileId);
    await page.locator('#path-template-profile-revision').fill('1');
    await page.locator('#path-template-protocol').selectOption('both');
    const endpoints = await capture(), config = { version: 1, nodes, protocols: ['tcp', 'udp'], endpoints, transport: { profileId, configRevision: 1 } };

    let lost = false, original: any;
    await page.route('**' + pathname, async route => {
        if (lost || route.request().method() !== 'PUT') { await route.continue(); return; }
        lost = true;
        const response = await route.fetch({ maxRedirects: 0, timeout: 5000 });
        assert.equal(response.status(), 202); original = await response.json();
        await route.abort('failed');
    });
    await page.locator('#path-template-publish').click();
    await page.waitForFunction(() => document.getElementById('path-template-state')?.textContent?.includes('uncertain'));
    assert.equal(original.revision, 1); assert.equal(attempts.length, 1); assert.equal(capturedReads, nodes.length - 1);
    assert.equal(await page.locator('#path-template-nodes').isDisabled(), true);
    assert.equal(await page.locator('#path-template-capture').isDisabled(), true);
    assert.deepEqual(attempts[0]!.body, { expectedRevision: 0, config });
    assert.deepEqual(await command('PUT', 'publish', 202), original);
    assert.deepEqual(attempts[0], attempts[1]); assert.ok(attempts[0]!.key);
    assert.equal(capturedReads, nodes.length - 1, 'An uncertain replay must not replace its reference proposal');
    await page.unroute('**' + pathname);
    const first = await get(1);
    assert.deepEqual(first.config, config); assert.equal(first.referenceAuthorization, 'not-rechecked-by-this-query');
    for (const flag of ['executionAuthorized', 'bindingCreated', 'reserved']) assert.equal(first[flag], false);

    const unchanged = await command('PUT', 'publish', 200);
    assert.equal(unchanged.revision, 1); assert.equal(unchanged.changed, false);
    await page.locator('#path-template-protocol').selectOption('tcp');
    assert.equal(await page.locator('#path-template-endpoints').textContent(), '');
    assert.deepEqual(await capture(), endpoints);
    const changed = await command('PUT', 'publish', 202);
    assert.equal(changed.revision, 2); assert.equal(changed.changed, true); assert.notEqual(changed.configDigest, original.configDigest);
    assert.deepEqual((await get()).config, { ...config, protocols: ['tcp'] });
    assert.deepEqual((await get(1)).config, config);

    await page.locator('#path-template-read-revision').fill('1');
    await page.locator('#path-template-inspect').click();
    await page.waitForFunction(() => document.getElementById('path-template-record')?.textContent?.includes('"revision": 1'));
    assert.equal(await page.locator('#path-template-expected').inputValue(), '2');
    assert.equal(await page.locator('#path-template-profile-revision').inputValue(), '1');
    assert.equal(await page.locator('#path-template-protocol').inputValue(), 'both');
    await page.screenshot({ path: fixture.directory + '/console-multihop-template-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: fixture.directory + '/console-multihop-template-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    const archive = await command('DELETE', 'archive', 202);
    assert.equal(archive.revision, 2); assert.equal(archive.archived, true);
    const history = await get(1); assert.equal(history.archived, true); assert.deepEqual(history.config, config);
    await page.locator('#path-template-inspect').click();
    await page.waitForFunction(() => document.getElementById('path-template-state')?.textContent?.includes('current r2 / archived'));
    assert.equal(attempts.length, 5); assert.equal(new Set(attempts.map(item => item.key)).size, 4);
    assert.ok(attempts.every(item => item.key)); assert.deepEqual(attempts.map(item => item.method), ['PUT', 'PUT', 'PUT', 'PUT', 'DELETE']);
    assert.equal(capturedReads, 2 * (nodes.length - 1));
    assert.deepEqual(attempts[2]!.body, { expectedRevision: 1, config });
    assert.deepEqual(attempts[3]!.body, { expectedRevision: 1, config: { ...config, protocols: ['tcp'] } });
    assert.deepEqual(attempts[4]!.body, { expectedRevision: 2 });
    return { metadataOnly: true, immutableRevisions: 2, profileRevision: 1, explicitIntentAttempts: attempts.length,
        sameKeyLostResponseReplay: true, archivedHistoryRetained: true, executionAuthorized: false, bindingCreated: false, reserved: false };
}
