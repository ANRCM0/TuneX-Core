import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/api/app.ts';
import { ControlError } from '../src/application/errors.ts';
import type { ControlApplication } from '../src/application/control.ts';
import type { RuntimeController } from '../src/modules/runtime/controller.ts';
import type { AuthorityStore } from '../src/infrastructure/authority.ts';

function consoleApp() {
  const control = {identity:{authenticate:async () => {throw new ControlError('UNAUTHENTICATED',401,'Valid bearer identity required');}}} as unknown as ControlApplication;
  const authority = {allow:async () => undefined,read:async () => ({maintenance:false})} as unknown as AuthorityStore;
  return createApp(control,{} as RuntimeController,authority);
}
test('same-origin console assets retain content types, no-store and strict CSP', async () => {
  const app=consoleApp();
  for(const [url,contentType] of ([
    ['/console','text/html'],
    ['/console/','text/html'],
    ['/console/app.js','text/javascript'],
    ['/console/model.js','text/javascript'],
    ['/console/relay.js','text/javascript'],
    ['/console/probe.js','text/javascript'],
    ['/console/transport-console.js','text/javascript'],
    ['/console/rule-console.js','text/javascript'],
    ['/console/tunnel-console.js','text/javascript'],
    ['/console/relay-model.js','text/javascript'],
    ['/console/style.css','text/css']
  ] as const)) {
    const response=await app.request(url);
    assert.equal(response.status,200,url);
    assert.ok(response.headers.get('content-type')?.includes(contentType),url);
    assert.equal(response.headers.get('cache-control'),'no-store',url);
    assert.equal(response.headers.get('x-content-type-options'),'nosniff',url);
    assert.equal(response.headers.get('x-frame-options'),'DENY',url);
    assert.ok(response.headers.get('content-security-policy')?.includes("connect-src 'self'"),url);
    assert.ok((await response.text()).length>20,url);
  }
});
test('console API refuses anonymous scoped list access', async () => {
  const app=consoleApp();
  for(const collection of ['nodes','forwards','operations','nodes/candidates','overview','nodes/any/tunnel','nodes/any/tunnel/references']) {
    const response=await app.request('/api/v1/scopes/test-scope/'+collection);
    assert.equal(response.status,401,collection);
    assert.equal((await response.json() as {code:string}).code,'UNAUTHENTICATED');
  }
});
