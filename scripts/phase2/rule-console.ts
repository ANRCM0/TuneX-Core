import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import { withBrowser } from './probe-console.ts';
import type { ConsoleFixture } from './probe-console.ts';

interface RuleFixture extends ConsoleFixture {
    sourceId: string;
    listenerPorts: [number, number];
    targetPort: number;
    injectFailedOperation(id: string): Promise<void>;
}
async function tcp(port: number, payload: string) {
    await new Promise<void>((resolve, reject) => {
        const socket = createConnection({ host: '127.0.0.1', port }), chunks: Buffer[] = [];
        const timer = setTimeout(() => { socket.destroy(); reject(Error('Browser-created native rule TCP timeout')); }, 4000);
        const finish = (error?: Error) => { clearTimeout(timer); socket.destroy(); if (error) reject(error); else resolve(); };
        socket.once('error', finish); socket.once('connect', () => socket.write(payload));
        socket.on('data', bytes => {
            chunks.push(bytes); const received = Buffer.concat(chunks);
            if (received.length < Buffer.byteLength(payload)) return;
            try { assert.equal(received.toString(), payload); finish(); } catch (error) { finish(error as Error); }
        });
    });
}

export async function verifyRuleConsole(fixture: RuleFixture) {
    await withBrowser(fixture, async (page, context) => {
        const base = '/api/v1/scopes/' + fixture.scope + '/', headers = { authorization: 'Bearer ' + fixture.token };
        const call = async (method: string, resource: string, data?: unknown, expected = 200) => {
            const response = await context.request.fetch(fixture.url + base + resource,
                { method, headers: { ...headers, 'idempotency-key': crypto.randomUUID() }, ...(data === undefined ? {} : { data }), timeout: 5000, maxRedirects: 0 });
            assert.equal(response.status(), expected, 'Fixture API ' + method + ' ' + resource);
            return response.json();
        };
        const succeeded = async (id: string) => {
            for (let i = 0; i < 80; i++) {
                const record = await call('GET', 'operations/' + id);
                if (record.status === 'succeeded') return;
                assert.notEqual(record.status, 'failed', 'Native Console command failed in Runtime');
                assert.notEqual(record.status, 'superseded', 'Native Console command was unexpectedly superseded');
                await sleep(250);
            }
            throw Error('Timed out waiting for actual Agent command completion');
        };
        let mutations = 0;
        page.on('request', request => { if (['POST', 'PUT', 'DELETE'].includes(request.method())) mutations++; });
        await page.locator('[data-view="forwards"]').click();
        const copies: { forwardId: string; revision: number; operationId: string }[] = [];
        for (const port of fixture.listenerPorts) {
            await page.locator('[data-action="forward-copy"][data-id="' + fixture.sourceId + '"]').click();
            await page.waitForFunction(() => document.getElementById('forward-form-title')?.textContent?.includes('复制为新'));
            await page.locator('#forward-form').waitFor({ state: 'visible' });
            assert.equal(await page.locator('#forward-form [name="enabled"]').isChecked(), false);
            assert.equal(await page.locator('#forward-port').inputValue(), '');
            assert.equal(await page.locator('#forward-node').isDisabled(), false);
            assert.equal(mutations, copies.length, 'Preparing a copy must not send intent');
            await page.locator('#forward-port').selectOption(String(port));
            await page.locator('#forward-form [name="targetPort"]').fill(String(fixture.targetPort));
            const [created] = await Promise.all([
                page.waitForResponse(response => new URL(response.url()).pathname === base + 'forwards' && response.request().method() === 'POST'),
                page.locator('#save-forward').click()
            ]);
            assert.equal(created.status(), 202);
            const body = created.request().postDataJSON();
            assert.equal(body.enabled, false); assert.equal(body.ingress.listen.port, port); assert.equal(body.target.port, fixture.targetPort);
            assert.deepEqual(Object.keys(body).sort(), ['enabled', 'ingress', 'protocols', 'target']);
            const result = await created.json(); copies.push(result);
            assert.notEqual(result.forwardId, fixture.sourceId); assert.equal(result.revision, 1);
            await page.locator('[data-action="forward-copy"][data-id="' + result.forwardId + '"]').waitFor();
            await succeeded(result.operationId);
        }
        for (const copy of copies) await page.getByRole('checkbox', { name: '选择转发 ' + copy.forwardId, exact: true }).check();
        await page.locator('#rule-batch-enable').click();
        assert.equal(await page.locator('#rule-command-start').isDisabled(), true);
        assert.equal(mutations, 2, 'Preparing a batch must not send commands');
        const first = copies[0]!, second = copies[1]!;
        const original = await call('GET', 'forwards/' + first.forwardId);
        // A separate authorized writer races the already-frozen UI expectedRevision.
        const concurrent = await call('PUT', 'forwards/' + first.forwardId,
            { expectedRevision: 1, spec: { ...original.desired.spec, enabled: true } }, 202);
        await succeeded(concurrent.operationId);
        await page.locator('#rule-command-consent').check(); await page.locator('#rule-command-start').click();
        await page.waitForFunction(() => {
            return document.querySelectorAll('#rule-command-rows [data-state="rejected"]').length === 1 && document.querySelectorAll('#rule-command-rows [data-state="accepted"]').length === 1;
        });
        assert.equal(mutations, 4, 'Exactly one command per selected rule');
        assert.match((await page.locator('#rule-command-rows tr').nth(0).textContent())!, /REVISION_CONFLICT/);
        const enabled = JSON.parse((await page.locator('#rule-command-rows tr').nth(1).locator('td').nth(2).locator('pre').textContent())!);
        assert.equal(enabled.forwardId, second.forwardId); assert.equal(enabled.revision, 2);
        await succeeded(enabled.operationId);
        for (const port of fixture.listenerPorts) await tcp(port, 'actual-browser-created-native-rule-' + port);
        await page.screenshot({ path: fixture.directory + '/console-probe-rules-partial-cas.png', fullPage: true });
        await page.locator('#rule-command-close').click();
        // Refresh completion clears page selection and exposes the accepted revision, not the old frozen page.
        await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === base + 'forwards' && response.request().method() === 'GET'),
            page.locator('#refresh').click()
        ]);
        await page.waitForFunction(id => document.querySelector('[data-action="forward-detail"][data-id="' + id + '"]')?.closest('tr')?.textContent?.includes('r2'), second.forwardId);
        const read = await call('GET', 'forwards/' + second.forwardId); assert.equal(read.desired.revision, 2);
        await page.getByRole('checkbox', { name: '选择转发 ' + second.forwardId, exact: true }).check();
        await page.locator('#rule-batch-disable').click();
        const path = base + 'forwards/' + second.forwardId, sent: { key: string | undefined; input: unknown }[] = [];
        let loseReply = true, committed: any;
        page.on('request', request => {
            if (request.method() === 'PUT' && new URL(request.url()).pathname === path)
                sent.push({ key: request.headers()['idempotency-key'], input: request.postDataJSON() });
        });
        await page.route('**' + path, async route => {
            if (route.request().method() !== 'PUT' || !loseReply) { await route.continue(); return; }
            loseReply = false;
            const response = await route.fetch({ maxRedirects: 0 }); assert.equal(response.status(), 202);
            committed = await response.json(); await route.abort('failed');
        });
        await page.locator('#rule-command-consent').check(); await page.locator('#rule-command-start').click();
        await page.waitForFunction(() => document.querySelectorAll('#rule-command-rows [data-state="uncertain"]').length === 1);
        assert.equal(sent.length, 1); assert.equal(await page.getByRole('button', { name: '重试原请求', exact: true }).isDisabled(), true);
        await page.locator('#rule-command-consent').check();
        const [replay] = await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === path && response.request().method() === 'PUT'),
            page.getByRole('button', { name: '重试原请求', exact: true }).click()
        ]);
        assert.equal(replay.status(), 202); assert.deepEqual(await replay.json(), committed);
        await page.waitForFunction(() => document.querySelectorAll('#rule-command-rows [data-state="accepted"]').length === 1);
        assert.equal(sent.length, 2); assert.ok(sent[0]!.key); assert.deepEqual(sent[0], sent[1]);
        assert.equal(committed.revision, 3); await succeeded(committed.operationId);
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.screenshot({ path: fixture.directory + '/console-probe-rules-mobile.png', fullPage: true });
        await page.locator('#rule-command-close').click(); await page.setViewportSize({ width: 1440, height: 1000 });
        // Only the disposable test fixture injects this terminal failure; it is not a spontaneous Agent fault claim.
        await fixture.injectFailedOperation(committed.operationId);
        await page.locator('#refresh').click(); await page.locator('[data-view="operations"]').click();
        await page.locator('[data-action="operation-retry"][data-id="' + committed.operationId + '"]').click();
        await page.waitForFunction(() => document.getElementById('rule-command-title')?.textContent?.startsWith('重试失败操作'));
        await page.locator('#rule-command-consent').check();
        const [retry] = await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === base + 'operations/' + committed.operationId + '/retry'),
            page.locator('#rule-command-start').click()
        ]);
        assert.equal(retry.status(), 202); assert.deepEqual(retry.request().postDataJSON(), { expectedRevision: 3 });
        const newAttempt = await retry.json(); assert.notEqual(newAttempt.operationId, committed.operationId);
        assert.equal(newAttempt.sourceOperationId, committed.operationId); assert.equal(newAttempt.revision, 3);
        await succeeded(newAttempt.operationId);
        const final = await call('GET', 'forwards/' + second.forwardId);
        assert.equal(final.desired.revision, 3); assert.equal(final.desired.spec.enabled, false);
        const source = await call('GET', 'forwards/' + fixture.sourceId);
        assert.equal(source.desired.revision, 1, 'Copy and batch must never update the source Forward');
        await page.screenshot({ path: fixture.directory + '/console-probe-rules-explicit-retry.png', fullPage: true });
    });
}
