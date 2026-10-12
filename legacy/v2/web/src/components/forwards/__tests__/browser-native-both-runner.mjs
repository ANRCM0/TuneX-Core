/**
 * Run with an existing Bun: bun run src/components/forwards/__tests__/browser-native-both-runner.mjs
 * Uses the existing fixture server/checks and an installed headless Chromium.
 * No dependencies, user profile, production API or actual Agent traffic.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "../../../..");
if (basename(web) !== "web") throw new Error("Fixture artifacts must stay under web/");
const fixture = process.env.TUNEX_BROWSER_FIXTURE === "routing" ? "routing" : "native-both";
const origin = `http://127.0.0.1:${fixture === "routing" ? 41976 : 41974}`;
const chrome = process.env.NATIVE_BOTH_CHROME ?? [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(existsSync);
if (!chrome) throw new Error("No installed Chromium; set NATIVE_BOTH_CHROME. No installation performed.");
const pause = (ms = 50) => new Promise((done) => setTimeout(done, ms));
async function until(read, label) {
  for (let i = 0; i < 400; i++) {
    const value = await read().catch(() => null);
    if (value) return value;
    await pause();
  }
  throw new Error(`Timed out: ${label}`);
}
try {
  await fetch(origin, { signal: AbortSignal.timeout(500) });
  throw new Error("Fixture port already in use; refusing to reuse another session.");
} catch (error) {
  if (error.message.includes("already in use")) throw error;
}
const profile = await mkdtemp(resolve(web, `.${fixture}-browser-`));
let server, browser, ws, cdp;
let serverLog = "";
const errors = [];
try {
  server = spawn(process.env.TUNEX_FIXTURE_BUN ?? process.execPath, [resolve(here, `browser-${fixture}-server.ts`)], { cwd: web, windowsHide: true });
  server.on("error", (error) => { serverLog += String(error); });
  for (const stream of [server.stdout, server.stderr]) stream.on("data", (data) => { serverLog = (serverLog + data).slice(-8000); });
  await until(async () => server.exitCode === null && (await fetch(origin)).ok, "fixture server");
  browser = spawn(chrome, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    "--disable-background-networking", "--disable-component-update", "--disable-sync", "--disable-extensions",
    "--no-first-run", "--no-default-browser-check", "--no-proxy-server", "about:blank"], { windowsHide: true, stdio: "ignore" });
  browser.on("error", (error) => errors.push(String(error)));
  const port = await until(async () => (await readFile(resolve(profile, "DevToolsActivePort"), "utf8")).split("\n")[0], "isolated Chromium");
  const target = await until(async () => (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json())
    .find((entry) => entry.type === "page"), "page target");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done, reject) => { ws.addEventListener("open", done, { once: true }); ws.addEventListener("error", reject, { once: true }); });
  let sequence = 0;
  const pending = new Map();
  cdp = (method, params = {}) => new Promise((done, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 60_000);
    pending.set(id, (message) => { clearTimeout(timer); message.error ? reject(new Error(JSON.stringify(message.error))) : done(message.result); });
    ws.send(JSON.stringify({ id, method, params }));
  });
  ws.addEventListener("message", ({ data }) => {
    const message = JSON.parse(String(data));
    if (message.id) { const handler = pending.get(message.id); pending.delete(message.id); handler?.(message); }
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error")
      errors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
  });
  await cdp("Runtime.enable"); await cdp("Page.enable");
  await cdp("Page.navigate", { url: origin });
  await until(async () => (await cdp("Runtime.evaluate", { expression: "!!document.querySelector('[data-testid=fixture-gates]')", returnByValue: true })).result.value, "fixture DOM");
  const responsive = [];
  if (fixture === "routing") {
    await until(async () => (await cdp("Runtime.evaluate", { expression: "!![...document.querySelectorAll('button')].find(b=>b.textContent==='Preview candidates')", returnByValue: true })).result.value, "routing fields");
    await mkdir(resolve(web, "test-artifacts/routing"), { recursive: true });
    for (const width of [360, 390, 768, 1024, 1280, 1440]) {
      await cdp("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      const layout = await cdp("Runtime.evaluate", { expression: "document.documentElement.scrollWidth <= innerWidth", returnByValue: true });
      if (!layout.result.value) throw new Error(`Routing layout overflows at ${width}px`);
      responsive.push(width);
      const capture = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
      await writeFile(resolve(web, `test-artifacts/routing/${width}.png`), Buffer.from(capture.data, "base64"));
    }
  }
  const checks = await readFile(resolve(here, `browser-${fixture}-checks.js`), "utf8");
  const result = await cdp("Runtime.evaluate", { expression: `${checks}\nwindow.${fixture === "routing" ? "runRoutingFixtureChecks" : "runNativeBothFixtureChecks"}()`, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  if (errors.length) throw new Error(`Fixture console errors: ${errors.join("\n")}`);
  const receipt = { ...result.result.value, consoleErrors: errors.length, responsive };
  if (fixture === "routing") await writeFile(resolve(web, "test-artifacts/routing/receipt.json"), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
} catch (error) {
  console.error(error);
  if (cdp) console.error((await cdp("Runtime.evaluate", { expression: "document.body.innerText.slice(-5000)", returnByValue: true }).catch(() => null))?.result.value);
  console.error(serverLog);
  throw error;
} finally {
  if (cdp) await cdp("Browser.close").catch(() => {});
  // Windows Chromium has child processes; terminate only this isolated tree so
  // profile files are released before bounded cleanup.
  if (process.platform === "win32" && browser?.pid) {
    await new Promise((done) => {
      const cleanup = 'Get-CimInstance Win32_Process -Filter "Name = \'chrome.exe\'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($env:TUNEX_BROWSER_CLEANUP_PROFILE) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }';
      const kill = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", cleanup],
        { windowsHide: true, stdio: "ignore", env: { ...process.env, TUNEX_BROWSER_CLEANUP_PROFILE: profile } });
      kill.once("exit", done); kill.once("error", done);
    });
  }
  ws?.close();
  for (const child of [browser, server]) {
    if (child && child.exitCode === null) {
      const exited = new Promise((done) => child.once("exit", done));
      child.kill(); await Promise.race([exited, pause(2000)]);
    }
  }
  // Never recursively remove a computed path outside this workspace's web root.
  if (dirname(resolve(profile)) !== web || !basename(profile).startsWith(`.${fixture}-browser-`))
    throw new Error("Unsafe fixture profile cleanup path");
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
