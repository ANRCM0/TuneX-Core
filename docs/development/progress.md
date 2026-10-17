# VNext 实施进度

更新：2026-10-17（Asia/Shanghai）。记录实现与证据，不取代目标规范。
下方以各切片的实际日期/基线保留历史记录；“尚未实现”等阶段性描述须结合后续
条目阅读，不能用早期状态覆盖最新代码。
Phase 0 基线提交 `2b679f5`；Phase 1 提交为 `b7e5f5b`。证据 JSON 的
commit 字段是测试时 HEAD；另记录 Agent SHA 和测试命令，明确未提交工作树。

## 当前源码快照与后续排期

2026-10-17：owner-owned 写端口、独立观察、Probe 协商/实例/许可/领取/投递/监视/
结果与默认关闭生产闭环已保存到本地 `47843fd`，尚未推送，详细批次见
[开发目标](next-milestones.md)。当前增量补上 [Probe 管理 Console](../spec/forward-probe-management-v1.md)：
固定 Forward revision 签发、同键重放、不确定结果、历史查询、最多五秒/八次等待及显式撤销。
十组新控制器回归已编写；真实 HTTPS Chromium 桌面/390px 流程已接入同一
真实 Agent/Control/MySQL `probe-workflow` job，包括已提交响应丢失后原键重放。
本机仅静态检查，未运行浏览器、网络或数据库测试；对应 SHA 的 Actions 仍未取得。
后续继续剩余原生能力、规则/隧道/拓扑、遥测、审计/支持包与交付，不能将本批当项目完成。

2026-10-17 后续：Probe Console 已存本地 `724b9bd`，同样尚未推送。当前增量按
[ADR-0019](../decisions/0019-native-catalog-and-profile-impact.md) 接入既有 native 版本化目录、
Profile 期望引用/锁版配置影响与 Console 载入原编辑器流程。共用授权事务、只读投影与
原 Transport resolver；只预览配置，不建立第二执行台账或自动发布。
契约、Go 注册表一致性、端口、UI、SELECT-only MySQL/API 回归已编写并接 Actions，
本机未运行功能或真实 MySQL/浏览器验收。目录中的 OS/能力声明不冒充该平台验收。

2026-10-17 后续：原生目录/Profile 影响已存本地 `32db050`，同样尚未推送。
当前增量按 [ADR-0020](../decisions/0020-explicit-native-rule-commands.md) 补上规则复制、显式失败重试和最多十条当前页启停计划。
所有提交仍逐条使用原 owner-owned CAS/幂等/Runtime，不提供跨规则原子性或自动补偿；
未知提交停止尾部，只有另行确认才重放原键/原请求。复制默认停用/重新选端口，链路保持锁版/原预检。
新增 16 组队列、复制与 HTTP 回归，真实 Chromium/Agent/Control/MySQL 夹具补部分 CAS、
实际 TCP、已提交响应丢失重放和注入失败后的重试；仅静态通过，均待 exact-SHA Actions。
本批不关闭其他隧道/引用编辑浏览器、拓扑、遥测、审计与交付缺口。

2026-10-17 后续：规则管理已存本地 `5d68f1f`，同样尚未推送。当前增量按
[ADR-0021](../decisions/0021-native-tunnel-read-model.md) 补同事务授权的隧道只读元数据、
最多四项 Peer 窗口、Endpoint 和当前规则有序相邻引用；不签发、不读取 PEM/原始 Report、
不测网络、不证明健康或删除安全。Node/Endpoint Console 入口、分页取消、原部署详情与精确 Profile 修订查看已接线。
新增 7 组端口、1 项真实 SELECT-only MySQL/API、7 组 UI 及 4 组修订/失效回归；
真实 Relay Chromium 流程补发布新 Profile 后原规则不变、引用影响载入原编辑器、重新预检/CAS 更新，
以及停用复制/另选端口/显式启删和双协议实际流量。Actions 仅上传脱敏证据和指定截图。
本机仍只做语法/类型/契约/边界/文档静态检查，没有运行功能、数据库、浏览器或网络验收；
新树没有 exact-SHA Actions。显式 Profile 批次发布、真实多跳复制浏览器与后续拓扑/遥测/交付仍未完成。

