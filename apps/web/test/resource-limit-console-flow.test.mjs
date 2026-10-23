import test from 'node:test';
import assert from 'node:assert/strict';
import { initResourceLimitConsole, payloadLimitInput, payloadLimitView, personalPayloadLimitView } from '../resource-limit-console.js';

const identity = { scopeId:'scope',nodeId:'node',actorId:'member' };
const startsAt = '2026-11-01T00:00:00.000Z', endsAt = '2026-12-01T00:00:00.000Z';
const policy = { bucketId:'bucket',startsAt,endsAt,bytesPerSecond:0,burstBytes:65536,byteLimit:1024 };
const response = (revision=1) => ({ ...identity,revision,policy:{...policy},
  consumption:{ status:'unavailable',source:'agent-protected-journal',usedBytes:null,remainingBytes:null } });

test('payload editor preserves explicit zero and distinguishes blank unlimited fields', () => {
  const value = payloadLimitInput({startsAt,endsAt,bytesPerSecond:'0',burstBytes:'65536',byteLimit:''},2);
  assert.deepEqual(value,{expectedRevision:2,startsAt,endsAt,bytesPerSecond:0,burstBytes:65536,byteLimit:null});
  for (const fields of [{bytesPerSecond:'',byteLimit:''},{bytesPerSecond:'-1'},{byteLimit:'9007199254740992'},
    {burstBytes:'0'},{burstBytes:'65537'},{startsAt:'2026-11-01T00:00:00Z'},
    {startsAt:'2026-11-01T08:00:00.000+08:00'},{endsAt:startsAt}])
    assert.throws(() => payloadLimitInput({startsAt,endsAt,bytesPerSecond:'1024',burstBytes:'65536',byteLimit:'2048',...fields},0));
});

test('personal view binds all identities and never presents unavailable consumption as zero', () => {
  const value = response(), view = personalPayloadLimitView(value,identity);
  assert.equal(view['每秒双向有效载荷上限'],'0 B/s');
  assert.match(view['消费量与剩余量'],/暂不可用/);
  for (const invalid of [{...value,actorId:'other'},{...value,scopeId:'other'},{...value,nodeId:'other'},
    {...value,extra:true},{...value,consumption:{...value.consumption,usedBytes:0}},
    {...value,policy:{...policy,extra:true}},{...value,policy:{...policy,bytesPerSecond:null,byteLimit:null}}])
    assert.throws(() => payloadLimitView(invalid,identity));
  assert.equal(payloadLimitView({...value,revision:0,policy:null},identity).policy,null);
  assert.throws(() => payloadLimitView({...value,policy:null},identity));
});

function harness(send) {
  const elements = new Map(), notices = [], calls = [];
  const byId = id => {
    if (!elements.has(id)) elements.set(id,{value:'',textContent:'',disabled:false,events:new Map(),
      addEventListener(name,run) { this.events.set(name,run); }});
    return elements.get(id);
  };
  const el = name => byId('payload-'+name);
  let scopeId='scope', govern=true, keys=0;
  const console = initResourceLimitConsole({ byId,canGovern:()=>govern,identity:()=>({scopeId}),
    request:async (...args) => { calls.push(args);return send(...args); },
    notify:(...args)=>notices.push(args),confirm:()=>true,randomUUID:()=> 'command-'+(++keys) });
  const click = async name => { el(name).events.get('click')();await new Promise(resolve=>setImmediate(resolve)); };
  const edit = (name,value) => { el(name).value=value;el(name).events.get('input')?.(); };
  edit('node','node');edit('actor','member');
  return {el,console,calls,notices,click,edit,setScope:value=>{scopeId=value;},govern:value=>{govern=value;}};
}

test('unknown PUT freezes payload and key; replay uses the same CAS rather than a new command', async () => {
  let writes=0;
  const f=harness(async method => {
    if(method==='GET')return {...response(),revision:0,policy:null};
    if(++writes===1)throw Error('response lost');
    return response();
  });
  await f.click('read');
  f.edit('starts',startsAt);f.edit('ends',endsAt);f.edit('rate','0');f.edit('bytes','1024');
  await f.click('save');
  assert.equal(f.el('save').disabled,true);assert.equal(f.el('node').disabled,true);
  assert.equal(f.el('replay').disabled,false);assert.match(f.el('state').textContent,/未确认/);
  await f.click('replay');
  const puts=f.calls.filter(call=>call[0]==='PUT');
  assert.equal(puts.length,2);assert.strictEqual(puts[0][2],puts[1][2]);assert.equal(puts[0][3],puts[1][3]);
  assert.equal(puts[0][2].expectedRevision,0);assert.equal(puts[0][2].bytesPerSecond,0);
  assert.equal(f.el('replay').disabled,true);assert.equal(f.el('revision').value,'1');
});

test('account clear cancels an in-flight read and discards its stale result', async () => {
  let resolveRead;
  const f=harness(() => new Promise(resolve=>{resolveRead=resolve;}));
  const read=f.click('read');await new Promise(resolve=>setImmediate(resolve));
  const signal=f.calls[0][4].signal;f.setScope('other-scope');f.console.clear();
  assert.equal(signal.aborted,true);
  resolveRead(response());await read;
  assert.equal(f.el('revision').value,'');assert.equal(f.el('result').textContent,'');
  assert.equal(f.el('save').disabled,true);
});

test('changed subject and non-governance identity require a fresh authorized read', async () => {
  const f=harness(async()=>response());await f.click('read');
  f.edit('actor','other');assert.equal(f.el('save').disabled,true);
  f.govern(false);await f.click('read');
  assert.equal(f.calls.length,1);assert.match(f.notices.at(-1)[0],/所有者/);
});
