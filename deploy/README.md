# TuneX VNext · Docker / 1Panel 部署与测试

> 本文是 **Dev 测试环境**操作手册，不是 Stable 生产就绪认证。VNext 使用 ADP/3，禁止复用 `legacy/v2` 数据库、证书或 Agent Journal。仓库根目录 [README](../README.md) 只保留快速部署命令。

升级、关闭多跳或计划恢复前，先执行 [只读升级与恢复评估](../docs/operations/upgrade-assessment.md)。
评估不会自动迁移或批准恢复；已迁移 Journal 不允许回退旧 Agent。

## 1. 部署模型与前置条件

- **Control 主机**：Linux、Docker/Compose v2、外部 MySQL **8.4**、Control HTTPS/PKI、受保护 Authority State；Control 镜像运行 UID/GID `10001:10001`。
- **Agent 主机**：Linux、内核时钟同步、已注册的 Node ID、原始 Control CA、独立的 State 与 Journal MAC Key，容器运行 UID/GID `10001:10001`。两个 Agent 测 Relay 时，优先分配独立主机。
- 验证使用固定的镜像 **registry Digest**（`ghcr.io/anrcm0/tunex-control@sha256:...`、`ghcr.io/anrcm0/tunex-agent@sha256:...`），避免测试期间移动的 `:dev` 标签改变环境。GHCR 私有镜像要先用具备读取权限的令牌登录。
- 每台主机检出本仓库同版本的 `deploy/` 配置。**Control 只用 `deploy/compose.control.example.yaml`，Agent 只用 `deploy/compose.agent.example.yaml`**；历史双服务 `compose.runtime.example.yaml` 仅供参考，不能把其中未用服务的环境变量缺失当成实际 Agent 故障。
- 不要在 Control 主机同时运行另一个指向相同数据库/Authority 的 Control，也不要在 Agent 主机同时让两个进程占用相同的 State/Journal、Node 身份或 TCP/UDP 监听端口。

### 目录与权限

Control 主机：

```text
/srv/tunex/control/state/       # 持久 Authority / 信任绑定
/srv/tunex/control/pki/         # ca.pem / ca.key / server.pem / server.key
/secure/tunex-control.env       # 只在主机保管，严禁提交 Git
```

Agent 主机：

```text
/srv/tunex/agent/state/         # Node 身份、凭据、journal.json、high-water
/srv/tunex/agent/secrets/       # control-ca.pem / journal.key
/secure/tunex-agent.env         # 只在主机保管
```

创建现有目录并赋予容器 UID `10001` 必需权限；私钥和 Journal Key 应受限为仅相应服务账户可读。**Agent `secrets/` 不得位于 `state/` 内部**，且后续常驻容器只读挂载 secrets。不要把 Node Enrollment Token 存入 Compose、Docker 镜像、Git 或命令历史。

CA 应为测试环境专用 ECDSA CA；Control 服务器证书由该 CA 信任，必须覆盖 Agent 访问的真实域名/IP SAN。**CA 与 Authority State 绑定**，已初始化实例不得更换 CA 后尝试清空/重新初始化原状态以消除错误。

## 2. 镜像与环境文件

在 [自动发布 Workflow](../.github/workflows/images.yml) 的**成功**运行 Summary 中复制两张完整 `@sha256:` Digest。每台主机只填自己角色的变量，例子中值均为占位符：

Control 的 `/secure/tunex-control.env`：

```dotenv
TUNEX_CONTROL_IMAGE=ghcr.io/anrcm0/tunex-control@sha256:REPLACE_WITH_64_HEX_DIGEST
TUNEX_DATABASE_URL=mysql://dedicated-user:REPLACE_PASSWORD@db-private.example:3306/tunex_vnext_test
TUNEX_CONTROL_STATE_DIR=/srv/tunex/control/state
TUNEX_CONTROL_PKI_DIR=/srv/tunex/control/pki
```

Agent 的 `/secure/tunex-agent.env`：

```dotenv
TUNEX_AGENT_IMAGE=ghcr.io/anrcm0/tunex-agent@sha256:REPLACE_WITH_64_HEX_DIGEST
TUNEX_CONTROL_URL=https://control-dev.example:41001
TUNEX_NODE_ID=REPLACE_WITH_ENROLLED_NODE_ID
TUNEX_AGENT_STATE_DIR=/srv/tunex/agent/state
TUNEX_AGENT_SECRETS_DIR=/srv/tunex/agent/secrets
```

