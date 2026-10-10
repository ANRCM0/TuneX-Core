import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";
import dgram from "node:dgram";

// The local integration harness must have completed successfully with --keep.
// Credentials stay in the private fixture; auth traffic is never captured.
const fixture = JSON.parse(await readFile(process.argv[2], "utf8"));
const app = new URL(process.argv[3] ?? "http://127.0.0.1:41000");
const readyFile = process.env.TUNEX_REAL_BROWSER_READY_FILE;
if (!["127.0.0.1", "localhost"].includes(app.hostname) || !Number.isInteger(fixture.workspace_id)) throw new Error("isolated_local_fixture_required");
const artifacts = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../test-artifacts");
const profile = await mkdtemp(resolve(tmpdir(), "tunex-real-ui-browser-"));
const chrome = process.env.TUNEX_TEST_CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-port=41976", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
const evidence = { scope: "Actual Next application + real isolated local Panel/Worker/MySQL/Redis/two Agents; loopback TCP/UDP; not Linux/public deployment", date: new Date().toISOString(), workspaceId: fixture.workspace_id, scenarios: [], responsive: [], network: [], payloads: [], diagnosis: [], runtimeErrors: [] };
const activeRules = new Set();
const connections = new Set();
let socket, evaluate, send;
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
const assert = (ok, code) => { if (!ok) throw new Error(code); };
async function until(run, code, timeout = 60000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await run()) return; await delay(150); }
  throw new Error(code);
}
const echo = net.createServer((connection) => { connections.add(connection); connection.on("error", () => {}); connection.once("close", () => connections.delete(connection)); connection.pipe(connection); });
await new Promise((done) => echo.listen(0, "127.0.0.1", done));
const targetPort = echo.address().port;
const udpEcho = dgram.createSocket("udp4");
udpEcho.on("message", (data, remote) => udpEcho.send(data, remote.port, remote.address));
await new Promise((done) => udpEcho.bind(targetPort, "127.0.0.1", done));
async function tcpPayload(port, label) {
  await new Promise((done, fail) => {
    const connection = net.connect({ host: fixture.ingress.connect_ip, port });
    const expected = Buffer.from(`TuneX browser ${label}`); let response = Buffer.alloc(0);
    connection.setTimeout(8000, () => connection.destroy(new Error("payload_timeout")));
    connection.once("error", () => fail(new Error("tcp_payload_failed")));
    connection.on("data", (data) => { response = Buffer.concat([response, data]); if (response.length >= expected.length) { connection.destroy(); response.equals(expected) ? done() : fail(new Error("tcp_payload_mismatch")); } });
    connection.once("connect", () => connection.write(expected));
  });
  evidence.payloads.push({ protocol: "tcp", label, pass: true });
}
async function udpPayload(port, label) {
  const connection = dgram.createSocket("udp4"); const expected = Buffer.from(`TuneX browser ${label}`);
  try { await new Promise((done, fail) => {
    const timer = setTimeout(() => fail(new Error("udp_payload_timeout")), 8000);
    connection.once("message", (data) => { clearTimeout(timer); data.equals(expected) ? done() : fail(new Error("udp_payload_mismatch")); });
    connection.send(expected, port, fixture.ingress.connect_ip);
  }); } finally { connection.close(); }
  evidence.payloads.push({ protocol: "udp", label, pass: true });
}
async function listenerClosed(port) {
  return new Promise((done) => {
    const connection = net.connect({ host: fixture.ingress.connect_ip, port });
    connection.setTimeout(1000, () => connection.destroy());
    connection.once("connect", () => { connection.destroy(); done(false); });
    connection.once("error", () => done(true));
    connection.once("close", () => done(true));
  });
}
try {
  await mkdir(artifacts, { recursive: true });
  await until(async () => { try { return (await fetch("http://127.0.0.1:41976/json/version")).ok; } catch { return false; } }, "browser_start_failed", 15000);
  const page = await fetch("http://127.0.0.1:41976/json/new?about:blank", { method: "PUT" }).then((r) => r.json());
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((done, fail) => { socket.onopen = done; socket.onerror = fail; });
  let serial = 0; const pending = new Map(); const requests = new Map();
  socket.onmessage = ({ data }) => {
    const reply = JSON.parse(String(data)); const call = pending.get(reply.id);
    if (call) { pending.delete(reply.id); clearTimeout(call.timeout); reply.error ? call.fail(new Error("browser_command_failed")) : call.done(reply.result); }
    if (reply.method === "Network.requestWillBeSent") {
      const request = reply.params.request; const pathname = new URL(request.url).pathname;
      if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")) {
        const metadata = { path: pathname, method: request.method, workspaceId: Number(request.headers["x-workspace-id"] ?? request.headers["X-Workspace-Id"]) || null };
        if (pathname === "/api/forward-operations" && request.method === "POST") {
          try { const input = JSON.parse(request.postData); metadata.input = { name: input.name, path: input.path, transport: input.transport, protocol: input.protocol, listen_port: input.listen_port, ingress_node_id: input.ingress_node_id, egress_node_id: input.egress_node_id }; } catch {}
        }
        requests.set(reply.params.requestId, metadata); evidence.network.push(metadata);
      }
    }
    if (reply.method === "Network.responseReceived") { const metadata = requests.get(reply.params.requestId); if (metadata) metadata.status = reply.params.response.status; }
    if (reply.method === "Runtime.exceptionThrown") evidence.runtimeErrors.push({ type: reply.params.exceptionDetails.exception?.className ?? "JavaScriptError" });
  };
  send = (method, params = {}) => new Promise((done, fail) => {
    const id = ++serial; const timeout = setTimeout(() => { pending.delete(id); fail(new Error("browser_command_timeout")); }, 20000);
    pending.set(id, { done, fail, timeout }); socket.send(JSON.stringify({ id, method, params }));
  });
  evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error("browser_script_failed"); // Never echo expressions containing credentials.
    return result.result.value;
  };
  await send("Network.enable"); await send("Runtime.enable"); await send("Page.enable");
  await send("Network.setCookie", { name: "tunex_locale", value: "en", url: app.origin, path: "/" });
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  const text = (scope = "body") => evaluate(`document.querySelector(${JSON.stringify(scope)})?.innerText ?? ''`);
  const click = (label, scope = "body") => evaluate(`(() => {const b=[...document.querySelector(${JSON.stringify(scope)}).querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('button_unavailable');b.click();return true;})()`);
  const fill = (values, scope = "[role=dialog]") => evaluate(`(() => {for(const [label,value] of Object.entries(${JSON.stringify(values)})){const e=[...document.querySelector(${JSON.stringify(scope)}).querySelectorAll('input,select')].find(e=>e.getAttribute('aria-label')===label||e.name===label);if(!e)throw Error('input_missing');const p=e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}return true;})()`);
  const close = async () => { await click("Close", "[role=dialog]"); await until(async () => !await evaluate("!!document.querySelector('[role=dialog]')"), "dialog_close_failed"); };
  const readApi = (path, method = "GET", body) => evaluate(`(async () => {const r=await fetch(${JSON.stringify(path)},{method:${JSON.stringify(method)},headers:{'x-workspace-id':${JSON.stringify(String(fixture.workspace_id))},'Content-Type':'application/json','X-CSRF-Token':'1'},${body === undefined ? "" : `body:JSON.stringify(${JSON.stringify(body)}),`}credentials:'include'});const v=await r.json();return {status:r.status,data:v.data??v,code:v.code??null};})()`);
  await send("Page.navigate", { url: `${app.origin}/login?next=%2Fforwards` });
  await until(async () => await evaluate("!!document.querySelector('[data-testid=email-input]') && Object.keys(document.querySelector('[data-testid=email-input]')).some(k=>k.startsWith('__reactFiber'))"), "login_hydration_failed");
  await fill({ email: fixture.member.email, password: fixture.member.password }, "[data-testid=login-form]");
  await evaluate("document.querySelector('[data-testid=auth-submit]').click()");
  await until(async () => await evaluate("location.pathname==='/forwards' && !!document.querySelector('[data-testid=workspace-switcher]')"), "real_ui_login_failed");
  await until(async () => await evaluate("Object.keys(document.querySelector('[data-testid=workspace-switcher]')).some(k=>k.startsWith('__reactFiber'))") && await evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Create Forward')"), "workspace_hydration_failed");
  await evaluate("document.querySelector('[data-testid=workspace-switcher]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'mouse',button:0,ctrlKey:false}))");
  await until(async () => await evaluate(`!!document.querySelector('[data-testid="workspace-option-${fixture.workspace_id}"]')`), "fixture_workspace_missing");
  await evaluate(`document.querySelector('[data-testid="workspace-option-${fixture.workspace_id}"]').click()`);
  await until(async () => await evaluate(`document.cookie.includes('tunex_workspace=w${fixture.workspace_id}')`) && await evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Create Forward'&&!b.disabled)"), "workspace_permission_load_failed");
  assert(!await evaluate("!!document.querySelector('[data-testid=mock-badge]')"), "mock_mode_was_enabled");
  evidence.scenarios.push("Member logged in through actual form and selected the authorized workspace in the UI; mock mode absent");
  console.log("Actual UI login and authorized workspace ready.");
  if (readyFile) await until(async () => { try { return (await readFile(readyFile, "utf8")).trim() === "ready"; } catch { return false; } }, "harness_ready_signal_timeout", 1200000);
  async function create(name, transport, protocol, route, listenPort) {
    const before = evidence.network.filter((r) => r.method === "POST" && r.path === "/api/forward-operations").length;
    await click("Create Forward");
    await fill({ Name: name, "Forward path": route });
    await fill({ "Ingress node": String(fixture.ingress.id), "Target host": "127.0.0.1", "Target port": String(targetPort), "Business protocol": protocol, "Ingress port": String(listenPort) });
    if (route === "relay") await fill({ "Egress node": String(fixture.egress.id), "Inter-node transport": transport });
    await until(async () => !await evaluate("document.querySelector('[role=dialog] button[type=submit]').disabled"), "creation_capability_gate_failed");
    await click("Create Forward", "[role=dialog]");
    await until(async () => evidence.network.filter((r) => r.method === "POST" && r.path === "/api/forward-operations").slice(before).some((r) => [200, 202].includes(r.status)), "creation_receipt_failed");
    await until(async () => (await readApi(`/api/forwards?page=1&page_size=20&keyword=${encodeURIComponent(name)}`)).data.data?.some((r) => r.name === name), "created_forward_missing");
    const row = (await readApi(`/api/forwards?page=1&page_size=20&keyword=${encodeURIComponent(name)}`)).data.data.find((r) => r.name === name);
    activeRules.add(row.id);
    await until(async () => !await evaluate("!!document.querySelector('[role=dialog] form')"), "creation_form_not_closed");
    if (!await evaluate("!!document.querySelector('[role=dialog]')")) {
      await until(async () => (await text()).includes(name), "created_ui_row_missing");
      await click(name);
    }
    await until(async () => (await text("[role=dialog]")).includes(name), "created_detail_missing");
    await until(async () => { const detail = (await readApi(`/api/forwards/${row.id}`)).data; return detail.lifecycle?.deployment === "confirmed" && detail.listen_port; }, "real_agent_deployment_timeout");
    const detail = (await readApi(`/api/forwards/${row.id}`)).data;
    const submitted = evidence.network.filter((r) => r.method === "POST" && r.path === "/api/forward-operations").slice(before);
    assert(submitted.length === 1 && submitted[0].workspaceId === fixture.workspace_id && submitted[0].input?.transport === transport && submitted[0].input.listen_port === listenPort, "creation_single_scoped_request_failed");
    assert(detail.transport === transport && detail.protocol === protocol, "requested_transport_or_protocol_changed");
    return detail;
  }
  const suffix = Date.now();
  const native = await create(`Browser real Native ${suffix}`, "native_plain", "tcp", "direct", 25120);
  await tcpPayload(native.listen_port, "native_created_via_UI");
  await click("Delete", "[role=dialog]"); await click("Confirm deletion", "[role=dialog]");
  await until(() => listenerClosed(native.listen_port), "native_listener_not_removed"); activeRules.delete(native.id);
  await until(async () => !await evaluate("!!document.querySelector('[role=dialog]')"), "native_delete_ui_failed");
  evidence.scenarios.push("Actual Native direct TCP created through one UI request on an isolated test port; real payload echoed; UI deletion removed listener");
  const name = `Browser real TST ${suffix}`;
  const secure = await create(name, "tst_v1", "both", "relay", 25121);
  await tcpPayload(secure.listen_port, "TST_TCP_created_via_UI"); await udpPayload(secure.listen_port, "TST_UDP_created_via_UI");
  await until(async () => (await readApi(`/api/forwards/${secure.id}`)).data.lifecycle?.runtime === "ready", "fresh_runtime_readiness_missing");
  for (const width of [360, 390, 768, 1024, 1280, 1536]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 844, deviceScaleFactor: 1, mobile: false });
    const metric = await evaluate("(() => {const d=document.querySelector('[role=dialog]'),r=d.getBoundingClientRect();return {width:innerWidth,pageWidth:document.documentElement.scrollWidth,dialog:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,scrollWidth:d.scrollWidth,clientWidth:d.clientWidth}};})()");
    assert(metric.pageWidth <= width && metric.dialog.left >= -1 && metric.dialog.right <= width + 1 && metric.dialog.scrollWidth <= metric.dialog.clientWidth + 1, "actual_ui_responsive_overflow");
    evidence.responsive.push(metric);
    if ([390, 1536].includes(width)) { const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false, clip: { x: metric.dialog.left, y: 0, width: metric.dialog.width, height: 844, scale: 1 } }); await writeFile(resolve(artifacts, `real-unified-forward-drawer-${width}.png`), Buffer.from(shot.data, "base64")); }
  }
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await click("Edit Forward", "[role=dialog]"); await fill({ Name: `${name} edited` }); await click("Save", "[role=dialog]");
  await until(async () => (await text("[role=dialog]")).includes(`${name} edited`), "real_ui_edit_failed");
  await tcpPayload(secure.listen_port, "TST_after_UI_edit");
  await click("History", "[role=dialog]"); await until(async () => (await text("[role=tabpanel]")).includes("Desired revision"), "real_ui_history_failed");
  await click("Diagnosis", "[role=dialog]"); await click("Run diagnosis", "[role=dialog]");
  await until(async () => evidence.network.some((r) => r.path === `/api/forwards/${secure.id}/diagnose` && r.status === 200), "real_ui_diagnosis_failed");
  const diagnosis = (await readApi(`/api/forwards/${secure.id}/diagnose`, "POST", {})).data;
  evidence.diagnosis = diagnosis.segments.map((segment) => ({ segment: segment.segment, method: segment.method, verified: segment.verified, outcome: segment.outcome }));
  await click("Suspend", "[role=dialog]"); await until(() => listenerClosed(secure.listen_port), "real_ui_suspend_listener_open");
  await until(async () => (await text("[role=dialog]")).includes("Resume"), "real_ui_suspend_state_failed");
  await click("Resume", "[role=dialog]"); await until(async () => !await listenerClosed(secure.listen_port), "real_ui_resume_listener_closed");
  await tcpPayload(secure.listen_port, "TST_after_UI_resume"); await udpPayload(secure.listen_port, "TST_UDP_after_UI_resume");
  await until(async () => (await readApi(`/api/forwards/${secure.id}`)).data.lifecycle?.traffic?.last_received_at, "real_payload_telemetry_missing", 90000);
  await close();
  await until(async () => (await text()).includes(`${name} edited`), "real_list_row_missing"); await click(`${name} edited`);
  await click("Traffic", "[role=dialog]");
  await until(async () => (await text("[role=tabpanel]")).includes("Cumulative node payload observations") && !(await text("[role=tabpanel]")).includes("No node payload statistics"), "real_ui_observed_traffic_missing");
  const observed = (await readApi(`/api/forwards/${secure.id}`)).data.lifecycle.traffic;
  evidence.liveTraffic = { bytes_in: observed.bytes_in, bytes_out: observed.bytes_out, connections: observed.connections, last_received_at: observed.last_received_at };
  await click("Delete", "[role=dialog]"); await click("Confirm deletion", "[role=dialog]");
  await until(() => listenerClosed(secure.listen_port), "real_ui_delete_listener_open"); activeRules.delete(secure.id);
  assert(!evidence.network.some((r) => r.path.startsWith("/api/links") && ["POST", "PATCH", "PUT", "DELETE"].includes(r.method)), "frontend_link_mutation_detected");
  assert(evidence.runtimeErrors.length === 0, "browser_runtime_exception");
  evidence.scenarios.push("Actual TST both UI creation/edit/history/diagnosis/suspend/resume/traffic/delete; TCP and UDP crossed real mTLS Agents; listener removal confirmed");
  evidence.scenarios.push("Actual Next drawer fits six widths; screenshots crop the dialog and exclude account credentials; no frontend Link mutation or browser runtime exception");
  evidence.status = "passed";
  await writeFile(resolve(artifacts, "real-unified-forward-browser-evidence.json"), JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify({ status: "passed", scenarios: evidence.scenarios.length, payloads: evidence.payloads.length, breakpoints: evidence.responsive.length, artifact: "web/test-artifacts/real-unified-forward-browser-evidence.json" }, null, 2));
} catch (error) {
  const code = /^[a-z_]+$/.test(error.message) ? error.message : "real_browser_check_failed";
  evidence.status = "failed"; evidence.error_code = code;
  await writeFile(resolve(artifacts, "real-unified-forward-browser-evidence.json"), JSON.stringify(evidence, null, 2) + "\n");
  console.error(code); process.exitCode = 1;
} finally {
  if (evaluate) for (const id of activeRules) { try { await evaluate(`fetch('/api/forwards/${id}/actions',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':'1','x-workspace-id':${JSON.stringify(String(fixture.workspace_id))}},body:JSON.stringify({action:'delete'}),credentials:'include'}).then(()=>true)`); } catch {} }
  socket?.close(); browser.kill();
  for (const connection of connections) connection.destroy(); echo.close(); udpEcho.close();
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
