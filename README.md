# TuneX

多租户网络转发平台，由 Panel、Worker、Web 和 Go Agent 组成。普通用户在 `/forwards` 创建、查看、编辑、暂停、恢复、重试、复制、删除和诊断转发。

V2 使用单一 Forward 业务契约：直连与普通中继使用原生 TCP/UDP；加密中继使用自主设计的 TuneX Secure Transport `tst/1`，基于 Go TLS 1.3 / mTLS。Link 是自动创建和复用的内部连接资源；高级资源维护保留在 `/links`。Agent 内运行数据面，无需额外传输进程。

**当前为 V2 开发候选，TST 默认关闭。** 已执行测试与尚未完成的发布门槛见 [验收记录](docs/testing.md)；本地构建和测试不能代替独立安全审查、Linux 部署或生产发布。

[文档入口](docs/README.md) · [开发方案](docs/DEVELOPMENT_PLAN.md) · [运行边界](docs/forwarding-runtime.md) · [生产部署](docs/production-deploy.md) · [TST 协议](docs/protocol/tst-v1.md)

## 本地 Docker 栈

需要 Docker 与 Docker Compose v2：

```bash
git clone https://github.com/PaiMonCai/TuneX.git
cd TuneX
cp .env.example .env
# 填写数据库口令、独立 AUTH_SECRET 和站点配置。
docker compose up -d --build
docker compose ps -a
curl -fsS http://localhost:8787/healthz
```

Web 默认地址为 `http://localhost:9091`。迁移容器必须退出码 0；首个管理员账号由 seed 创建，随机凭据写入项目根的 `.admin-credentials`。首次登录后修改口令并移除该文件。

开发栈的容器、网络与数据卷使用固定名称；`-p` 不能单独保证第二套部署隔离。长期运行使用 `docker-compose.prod.yaml`、`.env.production.example` 和固定发布镜像。生产反代、备份和升级步骤见部署文档。

## Agent 与实验能力

在 Panel 创建 Node，使用其 enrollment / upgrade 命令安装 Agent。Agent 主动连接 Panel；业务端口和 TST 载体端口由相应节点开放。

TST 测试要求 Panel、Worker、两个 Agent 均设置 `TUNEX_TST_ENABLED=true`，Panel 与 Worker 使用同一个独立 64 位 hex `TUNEX_LINK_SEAL_KEY`。此封存密钥须安全备份。创建还受 Workspace 权限、策略、端口租约和新鲜 Agent 能力约束。TST 失败直接报错，不自动降级为明文。

原生 `both` 另由 `FORWARD_NATIVE_BOTH_ENABLED` 控制。TCP/UDP 是业务协议，客户端 TLS/WS 和节点间加密是独立维度；普通中继不保证节点间加密。首版 TST 不开放多跳、多目标和 PROXY 来源策略。

## 开发检查

```bash
cd backend
bun ci
bunx prisma generate
bun run typecheck
bun run test:unit
cd ../web
npm ci
npm run typecheck
bun test src
npm run build
cd ../agent
go test ./...
go vet ./...
go build ./...
cd ..
node scripts/ci/native-dependency-check.mjs
```

数据库、真实网络和浏览器测试的配置及证据范围见验收文档。升级不会自动转换历史不兼容的加密配置；V2 迁移保留业务记录和封存材料并明确标记其不可运行。备份和替代规则操作见 [迁移说明](docs/v2-migration.md)。历史许可、来源和修改记录见 [合规归档](docs/compliance/README.md)。
