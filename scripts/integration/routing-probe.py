#!/usr/bin/env python3
"""R2 native TCP target observations through real Panel/Redis/control/Agent sockets."""
from __future__ import annotations
import importlib.util
import json
import re
import signal
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("routing_probe_harness", HERE / "tst-forward.py")
if spec is None or spec.loader is None:
    raise SystemExit("real topology harness unavailable")
A = importlib.util.module_from_spec(spec)
spec.loader.exec_module(A)
H, C = A.H, A.C
RESULT = HERE / "evidence" / "routing-probe-result.txt"
OBSERVATIONS = HERE / "evidence" / "routing-probe-observations.json"


def request(method, path, body=None):
    status, response, headers = H.req(method, path, body)
    if status not in (200, 201, 202):
        code = response.get("code", "unknown")
        if not isinstance(code, str) or not code.replace("_", "").isalnum():
            code = "unknown"
        raise RuntimeError(f"HTTP {status} code={code}")
    return H.unwrap(response), headers


def footprint(ids):
    return H.db("""const ids=%s; return {
      forwards:await db.tunnel.findMany({where:{id:{in:ids}},orderBy:{id:'asc'},
        select:{id:true,config_revision:true,applied_revision:true,apply_status:true,desired_status:true}}),
      revisions:await db.forwardRevision.count({where:{tunnel_id:{in:ids}}}),
      leases:await db.nodePortLease.count({where:{tunnel_id:{in:ids}}})};""" % json.dumps(ids))


