# TuneX VNext · 总体架构 v1

状态：**Accepted for implementation**。描述目标架构，不代表当前仓库代码已实现。

## 1. 产品边界

TuneX 的唯一必选业务是 **Forward**。没有计费、智能路由、联邦、监控仪表盘和高级加密协议时，仍必须能够创建、更新、启停、删除真实的单节点 TCP/UDP Forward。

**分层规则**：

- **Core（TypeScript 纯代码包）**：Node、Forward、Endpoint、Path、Transport 引用的基础语义，配置验证和合法变更规则；不依赖 Web、数据库、网络、队列或任何运行驱动。
- **Control（Hono 应用）**：API、认证授权、模块间用例、持久化、Resource/Operation 管理、Runtime Controller；API 和 Worker 可作为两个进程共享同一业务代码。
- **Runtime（Control 内部模块）**：根据 Forward 意图与节点事实产生 Assignment、持久化节点完整快照、预留资源、对账、恢复、补偿与阶段推进。Runtime **不是 Core**。
- **Go Agent**：认证并主动访问 Control；验证和应用节点快照；监听、连接、转发和上报实际状态。业务数据不经过 Control。
- **Adapters**：Prisma/MySQL、Redis、Agent HTTP、Secret Provider。具体依赖不进入 Core。

## 2. 两条数据路径

**控制路径**：Web/CLI → HTTPS API → Forwarding Application → Core（纯校验）→ MySQL 事务（Forward + Operation + 预留）→ Worker/Runtime → Agent 主动拉取 Snapshot → Agent 上报 Observation → Runtime 对账。

**数据路径**：Client → Ingress Agent → [零个或多个中继 Agent] → Egress/Target。直连由单 Agent 执行；加密只覆盖传输配置明确定义的跳段，不暗示客户端到目标的端到端加密。

## 3. 依赖规则

`web -> API -> application -> core`；`application -> repository/transport/agent ports -> adapters`。Worker 调用 Application 用例与 Runtime。不得让 Core 反向依赖任何应用或基础设施。模块不得跨越所有权边界直接写其他模块的表。

## 4. 数据所有权

MySQL 是用户配置、版本、操作、快照序号、端口独占预留、资源租约及墓碑的权威来源。Redis 是通知、缓存与可丢失的执行加速器；Redis 丢失不能永久丢失已确认操作。Agent 的实时监听和连接状态由 Agent 产生，Control 只保存带 bootId/序号/时间/新鲜度的观测；不能以历史观测冒充现时事实。

对单个 Forward 的重要写操作需要一个持久化、可恢复、可幂等的 Operation。Runtime 拥有 Operation，Application 通过 owner-owned 的共享事务接口组织 Forward、预留与 Operation 同时提交；参见 [Control API / Operation](../spec/control-api-v1.md)。接受请求返回资源 ID、操作 ID；`202 Accepted` 不等于部署完成。

## 5. 逻辑部署

最小必需运行拓扑：`control api/worker`（可同进程）、`mysql`、`agent (N)`，通过 CLI 或最小 Web 操作；`web` 与 `redis` 是可选进程。不要求独立 Core 服务、服务网格、Kafka、插件守护进程或内置数据库容器。Compose 适合开发；生产可使用外部 MySQL/Redis、已有反代。Agent 只需要对 Control 发起受认证的出站控制连接，业务端口需按场景开放。

## 6. 演进边界

- `Path` 表示路径约束，不等于智能路由算法。
- `TransportRef` 是对已版本化的传输配置的引用，不等于独立的 Link 数据库实体。
- 可复用 Link、负载均衡、自动路由、计费均位于模块，不改变 Forward 的“转发意图”定义。
- 初版优先**固定单目标、一个入口、TCP/UDP**；不承诺通用 L7、透明代理、任意多跳协议。
- 不得对安全传输失败进行静默明文降级。

## 7. 安全与不可用性

Node 的拥有者不等于 Forward 的访问授权。Control 校验用户权限、节点授权和端口租约；Agent 对配置来源、版本、执行权和真实 bind 做二次保护。Control 失联时已有转发最多在租约有效期内继续运行；离线无法做到即时撤销，应作为明确的威胁/可用性取舍。高可用、加密强度、生产就绪只能以对应验收与审计证明。普通 drain 不得越过授权硬截止；进程重启必须在线重新建立会话后恢复执行。注册、撤销与旧备份恢复遵循 [节点安全与恢复](../operations/upgrade-recovery.md)。

## 8. 设计目标与非目标

**目标**：最小 Core、Forward First、版本化协议、可恢复控制循环、独立数据面、可控模块扩展、真实实网验证。

**非目标**：兼容旧 V2、一次性移植历史功能、让 Core 成为中央远程服务、初期引入微服务或动态加载未经审查的 Agent 插件。


