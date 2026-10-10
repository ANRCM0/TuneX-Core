# V2 转发运行边界

Forward 是业务规则，Node 是执行资源，Path 是直连/中继，Transport 是节点间传输。客户端 TLS/WS 前端独立于节点间加密。Link 为同 Workspace、固定入口/出口的安全资源，自动规则默认复用 auto_forward Link；手工 Link 仅显式选择。

| 组合 | 本轮行为 | 默认门禁 |
| --- | --- | --- |
| direct × native_plain × TCP/UDP | 入口直接连接目标 | 节点能力、策略与权限 |
| relay × native_plain × TCP/UDP | 原生自有双节点普通中继 | 同上；节点间不保证加密 |
| direct/单跳 relay × native_plain × both | 同号 TCP+UDP、共享预算 | FORWARD_NATIVE_BOTH_ENABLED=false |
| relay × tst_v1 × TCP/UDP/both | TLS 1.3/mTLS、共享载体、多路复用 | TUNEX_TST_ENABLED=false |

TST 不支持跨 Workspace、多跳、QUIC、旧协议互通、PROXY 来源和多目标；提交不支持字段明确拒绝。旧历史字段的存在不代表其运行支持。

## 权限与状态

业务操作检查 forward:read/create/update/delete 和实际规则归属。使用获授权 Workspace 节点需要 node:use；自动托管 Link 不要求普通成员具有 node:manage。手工资源维护、载体配置及密钥操作仍检查管理员权限。操作按 actor + Workspace + 幂等键唯一；同键不同规范请求冲突。HTTP 202 仅表示接受，不能冒充运行成功。

状态分别展示 desired、deployment、runtime、target_health 和 traffic。没有目标探测时为 unverified；缺失/过时报告保持 unknown/stale，不将 Ready 当可达。列表/详情/操作回执不包含 PEM、私钥、封存材料或完整 placement。

## 所有者、租约和共享更新

原生规则使用现有修订/rollout；Link 绑定从原生恢复和部署中排除。TST 配置由 Controller 提交不可变合并快照，出口先准备、入口再应用。应用命令检查节点、Workspace、Link、摘要、generation 与 lease。删除保留持久墓碑；迟到/回滚配置不能复活监听。

TLS 握手认证对端 URI 与角色，OPEN 只携带 Forward ID、revision 和协议。出口只拨本地已授权目标，认证连接不能指定任意目标。证书与租约分别到期断连，缓存只在对应授权有效期内恢复。权威空快照移除过时资源，损坏/身份不符缓存拒绝恢复。

添加、修改、暂停、恢复、删除 A 只撤销 A 的会话，B 尽量保持；目标/策略/监听变更会中断受影响规则。端点、密钥或协议改变可能中断整个 Link，无在线无损迁移承诺。暂停仍计引用。删除最后引用后进入延迟回收，确认入口和出口停止后才释放载体租约；失败清理保持占用以待 reconcile。

NodePortLease 与实际 Agent 守卫同时检查 node、协议、bind scope 和端口。TCP/UDP 可同号；both 原子获取两类，绑定失败完整撤销。确认停止后才释放监听，不能只凭 ACK 推测系统端口已空闲。

## 资源与用量

每载体最多 256 streams，流窗口 256 KiB、连接窗口 4 MiB；DATA 最多 16 KiB、UDP 65507 bytes、每 association 最多 64 个排队包，溢出仅 RESET 本关联。每 placement 握手突发 8 次、每秒补充 4 次预算，失败认证也消耗预算；最多 8 个并发握手，每次 5 秒，4 个已认证载体和 256 个执行流。TST 连接/每 IP 配置上限 4096，不能提升 placement 上限；双向速率按规则限制。控制帧队列有界、公平调度防止单条规则无限占用。

UDP association 按来源映射，任一方向有活动就更新共享闲置截止，双向静默 60 秒回收；入口每关联 4 包队列满则丢弃多余包。UDP 经 TLS/TCP 承载，有队头阻塞，不等同于 QUIC。重复/乱序应用序列、非法帧和超额窗口 fail closed。详细规范见 tst-v1.md。

入口按 Forward 和 Asia/Shanghai 日累计业务 payload，双向限速/并发在两种协议共享。加密 spool 使用 producer/规则/日身份，后端 checkpoint 事务增量接收，重复回执不重复入账；完整确认后回收已封存样本。崩溃前未持久化窗口可能丢量，不宣称精确金融计费。缺统计不显示虚构零值。

Agent 的 private state 需持久化，并保留 machine.key、generation fences 和未确认 traffic。Linux 权限 0700/0600；Windows 使用受保护 ACL，但完整平台发布仍需独立验收。
