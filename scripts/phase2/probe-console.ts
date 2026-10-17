import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import type { BrowserContext, Page } from 'playwright';

interface ConsoleFixture { url: string; scope: string; token: string; directory: string }
async function connect(page: Page, fixture: ConsoleFixture) {
    await page.goto(fixture.url + '/console', { waitUntil: 'networkidle' });
    await page.locator('#scope').fill(fixture.scope);
    await page.locator('#token').fill(fixture.token);
    await page.locator('#connect').click();
    await page.waitForFunction(scope => document.getElementById('connection-indicator')?.textContent?.includes(scope), fixture.scope);
    assert.equal(await page.locator('#token').inputValue(), '');
}
async function noPersistence(context: BrowserContext, page: Page) {
    assert.deepEqual(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })), { local: 0, session: 0 });
    assert.equal((await context.cookies()).length, 0);
}
async function receipt(page: Page, id: string) {
    await page.locator('#probe-id').fill(id);
    await page.locator('#probe-query').click();
    await page.waitForFunction(() => Boolean(document.getElementById('probe-receipt')?.textContent));
    return JSON.parse((await page.locator('#probe-receipt').textContent())!);
}
async function withBrowser<T>(fixture: ConsoleFixture, action: (page: Page, context: BrowserContext) => Promise<T>) {
    if (process.platform !== 'linux' || process.env.GITHUB_ACTIONS !== 'true') throw Error('Browser acceptance is Actions-only');
    const browser = await chromium.launch({ headless: true });
    // Only this ephemeral test context ignores trust for the disposable one-day HTTPS fixture CA.
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    let errors = 0; page.on('pageerror', () => errors++);
    page.on('dialog', dialog => { void dialog.accept(); });
    try {
        await connect(page, fixture);
        const result = await action(page, context);
        await noPersistence(context, page);
        assert.equal(errors, 0, 'Browser JavaScript errors');
        return result;
    } finally { await context.close(); await browser.close(); }
}

export async function verifyDisabledConsole(fixture: ConsoleFixture) {
    await withBrowser(fixture, async page => {
        let posts = 0; page.on('request', request => { if (request.method() === 'POST') posts++; });
        await page.locator('[data-view="probes"]').click();
        assert.equal(await page.locator('#probe-issue').isDisabled(), true);
        await page.locator('#probe-id').fill('unknown-receipt');
        await page.locator('#probe-query').click();
        await page.waitForFunction(() => document.getElementById('probe-state')?.textContent?.includes('unavailable'));
        assert.equal(await page.locator('#probe-receipt').textContent(), '');
        assert.equal(await page.locator('#probe-revoke').isDisabled(), true);
        assert.equal(posts, 0);
    });
}

export async function issueFromConsole(fixture: ConsoleFixture, forwardId: string) {
    return withBrowser(fixture, async page => {
        await page.locator('[data-view="forwards"]').click();
        await page.locator('[data-action="forward-probe"][data-id="' + forwardId + '"]').click();
        await page.waitForFunction(() => document.getElementById('probe-capability')?.textContent?.includes('enabled.'));
        assert.equal(await page.locator('#probe-issue').isDisabled(), false);
        await page.locator('#probe-consent').check();
        const path = `/api/v1/scopes/${fixture.scope}/forwards/${forwardId}/probes`;
        const sent: { key: string | undefined; body: unknown }[] = [];
        let accepted: any, loseReply = true;
        page.on('request', request => {
            if (new URL(request.url()).pathname === path && request.method() === 'POST')
                sent.push({ key: request.headers()['idempotency-key'], body: request.postDataJSON() });
        });
        await page.route('**' + path, async route => {
            if (!loseReply) { await route.continue(); return; }
            loseReply = false;
            const response = await route.fetch({ maxRedirects: 0 });
            assert.equal(response.status(), 202); accepted = await response.json();
            await route.abort('failed');
        });
        await page.locator('#probe-issue').click();
        await page.waitForFunction(() => document.getElementById('probe-state')?.textContent?.includes('uncertain'));
        assert.equal(sent.length, 1, 'No hidden replacement after a lost committed response');
        assert.equal(await page.locator('#probe-timeout').isDisabled(), true);
        const [replay] = await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === path && response.request().method() === 'POST'),
            page.locator('#probe-issue').click()
        ]);
        assert.equal(replay.status(), 202); assert.deepEqual(await replay.json(), accepted);
        await page.waitForFunction(() => Boolean(document.getElementById('probe-acceptance')?.textContent));
        assert.equal(sent.length, 2); assert.ok(sent[0]!.key); assert.deepEqual(sent[0], sent[1]);
        assert.deepEqual(sent[0]!.body, { version: 1, kind: 'tcp-connect', expectedRevision: 1, timeoutMs: 500 });
        assert.equal(await page.locator('#probe-issue').isDisabled(), true);
        const queried = await receipt(page, accepted.probeId);
        assert.equal(queried.health, 'unknown'); assert.equal(queried.report, null);
        await page.locator('#probe-revoke').click();
        // An expired receipt may be pruned by the revocation mutation itself; never assume minimum retention.
        await page.waitForFunction(() => document.getElementById('probe-receipt')?.textContent?.includes('"state": "revoked"') ||
            document.getElementById('probe-state')?.textContent?.includes('unavailable'));
        assert.equal(await page.locator('#probe-revoke').isDisabled(), true);
        await page.screenshot({ path: fixture.directory + '/console-probe-desktop.png', fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Mobile page overflows horizontally');
        await page.screenshot({ path: fixture.directory + '/console-probe-mobile.png', fullPage: true });
        await page.locator('#disconnect').click();
        assert.equal(await page.locator('#probe-id').inputValue(), '');
        assert.equal(await page.locator('#probe-acceptance').textContent(), '');
        assert.equal(await page.locator('#probe-issue').isDisabled(), true);
        return { status: 202, body: accepted, key: sent[0]!.key! };
    });
}

export async function verifyHistoricalConsole(fixture: ConsoleFixture, id: string) {
    await withBrowser(fixture, async page => {
        await page.locator('[data-view="probes"]').click();
        const record = await receipt(page, id);
        assert.equal(record.health, 'unknown'); assert.equal(record.report.historical, true);
        assert.equal(record.report.source, 'agent-reported'); assert.equal(record.report.status, 'connected');
        assert.equal(record.report.applicationPayloadBytes, 0); assert.equal(record.report.applicationHealth, 'unknown');
        assert.match((await page.locator('#probe-state').textContent())!, /Historical/);
        await page.screenshot({ path: fixture.directory + '/console-probe-historical.png', fullPage: true });
    });
}
