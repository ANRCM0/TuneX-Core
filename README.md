# TuneX Core

TuneX 是基于 TypeScript Control、MySQL 和独立 Go Agent 的 TCP/UDP 转发项目。
当前在线协议为 ADP/3，包含 Direct、TLS 1.3 Relay 和默认关闭的多跳执行。

## 开发入口

- [开发环境与验证规则](docs/development/getting-started.md)
- [当前实现与验收状态](docs/development/progress.md)
- [后续开发顺序](docs/development/development-plan.md)
- [开发文档索引](docs/README.md)
- [源码工作协议](AGENTS.md)

仓库保留当前开发所需的架构、公共接口、协议、变更决策、验收计划与示例。
旧 V2 源码、第三方参考副本、阶段性盘点、部署和操作手册已退出当前工作树；
历史版本可通过 Git 历史检索。

## 源码布局

| 路径 | 职责 |
| --- | --- |
| packages/core | L0 纯领域模型与决策 |
| packages/contracts | 公共值类型、版本化协议与原生格式适配 |
| apps/control | L1 Runtime/端口、L2 存储与协议适配、L3 产品模块 |
| apps/web | Web 模块与浏览器适配 |
| agent | Go Agent、执行宿主与平台适配 |
| examples/foundation-extension | 仅消费公共接口的最小开发示例 |
| scripts、deploy、.github | 开发、验收、打包与 CI 资产 |

## 验证状态

完整 A5 候选已通过 PR #111 的配置内 CI，并合并为 `373c291`。
准确源码、测试合并修订与运行见[验证记录](docs/development/foundation-verification-2026-10-19.md)。
清理后的修订需要自己的检查结果。

地基 readiness 逐项接受、独立物理多主机、长稳／负载、独立 Responder 发布及正式发行
仍有各自门槛；上层模块并行开发门禁保持关闭。
