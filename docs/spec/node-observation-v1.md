# Node observation v1

状态：**首个被动观察切片已实现，待对应提交 Actions 验收**。
本契约属于 [ADR-0006](../decisions/0006-classified-extension-contracts.md) 的观察类接入，
不是 Core API、ADP 扩展或独立主动 Probe 的完成声明。

## 1. 范围与调用链

```text
Bearer API
  -> NodeObservations (request validation / admission / deadline / cancellation)
  -> AuthorizedNodeReportReader
  -> MySqlNodeObservationReader
       -> maintenance guard
       -> scope authorization + scoped Node/report projection on one transaction
       -> rollback / release, or destroy owned connection on cancellation
  -> bounded immutable observation
```

首个且唯一支持的来源是 `persisted-agent-report` v1。读取已持久化的 Agent Report
元数据，不发起 DNS、HTTP、TCP/UDP、Agent RPC，不接收目标地址、端口或任意命令。
无需新增数据库表、机器协议、Agent 能力或 Journal 格式。

本观察不复用 Runtime 的执行权，不调用部署、快照发布、租约或切换接口。
可信进程内端口不是恶意扩展的安全沙箱；尚无通用插件 SDK 或动态注册。

## 2. API 与授权

`POST /api/v1/scopes/:scope/nodes/:id/observations`

```json
{
  "source": "persisted-agent-report",
  "version": 1,
  "timeoutMs": 2000
}
```

- `timeoutMs` 可省略，默认 2000；必须为 100..2000 的整数，不接受 null 或字符串。
- 请求为封闭对象，未知来源、版本、字段及无效 ID 返回 422；请求体上限 1024 字节。
- 使用已有 Bearer 认证与维护模式检查。每次观察重新验证 active Scope Membership，
  与 Node/report 读取处于同一事务；查询同时绑定 Node ID 和 Scope ID。
- 缺失、跨 Scope 的 Node 和无成员权限均返回 404。被动、脱敏的节点事实沿用已有
  Scope viewer 诊断权限，不赋予执行权，**不**把它当作主动 Probe 的授权规则。
- Node Grant、执行主体、目标访问策略与主动 Probe 的授权需要后续独立设计；
  不能因为这里允许 viewer 读取事实，就允许其向任意目标发包。
- 响应沿用 `Cache-Control: no-store`。本接口不接收幂等键，不创建 Operation，
  不存储新的观察记录，不更新报告或执行状态。

## 3. 预算与期限

每个 `ControlApplication` 的独立观察宿主使用以下有界预算：

| 预算 | 限制 |
| --- | --- |
| 全局在途 | 最多 8 个 |
| 单 Actor | 最多 1 个在途；结束后冷却 1000ms，跨 Scope 共用 |
| 单 Scope/Node | 最多 1 个在途，跨 Actor 共用 |
| Actor 预算记录 | 最多 256 个；只清理已结束且冷却到期的项，不淘汰在途项 |
| 单次读取 | 1 个 Node、1 份报告元数据、1 个结果 |
| 结果 | 最多 4096 UTF-8 字节，不返回原始报告、密钥或错误详情 |

预算是**单进程**的，不宣称多副本全局限流。耗尽返回 `OBSERVATION_BUSY` / 429，
不排队，也不静默降级到其他来源。报告正文不读取到应用内存；SQL 只投影有界标量
和 observation 数组长度，不返回具体 assignment、配置和凭据。

期限从应用层通过输入校验并获准入时开始，包括连接获取、授权、读取及清理，
不承诺覆盖 HTTP 请求体上传或之前的 Bearer/维护检查。
期限以单调时钟检查，过期后不接受晚到结果。超时返回 `OBSERVATION_TIMEOUT` / 503；
调用方 AbortSignal 取消返回 `OBSERVATION_CANCELLED` / 409，外部 reason 不回传。
HTTP 是否能感知物理断连取决于服务器提供的 Request signal，不额外承诺断连检测。

