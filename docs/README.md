# TuneX VNext · Architecture Specification Index

**基线：v1.1 · 决策状态：Accepted for implementation · 2026-10-12**

当前机器协议为 **ADP/3**；ADP/1–2 保留历史契约与演进记录。基线版本、Core/Forward v1、Control API v1 与 ADP 协议版本分别管理，不混用。规范文档描述目标行为；开发入口与实施进度单独记录当前实现和证据，不代表完整目标已完成。

“定稿”在本仓库意指：作为后续开发的**设计基线**，修改必须通过 ADR、契约同步和测试；**不**表示已编写或已验证实现。

| 文档 | 规范角色 |
| --- | --- |
| [总体架构](architecture/overview.md) | 目标、边界、数据流与组件部署 |
| [Core v1](spec/core-v1.md) | 最小实体、值对象、规则和依赖方向 |
| [Forward v1](spec/forward-v1.md) | 最小转发契约、并发、资源约束和生命周期 |
| [Node observation v1](spec/node-observation-v1.md) | 被动报告观察的授权、预算、期限及来源；不是独立主动健康探测 |
| [Forward probe v1 基础切片](spec/forward-probe-v1.md) | 授权预检、Agent 内部 TCP connect-only；默认关闭的操作链另见管理契约 |
| [Forward probe management v1](spec/forward-probe-management-v1.md) | 幂等签发、受限单次执行、历史回执与撤销；真实组合 Actions 待对应提交 |
| [Native TLS tunnel management v1](spec/native-tunnel-management-v1.md) | 有界只读 Endpoint/凭据窗口/相邻规则，原 Profile/CAS 流程与真实 Relay 浏览器接线；非网络或删除安全证明 |
| [Deployment Protocol v2](protocol/agent-deployment-v2.md) | Snapshot / Assignment / Observation / 租约与版本 |
| [Runtime & Agent v1](spec/runtime-agent-v1.md) | 部署状态机、双节点编排、故障恢复 |
| [模块边界](architecture/module-boundaries.md) | 模块拥有者、同步调用、持久化所有权 |
| [Core 与兼容接入层现状](architecture/core-and-compatibility-status.md) | Core、协议兼容底座、宿主扩展接入的实际边界与缺口盘点；不是新协议 ADR |
| [分类接入契约与原生驱动注册](decisions/0006-classified-extension-contracts.md) | 三类扩展边界；Agent 注册、Console 查询与 Transport 解析端口；授权与 Journal 保持不变 |
| [ADR-0007](decisions/0007-bounded-agent-probe.md) | 主动 Probe 的 Agent 执行位置、独立许可、绑定/egress 与资源预算；远程协议留待后续 |
| [ADR-0008](decisions/0008-probe-contract-negotiation.md) | 独立只读机器协商与内部单次许可门禁；协商不是发包授权 |
| [Probe negotiation v1](protocol/probe-negotiation-v1.md) | mTLS 会话/实例绑定、共享 TS/Go Schema 与拒绝旧版；尚无远程执行许可和派发 |
| [ADR-0009](decisions/0009-probe-instance-ownership.md) | 内部持久 Probe 实例归属、CAS 替换/撤销与恢复隔离；不是远程登记或执行许可 |
| [ADR-0010](decisions/0010-probe-registration-lifecycle.md) | 独立远程登记、默认关闭的 Agent 门禁生命周期；不开放执行 |
| [Probe instance v1](protocol/probe-instance-v1.md) | mTLS 查询/登记/撤销、共享 TS/Go Schema、CAS 与失败/关闭边界；登记不是许可 |
| [ADR-0011](decisions/0011-probe-permit-authority.md) | 内部许可签发/持久单次消费、同库签发预算与恢复隔离；领取回执另见 ADR-0012 |
| [ADR-0012](decisions/0012-probe-claim-contract.md) | 独立 mTLS 单次领取与 Agent 完整绑定校验；回执不可执行、尚无派发与持续撤权 |
| [Probe claim v1](protocol/probe-claim-v1.md) | 已知许可 ID 的消费回执、共享 TS/Go 严格契约与不确定结果边界 |
| [ADR-0013](decisions/0013-probe-delivery-authority.md) | 内部有界任务选择、消费后当前授权检查与持久撤销；不开放远程派发或发包 |
| [ADR-0014](decisions/0014-probe-delivery-contract.md) | 不可执行的有界任务获取与消费后状态协议；仍未接入 Agent 主循环或持续撤权 |
| [Probe delivery v1](protocol/probe-delivery-v1.md) | mTLS poll/status、请求关联、空/单任务、最小绑定回执与时间边界 |
| [ADR-0015](decisions/0015-probe-agent-authority-watch.md) | Agent 内部有界请求与失败关闭观察监视器；不构造执行许可或接入生产循环 |
| [ADR-0016](decisions/0016-probe-result-receipts.md) | 原许可 owner 同事务接收有界上报结果，单份记录/重复回执，不更新健康或接入执行 |
| [Probe result v1](protocol/probe-result-v1.md) | 独立 mTLS 结果契约、TS/Go 内容摘要、去重与接收时间边界 |
| [ADR-0017](decisions/0017-probe-host-execution.md) | 内部单次宿主执行准入、持续检查与保守结果序列化；尚未接入生产调度或回传 |
| [ADR-0018](decisions/0018-probe-production-workflow.md) | 默认关闭的管理入口与 Agent 串行闭环；保留原权威、预算、失权关闭与不确定结果不重试 |
| [ADR-0001](decisions/0001-vnext-clean-slate.md) | 与历史 V2 脱钩及清理范围 |
| [ADR-0002](decisions/0002-runtime-contract-closure.md) | 租约、会话、切换与实施依赖收口 |
| [Control API / Operation v1](spec/control-api-v1.md) | 幂等、事务、连续修改、终态及状态查询 |
| [节点安全与恢复](operations/node-security-and-recovery-v1.md) | 注册、撤销、重装、备份恢复及 Relay 安全门槛 |
| [只读升级与恢复评估](operations/upgrade-assessment.md) | Schema/Journal 兼容矩阵、只读状态采集、备份责任与明确回退拒绝 |
| [ADP/2 direct Schema](protocol/schemas/adp-v2-direct.schema.json) / [fixture](protocol/fixtures/adp-v2-direct.json) | Phase 2 机器可校验契约；不宣称 Relay 支持 |
| [开发路线](development/roadmap.md) | 从空白 Core 到实网转发的交付门槛 |
| [Docker / 1Panel 部署手册](../deploy/README.md) | 分主机 Control/Agent、首次初始化与 Enrollment、真实 TCP/UDP、Relay 与恢复测试 |
| [下一阶段开发目标](development/next-milestones.md) | 多跳代码交付后的部署/升级、诊断审计、证据流程、Console、集中验收与发布排期 |
| [ForwardX 经验吸收计划](development/forwardx-gap-closure.md) | 功能差距、独立实现顺序、产品 UI/运维与验收 |
| [转发平台四主线适配方案](development/forwarding-platform-plan.md) | 基础转发、加密隧道、拓扑切换、监控探测的模块设计、迁移边界与 Actions 交付顺序 |
| [Forward-first Web Alpha](development/forward-first-web.md) | 节点、Direct、Operation 的可视化界面及安全边界 |
| [Relay Web 与节点诊断](development/relay-console.md) | 双节点 Relay 引导、只读诊断和安全安装手册 |
| [Multi-hop implementation and acceptance](development/multihop-execution.md) | Default-off execution, unified acceptance commands, physical inventory and release evidence |
| [Six-batch delivery ledger](development/multihop-delivery.md) | Implementation status and deferred validation; no runtime completion claim |
| [ADR-0005](decisions/0005-mixed-multihop-execution.md) | One physical ownership journal and explicitly versioned complete mixed execution |
| [开发入口](development/getting-started.md) | 工具版本、构建/测试、离线编译和开发 MySQL |
| [Phase 1](development/phase1.md) | 真实 MySQL/HTTPS/Go TCP 创建切片、启动及验收范围 |
| [实施进度](development/progress.md) | 当前工作树证据与后续实施范围；不是目标规范 |
| [验收规范](testing/acceptance-v1.md) | 安全、可靠性、实网测试矩阵 |

