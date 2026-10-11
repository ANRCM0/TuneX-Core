#!/usr/bin/env python3
"""R3/R4/R5: authorized secure route selection on the disposable Linux topology."""
from __future__ import annotations
import importlib.util
import json
import signal
import socket
import time
from pathlib import Path

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("routing_execution_harness",HERE/"tst-forward.py")
if spec is None or spec.loader is None: raise SystemExit("real topology harness unavailable")
A=importlib.util.module_from_spec(spec); spec.loader.exec_module(A)
H,C=A.H,A.C
STATE=json.loads((HERE/"state.json").read_text(encoding="utf-8"))
MID=STATE["nodes"]["ingress_secondary"]["id"]
CONTAINER="tunex-it-ingress-agent-b"
OUT=HERE/"evidence"
FAULT_PID="/tmp/tunex-it-routing-listener-fault.pid"

def request(method,path,body=None):
    status,response,_=H.req(method,path,body,timeout=120)
    if status not in (200,201,202):
        code=response.get("code","unknown")
        if not isinstance(code,str) or not code.replace("_","").isalnum(): code="unknown"
        raise RuntimeError(f"HTTP {status} {code}")
    return H.unwrap(response)

def route_state(fid):
    return H.db("return await db.tunnel.findUnique({where:{id:%d},select:{id:true,config_revision:true,applied_revision:true,apply_status:true,apply_error_code:true,middle_node_id:true,routing_security_version:true,egress_port:true}});"%fid)

def rollout_state(fid):
    # Closed projection only: raw errors, notes and plans can contain addresses,
    # target configurations or private identities and must never be archived.
    return H.db("""const rows=await db.forwardRollout.findMany({where:{tunnel_id:%d},orderBy:{id:'desc'},take:8,
        select:{revision:true,base_revision:true,phase:true,last_error_code:true,compensated:true,compensation_error:true,steps:true,cleaned:true}});
        const safe=v=>typeof v==='string' && /^[a-z][a-z0-9_]{0,63}$/.test(v)?v:null;
        return rows.map(r=>({revision:r.revision,base_revision:r.base_revision,phase:safe(r.phase),last_error_code:safe(r.last_error_code),
            compensated:r.compensated,compensation_error_present:r.compensation_error!==null,
            compensation_failure_stages:['snapshot','egress','transit','ingress','direct'].filter(s=>r.compensation_error?.includes('replay '+s+':') ||
                s==='snapshot'&&r.compensation_error?.includes('rollback snapshot')),
            steps:(Array.isArray(r.steps?.steps)?r.steps.steps:[]).slice(0,64).map(s=>({phase:safe(s.phase),kind:safe(s.kind),
                completed:Array.isArray(r.cleaned)&&r.cleaned.includes(s.idempotency_key)}))}));"""%fid)

def payload(port,message):
    try:
        with A.tcp(port) as client: return A.tcp_payload(client,message)
    except OSError: return False

def plain_refused(ip,port):
    try:
        with socket.create_connection((ip,port),timeout=3) as client:
            client.settimeout(4); client.sendall(b"forged-plain-route")
            return client.recv(1024)!=b"forged-plain-route"
    except OSError: return True

