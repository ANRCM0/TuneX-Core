# Control API / Operation v1

状态：**Accepted，正在分阶段实现与验收**。只约束 VNext `/api/v1`；历史 V2 API 不提供兼容。机器端当前使用 [ADP/3](../protocol/agent-deployment-v3.md)，ADP/2 为被取代的 direct 基线。

## 1. 最小 API

所有业务端点先验证用户身份、scope membership 和资源授权；cookie 会话需 CSRF 防护，机器端点不接受用户 cookie。资源 ID 不能代替权限校验；跨 scope 查询返回不泄露存在性的 404。错误响应遵循 `{code,message,retryable,requestId}`，message 不含内部凭据。

| 方法与路径 | 输入 | 持久接受后的响应 |
| --- | --- | --- |
| POST /api/v1/scopes/{scopeId}/forwards | ForwardSpec | 202：forwardId、revision、operationId |
| PUT /api/v1/scopes/{scopeId}/forwards/{id} | expectedRevision、spec（完整受控配置） | 202：forwardId、新 revision、operationId |
| DELETE /api/v1/scopes/{scopeId}/forwards/{id} | expectedRevision | 202：forwardId、墓碑 revision、operationId |
| GET /api/v1/scopes/{scopeId}/forwards/{id} | 无 | 200：desired、applied、health、lastOperation |
| GET /api/v1/scopes/{scopeId}/operations/{id} | 无 | 200：forwardId、状态、目标 revision、进度、错误、cleanupPending |
| POST /api/v1/scopes/{scopeId}/operations/{id}/retry | expectedRevision | 202：新 operationId、原 operationId |

启用/禁用通过 PUT 修改 enabled；禁止客户端覆盖 id/scopeId/revision。非重放请求仍须先通过 expectedRevision CAS 检查；配置规范化后完全相同的 PUT 返回 200 和当前资源，不增加 revision，不创建 Operation；请求幂等记录仍须保存。DELETE 是逻辑删除并递增 revision；普通 GET 对已删除资源返回 404，清理进度通过 Operation 查询。需要导出历史信息的审计接口不属于最小 API。

请求校验失败 400/422；认证/权限失败 401/403；CAS 冲突 409 `REVISION_CONFLICT`（可附有权限查看的 currentRevision）；端口预留冲突 409 `PORT_RESERVED`；相同幂等键不同请求 409 `IDEMPOTENCY_CONFLICT`；资源上限 429。实际 Agent bind 失败是异步 Operation 结果，不能把已经提交的 202 追溯改成请求失败。

`applied` 的每条观测附带由已发布 Assignment 推导的 `nodeId,role,forwardRevision`，
同时保留 deploymentGeneration/fence/phase/condition。更新被接受时，旧 applied
可能仍健康；`health=ready` 不能被解释为新 desired revision 已应用。客户端必须
比较 applied.forwardRevision 与 desired.revision，Relay 还须覆盖所有当前角色/协议。
旧 drain 的进度及清理通过 Operation 查询，不能用旧 ready 观测完成新 Operation。

## 2. 幂等请求与并发

所有写请求要求 `Idempotency-Key`（1..128 ASCII 字符）。唯一范围为 `(scopeId,actorId,key)`，跨 endpoint 也不能复用为不同请求。摘要包含方法、规范化路径、规范化后的完整输入及 expectedRevision；使用 RFC 8785/SHA-256，与时间、网络重试次数无关。

同一事务内先检查/锁定幂等记录，再执行 CAS：

- 相同 key、相同摘要：当前身份仍有查看权限时，返回首次持久响应和相同 IDs；即使资源之后已有新 revision，也不能再次执行原修改。
- 相同 key、不同摘要：拒绝；不得用最近一次请求覆盖记录。
- 两个并发相同 key：唯一约束保证最多一个意图提交；失败事务不留下孤立预留。
- 数据提交后响应丢失：重试读回原结果。事务提交前失败不承诺成功，可安全重试。

Phase 1 幂等记录与 Operation 审计不自动过期；容量和归档策略必须显式制定后才能 GC，不能删除 key 后又默默把重放当新操作。授权失败、语法错误等未被接受的请求不消耗成功记录。请求是否已提交必须以数据库事实为准。

## 3. Operation 所有权与状态

**Runtime 拥有 Operation 数据、执行状态、预留及 cleanup task。** Forwarding 拥有意图/修订。Application 用例组织同一 MySQL 事务，调用 owner-owned 的事务接口；事务内不进行 Agent 网络调用或依赖 Redis 成功。

最小持久字段：id、scopeId、forwardId、targetRevision、kind、status、requestedBy、idempotencyKey、requestDigest、createdAt、updatedAt、executionDeadline、attemptCount、claimToken、claimUntil、lastError、supersededBy、cleanupPending。日志记录 requestId/operationId/forwardId 和部署版本，禁止记录秘密。

状态：`accepted -> running -> succeeded|failed|superseded`。可重试错误在 running 中记录 nextAttemptAt，不凭单次失败宣布终态；超过 executionDeadline 或永久错误转 failed。终态不得被迟到 ACK 改写。默认 executionDeadline 为接受后 10 分钟，可配置且必须有界；Agent 长时间离线不会留下永远 running 的操作。

| 操作 | succeeded 的必要条件 |
| --- | --- |
| create/enable/update | 当前目标 revision 的全部期望协议和角色已 active/ready，报告版本与会话正确且新鲜；必要旧实例已按策略排空、旧预留安全释放 |
| disable | 无新接入，全部执行实例 drain 完成或授权硬截止已被安全确认；Forward 和预留仍保留 |
| delete | 删除意图与 Tombstone 已发布，执行与 drain 完成或达到安全回收时间，资源预留已释放，cleanupPending=false |