`docker compose --env-file` 用于**Compose 变量插值**。Shell 中临时导出的变量不会自动传入容器，除非在 Compose 的 `environment:` 明确声明，或在 `docker compose run -e NAME` 中显式透传。仓库的角色独立模板已经声明常驻服务所需变量。不要对任何生产日志打印数据库 URL、Owner Token 或私钥。

### 分角色只读预检

在对应 Linux 主机使用仓库指定的 Node 版本，检查该角色环境文件。Control
还需提供 Agent 实际访问的 HTTPS origin，以核对服务器证书 SAN；也可将
`TUNEX_CONTROL_URL` 写入 Control 的环境文件，仅供预检使用。

```bash
# 已有 Control；实际地址必须对应证书 SAN
node --env-file=/secure/tunex-control.env deploy/preflight.mjs \
  --role control --control-url https://control-dev.example:41001 --json

# 已注册 Agent；只需要 Agent 的变量和本机文件
node --env-file=/secure/tunex-agent.env deploy/preflight.mjs --role agent --json
```

首次部署或注册前增加 `--phase initial`：要求现有 State 目录为空，Agent Secrets
仅含可信 `control-ca.pem`。它不会创建目录、修改权限、初始化 Authority 或执行
Enrollment；数据库是否全新仍由正式初始化流程确认。已有实例默认使用
`--phase existing`，Control 必须存在 Authority 状态和 Key，Agent 必须存在
证书、私钥、Journal 和 Key。不能改用 initial 掩盖缺失的旧状态。

预检检查角色所需的镜像 Digest、目录边界、UID/GID `10001:10001` 的 POSIX
权限、证书有效期/签发关系/用途、私钥匹配，以及 Control 的精确 DNS/IP SAN。
当前按模板的直接 CA 签发模型检查，不做中间 CA 链构建，DNS SAN 不接受通配符；
需要其他 PKI 模型时先明确部署支持范围。受保护文件要求服务 UID 所有、
仅所有者可读，目录和证书不得允许 group/world 写入。

输出 `scope: local-static` 和 `runtimeReady: false`。退出码 `0` 仅表示所实现的
本地静态检查通过，`1` 表示拒绝，`2` 表示必要检查未完成（如在 Windows 上
无法证明 Linux 权限）。报告明确保留未检查项：实际挂载/ACL/UID 映射、
OS 时钟同步、网络/mTLS/MySQL 连通性、状态 MAC 和高水位完整性。
Agent 主机本地预检不会拨号读取远端服务器证书。真实服务启动仍必须执行全部
身份、Journal 和授权校验；静态结果不能作为运行验收或生产批准。

测试在 GitHub Actions 的 `deployment-tools` 和容器工作流运行，覆盖正反例和
CLI 调用；本地开发只做语法等静态检查。原 `validate(env, inspect)` 导出保留为
布局检查兼容接口，不能将其旧结果视为完整的分角色预检。

## 3. Control 首次初始化与正常启动

**仅对真正全新的独立数据库、原始 CA 和空 Authority State 做一次初始化**。如果已经通过初始化和重启，请跳到“正常启动”。

```bash
# 在仓库根目录，确认使用的数据库、证书及 state 目录确实为新的测试环境
docker compose --env-file /secure/tunex-control.env \
  -f deploy/compose.control.example.yaml config --quiet
docker compose --env-file /secure/tunex-control.env \
  -f deploy/compose.control.example.yaml pull control

# 一次性运行服务，明确覆盖固定的 0；此运行不会通过 Compose 暴露服务端口
docker compose --env-file /secure/tunex-control.env \
  -f deploy/compose.control.example.yaml run --rm --no-deps \
  -e TUNEX_AUTHORITY_INITIALIZE=1 control
# 看到 "Control listening" 且确认无错误后，Ctrl+C 正常结束一次性实例
```

然后创建 Owner/Scope。Owner Token 应在可信终端交互输入，并且保留在安全密码管理器中，**不能丢失或明文提交**：

```bash
read -rsp 'New owner token: ' TUNEX_OWNER_TOKEN; echo
export TUNEX_OWNER_TOKEN
docker compose --env-file /secure/tunex-control.env \
  -f deploy/compose.control.example.yaml run --rm --no-deps \
  -e TUNEX_OWNER_TOKEN control node apps/control/src/bootstrap.ts scope-dev owner-dev
unset TUNEX_OWNER_TOKEN
```

正常启动（常驻模板固定 `TUNEX_AUTHORITY_INITIALIZE=0`）：

