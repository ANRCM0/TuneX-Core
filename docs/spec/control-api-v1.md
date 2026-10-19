# Control API / Operation v1

## 2026-10-18 Controlled Direct Ingress TLS 增量

完整契约：[direct-ingress-tls-probes-v1](direct-ingress-tls-probes-v1.md) /
[ADR-0045](../decisions/0045-direct-ingress-tls-probes.md)。原 POST
`/api/v1/scopes/:scope/forwards/:id/probe-plan` 与 `/probes` 增 kind
`tcp-ingress-tls`，仅此类型额外要求 `service:{serviceId,revision,configRevision,
configDigest}`；revision是当前服务metadata CAS，configRevision为1..64。旧两类
禁止该键，原body/hash不变。TLS预检返回原common字段与明确kind/point/measurement/
capability及full public serviceContext，不预留或授权；原target须精确等于声明endpoint。

TLS接受仍原Idempotency-Key，body为旧六字段加probeVersion3、descriptor四字段和
compact service六字段selection，合计十二键。GET `/probes/:id` TLS outer增加四
descriptor和compact service，不返回DER；旧outer即使result来自v3仍保持原形状。
revoke仍原路由/owner，不扩大撤销保证。result按真实probeVersion1/2/3严格parse；
TLS verified/tls-handshake-verified才有TLSv1.3/固定ALPN/leafFingerprint/verifiedtrue
proof；unverified或unreachable的tls为null，旧两类v3的service/tls均null。
缺报、预算、期限、取消、授权丢失和未知写入不捏造网络失败，不生成新key补发。

execution-capabilities新增 `probeServicesIssuanceEnabled` bool；原ingress/egress
字段不变。有限plan envelope另增 `servicesExecutionEnabled` bool，config仅TLS
加上述service引用；preview带fullcontext，持久plan/decision不复制DER。原32plan/
16decision/一小时/4096head/2048decision界限和原键重放保持，每次重新解析精确当前
服务，不自动迁移latest。Run history状态筛选扩verified/unverified，公开compact
selection/contextDigest和白名单proof；原1024/七天/4096record/loss不变。
原被动 Forward diagnostics 消费者同步按真实v1/v2/v3解析，不改版本计算摘要；每条
公开measurement/point/servicecompact或null，TLS结果带有限proof，但不输出内部DER。
支持包另剥整个service、config/contextDigest和leafFingerprint，仅留固定TLS枚举/verified。
GET仍不查当前服务授权、不执行网络，也不是完整Probe历史。

新独立机器族 `/agent/v3/probe/services/{instance,poll,claim,status,result}` 使用
probeVersion3与明确三类顺序，仍原mTLS/instance/Gate/两秒/256预算/watch；poll response
32768、context16384、其他机器消息及结果4096，无v2失败回退。服务registry所有操作
仍no-network/no-permit；其measurementAvailable改为原TLS发行开关的bool，不是活性。
三重default-off依赖为Control services→ingress→execution及原一秒clock；Agent还需
registration。TLS握手records穿过原TCP规则，计业务payload，不是零流量、外部入口或
应用健康。Schema0036/Control-only Profile不改Agent原两个兼容Profile。本轮源码未
检查/测试/校验脚本/网络/build/CI或Git状态改动，不关闭D1/C3与生产门槛。

## 2026-10-18 Observation Service 声明增量

