# TuneX VNext · Verification & Acceptance Matrix v1

**Status: normative acceptance goals; not claims of tests already passed.**

## 1. Evidence tiers

- **U — Unit**: pure Core model, parser and state transition cases (no external infra).
- **I — Integration**: real temporary MySQL and Control API, transactional CAS/leases, worker recovery.
- **P — Protocol**: Agent/Control authenticated contract and malformed/out-of-order traffic tests.
- **N — Network**: genuine TCP and UDP sockets on Linux namespaces/containers/two hosts, client↔target payload/reply assertions.
- **S — Security**: authentication, authorization, replay, lease, fence, target access policy, secure no-downgrade.
- **R — Release**: reproducible builds, SBOM/license review, deployment, backup/restore, rollback, resource/perf envelope and operator documentation.

## 2. Mandatory cases

| ID | Scenario | Minimum tier | Required outcome |
| --- | --- | --- | --- |
| FWD-01 | TCP direct create / data / delete | U,I,N | Echo payload matches, listener removed |
| FWD-02 | UDP direct and reply mapping | U,N | Reply reaches right client; session expires |
| FWD-03 | TCP + UDP same Forward | I,N | Both independent resource slots acquired atomically |
| FWD-04 | Invalid port/target/duplicate protocol | U | Parser rejects |
| FWD-05 | Path cycle / invalid transport combination | U | Core rejects |
| FWD-06 | Unauthorized Node/Profile/reference | I,S | Scope/grant check rejects |
| FWD-07 | Concurrent update expectedRevision | I | Exactly one CAS winner |
| FWD-08 | Concurrent Forward same binding key | I,N | Exactly one active reservation and listener |
| FWD-09 | Disable keeps reservation | I,N | No new accepts; existing drains by policy |
| FWD-10 | Delete + delayed old apply | I,P,S | Tombstone/fence prevents resurrection |
| ADP-01 | Duplicate identical Snapshot | P,N | No second listener / duplicate ownership |
| ADP-02 | Snapshot N after N+1 | P,S | N rejected and cannot regress local config |
| ADP-03 | Incomplete/truncated Snapshot | P,S | No unintended deletion |
| ADP-04 | Persisted high-water crash and reboot | P,N | Stale command rejected post-restart |
| ADP-05 | Foreign-node credentials | P,S | Fetch/report denied |
| ADP-06 | Expired snapshot/lease | P,S | No indefinite unauthorized execution |
| ADP-07 | Observation out of order/stale | I,P | Never overwrites fresh observations |
| OPS-01 | Worker crash after DB commit | I | Work rediscovered with no missing accepted intent |
| OPS-02 | Redis loss and restart | I | Outstanding operation reconstructed from DB |
| OPS-03 | Egress unavailable during prepare | I,N | Ingress not activated prematurely |
| OPS-04 | Multi-Agent activate failure | I,N | Persist partial state + eventual cleanup/recovery |
| OPS-05 | Path switch while TCP streams open | N | Established stream behavior conforms to drain policy |
| OPS-06 | UDP route switch | N | Documented session behavior, never false zero-loss claim |
| SEC-01 | Encrypted requirement unsupported | P,S,N | Reject; no silent plaintext fallback |
| SEC-02 | Target DNS/address policy evasion | I,N,S | Forbidden destinations cannot be dialed |
| SEC-03 | Old owner releases reassigned port | P,N,S | New owner remains bound |
| SEC-04 | Corrupt local cache / clock rollback | P,S | Fail closed according to lease policy |

## 3. Required test evidence

For each case, record commit SHA, platform/kernel, Agent binary SHA, Control API/schema versions, isolated test topology, relevant protocol generation, outcome and logs excluding secrets. Runtime protocol acceptance tests must assert **actual state and traffic**, not just an HTTP 200/202 or ACK. CI status of historical V2 is not evidence of ADP/2 compatibility.

The complete Phase 2 direct milestone requires FWD-01 through FWD-10 (applicable v1 direct), ADP-01 through ADP-07, OPS-01/02 and SEC-02/03/04. Multi-Agent and encrypted cases gate their respective later milestones. Security signoff and production test gates are additional requirements for release.

## 4. Release restrictions

No production-ready claims based solely on source inspection, green unit tests, cross-compilation, localhost mock Agents or unverified benchmark numbers. Before release require Linux real-node validation, upgrade/reset policy, backup and secret rotation rehearsal, network/firewall baseline, capacity limits, failure injection, license review and residual-risk documentation.

The authored [native multi-hop Console flow](native-multihop-console.md) adds real
Chromium/HTTPS Control/MySQL/3,4,8-Agent copy lifecycle wiring to the existing
Actions matrix. It is not an executed result; same-host browser/process tests do
not satisfy independent physical-host, public-network or long-run release gates.



