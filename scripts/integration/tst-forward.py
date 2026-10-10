#!/usr/bin/env python3
"""Independent TST acceptance through the real Forward API and Linux Agents.

This module also exports socket helpers for the native TCP+UDP regression.
It never invokes a data-plane executable or supplies a target on the TST wire.
"""
from __future__ import annotations

import importlib.util
import json
import socket
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("tunex_network_harness", HERE / "current-protocol.py")
if spec is None or spec.loader is None:
    raise SystemExit("missing network harness")
C = importlib.util.module_from_spec(spec)
spec.loader.exec_module(C)
H = C.H
RESULT = HERE / "evidence" / "tst-forward-result.txt"


class Echo:
    def __init__(self, port):
        self.port = port
        self.stop_event = threading.Event()
        self.clients = set()
        self.lock = threading.Lock()
        # Native-both acceptance uses these bounded observations to prove that
        # a retarget moved both protocol lanes to the new target.
        self.messages = []
        self.udp_sources = []
        self.tcp_socket = socket.socket()
        self.tcp_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.tcp_socket.bind(("0.0.0.0", port))
        self.tcp_socket.listen(64)
        self.tcp_socket.settimeout(0.2)
        self.udp_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.udp_socket.bind(("0.0.0.0", port))
        self.udp_socket.settimeout(0.2)

    def start(self):
        threading.Thread(target=self.accept, daemon=True).start()
        threading.Thread(target=self.datagrams, daemon=True).start()

    def accept(self):
        while not self.stop_event.is_set():
            try:
                client, _ = self.tcp_socket.accept()
            except socket.timeout:
                continue
            except OSError:
                return
            with self.lock:
                self.clients.add(client)
            threading.Thread(target=self.stream, args=(client,), daemon=True).start()

    def stream(self, client):
        try:
            client.settimeout(0.2)
            while not self.stop_event.is_set():
                try:
                    payload = client.recv(16384)
                except socket.timeout:
                    continue
                if not payload:
                    client.shutdown(socket.SHUT_WR)
                    return
                with self.lock:
                    self.messages.append(payload)
                client.sendall(payload)
        except OSError:
            pass
        finally:
            client.close()
            with self.lock:
                self.clients.discard(client)

    def datagrams(self):
        while not self.stop_event.is_set():
            try:
                payload, source = self.udp_socket.recvfrom(65507)
                with self.lock:
                    self.udp_sources.append(payload)
                self.udp_socket.sendto(payload, source)
            except socket.timeout:
                continue
            except OSError:
                return

    def stop(self):
        self.stop_event.set()
        self.tcp_socket.close()
        self.udp_socket.close()
        with self.lock:
            for client in list(self.clients):
                client.close()


def tcp(port):
    client = socket.create_connection((H.INGRESS_DATA_IP, port), timeout=5)
    client.settimeout(5)
    return client


def tcp_payload(client, payload):
    client.sendall(payload)
    received = bytearray()
    while len(received) < len(payload):
        chunk = client.recv(len(payload) - len(received))
        if not chunk:
            break
        received.extend(chunk)
    return bytes(received) == payload


def udp_payload(client, port, payload):
    client.settimeout(5)
    client.sendto(payload, (H.INGRESS_DATA_IP, port))
    return client.recvfrom(65507)[0] == payload


def request(method, path, body=None):
    status, response, _ = H.req(method, path, body)
    if status not in (200, 201, 202):
        code = response.get("code", "unknown")
        if not isinstance(code, str) or not code.replace("_", "").isalnum():
            code = "unknown"
        raise RuntimeError(f"{method} {path}: status={status} code={code}")
    return H.unwrap(response)


def await_operation(operation_id):
    end = time.monotonic() + 90
    while time.monotonic() < end:
        receipt = request("GET", f"/api/forward-operations/{operation_id}")
        if receipt["state"] == "failed":
            # The operation code is already a bounded public enum. Preserve it in
            # the redacted evidence so an acceptance failure remains diagnosable
            # without archiving authenticated DTOs or worker logs.
            code = receipt.get("error_code", "unknown")
            if not isinstance(code, str) or not code.replace("_", "").isalnum():
                code = "unknown"
            raise RuntimeError(f"operation_failed_{code}")
        if receipt.get("forward_id"):
            detail = request("GET", f"/api/forwards/{receipt['forward_id']}")
            if detail.get("lifecycle", {}).get("deployment") == "confirmed":
                return detail
        time.sleep(1)
    raise TimeoutError("Forward deployment was not confirmed")


def listener_closed(port):
    try:
        with tcp(port):
            return False
    except OSError:
        return True