2026-10-17 后续：隧道管理已存本地 `e8bf7d5`，尚未推送。当前增量按
[ADR-0022](../decisions/0022-explicit-profile-batches.md) 接入 Profile 当前影响页最多十项显式发布，
仅改变冻结的 Profile 锁版，逐项先用原计划检查再用原 owner CAS/幂等命令，无跨规则事务。
预检失败不等于更新已发送；更新不确定仅重放原请求，不再重查并替换命令。当前权限拒绝重放也不清除原提交不确定性。
新增 8 组队列、4 组选择回归，真实 Relay Chromium 接线补双引用 CAS 部分失败、已提交响应丢失后原键重放与真实 TCP/UDP。
全部仍只编写/接线，本地静态检查通过；无新增功能/MySQL/网络/浏览器执行结果，未取得 exact-SHA Actions。
B1/P1 验收、真实多跳复制浏览器以及路径模板/切换、遥测、审计、交付等项目缺口仍未关闭。

2026-10-17 后续：显式 Profile 批次已存本地 `6059da8`，尚未推送。当前增量补
[真实多跳 Console 复制验收](../testing/native-multihop-console.md)：现有 3/4/8 Agent 进程矩阵各接原 Chromium/HTTPS Control/MySQL，
新 Profile 已发布但源/副本仍锁旧版；默认停用复制、另选端口、有序路径/六中继上限、编辑失效后原预检及独立启停删 CAS。
脚本独立检查 TCP/UDP、每节点两项物理资源、停用保留/删除释放、源规则不变及清理；补两组轻 DOM 回归。
隔离网络步骤仍不启浏览器；不支持的显式组合在 PKI/数据库/网络副作用前拒绝。只新增指定截图 allowlist，不上传浏览器凭据或受保护状态。
本机仅静态检查，所有新增真实浏览器/数据库/网络断言均未执行，无 exact-SHA Actions；不关闭 B1/P1、物理主机或项目验收。

2026-10-17 后续：多跳浏览器接线已存本地 `d0f4c96`，尚未推送。本批按
[ADR-0023](../decisions/0023-immutable-native-path-metadata.md) 实现 [C1 路径模板元数据首片](../spec/native-path-templates-v1.md)：
同事务原授权/精确引用、不可变修订/摘要、Scope 配额/CAS/幂等、终态归档和独立 Console 表单。
不写 Forward/Runtime/资源或签发授权；读取显式标注当前引用未复核、无绑定/资源/执行许可。
迁移 0018 与 Control-only 升级 Profile、部分 DDL 拒绝、恢复/历史保留责任已同步；Agent/Core/Journal 不变。
8 组端口、9 组 UI、真实 MySQL 并发 CAS/配额与 SELECT-only、现有 3/4/8 Agent 真实 Chromium 模板流程已编写并接线。
本地仅静态检查，无本批匹配 SHA 的功能/数据库/浏览器/网络 Actions；C1 的绑定、引用影响和手动切换仍未实现，
不关闭 C1、B1/P1、遥测/运维交付或整个项目目标。未经新的用户推送同意不触发远端 CI/自动 Dev 镜像。

2026-10-17 后续：路径模板元数据已存本地 `3d88abe`，尚未推送。按
[ADR-0024](../decisions/0024-original-owner-path-bindings.md) 增加精确路径绑定、来源/历史和显式单规则切换。
绑定与原 Forward CAS/原执行准备、实际展开配置/Operation/容量和原幂等响应同事务；没有第二执行器或 Core 字段。
元数据来源可不重启相同展开配置；普通拓扑编辑解除当前来源指针并保留不可变历史，模板修改/归档不隐式改规则。
Console 提供精确目标/当前 CAS、独立提案与确认、原预检/同事务命令和未知提交原键重放；当前拒绝重放保留原不确定性。
迁移 0019/Control-only 兼容上界、部分 DDL、完整 SQL 来源保留及原恢复隔离已同步。
新增 9 组端口/9 组 UI 与真实 MySQL 并发 CAS/来源配额/整事务回滚/SELECT-only；3/4/8 Agent Chromium
接真实缩短路径、已提交回执丢失后同键重放、TCP/UDP、新 CAS 显式切回和归档不改规则，再原 CAS 停删/清理。
本地仅静态检查，功能/MySQL/浏览器/网络均未执行，无本批 exact-SHA Actions；
多规则路径逐条发布、冻结源码验收/中断测量及后续遥测/运维交付仍待推进，C1 和全项目目标保持开放。