```bash
docker compose --env-file /secure/tunex-control.env \
  -f deploy/compose.control.example.yaml up -d control
docker compose --env-file /secure/tunex-control.env \
  -f deploy/compose.control.example.yaml ps
docker compose --env-file /secure/tunex-control.env \
  -f deploy/compose.control.example.yaml logs --tail=80 control
```

在同主机通过受信任 CA 验证 HTTPS。以下使用域名 SAN，并强制该域名在此命令解析为回环：

```bash
curl --fail --show-error --cacert /srv/tunex/control/pki/ca.pem \
  --resolve control-dev.example:41001:127.0.0.1 \
  https://control-dev.example:41001/health
```

应得到 `protocolVersion: 3` 和健康状态；**单纯 `/health` 成功不代表 MySQL/Agent/业务转发就绪**。浏览器在有相同信任链的 HTTPS 地址打开 `/console`，用 `scope-dev` 与 Owner Token 进入界面。

### 跨主机 HTTPS 与 1Panel

现有 Control 模板默认只发布 `127.0.0.1:41001`，远端 Agent **无法直接连接**。需要为测试网络选择一条明确、受限的入口：绑定可信内网接口并使用防火墙限制来源，或用 **TCP 四层透传（TLS passthrough）** 暴露到对应私有地址。证书 SAN 必须与 `TUNEX_CONTROL_URL` 一致。

**不要用默认 1Panel OpenResty/Nginx 七层 HTTPS 终止反代代理 Agent 的 `/agent/v3/*`**：Control 需要实际 TLS 客户端证书进行 Node 身份认证，而不是信任可伪造的请求头。可单独规划 Console 的访问入口，但不要让普通 HTTP 反代破坏机器侧的端到端 mTLS。

## 4. Node Enrollment、Agent 启动

在 `/console` 创建允许实际测试 TCP/UDP 地址、端口及目标 CIDR 的 Node，记录 Node ID 与**短时有效**的一次性 Enrollment Token。先通过可信方式放置 `control-ca.pem`，保证 Agent state/secrets 权限。

Enrollment 是**显式的一次性操作**。使用 `docker run` 在 Agent 主机交互执行，可避免 Compose 常驻 secret 的只读挂载及临时环境变量传递问题：

```bash
# 从发布 Summary 复制的完整 Digest；不要填示例占位符
export TUNEX_AGENT_IMAGE='ghcr.io/anrcm0/tunex-agent@sha256:REPLACE_WITH_64_HEX_DIGEST'
export TUNEX_CONTROL_URL='https://control-dev.example:41001'
export TUNEX_NODE_ID='REPLACE_WITH_ENROLLED_NODE_ID'
read -rsp 'Enrollment Token: ' TUNEX_ENROLLMENT_TOKEN; echo
export TUNEX_ENROLLMENT_TOKEN

docker run --rm --network host --user 10001:10001 \
  -e TUNEX_ENROLLMENT_TOKEN \
  -v /srv/tunex/agent/state:/var/lib/tunex-agent \
  -v /srv/tunex/agent/secrets:/run/tunex-agent-secrets \
  "$TUNEX_AGENT_IMAGE" \
  --enroll --control="$TUNEX_CONTROL_URL" --node="$TUNEX_NODE_ID" \
  --ca=/run/tunex-agent-secrets/control-ca.pem \
  --state=/var/lib/tunex-agent \
  --journal-key=/run/tunex-agent-secrets/journal.key

unset TUNEX_ENROLLMENT_TOKEN
```

确认 Enrollment 成功、`journal.key` 与 `journal.json` 均已受保护持久化后，启动常驻 Agent：

```bash
docker compose --env-file /secure/tunex-agent.env \
  -f deploy/compose.agent.example.yaml config --quiet
docker compose --env-file /secure/tunex-agent.env \
  -f deploy/compose.agent.example.yaml up -d agent
docker compose --env-file /secure/tunex-agent.env \
  -f deploy/compose.agent.example.yaml logs --tail=100 agent
```

该 Agent 模板明确包含 `--relay`。只跑 Direct 时可在本机副本中删掉 `--relay`，不要修改已持久化的节点授权或 Journal。**实测采用 `network_mode: host` 验证原生端口和 Relay**；Bridge 模式中的 TLS/执行期限错误应检查内部端点 `advertisedHost`、监听/映射、DNS、双向 TCP 连通性及防火墙，不能简单断言 Bridge 永远不支持 Relay。

