# TuneX VNext

> **VNext 破坏性重构进行中。** 当前新工作区已实现纯 Core、ADP/2 direct 契约解析和离线部署编译。HTTP API、持久 Runtime 和在线 Agent 尚未实现，不能作为生产转发系统部署。历史 V2 已归档到 `legacy/v2/`。

**Forward First · Tiny Core · Modular Runtime · Independent Go Agent**

TuneX 是以网络转发为第一核心业务的系统：`Core` 定义转发和节点的基本语义；`Control` 的业务模块和 Runtime 协调持久状态与部署；`Go Agent` 独立处理 TCP/UDP 实际流量。用户流量不经过中心控制面。

VNext 允许与旧 API、数据库和 Agent 协议不兼容。现有源码是实现参考，不是规范来源；旧设计不自动延续。所有新能力优先通过组合、模块和受控驱动扩展，而非增加 Core 基类。

## 权威设计文档

从 [VNext 文档索引](docs/README.md) 开始：

- [总体架构](docs/architecture/overview.md)
- [Core Specification v1](docs/spec/core-v1.md)
- [Forward Specification v1](docs/spec/forward-v1.md)
- [Agent Deployment Protocol v2](docs/protocol/agent-deployment-v2.md)
- [Agent / Runtime 运行模型](docs/spec/runtime-agent-v1.md)
- [模块所有权与依赖](docs/architecture/module-boundaries.md)
- [Control API / Operation](docs/spec/control-api-v1.md)
- [节点安全与恢复](docs/operations/node-security-and-recovery-v1.md)
- [ADR-0002：运行契约收口](docs/decisions/0002-runtime-contract-closure.md)
- [实施路线](docs/development/roadmap.md)
- [验收规范](docs/testing/acceptance-v1.md)
- [ADR-0001：破坏性重构](docs/decisions/0001-vnext-clean-slate.md)

## 关于现有实现

新实现位于 `packages/core/`、`packages/contracts/`、`apps/control/` 与独立 Go 模块 `agent/`。旧 `backend/`、`web/`、`agent/`、部署脚本与工作流已移到 [legacy/v2](legacy/README.md)，作为只读参考，不兼容旧 API、数据库或 Agent。

开发命令、锁定版本和本地 MySQL 入口见 [开发指南](docs/development/getting-started.md)；实际完成项与待验证范围见 [实施进度](docs/development/progress.md)。当前先提供离线 CLI，未创建占位 Web。许可证材料见 [legal/NOTICE.md](legal/NOTICE.md)。

> **禁止在缺少端到端网络验收、安全验证及部署审查时对外宣称 VNext 已生产就绪。**


