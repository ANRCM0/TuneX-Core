import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Run the built-CSS HTTP fixture first. This checks the production components,
// browser permissions and request contract; it does not emulate an Agent.
const fixture = "http://127.0.0.1:41975";
const artifacts = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../test-artifacts");
const profile = await mkdtemp(resolve(tmpdir(), "tunex-forward-browser-"));
const chrome = process.env.TUNEX_TEST_CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const processHandle = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-port=41976", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
let socket;
const evidence = { scope: "Isolated HTTP fixture with compiled production CSS, no real Agent", date: new Date().toISOString(), scenarios: [], responsive: [], mutations: [] };
const assert = (ok, message) => { if (!ok) throw new Error(message); };
async function until(run, message, timeout = 12000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await run()) return; await sleep(80); }
  throw new Error(message);
}
try {
  await mkdir(artifacts, { recursive: true });
  await fetch(`${fixture}/__test/reset`, { method: "POST" });
  await until(async () => { try { return (await fetch("http://127.0.0.1:41976/json/version")).ok; } catch { return false; } }, "Chrome failed to start");
  const page = await fetch(`http://127.0.0.1:41976/json/new?${fixture}/?locale=en`, { method: "PUT" }).then((r) => r.json());
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((done, fail) => { socket.onopen = done; socket.onerror = fail; });
  let serial = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => { const reply = JSON.parse(String(data)); const call = pending.get(reply.id); if (call) { pending.delete(reply.id); clearTimeout(call.timeout); if (reply.error) call.fail(new Error(JSON.stringify(reply.error))); else call.done(reply.result); } };
  function send(method, params = {}) {
    const id = ++serial;
    return new Promise((done, fail) => {
      const timeout = setTimeout(() => { pending.delete(id); fail(new Error(`CDP timeout: ${method}`)); }, 15000);
      pending.set(id, { done, fail, timeout }); socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(`${expression}: ${JSON.stringify(result.exceptionDetails)}`);
    return result.result.value;
  }
  const text = (scope = "body") => evaluate(`document.querySelector(${JSON.stringify(scope)})?.innerText ?? ''`);
  const click = (label, scope = "body") => evaluate(`(() => {const b=[...document.querySelector(${JSON.stringify(scope)}).querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('Button unavailable: '+${JSON.stringify(label)});b.click();return true;})()`);
  const fill = (values) => evaluate(`(() => {for(const [label,value] of Object.entries(${JSON.stringify(values)})){const e=[...document.querySelector('[role=dialog]').querySelectorAll('input,select')].find(e=>e.getAttribute('aria-label')===label);if(!e)throw Error('Input missing: '+label);const native=e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(native,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}return true;})()`);
  const close = async () => { await click("Close", "[role=dialog]"); await until(async () => !await evaluate("!!document.querySelector('[role=dialog]')"), "Dialog did not close"); };
  const calls = () => fetch(`${fixture}/__test/state`).then((r) => r.json()).then((r) => r.data.calls);
  await until(async () => (await text()).includes("Native fixture"), "Forward list failed to load");
  await click("Native fixture");
  await until(async () => (await text("[role=dialog]")).includes("Desired revision"), "Drawer failed to open");
  for (const width of [360, 390, 768, 1024, 1280, 1536]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 844, deviceScaleFactor: 1, mobile: false });
    const metric = await evaluate(`(() => {const d=document.querySelector('[role=dialog]'),r=d.getBoundingClientRect();return {width:innerWidth,pageWidth:document.documentElement.scrollWidth,dialog:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,scrollWidth:d.scrollWidth,clientWidth:d.clientWidth,overflowY:getComputedStyle(d).overflowY}};})()`);
    assert(metric.pageWidth <= width, `Page overflow at ${width}`);
    assert(metric.dialog.left >= -1 && metric.dialog.right <= width + 1, `Drawer outside viewport at ${width}`);
    assert(metric.dialog.scrollWidth <= metric.dialog.clientWidth + 1, `Drawer horizontal overflow at ${width}`);
    evidence.responsive.push(metric);
    if ([390, 1536].includes(width)) {
      const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      await writeFile(resolve(artifacts, `unified-forward-drawer-${width}.png`), Buffer.from(shot.data, "base64"));
    }
  }
  await close();
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  const initialMutationCount = (await calls()).filter((c) => c.method !== "GET").length;
  await click("Create Forward");
  await fill({ Name: "Browser Native", "Ingress node": "11", "Target host": "127.0.0.1", "Target port": "9000" });
  await click("Create Forward", "[role=dialog]");
  await until(async () => (await text("[role=dialog]")).includes("Browser Native"), "Created Native drawer did not open");
  assert((await text("[role=dialog]")).includes("Configuration pending"), "Accepted creation claimed runtime readiness");
  let mutations = (await calls()).filter((c) => c.method !== "GET").slice(initialMutationCount);
  assert(mutations.length === 1 && mutations[0].path === "/api/forward-operations", "Creation must submit one business operation");
  assert(mutations[0].workspaceId === 5 && mutations[0].body.listen_port === null, "Creation must be scoped and allow auto port");
  assert((await calls()).some((c) => c.path.startsWith("/api/forward-operations/") && c.method === "GET"), "Asynchronous creation did not poll its durable receipt");
  await close();
  await sleep(5_500);
  assert(!await evaluate("!!document.querySelector('[role=dialog]')"), "Operation polling reopened a detail the user closed");
  await until(async () => (await text()).includes("Browser Native"), "Asynchronously created row did not appear");
  await click("Browser Native");
  await fetch(`${fixture}/__test/complete`, { method: "POST" });
  await until(async () => (await text("[role=dialog]")).includes("Runtime ready"), "Terminal operation failed to refresh runtime facts");
  evidence.scenarios.push("Native auto-port creation handles a 202 receipt without forward_id, polls and opens the new resource once, submits exactly one scoped business request and displays configuration pending; closing the detail persists across polling");
  await click("Suspend", "[role=dialog]");
  await until(async () => (await text("[role=dialog]")).includes("Suspended"), "Suspend did not update desired state");
  await click("Resume", "[role=dialog]");
  await until(async () => (await text("[role=dialog]")).includes("Configuration pending"), "Resume did not remain pending");
  await click("Edit Forward", "[role=dialog]");
  await fill({ Name: "Browser Native Edited" });
  await click("Save", "[role=dialog]");
  await until(async () => (await text("[role=dialog]")).includes("Browser Native Edited"), "Edit did not refresh detail");
  await click("History", "[role=dialog]");
  await until(async () => (await text("[role=tabpanel]")).includes("Desired revision"), "History failed to load");
  await click("Diagnosis", "[role=dialog]");
  await click("Run diagnosis", "[role=dialog]");
  await until(async () => (await text("[role=tabpanel]")).includes("Connectivity unverified"), "Node facts fabricated a probe success");
  await click("Delete", "[role=dialog]");
  assert(!(await calls()).some((c) => c.body?.action === "delete"), "Delete happened before confirmation");
  await click("Confirm deletion", "[role=dialog]");
  await until(async () => !await evaluate("!!document.querySelector('[role=dialog]')"), "Deletion dialog stayed open");
  evidence.scenarios.push("Edit uses revision CAS; suspend/resume, history, unverified diagnosis and confirmed deletion stay on Forward APIs");
  await until(async () => (await text()).includes("Secure fixture"), "List did not reload after deletion");
  await evaluate("[...document.querySelectorAll('tr')].find(r=>r.textContent.includes('Secure fixture')).querySelectorAll('button')[3].click()");
  await until(async () => await evaluate("!!document.querySelector('[role=dialog] form')"), "Copy form did not open");
  assert(await evaluate("document.querySelector('[role=dialog] select[aria-label=\"Inter-node transport\"]').value==='tst_v1'"), "Encrypted copy downgraded transport");
  assert(await evaluate("document.querySelector('[role=dialog] button[type=submit]').disabled"), "Disabled TST copy was allowed");
  await close();
  await click("Enable fixture TST");
  await until(async () => await evaluate("document.querySelector('main').dataset.fixtureEpoch==='1'") && (await text()).includes("Secure fixture"), "Enabled fixture failed to reload");
  await evaluate("[...document.querySelectorAll('tr')].find(r=>r.textContent.includes('Secure fixture')).querySelectorAll('button')[3].click()");
  await until(async () => await evaluate("!!document.querySelector('[role=dialog] form')"), "Enabled copy form did not open");
  await fill({ Name: "Browser Encrypted Copy", "Business protocol": "both" });
  await until(async () => !await evaluate("document.querySelector('[role=dialog] button[type=submit]').disabled"), "Fresh TST capabilities were rejected");
  await click("Create Forward", "[role=dialog]");
  await until(async () => (await text("[role=dialog]")).includes("Browser Encrypted Copy"), "Encrypted copy did not complete");
  await close();
  mutations = (await calls()).filter((c) => c.method !== "GET");
  const encrypted = mutations.find((c) => c.body?.name === "Browser Encrypted Copy");
  assert(encrypted?.path === "/api/forward-operations" && encrypted.body.transport === "tst_v1" && encrypted.body.protocol === "both" && encrypted.body.listen_port === null, "Copy failed to retain encrypted business configuration");
  evidence.scenarios.push("TST copy preserves encryption, defaults to a new port and is blocked until capabilities and feature flag permit creation");
  await click("Toggle fixture reader");
  await until(async () => await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Create Forward')?.disabled"), "Reader retained create permission");
  assert(await evaluate("[...document.querySelectorAll('tr button')].filter(b=>['Edit Forward','Copy Forward','Suspend','Resume','Retry','Delete'].includes(b.textContent.trim())).every(b=>b.disabled)"), "Reader retained a mutation action");
  assert((await text()).includes("Your role cannot create Forwards"), "Disabled permission explanation missing");
  await click("Toggle fixture reader");
  await click("Delay fixture requests");
  await click("Switch fixture workspace");
  await until(async () => (await text()).includes("Workspace 6") && (await text()).includes("No Forwards match"), "Workspace did not settle");
  assert(!(await text()).includes("Secure fixture") && !await evaluate("!!document.querySelector('[role=dialog]')"), "Late request revived previous workspace UI");
  evidence.scenarios.push("Reader permissions disable all business mutations with a visible explanation; delayed previous-workspace requests cannot revive rows or dialogs");
  evidence.mutations = (await calls()).filter((c) => c.method !== "GET");
  assert(evidence.mutations.every((c) => !c.path.includes("/links")), "Frontend submitted a Link mutation");
  evidence.status = "passed";
  await writeFile(resolve(artifacts, "unified-forward-browser-evidence.json"), JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify({ status: "passed", scenarios: evidence.scenarios.length, breakpoints: evidence.responsive.length, artifacts }, null, 2));
} finally {
  socket?.close(); processHandle.kill();
  // mkdtemp is exclusively owned by this test. Chrome may retain file locks briefly.
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
