# VNext 开发入口

当前源码包含 Core、ADP/3 在线 Direct TCP/UDP、TLS 1.3 Relay、默认关闭的多跳
及其产品模块；准确进度与证据见 [progress.md](progress.md)。
机器协议及受保护状态见 [ADP/3](../protocol/agent-deployment-v3.md)。ADP/2 样例
保留为历史契约校验，在线入口不兼容。
旧源码、安装脚本与工作流已移出当前树，历史版本通过 Git 检索。
HTTP API 与在线 Agent 的启动和验收见 [Phase 1](phase1.md)。

## 工具与安装

锁定开发工具：Node 24.14.1、npm 11.11.0、TypeScript 5.9.3、Go 1.26.3。
依赖分别由根 `package-lock.json` 和 `agent/go.sum` 锁定。
生产及网络验收平台仍为 Linux。本地仅运行获授权的静态检查；功能、MySQL、
网络、容器与浏览器测试在 GitHub Actions 执行，并记录准确源码修订。

```sh
npm ci --ignore-scripts
npm run typecheck
node scripts/check-web.mjs
node scripts/check-boundaries.mjs
npm run contracts:check
node scripts/run-go.mjs build ./...
node scripts/run-go.mjs vet ./...
```

Windows PowerShell 如果限制执行 `.ps1`，使用 `npm.cmd`；不必降低系统执行策略。
Windows 的 Go 静态检查在当前进程设置 `$env:GOARCH='amd64'`。
Go 缓存由执行脚本放在忽略的 `agent/.cache/`，npm 可使用 `--cache .cache/npm`。

协议 Schema 变更后同步生成 Go 类型和内嵌 Schema，并更新共享负面样例：

```sh
npm run contracts:generate
node scripts/build-conformance-fixtures.mjs
npm run contracts:check
```

CI 检查生成内容、Core 依赖边界、文档链接，以及 Linux 上的 Go vet/race。
`npm run check` 包含功能测试，交由 Actions 执行。本地静态通过、Actions 通过、
逐项接受、合并与发布是不同状态；当前证据见 [progress.md](progress.md)。

## 离线编译与跨语言校验

```sh
npm run plan -- docs/development/examples/direct-plan.json
```

上述命令用于 Actions 中的离线开发示例：把一个已授权／已预留的示例 Forward
编译为完整 ADP/2 Snapshot。本地源码阶段不执行该功能路径。
示例时间固定，不是有效的当前执行授权；实际 Runtime 必须在数据库事务中
提供全节点集合、会话、代次、租约及资源事实。该命令不会持久化或部署。

Go 校验可用（POSIX shell）：

```sh
npm run plan --silent -- docs/development/examples/direct-plan.json > snapshot.json
cd agent
go run ./cmd/adp-validate Snapshot < ../snapshot.json
```

## MySQL 与实网验收入口

当前实施切片使用全新的 MySQL 8.4.9 数据库，不重用或迁移旧 V2 表。
数据库 fixture 配置见 [compose.dev.yaml](../../deploy/compose.dev.yaml)。
Actions 的独立数据库环境使用以下模板，凭据从 CI 环境提供：

```sh
docker compose -f deploy/compose.dev.yaml up -d --wait
```

该 Compose 只提供开发 MySQL，绑定本机回环地址；不部署 Control/Agent。
Phase 1 已建立真实 MySQL 事务/Operation 与 mTLS Agent 的网络测试。
Phase 2 的 Linux namespace/容器测试须使用独立 client、Agent、target，
实际断言 TCP payload、UDP 回包和资源回收。已有混合平台原生 Linux Agent
证据见 [System time](system-time.md)，恢复/容量入口见 [Recovery and capacity](recovery-and-capacity.md)；
完整 Linux 栈与全部矩阵出口仍待验证。

## Direct UDP 手工验收

复用已验证的单节点 TCP 测试实例、同一个数值端口但不同物理 UDP 协议，参见
[Direct UDP 实机验收](direct-udp-live-smoke.md)。
脚本支持两个独立 UDP 客户端的精确字节和空数据报验证；工具自检 `npm run test:udp-smoke`
不经过 Agent，不可替代实际部署链路验收。


实施状态见 [progress.md](progress.md)，验收要求见 [acceptance-v1.md](../testing/acceptance-v1.md)。
