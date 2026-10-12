# TuneX VNext · Verification & Acceptance Matrix v1

**Status: normative acceptance goals; not claims of tests already passed.**

## 1. Evidence tiers

- **U — Unit**: pure Core model, parser and state transition cases (no external infra).
- **I — Integration**: real temporary MySQL and Control API, transactional CAS/leases, worker recovery.
- **P — Protocol**: Agent/Control authenticated contract and malformed/out-of-order traffic tests.
- **N — Network**: genuine TCP and UDP sockets on Linux namespaces/containers/two hosts, client↔target payload/reply assertions.
- **S — Security**: authentication, authorization, replay, lease, fence, target access policy, secure no-downgrade.
- **R — Release**: reproducible builds, SBOM/license review, deployment, backup/restore, rollback, resource/perf envelope and operator documentation.

## 2. Mandatory cases

| ID | Scenario | Minimum tier | Required outcome |
| --- | --- | --- | --- |
| FWD-01 | TCP direct create / data / delete | U,I,N | Echo payload matches, listener removed |
| FWD-02 | UDP direct and reply mapping | U,N | Reply reaches right client; session expires |
| FWD-03 | TCP + UDP same Forward | I,N | Both independent resource slots acquired atomically |
| FWD-04 | Invalid port/target/duplicate protocol | U | Parser rejects |
| FWD-05 | Path cycle / invalid transport combination | U | Core rejects |
| FWD-06 | Unauthorized Node/Profile/reference | I,S | Scope/grant check rejects |
| FWD-07 | Concurrent update expectedRevision | I | Exactly one CAS winner |
| FWD-08 | Concurrent Forward same binding key | I,N | Exactly one active reservation and listener |
| FWD-09 | Disable keeps reservation | I,N | No new accepts; existing drains by policy |
| FWD-10 | Delete + delayed old apply | I,P,S | Tombstone/fence prevents resurrection |
| ADP-01 | Duplicate identical Snapshot | P,N | No second listener / duplicate ownership |
| ADP-02 | Snapshot N after N+1 | P,S | N rejected and cannot regress local config |
| ADP-03 | Incomplete/truncated Snapshot | P,S | No unintended deletion |
| ADP-04 | Persisted high-water crash and reboot | P,N | Stale command rejected post-restart |
| ADP-05 | Foreign-node credentials | P,S | Fetch/report denied |
| ADP-06 | Expired snapshot/lease | P,S | No indefinite unauthorized execution |
| ADP-07 | Observation out of order/stale | I,P | Never overwrites fresh observations |
| OPS-01 | Worker crash after DB commit | I | Work rediscovered with no missing accepted intent |
| OPS-02 | Redis loss and restart | I | Outstanding operation reconstructed from DB |
| OPS-03 | Egress unavailable during prepare | I,N | Ingress not activated prematurely |
| OPS-04 | Multi-Agent activate failure | I,N | Persist partial state + eventual cleanup/recovery |
| OPS-05 | Path switch while TCP streams open | N | Established stream behavior conforms to drain policy |
| OPS-06 | UDP route switch | N | Documented session behavior, never false zero-loss claim |
| SEC-01 | Encrypted requirement unsupported | P,S,N | Reject; no silent plaintext fallback |
| SEC-02 | Target DNS/address policy evasion | I,N,S | Forbidden destinations cannot be dialed |
| SEC-03 | Old owner releases reassigned port | P,N,S | New owner remains bound |
| SEC-04 | Corrupt local cache / clock rollback | P,S | Fail closed according to lease policy |

## 3. Required test evidence

For each case, record commit SHA, platform/kernel, Agent binary SHA, Control API/schema versions, isolated test topology, relevant protocol generation, outcome and logs excluding secrets. Protocol tests must assert **actual state and traffic**, not just an HTTP 200/202 or ACK. CI status of historical V2 is not evidence of ADP/1 compatibility.

The first functional milestone requires FWD-01 through FWD-10 (applicable v1 direct), ADP-01 through ADP-07, OPS-01/02 and SEC-02/03/04. Multi-Agent and encrypted cases gate their respective later milestones. Security signoff and production test gates are additional requirements for release.

## 4. Release restrictions

No production-ready claims based solely on source inspection, green unit tests, cross-compilation, localhost mock Agents or unverified benchmark numbers. Before release require Linux real-node validation, upgrade/reset policy, backup and secret rotation rehearsal, network/firewall baseline, capacity limits, failure injection, license review and residual-risk documentation.