2026-10-17 后续：精确绑定/单规则路径切换已存本地 `917dcb8`，尚未推送。按
[ADR-0025](../decisions/0025-explicit-path-batches.md) 补当前影响页最多十条的
[显式路径批次](../spec/path-publication-v1.md)，复用原队列/提案/Relay 预检与原绑定命令。
目标、源/展开配置、CAS 和独立键均固定；明确拒绝逐项处理，未知预检不写意图，未知写入只同键重放且不自动继续尾部。
9 组队列/4 组选择回归，以及原 3/4/8 Agent Chromium 的双引用/CAS 部分失败、短路径 TCP/UDP、
新修订显式恢复/已提交回执丢失后重放、尾部新确认和无 Operation 来源更新均已编写/接线。
第三条停用夹具规则与竞态 API 单独计数，资源由原删除回收；没有新迁移、Core/Agent/机器协议/Journal 改动。
本机仍只静态检查，没有本批功能/MySQL/浏览器/网络或 exact-SHA Actions 证据，不关闭 C1/B1/P1 或全项目。
冻结源码验收/中断测量仍待执行，后续继续指标/有界历史及既定遥测/运维交付。

2026-10-16 后续核验：`cdb67a8` 的主 CI `38837400564`（7 个 job）、
容器 `38837400557`、Dev 发布 `38837400575` 全部成功，上一切片的只读升级/
恢复评估完成该 SHA 的 Actions 回归，不等于真实升级、备份或生产恢复演练。
当前推进 [Console 服务端查询与全量概览](console-query.md)：有界筛选、
独立授权候选、Scope 全量聚合，以及 Direct/Relay 编辑器的分页解耦。
新测试已接入 Contract 和 Phase1 SELECT-only MySQL，等待本切片提交后的 Actions；
本地只做类型、语法和边界检查，真实浏览器/物理主机验收仍未执行。

后续核验（2026-10-16）：`6e9586d` 主 CI `38831559895` 的 7 个 job、
容器 `38831559907` 和 Dev 发布 `38831559896` 均通过；3/4/8 节点及隔离矩阵
已经完成该 SHA 的 CI 验证。下方历史失败/待核验文字保留为切片记录。
当前新增 [只读升级与恢复评估](../operations/upgrade-assessment.md)：
SELECT-only MySQL、受保护 Authority 校验、Agent Journal 无副作用摘要、
Schema/Journal 回退拒绝矩阵、机器可读结论及备份责任。
纯矩阵、真实 MySQL/Agent 和容器接线已编写，等待本切片对应提交的 Actions；
本地未运行功能测试，不代表完成真实升级或生产恢复验收。

2026-10-16 源码基线：`11b95451464c5adb0068a09cb976492850479b4e`。
已提交默认关闭的多跳统一所有权/授权、混合执行 Snapshot、生产 Runner
适配、Report 驱动协调、Console 路径管理与验收/发布门槛工具。
六批交付的具体范围和未通过出口见 [多跳交付台账](multihop-delivery.md)。
独立 Transit v1 仍是离线组件；生产路径采用 ADR-0005 的 `native.multihop.v1`。

该初始基线的容器运行 `38825824444` 通过；主 CI
`38825824472` 的 contracts/Go race 与 Relay 隔离/容量/轮换通过，但七项
多跳 MySQL 回归和 3/4/8 节点创建失败，相关后续验收跳过。镜像发布
`38825824411` 被同 SHA 门禁阻止，不是已发布本提交镜像的证据。
后续 `b8217fe` 已修复领域输入边界，其 CI `38830077965` 的 contracts/Go race
和 Relay 隔离作业通过，多跳 MySQL 为 5/7；两项冻结 Report 夹具错误和
3/4 节点验收 DELETE 请求未声明长度的问题由 `95315f8` 修复。
3/4 节点已有双协议、续期、重启、重放与撤权恢复的部分运行结果，但完整
多跳与隔离矩阵不计通过。后续完整树待新 SHA 的 Actions，细节见交付台账。
浏览器、物理主机和最终冻结版本验收仍待执行；历史 Direct/Relay 本地证据
不能自动证明此版本回归通过。运行测试继续在 CI / GitHub Actions 执行。

