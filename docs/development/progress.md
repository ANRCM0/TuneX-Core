# VNext 实施进度

日期：2026-10-12（Asia/Shanghai）。记录当前实现与证据，不取代目标规范。
Phase 0 基线提交 `2b679f5`；Phase 1 提交为 `b7e5f5b`。证据 JSON 的
commit 字段是测试时 HEAD；另记录 Agent SHA 和测试命令，明确未提交工作树。

| 工作项 | 状态 | 实现及验证范围 |
| --- | --- | --- |
| 旧 V2 隔离、新工作区、纯 Core | verified | `2b679f5`；历史源码归档、纯解析/CAS、13 项 Core 测试 |
| TS/Go ADP/2 direct 契约 | verified（静态部分） | `2b679f5`；共享正反例、摘要向量；不是完整 ADP-16 的运行验收 |
| Direct Planner | verified（离线部分） | `2b679f5`；16 项 Planner 测试、完整快照和资源约束 |
| MySQL/Hono Control | implementing（本地验证通过） | scope/owner/grant、一次性注册、指纹凭据、Forward/预留/Operation/幂等响应同事务；READ COMMITTED/当前锁定读取 |
| Runtime / Operation | implementing（本地验证通过） | 持久 scanner/claim、过期 Worker 防护、当前 session、不可变快照、续期与全节点容量、Report 持久去重及 ACK |
| 在线 Go Agent TCP | implementing（本地验证通过） | mTLS Hello、MAC journal、先持久化后 bind、目标 CIDR/DNS、TCP 半关闭、限额、租约/证书截止与报告重试 |
| CLI / Phase 1 本地实网 | implementing（本地验证通过） | HTTPS 创建/查询 Node、Forward 与 Operation；独立 Agent/target 进程的双向 payload；事务与协议故障注入 |
| Linux CI / 实节点证据 | implementing | CI 已配置 MySQL 8.4.9、Go race 与同一实网脚本；本次未运行远程 Linux CI |
| Phase 2 生命周期、安全与恢复 | implementing | 更新/启停/删除/重试、UDP、持久清理、证书轮换/撤销、Linux 时钟/挂起故障与完整验收 |

命令：`npm run check`、`node scripts/run-go.mjs vet ./...`、
`npm run test:phase1`。本地基线仍为84项 TS测试；新 Go TCP/state/control
测试验证半关闭、目标策略、journal损坏、续期不重启、等代不续期、
写盘失败不应用与取消后不重新绑定。

实网脚本使用项目缓存中的 MySQL 8.4.9（Windows/x86_64），验证创建重放、
并发首次写入、端口冲突、后段故障回滚、claim恢复/锁后终态读取、
身份拒绝、持久 ACK/异正文拒绝、旧会话拒绝、租约过期报告健康隔离及
完整快照容量前置检查。证据位于忽略的 `.artifacts/phase1/run-*/evidence.json`。

本次修复 HTTPS 重定向、bind/截止竞争、目录 fsync 错误、快照容量、
Worker 读视图/执行期限、永久错误码、旧授权借用新租约等边界问题。

Phase 1 的 TCP 创建实现与本地内部出口已完成，Linux 平台出口仍待 CI/实节点
证据，不标完整阶段 verified。单节点更新、删除、UDP 的实现进展见下方 Phase 2 记录；Relay 和发布安全审计尚未完成。
不得把本地创建切片或 CI 配置当作生产就绪声明。


## Phase 2 direct lifecycle update

Baseline: `b7e5f5b`. Current changes implement direct TCP/UDP creation, target/port
updates with CAS/no-op, enable/disable, deletion and explicit failed-Operation retry.
They supersede the earlier table's planned status for these lifecycle functions,
while full Phase 2 remains `implementing`.

TCP sockets transfer listener ownership independently of old execution records;
old streams retain their configuration and bounded drain. UDP associates each client
with a distinct checked target socket, bounds queues/replies and expires idle state.
TCP/UDP process-wide limits are 4096 streams and 4096 associations respectively.
Runtime retains retirements, tombstones and per-session maximum authorization
expiries; current reports cannot release unexpired historical holders.

Validation: `npm run check`, Go vet, `npm run test:phase1` (20 checks) and
`npm run test:phase2` (direct lifecycle and historical-lease/scanner regressions).
Evidence includes actual payloads, socket/slot reclamation, commit and Agent SHA.
Current worktree evidence is not a committed or Linux production acceptance claim.