契约见 [observation-services-v1](observation-services-v1.md) /
[ADR-0044](../decisions/0044-observation-service-authority.md)。新增 manager-only
GET `/api/v1/scopes/:scope/observation-services`（无 query，最多32个含归档 head）、
GET `/:id?revision=1..64`（唯一可选 query，精确不可变 configRevision）、PUT `/:id`
`{expectedRevision,config}`（0新建）及 DELETE `/:id` `{expectedRevision}`（归档），
两写命令均原 Idempotency-Key 和当前 metadata head CAS，不混 configRevision。
HTTP 回执 `{serviceId,revision,configRevision,configDigest,archived,recoverySuspended,
changed}`，changed202/unchanged200；sameconfig 正常 no-op，恢复同配置显式有效再发布
只推进 metadata 并清隔离，变配置同时新增 configRevision，归档永久不可复用 ID。
GET envelope 固定 manager-declared-observation-services/readOnly/executionAuthorizedfalse/
healthunknown/ownershipnot-verified/networkChecknot-performed/measurementAvailable布尔配置，
详情分当前 head、所选历史 revision、public trust、声明 lifecycle 与最多16项owner审计，
list 为 heads，均加 Scope auditEvicted。不是已扩展中央十五源或完整审计；GET不联网。
公有 DER pin 专用 serverAuth-only/exactDNS+scopedURI/非CA，无privatekey/secret字段；
32身份含归档/64修订/256owner审计与2slot观察池/actor冷却有界，无Runtime回退。
该0035首片当时没有新机器测量路由/Permit/Agent TLS client；现0036接线见前节。
注册表仍不是issuer，独立operator responder仍非API进程控制。
源码未验证，无检查/测试/脚本/CI/网络/build/release/Git，不据此关闭D1/C3。

## 2026-10-18 Typed Direct Ingress Probe 增量

[完整契约](direct-ingress-probes-v1.md) / [ADR-0043](../decisions/0043-typed-direct-ingress-probes.md)。
现有 POST `/api/v1/scopes/:scope/forwards/:id/probe-plan` 和 `/probes` 仍采用闭合
version1/kind/expectedRevision/optional timeoutMs，kind 增 tcp-ingress-connect，
不增加用户 target 或另一组 manager 路由。新入口 preflight 在原 common 字段外明确
kind/point/measurement/capability，仍 non-executable。入口 acceptance 原 body 增
probeVersion2 与 measurement/taskKind/point/capability；GET 原短时 probes/:id 增
四个 descriptor 字段（不增 probeVersion），原 revoke 不变。既有 ProbePlan config
允许两 kind，不改 32/16/1h/30sec/7d 等边界；每步重验资格和当前权限。读取 envelope
新增 ingressExecutionEnabled，仅配置、不代表准备就绪或健康；原 execution-capabilities
另加 probeIngressIssuanceEnabled，亦非 Agent 资格或监听就绪证明。旧 egress/hash 语义不变。
机器侧是独立 `/agent/v3/probe/types/instance|poll|claim|status|result` probeVersion2，
资格绑定原 Gate/slotgen，不 mint authority；统一 poll 避免原共享 cooldown 饥饿。
旧 wire v1 不收入口任务，typed 失败不回退。Schema0034 只新增类型/资格来源，原预算/
一次执行/watch/截止与恢复保护不变。所有结果 health unknown，same-Agent local TCP
connect 不是外部/应用/全路径证明；v1 Probe 计数/遥测仍仅 egress。新开关默认关闭、
需原执行/注册/一秒 clock。源码未验证，无本地检查/测试/脚本/CI/网络/Git，D1/C3 未完成。

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

2026-10-18 本地已实现、未验证的独立遥测读模型：
[进程](node-telemetry-v1.md)、[Host](host-telemetry-v1.md)、
[入口 payload](forward-telemetry-v1.md) 与 [Probe 累计](probe-telemetry-v1.md)
保留各自封闭的原始历史接口，不改变本文 Forward/Operation 接受语义。
[分钟/小时聚合与容量](telemetry-rollups-v1.md) 另提供
`GET /nodes/:node/telemetry/aggregates`、`GET /forwards/:id/telemetry/aggregates`
和 Scope 下 `GET /telemetry/capacity`，均位于原 `/api/v1/scopes/:scope` 前缀。
前两者使用必填 family、对齐 UTC 时间窗、精确 series 筛选与有界 keyset 分页；
容量读取不接受 query。它们使用观察池的短 Bearer 认证事务和后续单独的
Scope/目标/投影事务，不占用 Runtime 连接池，也不把历史指标视作当前执行权限。
聚合只折叠启用后新接受的观察，不补扫旧 raw；保留缺口与恢复标记，不产生
健康、计费、完整覆盖或生产容量结论。原始接收、聚合和检查点同事务提交；
拥塞或配额拒收只影响观察，不引入第二执行权威。本地尚未测试或验收。

