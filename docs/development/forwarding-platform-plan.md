# TuneX 转发平台四主线适配方案

四层地基优先级（2026-10-18）：用户已确认先按
[ADR-0048](../decisions/0048-foundation-layer-boundaries.md) 收口严格地基，
[DoD 与并行门禁](foundation-readiness.md) 仍未通过。以下产品主线排期继续保留，
不因有端口或扩展示例源码就提前并行开发功能；当前仅首批源码拆分、未集中验收。

日期：2026-10-16（Asia/Shanghai）。
状态：**Proposed / 分批实施方案**。四条产品主线来自本轮需求；本文不等同于
已接受的新协议 ADR，不将计划中的 API、表或驱动标记为已实现。

开发节奏更新（2026-10-18）：按用户要求先集中开发，后集中测试和修复。
开发期间不运行或追跑测试，不逐项修复 CI 失败，也不为每个功能切片扩展验收脚本；
测试、夹具、静态检查和证据缺口留到源码冻结后统一处理。
具体约定以 [当前开发节奏](next-milestones.md#当前开发节奏2026-10-18-起) 为准。
此调整不取消授权、安全边界、已有测试或正式发布门禁；未验证实现不记为通过。

框架收口更新（2026-10-18）：用户确认
[隧道与转发管理框架](../architecture/project-framework-and-boundaries.md) 作为后续增量方向。
首批 [逻辑隧道入口](../spec/logical-tunnel-management-v1.md) 已在本地实现、未验证：
复用原路径模板身份/修订、绑定与 Forward 接受，增加统一 API、只读拓扑及精确修订
载入绑定面板。没有新增物理共享、独立 Tunnel 实体或执行器。以下四主线继续作为
能力排期，不能将原生入口收口等同于 B/C/D 全部完成。

基础框架更新（2026-10-18）：
[分类接入框架 v1](../architecture/framework-integration-v1.md) 已完成本轮源码收口，
以现有原生能力接通分类端口、契约入口与宿主生命周期，尚未集中验证。
后续按接入步骤增加模块和显式装配；既有审计/支持包、产品功能及生产验收责任保留。

源码基线：TuneX `03513a941177afcb84a5a1e6eab025c830d63300`；
ForwardX `v2.3.284` / `11487874b133cdb7ad54a0f9071601092f5d9060`。
本轮通过 GitHub API 核对上游版本，并在该固定提交读取功能文档及状态处理源码。
代码存在、Actions 通过、物理主机验收和正式发布分别记账，不相互替代。

## 1. 目标、范围与参考方法

后续产品围绕四条主线：**基础转发、加密隧道、拓扑与切换、监控与探测**。
目标闭环是“配置规则 → 安全部署 → 真实观察 → 定位故障 → 受控切换 → 可审计恢复”。
暂不扩展计费、支付、工单、移动端、AI、任意可执行插件或通用 VPN 产品。

“迁移适配”指业务概念、用户流程、状态语义与验收场景的适配和独立实现，
不是上游源码移植，不兼容 FXP 私有线协议，也不自动导入 ForwardX 或旧 V2 数据库。
沿用 [经验吸收计划](forwardx-gap-closure.md) 的不复制源码/资产约束及
[历史来源记录](../../legal/NOTICE.md)，不从重写推导既有分发义务已经消失。

固定版本参考入口：

- [转发链](https://github.com/poouo/Forwardx/blob/11487874b133cdb7ad54a0f9071601092f5d9060/docs/guide/port-chains.md)：有序节点、链路复用、分段诊断。
- [隧道](https://github.com/poouo/Forwardx/blob/11487874b133cdb7ad54a0f9071601092f5d9060/docs/guide/tunnels.md)：承载与业务协议分离、组与分支、能力约束表单。
- [流量与延迟](https://github.com/poouo/Forwardx/blob/11487874b133cdb7ad54a0f9071601092f5d9060/docs/guide/traffic-latency.md)：指标口径、累计计数、缺测与历史窗口。
- [拓扑标识](https://github.com/poouo/Forwardx/blob/11487874b133cdb7ad54a0f9071601092f5d9060/server/probeTopology.ts)：拓扑变化后隔离旧探测。
- [探测计数上报](https://github.com/poouo/Forwardx/blob/11487874b133cdb7ad54a0f9071601092f5d9060/server/agentProbeCounterReportGate.ts)：去重、采样与累计次数分离。

这些是需求参考而不是直接执行的规范；TuneX 的授权、硬租约和状态所有权优先。
不直接采用上游所有健康聚合公式，也不把分段延迟之和视作真实业务端到端延迟。

## 2. 基线与功能映射

| 主线 | TuneX 已有 | 参考的产品逻辑 | 适配后的交付 |
| --- | --- | --- | --- |
| 基础转发 | 原生 TCP/UDP Direct；CAS、启停删重试、端口仲裁 | 按能力配置、规则状态与日常管理 | 统一能力描述、预检、错误定位、批量受控操作；以后单独评估 NAT/外部引擎 |
| 加密隧道 | TLS 1.3 Relay；默认关闭的固定 3–8 Node 多跳 | 隧道资源、承载与业务协议区分、共享配置 | 原生 Profile/Endpoint 产品化；版本锁定；随后评估独立 WireGuard 承载 |
| 拓扑与切换 | 固定路径编译、阶段协调、部分切换/故障验收 | 保存链、复用、入口/出口组、备用路径 | 路径模板与显式发布、手动切换、组管理，独立探测就绪后再做自动故障转移 |
| 监控与探测 | 部署/监听/租约/操作观察及节点诊断 | 分段测试、独立健康、历史与流量口径 | 有界 Probe、指标与历史、诊断视图、基础告警，不进入转发正确性热路径 |

已有多跳不是待从零开发的功能；已有 Relay 切换用例也不是通用路由策略已经交付。
现有轻量 Web 测试不等同真实浏览器验收。已有进程资源采样不是完整主机监控。
具体证据仍查 [实施进度](progress.md)、[多跳交付台账](multihop-delivery.md)
及 exact-SHA Actions，不继承旧文档中的“待运行”或历史成功作为新版本结论。

## 3. 架构与状态所有权

```text
Console / CLI
    |
Hono API / Application
    |-- Forwarding -------- Forward intent / revision
    |-- Transport --------- immutable Profile / driver descriptors
    |-- Topology (new) ---- PathTemplate / Group / bindings
    |-- Routing (new) ----- policy / candidate / switch proposal
    |-- Observability ---- Probe / metrics / history / alerts
    |
existing Runtime ---------- Operation / Snapshot / lease / reservations
    |
ADP/3 + explicitly negotiated extensions
    |
Go Agent ----------------- native engines / bounded drivers / Probe executor
```

### 3.1 不变量

- Pure Core 保持最小 Forward 模型，不引入数据库、探测、图表、第三方程序或策略调度。
- Forwarding 拥有意图，Runtime 独占执行台账和 Agent Assignment。
  Routing 只能提案，不直接发 Agent 命令或写端口、租约、Snapshot。
- MySQL 是权威；不新增必选 Redis、消息代理或时序数据库。事件推送只用于加速，
  丢失后仍能从持久状态对账，关闭监控和自动路由不破坏已有 Direct 运行。
- 沿用 Scope Membership、显式 Node/Profile Grant、目标策略、mTLS、
  Session/Generation/Fence、受保护 Journal 和授权硬截止。
- Desired、Deployment、Applied、Listener、Probe、Authorization 分开展示。
  没有新鲜 Probe 就显示 unknown/stale，不把 Agent 在线作为业务健康。
- 物理承载端口按真实协议占用：例如承载 UDP 业务的 TLS listener 仍占 TCP，
  不为逻辑业务协议虚构第二个物理监听。

### 3.2 版本策略

当前严格 parser 拒绝未知字段，不能向旧 ADP/3 消息偷偷追加 telemetry、Probe 或新驱动。
新增能力分别设计版本化 schema、capability、TypeScript/Go 类型、负面 fixture 和升级矩阵；
选择独立机器端点或显式协商扩展须通过 ADR。
旧 Agent 显示 unsupported，不接收不能理解的任务，不静默回退明文或旧驱动。
新增数据库迁移必须同步只读升级评估器的兼容上限，不能只增加 SQL 文件。

## 4. 主线 A：基础转发

### A1. 统一原生能力与管理流程

先为现有三个 native driver 建静态版本化描述，不先引入动态加载：
`id/revision/platforms/roles/businessProtocols/carrierProtocols/schemaId`、
`requiredCapabilities/privileges/limits/prepare/drain/probe/usageSupport`。
声明、Agent 实测能力、当前策略分别保存；“支持”不代表“已授权/端口空闲/当前可部署”。

Console 和预检消费同一公开能力视图，后端独立校验。提供：
规则创建/编辑/复制、明确冲突原因、操作阶段、按节点/协议/状态检索。
批量启停首先返回逐项 Operation 和失败结果，不声称跨规则原子事务。
模板/批量请求不绕过幂等、CAS、限额和每条规则的资源预留。

当前 Direct 禁止 Transport Profile；不能为选择引擎偷偷放宽 Core parser。
未来可选 Direct driver 的版本锁定和执行选择由独立 ADR 设计，
在 Application/Runtime 中表达并纳入配置摘要，不塞入自由格式 Core JSON。

### A2. 后续引擎的准入

优先级建议为原生稳定化 → 按需评估 Linux nftables → 再按实测缺口评估
GOST/Realm；iptables、socat、Nginx 不在首轮同时引入。
候选不是已承诺支持；外部组件需单独锁定版本、来源、许可证、校验值及 SBOM。

新引擎必须证明：有界资源、独占所有权、准备/激活/排空、统计来源、
失败清理、Agent 崩溃和失联后仍按授权截止停止。
特别是内核 NAT 规则不会随 Agent 退出自动消失；
未实现并实测独立到期保障前，不允许作为受控驱动上线。
额外 root/capability 需求隔离到专用适配器，不抬高全部 native Agent 的权限。
外部程序使用固定 executable/参数和受限配置，不接受 shell 模板或任意命令。

## 5. 主线 B：加密隧道

### B1. 先把原生 TLS 隧道做成可管理产品

完善 Profile revision、Endpoint、证书状态、相邻节点与路径预览、
失败阶段和引用规则查询。显示“业务 TCP/UDP”与“隧道承载”两套能力。
Profile 为不可变修订；发布新修订不自动替换所有规则，提供影响预览、
逐条授权校验和显式批次发布。

本阶段“复用”指配置与路径模板复用，不宣称多个 Forward 已共享物理隧道。
物理 Link/连接池另立 ADR，明确引用计数、每 Forward 授权截止、
相同 Scope/身份/安全上下文约束、最后引用退出与崩溃回收。
删除一个 Forward 不能断开其他 Forward，也不能因共享连接让已撤权业务继续转发。

### B2. 增量承载路线

第一候选是独立 userspace WireGuard 承载，目的是补充 UDP 外层选择，
不是兼容 FXP，也不是开放任意系统路由或完整 VPN。
先做双节点受限试验；通过密钥/peer 生命周期、AllowedIPs、MTU、
NAT/keepalive、资源占用、重连和硬截止验收后，再决定是否进入正式驱动。
复用库须独立评审；不自行重新实现密码协议。

GOST 仅按已证明满足租约与认证契约的安全模式逐项接入，不暴露所有模式开关。
QUIC、逐跳混合承载、UDP 混淆、透明代理延后；现有多跳仍使用一致 native 契约。
这些候选不阻塞已有 TLS 功能发布，但也不能绕过新驱动自己的发布门禁。

## 6. 主线 C：拓扑与切换

### C1. 保存路径、预览与手动切换

2026-10-17 首片实现见 [路径模板元数据 v1](../spec/native-path-templates-v1.md) / [ADR-0023](../decisions/0023-immutable-native-path-metadata.md)：
独立元数据命令、不可变修订、精确 Endpoint/Profile、原授权、配额/CAS/幂等、归档与 Console 已编写；
功能/MySQL/浏览器 Actions 已接线未执行。随后按
[ADR-0024](../decisions/0024-original-owner-path-bindings.md) 实现
[精确绑定、有界当前引用/历史与显式单规则切换](../spec/native-path-bindings-v1.md)：
模板展开与原 Forward CAS/原执行准备/资源/Operation/来源记录同事务提交，展开不变可只绑定不重启。
普通拓扑变化解除当前来源指针并留历史，模板发布/归档不隐式改规则；Console 逐条显式确认原预检/命令。
新增迁移 0019 与独立 Control-only 兼容 Profile；本批仅静态检查，无 exact-SHA Actions。
随后按 [ADR-0025](../decisions/0025-explicit-path-batches.md) 补
[有界多规则显式路径发布](../spec/path-publication-v1.md)：当前影响页最多十条固定目标/配置/CAS，
复用原队列逐条重查路径提案和原 Relay 计划，再独立提交原绑定命令；未知写入仅同键重放，不重查替换或自动继续尾部。
新增队列/选择回归和同一 3/4/8 Agent 浏览器部分失败/真实切换/丢回执重放接线，仍仅静态检查。
**C1 仍未验收完成**：冻结源码 exact-SHA Actions 和组合复核待执行；切换中断时长/UDP 损失未实测。

新增应用层 `PathTemplate` 及不可变 revision：有序 Node、Endpoint/Profile 引用、
能力要求、摘要；规则绑定明确的模板 revision，同时保存展开后的实际 ForwardSpec。
模板修改不隐式改变正在运行的规则；提供引用列表、影响分析和逐条发布。
模板复用不是物理端口共享；每条规则依旧独立获得运行资源。

预览不预留资源、不授予执行权；提交时重新检查全部节点/目标/授权、
版本和端口。手动切换先沿用现有 Forward replace + expectedRevision：
新路径作为新 revision 进入同一个 Runtime，不建立另一套部署通道。

切换保留可用旧实例直至有界排空或授权截止，不能延长已撤销授权。
相同入口物理监听无法并行预备时允许明确的中断窗口，预览/结果中如实报告；
不将 tail-to-head 协调宣传为跨主机原子切换或零停机。
TCP 老连接按 drain 边界处理，UDP 允许重建关联并记录丢包，不承诺会话无损迁移。
失败补偿须复核旧路径仍获授权；回切也创建新 revision/generation/fence，
不能直接重放历史 Snapshot。

### C2. 组与备用路径

2026-10-18 C2-A 已本地编写、未验证：[组契约](../spec/path-groups-v1.md) 提供
出口候选组/固定备用完整路径的不可变元数据、精确候选预览与单规则显式应用。
每组一至八个完整模板修订，不做节点集合笛卡尔展开；当前只支持相同入口和业务协议。
绑定与组来源在原 Forward/CAS/幂等/Runtime 事务提交，修订发布不自动更新已绑定规则。
健康表达为 OR 完整替代分支、AND 必经节点，当前只显示 unknown。Console 单规则未知
写入只允许同键同请求重放，不进行自动选择。入口批量部署、持久 saga、取消及条件补偿
仍待开发，本片不代表完整 C2，也不满足 C3 前置验收；未测试/检查/新增验收工具或 CI。

2026-10-18 C2-B [持久组发布](../spec/path-publications-v1.md) 进一步本地实现、未验证：
最多十条精确源 Forward/CAS/spec/来源序号与目标候选，经预览摘要确认后保存计划。
每项独立、显式推进原 Forward 接受，与尝试/审计/幂等回执同事务；允许名单内的域拒绝
先回滚保存点，不把未知提交伪装成失败。取消只停止待执行项，条件补偿重新授权并比较
完整接受后的 Forward 与来源指针；实际回切创建新原生接受，元数据撤回不虚增 Operation。
Console 不自动轮询、派发尾部或恢复批次；旧内存队列不等同持久 saga。入口组的多 Forward
创建/来源原子绑定仍待下一片，C3 验收前置不变；当前仍不运行检查、测试、夹具或 CI。

2026-10-18 C2-C 第一片 [入口定义/独立创建](../spec/ingress-groups-v1.md) 已本地编写、未验证：
独立有界入口定义保存一至八条完整锁版模板，入口互异、协议相同；每个明确选择成员只
展开一条完整规则。逐项填写监听、共享目标/启用意图，预览不预留资源或分配 Forward ID。
确认只建持久计划，每次手动一步才由原 owner 创建独立 Forward/Operation，并与精确
路径来源、批次历史归因/尝试及外层原键回执同事务。取消未来项，完整状态守卫的条件
补偿只请求原删除，不清历史或提前释放。0027、兼容/恢复和 Console 均为源码未验证。
来源是历史创建记录，不是当前入口成员指针；没有 VIP、DNS、入口 HA 或物理共享。
已有入口部署到新组修订的成员差异/影响分析与显式增改删迁移仍待后续，不用重复创建
代替。C2/C3 验收、D2 容量和物理/发布门禁尚未通过，开发期间仍不运行检查/测试/CI。

随后 C2-C 第二片 [已有入口显式迁移](../spec/ingress-migrations-v1.md) 已本地编写、未验证：
精确源/目标修订全成员差异与所选历史来源分开呈现，当前完整 Forward/来源基线由原
owner 同事务锁定复核。最多八个来源、八个显式总操作，经预览摘要确认后仅保存计划。
逐项 add 新建、update 仅改 path/Profile、remove 原删除，入口或业务意图替换明确
remove+add；不会根据十六行并集差异自动派发。add/update 各有受完整状态/授权约束的
条件补偿，remove 不可补偿，已删规则不能复活。没有当前组成员指针、递归来源、
自动 rebase 或全局原子收敛；0028/恢复/Console 仍需冻结后的集中验证，不声称 C2 验收完成。

先交付出口候选组和固定优先级备用路径，每次解析成单一具体路径。
入口组首版是受控批量部署到多个入口，每入口仍是独立 Forward/Operation；
不自动提供公网 VIP、DNS 切流或全局入口高可用。
组修改与路径一样采用修订、预览和显式应用，限制成员数和展开规则数。

跨多条规则的组切换是有审计的 saga：逐项成功/失败、可取消和有条件补偿，
不是一个全局原子 Operation。不要生成无限组合路径或让候选组导致端口爆炸。

### C3. 最后交付自动故障转移

前置条件：C1/C2 及独立 Probe/持久历史已完成验收。
首版只做“明确故障 → 授权内的固定备用路径”，不做延迟竞价、动态最短路或负载均衡。
策略保存优先路径，与当前实际展开路径分离；支持关闭、人工固定、维护期和预演。

状态机：`observing → suspect → switch-pending → switching → cooldown`；
故障连续次数、最小样本、新鲜度、恢复窗口、冷却期、切换预算均显式配置。
试验默认值可从 30 秒探测、连续 3 次有效失败、120 秒冷却开始，
这些只是待验收参数，不是可用性 SLO。缺测/stale 本身不算目标故障；
节点失联作为单独证据判断，不把失联推导为所有下游目标都坏了。

每次切换由受限自动化身份执行，必须有明确授权；原用户撤权不能被服务身份绕过。
提案带策略 revision、观测水位和 expected Forward revision；
最终接受时重新查 Membership、Node/Profile Grant、目标策略和资源，
不改变用户意图的自动切换保留 Forward revision，由 Routing 提供 `ResolvedPath`，
经 Runtime 的版本化接受端口创建持久 Operation 并推进 deploymentGeneration；
该接入端口尚未实现，须先按原规范评审 ADR，不能直接套用现有 Forward replace。
用户手动修改固定路径仍走 Forwarding CAS，生成新的 Forward revision。
人工编辑使旧提案失效；同一 Forward 同时仅允许一个有效切换提案。
首版不自动抢回首选路径，恢复后通知并由操作者确认，降低反复抖动。

## 7. 主线 D：监控与探测

### D1. Probe 先于自动路由

2026-10-18 后续 [真实 Direct 入口 TLS](../spec/direct-ingress-tls-probes-v1.md) /
[ADR-0045](../decisions/0045-direct-ingress-tls-probes.md) 已本地源码接线、未验证。
原Probe owner经当前原listener和TCP Forward抵达精确受控target，按当前服务metadata
CAS/config revision/digest、专用publicpin/SNI/scopedURI/ALPN/有效期验证握手。
服务resolver每阶段只读复核原权限/策略/时间，不mint许可、不借业务Relay密钥；原
Gate/256/两秒/单次watch/报告/有限计划仍唯一。probeVersion3显式强化原slot且不续期，
无v2失败回退；fullcontext只offer/permit，结果/history只compactselection+TLSproof。
旧两kind/hash不扩义，v1telemetry仍egress-only。TLSrecords计实际业务payload和下游
拨号，不等于零流量、外部入口或应用健康。registryavailability现为发行配置bool，
本身仍不联网/签发/证明ownership；下方0035未有client只描述当时首片范围。
无检查/测试/脚本/fixtures/网络/build/CI/Git，集中与物理/生产验收待后续；相邻TLS、
外部观测、受控TCP/UDP nonceecho、Relay/多跳Probe和健康聚合仍未交付，不启动C3。

2026-10-18 新增 [观测服务声明首片](../spec/observation-services-v1.md) /
[ADR-0044](../decisions/0044-observation-service-authority.md)，**本地实现、未验证**。
独立 manager 声明数字 endpoint 与专用公有 TLS 叶 pin，保存不可变修订/摘要及当前
metadata CAS、归档/恢复隔离；不拨号、不读秘密、不授测量权或证明归属/健康。
独立有限 TLS-only responder 与显式 opt-in 部署源码不复用 Agent/Relay 私钥，只有
SNI/ALPN TLS 握手，无 echo/应用 I/O/mTLS/UDP；来源 CIDR 不是 Scope client 授权。
Registry 不控制 responder 进程的启动/kill/续期，首片当时 measurementAvailable=false；
当前bool配置与后续真实TLS接线见前节，不作为活性证明。
后续真正 issuer/watch 仍须当前 exact head/config/digest 与权限/NodeGrant/网络策略/
有效期，不能拿历史可读 pin 或旧声明当执行权。本片不交付 D1 TLS/echo 测量、外部
观察或健康聚合，无检查/测试/脚本/网络/CI/build/release/Git，C3 前置继续开放。

2026-10-18 后续本地增量：[ADR-0043](../decisions/0043-typed-direct-ingress-probes.md) /
[Direct ingress 契约](../spec/direct-ingress-probes-v1.md) 新增同 Agent namespace 当前
Direct TCP 数字实际监听端点 connect，point 明确为 agent-local-direct-ingress；原
agent-direct-egress 保留原意。精确 Resource/活实例与 Node listener/目标 CIDR 共同
约束，零应用数据仍可能触发业务 accept/下游拨号。闭合 probeVersion2 qualification/
统一 poll/claim/status/result 与原 Gate/预算/期限共用，不是新执行权或 v1 静默扩义。
Schema0034 类型化历史及原有限计划 kind 选择不改变计划预算/取消/恢复；现 v1 Probe
计数/遥测/聚合明确仅 egress，入口暂不导出。默认关闭 opt-in 和未验证源码不能证明
公网入口、监听 owner、全路径或应用健康。此片无检查/测试/脚本/网络/CI/Git；相邻/
远端观测、TLS、nonce echo、UDP/Relay/多跳和健康聚合仍开放，不能关闭 D1/C3 前置。

新增应用层 `ProbePlan/ProbeRun/ProbeResult`，区分三类观察：

| 种类 | 能证明什么 | 不证明什么 |
| --- | --- | --- |
| 节点/相邻端点检查 | 指定观测点到指定地址端口的连接或握手 | 完整业务路径、外部客户端可达 |
| 规则 TCP connect / TLS 握手 | 指定入口的连接及选定握手成功 | UDP、任意应用响应正确 |
| 受控 TCP/UDP nonce echo | 指定观测点经实际规则到受控 responder 的对应 payload | 未测试应用协议、所有公网来源都可用 |

UDP 没有明确 responder/协议插件时显示 unknown/unsupported；
只调用 send 不记为成功。不向任意业务服务注入未知探测 payload。
首版由明确的 Agent 观测点发起；独立外部观测点后续另行部署，
不能把同主机自测当作公网入口验收。

结果绑定 Scope、观测点、Probe/Run ID、拓扑摘要、业务协议、
Forward revision、deployment/assignment/generation/fence、session/boot 和时间。
拓扑、目标、凭据绑定或执行实例变化后，旧结果不进入新实例当前健康聚合。
手动测试新建 runId 并等待本次结果，不拿历史成功冒充此次通过；
只读查询绝不发起网络测试。

Probe 是独立、限时、限次数的探测授权，不续期 Forward、不启动业务 Runner。
计划发布和执行前复核目标 CIDR、DNS 解析结果、metadata 拒绝策略、
端口与有效授权；处理 DNS 重绑定、扫描滥用、并发/字节/超时限制。
撤权停止排程并约束在途任务。Probe 无权放宽既有目标策略。

健康建议用 `unknown/healthy/degraded/unhealthy/stale/unsupported`，
同时显示 probeType、source、样本数和最后成功/失败时间。
组健康按 AND 必经段、OR 可选分支表达；只剩备用分支成功可为 degraded，
不能把所有替代分支都当作串行必经节点。

2026-10-18 [有界 ProbeRun 历史](../spec/probe-runs-v1.md) /
[ADR-0041](../decisions/0041-bounded-probe-run-history.md) 已本地实现、未验证：补现有
单次 Direct TCP/IP-literal/agent-direct-egress 的历史缺口，不扩大其测试范围。
原许可 owner 实际修改与白名单 history capture 同事务，保留原绑定/实例/状态/结果，
不保留机器 fingerprint、requestId、原 wire、目标地址或配置。原两秒许可、全局预算、
到期清理和 Agent 执行都不变；历史与短期 permit 无 cascade 关系，过期或删除规则后
仍可在自身有限保留期内按原身份查询。Scope 一千零二十四头/七天逻辑窗口、惰性清理
和容量淘汰计损失，后续更新缺头不重建，不承诺完整七天或物理准时擦除。
Manager-only GET/Console 通过既有 observation pool 手动读固定窗口与 keyset，
不由读请求创建任务/写历史/访问原执行预算。缺结果为未收到，消费不证明 socket 发生，
历史 connected 不表示当前入口/应用健康或本次新测试通过。原结果 digest 只是捕获，
当前绑定未比对；恢复只 sticky 标记，不反向修改原许可、Journal 或高水位。
Schema0032/Control-only Profile 与原升级/恢复入口接线。本片无测试、静态检查、
夹具/CI 扩展、真实网络/数据库/浏览器、提交或推送，全部仍待源码冻结后集中验收。
本片不交付邻接/TLS/受控 echo/UDP/Relay、多跳、持久计划或健康聚合；D1 和 C3 前置
不能据此完成，后续必须按真实观测点、授权/协议与来源契约继续，不静默回退。

2026-10-18 [有限持久 ProbePlan](../spec/probe-plans-v1.md) /
[ADR-0042](../decisions/0042-bounded-probe-plans.md) 随后补上计划缺口，**本地实现、未验证**。
只复用已有 Direct TCP/IP-literal/agent-direct-egress；预览与创建仅存不可变配置/原始
绑定和精确 Forward 修订。手动 run 逐次 CAS，scheduled 显式委托创建者且每次重查
当前 Scope/Node Grant，不以旧预览授权、自动重基、同 Service identity 代签或修改规则。
三十二计划/Scope、十六次决策/计划、一小时寿命、至少三十秒间隔；原两秒许可的
新 trusted deadline 仅缩短至计划末端，原全局预算、实例复核与 Agent 执行保持原 owner。
默认关闭独立 worker 一秒最多一候选，不补 tick；许可/原 Run 捕获/计划决策/head
同事务，未知 SQL/commit 失败不被记录为业务拒绝。取消仅阻止未来，恢复 sticky
挂起且不自动重放。completed 表示有限决策槽用完，非网络执行或成功；结果仍独立
ProbeRun 来源，读取不造任务。终态惰性七天清理/容量淘汰有 loss，active 不被淘汰。
独立 observation pool、Manager API/手动 Console、Schema0033/Control-only Profile 和
运维接线不扩 Core/ADP/Journal。本片无任何检查、测试、脚本、网络/数据库/浏览器、
CI、夹具扩展、提交或推送；邻接/TLS/受控 echo/其他协议/健康聚合和 C3 验收仍待后续。

### D2. 指标、计数与历史

2026-10-18 首批已在本地编写、未验证：
[Node 进程遥测与原始历史](../spec/node-telemetry-v1.md) 通过独立版本化 mTLS 通道、
Agent 独立十秒采样和 Control 独立有界 SQL 读模型接入现有可测进程资源/本地存量。
原始查询限制最近 24 小时及最多 512 点，持久硬上限每 Node 8640 点，过期物理删除
分批进行且可能滞后。Console 只读显示来源、缺测与连续性；没有运行测试/静态检查
或 Actions。此首片不包含下述主机资源、规则 payload、Probe 计数或分钟/小时聚合，
不能据此关闭 D2；旧本地 diagnostics 也不替代远程指标链路。

2026-10-18 D2-B1 继续在本地实现、未验证：
[原生入口 payload 计数生产端](../spec/native-payload-counters-v1.md) 增加实例 epoch、
TCP/UDP 累计字节/连接/包计数、完整绑定身份及 Close 后冻结的 128 项/十分钟内存尾部。
显式 diagnostics 启用时每十秒写独立、最多 256 项的轮转本地 companion 文件；
来源、截断和尾部淘汰明确，不把本地文件当远程流量产品。现有进程 telemetry-v1
不变，未新增 payload 远程 Schema/API/MySQL/Console。下一片继续独立版本化远程
Forward payload 接收/历史/Console；主机资源、Probe 计数、聚合和容量仍待开发。
本批没有测试/静态检查/CI 或测试夹具扩展，不据此关闭 D2 或发布门禁。

2026-10-18 D2-B2 继续本地实现并接线、未验证：
[独立 Forward 遥测](../spec/forward-telemetry-v1.md) 承接 B1 生产端，增加独立 mTLS
32 点/64 KiB 上报、完整身份的 Runtime 已发布/退役来源映射、0021 规范化历史与单实例
Console 读取。进程 telemetry-v1 保持不变；两侧独立开关默认关闭，复用既有两连接
非排队遥测池，十秒采样、两秒传输、1.5 秒数据库硬期限，不保证尾部送达或失败重传。
每 Node 4096 点（包括恢复点）、逻辑 24 小时/最多 24 MiB JSON；物理开销另计，容量
淘汰可早于 24 小时，查询最多 512 点。恢复只清 head 并隔离旧点，不清原始历史或授权水位。
Delta 只跨精确同实例/epoch、相邻序号和无丢失/截断的连续点；缺测不是零流量，
latest 不代表整规则汇总。没有测试、检查、生成器、Compose/浏览器或 CI，未提交/推送。
主机资源、Probe 尝试/成功累计、分钟/小时聚合、容量及集中验收仍待，**D2 未完成**。

2026-10-18 D2-C 本地实现、未验证：
[独立 Host 遥测](../spec/host-telemetry-v1.md) 增加 Linux Agent 可见 OS/根文件系统/
网络命名空间来源，unsupported/null 明确；不采 cgroup 限制，不承诺物理主机视角。
默认关闭、独立协议/epoch/sequence，500 毫秒单 worker OS 预算、十秒循环、两秒传输，
8 KiB sample/4 KiB ACK；0022 原始历史/恢复隔离/升级与部署接线复用原两连接观察池。
每 Node 8640 点含恢复点、逻辑 24 小时/67.5 MiB JSON，物理开销另计且容量可提前淘汰。
CPU 仅在精确 ticks 连续时推 ratio，网络只 raw 无速率；三族清理顺序各最多 256 点。
没有检查/测试/生成器/浏览器/Compose/CI 或提交/推送，Probe 累计、聚合与容量仍待，D2 未完成。

2026-10-18 D2-D 本地实现、未验证：
[独立 Probe 累计](../spec/probe-telemetry-v1.md) 记录实际 dial attempt、有效成功失败、
unknown/inFlight，Close 先把在途转 unknown，已登记调用之后才 dial 仍计 attempt+unknown，
全部调用退出才冻结终态。最多8纯数值退休源各256绑定/600秒，pending点仍current，
总扫描最多2432点；无Gate/Runner/授权引用，32输出/128value-tail不是全部内存成本。
完整 Binding/instance/epoch 的历史 Snapshot
来源只读验证，不将 consumed/result 行数当分母，不新增权威路径指标历史写入。
0023/恢复/默认关部署接线，32 点/两 Snapshot/64 KiB上报，10秒/2秒无队列重试尾部保证；
共享两观察连接，四族每30秒顺序各清256，4096点含恢复/24小时逻辑TTL/24MiB JSON，
容量可提前淘汰、物理开销另计。无检查/测试/生成器/新夹具/浏览器/Compose/CI或提交推送。
聚合与容量、功能全冻结后的集中验收仍待；不声称 D2、生产就绪、健康或结算完成。

2026-10-18 D2-E 本地实现、未验证：
[双层精确series聚合](../spec/telemetry-rollups-v1.md) 同原raw/head事务提交新观察，
cursor不依赖保留raw，7天分钟/30天小时直接fold且有明确样本/覆盖/缺口/重置质量。
累计值不累加用量，合法区间全归结束receipt桶、boundaryIntervals显式，不插值、不伪p95/健康/结算。
0024 Scope/Node-family配额与有界自身淘汰/Scope拒收、恢复sticky历史、对齐半开UTC/keyset查询，
Control-only默认关闭，无Agent协议变化。逻辑JSON预算不是物理磁盘证据，原raw不新增Scope硬容量。
没有检查/测试/生成器/新fixture/浏览器/Compose/CI或提交推送；容量与集中最终源码验收仍待，D2未完成。

先收集 Agent 进程资源、主机基础资源和原生 Forward 吞吐/连接计数，
明确来源；主机网卡字节与规则 payload 不是同一口径。
规则首版统一在入口统计客户端收发 payload；TCP/UDP 分开，
不将多跳每个节点相加，不将加密/IP 头开销冒充业务用量。

上报使用累计计数及 `epoch/sequence`，服务端去重、识别重置和乱序；
新 epoch 建基线，缺失尾部计数保留误差，首版只是运维指标，不用于结算。
探测尝试数和成功数独立累计；失败率由有效计数计算，
不能用图表点数、仅异常样本或延迟点推算。TCP 失败率不命名为网络丢包率。

初始存储使用独立 MySQL 读模型：建议原始点 24 小时、
分钟聚合 7 天、小时聚合 30 天；均为待容量验收的默认值。
聚合保留 count/sum/min/max/成功失败数及覆盖区间；
没有直方图或足够原始值时不展示伪造的 p95。
UTC 存储、界面明确时区；清理分批、查询限制时间窗与点数。
限制标签基数、每 Scope/Node 的计划数、队列与磁盘额度；
监控拥塞时允许有标记地丢弃/降采样，不能阻塞授权续期和转发控制。

### D3. 诊断与基础告警

详情按“意图 → 部署 → 节点 → 物理监听 → 邻接段 → 最终目标 → Probe”下钻，
提供对应 Operation、失败码、时间与脱敏支持包。

2026-10-18 第一片 [被动 Forward 诊断](../spec/forward-diagnostics-v1.md) /
[ADR-0036](../decisions/0036-passive-forward-diagnostics.md) 已本地编写、未验证：
Scope viewer 可读取一个原 Forward 的七层有界投影、最多八条原 Operation 和独立
清理/历史租约窗口；不借用 Runtime 命令或资源锁，不签发 Probe、拨号或写入通知。
服务与 Bearer 查询走既有两槽 observation pool，无 Runtime 池回退。报告必须匹配
Node/Boot/Session/sequence/Snapshot，观察再按 assignment/generation/Fence/phase 对齐；
多语句期间变化保留各自来源并降为未匹配，不借早期缓存时间给后来的观察背书。
预留端口不等于实际 socket；邻接配置、局部 ready 和短时 Direct TCP 出口结果均不能
证明端到端健康。完整 Snapshot/config 摘要未在该投影重算，来源标记不可冒充认证。
同次读取生成白名单别名化支持 JSON，移除地址/端口、原 ID、配置和凭据等敏感材料；
它不是备份或完整法证。Console 仅手动读取、取消等待和明确确认后展示脱敏包。
本片无测试、静态检查、夹具/CI 扩展、提交或推送；审计查询、站内事件与受控通知
仍待下一片，D3/项目未完成，C3 前置验收和物理/发布门禁未通过。

2026-10-18 第二片 [只读审计查询](../spec/audit-events-v1.md) /
[ADR-0037](../decisions/0037-bounded-audit-query.md) 已本地编写、未验证：当前 manager
同事务授权下合并十五类原 owner 记录，固定 UTC 窗口与精确交集/keyset 有界读取，
不另建事件执行器或重写历史。归属取本源不可变配置，保留未归因/缺关联；批次事件
不伪造 Forward/Operation，最新 Operation 不是状态迁移日志。没有全局恢复的 Scope
推断、原 details/config/凭据/自由异常或支持包导出，输出边界不证明 SQL 成本与历史
完整性。独立 Console 仅手动读取/翻页，复用独立 observation pool，不调用 Runtime。
本片无测试、静态检查、新夹具/CI、提交或推送；站内事件/通知和全项目目标仍开放。

2026-10-18 第三片 [站内事件与固定告警](../spec/station-alerts-v1.md) /
[ADR-0038](../decisions/0038-bounded-station-alerts.md) 已本地编写、未验证：独立政策/
条件/事件 owner，按明确目标评价当前部署失败、报告失鲜或凭据临期。默认关闭的
observer 与原 Runtime worker 分离，逐政策复核管理身份，条件/事件/去重/下次时间
同事务，有有界保存、条件延期和失败退避。初次事件为当前采样检测，不倒填完整历史；
缺测/旧实例/未知不恢复，部署成功和报告新鲜度不表示端到端健康。静默不清状态，ack
不改部署，换实例是 invalidated 而非 recovered。Schema0029/Control-only Profile、
原恢复事务挂起和手动 Console 已接线；没有投递队列或外发，仍未运行检查或测试。

2026-10-18 第四片 [受保护通知端点](../spec/notification-endpoints-v1.md) /
[ADR-0039](../decisions/0039-protected-notification-endpoints.md) 已本地编写、未验证：
独立 manager-only 元数据、完整替换/凭据轮换与安全停用走原授权/幂等/CAS。完整 URL
和签名密钥由单独预置密钥的 Linux vault 保护，SQL/查询/回执/审计不包含秘密；恢复挂起
且必须显式重新发布。固定公网 HTTPS adapter 逐尝试校验全部 DNS、固定 IP 并保留 TLS
主机名校验，限制并发/字节/超时；它还没有接入服务、事件队列或任何发送/测试路由。
手动 Console 不使用全局敏感请求缓存，未知提交只原请求同键重放；Schema0030 和原运维
边界接线。当前 `deliveryAvailable:false`，不以端点配置冒充通知已经投递，未运行任何
检查或测试，也未提交/推送。

2026-10-18 第五片 [有界通知投递](../spec/notification-deliveries-v1.md) /
[ADR-0040](../decisions/0040-bounded-notification-delivery.md) 已本地编写、未验证：仅新
站内事件经原事务 handoff，固定非秘密摘要/端点和凭据修订快照、稳定去重身份、
抑制/队满/保留损失进入独立通知 owner，不扫描旧事件或在 GET 时生成工作。
默认关闭的独立 worker 将当前管理权/政策/订阅/静默/恢复身份检查、持久速率与
claim/fence 原子接受后才在事务外读凭据和联网；全部 DNS 检查后再授权、固定公网 IP
并保留原 TLS 主机身份。轮换/停用/失权取消旧队列，最多六次/一小时、退避三十秒至
五分钟，过期 claim 先记 unknown，迟到结果不能越 fence。当前 vault 引用 pin 到真实
DNS/guard/socket drain，不拿五秒 sender 超时冒充物理完成或承诺瞬时撤回。
每 Scope 一千零二十四头/二百五十六明细/两活跃 claim，有限终态惰性清理和明细淘汰
明确披露；Manager 历史 GET/Console 仅手动查询，不提供发送测试或重驱写 API。
Schema0031/Control-only Profile 与原恢复隔离接线，恢复取消旧待发并保留历史/速率，
不自动补发；HTTP 2xx 不是远端业务完成，无 exactly-once/顺序保证，接收方必须去重。
本片无测试、静态检查、新夹具/CI、真实网络/数据库/浏览器、提交或推送，全部待最终
源码冻结后的集中验收；D3/项目、C3 前置验收与物理/发布门禁均未因此通过。

邮件、Telegram 等具体渠道后置；有界队列不承诺零漏报/可靠送达，不把通知发送失败
当转发部署失败，也不赋予通知 worker 任何 Runtime/Agent/Probe 执行权限。

## 8. 代码落点与数据演进

以下新增名均为建议，待 ADR/API 评审后定名，不代表现有实现：

| 落点 | 责任 |
| --- | --- |
| `packages/core/src` | 保持现有纯领域与严格 parser；必要变更独立版本化 |
| `packages/contracts`、`docs/protocol` | driver descriptor、Probe/telemetry schema、双语言 fixtures 与拒绝旧版规则 |
| `apps/control/src/modules/transport.ts` | 不可变 Profile、能力解析、新驱动要求 |
| `apps/control/src/modules/topology/`（新） | 路径模板、组、绑定、影响预览与显式批次 |
| `apps/control/src/modules/routing/`（新） | 策略、候选、提案、冷却、人工固定与自动化身份 |
| `apps/control/src/modules/observability/`（新） | 探测调度、历史与指标读模型、告警规则 |
| `apps/control/src/modules/runtime/` | 复用现有部署台账/编译器/协调器，保持唯一执行入口 |
| `agent/internal/forward`、`relay`、`control` | 原生引擎能力、计数接线；保持租约与共享 Journal |
| `agent/internal/probe/`、`telemetry/`（新） | 有界执行/采样/去重，不引入任意 shell |
| `apps/web` | 沿用现有前端；按主线增加表单、拓扑与历史，不以换框架作为前置条件 |
| `scripts/phase2`、`.github/workflows` | 真实流量、网络隔离、浏览器、驱动与证据门禁 |

候选表按所有者分组：拓扑模板/修订/绑定；路由策略/提案/切换审计；
Probe 计划/执行/结果；指标原始点/聚合；告警事件/投递。
它们不取代现有 Forward/Operation/Assignment/Reservation 表。
策略/绑定变更使用 CAS 与幂等；敏感变更纳入审计与备份清单。
删除规则停止新 Probe，但在保留期内仍可查询已脱敏的历史事件。

## 9. 交付顺序与退出条件

| 批次 | 交付范围 | 依赖与退出条件 |
| --- | --- | --- |
| P0 | 收口既有基线：审计/支持包、证据身份、真实浏览器与部署恢复缺口 | 复用当前队列；先标清 exact-SHA 证据和未通过门槛，不重做已完成切片 |
| P1 | A1 + B1：原生能力、规则与隧道管理 | native Direct/Relay/默认关闭多跳同一能力视图；权限/配置/错误和 UI→真实流量验收 |
| P2 | C1：路径模板、引用预览、手动切换 | 模板锁版、不隐式联动；CAS、端口冲突、旧连接 drain、失败补偿与撤权测试 |
| P3 | D1 + D2：独立 Probe、基础指标、历史 | 乱序/重放/缺测/UDP unknown/SSRF/上限验收；观测不扰动已有业务 |
| P4 | C2 + D3：组/备用路径、诊断和基础告警 | 分支聚合、批次部分失败、候选授权、告警去重/恢复与规模约束 |
| P5 | C3：固定优先级自动故障转移 | 故障窗口/冷却/并发人工修改/Control 重启/服务身份撤权；不触发重复切换 |
| P6 | B2/A2：新承载与驱动，逐个独立试验 | 先 WireGuard 候选，后按需求评估 NAT/GOST；独立 ADR 与租约/崩溃/资源/供应链门禁 |

顺序表示依赖与默认优先级，不承诺工期。P6 的离线设计可提前，
但不让未验收驱动进入 P5 自动路由候选。每批拆为小的纵向 PR：
契约/领域决策 → Control/Agent → Console；开发阶段先完成实现并记录未验证状态，
Actions 证据在源码冻结后集中补齐，不能只做 UI 就标记完成。
当前 [近期队列](next-milestones.md) 负责 P0 收口；
后续按上述主线增加切片，冻结验收以实际纳入该版本的功能为界。
不因增加长期主线而无限推迟已有 native 版本，也不为赶发布跳过相应门禁。

## 10. 统一 Actions 验收与发布边界

本节是源码冻结后的集中验收要求，不是逐批开发门槛。开发阶段不运行测试、
不追跑 Actions，不将逐批静态检查或扩展验收工具作为功能实现的前置工作。
冻结后功能、数据库、网络、容器和浏览器测试统一在 GitHub Actions 执行，
集中修复失败并重新核对最终 SHA；本地不启动这些验收。
保留现有 contracts、MySQL、Go vet/race、Direct/Relay、
3/4/8 节点及网络隔离矩阵，新增切片必须防止这些基线回退。

新增门槛包括：

1. 契约：未知字段、旧 Agent、伪造 capability、错误 digest、超大输入拒绝。
2. 授权：跨 Scope、Owner 无隐式 Node Grant、Profile 撤权、目标重绑定、
   自动化身份撤销与后台任务再检查。
3. 数据面：真实 TCP payload、受控 UDP echo，路径/目标更换时标识不可串线；
   失联、重启、到期、资源冲突与历史 lease 不误续期。
4. 探测与统计：旧拓扑/会话结果、重复/乱序/重置、缺测不变 0、
   分支聚合、长窗口清理、取消与限速；不用固定 sleep 代替可判定状态。
5. 切换：不重复执行、人工 CAS 获胜、冷却/抑制、失败补偿重新授权、
   TCP 排空边界与 UDP 损失记录。
6. UI：真实 HTTPS 浏览器，经实际 API/MySQL/Agent 完成操作；
   已有模型/轻 DOM 测试继续保留但不冒充端到端。
7. 交付：exact commit、dirty 状态、Agent/Control 身份、镜像 Digest、
   拓扑/观测点、命令、数据包结果、清理结果与失败项进入证据包。

物理多主机、真实公网/NAT、长期稳定性和容量门槛独立列项；
无对应环境时保留 missing，不以托管 CI 同宿主机通过替代。
多跳和新驱动继续显式 opt-in；自动故障转移单独默认关闭，
已有部署授权即使在该开关关闭后也须正常收敛和清理。
每次源码变更只更新受影响状态，正式发布依据冻结 SHA 的完整矩阵，
不拼接不同版本报告，也不将计划、代码合并或 Dev 镜像发布写成生产就绪。

## 11. 开发前的决策清单

- 能力描述与执行驱动选择的 ADR：保持 Direct Core 契约，不混淆能力和授权。
- 路径模板、锁版绑定、组与自动化身份的 ADR：状态所有者、CAS 和删除/撤权语义。
- Probe/telemetry 协议 ADR：独立端点或协商扩展、授权期限、配额、旧版拒绝和脱敏。
- 指标字节/时间/epoch/缺测口径：先固定计量语义再开发图表，不用于计费。
- 切换状态机 ADR：非原子边界、排空/中断、补偿前提、人工优先和默认关闭。
- 新驱动逐项 ADR：物理资源、密钥、异常退出时的硬截止保障和禁用后的状态兼容。

本方案初次排队建议是只读审计与脱敏支持包，再进入 P1 的原生能力描述与
表单/诊断统一。用户后续确认先做架构收口，当前优先按
[ADR-0006](../decisions/0006-classified-extension-contracts.md)
适配已有 native：Agent 内部静态注册与生命周期分派、Console 授权查询与
MySQL 只读投影、Transport 锁版解析端口，以及 Profile、成员、Node Grant
授权写用例与 Runtime 撤权/恢复效果端口、整节点策略/凭据吊销接入，
以及 Forward 创建/更新/删除/重试命令与原生准备端口、静态快照来源接入已编写；
观察类首个被动来源也已接入有界宿主与 API，带独立授权、期限、取消及来源/时效，
明确不是主动健康探测，见 [Node observation v1](../spec/node-observation-v1.md)；
主动 Probe 基础随后按 [ADR-0007](../decisions/0007-bounded-agent-probe.md) 编写：
Control 只读预检与 Agent 独立许可下的受限 TCP 执行器已有实现，见 [Probe v1](../spec/forward-probe-v1.md)。
随后按 [ADR-0008](../decisions/0008-probe-contract-negotiation.md) 编写独立只读 mTLS 协商
与内部单次许可门禁，不扩充现有 ADP 消息；随后按
[ADR-0009](../decisions/0009-probe-instance-ownership.md) 编写内部持久实例归属、
CAS/不续期重试/撤销和恢复隔离，并同步迁移与 Control 兼容矩阵。
随后按 [ADR-0010](../decisions/0010-probe-registration-lifecycle.md) 编写独立远程登记协议与
默认关闭的 Agent 门禁生命周期，支持轮换前关闭、当前代数 CAS、保守单调截止及停机清理；
既有只读握手不改，全部响应仍不可执行，功能验收待 Actions。
随后按 [ADR-0011](../decisions/0011-probe-permit-authority.md) 编写内部许可权威、持久单次消费及
同库 Actor/Node/集群签发预算；锁定当前授权/绑定/实例，新增迁移 0015、兼容与恢复隔离。
随后按 [ADR-0012](../decisions/0012-probe-claim-contract.md) 接入已知 ID 的独立 mTLS 单次领取协议，
共享 TS/Go 严格解析、55 份向量和 Agent 完整绑定/时限校验钩子；回执仍不可执行，
没有生产 Agent 调用、远程签发/任务投递、持续执行撤权或派发/结果闭环。
随后按 [ADR-0013](../decisions/0013-probe-delivery-authority.md) 增加内部有界任务选择、消费后当前授权检查
及独立持久撤销，保留单次消费事实与预算；迁移 0016、兼容边界、旧 consumed 回填及恢复规则已编写。
随后按 [ADR-0014](../decisions/0014-probe-delivery-contract.md) 编写独立 mTLS poll/status、TS/Go 严格解析与
184 份共享向量；只调用原 offer/check，保持空/单任务、当前授权、原截止和不可执行回执。
没有 Agent 自动请求或持续执行监视器，服务端观察年龄上界不等于持续租约；下一步接失败关闭的宿主监视器与结果协议。
随后按 [ADR-0015](../decisions/0015-probe-agent-authority-watch.md) 编写内部有界 poll 与消费后观察监视器，
固定原回执/完整绑定与不续期截止，200 ms 请求、250 ms 失鲜、串行有限次检查及取消后持槽到退出；
生产主循环仍不调用，不构造执行许可，合作式检查与取消不冒充物理撤权保证。下一步接结果与单次执行。
随后按 [ADR-0016](../decisions/0016-probe-result-receipts.md) 编写独立 mTLS 结果协议和原许可 owner 接收，
单份有界记录、JCS 内容去重、完整原始授权/绑定/时限重查，结果只标记 agent-reported，不更新健康。
迁移 0017 与 Control-only 兼容/恢复边界已同步；尚无 Agent 上报调用、单次执行准入或生产流程。
随后按 [ADR-0017](../decisions/0017-probe-host-execution.md) 编写内部单次宿主准入与结果序列化，
原回执监视器与原实例 Gate 共同约束执行，保留失败消耗、取消后持槽和严格零应用数据；
上报句柄保持当前授权检查，采用服务端时间/本地单调锚点保守映射结果，不改既有 Schema、Core 或 Journal。
新增 9 组 Go 回归接入 Actions/race；仍无生产调用、结果回传 HTTP 或远程签发/调度，下一批单独连接默认关闭的流程。
随后按 [ADR-0018](../decisions/0018-probe-production-workflow.md) 编写默认关闭的管理签发/查询/撤销与 Agent 串行获取、
领取、持续检查、单次零应用数据连接及保守结果回传；幂等接受与许可同事务，实例从当前锁定事实选择。
保留原权威、全部预算、两秒许可和不确定结果不重试；需要明确的一秒集群时钟策略和 Agent 双重 opt-in。
管理回执只作短期 agent-reported 历史，不更新健康；新独立组合 Actions 使用真实 Agent/Control/MySQL/mTLS 与 TCP 目标，
目前仅编写/接线，未取得对应提交通过。后续已补一次性 Probe Console、同键重放、已知 ID 查询/有界等待/撤销，
以及同一真实 HTTPS Chromium/Agent/Control/MySQL 夹具的桌面/390px 接线；历史结果不更新健康。
随后按 [ADR-0019](../decisions/0019-native-catalog-and-profile-impact.md) 编写共享 native 声明目录、
Agent 注册表一致性回归、Scope 授权能力视图，以及 SELECT-only Profile 引用/锁版配置影响与原编辑器接线。
影响预览不做 Node/端口授权或发布，仍需原计划检查与 CAS。原生目录与无引用 Profile 发布/预览也已接真实浏览器夹具，
引用规则编辑仍需独立浏览器证据。以上均待对应提交 Actions；持久历史、其他 API 读写与遥测仍待后续切片，
不扩展 Core 或新增驱动。
随后按 [ADR-0020](../decisions/0020-explicit-native-rule-commands.md) 编写原编辑器配置复制、最新失败 Operation 显式重试和
当前页最多十条串行启停；固定原配置/revision/幂等键，逐条结果，不确定提交停止并需手动同键重放。
新增队列/复制/HTTP 回归及真实 Direct Chromium→Control→Agent→TCP、并发 CAS 部分失败、已提交响应丢失与注入失败重试接线。
没有 durable Batch、跨规则事务或自动回滚；本机仅静态检查，Relay/多跳复制浏览器和其余隧道管理继续待补。
随后按 [ADR-0021](../decisions/0021-native-tunnel-read-model.md) 编写原生 TLS 隧道同事务授权/SELECT-only 只读元数据，
有界 Peer 窗口、Endpoint、规则相邻引用分页、Console 原部署入口与精确 Profile 修订查看。
元数据不签发凭据、不验证网络/证书，不证明健康或历史资源可回收；没有新 Core/迁移/机器协议/Journal。
真实 Relay 浏览器接线补引用 Profile 影响→原编辑器→重新预检/CAS，以及停用复制/另选端口/显式启删/实际 TCP+UDP。
所有新增回归仍只编写/接线，本机仅静态检查；对应提交 Actions、显式多规则 Profile 批次发布、
多跳复制浏览器和长期轮换未完成，不能据此关闭 B1/P1 或宣称已实现物理隧道复用。
随后按 [ADR-0022](../decisions/0022-explicit-profile-batches.md) 编写最多十条当前影响页的显式 Profile 发布：
固定目标 revision/digest 与每条完整配置/CAS/独立键，只有锁版变化；确认后逐条原预检与原 PUT，保留部分失败。
未写入的预检不确定需显式重查；可能已提交的更新不确定仅同键重放，不用新预检/新键替换，拒绝重放也不清除原结果不确定性。
新增队列/选择回归及真实双 Relay 引用 CAS 竞态、已提交响应丢失和原键重放/TCP+UDP 接线；均未执行，仍无本批 exact-SHA Actions。
这补上 B1 的显式批次实现入口，不是 B1/P1 验收通过，也不关闭多跳浏览器、长期轮换或后续路径模板/切换和遥测范围。
随后补 [3/4/8 Agent 真实多跳复制浏览器接线](../testing/native-multihop-console.md)：
复用原进程夹具、授权、原编辑器和 CAS；验证新 Profile 不自动替换锁版、全部中继顺序、编辑失效后重新预检，
默认停用复制/另选端口/显式启停删，以及实际 TCP/UDP、停用保留资源和删除安全清理。
新增最大六中继与门禁关闭两组轻 DOM 回归；现有多跳 Actions 进程矩阵接 Chromium，隔离步骤保持关闭浏览器。
这只补此前缺失的验收工具与受限截图接线，本机仅静态检查，无 exact-SHA Actions；不能关闭 B1/P1、长期/物理门槛或项目目标。
随后按 [ADR-0023](../decisions/0023-immutable-native-path-metadata.md) 实现 C1 首片路径元数据与独立 Console：
2-8 有序 Node、精确 Endpoint/Profile 锁版、不可变配置摘要、同事务原授权、128 标识/64 修订配额、CAS/幂等与终态归档。
Scope 授权查询不复核历史引用权限，不证明执行；模板命令不写 Forward/Runtime 或资源。
迁移 0018/Control-only Profile/部分 DDL 拒绝/备份恢复责任同步，Agent/Core/Journal 不变。
端口、UI、真实 MySQL 并发和 SELECT-only、3/4/8 Agent Chromium 模板丢响应重放/无变化/新修订/归档流程均仅编写接线。
该首片当时尚无绑定/影响/切换，本机仅静态检查，不能借用旧 SHA 验收。
随后按 [ADR-0024](../decisions/0024-original-owner-path-bindings.md) 接入精确模板选择、
同事务原 Forward 更新/来源保存、最多 64 条不可变绑定历史、有界当前引用影响和独立 Console 单规则显式切换。
只改变路径/Profile，保留入口/协议/目标/监听/启用意图；展开不变可无 Operation 绑定，普通拓扑编辑解除指针并留历史。
迁移 0019、Control-only Profile、部分 DDL 拒绝与保留来源/隔离恢复责任同步，Core/Agent/Journal 不变。
端口、UI、真实 MySQL 并发 CAS/配额/整事务回滚/SELECT-only，以及 3/4/8 Agent Chromium
真实缩短路径、已提交回执丢失后原键重放、实际 TCP/UDP、新 CAS 显式切回与归档不撤权均已编写/接线，未执行。
本机仅静态检查；多规则路径发布、exact-SHA Actions、中断测量与其余 C1/遥测/运维交付仍待后续，不关闭项目目标。
此调整不取消审计与产品验收缺口；首批实现等待对应提交的 Actions，
不自动发布或启用新能力。
