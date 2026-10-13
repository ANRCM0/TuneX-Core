# Phase 3：Relay 前置契约与不可变 Transport Profile

状态：implementing。基线 `7c4037b`。本切片实现契约和 Profile 管理，Relay 数据面
尚未开放；ADP/2 Agent 继续只声明 direct，创建跨节点 Forward 明确拒绝。

[ADR-0003](../decisions/0003-native-relay-tls13.md) 冻结 TLS 1.3 双端身份、独立
Relay 证书用途、精确部署绑定、TCP 半关闭帧、UDP association/大小边界和资源
独占。内部 egress UDP 传输实际上占用 TCP TLS 端口，资源角色变化会用 ADP/3
切换，不能在 direct ADP/2 中偷偷新增不完整 listener 角色。

Profile 结构由 [Schema](../protocol/schemas/native-relay-v1.schema.json) 严格校验。
security 只能是 `mutual-tls13`，驱动是 `native.relay.v1`；明确握手/idle 上界、
帧/UDP 最大大小和 Node 连接预算。未知字段、重复协议、反序 protocols、
maxUdpDatagramBytes 超过 maxFrameBytes、非法整数都拒绝。
同一 Schema 生成 Go 类型/嵌入 Schema，TS/Go 运行共享 [18 组样例](../protocol/fixtures/native-relay-v1.json)。
这些样例是解析契约证据，不是对端认证或真实 Relay 网络证据。

## Profile API 和 CLI

- GET `/api/v1/scopes/{scope}/transport-profiles`：scope 成员查询列表。
- GET `/api/v1/scopes/{scope}/transport-profiles/{id}?revision=N`：查询指定不可变
  revision，省略 revision 读取 current；返回 configDigest、createdBy/At 和
  `executionSupported=false`。读取权限不代表执行授权。
- PUT 同一路径：owner 发布 `{expectedRevision,config}`，要求稳定 Idempotency-Key。
  首次 expectedRevision=0 创建 revision 1；修改 CAS 单一赢家；规范 no-op 保持
  revision 并返回 200，新 revision 返回 202。旧记录没有 UPDATE 路径。

```sh
npm run control:cli -- profiles scope-dev
npm run control:cli -- profile scope-dev secure-profile profile-input.json stable-profile-key
npm run control:cli -- profile-get scope-dev secure-profile 1
npm run test:transport
```

Transport 拥有 `transport_profiles`、`transport_profile_revisions`，迁移为
`0006-transport-profiles.sql`。owner 授权、CAS、revision insert 和幂等响应共享
MySQL UnitOfWork。发布新 revision 不变更 Forward 意图，不推进任何 Agent。
scope 外读取 404；manager/viewer 不能发布。恢复后的账号仍受既有凭据轮换与
幂等历史隔离规则约束，旧 Profile 只作为待审阅的意图材料。

真实 MySQL/HTTPS 验收的 7 项检查覆盖创建重放/异输入冲突、并发 CAS/旧 revision、
owner/scope 隔离、安全配置拒绝、后段失败整事务回滚、CLI/capability 拒绝和
Control 重启持久化与存储摘要篡改拒绝。证据为 `.artifacts/transport/run-*/evidence.json`；本地
Windows Node 24.14.1/MySQL 8.4.9，CI 配置原生 Linux Gate，不计未运行结果。

## 下一切片

实现 Profile use grants、Node 内部 endpoint、ADP/3 Assignment/physical resource/
Tombstone 与 capability 协商，随后同步 TS/Go/state journal 与 Controller。
完成负面身份测试和下游 active probe 后，才实现/开放双 Agent TCP/UDP 数据面。
路径切换、历史会话资源回收、凭据轮换、下游故障、UDP 行为及安全审阅都有
独立验收要求。Phase 2 的未完成矩阵/预算/环境门槛仍保留，不因进入前置设计而
自动标为 verified。