Outstanding: Node credential rotation/revocation, target-policy withdrawal,
clock/suspend and restart faults, remaining direct acceptance matrix and measured
capacity on Linux. Phase 3 Relay contracts/security, Phase 4 supported transport
evolution and Phase 5 Web/release remain outstanding. Full project goal stays active.

Development details: [Phase 2](phase2.md).

## Node security slice

Baseline: `9a704d8`. The current implementation adds enrolled credential records,
bounded rotation overlap with persistent CSR/request replay, authenticated keypair
reload, Node revocation and policy CAS/withdrawal Operations. Runtime checks the
actual certificate again in the transaction and bounds each fetched snapshot by
its effective expiry. Policy changes advance execution generation/fence while
preserving Forward intent revision; expired/revoked identities cannot obtain new
authority. Owner deletion remains available for cleanup after Node revocation.

The MySQL/HTTPS/TCP security suite covers duplicate rotation, old-credential
expiry, held-stream preservation, policy updates/denial, Agent `--rotate`, revoked
credential rejection, pending historical cutoff and secret-free audit. Evidence
is under `.artifacts/security/run-*/evidence.json`; static and existing direct
network suites are regression gates. Details: [Node security](node-security.md).

Full Phase 2 remains implementing: offline hard-deadline/clock-suspend faults,
Linux real-node/race/capacity measurement, grant-management and backup/recovery
evidence are still required. Relay/transport/Web/release work is also outstanding.

## Linux race evidence

Commit `5203c15` passed `go test -race ./...` with Go 1.26.3 on the existing
`TXBoard-Baseline` WSL2 Linux/amd64 environment (kernel
`6.6.87.2-microsoft-standard-WSL2`). All four tested packages passed: contracts,
control, forward and state. Both command packages compiled with no package tests.
The locked toolchain and module/build caches stay inside the ignored project cache;
no existing system toolchain, Redis or database service was changed.

Redacted local evidence: `.artifacts/linux-race.json`. This closes the Go Linux
race-detector gap described above. It does not close Linux MySQL/HTTPS/independent
Agent acceptance, namespace fault tests, capacity measurement or release rehearsal.

## Authorization fault slice

Baseline: `015b81c`. The direct runtime now uses a suspend-aware wall/uptime Guard
and immutable execution tickets. TCP/UDP check tickets before data-plane IO;
blocked-read completion is rechecked before bytes reach another endpoint. Clock
failure latches closed; renewed snapshots do not renew old drain instances.

The real Control/MySQL/Agent fault harness passed six short-policy scenarios:
Control outage with bounded continuing TCP/UDP, hard cutoff, offline restart,
online higher-generation recovery, drain hard cutoff and corrupt-state rejection.
The existing lifecycle (22 checks) and Node security (8 checks) suites also passed.
Native WSL/Linux Go race tests include the new authorization and forward packages.

Pinned-version Linux container integration was attempted with a project-specific
temporary daemon; registry and trusted cache connections timed out. The daemon
was closed, existing WSL services were not changed. This is an environment evidence
gap, not a passing integration result. Details: [Authorization faults](authorization-faults.md).

Full goal remains active: OS time-sync status, Linux integration/capacity/recovery,
remaining direct matrix, Relay, Web and release gates are still outstanding.

## OS synchronization and native Linux Agent

Baseline: `44ee3b8`. Linux now reads synchronized kernel state/error bounds directly;
Windows parses service state plus root/phase/holdover bounds and rejects stale or
failed synchronization. A real OS collector can provide atomic MAC-protected,
short-lived evidence to an unprivileged Agent; host/platform/age/error bounds are
checked and there is no ?assume synchronized? runtime flag.

Current Windows status fails the new policy and is recorded as a rejection, not
a passing OS clock. Existing positive Windows suites need a genuinely healthy
time source or the real supervisor proof; earlier evidence does not automatically
prove this stricter version. No OS configuration was weakened for testing.

Real native Linux Agent/client/target acceptance now runs against locked-version
Windows Control/MySQL over the private WSL interface, including actual kernel time
proof, mTLS/ACK, both payloads, lifecycle and outage/restart. This is explicitly a
mixed-platform topology, not a wholly Linux stack. Native Linux race tests also pass.
Details and remaining gates: [System time](system-time.md).

## Access management slice

Baseline: `151e9b2`. Owner-only member role and Node-use grant commands now use
CAS, persistent idempotency and shared-transaction access audit. Existing account
credentials cannot be overwritten; the scope owner cannot be demoted or removed.
Forwarding records the actual execution authorizer separately from Operation audit
requesters. Runtime rechecks current active manager membership, explicit Node use
and policy before signing another snapshot.