MySQL 来源使用专属连接，取消/超时时销毁该连接来停止在途查询；未完成连接获取时，
保留准入占用，取得连接后立即销毁，不启动授权/读取。成功读取也必须完成 rollback
才返回；rollback 失败则销毁连接，禁止把脏事务放回连接池。
当前 mysql2 的 `destroy()` 只是结束 stream，不能单独保证在途 Promise 收到拒绝；
适配器局部绑定其底层 transport，先带错误强制销毁 stream，再移出连接池。
此驱动耦合只留在基础设施层，真实 MySQL 锁等待回归必须覆盖升级后的行为。
关闭本地 transport 不代表已经取得服务器端事务回滚完成的确认；
不能将 API 取消结果作为数据库资源已释放或任何执行授权已撤销的证明。

任何来源超时或取消后，**直到底层工作实际结束才释放并发预算**。这避免反复取消
绕过限流；不响应取消的可信来源最多耗尽预算并使后续观察失败关闭，不能无限开工。
不销毁或复用 Runtime 事务。未知来源错误统一为 `OBSERVATION_FAILED` / 503，
无效结果为 `OBSERVATION_INVALID_RESULT` / 503，不泄露 SQL、凭据或原始异常。

## 4. 结果与事实来源

成功响应固定包含：

- `version: 1`、`source: persisted-agent-report`、请求的 `scopeId/nodeId`。
- `independentProbe: false`、`health: unknown`，即使报告中监听为 ready 也不改变。
- `capturedAt`：本次读取后的 Control 时间，不冒充 Agent 测量时间。
- `receivedAt`：Control 已存报告的接收时间；缺失时为 null。
- `provenance`：报告 Node、boot ID、session epoch、report sequence、
  accepted snapshot generation、Agent observedAt、Control receivedAt 和 assignment 数量；
  不返回报告正文。该字段保留历史来源，是否仍适用由 status/reason 判断。
- `expiresAt`：报告时间、接收时间、快照硬截止减时钟余量、节点凭据截止的最早边界；
  缺少必要边界时为 null。不能仅检查此字段而忽略 status/reason。

| status | reason | 含义 |
| --- | --- | --- |
| observed | recent-report | 元数据一致且未过期的已存报告，不是独立健康或 Applied 的判断 |
| stale | report-expired / snapshot-expired | 报告或其快照时间边界已过 |
| unknown | missing-report / invalid-report | 缺失或损坏，不能作为新鲜事实 |
| unknown | session-mismatch / snapshot-mismatch | 报告与当前 Node/boot/session/snapshot 不一致 |
| unknown | node-revoked / credential-expired | 当前节点授权已失效 |
| unknown | clock-skew | 接收时间在未来或 Agent 时间超过允许时钟偏差 |

报告新鲜窗口不超过现有 Runtime policy，并额外保守限制为最多 300 秒；
调用方不能指定更宽窗口。Agent 时间略超前不能延长 Control 接收时间的期限。
Scope/Node 不匹配的来源结果直接拒绝，公共结果分离副本并深冻结。

## 5. 验收与后续

- 端口回归：封闭请求、来源/版本拒绝、不可变性、期限、新鲜度、身份绑定、取消、
  并发/冷却预算、晚到结果、异常脱敏及连接清理。
- 真实 MySQL/API：生产装配、SELECT-only 账号、Viewer/跨 Scope/失效成员、
  原始数据不泄露、全库内容不变、来源/过期和锁等待超时。
- 功能测试仅在 GitHub Actions；本地仅做类型、契约生成一致性、依赖与文档静态检查。
  用例存在或接入工作流不等于已通过，证据只适用于对应提交。

主动 Probe 的 Agent 观测点、独立许可、绑定/egress 与有界 TCP 执行基础见
[Probe v1 基础切片](forward-probe-v1.md)；当前预检不可执行，远程协议/签发/防重放/
派发与结果接收仍未实现。该内部执行器不接 DNS，不改变本接口的被动语义。
现有 Agent 本地资源诊断文件也尚未作为遥测接入本接口。
不得把新增 TCP 连接、HTTP 请求或自动切换分支直接塞进本被动来源。