下一阶段按 [开发目标](next-milestones.md) 推进部署/升级保护、诊断与审计、
证据流程和 Console，再冻结版本验收。分角色 Compose、部署预检、
backup/restore 与内部 candidate 镜像机制均已有基础，后续为增量补齐。
分角色预检/用例与固定 Node 的 CI 接线已提交为 `73b019d`；统一最新 CI 判断器
与 candidate/正常发布接线已提交为 `c9629e4`。功能回归全部交由 Actions，
不能把本地静态检查或旧树通过记录混用为这批变更的运行结果。
源码核验还确认全量概览、
独立节点候选、服务端筛选、审计查询/支持包和真实浏览器 CI 仍需增量开发。
1Panel、双物理主机 Relay、长周期稳定与配套恢复三项 P0 继续保留。

## 历史切片记录

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

## ADP/3 Online Direct Cutover

Baseline: `0e07483`. Control now persists and serves complete ADP/3 physical-resource
snapshots; standard Agent enrollment/startup uses protected RuntimeJournal and only
binds after persistent acceptance. Hello/Report/ACK, credential rotation and direct
lifecycle use `/agent/v3/*`. Old endpoint, payload and persisted protocol history
are refused; counters and identities are never reset as an upgrade mechanism.

Static verification passes 161 TS tests plus Go tests/build/contracts/offline plan.
Real Linux Agent passes 7 checks, access 14, recovery 9, bounded capacity 6 and
Transport 13, with topology and dirty status recorded. Existing Go vet/race gates
remain required. Details: [ADP/3 cutover](adp3-cutover.md).

This completes the direct protocol cutover slice, not Relay or full project delivery.
Peer identity loading and two-Agent runtime activation/traffic are next.

## Relay Agent Execution And Prepared Plan

Baseline: `f05d187`. Explicit Relay capability now loads a dedicated Node/session-issued
peer identity, persists a MAC-protected bundle and refuses corrupt/altered expiry.
Agent reconciles strict prepared/active/draining Relay assignments after journal writes,
probes before ingress activation and again for downstream health, preserves execution
during renewal and retires physical fences on removal. Failures retain actionable
retry classification; machine credentials cannot replace Relay peer leaves.

Control's deterministic compiler binds both Node sessions/credentials and all physical
reservations into immutable validated prepared assignments. It neither publishes nor
allocates. The persistent multi-Node acceptance/readiness coordinator is still pending.

Real Linux `--relay` identity/direct regression passes 9 checks. Two Runner tests use
simulated Control plus real TLS sockets for encrypted TCP/UDP/phase/renewal/failure
behavior; they are not independent two-Agent Control acceptance. Details:
[Relay Agent](relay-agent.md). Full Phase 3 and release gates remain open.

## Relay Control And Real Two-Agent Flow

Baseline: `56895c3`. Runtime owns durable two-Node Relay plans/stages and uses the
shared physical resource/fence/lease/retirement ledger. Forward acceptance reserves
all ingress/egress protocol resources with intent/Operation/replay in one transaction.
Current prepared and active/ready reports drive tail-to-head publication; Agent
independently probes before ingress opens. New sessions rebuild internal generations
and both Node/peer credentials bound Snapshot authority.

Profile and downstream Node grants withdraw through persistent Operations; direct
authorization/lifecycle gates remain in force. Updates, disable/enable, new boot and
delete preserve historical holders and wait for safe reclamation. Forward health
aggregates both Node reports. Recovery quarantines Relay deployments as well as trust,
intent, operations and replay. Details: [Relay Control](relay-control.md).

Actual MySQL/HTTPS/two independent native Linux Agent acceptance now verifies encrypted
TCP/UDP, activation safety, identity/no-downgrade, transaction rollback, renewal,
coordinator restart, lifecycle, authority withdrawal/restoration and offline cleanup.
The topology is mixed Windows Control/MySQL plus WSL same-host Linux processes;
namespace/two-host and complete Phase 3/release gates remain unverified.

Local verification on October 13, 2026: 14 Relay acceptance checks, 13 Transport,
14 direct access, 9 same-protocol recovery, 165 TS tests and Go build/vet/Linux race.
Each evidence artifact records the tested commit and whether its tree was dirty.

## Relay Held-Stream Switch And Failure Recovery

Baseline: `e7e6212`. Applied API observations now include the derived Forward revision,
Node and role so clients distinguish a healthy old configuration from an applied new
intent. Real tagged targets and continuous clients verify target/path switches with
established TCP, same-client UDP reset, bounded drain and safe former-egress release.

The expanded three-Agent suite passes 19 checks, adding actual external UDP bind
conflict, full-intent degraded state, scanner cleanup with an explicitly injected
overdue DB deadline, delayed Report duplicate/terminal protection and explicit retry
without changing desired revision. Actual clock and leases remain enforced. Shared
165 TS/Go/build/vet/Linux race gates pass. Details:
[Relay switch and faults](relay-switch-faults.md).