Real MySQL/HTTPS/native Linux Agent acceptance passed membership/concurrency,
rollback, grant withdrawal/restoration, owner-policy authorizer preservation,
same-Node actor isolation, removed-actor replay refusal, cleanup and CLI cases.
Evidence is `.artifacts/access/run-*/evidence.json`; current local topology is
Windows locked Control/MySQL plus native Linux Agent/client/target. CI's native
Linux/MySQL access gate is configured but is not counted as remotely verified.

Details: [Access management](access-management.md). Remaining work includes full
capacity/recovery/release evidence, Relay/transport contracts and implementation,
the product Web surface and identity/recovery ergonomics. Full project goal stays active.


## Independent authority, old-backup recovery and bounded capacity

Baseline: `61d97f4`. Control now persists each issued authorization upper bound in
an independently protected MAC record before database publication. Explicit fresh
initialization, maintenance and database/CA binding prevent old MySQL restoration
from silently resetting execution authority. Missing or partial authority state
cannot be initialized over existing Nodes.

The operator CLI performs actual single-transaction MySQL backup and checked
fresh-database restore. It waits for historical leases plus clock/error margins,
quarantines old Node credentials, observations, Operations, Forward execution and
idempotency replay, rotates account credentials into a protected file, and requires
the exact recovery review ID before resuming Control. Rebuilding each reviewed
Forward requires a fresh Node identity and explicit new revision; Agent high-water
is retained. SQL/manifest/credential files are synchronized and permission-protected;
backup encryption and Windows ACL remain deployment responsibilities.

The real native Linux Agent recovery suite passed 9 checks. The capacity suite passed
6 bounded checks, measuring 64 TCP/32 UDP, resource reclamation, unchanged execution
across renewal and simultaneous reconnect of four actual Agents. These local samples
are not maximum performance promises. Current topology is Windows locked Control/
MySQL with native WSL/Linux Agent/client/target. Native Linux CI entry points are
configured; no remote run is claimed. Unit/static gates and Linux race also pass.

Details and operator procedure: [Recovery and capacity](recovery-and-capacity.md).
Evidence remains in ignored `.artifacts/recovery/` and `.artifacts/capacity/`, with
commit/dirty state and platform data. Full Phase 2 stays implementing pending matrix,
budget and environment gates; Relay, product Web and release work remain outstanding.


## Phase 3 prerequisite: Relay v1 contract and immutable Transport Profiles

Baseline: `7c4037b`. ADR-0003 fixes the initial two-Node TLS 1.3 data-plane design,
independent peer certificate purpose, exact deployment binding, bounded TCP/UDP
framing and internal physical resource ownership. Those role/fence changes require
ADP/3; current ADP/2 stays direct-only and rejects Relay requests.

Transport now owns immutable Profile revisions with owner-only publication, CAS,
no-op, shared-transaction replay responses and scoped historical queries. The strict
Relay wire/Profile schema has generated Go types and 18 shared TS/Go vectors.
Real MySQL/HTTPS acceptance passes 7 checks including concurrency, rollback,
authorization, old-revision durability, CLI and explicit unsupported execution.
Details: [Relay preparation](relay-preparation.md).

This prerequisite is not Phase 3 completion: use-grant withdrawal, Node endpoints,
ADP/3 assignment/state migration, authenticated encrypted peer execution and real
two-Agent failure/lifecycle evidence are still required. Full project stays active.


Clean-commit evidence for the preceding recovery/capacity slice: `7c4037b` passed
9 recovery checks (`.artifacts/recovery/run-JYtN7H/evidence.json`) and 6 capacity
checks (`.artifacts/capacity/run-Zc93Nk/evidence.json`), both with dirty=false.
Measured 64 TCP/32 UDP, 170 FD, 201 goroutines, about 9.3 MB heap/33.6 MB runtime
and four-Agent reconnect about 1.4 seconds. Two bounded load samples verified
51.2/54.5 MB/s bidirectional payload; p95 about 4.9/12.7 ms. These are mixed-platform
local samples, not a maximum supported or release capacity claim.


## Relay preparation authority and physical resource plan