Scope 内的 [原生 PathTemplate 元数据](native-path-templates-v1.md) 提供独立的
`GET /path-templates[/:id]`、精确 revision 查询、幂等 CAS `PUT /path-templates/:id`
与终态归档 `DELETE /path-templates/:id`。只接受元数据，不返回 Operation 或创建绑定，
不改变本文 Forward/Runtime 命令语义。模板读取不复核 Node/Profile 授权，显式显示
`executionAuthorized:false` / `reserved:false` / `bindingCreated:false`；不能拿它替代原计划和发布。

[路径绑定/显式单规则切换](native-path-bindings-v1.md) 单独提供
`GET /forwards/:id/path-binding`（最多 64 条不可变来源历史）、
`POST /forwards/:id/path-preview`、同事务 `PUT /forwards/:id/path-binding`
与 `GET /path-templates/:id/references`（有界当前引用/精确目标影响）。
命令仅接受固定模板 ID/revision/digest 与原 Forward CAS，展开后仍进入原 owner 更新/Operation/资源链。
展开不变可 200/无 Operation，仅保存来源；新绑定和实际 Forward 更新原子提交，模板发布不自动改变规则。
未知提交只重放原键/原请求，归档/恢复隔离、同监听中断/TCP 排空/UDP 重建边界见独立契约；无新机器协议或 Core 字段。

Node 的有界原生 TLS 状态与相邻期望引用见 [隧道管理只读契约](native-tunnel-management-v1.md)：
同事务 Scope/Node 校验，SELECT-only 元数据，不签发凭据、不证明健康、执行授权或删除安全。

2026-10-18 [有界路径组](path-groups-v1.md) 本地实现、未验证：Scope 下
`GET /path-groups[/:id]`、`GET /path-groups/:id/references` 和幂等 CAS `PUT`/终态
`DELETE /path-groups/:id` 仅维护组元数据，不返回执行 Operation。候选始终是完整的
精确 PathTemplate 修订，而非动态节点集合。`POST /forwards/:id/path-group-preview`
接受 `{expectedRevision,group:{groupId,revision,configDigest,candidateId}}`，不预留资源；
同输入的 `PUT /forwards/:id/path-group-binding` 进入原 ForwardCommands，同事务记录
原 PathBinding 及独立组来源并返回原 Forward 接受字段、`pathBinding`、`pathGroupBinding`。
`GET /forwards/:id/path-group-binding` 读取当前来源和最多 64 条不可变历史。
展开不变可 200/无 Operation，仅附来源；普通路径显式应用会脱离组，拓扑编辑脱离组
而历史不删。无自动选择/故障转移，入口多 Forward 与持久多规则 saga/取消/补偿仍待开发。

后续 C2-B [持久组发布](path-publications-v1.md) 已在本地实现、未验证：
Scope 下 `POST /path-publications/preview` 和带预览摘要的 `POST /path-publications`
冻结一至十条当前源状态/精确候选，后者只建计划。`GET /path-publications[/:id]` 提供
有界持久状态、逐项原回执及精确 Operation 状态；不会自动执行。带原幂等键和批次 CAS
的 `POST /:id/items/:position/apply`、`POST /:id/items/:position/compensate` 每次只接受
一个显式动作，`POST /:id/cancel` 仅停止剩余待执行项。上述三个动作均位于
`/path-publications` 下，不是 Forward 的新独立执行通道。
批次决定的 HTTP 202 可以包含已保存的逐项拒绝；只有其中原 Forward 接受回执才表示
其原 Operation 已接受，仍不等于部署完成或健康。原 owner supplied-Tx 接受、来源、
批次决定和外层原键回执同事务；无第二份 child key 或独立提交。补偿重验完整接受态
和当前旧路径授权，不回放旧 Snapshot。入口组多 Forward 创建及 C3 自动切换仍待开发。

