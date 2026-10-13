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


## Profile 使用授权、Node 内部 endpoint 与计划预览

基线 `14ba7db` 的后续切片增加显式 Profile use grants：owner 管理
`/transport-profiles/{id}/grants/{actor}`，以 `{expectedRevision,allowed}` CAS 修改
整组 grant revision。owner 首次发布 Profile 时获显式 grant；升级既有 Profile
为 scope owner 补 grant。仅活跃 manager 可被授予使用，scope 读取不能执行。
同事务记录 grant 变更审计与幂等响应。当前有活动 Relay 意图的 grant 变更会
拒绝，等待撤销协调器接入；不能先收 grant 而继续续发旧授权。

Node endpoint 位于 `/nodes/{node}/relay-endpoint`，owner 提交
`{expectedRevision,config:{listenAddress,advertisedHost,allowedTcpPorts}}`。
监听必须是规范 IP，可达 host 不能是 wildcard，内部 TCP 端口为有界唯一列表。
CAS、规范 no-op、幂等、Node 安全审计同事务提交。当前尚不绑定任何内部 socket；
活动 Relay endpoint 变更在补偿协调器完成前拒绝。

POST `/relay-plan` 接收 Core ForwardSpec，读取真实双端 Node grants/凭据事实、
精确 Profile use grant/revision/digest 和 egress endpoint，检查 ADP/3、
`native.relay.v1`、`relay.wire.1` 与协议能力，再编译独占物理资源。返回
`reserved=false,executionSupported=false`；预览不会持久化 Forward/Operation，
不证明端口已预留或流量可执行。当前实际 Agent 未声明这些能力，因此不会
返回可执行 Relay。纯编译器测试明确将用户 UDP 与内部 TLS TCP 分开，两个
egress protocol 必须使用不同 TCP 端口；最终目标按 egress 策略、peer endpoint
按 ingress 策略检查，Agent 仍须在每次 DNS/IP 拨号后检查。

```sh
npm run control:cli -- profile-grants scope-dev secure-profile
npm run control:cli -- profile-grant scope-dev secure-profile member-id grant-input.json stable-key
npm run control:cli -- node-endpoint scope-dev node-id endpoint-input.json stable-key
npm run control:cli -- node-endpoint-get scope-dev node-id
npm run control:cli -- relay-plan scope-dev forward.json
```

迁移 `0007-relay-authorization.sql` 由 Transport/Nodes 模块分别持有授权与 endpoint，
旧备份恢复清除全部 Profile grants，保留不可变 config，必须重新审阅/授予。
扩展集成 suite 现为 10 项检查；新增单元用例覆盖四个物理资源、精确 capability、
locked revision/摘要、双端目标策略和端口冲突。实际 Relay 认证、ADP/3 wire/state、
prepare/activate、流量与故障出口仍待完成。