## 规范约定

- **MUST / 必须**：无条件约束；不满足即不兼容本规范。
- **MUST NOT / 不得**：禁止行为。
- **SHOULD / 应当**：默认规则，例外需显式记录理由。
- **MAY / 可以**：可选能力，但不能悄悄改变基础语义。
- `Forward` 表达用户意图；`Deployment`、`Assignment` 是 Runtime 内部对象。
- `Desired`、`Applied`、`Healthy` 是不同维度，不得合为一个布尔值。

## 规范优先级及变更

在 VNext 实现范围内：已接受的 ADR > 版本化协议及领域规范 > 总体架构与开发路线 > 示例。冲突须修正规范，不能让实现细节暗中改变契约。破坏性修改协议需新版本并记录升级/拒绝策略；VNext **不承诺兼容旧 V2**。

历史源码与许可证档案在 `legal/` 中保留；它们不是新的业务文档。



Current direct TCP/UDP lifecycle development and evidence: [Phase 2](development/phase2.md).

Credential rotation, revocation and target-policy withdrawal: [Node security](development/node-security.md).

Suspend-aware tickets, data-plane expiry checks and fault evidence:
[Authorization faults](development/authorization-faults.md).

OS synchronization providers, protected proof and native Linux Agent acceptance:
[System time](development/system-time.md).

Owner-managed members, explicit Node grants and persistent execution authority:
[Access management](development/access-management.md).

Independent authority, old-backup recovery, operator commands and bounded Linux capacity evidence:
[Recovery and capacity](development/recovery-and-capacity.md).

Relay contract preparation, immutable Transport Profiles and explicit capability gate:
[Phase 3 preparation](development/relay-preparation.md).

Complete direct/Relay runtime contract preparation and protected physical high-water:
[ADP/3](protocol/agent-deployment-v3.md).

Current online machine protocol and explicit old-state refusal:
[ADP/3 cutover](development/adp3-cutover.md).

Explicit Relay Agent capability, protected peer identity and prepared assignment compiler:
[Relay Agent](development/relay-agent.md).

Durable two-Node Relay acceptance, readiness coordination and real multiprocess flow:
[Relay Control](development/relay-control.md).

Held TCP target/path switches, same-client UDP reset and partial activation/deadline/retry:
[Relay switch and faults](development/relay-switch-faults.md).

Independent Linux network namespaces, actual Relay partitions and activation/path compensation:
[Relay network isolation](development/relay-network-isolation.md).