2026-10-18 C2-C 第一片 [入口组/独立创建](ingress-groups-v1.md) 本地实现、未验证：
`GET /ingress-groups[/:id]`、幂等 CAS `PUT /ingress-groups/:id` 和终态 `DELETE`
维护独立版本化入口定义（一至八个完整模板修订、不同入口、相同业务协议）。
`POST /ingress-deployments/preview` 接受精确组选择、显式目标/启用意图和成员/监听列表；
带 `previewDigest` 的 `POST /ingress-deployments` 仅保存持久计划，不创建 Forward。
`GET /ingress-deployments` 支持有界 page/limit 及可选精确 groupId，`GET /:batch`
读取固定计划、逐项决定及最多十六个原 Operation，均不授权执行。
`POST /ingress-deployments/:batch/items/:position/create|compensate` 每次只执行一个
显式命令；body 是批次 `{expectedRevision}`，原键必填。create 由原 owner 分配新 ID，
创建 Forward/Operation/PathBinding 与批次尝试和回执同事务；compensate 用精确完整
接受态守卫请求原 delete Operation，返回 `deleting:true`，不是资源清理完成。
`POST /ingress-deployments/:batch/cancel` 只取消未来创建。未知结果只重放原键/body，
没有后台执行、自动续跑、跨规则原子性或新机器协议。批次/成员/创建回执仅构成历史归因，
不是独立当前入口绑定；已有部署到新组修订的成员 diff/显式迁移仍待开发。

2026-10-18 C2-C 第二片 [显式入口迁移](ingress-migrations-v1.md) 本地实现、未验证：
`POST /ingress-migrations/preview` 接受同组不同精确修订的 `sourceGroup`/`targetGroup`、
至多八个历史直接来源 `sources` 和至多八个显式 `items`。来源是 creation deployment
或 migration 的确切接受/恢复阶段，服务器另复核其完整当前 Forward 状态；不是调用方
上传的原 spec，也不把 origin 当当前成员指针。更新只替换 path/Profile，不改变其他意图。
带 `previewDigest` 的 `POST /ingress-migrations` 仅保存不可变计划；
`GET /ingress-migrations[/:batch]` 提供有界历史状态/精确 Operation 投影，列表可筛 groupId。
`POST /ingress-migrations/:batch/items/:position/apply|compensate` 以原键和批次 CAS 每次
接受一个动作，`POST /ingress-migrations/:batch/cancel` 只停止未来 apply。remove 没有补偿；
add 补偿为条件删除，update 补偿为完整接受态匹配后的授权恢复。批次 HTTP 202 可含脱敏
拒绝，不证明部署或清理完成。没有递归来源、自动续跑、普通编辑 rebase 或全局成员收敛。

GET 返回 desired `{revision,spec,deleting}`；applied 按 protocol/role 展示 deploymentGeneration、phase、condition、errorCode；health 包含 observedAt、receivedAt、freshUntil，过期 unknown；lastOperation 包含 id/status/cleanupPending。更新失败且旧配置仍获明确授权时，应显示“新配置失败，旧版本仍在运行”，不得仅显示一个绿色 enabled。

