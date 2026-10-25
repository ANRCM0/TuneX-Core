import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

// Actual console assets and DOM; only the resource API and draft handoff are fixtures.
for (const nodeCount of [3,4,8]) test('canvas browser acceptance with '+nodeCount+' machines: replacement, issue focus, gestures and mobile', { timeout: 120000 }, async t => {
  const root = new URL('../../apps/web/', import.meta.url);
  const machineIds=['a',...Array.from({length:nodeCount-2},(_,index)=>'relay-'+index),'c'];
  const fixture = `
    import { initLineBuilder } from '/console/line-builder.js';
    document.querySelector('#view-relay').hidden=false;
    const nodes=${JSON.stringify([...machineIds,'d'])}.map(id=>({id,canUse:true,allowedRoles:null,resourceSource:'private',policy:{allowedListenerAddresses:['127.0.0.1'],allowedPorts:id==='a'?[25565]:[443]}}));
    window.handoffs=[];window.reads=[];
    window.builder=initLineBuilder({byId:id=>document.getElementById(id),notify:(text,error)=>{window.notice={text,error}},
      request:async(method,path)=>{window.reads.push({method,path});if(path==='transport-profiles')return {profiles:[{profileId:'profile-a',currentRevision:1}]};
        if(path.startsWith('transport-profiles/'))return {profileId:'profile-a',revision:1};
        const query=new URL('http://fixture/'+path).searchParams;
        return {page:1,limit:25,total:query.has('nodeId')?1:nodes.length,items:query.has('nodeId')?nodes.filter(n=>n.id===query.get('nodeId')):nodes};},
      loadDraft:async draft=>{window.handoffs.push(draft);return true},useDraft:async draft=>{window.handoffs.push(draft);return true}});
    window.ready=true;
  `;
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url, 'http://fixture').pathname;
      if (path === '/fixture.js') { res.setHeader('content-type','text/javascript'); res.end(fixture); return; }
      const name = path === '/' ? 'index.html' : path.replace(/^\/console\//,'');
      if (!/^[a-zA-Z0-9_./-]+$/.test(name) || name.includes('..')) { res.writeHead(404).end(); return; }
      let body = await readFile(new URL(name, root));
      if (name === 'index.html') body = Buffer.from(body.toString().replace('<script type="module" src="/console/app.js"></script>','<script type="module" src="/fixture.js"></script>'));
      res.setHeader('content-type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[extname(name)] || 'text/plain');res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(10000);
  const directory=process.env.TUNEX_CANVAS_ARTIFACT_DIR || join(tmpdir(),'tunex-canvas-acceptance');await mkdir(directory,{recursive:true});
  t.after(async()=>{if(errors.length)console.log({errors});await page.screenshot({path:join(directory,nodeCount+'-last-state.png'),fullPage:true}).catch(()=>{});});
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.ready);
  await page.locator('#line-resources-refresh').click();await page.waitForFunction(()=>!document.querySelector('#line-resources-refresh').disabled);
  await page.locator('#line-canvas-tab-route').click();await page.locator('#line-profile').selectOption('profile-a');
  async function add(role,id) {
    await page.locator('#line-canvas-add').click();await page.locator('[data-canvas-role="'+role+'"]').click();
    const choices=page.locator('#line-canvas-candidates button');await (id?choices.filter({has:page.getByText(id,{exact:true})}):choices).click();
  }
  await add('ingress','a');for(const id of machineIds.slice(1,-1))await add('transit',id);await add('egress','c');await add('target');
  await page.locator('[data-canvas-field="targetHost"]').fill('example.test');await page.locator('[data-canvas-field="targetPort"]').fill('443');
  await page.locator('#line-canvas-layout').click();await page.waitForFunction(()=>!document.querySelector('.camera-moving'));
  await page.locator('#line-canvas-viewport').scrollIntoViewIfNeeded();
  const cards=[...machineIds.map(id=>page.locator('.fc-node').filter({has:page.getByText(id,{exact:true})})),page.locator('.fc-node.target')];
  cards[0]=page.locator('.fc-node.ingress');
  for(let i=0;i<cards.length-1;i++){
    const out=cards[i].locator('[data-canvas-out]'),incoming=cards[i+1].locator('[data-canvas-in]');
    if(i===0){const start=await out.boundingBox(),end=await incoming.boundingBox();
      await page.mouse.move(start.x+start.width/2,start.y+start.height/2);await page.mouse.down();
      await page.mouse.move(end.x+end.width/2+18,end.y+end.height/2,{steps:12});
      await page.waitForFunction(()=>document.querySelector('.fc-edge.pending.snapped'));await page.mouse.up();
    }else{await out.press('Enter');await incoming.press('Enter');}
  }
  assert.equal(await page.locator('#line-canvas-state').textContent(),'草稿结构完整');
  const first=await cards[0].boundingBox(),beforeDrag=await cards[0].getAttribute('style');
  const retainedEdge=await page.locator('.fc-edge:not(.pending)').first().elementHandle();
  const dragX=first.x+first.width/2,dragY=first.y+Math.min(20,first.height/4);
  await page.mouse.move(dragX,dragY);await page.mouse.down();await page.mouse.move(dragX+30,dragY+30,{steps:8});
  await page.keyboard.press('Escape');await page.mouse.up();assert.equal(await cards[0].getAttribute('style'),beforeDrag);
  await page.mouse.move(dragX,dragY);await page.mouse.down();await page.mouse.move(dragX+30,dragY+30,{steps:8});await page.mouse.up();
  assert.notEqual(await cards[0].getAttribute('style'),beforeDrag);assert.equal(await retainedEdge.evaluate(n=>n.isConnected),true);await retainedEdge.dispose();
  await page.locator('#line-canvas-undo').click();assert.equal(await cards[0].getAttribute('style'),beforeDrag);
  await page.locator('#line-prepare').click();assert.equal(await page.locator('#line-name').evaluate(n=>n===document.activeElement),true);
  await cards[0].click();const layout=await cards[0].getAttribute('style');
  const edges=await page.locator('.fc-edge:not(.pending)').evaluateAll(ns=>ns.map(n=>n.getAttribute('d')));
  await page.locator('[data-canvas-replace]').click();assert.equal(await page.locator('[data-canvas-role="transit"]').isDisabled(),true);
  await page.keyboard.press('Escape');assert.equal(await cards[0].locator('.fc-node-detail').textContent(),'a');
  await page.locator('[data-canvas-replace]').click();await page.locator('#line-canvas-candidates button').filter({has:page.getByText('d',{exact:true})}).click();
  assert.equal(await cards[0].getAttribute('style'),layout);
  assert.deepEqual(await page.locator('.fc-edge:not(.pending)').evaluateAll(ns=>ns.map(n=>n.getAttribute('d'))),edges);
  assert.equal(await page.locator('[data-canvas-field="listenPort"]').inputValue(),'');
  await page.locator('#line-canvas-preview').click();await page.locator('#line-canvas-problems [data-canvas-issue="listener"]').click();
  assert.equal(await page.locator('[data-canvas-field="listenPort"]').evaluate(n=>n===document.activeElement),true);
  await page.locator('#line-use').click();assert.equal(await page.locator('[data-canvas-field="listenPort"]').evaluate(n=>n===document.activeElement),true);
  await page.locator('#line-canvas-undo').click();assert.equal(await cards[0].locator('.fc-node-detail').textContent(),'a');
  await page.locator('#line-canvas-focus').click();assert.equal(await page.locator('#line-canvas').getAttribute('aria-modal'),'true');
  assert.equal(await page.locator('#line-resources-refresh').evaluate(n=>!!n.closest('[inert]')),true);
  await page.locator('#line-canvas-continue').focus();await page.keyboard.press('Tab');assert.equal(await page.locator('#line-canvas').evaluate(n=>n.contains(document.activeElement)),true);
  await page.locator('#line-canvas-preview').click();assert.deepEqual(JSON.parse(await page.locator('#line-canvas-preview-output').textContent()).nodes,machineIds);
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');assert.equal(await page.locator('#line-canvas').getAttribute('role'),'region');
  await page.locator('#line-canvas').screenshot({path:join(directory,nodeCount+'-desktop.png')});
  await page.setViewportSize({width:390,height:844});await page.locator('#line-canvas-focus').click();
  const expanded=await page.locator('#line-canvas').boundingBox();assert.equal(expanded.width,390);assert.equal(expanded.height,844);
  await page.locator('#line-canvas-inspect').click();await page.locator('#line-canvas-tab-route').click();await page.locator('#line-profile').selectOption('profile-a');
  await page.locator('#line-canvas-close').click();await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#line-canvas-fit').click();
  assert.equal(await page.locator('#line-canvas').evaluate(n=>n.classList.contains('camera-moving')),false);
  await page.locator('#line-canvas').screenshot({path:join(directory,nodeCount+'-mobile.png')});
  await page.locator('#line-canvas-continue').click();await page.waitForFunction(()=>window.handoffs.length===1);
  assert.deepEqual(await page.evaluate(()=>window.handoffs[0].nodes),machineIds);
  assert.equal(await page.locator('#line-resources-refresh').evaluate(n=>!!n.closest('[inert]')),false);
  await page.locator('#line-canvas-focus').click();await page.evaluate(()=>window.builder.clear());
  assert.equal(await page.locator('#line-canvas').getAttribute('role'),'region');assert.equal(await page.locator('.fc-node').count(),0);
  assert.equal(await page.evaluate(()=>document.body.classList.contains('fc-editing')),false);
  assert.equal(await page.evaluate(()=>window.reads.every(r=>r.method==='GET')),true);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({scope:'real-browser-fixture-API',nodeCount,directory,backendAcceptance:false}));
});
