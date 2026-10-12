# TuneX VNext · Architecture Specification Index

**基线：v1.1 · 决策状态：Accepted for implementation · 2026-10-12**

当前机器协议为 **ADP/2**；ADP/1 仅保留历史记录。基线版本、Core/Forward v1、Control API v1 与 ADP 协议版本分别管理，不混用。规范文档描述目标行为；开发入口与实施进度单独记录当前实现和证据，不代表完整目标已完成。

“定稿”在本仓库意指：作为后续开发的**设计基线**，修改必须通过 ADR、契约同步和测试；**不**表示已编写或已验证实现。

| 文档 | 规范角色 |
| --- | --- |
| [总体架构](architecture/overview.md) | 目标、边界、数据流与组件部署 |
| [Core v1](spec/core-v1.md) | 最小实体、值对象、规则和依赖方向 |
| [Forward v1](spec/forward-v1.md) | 最小转发契约、并发、资源约束和生命周期 |
| [Deployment Protocol v2](protocol/agent-deployment-v2.md) | Snapshot / Assignment / Observation / 租约与版本 |
| [Runtime & Agent v1](spec/runtime-agent-v1.md) | 部署状态机、双节点编排、故障恢复 |
| [模块边界](architecture/module-boundaries.md) | 模块拥有者、同步调用、持久化所有权 |
| [ADR-0001](decisions/0001-vnext-clean-slate.md) | 与历史 V2 脱钩及清理范围 |
| [ADR-0002](decisions/0002-runtime-contract-closure.md) | 租约、会话、切换与实施依赖收口 |
| [Control API / Operation v1](spec/control-api-v1.md) | 幂等、事务、连续修改、终态及状态查询 |
| [节点安全与恢复](operations/node-security-and-recovery-v1.md) | 注册、撤销、重装、备份恢复及 Relay 安全门槛 |
| [ADP/2 direct Schema](protocol/schemas/adp-v2-direct.schema.json) / [fixture](protocol/fixtures/adp-v2-direct.json) | Phase 2 机器可校验契约；不宣称 Relay 支持 |
| [开发路线](development/roadmap.md) | 从空白 Core 到实网转发的交付门槛 |
| [开发入口](development/getting-started.md) | 工具版本、构建/测试、离线编译和开发 MySQL |
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


