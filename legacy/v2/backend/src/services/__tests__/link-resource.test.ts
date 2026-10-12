import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

// V2 removed the external runner. Test the active TST service boundary; the
// transactional lifecycle is exercised against MySQL by v2-forward-db.test.ts.
test("TST service rejects disabled and unsupported policies before any resource write", () => {
  const modulePath = (relative: string) => JSON.stringify(fileURLToPath(new URL(relative, import.meta.url)));
  const scenario = `
    import { mock } from "bun:test";
    import assert from "node:assert/strict";
    process.env.AUTH_SECRET = "test-tst-boundary-at-least-32-characters";
    process.env.DATABASE_URL = "mysql://root@127.0.0.1:33079/tunex_v2_test";
    mock.module("ioredis", () => ({ default: class { on() { return this; } } }));
    let reads = 0;
    mock.module(${modulePath("../../db.ts")}, () => ({ db: new Proxy({}, { get() { reads++; throw Error("unexpected_database_access"); } }) }));
    const service = await import(${modulePath("../link-resource.ts")});
    delete process.env.TUNEX_TST_ENABLED;
    await assert.rejects(() => service.createLink(3, 8, {}), e => e.code === "tst_not_enabled");
    await assert.rejects(() => service.createLinkForward(3, 1, 8, {}), e => e.code === "tst_not_enabled");
    process.env.TUNEX_TST_ENABLED = "true";
    process.env.TUNEX_LINK_SEAL_KEY = "53".repeat(32);
    const binding = { name: "rule", protocol: "tcp", listen_port: 26000, target_host: "127.0.0.1", target_port: 27000 };
    assert.equal(service.LinkBindingSchema.safeParse(binding).success, true);
    const target_set = { version: 1, strategy: "round_robin", targets: [{ host: "127.0.0.1", port: 27000 }], failure_seconds: 10, recover_seconds: 10, probe: "tcp" };
    await assert.rejects(() => service.createLinkForward(3, 1, 8, { ...binding, target_set }), e => e.code === "tst_policy_unsupported");
    await assert.rejects(() => service.updateLinkForward(3, 1, 9, 8, 1, { ...binding, target_set }), e => e.code === "tst_policy_unsupported");
    await assert.rejects(() => service.createLinkForward(3, 1, 8, { ...binding, protocol: "tls" }), e => e.name === "ZodError");
    assert.equal(reads, 0, "invalid policies cannot reserve Links, Forward rows, or leases");
    console.log("tst-resource-boundary-ok");
  `;
  const child = Bun.spawnSync([process.execPath, "--no-env-file", "--eval", scenario], { stdout: "pipe", stderr: "pipe" });
  expect(child.exitCode, new TextDecoder().decode(child.stderr)).toBe(0);
  expect(new TextDecoder().decode(child.stdout)).toContain("tst-resource-boundary-ok");
});
