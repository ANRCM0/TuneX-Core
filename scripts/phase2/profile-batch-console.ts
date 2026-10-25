import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import type { BrowserContext, Page } from 'playwright';
import type { ConsoleFixture } from './probe-console.ts';

interface ProfileBatchFixture extends ConsoleFixture {
    profileId: string; sourceId: string; sourceRevision: number; copyId: string; copyRevision: number; idleTimeoutSeconds: number;
    verifySourceTraffic(): Promise<void>;
}

/** The two rules already belong to the real Relay fixture; only one explicit external CAS race is injected. */
export async function verifyProfileBatchConsole(page: Page, context: BrowserContext, fixture: ProfileBatchFixture) {
    if (process.platform !== 'linux' || process.env.GITHUB_ACTIONS !== 'true') throw Error('Profile batch browser acceptance is Actions-only');
    const base = '/api/v1/scopes/' + fixture.scope + '/', profilePath = base + 'transport-profiles/' + fixture.profileId;
    const sourcePath = base + 'forwards/' + fixture.sourceId, copyResource = 'forwards/' + fixture.copyId;
    const headers = { authorization: 'Bearer ' + fixture.token };
    let plans = 0, attempts = 0, publications = 0;
    const sourceCommands: { key: string | undefined; input: any }[] = [];
    page.on('request', request => {
        const path = new URL(request.url()).pathname;
        if (path === base + 'relay-plan' && request.method() === 'POST') plans++;
        if (path === profilePath && request.method() === 'PUT') publications++;
        if ((path === sourcePath || path === base + copyResource) && request.method() === 'PUT') {
            attempts++; if (path === sourcePath) sourceCommands.push({ key: request.headers()['idempotency-key'], input: request.postDataJSON() });
        }
    });
    async function call(method: string, resource: string, data?: unknown, expected = 200) {
        const response = await context.request.fetch(fixture.url + base + resource,
            { method, headers: { ...headers, 'idempotency-key': randomUUID() }, ...(data === undefined ? {} : { data }), timeout: 5000, maxRedirects: 0 });
        assert.equal(response.status(), expected); return response.json();
    }
    async function succeeded(id: string) {
        const deadline = Date.now() + 60000;
        while (Date.now() < deadline) {
            const operation = await call('GET', 'operations/' + id);
            if (operation.status === 'succeeded') return;
            assert.notEqual(operation.status, 'failed'); assert.notEqual(operation.status, 'superseded'); await sleep(250);
        }
        throw Error('Profile batch native Relay Operation timed out');
    }
    async function publish(revision: number) {
        await page.locator('[data-view="relay"]').click();
        await page.locator('#relay-profile-rows tr').filter({ hasText: fixture.profileId }).filter({ hasText: 'r' + (revision - 1) }).waitFor();
        await page.locator('#relay-profile-id').fill(fixture.profileId);
        await page.locator('#relay-profile-form [name="idleTimeoutSeconds"]').fill(String(fixture.idleTimeoutSeconds + revision - 1));
        const [response] = await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === profilePath && response.request().method() === 'PUT'),
            page.locator('#relay-profile-form button[type="submit"]').click()
        ]);
        assert.equal(response.status(), 202); assert.equal((await response.json()).revision, revision);
        await page.locator('#relay-profile-rows tr').filter({ hasText: fixture.profileId }).filter({ hasText: 'r' + revision }).locator('button').nth(1).click();
        await page.locator('#transport-references-dialog').waitFor({ state: 'visible' });
    }
    async function prepare(revision: number, ids: string[], from?: number) {
        await page.locator('#transport-from-revision').fill(from === undefined ? '' : String(from));
        await page.locator('#transport-target-revision').fill(String(revision));
        const [response] = await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === profilePath + '/references' && new URL(response.url()).searchParams.get('targetRevision') === String(revision)),
            page.locator('#transport-references-preview').click()
        ]);
        assert.equal(response.status(), 200); const impact = await response.json();
        assert.equal(impact.target.revision, revision); assert.equal(impact.reserved, false); assert.equal(impact.fullPlanAuthorization, false);
        for (const id of ids) await page.getByRole('checkbox', { name: 'Select Profile Impact Forward ' + id, exact: true }).check();
        const before = attempts, checked = plans;
        await page.locator('#transport-batch-prepare').click();
        await page.locator('#rule-command-dialog').waitFor({ state: 'visible' });
        assert.equal(attempts, before); assert.equal(plans, checked, 'Preparing the frozen batch performed a hidden plan');
        assert.equal(await page.locator('#rule-command-start').isDisabled(), true);
        assert.match((await page.locator('#rule-command-title').textContent())!, new RegExp('r' + revision));
    }

    await publish(3); await prepare(3, [fixture.sourceId, fixture.copyId]);
    const before = await call('GET', copyResource);
    assert.equal(before.desired.revision, fixture.copyRevision);
    // A separate authorized writer changes only the copy after both UI CAS proposals have been frozen.
    const raced = await call('PUT', copyResource, { expectedRevision: fixture.copyRevision, spec: { ...before.desired.spec, enabled: false } }, 202);
    await succeeded(raced.operationId);
    await page.locator('#rule-command-consent').check(); await page.locator('#rule-command-start').click();
    await page.waitForFunction(() => {
        return document.querySelectorAll('#rule-command-rows [data-state="rejected"]').length === 1 && document.querySelectorAll('#rule-command-rows [data-state="accepted"]').length === 1;
    });
    assert.equal(plans, 2); assert.equal(attempts, 2, 'Exactly two original per-rule PUT attempts');
    const sourceRow = page.locator('#rule-command-rows tr').filter({ hasText: fixture.sourceId });
    const accepted = JSON.parse((await sourceRow.locator('td').nth(2).locator('pre').textContent())!);
    assert.equal(accepted.revision, fixture.sourceRevision + 1); await succeeded(accepted.operationId);
    assert.match((await page.locator('#rule-command-rows tr').filter({ hasText: fixture.copyId }).textContent())!, /REVISION_CONFLICT/);
    const sourceAfterBatch = await call('GET', 'forwards/' + fixture.sourceId), copyAfterBatch = await call('GET', copyResource);
    assert.equal(sourceAfterBatch.desired.spec.transport.configRevision, 3); assert.equal(copyAfterBatch.desired.spec.transport.configRevision, 2);
    assert.equal(copyAfterBatch.desired.spec.enabled, false); await fixture.verifySourceTraffic();
    await page.screenshot({ path: fixture.directory + '/console-tunnel-profile-batch-partial-cas.png', fullPage: true });
    await page.locator('#rule-command-close').click();

    await publish(4); await prepare(4, [fixture.sourceId], 3);
    let lose = true, lostAcceptance: any;
    await page.route('**' + sourcePath, async route => {
        if (route.request().method() !== 'PUT' || !lose) { await route.continue(); return; }
        lose = false; const response = await route.fetch({ maxRedirects: 0 });
        assert.equal(response.status(), 202); lostAcceptance = await response.json(); await route.abort('failed');
    });
    await page.locator('#rule-command-consent').check(); await page.locator('#rule-command-start').click();
    await page.waitForFunction(() => document.querySelectorAll('#rule-command-rows [data-state="uncertain"]').length === 1);
    assert.equal(plans, 3); assert.equal(attempts, 3); assert.equal(await page.locator('#rule-command-start').isDisabled(), true);
    await page.screenshot({ path: fixture.directory + '/console-tunnel-profile-batch-uncertain.png', fullPage: true });
    await page.locator('#rule-command-consent').check();
    const [replayed] = await Promise.all([
        page.waitForResponse(response => new URL(response.url()).pathname === sourcePath && response.request().method() === 'PUT'),
        page.getByRole('button', { name: '重试原请求', exact: true }).click()
    ]);
    assert.equal(replayed.status(), 202); assert.deepEqual(await replayed.json(), lostAcceptance);
    await page.waitForFunction(() => document.querySelectorAll('#rule-command-rows [data-state="accepted"]').length === 1);
    await succeeded(lostAcceptance.operationId); await fixture.verifySourceTraffic(); await page.unroute('**' + sourcePath);
    assert.equal(plans, 3, 'Unknown write replay must not obtain another plan or substitute a command');
    assert.equal(attempts, 4); assert.equal(publications, 2);
    const uncertain = sourceCommands.filter(command => command.input.spec.transport.configRevision === 4);
    assert.equal(uncertain.length, 2); assert.ok(uncertain[0]!.key); assert.deepEqual(uncertain[0], uncertain[1]);
    await page.locator('#rule-command-close').click();
    const source = await call('GET', 'forwards/' + fixture.sourceId);
    assert.equal(source.desired.revision, fixture.sourceRevision + 2); assert.equal(source.desired.spec.transport.configRevision, 4);
    return { source, copyRevision: raced.revision as number,
        evidence: { explicitProfilePublications: publications, perRulePlanChecks: plans, uiUpdateAttempts: attempts,
            fixtureExternalCASRaceWrites: 1, independentCASRejection: true, committedResponseLostAndSameKeyReplayed: true,
            noPlanOrCommandSubstitutionOnReplay: true, realSourceTcpUdpVerified: true } };
}