def main():
    fid=None; stopped=False; role_before=None; echo=None; receipts=[]; history=[]; diagnostics={}; fault_running=False
    signal.signal(signal.SIGALRM,H.alarm);signal.setitimer(signal.ITIMER_REAL,720)
    H.acquire_lock()
    try:
        H.setup()
        caps=request("GET","/api/routing/capabilities")
        H.check(caps["features"]["multi_hop_execution"] is True,"R45 isolated flags enable secure Native TCP route execution")
        role_before=H.db("return (await db.node.findUnique({where:{id:%d},select:{role:true}})).role;"%MID)
        # Fixture role is explicit; both adjacent authorizations use the normal scoped API.
        H.db("await db.node.update({where:{id:%d},data:{role:'both'}});return true;"%MID)
        bindings={}
        for source,peer in ((H.ING,MID),(MID,H.EGR),(H.ING,H.EGR)):
            bindings[(source,peer)]=request("POST",f"/api/nodes/{source}/bindings",{"egress_node_id":peer})["id"]
        echo=A.Echo(3054);echo.start()
        created=request("POST","/api/forwards",{"name":f"{H.FIXTURE_PREFIX}-R45-route","protocol":"tcp","mode":"relay",
            "ingress_node_id":H.ING,"middle_node_id":MID,"egress_node_id":H.EGR,"listen_port":21093,
            "target_host":C.runner_egress_ip(),"target_port":3054})
        fid=created["id"];H.check(H.wait_active(fid),"R45 ordinary three-hop Forward is Agent confirmed")
        graph=request("GET","/api/routing/topology"); row=route_state(fid)
        candidates=[{"id":"primary","edge_ids":[f"binding:{bindings[(H.ING,MID)]}",f"binding:{bindings[(MID,H.EGR)]}"],"priority":0,"weight":3},
            {"id":"backup","edge_ids":[f"binding:{bindings[(H.ING,H.EGR)]}"],"priority":1,"weight":1}]
        intent={"schema_version":1,"forward_id":fid,"expected_revision":row["config_revision"],"topology_digest":graph["digest"],
            "strategy":"priority","hop_limit":3,"candidates":candidates}
        # Negative admission must not create a revision or expand target authority.
        loop={**intent,"candidates":[{**candidates[0],"edge_ids":[candidates[0]["edge_ids"][0],candidates[0]["edge_ids"][0]]}]}
        status,_,_=H.req("POST","/api/routing/preview",loop)
        H.check(status==200 and request("POST","/api/routing/preview",loop)["valid"] is False,"R45 loop/disconnected path is not admissible")
        request("PUT",f"/api/routing/policies/{fid}",{"schema_version":1,"expected_policy_version":0,"intent":intent,
            "enabled":True,"auto_failover":True,"auto_failback":True,"failure_threshold":1,"recovery_threshold":1,"cooldown_ms":30000,
            "max_rtt_ms":5000,"max_loss_percent":0,"min_handshake_success_rate":1})
        def confirmed(candidate):
            policy=request("GET",f"/api/routing/policies/{fid}");receipt=policy.get("last_decision") or {}
            if receipt.get("state")=="confirmed" and receipt.get("candidate_id")==candidate:
                receipts.append(receipt);return True
            return False
        H.check(bool(H.wait_until(lambda:confirmed("primary"),timeout=180,interval=3)),"R45 controller installs mTLS for every primary hop before confirmed selection")
        protected=route_state(fid)
        H.check(protected["routing_security_version"]==1 and protected["applied_revision"]==protected["config_revision"],"R45 sticky security floor is applied at one exact revision")
        H.check(payload(21093,b"secure-primary"),"R45 real business bytes traverse both authenticated hops")
        leases=H.db("return await db.nodePortLease.findMany({where:{tunnel_id:%d,status:'active'},select:{node_id:true,port:true}});"%fid)
        for lease in leases:
            if lease["node_id"]==H.ING: continue
            ip=H.db("return (await db.node.findUnique({where:{id:%d},select:{connect_ip:true}})).connect_ip;"%lease["node_id"]).split(",")[0]
            H.check(plain_refused(ip,lease["port"]),"R45 direct plaintext hop access cannot reach the configured target")
        old=A.tcp(21093);H.check(A.tcp_payload(old,b"session-before-fault"),"R45 existing TCP session serves before failure")
        H.docker(["stop","-t","1",CONTAINER]);stopped=True
        H.check(bool(H.wait_until(lambda:confirmed("backup"),timeout=180,interval=3)),"R45 measured failed primary causes automatic selection of authorized backup")
        switched=route_state(fid)
        H.check(switched["middle_node_id"] is None and switched["applied_revision"]==switched["config_revision"],"R45 confirmed route records the actual two-node placement")
        H.check(payload(21093,b"secure-backup"),"R45 new connections carry payload through the authenticated backup")
        interrupted=False
        try: interrupted=not A.tcp_payload(old,b"retry-old-session")
        except OSError: interrupted=True
        finally:old.close()
        H.check(interrupted,"R45 broken old TCP session ends and requires a new client connection")
        H.docker(["start",CONTAINER]);stopped=False
        H.check(bool(H.wait_until(lambda:confirmed("primary"),timeout=240,interval=3)),"R45 fresh recovery and cooldown permit automatic preferred-path return")
        H.check(payload(21093,b"secure-primary-recovered"),"R45 recovered route still forwards real business payload")
        history=request("GET",f"/api/routing/policies/{fid}/history")
        confirmed_history=[r for r in history if r["state"]=="confirmed"]
        H.check({"primary","backup"} <= {r["candidate_id"] for r in confirmed_history},"R45 persisted decision history traces both actually confirmed routes")
        serialized=json.dumps(history)
        H.check(all(s not in serialized for s in ("private_key","certificate_pem","target_host","connect_ip")),"R45 public route history contains no private identities or addresses")
        # Disable automation via normal versioned policy save before an explicit
        # OS socket fault. This exercises protected compensation with real Agents.
        current_policy=request("GET",f"/api/routing/policies/{fid}")
        before=route_state(fid); graph=request("GET","/api/routing/topology")
        request("PUT",f"/api/routing/policies/{fid}",{"schema_version":1,"expected_policy_version":current_policy["version"],
            "intent":{**intent,"expected_revision":before["config_revision"],"topology_digest":graph["digest"]},
            "enabled":False,"auto_failover":False,"auto_failback":False,"failure_threshold":1,"recovery_threshold":1,
            "cooldown_ms":30000,"max_rtt_ms":5000,"max_loss_percent":0,"min_handshake_success_rate":1})
        H.docker(["exec","-d",H.INGRESS_CONTAINER,"sh","-c",f"echo $$ > {FAULT_PID}; exec nc -l -p 21094"])
        fault_running=True
        H.check(bool(H.wait_until(lambda:":21094" in H.docker(["exec",H.INGRESS_CONTAINER,"sh","-c","netstat -tln"]),timeout=10,interval=1)),
            "R45 real foreign TCP socket occupies only the candidate listener")
        status,response,_=H.req("PATCH",f"/api/forwards/{fid}",{"listen_port":21094,"expected_revision":before["config_revision"]},timeout=120)
        H.check(status==502 and response.get("code")=="apply_failed","R45 protected listener cutover reports the real bind failure")
        recovered=bool(H.wait_until(lambda:H.wait_active(fid) and payload(21093,b"secure-compensated-primary"),timeout=90,interval=2))
        restored=route_state(fid)
        H.check(recovered and restored["config_revision"]>before["config_revision"]+1 and
            restored["applied_revision"]==restored["config_revision"] and restored["routing_security_version"]==1,
            "R45 failed protected cutover restores authenticated baseline payload at a newer exact revision")
        compensation=rollout_state(fid)
        H.check(any(r["revision"]==before["config_revision"]+1 and r["compensated"] for r in compensation),
            "R45 real protected rollback is durably marked compensated")
        H.docker(["exec",H.INGRESS_CONTAINER,"sh","-c",f"kill $(cat {FAULT_PID}); rm -f {FAULT_PID}"])
        fault_running=False
        OUT.joinpath("routing-execution-observations.json").write_text(json.dumps({"method":"real_linux_agents_and_socket_faults","receipts":receipts,"history":history},indent=2),encoding="utf-8")
    except Exception as exc:
        message=str(exc)
        H.check(False,f"R45 acceptance failed: {type(exc).__name__} {message}" if len(message)<160 and 'PRIVATE' not in message else f"R45 acceptance failed: {type(exc).__name__}")
    finally:
        if fault_running:
            H.docker(["exec",H.INGRESS_CONTAINER,"sh","-c",f"test ! -f {FAULT_PID} || kill $(cat {FAULT_PID}); rm -f {FAULT_PID}"],allow=True)
        if fid:
            try:
                policy=request("GET",f"/api/routing/policies/{fid}")
                diagnostics["last_decision"]=policy.get("last_decision")
                diagnostics["controller_state"]=policy.get("controller_state")
                current=route_state(fid)
                diagnostics["forward"]={key:current.get(key) for key in ("id","config_revision","applied_revision","apply_status","middle_node_id","routing_security_version")}
                code=current.get("apply_error_code")
                diagnostics["forward"]["apply_error_code"]=code if isinstance(code,str) and len(code)<=64 and code.replace("_","").isalnum() else None
                diagnostics["rollouts"]=rollout_state(fid)
                history=request("GET",f"/api/routing/policies/{fid}/history")
            except Exception: diagnostics["snapshot_state"]="unavailable"
            try:diagnostics["proposal"]=request("GET",f"/api/routing/policies/{fid}/decision")
            except Exception:diagnostics["proposal_state"]="unavailable"
        OUT.joinpath("routing-execution-observations.json").write_text(json.dumps({"method":"real_linux_agents_and_socket_faults","receipts":receipts,"history":history,"diagnostics":diagnostics},indent=2),encoding="utf-8")
        if stopped:H.docker(["start",CONTAINER],allow=True)
        if fid:
            try:
                request("DELETE",f"/api/forwards/{fid}");H.check(True,"R45 normal deletion closes secure runtimes and releases leases")
            except Exception:H.check(False,"R45 normal deletion failed")
        if role_before is not None:H.db("await db.node.update({where:{id:%d},data:{role:%s}});return true;"%(MID,json.dumps(role_before)))
        if echo:echo.stop()
        signal.setitimer(signal.ITIMER_REAL,0)
        OUT.joinpath("routing-execution-result.txt").write_text("\n".join(H.RESULTS)+f"\nR45 TOTAL PASS={H.PASS} FAIL={H.FAIL}\n",encoding="utf-8")
        H.release_lock()
    return 1 if H.FAIL else 0

if __name__=="__main__":raise SystemExit(main())