Baseline: `14ba7db`. Profile use grants now require an explicit active-manager
permission, owner CAS/idempotency and persistent audit. Node internal endpoints
have explicit bind/reachable host/TCP ports, owner CAS, replay and Node audit.
The authenticated preview/compiler checks both Node grants and current credentials,
exact Profile revision/digest, egress endpoint and ADP/3/Relay wire capabilities.
It returns unreserved physical resources, including separate internal TCP sockets
for UDP; it does not accept a deployment. Active Relay grant/endpoint mutation is
refused until durable withdrawal coordination exists. Old-backup recovery clears
all Profile use grants while preserving immutable config history.

The expanded real MySQL/HTTPS suite passes 10 checks; direct regressions, strict
contracts and Go verification remain gates. ADP/3 assignment/state cutover, peer
credentials, prepare/activate and actual encrypted two-Agent flow are next. All
unverified Phase 2 and release requirements remain open.


## ADP/3 Relay resource contracts and authenticated TLS primitives

Baseline: `b65097b`. Single Relay Assignment/Tombstone schema, generated Go types
and 18 shared TS/Go vectors now bind physical sockets, both Node sessions/fences,
locked Profile/config digests and role-specific endpoint/policy. They are preparation
contracts; whole-node ADP/3 messages and Agent state cutover are not yet supported.

Real socket TLS primitives enforce TLS 1.3/ALPN, complete mutual chain/purpose/expiry
verification, exact Node URI and leaf pins, with session tickets disabled. Dedicated
clientAuth+serverAuth leaves are mandatory, so current machine certificates cannot
silently become Relay server identities. Control/frame bounds and exact active
Open binding reject prepared downstream, stale session and expired authority.
Unit socket negatives cover wrong Node/CA/pin/purpose/expiry and TLS 1.2 downgrade.

Current Agent still advertises direct only. Two-Agent encrypted TCP/UDP traffic,
peer credential management, prepare/activate/lifecycle and release safety review
remain required; no whole Phase 3 or project completion is claimed.


## Relay execution engine socket slice

Baseline: `f83995b`. An isolated Go engine now prepares/activates authenticated
Relay TCP/UDP from strict assignments, opens ingress only after a real active-egress
probe, preserves TCP FIN and separates UDP client associations. Direct/Relay share
process TCP/UDP permits; Profile totals, queue/credit/idle and authorization checks
remain bounded. Hard execution/credential cutoff closes held traffic. TCP drain
retires listener acceptance and keeps bounded old streams; UDP drain closes sessions.

Real TLS socket tests exercise encrypted payload, half-close, prepared refusal,
UDP mapping/empty payload/idle, offline-style hard cutoff, old binding, CIDR denial,
budget return, drain and tracked peer expiry. This is an engine test, not two-Agent
Control acceptance. Whole ADP/3 snapshots, state/journal migration, peer certificate
issuance/rotation, coordinator/replacement and real multi-process acceptance remain
open. Current Agent stays direct-only and project goal remains active.


## Complete ADP/3 runtime schema and protected physical journal

Baseline: `a839ca4`. Whole-node direct/Relay Snapshot, Hello and Report/ACK shapes
now use strict protocol 3 parsing in TS/Go with 26 shared vectors. Physical resource
ownership is independent of customer protocol, and mixed direct/Relay snapshots
reject collisions, wrong role/session/digest and old TLS resource resurrection.

Protected RuntimeJournal binds protocol/Node and persistent Snapshot/fences/retired.
Exclusive initialization refuses existing/corrupt files; snapshot acceptance locks
and reloads durable high-water, refuses stale callers, and persists before any socket
mutation. Corrupt/missing/foreign state and write failure remain closed. Parser/state
components do not restore cached authority or automatically reset ADP/2 counters.

Current online Control/Agent still use ADP/2; dedicated peer credential management,
ADP/3 database/runtime cutover, multi-process activation/flow/faults and release gates
remain open. Full project is not completed by this protocol slice.


## Dedicated Relay peer credential issuance

Baseline: `b12c298`. Current enrolled machine mTLS/session may now request a separate
P-256 Relay leaf with exact Node URI and clientAuth/serverAuth purpose. Persistent
request/CSR response replay, current-machine checks and two-leaf bounded overlap
prevent repeated issuance from silently expanding trust. Peer leaves are not machine
API credentials; valid execution cutoff is bounded by DB/Node state independently
of certificate NotAfter. Node retirement and old-backup recovery revoke all peer rows.

Real MySQL/HTTPS suite passes 12 checks including URI/EKU, replay/conflict, purpose
separation, overlap capacity and retirement. Agent peer key loading/renewal and
ADP/3 runtime pin publication are not yet connected; complete two-Agent lifecycle
and release gates remain outstanding.
