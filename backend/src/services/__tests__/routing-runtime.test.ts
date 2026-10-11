import { test, expect } from "bun:test";
import { randomBytes, X509Certificate } from "node:crypto";
import { prepareRoutingRuntime, projectRoutingHop, assertRoutingHopCapabilities, routingForwardId } from "../routing-runtime.ts";

test("real orchestrator relay and egress IDs resolve to the same protected Forward", () => {
  expect(routingForwardId("tunex-40-relay")).toBe(40);
  expect(routingForwardId("tunex-40-egress")).toBe(40);
  expect(routingForwardId("tunex-tst-40-egress")).toBeNull();
  expect(routingForwardId("tunex-40-relay-bare")).toBeNull();
  expect(routingForwardId("tunex-2147483648-relay")).toBeNull();
});

test("sealed route identities are private per edge, scoped and revision fenced", async () => {
  const previous=process.env.TUNEX_LINK_SEAL_KEY; const key=randomBytes(32).toString("hex"); process.env.TUNEX_LINK_SEAL_KEY=key;
  try {
    const row=await prepareRoutingRuntime(7,40,5,[1,2,3]);
    expect(JSON.stringify(row)).not.toContain("PRIVATE KEY");
    const ingress=projectRoutingHop(row,1,key), middle=projectRoutingHop(row,2,key), exit=projectRoutingHop(row,3,key);
    expect(ingress.incoming).toBeUndefined();expect(exit.outgoing).toBeUndefined();
    expect(middle.incoming!.peer_uri).toBe(ingress.outgoing!.own_uri);
    expect(middle.outgoing!.peer_uri).toBe(exit.incoming!.own_uri);
    expect(middle.incoming!.ca_pem).not.toBe(middle.outgoing!.ca_pem);
    expect(new X509Certificate(middle.incoming!.certificate_pem).verify(new X509Certificate(ingress.outgoing!.ca_pem).publicKey)).toBe(true);
    expect(()=>projectRoutingHop({...row,workspace_id:8},1,key)).toThrow();
    expect(()=>projectRoutingHop({...row,revision:6},1,key)).toThrow();
    expect(()=>projectRoutingHop(row,99,key)).toThrow();
    expect(()=>projectRoutingHop(row,1,key,new Date(row.expires_at.getTime()+1))).toThrow();
    await expect(prepareRoutingRuntime(7,40,5,[1,2,1])).rejects.toThrow();
  } finally { if(previous===undefined)delete process.env.TUNEX_LINK_SEAL_KEY;else process.env.TUNEX_LINK_SEAL_KEY=previous; }
});
test("older or stale Agents cannot admit a protected hop",async()=>{
  await expect(assertRoutingHopCapabilities([1,2],async()=>null)).rejects.toThrow("routing_hop_upgrade_required");
  await expect(assertRoutingHopCapabilities([1,2],async()=>({advertisementCurrent:true,capabilities:["apply_tunnel"]} as never))).rejects.toThrow();
  await assertRoutingHopCapabilities([1,2],async()=>({advertisementCurrent:true,capabilities:["forward.routing.hop.mtls.v1"]} as never));
});
