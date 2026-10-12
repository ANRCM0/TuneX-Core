# V2 部署、升级与实验启用

V2 为开发候选，当前没有正式发布镜像或生产验证。以下流程用于构建/验证当前源码或未来通过门槛的固定版本。不要把旧镜像与新 Schema/Agent 混搭。

## Compose 与反代

生产使用 `docker-compose.prod.yaml` 与 `.env.production.example`。Panel、Worker、Web、migrate 使用同一个固定 TUNEX_IMAGE；Agent 使用独立镜像，构建只包含 Go Agent。

```bash
cp .env.production.example .env
chmod 600 .env
# 填写独立数据库口令、AUTH_SECRET、SITE_URL、镜像 SHA/digest 和邮件配置。
docker compose -f docker-compose.prod.yaml --env-file .env up -d
docker compose -f docker-compose.prod.yaml --env-file .env ps -a
curl -fsS http://127.0.0.1:13001/healthz
curl -fsS http://127.0.0.1:13001/readyz
```

migrate 必须退出码 0；Worker 须正常登记并处理作业。首次 seed 生成的管理员凭据写到 `.admin-credentials`，首次登录后修改并移除。

| loopback 入口 | 代理路径 |
| --- | --- |
| 13001 API | /api/*、/healthz、/readyz |
| 13002 控制 WebSocket | /socket.io/*，保留 Upgrade |
| 13003 Web | 其他页面 |
| 13000 可选 Caddy | caddy profile 聚合上述入口 |

宿主 Nginx/1Panel/宝塔负责同源 HTTPS。没有宿主反代时使用 standalone overlay（Compose >=2.24.4）、真实 SITE_URL/ACME_EMAIL 和 80/443：

```bash
docker compose -f docker-compose.prod.yaml -f docker-compose.standalone.yaml --env-file .env up -d
```

容器、网络、数据卷有固定名称；多套部署先处理命名与归属，`-p` 不能完全隔离。MySQL/Redis 不开放公网，开发栈不能用于管理生产卷。

## 安装器与 Agent

```bash
bash scripts/ops/install.sh --dry-run install --version <released-40-char-sha>
sudo bash scripts/ops/install.sh install --version <released-40-char-sha>
```

升级使用 `upgrade --version`，会调用既有备份和回退步骤。`--agent-version <semver>` 单独声明 Agent 上报版本基线；镜像 SHA 不能代替版本。Agent Dockerfile 的 AGENT_VERSION 构建参数会 stamp 实际上报值，省略为 unknown。

Agent 在 Panel 创建 Node 后通过 enrollment/upgrade 安装，主动发起控制连接；正常不开放管理端口。只需 tunex-agent，不安装额外数据面可执行文件。节点私有 state 单独持久化。

## TST 实验启用

正式启用前完成 [测试门槛](testing.md)，包括独立安全审查和 Linux 部署。受控隔离测试按以下顺序：

1. 备份数据库、环境配置与每个节点的私有状态，执行完整迁移；核对历史不兼容记录的隔离结果。
2. Panel/Worker 使用同一个独立随机 32 字节、64 位 hex TUNEX_LINK_SEAL_KEY。它不是 AUTH_SECRET；安全备份且不在运行中替换。
3. Panel、Worker 与两端 Agent 明确设置 TUNEX_TST_ENABLED=true，确认 fresh forward.link.tst.v1 与 apply_link/remove_link 能力。
4. 在 /forwards 由具有 forward:create 与 node:use 的成员一次提交加密中继，验证 TCP/UDP/both、共享 A/B、CAS、失败重试、恢复、目标诊断与用量。
5. 删除最后引用，核对入口停止、延迟回收和双端载体停止后端口释放；保留脱敏结果。

原生 both 的 FORWARD_NATIVE_BOTH_ENABLED 独立开启；首版仅 plain DIRECT/自有单跳 RELAY。TST 无明文 fallback，不能用普通中继代替失败的加密规则。

关闭创建开关不能当作所有授权监听瞬时停止的证明；通过正常移除、租约/证书到期和新鲜 Agent 报告核对。在线端点切换和有引用密钥轮换不保证无损；维护预览/持久计划不执行在线迁移。

## V2.3 高级路由实验配置

当前默认关闭，真机部署按用户安排延后。下面是未来隔离验收所需配置，已完成的 Linux CI
不代替正式部署。Panel/Worker 共用 `.env` 中的六个开关及安装密钥，先做全量迁移并备份密钥：

| 开关 | 作用 |
| --- | --- |
| `TUNEX_ROUTING_ENABLED` | Workspace 拓扑与只读预览 |
| `TUNEX_ROUTING_PROBES_ENABLED` | 授权目标/ICMP 探测 |
| `TUNEX_ROUTING_POLICIES_ENABLED` | 版本化策略保存与解释 |
| `TUNEX_ROUTING_EXECUTION_ENABLED` | 显式启用策略的后台执行 |
| `TUNEX_ROUTING_MULTIHOP_ENABLED` | 三节点路径执行 |
| `TUNEX_ROUTING_HOP_AUTH_ENABLED` | 逐跳身份签发，自动执行的必要条件 |

各项仅精确值 `true` 启用。`TUNEX_LINK_SEAL_KEY` 为独立 64 位 hex 安装密钥；Native
逐跳身份同样需要它，不只用于 TST。所有路径节点须新鲜广告 `forward.routing.hop.mtls.v1`，
入口/出口固定、相邻边已授权；当前只执行同 Workspace Native TCP RELAY 的两或三个不同节点。
成员从转发详情“高级路由”预览再保存候选/阈值，策略的 enabled 与自动切换/回切也需显式开启。
核对历史中的 confirmed、desired/applied exact revision 与实际 payload；pending 不视作已经切换。

关闭执行/多跳开关与停用策略可停止后续自动选路，已有受保护规则仍须按正常生命周期操作。
启用后的 security floor 持久保留；不能删除密钥、清零该字段或回退到不支持身份的 Agent。
备份/恢复须包含 `routing_runtime` 的封存身份和对应安装密钥，并保持数据库与节点私有状态配套。
路径或身份重建会中断旧 TCP，客户端需重连；当前不自动迁移 UDP/TST 路径，也不做并行路径逐连接分流。
完整支持范围与受保护补偿规则见 [V2.3 路由开发](v2.3-routing.md)。

V2.4 的 `TUNEX_OBSERVABILITY_ENABLED` 同样默认关闭。显式开启仅提供认证与 Workspace
权限保护的只读统一指标，不开启探测、告警或修复；详见 [指标口径与限制](v2.4-observability.md)。

## 备份与回退

```bash
export COMPOSE_FILE="$PWD/docker-compose.prod.yaml"
export COMPOSE_PROJECT_NAME=tunex
export COMPOSE_ENV_FILE="$PWD/.env"
export TUNEX_ENV_FILE="$PWD/.env"
bash scripts/ops/backup.sh
bash scripts/ops/rollback.sh --list
bash scripts/ops/rollback.sh --verify previous
```

备份口令由受保护配置或交互提供，不放命令行。保留校验和、manifest 和异地副本并在隔离环境实测恢复。restore 会覆盖指定数据库，须核对对象和恢复点。

Panel 备份不自动备份各 Agent 的 machine.key、加密配置/墓碑、generation fences 和未确认用量。保留每节点对应身份，不能复制另一节点 state 或删除围栏来绕过失败。旧载体不与 TST 互通；回退必须受控停止新路径并恢复对应数据库/配置和节点状态，见 [V2 迁移](v2-migration.md)。
