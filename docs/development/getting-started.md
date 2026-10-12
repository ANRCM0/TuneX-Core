# VNext 开发入口

当前新工作区已实现 Core、ADP/2 direct 契约、离线 Planner 和最小在线 TCP 创建切片。
旧源码、安装脚本及工作流已隔离到 `legacy/v2/`，不参与当前构建。
HTTP API 与在线 Agent 的启动和验收见 [Phase 1](phase1.md)。

## 工具与安装

锁定开发工具：Node 24.14.1、npm 11.11.0、TypeScript 5.9.3、Go 1.26.3。
依赖分别由根 `package-lock.json` 和 `agent/go.sum` 锁定。
生产及网络验收平台仍为 Linux；Windows 可执行当前纯代码/协议测试。

```sh
npm ci --ignore-scripts
npm run check
node scripts/run-go.mjs vet ./...
```

Windows PowerShell 如果限制执行 `.ps1`，使用 `npm.cmd`；不必降低系统执行策略。
Go 缓存由执行脚本放在忽略的 `agent/.cache/`，npm 可使用 `--cache .cache/npm`。

协议 Schema 变更后同步生成 Go 类型和内嵌 Schema，并更新共享负面样例：

```sh
npm run contracts:generate
node scripts/build-conformance-fixtures.mjs
npm run check
```

CI 检查生成内容、Core 依赖边界、文档链接，以及 Linux 上的 Go vet/race。
本地测试通过与远程 CI 已运行是两个独立证据。

## 离线编译与跨语言校验

```sh
npm run plan -- docs/development/examples/direct-plan.json
```

命令把一个已授权/已预留的示例 Forward 编译为完整 ADP/2 Snapshot。
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
本地数据库配置见 [compose.dev.yaml](../../deploy/compose.dev.yaml)。
设置 `TUNEX_MYSQL_ROOT_PASSWORD` 后启动：

```sh
docker compose -f deploy/compose.dev.yaml up -d --wait
```

该 Compose 只提供开发 MySQL，绑定本机回环地址；不部署 Control/Agent。
Phase 1 已建立真实 MySQL 事务/Operation 与 mTLS Agent 的网络测试。
Phase 2 的 Linux namespace/容器测试须使用独立 client、Agent、target，
实际断言 TCP payload、UDP 回包和资源回收；当前没有此验收的通过证据。

实施状态见 [progress.md](progress.md)，验收要求见 [acceptance-v1.md](../testing/acceptance-v1.md)。
