# TuneX Core

TuneX 是面向多用户的 TCP/UDP 转发与线路管理系统，支持私有节点、共享资源授权、
TLS 加密中继和多跳组线，提供 Web 控制台、端口与带宽／流量限制、监控和诊断。

Control 使用 TypeScript 和 MySQL，节点运行独立的 Go Agent。

## 安装

以下为 Linux Bash 下的源码安装方式。准备：

- Node.js 24.14.1、npm 11.11.0、Go 1.26.3、Git 和 OpenSSL。
- MySQL 8.4 数据库及有建表／迁移权限的数据库账户。
- Control 的 CA 证书、CA 私钥和包含实际访问域名／IP SAN 的服务端证书、私钥。
- Control 和 Agent 的持久化目录，以及已同步的系统时间。

### 获取源码

```bash
git clone https://github.com/ANRCM0/TuneX-Core.git
cd TuneX-Core
npm ci --ignore-scripts
mkdir -p .artifacts
node scripts/run-go.mjs build -o ../.artifacts/tunex-agent ./cmd/tunex-agent
```

Agent 需使用与目标机器系统和架构匹配的二进制文件。

### 启动 Control

准备证书与状态目录，确保运行账户能够读取证书、私钥并写入状态目录；私钥仅供
运行账户读取。将下列数据库、证书路径和监听地址替换为实际配置：

```bash
export DATABASE_URL='mysql://USER:PASSWORD@DB_HOST:3306/tunex'
export TUNEX_CA_CERT=/etc/tunex/control/ca.pem
export TUNEX_CA_KEY=/etc/tunex/control/ca.key
export TUNEX_SERVER_CERT=/etc/tunex/control/server.pem
export TUNEX_SERVER_KEY=/etc/tunex/control/server.key
export TUNEX_CONTROL_STATE=/var/lib/tunex-control
export TUNEX_CONTROL_HOST=0.0.0.0
export TUNEX_CONTROL_PORT=41001
```

首次安装时，在空数据库中创建工作空间和所有者，并安全保存生成的登录 Token：

```bash
export TUNEX_OWNER_TOKEN="$(openssl rand -hex 32)"
npm run control:bootstrap -- default admin
TUNEX_AUTHORITY_INITIALIZE=1 npm run control
```

`TUNEX_AUTHORITY_INITIALIZE=1` 仅用于全新部署的首次启动。之后沿用上述数据库、
证书及状态配置，使用 `npm run control` 启动。

浏览器访问 `https://CONTROL_HOST:41001/console`，使用所有者 Token 登录并选择工作空间。
浏览器和 Agent 均需信任配置的 CA；远程 Agent 应直接连接 Control 的 HTTPS 服务，
或通过保留端到端 TLS 的四层转发连接。

容器部署可使用[安装接入向导](docs/development/deployment-setup-v1.md)。在实际部署主机
运行 `deploy/setup.mjs --role control|agent --phase initial|existing`，复用现有预检并
读取下一步操作和失败处理建议；计划不执行命令，静态通过不代表服务或业务已验证。

### 接入 Agent

在控制台“我的机器”中注册私有节点，或由工作空间所有者在“共享资源管理”中创建
共享节点。记录节点 ID 和一次性接入凭据，在目标机器准备可信 CA、受保护的状态
目录，以及位于状态目录之外的 Journal 密钥路径。

首次接入，在目标机器执行；替换地址、节点 ID 和文件路径：

```bash
read -r -s -p 'Enrollment Token: ' TUNEX_ENROLLMENT_TOKEN; echo
export TUNEX_ENROLLMENT_TOKEN
.artifacts/tunex-agent --enroll \
  --control 'https://CONTROL_HOST:41001' --node 'NODE_ID' \
  --ca /etc/tunex/control-ca.pem --state /var/lib/tunex-agent \
  --journal-key /etc/tunex/secrets/journal.key
unset TUNEX_ENROLLMENT_TOKEN
```

注册成功后，用相同配置启动 Agent：

```bash
.artifacts/tunex-agent \
  --control 'https://CONTROL_HOST:41001' --node 'NODE_ID' \
  --ca /etc/tunex/control-ca.pem --state /var/lib/tunex-agent \
  --journal-key /etc/tunex/secrets/journal.key
```

Direct 转发无需额外开关；参与中继的 Agent 需添加 `--relay`。多跳和主动探测默认
关闭，按需配置 Control 与 Agent 双方能力。接入后可在“我的线路”和“我的转发”中
创建线路与规则。长期运行时，为 Control 和 Agent 配置系统服务或使用容器部署。

## 更新

在维护窗口停止服务，备份 MySQL、Control 状态与 PKI、各 Agent 状态目录及独立
Journal 密钥。保留现有节点身份和配置，再更新源码、依赖与 Agent：

```bash
git pull --ff-only
npm ci --ignore-scripts
mkdir -p .artifacts
node scripts/run-go.mjs build -o ../.artifacts/tunex-agent ./cmd/tunex-agent
```

根据[升级计划示例](deploy/upgrade-plan.example.json)填写实际源／目标版本、镜像身份
和兼容 profile；示例中的占位值需要替换。使用目标版本工具进行只读兼容评估：

```bash
npm run ops -- assess-upgrade /secure/tunex/upgrade-plan.json
```

按评估结果安排 Control 和 Agent 的升级顺序；`blocked` 或 `review-required`
需要先处理再继续。重启沿用原数据库、证书、状态目录与密钥，不重复初始化或注册，
不删除 Journal。降级前也需评估，不能仅替换旧二进制或单独恢复数据库。

## 容器部署

镜像发布到 GitHub Container Registry：

| 镜像 | 用途 |
| --- | --- |
| `ghcr.io/anrcm0/tunex-control` | Control 与 Web 控制台 |
| `ghcr.io/anrcm0/tunex-agent` | Go Agent |

`v0.1.0` 等版本标签对应固定版本，`latest` 跟随最新正式版本，`dev` 跟随主线通过
CI 后发布的开发版本。更新时替换为所选标签或固定 digest，再重建对应容器；保留
原状态、证书及密钥挂载。开发镜像另保留 `dev-<完整提交 SHA>` 标签，便于固定版本。

```bash
docker pull ghcr.io/anrcm0/tunex-control:latest
docker pull ghcr.io/anrcm0/tunex-agent:latest
```

可参考 [Control Compose 模板](deploy/compose.control.example.yaml)和
[Agent Compose 模板](deploy/compose.agent.example.yaml)。先配置自建或已确认版本的
镜像、数据库连接、证书和持久化目录；Agent 使用 Linux host 网络。首次初始化和
节点注册单独执行，日常服务沿用已有状态。