2026-10-18 [D3-A 诊断](forward-diagnostics-v1.md) 本地实现、未验证：
`GET /api/v1/scopes/:scope/forwards/:id/diagnostics` 不接受任何 query，当前 Scope viewer
可读取七层有界单规则投影、原 Operation 和清理/历史租约窗口。所有代码与 enum 经
白名单映射，未知错误为 `OTHER_ERROR`，不返回任意 persisted error/config/wire JSON。
Node 和每条观察/排空分别保留实际 report 来源；多语句变化不借缓存时间取得 fresh。
`networkCheck:not-performed`、`health:unknown`、`executionAuthorized:false` 和非全局快照
始终明确；GET 不签发 Probe、不拨号、不排队通知。Snapshot digest 仅持久投影，未重算。
响应附同次读取的 `support:{redacted,sameRead,bytes,digest,bundle}`，最多 64 KiB 闭合
白名单脱敏包，原 ID 为本次别名且去掉网络/配置/凭据材料；总响应最多 128 KiB。
缺少独立 observation identity/service adapter 时返回 503，无 Runtime 池回退。旧 API
行为保留；诊断与支持包不是备份、执行授权、全部审计历史或生产通过证明。

2026-10-18 [D3-A2 管理审计查询](audit-events-v1.md) 本地实现、未验证：
`GET /api/v1/scopes/:scope/audit-events` 仅当前 manager，支持闭合的
`from/to/limit/cursor/actorId/nodeId/forwardId/operationId/errorCode/source` 参数。
固定 UTC 半开窗口默认二十四小时、最大三十一天，单页默认二十五/最多五十项；
每来源完整筛选与 keyset 后才截取，再合并返回。每页重新授权，游标不是签名授权、
完整历史或一致快照；原来源保留独立保留期与关联边界，不计算总数。
返回十五类来源的白名单标量、固定覆盖说明、`hasMore/nextCursor`，不返回 raw details、
配置、计划、凭据、请求键或自由异常。批次事件无伪造逐项关联，历史 Node 不从当前
Forward 反推，Operation 最新状态不冒充状态迁移日志，恢复 actor 不冒充旧创建者。
身份短事务及同事务 manager/投影复用独立 observation pool，无 Runtime 回退；没有
审计写入、导出、通知或 Probe。Schema/Agent/Journal 与原命令语义不变。

2026-10-18 [D3-B 站内事件/固定告警](station-alerts-v1.md) 本地实现、未验证：
Scope 下 `GET /station-events[/:id]` 由 viewer 读取持久有界事件，不触发评价；列表接受
闭合 UTC 窗口、精确筛选和 keyset。manager 的 `GET /alert-policies[/:id]`、带原键/CAS
的 `PUT /alert-policies/:id`、`POST /alert-policies/:id/silence` 和
`POST /station-events/:id/acknowledge` 仅维护告警政策、静默或已阅，不更新业务 Forward。
三固定规则、当前管理身份、条件/episode 与事件由独立默认关闭 observer 在观察池处理；
失败不进入 Runtime，缺测不算故障或恢复，换实例 invalidated 不冒充 recovered。
所有响应时间为数字 UTC epochms，区分政策 CAS/configRevision 与事件确认 CAS；静默
不删除条件/历史，确认不修复，未知命令仅原键/body 重放。Schema0029、Control-only
Profile 和恢复挂起不改变 Agent/ADP/Journal。外部 webhook/outbox 尚未实现或验收。

2026-10-18 [D3-B2 受保护通知端点](notification-endpoints-v1.md) 第一片本地实现、未验证：
当前 manager 的 `GET /api/v1/scopes/:scope/notification-endpoints[/:id]` 仅读取非秘密
配置/修订和有界管理审计，不读取 vault，不返回目的 URL、主机名、路径、签名密钥、
不透明引用或秘密摘要。`PUT /notification-endpoints/:id` 要求原键及闭合
`{expectedRevision,config,destination}`，每次接受完整替换和凭据修订推进；同键回放仅
历史回执，不是当前目的地可用性证明。`POST /notification-endpoints/:id/disable`
要求原键和 `{expectedRevision}`，不依赖 vault 配置或读取，已停用为 no-op。
所有端点路由拒绝 query，PUT 至多8192字节，停用至多1024字节；每次重新 manager 授权，
缺少独立观察身份/服务适配器时 fail-closed，无 Runtime 池回退。可选独立 Linux vault
先持久化材料再发布 SQL ref，原恢复事务挂起端点，不自动恢复或补发。当前响应固定
`deliveryAvailable:false`，HTTPS helper 尚未接入服务，没有发送/测试 API 或通知队列。

