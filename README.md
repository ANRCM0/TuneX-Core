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

B 已完成当前公共接口与配置内环境的限定范围接受：220 项断言和适用执行结果
逐项对齐，完整 baseline 与容器检查通过。源码 `e208a3a` 的准确测试合并修订、
作业结果与范围见[验证记录](docs/development/foundation-verification-2026-10-19.md)。
PR #112 尚未合并；main 仍是此前 A5 集成线，本轮没有发布。

后续模块须消费已接受的冻结接口或单独验证的后继修订，并有自己的公共契约、
测试和集成说明。独立物理多主机、长稳／负载、独立 Responder 交付、正式发行与
生产就绪保留各自门槛。