Full goal stays active. Same-host multiprocess evidence does not complete network
partition, production limits, transport evolution, product Web or release gates.

## Relay Network Namespace Isolation And Compensation

Baseline: `8bf7fe4`. Three actual Linux Agents now execute in distinct network
namespaces with run-owned bridge links and scoped internal-port packet drops.
End-to-end HTTPS authentication through an opaque Control proxy remains enforced.
The experiment found and fixed unreachable Relay peers being misclassified as
customer target outages; those peer failures now report retryable
`DOWNSTREAM_UNAVAILABLE` while target/authorization errors retain their meanings.

The 12-check suite verifies prepared/stale-observation activation barriers, actual
activation and active-network partitions, unchanged-generation recovery, genuine
old-generation/session replay refusal, failed replacement-path deadline withdrawal,
explicit new-revision compensation and physical cleanup. Deadline injection is only
an overdue disposable DB Operation; clocks, synchronization and historical lease
waits remain real. Details: [Relay network isolation](relay-network-isolation.md).

Clean prior-slice evidence: `8bf7fe4` passed 19 Relay switch/fault checks with
dirty=false (`.artifacts/relay/run-ddaHsm/evidence.json`). Current isolated-network
evidence records its own tested commit/tree status. A native Linux CI job is configured
but not counted as remotely verified. Local Control/MySQL remain on Windows, with
three WSL Linux namespaces on one physical host. Sustained Relay capacity, production
privileges, transport evolution, Web, deployment and release gates remain open.

## Runtime Intent Lock Boundary

Baseline: `132642e`, whose clean namespace suite passed 12 checks with actual network
cleanup (`.artifacts/relay-isolation/run-B4q1dQ/evidence.json`). The switch regression
then reproduced a 503 after Agent restart: InnoDB diagnostics confirmed opposite
Forward/runtime_nodes lock ownership, rather than a failed Relay identity or payload.

Runtime completion's Operation/Forward JOIN now explicitly locks only Operation rows
with MySQL 8.4 `FOR UPDATE OF o`; intent stays a read under the existing Node lock.
Both Relay suites add a real second-connection Forward lock and require authentic
Agent Report sequences to advance before release. This preserves CAS, persistent ACK,
Operation terminal-state and historical lease semantics. The expanded suites contain
13 namespace checks and 20 switch/fault checks; evidence records the actual tested
commit and dirty status. These regressions do not complete the remaining roadmap.

Local verification passed 20 Relay switch checks
(`.artifacts/relay/run-QfwaTn/evidence.json`), 13 namespace checks
(`.artifacts/relay-isolation/run-wu7g5O/evidence.json`), 7 direct Linux Agent checks
and the 165-test shared check. These artifacts record baseline `132642e` plus
dirty=true; committed validation must use the artifact's own recorded SHA/status.

Clean-commit validation subsequently passed on `a079e96`: 20 Relay switch/fault
checks (`.artifacts/relay/run-yibvsj/evidence.json`) and 13 namespace/lock checks
(`.artifacts/relay-isolation/run-RKrD9a/evidence.json`), both dirty=false. The latter
also verifies actual network teardown.

## Sustained Relay Load And Non-Root Deployment

October 14, 2026 (Asia/Shanghai). Baseline: `a079e96`. Two actual isolated Relay
Agents now run under independent non-root UIDs/GIDs, zero Linux capabilities,
NoNewPrivs and a 256 soft/hard FD limit. Actual process status, secret/state file
ownership, namespace identity and unprivileged kernel time synchronization are
asserted rather than inferred from the launch command.

The eight-check harness verifies sixty seconds of exact payloads on 16 TCP streams
and 8 UDP associations, multiple real renewals without an execution-generation
change, counter/FD reclamation, an immutable cap-12 Profile revision, rejection of
extra TCP/UDP and continued existing traffic. Actual Control outage tests every
client through the real signed-lease safety deadline, with no clock or DB deadline
injection. Agents then restart with protected existing journals and higher sessions;
Control restores its protected authority and exact TCP/UDP forwarding. Safe deletion
and executable/run/namespace-checked cleanup are required before successful evidence
is written. Details: [Relay capacity](relay-capacity.md).