2026-10-18 D3-B2 第二片独立持久投递已本地接线、未验证，补充只读接口；本段承接并
更新前述第一片的“无队列/未接服务”范围，不把早期结果当作本片验收：

- `GET /api/v1/scopes/:scope/notification-deliveries`：当前 Scope manager 读取有界投递
  列表。只接受 `from/to/limit/cursor/endpointId/eventId/status`；未知或重复 query key
  拒绝。ID 精确匹配，status 仅 `queued/claimed/retry-wait/delivered/dead-letter/cancelled`。
  `from/to` 为规范 UTC ISO 字符串，窗口半开 `[from,to)`；默认最近二十四小时，起点
  不得早于当前时间七天，跨度最多七天，终点不超过配置允许的时钟偏差。limit 默认
  二十五、最大五十，必须规范正整数字符串；不提供 offset、page、COUNT 或 total。
  返回 `window/filters/limit/items/hasMore/nextCursor/losses`，时间字段使用数字 UTC
  epochms。顺序为 createdAt 降序、ID bytewise 降序；全部交集过滤和 keyset 在截取前
  应用，最多读取 limit+1 条。携带 cursor 必须同时提供原固定 from/to，游标绑定
  Scope、窗口、limit 和所有精确筛选；每页重新 manager 授权，游标不是签名权限、
  全局快照或永久去重/完整历史证明。
- `GET /api/v1/scopes/:scope/notification-deliveries/:id`：同样仅当前 manager，拒绝
  任何 query。返回 `delivery`、`attempts:{items,truncated}` 和 `losses`；只在自身
  delivery head 上持共享锁以读取相符的 attempt tail，不锁 Runtime 资源、不写状态。
  明细窗口最多十六条、最多读取十七条 sentinel，按 ordinal 降序；每次投递最多六个
  claim，attemptCount 保留在 head，不因明细淘汰而重置。Scope 的256条 attempt
  容量可能使已记录明细提前缺失，truncated 仅说明本次窗口，不是完整日志证明。

两种响应均含 `notificationDeliveriesVersion:1`、`scopeId/capturedAt/limits` 和
`source:persisted-notification-deliveries`、`readOnly:true`、`executionAuthorized:false`、
`health:unknown`、`networkCheck:not-performed-by-read`、
`consistency:read-committed-not-global-snapshot`。投影只暴露固定事件关联、策略/端点
修订、脱敏事件摘要、状态、claim/fence、尝试数、白名单结果码与 HTTP status；不返回
完整目的 URL、主机名/路径、签名密钥、opaque credential ref、authority digest、
HTTP 响应正文或任意自由异常，不在 GET 读取 vault 或探测目的地。

`losses` 明确区分 `queueRejected/routingRejected/silenceSuppressed/disabledSuppressed/`
`rowsExpired/rowsEvicted/attemptsEvicted`。routingRejected 的单位是路由拒收事件，
queueRejected/silenceSuppressed/disabledSuppressed 是 recipient，其他为相应行数；
不能混算成业务故障或失败率。每 Scope 最多1024条 delivery（含终态），七天只对
终态作追加时的有界清理，容量可更早淘汰终态；没有永久历史或准时 TTL 删除保证。

独立 worker 由默认关闭的 `TUNEX_WEBHOOK_DELIVERY` 显式启用，启用必须具备预置独立
vault，否则启动拒绝。响应 `deliveryEnabled` 只是配置，启用时
`workerState:configured-not-liveness-proof`，关闭时 `workerState:disabled`；不是后台
循环活着、网络已验证、投递成功或生产就绪证明。端点响应的 deliveryAvailable 随该
配置声明，取代第一片固定 false 的范围；同样不是真实可用性证据。