## 5. 转发与 Relay 冒烟测试

**Direct TCP**：在 Agent 可达的目标主机准备独立 HTTP Echo（测试主机可用 `python3 -m http.server 18080 --bind 127.0.0.1`）。在 `/console` 建立 TCP Forward（示例：`127.0.0.1:25565` → `127.0.0.1:18080`）；前提是 Node Policy 允许该监听、目标 CIDR/端口。验证：

```bash
curl --fail http://127.0.0.1:25565/
```

**Direct UDP**：在仓库目录执行 `node scripts/manual/udp-smoke.mjs echo --port 18081`，在 Console 另建 UDP-only Forward（`127.0.0.1:25565/udp` → `127.0.0.1:18081/udp`），然后执行：

```bash
node scripts/manual/udp-smoke.mjs probe --port 25565 --count 5 --timeout-ms 3000
```

必须看到两个独立 socket 共 10 个报文精确返回，并重新验证同数值端口的 TCP 仍可用。完整细节见 [UDP 实机检查](../docs/development/direct-udp-live-smoke.md)。

**Relay**：在第二台 Agent 主机重复注册和部署，且两端使用 `--relay`。于 Console 完成出口 Node Endpoint（公网/私网实际可达地址及独立内部 TLS/TCP 端口）、不可变 Transport Profile、Node/Profile 使用授权，再先预览 Plan，后创建 Relay Forward。只有两端当前 `active/ready` 且真实 TCP/UDP payload 通过才计为业务成功。正确拒绝测试包括伪造 CA、错误 Node ID、旧 peer pin 和无权限目的地址。参见 [Relay Console](../docs/development/relay-console.md) 与 [Relay Control](../docs/development/relay-control.md)。

以上用例可先在同主机独立容器中跑内部冒烟；**两台容器不等于两台物理主机**。跨主机网络隔离、丢包及故障切换需要单独验收。

## 6. 凭据轮换、故障恢复、备份与回滚

- `--rotate` 表示**主动触发机器凭据轮换**，不等于已经验证无人操作的长期自动 peer 轮换。先记录 Node 当前 session、Forward Health 和真实 Relay TCP/UDP 客户端收发，再触发轮换并复测；不能靠清空 Journal 来回到旧 session。
- 在隔离环境下分别验证 Agent 重启、Control 中断、Relay egress 不可达、旧凭据拒绝以及真实租约截止。故障后的恢复要检查新 Snapshot/Report、Operation 和实际用户 payload，而不是只看容器 `healthy`。
- MySQL 备份还原**不能单独代表安全回滚**。保护并核对 Authority 状态、CA、Agent Journal/high-water、数据库版本和凭据；禁止 `docker compose down -v`、重复 Authority 初始化、清空 Journal 或重用旧 V2 数据。需要进行真实恢复时遵循 [节点安全与恢复](../docs/operations/node-security-and-recovery-v1.md) 与 [恢复和容量](../docs/development/recovery-and-capacity.md)，在停用发行者、检查历史租约后按正式恢复工具的流程操作。
- 记录每次验收使用的 **完整 Digest、Git SHA、数据库 Schema 版本、容器用户/权限、脱敏日志、Forward/Operation ID、TCP/UDP 实际结果**。不公开 Owner/Enrollment Token、CA 私钥、Node 私钥、Journal Key 和原始数据库备份。

## 7. 仍不属于“生产就绪”的范围

Docker CI、SBOM、修复版 Critical 漏洞阻断和 GHCR 自动 Dev/版本镜像发布已经接入；这些不能代替安全复核。剩余发布门槛包括：不同**物理** Linux 主机的 Relay、实际宿主机防火墙与 L4 TLS 入口、无人值守自动轮换与长时间稳定性测试、High 漏洞分级、备份恢复/升级兼容性、多版本回滚及 1Panel 用户体验校验。

**开发排期与可交付出口：** [下一阶段开发目标](../docs/development/next-milestones.md)。

## 8. Default-off multi-hop development

The new execution path is described in
[multi-hop implementation and deferred acceptance](../docs/development/multihop-execution.md).
Base Control and Agent templates remain opt-in. Production Control additionally
requires an exact-source, reviewed evidence bundle. The optional
[Control override](compose.multihop-control.override.example.yaml) mounts that
bundle read-only; it is not a shortcut around runtime, physical-host or P0 gates.
Keep the upgraded Agent journal and its high-water when withdrawing the feature.
