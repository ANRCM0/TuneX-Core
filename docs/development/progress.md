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
| Phase 2 生命周期、安全与恢复 | planned | 更新/启停/删除/重试、UDP、持久清理、证书轮换/撤销、Linux 时钟/挂起故障与完整验收 |

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
