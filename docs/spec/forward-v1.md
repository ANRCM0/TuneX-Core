# Forward Specification v1

**规范状态：Accepted for implementation。**

## 1. 统一业务对象

Forward 定义：有唯一身份、作用域及配置版本的网络转发意图。第一版固定**一个入口、一个目标、TCP 和/或 UDP**。单节点直连无 `path/transport`；跨节点中继使用 `path.via` 与有版本的 `transport`。

Forward ≠ Tunnel/Link ≠ Socket ≠ Deployment ≠ Operation。Link 复用和 Secure Transport 的配置所有权在 Transport Module，禁止变成 Core 必需实体。

## 2. 创建示例

直连：
```json
{
  "enabled": true,
  "protocols": ["tcp", "udp"],
  "ingress": {
    "nodeId": "node-hk",
    "listen": { "address": "0.0.0.0", "port": 25565 }
  },
  "target": { "host": "10.0.0.20", "port": 25565 }
}
```

跨节点加密中继：
```json
{
  "enabled": true,
  "protocols": ["tcp"],
  "ingress": {
    "nodeId": "node-hk",
    "listen": { "address": "0.0.0.0", "port": 25565 }
  },
  "target": { "host": "10.0.0.20", "port": 25565 },
  "path": { "via": ["node-jp"] },
  "transport": { "profileId": "secure-profile-01", "configRevision": 2 }
}
```

`target.host` 是**最终目标**，不是固定中继的控制地址；中继间连接参数由 Runtime/Transport 为每个 Agent 编译生成。

## 3. 源事实与约束

Core 负责 `validateForwardSpec`。Application 必须查询并验证 Node 与 Transport Profile 的存在、授权、能力、允许的目标网络、Workspace 配额，以及独占监听资源。

v1 对端口使用保守独占键：`nodeId + protocol + port`，不因监听绑定的不同 IP 而共享。同一条 TCP+UDP 规则必须在同一数据库事务中预留两份资源，否则整体拒绝。不通过前端字段判断“端口空闲”作为最终依据。Agent 仍须真实 `bind`，并安全处理地址族和本地外部进程占用。

跨节点 Forward 必须由 Transport Module 提供明确支持的协议与传输安全声明。标记要求加密时，失败**不得**自动退化为明文。节点与 Profile 不满足协议能力时，拒绝执行。

对目标解析需限制 DNS 重绑定、地址类型、私有/环回网络、访问范围等安全风险；允许访问目标由节点授权策略定义，Agent 实际拨号时应再次执行目标策略。任何用户可控字段不能绕过网络访问约束。

## 4. 版本与并发

Forward 的 `revision` 仅代表**用户期望配置**版本：创建为 1，每次合法变更递增；更新必须带 `expectedRevision`，持久层通过 CAS/唯一事务边界拒绝竞争写入。自动路由的实际路径变化若未修改用户意图，只产生新的 `deploymentGeneration`，不递增 Forward Revision。

不可复用已删除的 Forward ID；删除保留墓碑/保留期并约束旧 Agent 的补发。`forwardRevision`、`deploymentGeneration`、`snapshotGeneration` 与资源 `fence` 不得混为一个字段。

## 5. 启停和删除语义

- `enabled=true`：希望激活，允许暂时处于等待 Agent 的待部署状态。
- `enabled=false`：停止新接入、存量连接按明确 `drain` 策略处理，Forward 记录与端口预留保持不变。默认 drain 30 秒，但任何连接不得越过授权/凭据硬截止。
- `delete`：持久化删除意图、发布墓碑、使旧执行世代失效、清理 Agent 后在满足安全条件时释放资源；非立即硬删除。
- “用户期望”“部署是否成功”“当前健康”三种状态必须分开展示。

## 6. 更新原子性边界

一次数据库事务必须原子提交用户期望版本、Operation 及必要的端口资源变更；跨节点 Agent 执行没有全局原子事务，依靠 Prepare/Activate/Drain、幂等、补偿、重试和对账。更新端口时先获取新端口资源并规划切换，再满足安全撤销条件后释放旧端口。失败时不得产生一个无法追踪的部分完成状态。具体规则见 [ADP/2 执行与更新](../protocol/agent-deployment-v2.md#7-执行更新与多节点顺序) 和 [Operation 契约](control-api-v1.md)。TCP+UDP 预留原子不表示两个 socket 激活原子：实际单协议失败时保留可工作的协议、整体 degraded，Operation 不得成功，协议集合不得静默缩减。

## 7. 未来扩展

Routing Module 计算 `ResolvedPath`，不会反复覆盖 `ForwardSpec`。Transport Module 独立提供驱动能力与版本配置。多目标、L7 代理、透明流量、复杂多跳等如改变 v1 不变量，必须另开 ADR / 合同版本，而非偷偷塞入不受校验的任意 JSON。

## 8. 极简验收

撤掉监控、联邦、计费、智能路由、加密中继插件后：单节点 `tcp`、`udp` 及 `both` 的真实创建、数据流量、更新、启停、删除和重启恢复仍必须有效。机器协议 ADP/2 细则见 [Deployment Protocol](../protocol/agent-deployment-v2.md)。


