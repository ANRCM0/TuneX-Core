# TuneX VNext · Forward-first Web Alpha

状态：**implemented in development branch, not production released**。本页面是独立实现的产品纵向切片，没有复制历史 V2 / ForwardX 源码或资产。

## 功能

Control HTTPS 同源提供 `/console`；没有新端口、新数据库、新 npm UI 依赖，也不需要额外 CORS 设置。现有 Bearer API 仍保持 cookie-free；界面只在**当前标签页内存**保存 token，不写 localStorage、sessionStorage、URL 或 cookie。刷新页面后重新输入。所有写入带客户端生成的 Idempotency-Key；网络中断后的同一未确认提交在当前页面内使用原 Key 重试。**Node provisioning 原有 API 不提供持久幂等响应，重复注册前应先检查节点列表。**

页面提供：

- 概览：Scope 节点数、Forward 数及**当前第一页 Operation 中**的执行中/失败数量。不是全局健康或性能统计。
- 节点：分页列表、授权策略和实际会话/报告时间、Node 详情、按预设生成 Node Policy 并创建一次性 enrollment token（不自动远程安装 Agent）。
- Forward：分页列表、Direct 能力驱动的受控表单、创建/编辑、启停、删除、按 ID 查完整期望与 Agent 观察状态。Relay 可以查看，但不通过简化表单编辑。
- Operation：最近执行动作及查询详情；Succeeded 是执行完成，不等于独立业务探测成功。

新增只读 API，所有请求通过既有 Bearer 身份与 `identity.scope` 验权，数据库按 scope 筛选，并在数据库做分页：

- `GET /api/v1/scopes/:scope/nodes?page=1&limit=25`
- `GET /api/v1/scopes/:scope/forwards?page=1&limit=25`
- `GET /api/v1/scopes/:scope/operations?page=1&limit=25`

每次读取必须在 SQL 中限制 scope，不能仅靠 UI 过滤。每页上限 100，页码上限 10000；所有 read model 均不包含 Enrollment Token、私钥或数据库凭据。Node 报告时间是观察事实，不代表链路可用；Forward 列表中的 Operation 状态不是 Health。现有 Forward 详情的 `health.condition` 来自 Agent 观测，还不是单独的端到端探测。

## 本地体验

先按 [开发入口](getting-started.md)、[Phase 1](phase1.md) 配置独立 MySQL、合法 TLS 证书与 CA、Control 授权、注册 Owner/Scope：

```sh
npm ci --ignore-scripts
# 需要先设置 DATABASE_URL、TUNEX_OWNER_TOKEN 等 bootstrap 配置
npm run control:bootstrap -- my-scope owner-account
# 需要先设置 TUNEX_CA_CERT / TUNEX_CA_KEY / TUNEX_SERVER_CERT /
# TUNEX_SERVER_KEY / TUNEX_CONTROL_STATE 等 Control 配置
npm run control
```

浏览器打开 `https://127.0.0.1:41001/console`（按实际配置的 HTTPS 地址/端口；证书须受浏览器信任）。输入 Scope ID 与已建立的 Owner/Member Token。控制面仍默认只监听 `127.0.0.1`，不要为了展示页面将开发配置直接暴露公网。

当前没有新建账号/网页登录；Bearers 使用既有 Scope 管理体系。支持已授权 Viewer 查看列表；所有写入仍由 Control 实行管理角色与 Node Grant 校验。页面按钮隐藏/禁用不是授权边界。

## 安全和非目标

- 静态页面设置严格 CSP（仅同源脚本/样式/请求），nosniff、DENY frame、no-referrer；DOM 使用 `textContent` 呈现数据库/Agent 数据，不通过 `innerHTML` 注入动态值。
- Bearer Token 只在浏览器页面内存中；离开或关闭页面不能恢复。调试器、浏览器扩展及恶意脚本仍能观察当前会话内的凭据，正式产品需另行设计会话安全和认证交互。
- 对改变监听/目标的操作继续要求 `expectedRevision`，已有 Control CAS、权限、端口预留、运行租约和 ADP/3 拒绝规则不得放宽。
- Node Policy CIDR/端口输入是管理员意图，服务器永远独立执行完整校验；不能把 UI 默认值当作安全策略。
- 本 Alpha 不承诺独立链路探测、自动升级/安装 Agent、拓扑建模、Relay 编辑、实时推送、跨主机生产高可用、浏览器端证书双向验证或生产发布门槛。

## 验证

```sh
npm run typecheck
npm run test:web
npm test
npm run check
```

新增后端测试验证 scope 授权前不读取数据、分页不可越界、列表映射安全；浏览器纯逻辑测试覆盖协议/Node capability、监听端口和 Operation 状态。还需要独立 HTTPS + 真实 MySQL/Agent + 浏览器端到端验收，尤其 401、403、CAS 冲突、断网请求重试和创建/删除后的状态收敛。没有该证据之前不能宣称生产可用。

## 与完整补齐路线的关系

优先完成 [ForwardX 经验吸收计划](forwardx-gap-closure.md) 中的 P1 Web/Node 管理基础；未来才增加 Relay 全量拓扑/端点配置、Link 复用、可选驱动、运维发行和商业模块。当前文档链接如目标计划尚未合并，请按分支实际情况查阅。
