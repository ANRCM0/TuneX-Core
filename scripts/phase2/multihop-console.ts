import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import type { ForwardSpec } from '@tunex/core';
import type { RelayProfileConfig } from '@tunex/contracts';
import { withBrowser, clickConsoleAction } from './probe-console.ts';
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
    operationProgress(id: string): Promise<{ forwardId: string; revision: number; executionDeadline: number;
        generation: number; stage: string; prepared: number; activated: number }>;
}

async function verifyForwardCanvasDraft(page: import('playwright').Page, fixture: MultihopConsoleFixture, path: string[]) {
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('[data-view="relay"]').click();await page.locator('#line-resources-refresh').click();
    await page.waitForFunction(()=>!(document.getElementById('line-resources-refresh') as HTMLButtonElement).disabled);
    await page.locator('#line-canvas-tab-route').click();
    await page.locator('#line-profile').selectOption(fixture.spec.transport!.profileId);
    const profileOption=await page.locator('#line-profile option:checked').textContent();
    const profileRevision=Number(profileOption!.split(' · r').at(-1));
    assert.ok(Number.isSafeInteger(profileRevision)&&profileRevision>0);
    assert.equal(await page.locator('#line-canvas-progress li').count(),4);
    const addZoom=await page.locator('#line-canvas-zoom').textContent();
    for(const [index,nodeId] of path.entries()) {
        const role=index===0?'ingress':index===path.length-1?'egress':'transit';
        if(!await page.locator('#line-canvas-picker').isVisible())await page.locator('#line-canvas-add').click();
        await page.locator('[data-canvas-role="'+role+'"]').click();
        if(index===1&&path.length>3)await page.locator('#line-canvas-keep-adding').check();
        await page.locator('#line-canvas-candidates button').filter({has:page.getByText(nodeId,{exact:true})}).click();
    }
    if(!await page.locator('#line-canvas-picker').isVisible())await page.locator('#line-canvas-add').click();
    await page.locator('[data-canvas-role="target"]').click();await page.locator('#line-canvas-keep-adding').uncheck();
    await page.locator('#line-canvas-candidates button').click();
    assert.equal(await page.locator('#line-canvas-zoom').textContent(),addZoom);
    const targetCard=await page.locator('.fc-node.target').elementHandle();
    await page.locator('[data-canvas-field="targetHost"]').pressSequentially(fixture.spec.target.host);
    await page.locator('[data-canvas-field="targetHost"]').press('Tab');
    await page.locator('#line-canvas-undo').click();assert.equal(await page.locator('[data-canvas-field="targetHost"]').inputValue(),'');
    await page.locator('#line-canvas-redo').click();assert.equal(await page.locator('[data-canvas-field="targetHost"]').inputValue(),fixture.spec.target.host);
    assert.equal(await targetCard!.evaluate(node=>node.isConnected),true);await targetCard!.dispose();
    await page.locator('[data-canvas-field="targetPort"]').fill(String(fixture.spec.target.port));
    await page.locator('[data-canvas-field="targetPort"]').press('Tab');
    await page.locator('#line-canvas-fit').click();await page.waitForFunction(()=>!document.querySelector('#line-canvas.camera-moving'));
    await page.locator('.fc-node.ingress').click();
    await page.locator('[data-canvas-field="listenAddress"]').selectOption(fixture.spec.ingress.listen.address);
    await page.locator('[data-canvas-field="listenPort"]').selectOption(String(fixture.copyPort));
    await page.locator('#line-canvas-layout').click();
    await page.waitForFunction(()=>!document.querySelector('#line-canvas.camera-moving'));
    // Parameter fields can scroll the document; mouse coordinates must be in the visible viewport.
    await page.locator('#line-canvas-viewport').scrollIntoViewIfNeeded();
    const cards=path.map(nodeId=>page.locator('.fc-node').filter({has:page.getByText(nodeId,{exact:true})}));
    cards.push(page.locator('.fc-node.target'));
    for(let index=0;index<cards.length-1;index++) {
        const out=cards[index]!.locator('[data-canvas-out]'),incoming=cards[index+1]!.locator('[data-canvas-in]');
        if(index===0) {
            const start=(await out.boundingBox())!,end=(await incoming.boundingBox())!;
            await page.mouse.move(start.x+start.width/2,start.y+start.height/2);await page.mouse.down();
            await page.mouse.move(end.x+end.width/2+18,end.y+end.height/2,{steps:12});
            try { await page.waitForFunction(()=>document.querySelector('.fc-edge.pending')?.classList.contains('snapped')); }
            catch(error) {
                await page.locator('#line-canvas').screenshot({path:fixture.directory+'/console-multihop-forward-canvas-drag-failure.png'});
                throw error;
            }
            await page.mouse.up();
        } else {await out.press('Enter');await incoming.press('Enter');}
    }
    assert.equal(await page.locator('#line-canvas-state').textContent(),'草稿结构完整');
    await page.locator('#line-resources-refresh').click();
    await page.waitForFunction(()=>!(document.getElementById('line-resources-refresh') as HTMLButtonElement).disabled);
    assert.equal(await page.locator('.fc-node').count(),path.length+1);
    assert.equal(await page.locator('#line-canvas-state').textContent(),'草稿结构完整');
    await page.locator('#line-canvas-tab-route').click();
    await page.locator('#line-name').fill('');await page.locator('#line-prepare').click();
    assert.equal(await page.locator('#line-name').evaluate(node=>node===document.activeElement),true);
    await page.locator('#line-canvas-preview').click();
    const draft=JSON.parse((await page.locator('#line-canvas-preview-output').textContent())!);
    assert.deepEqual(draft.nodes,path);assert.equal(draft.listenPort,fixture.copyPort);
    assert.equal(draft.targetHost,fixture.spec.target.host);assert.equal(draft.profileRevision,profileRevision);
    assert.equal(Object.hasOwn(draft,'layout'),false);await page.locator('#line-canvas-preview-close').click();
    const entryCard=page.locator('.fc-node.ingress'),entryKey=await entryCard.getAttribute('data-canvas-node');
    const entryLayout=await entryCard.getAttribute('style'),entryHandle=await entryCard.elementHandle();
    await cards[1]!.click();await page.getByRole('button',{name:'从画布移除',exact:true}).click();
    await entryCard.click();await page.locator('[data-canvas-replace]').click();
    assert.equal(await page.locator('#line-canvas-picker-title').textContent(),'更换入口机器');
    assert.equal(await page.locator('[data-canvas-role="egress"]').isDisabled(),true);
    assert.equal(await page.locator('#line-canvas-keep-adding').isVisible(),false);
    await page.locator('#line-canvas-picker-close').click();
    assert.equal(await page.locator('[data-canvas-field="listenPort"]').inputValue(),String(fixture.copyPort));
    await page.locator('[data-canvas-replace]').click();
    const edgesBeforeReplacement=await page.locator('.fc-edge:not(.pending)').evaluateAll(edges=>edges.map(edge=>edge.getAttribute('d')));
    await page.locator('#line-canvas-candidates button').filter({has:page.getByText(path[1]!,{exact:true})}).click();
    assert.equal(await entryHandle!.evaluate(node=>node.isConnected),true);await entryHandle!.dispose();
    assert.equal(await entryCard.getAttribute('data-canvas-node'),entryKey);
    assert.equal(await entryCard.getAttribute('style'),entryLayout);
    assert.equal(await entryCard.locator('.fc-node-detail').textContent(),path[1]);
    assert.deepEqual(await page.locator('.fc-edge:not(.pending)').evaluateAll(edges=>edges.map(edge=>edge.getAttribute('d'))),edgesBeforeReplacement);
    assert.equal(await page.locator('[data-canvas-field="listenPort"]').inputValue(),'');
    await page.locator('#line-canvas-preview').click();
    await page.locator('#line-canvas-problems [data-canvas-issue="listener"]').click();
    assert.equal(await page.locator('#line-canvas-preview-dialog').isVisible(),false);
    assert.equal(await page.locator('[data-canvas-field="listenPort"]').evaluate(node=>node===document.activeElement),true);
    await page.locator('#line-canvas-undo').click();
    assert.equal(await page.locator('[data-canvas-field="listenPort"]').inputValue(),String(fixture.copyPort));
    await page.locator('#line-canvas-undo').click();
    assert.equal(await page.locator('#line-canvas-state').textContent(),'草稿结构完整');
    await page.locator('#line-canvas-focus').click();
    assert.equal(await page.locator('#line-canvas').getAttribute('role'),'dialog');
    assert.equal(await page.locator('#line-resources-refresh').evaluate(node=>!!node.closest('[inert]')),true);
    await page.locator('#line-canvas-continue').focus();await page.keyboard.press('Tab');
    assert.equal(await page.locator('#line-canvas').evaluate(node=>node.contains(document.activeElement)),true);
    await page.locator('#line-canvas-preview').click();
    assert.deepEqual(JSON.parse((await page.locator('#line-canvas-preview-output').textContent())!).nodes,path);
    await page.keyboard.press('Escape');assert.equal(await page.locator('#line-canvas-preview-dialog').isVisible(),false);
    assert.equal(await page.locator('#line-canvas').getAttribute('aria-modal'),'true');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#line-canvas').getAttribute('role'),'region');
    assert.equal(await page.locator('#line-resources-refresh').evaluate(node=>!!node.closest('[inert]')),false);
    await page.waitForFunction(()=>!document.querySelector('#line-canvas.camera-moving'));
    await page.locator('#line-canvas-viewport').scrollIntoViewIfNeeded();
    const first=(await cards[0]!.boundingBox())!;
    const retainedWire=await page.locator('.fc-edge:not(.pending)').first().elementHandle();
    const beforeDrag=await cards[0]!.getAttribute('style');
    await page.mouse.move(first.x+first.width/2,first.y+20);await page.mouse.down();
    await page.mouse.move(first.x+first.width/2+1,first.y+21);await page.mouse.up();
    assert.equal(await cards[0]!.getAttribute('style'),beforeDrag);
    await page.mouse.move(first.x+first.width/2,first.y+20);await page.mouse.down();
    await page.mouse.move(first.x+first.width/2+40,first.y+60,{steps:8});await page.keyboard.press('Escape');await page.mouse.up();
    assert.equal(await cards[0]!.getAttribute('style'),beforeDrag);
    await page.mouse.move(first.x+first.width/2,first.y+20);await page.mouse.down();
    await page.mouse.move(first.x+first.width/2+30,first.y+55,{steps:8});await page.mouse.up();
    assert.equal(await retainedWire!.evaluate(node=>node.isConnected),true);await retainedWire!.dispose();
    await page.locator('#line-canvas-preview').click();
    assert.deepEqual(JSON.parse((await page.locator('#line-canvas-preview-output').textContent())!).nodes,path);
    await page.locator('#line-canvas-preview-close').click();
    await page.locator('#line-canvas-clear').click();assert.equal(await page.locator('.fc-node').count(),0);
    await page.locator('#line-canvas-undo').click();assert.equal(await page.locator('.fc-node').count(),path.length+1);
    await page.locator('#line-canvas').screenshot({path:fixture.directory+'/console-multihop-forward-canvas-desktop.png'});
    const zoomBeforeResize=await page.locator('#line-canvas-zoom').textContent();
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.locator('#line-canvas-zoom').textContent(),zoomBeforeResize);
    if(await page.locator('#line-canvas-close').isVisible())await page.locator('#line-canvas-close').click();
    await page.locator('#line-canvas-fit').click();await page.waitForFunction(()=>!document.querySelector('#line-canvas.camera-moving'));
    await page.locator('.fc-node.target').click();
    await page.locator('#line-canvas-inspector').waitFor({state:'visible'});
    assert.equal(await page.locator('#line-canvas-inspector').isVisible(),true);
    assert.equal(await page.locator('[data-canvas-field="targetHost"]').inputValue(),fixture.spec.target.host);
    await page.locator('#line-canvas-focus').click();
    assert.equal(await page.locator('#line-canvas').getAttribute('aria-modal'),'true');
    const expanded=(await page.locator('#line-canvas').boundingBox())!;
    assert.equal(expanded.width,390);assert.equal(expanded.height,844);
    await page.locator('#line-canvas').screenshot({path:fixture.directory+'/console-multihop-forward-canvas-mobile.png'});
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#line-canvas-inspect').getAttribute('aria-expanded'),'false');
    assert.equal(await page.locator('#line-canvas').getAttribute('aria-modal'),'true');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#line-canvas').getAttribute('role'),'region');
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('#line-use').click();
    await page.waitForFunction(host=>!(document.getElementById('line-use') as HTMLButtonElement).disabled&&
        (document.querySelector('#relay-forward-form [name="targetHost"]') as HTMLInputElement).value===host,fixture.spec.target.host);
    assert.equal(await page.locator('#relay-listen-port').inputValue(),String(fixture.copyPort));
    assert.equal(await page.locator('#relay-forward-form [name="enabled"]').isChecked(),false);
    assert.equal(await page.locator('#relay-submit').isDisabled(),true);
    const [preview]=await Promise.all([page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/relay-plan')&&response.request().method()==='POST'),page.locator('#relay-preview').click()]);
    assert.equal(preview.status(),200);assert.equal((await preview.json()).reserved,false);
    assert.deepEqual(preview.request().postDataJSON().path.via,path.slice(1));
    assert.equal(preview.request().postDataJSON().transport.configRevision,profileRevision);
    await page.waitForFunction(()=>!(document.getElementById('relay-submit') as HTMLButtonElement).disabled);
    await page.locator('#relay-cancel-edit').click();assert.equal(await page.locator('#relay-submit').isDisabled(),true);
    await page.locator('#line-canvas-zoom-in').click();await page.locator('#disconnect').click();
    await page.evaluate(()=>new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done()))));
    assert.equal(await page.locator('.fc-node').count(),0);
    assert.equal(await page.locator('#line-canvas-undo').isDisabled(),true);
    assert.equal(await page.locator('#line-canvas-preview-output').textContent(),'');
    return {nodeCount:path.length,arrowOrderRetained:true,layoutExcluded:true,undoRestored:true,mobileInspector:true,
        originalPlanPreview:true,selectedResourcesReread:true,sessionCleared:true,magneticConnection:true,continuousAdd:path.length>3,
        fieldUndoGrouped:true,retainedDom:true,clickJitterIgnored:true,cancelledDragRestored:true,lateFramesCleared:true,
        zoomRetainedOnAdd:true,zoomRetainedOnResize:true,replacementRetainsLayoutAndEdges:true,replacementUndo:true,
        replacementListenerReauthorization:true,issueFieldFocus:true,focusModeKeyboardAndMobile:true,profileRevision,submitted:false};
}