## 5. 契约收口新增用例（ADR-0002 / ADP/2）

以下均为待实现的验收要求；fixture/schema 校验通过不能替代这些运行测试。

| ID | Scenario | Minimum tier | Required outcome |
| --- | --- | --- | --- |
| API-01 | 创建已提交但响应丢失，相同幂等键重试 | I | 相同 Forward/Operation IDs，仅一次预留和意图 |
| API-02 | 相同幂等键、不同输入；并发相同键 | I | 不同输入 409；相同输入最多提交一次 |
| API-03 | update → disable → delete 连续接受 | I,P,N | 旧操作 superseded；旧 Worker/ACK 不能复活；删除后 PUT/retry 拒绝 |
| API-04 | 永久失败、执行期限到期与显式 retry | I | 终态不被迟到报告改写；重试产生新 Operation，保留审计/清理关联 |
| API-05 | 跨模块事务任一步失败 | I | Forward/预留/Operation/幂等记录同成同败，Redis 无关 |
| ADP-08 | 配置不变续期、并发续期、304 | I,P,N | generation 递增、有效期续发；既有监听/连接不重启；304 不延长旧授权 |
| ADP-09 | 相同 generation 不同正文 | P,S | 摘要不一致拒绝；不得覆盖 high-water 或修改数据面 |
| ADP-10 | 新 Hello 后旧 boot 延迟 Report/Hello | I,P,S | 旧会话拒绝；新观测不被覆盖；相同当前 boot 重试幂等 |
| ADP-11 | 同序号重试、同序号异正文、ACK 丢失 | I,P | 持久去重，不重复推进；异正文拒绝 |
| ADP-12 | 租约到期时 TCP 长连接、活跃 UDP、drain | P,N,S | 硬截止关闭全部流量，不能因存量连接无限延长 |
| ADP-13 | Agent 重启，Control 离线/在线 | P,N | 离线不重建 socket；在线新 session/快照后恢复，计数器不归零 |
| ADP-14 | 时钟回滚/跳变、超界偏差、重复等代快照 | P,S | fail closed；重复消息不从当前时间重算租约 |
| ADP-15 | 过大完整快照、Tombstone 高水位增长 | I,P,S | 发布前拒绝超限；不截断/分页/空集合替代；已授权集合不被误删 |
| ADP-16 | TS/Go 共用 Schema 与摘要向量 | U,P | 正反例结论一致；重复 key/不安全整数拒绝；JCS 摘要一致 |
| ADP-17 | 接受快照时磁盘写失败或部分崩溃 | P,N,S | 不先改变不可恢复的数据面；旧流量仅在旧授权内继续 |
| FWD-11 | 同端口换目标，旧流仍打开 | N | 新流使用新目标；旧流按 deadline 排空；旧回调不能关闭新 listener |
| FWD-12 | 改端口，切换中途失败 | I,N | 新旧预留可追踪；补偿使用新版本；不误释放现有 owner |
| FWD-13 | TCP bind 成功、UDP 被外部进程占用 | I,N | TCP 可用、UDP error、整体 degraded；Operation 不得成功，意图不缩减 |
| FWD-14 | UDP 两客户端回包、idle、路由更新 | N | 回包不串流；会话按时回收；更新按约定重置且不虚称零丢包 |
| OPS-07 | 下游只有 prepared 或旧会话 ready | I,P,N | 客户端入口保持未激活；当前实例 active/ready 且新鲜才可推进 |
| OPS-08 | 下游 ready 后立即掉线 | I,N | 激活检查失败不报 ready；激活后故障 degraded/error，恢复有界 |
| OPS-09 | delete 时旧会话离线，新会话报告 removed | I,P,S | 未耗尽旧授权前不提前释放预留或声称删除完成 |
| SEC-05 | 注册 token 双重兑换/过期/错误信任 | I,P,S | 最多一个身份注册成功；不关闭 TLS 校验绕过 |
| SEC-06 | 凭据轮换/撤销及目标策略收回 | I,P,N,S | 不重置计数器；无新非法授权；离线流量在既有硬截止内停止 |
| SEC-07 | Relay 伪造对端/错误 Profile/降级 | P,N,S | 拒绝；认证失败不能借 native 名称退化成无认证通道 |
| REL-01 | MySQL 恢复到比 Agent 更旧的备份 | I,P,N,R | 按停发授权/等待/重新信任注册流程恢复；不清空同身份 high-water |
| REL-02 | Agent 状态目录损坏/重装/重复身份 | P,N,S,R | 旧身份安全退役后才重建；不以 hello 成功证明旧执行已结束 |
| REL-03 | 全节点重连、续期写入和资源压力 | I,N,R | 有界队列/退避/容量拒绝；记录延迟/资源，不能过载时忽略租约 |

