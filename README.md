# TuneX Core

面向多用户的 TCP/UDP 转发与线路管理系统，支持私有节点、共享资源授权、TLS 中继、
多跳线路、流量限制及 Web 控制台。Control 使用 TypeScript + MySQL，Agent 使用 Go。

## 安装

以下命令使用 Linux Bash。需要 Node.js 24.14.1、npm 11、Go 1.26.3、MySQL 8.4 和
OpenSSL；部署前准备可信 CA、服务端证书及持久化目录，并同步系统时间。

```bash
git clone https://github.com/ANRCM0/TuneX-Core.git
cd TuneX-Core
npm ci --ignore-scripts
mkdir -p .artifacts
node scripts/run-go.mjs build -o ../.artifacts/tunex-agent ./cmd/tunex-agent
```

### Control

按实际环境配置数据库、证书和状态目录，证书需包含访问域名或 IP 的 SAN：

```bash
export DATABASE_URL='mysql://USER:PASSWORD@DB_HOST:3306/tunex'
export TUNEX_CA_CERT=/etc/tunex/ca.pem
export TUNEX_CA_KEY=/etc/tunex/ca.key
export TUNEX_SERVER_CERT=/etc/tunex/server.pem
export TUNEX_SERVER_KEY=/etc/tunex/server.key
export TUNEX_CONTROL_STATE=/var/lib/tunex-control
export TUNEX_CONTROL_HOST=0.0.0.0
export TUNEX_CONTROL_PORT=41001

# 仅全新部署执行，妥善保存此 Token 用于登录
export TUNEX_OWNER_TOKEN="$(openssl rand -hex 32)"
npm run control:bootstrap -- default admin
TUNEX_AUTHORITY_INITIALIZE=1 npm run control
```

后续启动使用 `npm run control`，不再设置初始化开关。访问
`https://CONTROL_HOST:41001/console`，使用保存的 Token 登录；客户端需信任上述 CA。

### Agent

在控制台创建节点，取得节点 ID 和一次性接入 Token。在目标机器准备 CA、状态目录
及独立密钥目录，替换以下参数后注册并启动：

```bash
read -rsp 'Enrollment Token: ' TUNEX_ENROLLMENT_TOKEN; echo
export TUNEX_ENROLLMENT_TOKEN
.artifacts/tunex-agent --enroll \
  --control https://CONTROL_HOST:41001 --node NODE_ID \
  --ca /etc/tunex/control-ca.pem --state /var/lib/tunex-agent \
  --journal-key /etc/tunex/secrets/journal.key
unset TUNEX_ENROLLMENT_TOKEN

.artifacts/tunex-agent \
  --control https://CONTROL_HOST:41001 --node NODE_ID \
  --ca /etc/tunex/control-ca.pem --state /var/lib/tunex-agent \
  --journal-key /etc/tunex/secrets/journal.key
```

中继节点添加 `--relay`；多跳及主动探测需显式开启双方能力。长期运行请配置系统服务。
容器部署可参考 [Control 模板](deploy/compose.control.example.yaml)和
[Agent 模板](deploy/compose.agent.example.yaml)，使用对应版本的镜像 digest。

## 更新

停止服务，备份 MySQL、Control 状态与证书、Agent 状态及独立 Journal 密钥，然后更新：

```bash
git pull --ff-only
npm ci --ignore-scripts
node scripts/run-go.mjs build -o ../.artifacts/tunex-agent ./cmd/tunex-agent
```

按 `deploy/upgrade-plan.example.json` 填写实际升级计划，使用目标版本工具执行
`npm run ops -- assess-upgrade /secure/upgrade-plan.json`。确认兼容后沿用原配置启动，
不重新初始化、注册节点或删除历史状态。

## 开发

```bash
npm run typecheck                  # TypeScript 类型检查
node scripts/check-boundaries.mjs  # 源码边界检查
npm run contracts:check            # 协议与生成产物一致性
```

`apps/control` 为 Control，`apps/web` 为控制台，`agent` 为 Go Agent，`packages` 为领域
与协议包，`deploy` 为部署配置。功能、数据库、网络和浏览器测试通过 GitHub Actions 执行。