/** Extends the real multi-Agent fixture; no mocked API or production feature enablement. */
export async function verifyMultihopConsole(fixture: MultihopConsoleFixture) {
    return withBrowser(fixture, async (page, context) => {
        const base = '/api/v1/scopes/' + fixture.scope + '/', headers = { authorization: 'Bearer ' + fixture.token };
        const profileId = fixture.spec.transport!.profileId, path = [fixture.spec.ingress.nodeId, ...fixture.spec.path!.via];
        const source = 'forwards/' + fixture.sourceId, sourcePath = base + source;
        assert.ok([3, 4, 8].includes(path.length)); assert.equal(new Set(path).size, path.length);
        assert.equal(fixture.spec.transport!.configRevision, 1);
        const operationTimings: { id: string; elapsedMs: number; progress: unknown[] }[] = [];
        async function get(resource: string) {
            const response = await context.request.get(fixture.url + base + resource, { headers, timeout: 5000, maxRedirects: 0 });
            assert.equal(response.status(), 200); return response.json();
        }
        async function succeeded(id: string) {
            assert.equal(typeof id, 'string');
            const started = Date.now(), initial = path.length === 8 ? await fixture.operationProgress(id) : undefined;
            const deadline = Math.min(started + Math.max(120000, path.length * 30000), initial?.executionDeadline ?? Infinity);
            let progressedAt = started, checkedAt = started, prepared = initial?.prepared ?? 0, activated = initial?.activated ?? 0;
            const progress: unknown[] = initial ? [{ elapsedMs: 0, ...initial }] : [];
            while (Date.now() < deadline) {
                const operation = await get('operations/' + id);
                if (operation.status === 'succeeded') {
                    operationTimings.push({ id, elapsedMs: Date.now() - started, progress }); return;
                }
                assert.notEqual(operation.status, 'failed'); assert.notEqual(operation.status, 'superseded');
                if (initial && Date.now() - checkedAt >= 5000) {
                    const current = await fixture.operationProgress(id); checkedAt = Date.now();
                    assert.equal(current.forwardId, initial.forwardId); assert.equal(current.revision, initial.revision);
                    assert.equal(current.executionDeadline, initial.executionDeadline);
                    // Renewals and a replacement generation cannot disguise a stalled cursor.
                    if (current.generation === initial.generation && (current.prepared > prepared || current.activated > activated)) {
                        prepared = Math.max(prepared, current.prepared); activated = Math.max(activated, current.activated);
                        progressedAt = checkedAt; progress.push({ elapsedMs: checkedAt - started, ...current });
                    }
                    assert.ok(checkedAt - progressedAt < 120000,
                        JSON.stringify({ message: 'Multi-hop Console made no topology progress', id, elapsedMs: checkedAt - started, current }));
                }
                await sleep(250);
            }
            throw Error(JSON.stringify({ message: 'Real multi-hop Console Operation timed out', id,
                elapsedMs: Date.now() - started, progress }));
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
            else if (pathname.startsWith(base + 'forwards/') &&
                /^[^/]+\/(?:path-preview|tunnel-preview)$/.test(pathname.slice((base + 'forwards/').length)) &&
                request.method() === 'POST') pathPreviews++;
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
        await clickConsoleAction(page, 'forward-copy', fixture.sourceId);
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
        await page.locator('[data-view="available"]').click();
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
        await clickConsoleAction(page, 'forward-deployment', copy.forwardId);
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
            clickConsoleAction(page, 'forward-delete', copy.forwardId)
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
        const canvas=await verifyForwardCanvasDraft(page,fixture,path);
        assert.equal(writes,21);assert.equal(previews,9);await fixture.onlySourceReservations();
        const afterCanvas=await get(source);assert.equal(afterCanvas.desired.revision,fixture.revision);assert.deepEqual(afterCanvas.desired.spec,fixture.spec);
        return { browser: 'Chromium', nodeCount: path.length, topology: 'independent real Linux Agent processes on one host',
            physicalHostAcceptance: false, defaultOffOptIn: true, profileCurrentRevision: 2, retainedProfileRevision: 1,
            sourceUnchanged: true, orderedPathRetained: true, draftInvalidation: path.length > 3 ? 'transit-reorder-and-restore' : 'target-edit-and-restore',
            freshPlanChecks: previews, pathProposals: pathPreviews, explicitIntentAttempts: writes, disabledCopy: true, disabledResourcesRetained: true,
            tcpUdpVerifiedForSourceAndCopy: true, copyCleanupVerified: true, operationTimings,
            pathSwitch: pathSwitch.evidence, pathBatch: pathBatch.evidence, templates, canvas };
    });
}
