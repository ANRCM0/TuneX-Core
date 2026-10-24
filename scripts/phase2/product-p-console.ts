import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { withBrowser } from './probe-console.ts';
import type { ConsoleFixture } from './probe-console.ts';

export async function verifyProductUsageConsole(fixture:ConsoleFixture,nodeId:string,actorId:string) {
    await withBrowser(fixture,async page=>{
        await page.setViewportSize({width:390,height:844});await page.locator('[data-view="resources"]').click();
        await page.locator('#payload-node').fill(nodeId);await page.locator('#payload-actor').fill(actorId);
        const [read]=await Promise.all([page.waitForResponse(response=>new URL(response.url()).pathname.endsWith(`/nodes/${nodeId}/payload-limits/${actorId}`)),
            page.locator('#payload-read').click()]);assert.equal(read.status(),200);const value=await read.json();
        assert.equal(value.consumption.status,'fresh');assert.ok(BigInt(value.consumption.usedBytes)>=1024n);
        await page.waitForFunction(()=>document.getElementById('payload-result')?.textContent?.includes('已收到近期用量样本'));
        const text=(await page.locator('#payload-result').textContent())!;
        assert.ok(text.includes(value.consumption.usedBytes+' B'));assert.match(text,/样本余额不构成执行许可/);
        await page.screenshot({path:fixture.directory+'/console-probe-p-usage-mobile.png',fullPage:true});
    });
}

export async function verifyProductConsole(fixture:ConsoleFixture) {
    const actor='p-browser-'+randomUUID().slice(0,8),initial=randomBytes(32).toString('hex'),next=randomBytes(32).toString('hex');
    const checks:string[]=[];let conclusion:'passed'|'failed'='failed';
    try {
        await withBrowser(fixture,async page=>{
            await page.locator('[data-view="members"]').click();
            const [members]=await Promise.all([page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/members')),
                page.locator('#member-refresh').click()]);assert.equal(members.status(),200);
            await page.waitForFunction(()=>! (document.getElementById('member-save') as HTMLButtonElement).disabled);
            await page.locator('#member-actor').fill(actor);await page.locator('#member-role').selectOption('viewer');
            await page.locator('#member-account-mode').selectOption('new');await page.locator('#member-token').fill(initial);
            await page.locator('#member-token-saved').check();
            const [created]=await Promise.all([page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/members/'+actor)&&response.request().method()==='PUT'),
                page.locator('#member-save').click()]);assert.equal(created.status(),202);
            await page.waitForFunction(actor=>document.getElementById('member-receipt')?.textContent?.includes(actor),actor);
            assert.equal(await page.locator('#member-token').inputValue(),'');
            assert.doesNotMatch((await page.locator('#member-receipt').textContent())!,new RegExp(initial));
            await page.screenshot({path:fixture.directory+'/console-probe-p-members-desktop.png',fullPage:true});
            await page.setViewportSize({width:390,height:844});await page.locator('#member-refresh').click();
            await page.waitForFunction(actor=>document.getElementById('member-rows')?.textContent?.includes(actor),actor);
            await page.screenshot({path:fixture.directory+'/console-probe-p-members-mobile.png',fullPage:true});
            checks.push('Actual owner member creation through desktop/mobile Console, original SQL command and cleared initial Token');

            await page.locator('[data-view="overview"]').click();await page.waitForLoadState('networkidle');
            let reads=0,writes=0;
            page.on('request',request=>{
                if(new URL(request.url()).pathname===`/api/v1/scopes/${fixture.scope}/overview`&&request.method()==='GET')reads++;
                if(['POST','PUT','PATCH','DELETE'].includes(request.method()))writes++;
            });
            await page.locator('#read-session-start').click();
            await page.waitForFunction(()=>document.getElementById('read-session-state')?.textContent==='六轮读取已结束。',undefined,{timeout:80000});
            assert.equal(reads,6);assert.equal(writes,0);assert.equal(await page.locator('#read-session-stop').isDisabled(),true);
            await page.waitForTimeout(11000);assert.equal(reads,6,'A seventh automatic read occurred');
            await page.screenshot({path:fixture.directory+'/console-probe-p-six-reads-mobile.png',fullPage:true});
            checks.push('Actual six-round visible-page GET session stops without a seventh read or any mutation');
            const before=reads;await page.locator('#read-session-start').click();
            await page.waitForFunction(()=>document.getElementById('read-session-state')?.textContent?.includes('1/6'));
            await page.locator('[data-view="nodes"]').click();assert.equal(await page.locator('#read-session-stop').isDisabled(),true);
            await page.waitForTimeout(11000);assert.equal(reads,before+1);assert.equal(writes,0);
            checks.push('Changing actual page cancels the next scheduled read');
        });
        await withBrowser({...fixture,token:initial},async(page,context)=>{
            await page.setViewportSize({width:390,height:844});
            assert.equal(await page.locator('[data-view="members"]').isVisible(),false);
            await page.locator('#credential-panel summary').click();
            const [metadata]=await Promise.all([page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/me/credentials'),page.locator('#credential-read').click()]);
            assert.equal(metadata.status(),200);assert.equal((await metadata.json()).actorId,actor);
            await page.locator('#credential-next').fill(next);await page.locator('#credential-saved').check();
            const [rotated]=await Promise.all([page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/me/credentials'&&response.request().method()==='PUT'),
                page.locator('#credential-rotate').click()]);assert.equal(rotated.status(),200);
            await page.waitForFunction(()=>document.getElementById('credential-state')?.textContent?.includes('新 Token 已确认有效'));
            assert.equal(await page.locator('#credential-next').inputValue(),'');
            const old=await context.request.get(fixture.url+'/api/v1/me/credentials',{headers:{authorization:'Bearer '+initial}});
            assert.equal(old.status(),401);
            const current=await context.request.get(fixture.url+'/api/v1/me/credentials',{headers:{authorization:'Bearer '+next}});
            assert.equal(current.status(),200);assert.equal((await current.json()).actorId,actor);
            const denied=await context.request.get(`${fixture.url}/api/v1/scopes/${fixture.scope}/members`,{headers:{authorization:'Bearer '+next}});
            assert.equal(denied.status(),403);
            await page.screenshot({path:fixture.directory+'/console-probe-p-credentials-mobile.png',fullPage:true});
            checks.push('Actual viewer self rotation changes SQL bearer authentication, rejects the old token and retains owner-only member access');
        });
        conclusion='passed';return checks;
    } finally {
        await writeFile(fixture.directory+'/product-p-console.json',JSON.stringify({conclusion,checks,
            viewports:['1440x1000','390x844'],source:'real HTTPS Control, MySQL and Chromium',secretPersistence:'checked by original withBrowser fixture'},null,2));
    }
}