def main():
    rules, servers, observations, edge_observations = [], [], [], []
    signal.signal(signal.SIGALRM, H.alarm)
    signal.setitimer(signal.ITIMER_REAL, 420)
    H.acquire_lock()
    try:
        H.setup()
        caps, _ = request("GET", "/api/routing/capabilities")
        H.check(caps["features"]["native_tcp_target_probes"] is True, "R2 isolated topology explicitly enables native target probes")
        for port in (3052, 3053):
            server = A.Echo(port)
            server.start()
            servers.append(server)
        targets = {"direct": C.runner_data_ip(), "relay": C.runner_egress_ip()}
        revisions = {}
        for mode, port in (("direct", 21090), ("relay", 21091)):
            if not targets[mode]:
                raise RuntimeError("reachable echo target unavailable")
            body = {"name": f"{H.FIXTURE_PREFIX}-R2-{mode}", "protocol": "tcp", "mode": mode,
                    "ingress_node_id": H.ING, "listen_port": port, "target_host": targets[mode], "target_port": 3052}
            if mode == "relay":
                body["egress_node_id"] = H.EGR
            row, _ = request("POST", "/api/forwards", body)
            fid = row["id"]
            rules.append(fid)
            H.check(H.wait_active(fid), f"R2 {mode} apply confirmed by real Agent")
            with A.tcp(port) as client:
                H.check(A.tcp_payload(client, b"R2-business-before-probe"), f"R2 {mode} actual business payload works")
            detail, _ = request("GET", f"/api/forwards/{fid}")
            revisions[fid] = detail["config_revision"]

        receipt, _ = request("POST", "/api/forward-operations", {
            "idempotency_key": str(uuid.uuid4()), "name": f"{H.FIXTURE_PREFIX}-R2-tst", "path": "relay", "transport": "tst_v1",
            "protocol": "both", "ingress_node_id": H.ING, "egress_node_id": H.EGR, "listen_port": 21092,
            "target_host": targets["relay"], "target_port": 3053, "transport_options": {"selection": "auto"}})
        tst = A.await_operation(receipt["operation_id"])
        rules.append(tst["id"])
        revisions[tst["id"]] = tst["config_revision"]
        with A.tcp(21092) as client:
            H.check(A.tcp_payload(client, b"R2-tst-business"), "R2 TST Forward has real TCP payload before its target probe")

        before = footprint(rules)
        for mode, fid in zip(("direct", "relay", "tst"), rules):
            body = {"schema_version": 1, "forward_id": fid, "expected_revision": revisions[fid]}
            measured = {}
            def measure():
                status, response, hdr = H.req("POST", "/api/routing/probes", body)
                if status == 429:
                    return False
                if status != 200:
                    raise RuntimeError(f"probe rejected_{response.get('code', 'unknown')}")
                measured.update(observation=H.unwrap(response), headers=hdr)
                return True
            if not H.wait_until(measure, timeout=45, interval=2):
                raise TimeoutError("normal shared node cooldown did not elapse")
            observation, headers = measured["observation"], measured["headers"]
            observations.append(observation)
            expected_node = H.ING if mode == "direct" else H.EGR
            H.check(observation["node_id"] == expected_node and observation["state"] == "reachable"
                    and observation["samples"][0]["status"] == "reachable"
                    and observation["tcp_connect_success_rate"] == 1,
                    f"R2 {mode} authenticated actual Agent connects only to its configured target")
            H.check(observation["transport"] == ("tst_v1" if mode == "tst" else "native_plain"),
                    f"R2 {mode} measurement preserves the actual authorized transport")
            H.check(observation["rtt_ms"] is None and observation["loss_percent"] is None
                    and observation["tls_handshake_success_rate"] is None
                    and not observation["udp_verified"] and not observation["end_to_end_verified"],
                    f"R2 {mode} TCP timing does not invent RTT, loss, TLS or UDP health")
            text = json.dumps(observation)
            H.check(headers.get("Cache-Control") == "no-store"
                    and not any(key in text for key in ('"host"', '"port"', '"resolved_ip"', '"detail"', 'credential')),
                    f"R2 {mode} response is bounded and target/credential free")
            cached, _ = request("GET", f"/api/routing/probes/{fid}")
            H.check(cached["state"] == "reachable" and cached["observation"]["observation_id"] == observation["observation_id"],
                    f"R2 {mode} scoped cached observation preserves measurement identity")
            status, result, _ = H.req("POST", "/api/routing/probes", body)
            H.check(status == 429 and result.get("code") == "probe_budget_exhausted", f"R2 {mode} immediate repeat is budget limited")
        H.check(footprint(rules) == before, "R2 probes do not modify Forward revisions, desired state or port leases")

        graph, _ = request("GET", "/api/routing/topology")
        edge = next(e for e in graph["edges"] if e["transport"] == "native_plain" and e["from_node_id"] == H.ING and e["to_node_id"] == H.EGR)
        quality = {}
        def measure_edge():
            status, response, _ = H.req("POST", "/api/routing/edge-probes", {"schema_version": 1, "edge_id": edge["id"]})
            if status == 429:
                return False
            if status != 200:
                raise RuntimeError(f"edge probe rejected_{response.get('code', 'unknown')}")
            quality.update(H.unwrap(response))
            return True
        H.check(H.wait_until(measure_edge, timeout=45, interval=2), "R2 real inter-node quality respects shared probe budgets")
        edge_observations.append(quality)
        H.check(quality.get("scope") == "node_to_node_icmp" and quality.get("packets_sent") == 5 and quality.get("packets_received") == 5
                and quality.get("rtt_ms") is not None and quality.get("loss_percent") == 0,
                "R2 real Agent performs five authorized ICMP round trips on the isolated network")
        H.check(quality.get("handshake_success_rate") is None and quality.get("end_to_end_verified") is False
                and not any(key in json.dumps(quality) for key in ('"host"', '"peer_address"', '"detail"', 'credential')),
                "R2 ICMP facts remain separate from handshake and end-to-end reachability")
        cached, _ = request("GET", f"/api/routing/edge-probes/{edge['id']}")
        H.check(cached["observation"]["observation_id"] == quality["observation_id"], "R2 edge cache is scoped to current adjacency identity")
        H.check(footprint(rules) == before, "R2 edge probes also leave all business revisions and leases unchanged")

        direct, relay, tst_id = rules
        body = {"schema_version": 1, "forward_id": direct, "expected_revision": revisions[direct]}
        status, result, _ = H.req("POST", "/api/routing/probes", {**body, "host": "127.0.0.1", "port": 1})
        H.check(status == 400 and result.get("code") == "invalid_input", "R2 user supplied target is rejected before network activity")
        status, result, _ = H.req("POST", "/api/routing/probes", {**body, "expected_revision": revisions[direct] + 1})
        H.check(status == 409 and result.get("code") == "revision_conflict", "R2 stale revisions never silently rebase")

        request("PATCH", f"/api/forwards/{relay}", {"target_port": 3053, "expected_revision": revisions[relay]})
        H.check(H.wait_active(relay), "R2 normal target edit applies through existing controller")
        changed, _ = request("GET", f"/api/routing/probes/{relay}")
        H.check(changed["state"] == "unknown" and changed["reason"] == "probe_identity_changed"
                and changed["observation"] is None, "R2 target/revision changes invalidate old target health")
        servers[0].stop()
        # The normal node cooldown must elapse; never delete its Redis key to force a probe.
        failed = {}
        def probe_closed():
            status, response, _ = H.req("POST", "/api/routing/probes", body)
            if status == 429:
                return False
            if status != 200:
                raise RuntimeError("closed target probe rejected")
            failed.update(H.unwrap(response))
            return True
        H.check(H.wait_until(probe_closed, timeout=45, interval=2), "R2 fault measurement respects the real cooldown")
        observations.append(failed)
        H.check(failed.get("state") == "unreachable" and failed.get("tcp_connect_success_rate") == 0
                and failed.get("samples", [{}])[0].get("status") == "refused",
                "R2 actual closed TCP target records refusal while the node is still online")
        graph, _ = request("GET", "/api/routing/topology")
        H.check(all(n["health"]["state"] == "unknown" for n in graph["nodes"])
                and all(e["health"]["state"] == "unknown" for e in graph["edges"]),
                "R2 target evidence is never promoted to node or carrier health")
        def expired():
            cached, _ = request("GET", f"/api/routing/probes/{direct}")
            return cached["state"] == "stale" and cached["reason"] == "probe_expired"
        H.check(H.wait_until(expired, timeout=70, interval=3), "R2 actual elapsed freshness window marks cached evidence stale")
        request("DELETE", f"/api/forwards/{direct}")
        rules.remove(direct)
        status, _, _ = H.req("GET", f"/api/routing/probes/{direct}")
        H.check(status == 404, "R2 deleted Forward cannot expose an orphan observation")
    except Exception as exc:
        # No raw requests, target configs, ORM exceptions or secret-bearing tracebacks.
        message = str(exc)
        detail = message if re.fullmatch(r"(?:HTTP [0-9]{3} code=[a-z0-9_]+|operation_failed_[a-z0-9_]+)", message) else "details_redacted"
        H.record(False, f"R2 acceptance failed: {type(exc).__name__} {detail}")
    finally:
        for fid in rules:
            status, _, _ = H.req("DELETE", f"/api/forwards/{fid}")
            H.check(status in (200, 404), "R2 fixture cleanup uses confirmed normal API deletion")
        for server in servers:
            server.stop()
        signal.setitimer(signal.ITIMER_REAL, 0)
        RESULT.write_text("\n".join(H.RESULTS) + f"\n{H.PASS} PASS / {H.FAIL} FAIL\n", encoding="utf-8")
        OBSERVATIONS.write_text(json.dumps({"method": "actual_agent_probes", "observations": observations, "edge_observations": edge_observations}, indent=2) + "\n", encoding="utf-8")
        H.release_lock()
    return 1 if H.FAIL else 0


if __name__ == "__main__":
    raise SystemExit(main())
