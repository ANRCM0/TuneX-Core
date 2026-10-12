# TuneX VNext · Architecture Specification Index

**基线：v1.0 · 决策状态：Accepted for implementation · 2026-10-12**

“定稿”在本仓库意指：作为后续开发的**设计基线**，修改必须通过 ADR、契约同步和测试；**不**表示已编写或已验证实现。

| 文档 | 规范角色 |
| --- | --- |
| [总体架构](architecture/overview.md) | 目标、边界、数据流与组件部署 |
| [Core v1](spec/core-v1.md) | 最小实体、值对象、规则和依赖方向 |
| [Forward v1](spec/forward-v1.md) | 最小转发契约、并发、资源约束和生命周期 |
| [Deployment Protocol v1](protocol/agent-deployment-v1.md) | Snapshot / Assignment / Observation / 租约与版本 |
| [Runtime & Agent v1](spec/runtime-agent-v1.md) | 部署状态机、双节点编排、故障恢复 |
| [模块边界](architecture/module-boundaries.md) | 模块拥有者、同步调用、持久化所有权 |
| [ADR-0001](decisions/0001-vnext-clean-slate.md) | 与历史 V2 脱钩及清理范围 |
| [开发路线](development/roadmap.md) | 从空白 Core 到实网转发的交付门槛 |
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