只有新站内事件的同事务 handoff 可建投递，不补扫旧事件；网络发送在独立 worker 的
事务外进行，读取不会启动发送、重试、重新驱动或修复。没有 delivery 的 POST/PUT/
DELETE、手动发送/测试、重试或 replay API。HTTP 2xx 只表示 HTTP 对端接受，不等于
业务成功或 Exactly Once；receiver 仍需用稳定 delivery ID 处理不确定重复。
Bearer 短认证和同事务 manager/读取走独立 observation pool，无 Runtime 回退；
缺适配器为503，读取容量/冷却拒绝为429。Schema0031、Control-only Profile、恢复
取消旧 pending 及独立凭据隔离不改变原 Forward/Operation/Agent/Journal 权威。
本批未执行测试、任何静态检查、脚本、网络、容器或 CI，不据此关闭 D3 或发布门禁。

2026-10-18 [有界 ProbeRun 历史](probe-runs-v1.md) 已本地实现、未验证：
当前 Scope manager 的 `GET /api/v1/scopes/:scope/probe-runs` 只读独立持久历史，
不读取原许可预算、签发任务或修改状态。闭合且不重复的 query 为
`from/to/limit/cursor/forwardId/nodeId/probeId/state/resultStatus`；ID 取原历史精确绑定，
state 为 `issued/consumed/revoked/quarantined`，resultStatus 为
`connected/unreachable/missing`，missing 仅未收到已接受结果，不推导失败。
规范 UTC ISO 毫秒时间输入、默认二十四小时/最多七天半开 issuedAt 窗口；from 不早于
当前七天，to 不超过配置时钟偏差。limit 默认二十五、最多五十，全部交集/keyset 在
SQL 截取前应用，顺序 issuedAt/probeId bytewise 降序。cursor 只绑定 Scope/原固定
窗口/筛选/页长，续页必须显式保留 from/to；不是权限或跨页全局快照，不返回总数。
`GET /api/v1/scopes/:scope/probe-runs/:id` 拒绝 query，返回七天逻辑窗口内的已保留
历史 `run`，旧头可能已淘汰而404；不能据404推断未接受/未执行。
列表返回 `window/filters/limit/items/hasMore/nextCursor/losses`，详情返回 `run/losses`。
共同 envelope 为 `probeRunsVersion:1`、`scopeId/capturedAt/limits`、
`source:persisted-probe-run-history`、`coverage:new-accepted-probes-since-history-enabled`、
`historyComplete:false`、`readOnly:true`、`executionAuthorized:false`、`health:unknown`、
`networkCheck:not-performed-by-read` 与 `consistency:read-committed-not-global-snapshot`。
覆盖描述是新接受任务的捕获边界，不是另有执行开关或完整历史保证。响应时间使用
数字 UTC epochms；`losses` 是 `rowsExpired/rowsEvicted/updatesWithoutHead`，不是执行失败数。
公开摘要保留原完整绑定/实例/创建者/生命周期与已接受结果标量，不返回 fingerprint、
requestId、目标地址、配置或原 wire。`resultDigestVerification` 明确原 digest 是捕获、
不是对省略原正文的重算；`contentDigest` 只标识当前摘要内容，不是签名/来源认证。
`bindingMatchCurrent:not-evaluated`、`historical:true`、`independentProbe:false` 与
`point:agent-direct-egress` 明确观测边界；permitExpired/resultExpired 不构成当前授权或健康。
读取走独立两槽 observation pool 和当前 manager 授权，无 Runtime 回退，缺适配器503，
读容量/冷却429。原已知 ID 的 `/probes/:id` 短期收据和显式单次创建/撤销保持原语义，
历史没有 POST/PUT/DELETE、重试/自动 Probe 或导出路由。Schema0032/Control-only Profile
与恢复 sticky 标记不改变原许可预算/到期清理、Agent/ADP/Journal 或高水位。
本片未运行测试、静态检查、脚本、网络/数据库/浏览器或 CI；D1 与 C3 验收仍未通过。