succeeded 不代表最终目标持续健康。observed 超时后健康仍可变为 unknown，而已完成 Operation 不回退为 running。

失败不删除 desired、不自动回滚用户 revision，也不免除 Runtime 清理责任。TCP+UDP 局部执行成功时整体 Operation 不成功，read model 显示每协议状态与 degraded。failed 且 cleanupPending=true 是合法状态；清理任务持久化并在 Worker 重启后继续。清理超过截止应告警/人工介入，不能静默放弃或无界占用任务队列。

retry 仅允许仍为当前 desired revision 的 failed Operation；创建新 Operation、记录重试来源，Forward revision 不变。已被新意图取代的旧 Operation 返回 409 `OPERATION_SUPERSEDED`。Controller 可以继续观察事实和执行清理，但 failed 目标的新主动部署尝试须有新的 Operation，不能无审计地自动恢复成成功。

retry JSON 只接受 `expectedRevision` 一个字段；Operation 详情的 `forwardId` 仍经同一
Scope 授权事务读取。Console 的复制、显式重试与当前页最多 10 条启停计划见
[原生规则管理](native-rule-management-v1.md)：共用原逐条命令，不是跨规则原子 API。

## 4. 连续修改与删除优先

同一 Forward 接受新 revision 时，尚未结束的旧 Operation 事务化标记 superseded，记录 successor。Worker 在 claim、编译和发布快照时检查当前 desired revision 与 claimToken；过期 Worker 不能继续发布旧计划。已运行旧资源只能作为显式过渡实例存在并受租约/drain 限制。

delete 一旦接受，拒绝该 ID 的后续 PUT/retry；不能“取消删除”复活。新建须使用新 ID。清理任务与 successor 有关联，即使创建/更新 Operation 被取代也不能遗失旧资源。旧报告可用于完成已知旧实例的清理，不能让当前 Operation 达到 succeeded。

## 5. 共享事务示意与数据库约束

```ts
await unitOfWork.transaction(async (tx) => {
  const replay = await idempotency.findOrClaim(tx, actor, key, digest);
  if (replay) return authorizeAndReplay(replay);
  await identity.assertGrant(tx, actor, scope, command);
  const current = await forwarding.loadForUpdate(tx, command.forwardId);
  const next = core.decideForwardChange(current, command.expectedRevision, command.change);
  await nodes.assertAllowed(tx, actor, next.spec);
  await runtime.reserveRequiredSlots(tx, next); // Runtime-owned tables
  await forwarding.saveRevision(tx, next);     // Forwarding-owned tables
  const op = await runtime.acceptIntent(tx, next, command.kind);
  await idempotency.saveResponse(tx, actor, key, digest, next, op);
  return { forwardId: next.id, revision: next.revision, operationId: op.id };
});
// Redis wake-up after commit is optional; persisted scanner is mandatory.
```

伪代码表示事务协作，不是实现 API。创建使用新 ID/初始 revision；删除写墓碑，遵守同一边界。授权变更、Profile 解析和节点策略读取需有一致性版本，发布前重新检查，不能把过期授权读结果无限使用。

必须落实为数据库约束/条件写：Forward 当前 revision CAS；revision 历史唯一 `(forwardId,revision)`；预留唯一 `(nodeId,protocol,port)`；fence high-water 不因释放而删除；Snapshot 唯一 `(nodeId,generation)`；当前会话 CAS；报告去重唯一 `(nodeId,sessionEpoch,reportSequence)`；幂等范围唯一。按 nodeId、protocol、port 固定顺序加资源锁，死锁重试有界且复用幂等键。

禁用保持预留；改端口时可暂时持有新旧两个端口。安全释放依据所有曾获授权的相关实例的最大 validUntil 加允许时钟偏差，或当前可信 Agent 的持久 removed/drain-complete 报告；存在未耗尽的旧会话时不能只信新会话报告提前释放。授权、预留、Snapshot 发布由同一 Runtime 协调，已 tombstoned slot 不能被续期任务复活。

## 6. Read model 与用户操作

Scope 内的 [原生 PathTemplate 元数据](native-path-templates-v1.md) 提供独立的
`GET /path-templates[/:id]`、精确 revision 查询、幂等 CAS `PUT /path-templates/:id`
与终态归档 `DELETE /path-templates/:id`。只接受元数据，不返回 Operation 或创建绑定，
不改变本文 Forward/Runtime 命令语义。模板读取不复核 Node/Profile 授权，显式显示
`executionAuthorized:false` / `reserved:false` / `bindingCreated:false`；不能拿它替代原计划和发布。

Node 的有界原生 TLS 状态与相邻期望引用见 [隧道管理只读契约](native-tunnel-management-v1.md)：
同事务 Scope/Node 校验，SELECT-only 元数据，不签发凭据、不证明健康、执行授权或删除安全。

GET 返回 desired `{revision,spec,deleting}`；applied 按 protocol/role 展示 deploymentGeneration、phase、condition、errorCode；health 包含 observedAt、receivedAt、freshUntil，过期 unknown；lastOperation 包含 id/status/cleanupPending。更新失败且旧配置仍获明确授权时，应显示“新配置失败，旧版本仍在运行”，不得仅显示一个绿色 enabled。

每个失败必须给出稳定错误码、是否可重试和下一步操作。最小 UI/CLI 要支持创建、查看 Operation、更新、启停、删除和查看节点授权截止；复杂监控看板可以推迟，基本故障诊断不能推迟到产品化阶段。