Development evidence `.artifacts/relay-capacity/run-UTf8VP/evidence.json` records
`a079e96` plus dirty=true and verified process/network cleanup. Its bounded sample
verified 1.44 GB of bidirectional payload in sixty seconds (about 24.1 MB/s), with
p95 round-trip latency about 4.1 ms and peaks of 50/58 FD on the two Agents. Both
Nodes published four active snapshots and recovery sessions reached epoch 2.
These are local measurements, not a maximum supported capacity claim. Shared
165-test TS/Go/build/contract checks, Go vet and native Linux Go race also passed.

At exact saturation, readiness probes share the peer budget and health may degrade
while admitted traffic stays live; the completed Operation remains terminal. Local
Control/MySQL are still Windows processes with WSL Linux Agents on one physical
host. Sustained recovery beyond peer-credential overlap, complete direct/Relay
matrix closure, automatic peer rotation/pin transitions, transport evolution,
product Web, external deployment and release gates remain open. CI is configured,
not counted as a remotely verified run. The full project goal remains active.


## Relay 自动换钥与过期在线恢复

2026-10-14（Asia/Shanghai）。基线 `868dac4`。Agent 现在在有效 peer 授权到期前
自动换钥，持久 CSR/request ID 支持签发提交后响应丢失的精确重试。新的 MAC bundle
先原子保存，再加载身份；崩溃遗留请求按已保存 request ID 清理。有界 overlap 的
cooldown 防止持续签发第三个有效身份。机器凭据接近到期时调用既有安全轮换流程。

Control 编译时只使用当前 peer pin，历史退役凭据保留但不再缩短新计划。任一端
peer pin 变化创建更高 deployment generation/fence 和新的持久 policy Operation，
保持用户 revision/session，继续按尾到头 active/ready 屏障执行。旧 TCP 有界排空、
UDP association 重置，旧成功 Operation 仍为终态。过期但 MAC 完整的 peer bundle
不能离线恢复授权；新的在线 Hello、签发和完整快照必须保留原 journal/high-water。
损坏状态拒绝，停机期间已过期的可信签发重放也能安全换成新请求。

`npm run test:relay-rotation` 本地 9 项实网检查通过：非 root/零 capabilities、
两端当前 active/ready、丢响应后的同 CSR 重试、两次自动换钥、真实 overlap 后的
两段 36 秒流量、原 CA 签发旧 peer 对当前 binding 的拒绝、停机到真实有效期耗尽
后的新 session 恢复，以及历史部署/物理资源清理。证据
`.artifacts/relay-rotation/run-vavDNm/evidence.json` 记录 `868dac4` + dirty=true，
同时验证 process/network cleanup；恢复 session 从 1 升到 2，快照从 19 升到 32，
两段新流量错误均为零。更早的 8 项换钥切片证据是
`.artifacts/relay-rotation/run-fSHXUE/evidence.json`，不包含新增真实过期恢复。
完整行为、期限配置和限制见 [Relay rotation](relay-rotation.md)。

公共检查当前通过 166 项 TS 测试、全部 Go 测试/构建、Schema/fixture、边界和
离线 TS→Go 校验；Go vet、原生 Linux race 和 13 项 Transport/凭据回归通过。
提交前实网回归还通过 20 项 Relay 切换/故障
（`.artifacts/relay/run-BYoE1y/evidence.json`）、13 项网络隔离/锁边界
（`.artifacts/relay-isolation/run-XkKszE/evidence.json`）和 8 项持续容量/硬截止
（`.artifacts/relay-capacity/run-Pe8mcH/evidence.json`）；证据均记录当前基线和
实际 dirty 状态，隔离/容量证据同时验证独占资源清理。
CI 新增轮换验收和证据收集，远程结果需按实际运行核验。前一容量切片另有
`868dac4` 干净提交的 8 项证据
`.artifacts/relay-capacity/run-3ocRRm/evidence.json`，dirty=false。

本阶段之后完整项目仍未完工：direct/Relay 全矩阵收口、长周期生产凭据演练、
在线 endpoint/入口迁移、Link 复用与受支持传输演进、Forward-first Web/Node 管理/
审计、全 Linux 外部 MySQL/反代部署、SBOM/许可证和完整发布演练仍需完成。
按用户本轮要求，完成本阶段文档、提交和推送后停止开发；后续阶段保持未完成，
待明确恢复后继续。本地实网是单物理机混合拓扑，不能据此声明生产就绪。