## 6. 阶段对应与证据状态

- Phase 0：ADP-16 的 Schema/fixture 与文档一致性；两语言实现尚未存在时只能记录文档结构检查，不能标完整 ADP-16 通过。
- Phase 1：内部 TCP 切片至少覆盖 FWD-01/06/08、API-01/02/05、ADP-05/11、SEC-05 的适用部分；部分通过不代表完整单节点验收。
- Phase 2：第 3 节原 direct 门槛，加 API-01..05、ADP-08..17、FWD-11..14、OPS-09、SEC-05/06。FWD-05 此阶段可验证不支持路径的拒绝；跨节点流量随后验收。
- Phase 3：OPS-03..08、SEC-01/07 和真实 Relay TCP/UDP；OPS-05/06/FWD-14 的换路径部分此时完整执行。
- 发布：所有声明支持能力的验收，以及 REL-01..03 和第 4 节 release gate。未支持的能力明确标 N/A 并写理由，不能把缺失测试当通过。

每条证据记录 `caseId, status(planned/implementing/verified), commit, command, environment, topology, expected, actual, logs`。本次新增 Schema/fixture 是设计证据，不是部署、故障注入或生产验收证据。

当前真实网络隔离切片覆盖 OPS-03/04/07/08 及 ADP-07/10 的 Relay 激活、断链、
旧报告与换路径补偿部分；命令 `npm run test:relay-isolation`。逐项断言、证据位置
和环境限制见 [Relay network isolation](../development/relay-network-isolation.md)。
这些部分通过不等于完整阶段、持续负载或发布门槛全部完成。


## 7. Relay 持续容量与 peer 轮换切片

`npm run test:relay-capacity` 验证两个独立非 root Agent 的真实资源限制、60 秒
加密 TCP/UDP、共享容量拒绝、实际 Control 离线租约硬截止和在线恢复。
`npm run test:relay-rotation` 对 SEC-06/07、ADP-08/13、OPS-05/06 的 peer 更新部分
验证两次自动换钥、持久签发响应重试、更高 generation/fence、旧凭据拒绝、
实际 overlap/有效授权到期后的新流量，以及保留 journal 的在线过期恢复。
这些命令覆盖的适用断言及环境限制见
[Relay capacity](../development/relay-capacity.md) 和
[Relay rotation](../development/relay-rotation.md)。证据的实际 commit/dirty 字段
决定被测版本；短期限的有效执行授权不等于已演练生产叶证书完整生命周期。
完整发布矩阵与远程 CI 结果仍需独立核验。

## 8. 不可变路径元数据首片

[PathTemplate v1](../spec/native-path-templates-v1.md) 的端口回归、真实 MySQL/API 并发 CAS/配额、
终态归档、SELECT-only 全库摘要不变及 Console 回归已编写，接入原 contracts/phase1 作业。
现有 [3/4/8 Agent Chromium](native-multihop-console.md) 延伸模板元数据表单、真实提交后丢响应/原键重放、
无变化、新修订和历史归档，并独立复查源规则、资源和实际 TCP/UDP 不变。
迁移 0018/Control-only Profile/部分 DDL 拒绝有升级评估回归；Agent/Core/Journal 不变。
以上待 exact-SHA Actions，不是已经执行的证据；该首片后续的绑定/切换见下一节。

## 9. 原 Forward 同事务路径绑定与显式单规则切换

[路径绑定 v1](../spec/native-path-bindings-v1.md) 的 9 组端口、9 组 Console 回归、
真实 MySQL/API 同事务 CAS 竞态/绑定配额/失败后完整回滚/SELECT-only 历史与影响，以及
0019 Control-only 兼容读者/部分 DDL 拒绝已编写并接入原 contracts/phase1/升级作业。
既有 [3/4/8 Agent Chromium](native-multihop-console.md) 增加原路径无部署绑定、模板发布不自动应用、
真实两节点缩短路径、已提交丢回执后原键重放、实际 TCP/UDP、新 CAS/Operation 显式切回原路径、
不可变来源历史和归档不撤销展开规则，再用返回的当前 CAS 完成原停用/删除/安全资源清理。
来源不取代原 Forward/Runtime 授权；没有新 Core/Agent/机器协议/Journal。
本机仅静态检查，所有新功能/数据库/浏览器/网络断言未执行，无本批 exact-SHA Actions。
多规则路径发布、切换中断时间/UDP 损失测量、C1 冻结源码验收及遥测/运维交付仍待后续；
同宿主真实进程不能替代物理多主机、公网/NAT 或长周期门槛。