def main():
    rules = []
    targets = []
    held = None
    mapping = None
    H.acquire_lock()
    try:
        H.setup()
        H.mysql("UPDATE capability_policy SET tunnel_types=JSON_ARRAY('tcp','tls','ws','udp'),revision=revision+1;")
        target = C.runner_egress_ip()
        if not target:
            raise RuntimeError("no reachable egress echo address")
        for port in (3042, 3043):
            echo = Echo(port)
            echo.start()
            targets.append(echo)
        caps = request("GET", "/api/forwards/capabilities")
        combination = next((c for c in caps["combinations"] if c["path"] == "relay" and c["transport"] == "tst_v1" and c["protocol"] == "both"), {})
        H.check(combination.get("available") is True, "fresh authorized TST both is available")
        if not combination.get("available"):
            raise RuntimeError("TST capability prerequisite missing")

        def body(name, port):
            return {"idempotency_key": str(uuid.uuid4()), "name": name, "path": "relay", "transport": "tst_v1",
                    "protocol": "both", "ingress_node_id": H.ING, "egress_node_id": H.EGR,
                    "listen_port": port, "target_host": target, "target_port": 3042,
                    "transport_options": {"selection": "auto"}}

        first = body("TST acceptance A", 21080)
        with ThreadPoolExecutor(max_workers=2) as executor:
            receipts = list(executor.map(lambda _: request("POST", "/api/forward-operations", first), range(2)))
        H.check(receipts[0]["operation_id"] == receipts[1]["operation_id"], "concurrent identical create has one durable operation")
        a = await_operation(receipts[0]["operation_id"])
        rules.append(a["id"])
        status, response, _ = H.req("POST", "/api/forward-operations", {**first, "name": "conflict"})
        H.check(status == 409 and response.get("code") == "idempotency_conflict", "same key different request rejected")
        b_receipt = request("POST", "/api/forward-operations", body("TST acceptance B", 21081))
        b = await_operation(b_receipt["operation_id"])
        rules.append(b["id"])
        H.check(a.get("link_resource_id") == b.get("link_resource_id") and b.get("link_resource_id") is not None,
                "two business rules reuse one managed Link")
        public = json.dumps([a, b, receipts, caps])
        H.check(all(marker not in public for marker in ("PRIVATE KEY", "certificate_pem", "transport_config", "key_ciphertext")),
                "public DTOs do not contain transport credentials")
        held = tcp(21081)
        mapping = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        H.check(tcp_payload(held, b"TST-held-B"), "actual TCP payload over TST")
        H.check(udp_payload(mapping, 21081, b"TST-UDP-B"), "actual UDP payload over same carrier")
        with tcp(21080) as connection:
            H.check(tcp_payload(connection, b"TST-A"), "second multiplexed business rule works")
        request("PATCH", f"/api/forwards/{a['id']}", {"expected_revision": a["config_revision"], "target_port": 3043})
        H.check(tcp_payload(held, b"B-after-A-edit") and udp_payload(mapping, 21081, b"B-mapping-after-A-edit"),
                "editing A preserves B TCP and UDP mapping")
        request("POST", f"/api/forwards/{a['id']}/actions", {"action": "suspend"})
        H.check(H.wait_until(lambda: listener_closed(21080), timeout=30, interval=1), "suspension closes A listener")
        H.check(tcp_payload(held, b"B-after-A-suspend"), "suspension leaves sibling alive")
        request("POST", f"/api/forwards/{a['id']}/actions", {"action": "resume"})
        H.check(H.wait_until(lambda: not listener_closed(21080), timeout=30, interval=1), "resume restores A listener")
        request("POST", f"/api/forwards/{a['id']}/actions", {"action": "delete"})
        rules.remove(a["id"])
        H.check(listener_closed(21080) and tcp_payload(held, b"B-after-A-delete"), "confirmed A removal does not stop B")
        # Restart through the topology owner; never edit Agent caches or generation fences.
        held.close()
        held = None
        H.docker(["restart", H.INGRESS_CONTAINER], timeout=120)
        H.check(H.wait_until(lambda: not listener_closed(21081), timeout=60, interval=1), "Agent restart restores still-authorized leased listener")
        with tcp(21081) as connection:
            H.check(tcp_payload(connection, b"B-after-agent-restart"), "real payload after runtime recovery")
        request("POST", f"/api/forwards/{b['id']}/actions", {"action": "delete"})
        rules.remove(b["id"])
        H.check(listener_closed(21081), "last Forward deletion confirms listener removal")
    except Exception as error:
        # Error messages are only harness-owned bounded descriptions; raw API bodies
        # and authenticated snapshots are never archived. Keep the bounded reason
        # because a generic RuntimeError made second-Forward regressions opaque.
        reason = str(error)
        if not reason or any(ord(ch) < 32 or ord(ch) > 127 for ch in reason):
            reason = "unknown"
        reason = reason[:120]
        H.record(False, f"TST acceptance failed: {type(error).__name__}:{reason}")
    finally:
        if held:
            held.close()
        if mapping:
            mapping.close()
        for fid in rules:
            try:
                request("POST", f"/api/forwards/{fid}/actions", {"action": "delete"})
            except Exception:
                H.record(False, "TST fixture cleanup failed")
        for echo in targets:
            echo.stop()
        H.release_lock()
        RESULT.parent.mkdir(exist_ok=True)
        RESULT.write_text("\n".join(H.RESULTS) + f"\n{H.PASS} PASS / {H.FAIL} FAIL\n", encoding="utf-8")
    return 1 if H.FAIL else 0


if __name__ == "__main__":
    raise SystemExit(main())
