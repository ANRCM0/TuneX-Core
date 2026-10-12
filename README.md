# TuneX VNext

> **Architecture baseline / 目标规范，尚未实现。** 本仓库现有程序仍属于历史 V2 实现；以下 VNext 规范不代表当前 API、Agent 或数据库已经符合它。不要将现有部署脚本当作 VNext 的生产安装方式。

**Forward First · Tiny Core · Modular Runtime · Independent Go Agent**

TuneX 是以网络转发为第一核心业务的系统：`Core` 定义转发和节点的基本语义；`Control` 的业务模块和 Runtime 协调持久状态与部署；`Go Agent` 独立处理 TCP/UDP 实际流量。用户流量不经过中心控制面。

VNext 允许与旧 API、数据库和 Agent 协议不兼容。现有源码是实现参考，不是规范来源；旧设计不自动延续。所有新能力优先通过组合、模块和受控驱动扩展，而非增加 Core 基类。

## 权威设计文档

从 [VNext 文档索引](docs/README.md) 开始：

- [总体架构](docs/architecture/overview.md)
- [Core Specification v1](docs/spec/core-v1.md)
- [Forward Specification v1](docs/spec/forward-v1.md)
- [Agent Deployment Protocol v1](docs/protocol/agent-deployment-v1.md)
- [Agent / Runtime 运行模型](docs/spec/runtime-agent-v1.md)
- [模块所有权与依赖](docs/architecture/module-boundaries.md)
- [实施路线](docs/development/roadmap.md)
- [验收规范](docs/testing/acceptance-v1.md)
- [ADR-0001：破坏性重构](docs/decisions/0001-vnext-clean-slate.md)

## 关于现有实现

`backend/`、`web/`、`agent/` 和原 Docker 文件暂不因此次**文档重建**而修改；它们不能证明 VNext 已实施。开发新实现时，以规范与验收测试为准。旧文档已从当前工作树清退（历史仍可在 Git 提交记录查阅）；依法需要保存的来源与许可证材料见 [legal/NOTICE.md](legal/NOTICE.md)。

> **禁止在缺少端到端网络验收、安全验证及部署审查时对外宣称 VNext 已生产就绪。**