2026-10-18 [有限持久 ProbePlan](probe-plans-v1.md) 已本地实现、未验证。
当前 manager 可对 `/api/v1/scopes/:scope/probe-plans` 使用：
`POST /preview`（闭合 config 直接作 body）、`POST /`（`{config,previewDigest}`）、
`GET /`、`GET /:id`、`POST /:id/run` 与 `POST /:id/cancel`（`{expectedRevision}`）。
所有写须原 Idempotency-Key；预览不需键且不写配置或签发，所有命令/detail 拒绝 query。
Config 固定 version1/kind tcp-connect/forwardId/expectedForwardRevision/timeoutMs/
mode/intervalSeconds/maxRuns/expiresAt；输入截止是规范 UTC ISO 毫秒，读回是 epochms。
manual 的 intervalSeconds 必须 null；scheduled 为三十至三千六百秒；maxRuns 一至
十六，截止须在未来一秒后且不超过当前一小时，scheduled 首槽须严格早于末端。
预览摘要绑定规范配置及当前 driver configDigest，不是执行授权；创建重复当前预检。
配置不可 PUT、rearm 或自动恢复；只支持现有 Direct TCP/IP-literal/agent-direct-egress。
命令 HTTP body 是 `{planId,revision,state,changed,decision}`；changed 为 true 返回202，
terminal cancel 无变化返回200。run 的 decision 可以是保存的闭合签发拒绝，不表示
网络成功；同键重放不新建 plan/permit。手动仅 active manual、原操作者当前 Node Grant
且创建者仍 current manager；scheduled 使用创建者自己的当前权限，不借用 Service。
列表闭合无重复 query 为 from/to/limit/cursor/forwardId/mode/state；默认24h/最多7d
半开 createdAt 时间窗、limit默认25最多50、createdAt/id bytewise 降序 keyset，cursor
绑定 Scope/固定窗口/筛选/页长，续页须保留规范 ISO from/to，不是权限或全局快照。
共同 envelope 为 probePlansVersion1/scopeId/capturedAt/source persisted-probe-plans/
readOnly true/executionAuthorized false/health unknown/networkCheck not-performed-by-read/
consistency read-committed-not-global-snapshot/historyComplete false/limits，以及仅配置的
executionEnabled/scheduleEnabled/workerState（disabled 或 configured-not-liveness-proof）。
列表增加 window/filters/limit/items/hasMore/nextCursor/losses，详情为 plan/decisions/losses。
三十二计划/Scope、最多十六决策/计划、一小时寿命，acceptedCount 不等于网络成功数；
completed 只是预算耗尽。详情含原绑定和独立 probeId 关联，不拼原许可或 Run 当前状态。
终态惰性七天保留/提前容量淘汰分别披露 rowsExpired/rowsEvicted/decisionsEvicted，
不承诺完整历史。取消只停未来，恢复 sticky/suspend 不重放；独立 worker 默认关闭，
须同时 TUNEX_PROBE_SCHEDULE=1 与原执行开关/一秒 clock policy，未满足在迁移前拒绝。
认证、命令/读取使用原 observation pool，无 Runtime 回退；缺 adapter503、容量冷却429。
Schema0033/Control-only Profile 不改机器协议/Agent/Journal。详细事务、失败、截止与
恢复语义以 ProbePlan 契约为准；本片无检查/测试/脚本/CI 或运行证据，不关闭 D1/C3。

每个失败必须给出稳定错误码、是否可重试和下一步操作。最小 UI/CLI 要支持创建、查看 Operation、更新、启停、删除和查看节点授权截止；复杂监控看板可以推迟，基本故障诊断不能推迟到产品化阶段。
