# P: 产品易用性与运行闭环

日期：2026-10-24（Asia/Shanghai）。状态：P1-P5 源码候选与 P6 准备已撰写，待审阅／验证。
基线：`b729a5be8ef98164d3de515e37e424741ad83608`。
工作树：`product-readiness-p`；分支：`source/p-product-readiness-20261024`。

## 目标与授权

用户要求“规划一下方案完善这些，然后设置目标，完成方案”。据此建立持续目标，
完成前一轮确认的接入、成员、额度展示、探测排障、日常操作、告警和部署质量缺口。
本阶段串行实施，不沿用 N 的具名并行任务授权。

遵守现行 AGENTS.md：先完成源码、必要 FR、契约病例与集成说明，再冻结集中验证。
N 的测试、commit/push、合并和发布授权只属于其原任务；本阶段不据此执行检查、
测试、生成器、格式化、构建、网络/MySQL/浏览器/容器实验、commit/push 或发布。
已有安装/独立主机/负载验收门槛继续存在。环境问题只影响对应执行，不阻塞独立源码。

2026-10-24 用户确认独立主机和长稳环境“暂无，先完成源码与验收准备”。本轮按此
交付源码候选、病例、安装工具、执行手册与输入模板；没有可用 runner／主机标识或
批准的实验时长，不启动实际环境实验。PP-13–16 对应的独立环境、负载及长稳执行
保留为后续待办，不撤销接受要求，也不以短测或同机 namespace 代替。此答复不包含
P 集中验证、commit/push、合并或发布授权。

随后用户明确选择 GitHub 并要求“使用action进行测试和验收”。据此进入 P Actions
验证，保存／推送当前候选测试分支、创建草稿 PR，并修复验证失败；执行证据绑定
准确 head／实际 checkout 和作业最终结论。功能、MySQL、网络、容器和浏览器均在
Actions 执行。此项新授权不包含合并、镜像发布、发行或代理并行，也不改变上述
实际环境不可用状态。当前执行结果以 [P 验证记录](product-verification-p-2026-10-24.md)
为准；本文件下方的 authored／未执行描述保留源码交接时点。

`v0.1.0` 指向 `41351e3333a8f2059b080e4e0a8a5b6ee12b9988`；已发布版本镜像与
latest 的恢复属于先前任务，不修改旧标签。本阶段基线只比它增加发布恢复工作流。
历史 B、N 验证及发布状态不被改写成 P 的验收证据。

## 六项任务说明

1. 层级：主要为 L2 主机/HTTP/SQL/浏览器适配与 L3 产品 owners；需要通用端口时
   通过 L1 扩展，不改变 L0 领域 API。
2. 公共接口：Identity/Access、Node、Forward/Operation、Path/Ingress、Probe、
   Telemetry/Diagnostics、SharedResourceLimits、Runtime 与 Agent executionstate。
3. 地基：唯一 Runtime ledger、Agent authority/Journal、受保护高水位保持原 owner。
   冻结接口、持久字段或在线协议改变前记录具体 FR、消费者和迁移。
4. 契约：成员界面复用既有命令；用量在线投影、受控 Probe 扩展和告警规则分别
   提交契约，不增加第二个额度权威、资源分配器或绕过当前授权的修复命令。
5. 验收：病例随切片撰写；源码 authored、检查 executed、准确修订 passed、独立
   环境、主线/镜像/发行分别记录。当前全部 P 执行证据为未执行。
6. 并发影响：本阶段独立工作树、串行集成共享契约、迁移目录与组合入口；不改动
   原 N 工作树。发现来源不明的并发修改时停止对应编辑并核对。

## 产品范围

| 切片 | 现有基础 | 交付 | 明确边界 |
| --- | --- | --- | --- |
| P1 安装接入 | rolePreflight 已有角色、证书、SAN、目录权限、初次/既有状态检查 | 统一安装计划、按角色操作向导、检查失败的可操作建议、首次/已有服务分别说明 | 不重复检查器，不自动创建 CA、清状态、重新注册、执行 root 命令或宣称网络已验证 |
| P2 成员管理 | Identity 原成员 API、Token 哈希、Scope owner/manager/viewer | 所有者成员列表、创建/角色/移除/Token 变更流程，普通用户账号说明 | 账号秘密仅当前操作内存；原 CAS、幂等和撤权协调保持；不新增支付或开放注册 |
| P3 额度可见性 | 原 Journal 持久预扣、每用户/共享机器/显式周期政策 | 有界在线消费上报、同事务派生读模型、个人/管理员用量与时效/未知说明 | 消费权威仍是原 Journal；不反算 telemetry，不把陈旧/缺测余额当作执行许可，不删除历史 |
| P4 探测与告警 | Direct connect/TLS、Echo 预检、原 Probe 许可/结果/历史、三类站内规则 | 先贯通受控 Echo 命令，再扩展有明确测量位置的 Relay/多跳业务往返；补额度/到期及最近路径样本告警 | 仅受控服务及原授权；Agent 本地入口不冒充外部可达；探测不触发自动换线 |
| P5 日常/批量体验 | 原直接组线、预览、Operation、逐项发布/补偿、诊断支持包 | 任务式入口、易读表单、可取消/有上界的可见页刷新、失败建议、批次进度与显式恢复 | 保留未知结果原键/body重放，不自动执行/补偿/重试，不承诺跨规则原子或无损切换 |
| P6 部署质量 | 原 physical 多跳场景、网络 fixture、rolePreflight、升级评估 | 可复现安装/恢复手册、独立主机执行清单、负载/长稳场景和完整证据格式 | 没有主机/时长时只完成准备；不把计划、同机 namespace 或短测试记成物理/长稳通过 |

本阶段不包含自动选路/故障转移、VIP/DNS 入口负载均衡、共享物理连接、支付结算、
VPN/L7、第三方执行后端兼容或动态插件运行时。这些需要后续独立产品决定。
告警是观测输出，不得触发自动执行或替代 Agent 授权。

## 实施顺序与责任链

1. **P1**：读取现有部署检查结果 -> 固定建议目录 -> 生成仅供审阅的阶段计划 ->
   操作者手工执行既有 bootstrap/enroll/start -> 原身份与状态报告确认。
2. **P2**：所有者页面 -> 原 Identity 命令 -> 原事务、成员 CAS、AccessChangeReconciler
   -> 既有 Runtime 撤权/报告收敛；治理身份不取得私人机器使用权。
3. **P3**：原 payload gate -> 原 Journal 持久消费 -> 原 Runtime 报告 ACK -> 独立可选
   用量扩展 -> 原节点认证/会话/已接受报告引用 -> 同事务派生 SQL -> 原 ResourceAccess/SharedResourceLimits
   查询 -> 个人页面。FR 在 wire/端口修改前记录；旧字段和旧读者明确拒绝/忽略规则。
4. **P4**：原 Probe planner -> 原许可/声明/claim -> 原 Agent executor -> 原结果历史；
   精确绑定完整 Forward、修订、观察位置与受控服务。告警读取已授权派生事实，写入
   原 Station event/outbox 事务；新规则先版本化，不将阈值判定扩散进 Runtime。
5. **P5**：只读任务摘要与固定命令意图 -> 原预览/CAS/幂等命令 -> 原 Operation。
   页面刷新限于可见页与明确启用的读取；切换账号/Scope、关闭、取消时丢弃旧响应。
6. **P6**：冻结源码 -> 已授权静态检查 -> 准确源码 Actions -> 独立主机安装和故障
   -> 规定时长的负载/长稳 -> 发布评估。每一层证据独立，不提前推进为通过。

旧模块/兼容入口保持可追踪：`modules/identity.ts`、`modules/nodes.ts`、原 Runtime
别名、`application/*` API 别名和 Agent 原 Runner/Journal 构造需要在相关 FR/切片
集成说明中逐项记录默认绑定与迁移消费者。新示例只消费公共接口。

## 关键设计决定

- 安装向导先复用 `deploy/preflight.mjs` 和 `preflight-role.mjs`，已有检查不记作
  P 新增成果。向导区分本机静态检查、远端 TLS/数据库、Agent 会话和真实业务验证。
- 安装计划不接受 Token、数据库密码或私钥内容；只引用受保护环境文件/目录。
  不输出当前进程环境、日志原文或可执行的任意用户脚本。
- 账号管理延用 Bearer Token 体系；先完善现有安全模型的 Web 操作，不另造认证。
- 用量计数采用精确十进制字符串并标注 conservative-precharge；在线读模型不续租、
  不授予执行、不退款，也不制造已送达字节的精确计费承诺。
- 旧 Agent、尚未报告、报告过期、政策变更、未来周期和数据缺口必须分别表达。
  周期仍由管理员明确配置；任何自动续接都需要显式同意的政策，不猜月份/时区。
- 受控 Echo 与 Relay/多跳的扩展按能力/版本明确开启；缺少能力拒绝，不退化为
  本机 connect 成功后标整条线路健康。外部入口测量需要真实外部观察者。
- UI 保留现有蓝白色、字体和布局语汇。普通流程按“接入 -> 选资源 -> 建规则 ->
  确认生效 -> 排障”组织；低频技术参数放进有解释的高级区域。

## 接受病例与证据矩阵

| 编号 | 所需病例 | 计划执行范围 | 当前 |
| --- | --- | --- | --- |
| PP-01 | Control/Agent、initial/existing、缺文件/权限/SAN/旧状态、错误脱敏与建议 | deploy 契约；获授权后 Actions 容器 | planned |
| PP-02 | 安装计划闭合输入、无秘密/任意命令、固定摘要、端到端不冒充、仅人工执行 | deploy 契约；Actions | planned |
| PP-03 | 成员 owner/manager/viewer、创建/角色/移除/Token、CAS/原键重放/未知结果 | Identity/Web/MySQL；Actions | planned |
| PP-04 | 成员变更完整原事务与 Runtime 撤权链、旧读响应隔离、秘密不存储 | owner/SQL/Web；Actions | planned |
| PP-05 | Journal 预扣跨重启/版本/双向/多规则、上报十进制边界和有界投影 | Go/TS/wire/MySQL；Actions | planned |
| PP-06 | 用量报告旧会话/重放/乱序/rollback/历史桶/未来周期与读取隔离 | 原 Runtime/额度 owner/MySQL；Actions | planned |
| PP-07 | 用量 stale/unknown/unsupported、样本时保守预扣剩余额度与个人/管理员页面 | Web/HTTP/浏览器；Actions | authored-unexecuted |
| PP-08 | Echo 签发/撤销/claim/受控服务/闭合输入，原预算和硬截止不放宽 | Probe/Go/数据库/浏览器；Actions | planned |
| PP-09 | Relay/多跳真实受控业务往返、TCP/UDP、错误节点/服务/权限/到期 | network namespace；独立主机分别执行 | planned |
| PP-10 | 额度/周期/最近路径样本条件、未知不恢复、原 handoff/outbox 回滚/去重/撤权 | Station/notification/MySQL；Actions | planned |
| PP-11 | 安装/创建/状态/故障向导、任务摘要、移动端/键盘/旧响应/离线 | Web/浏览器；Actions | planned |
| PP-12 | 批次固定意图、部分失败、重读、同键重放、原补偿及恢复隔离 | Path/Ingress/Web/MySQL；Actions | planned |
| PP-13 | 新环境从空库到首条 Direct/Relay、多跳及保留状态升级/恢复 | 准确镜像/独立 Linux 主机 | planned |
| PP-14 | 独立多机丢包/延迟/断线/重启/凭据轮换/撤权、真实 TCP/UDP | 独立主机；不能由 namespace 替代 | planned |
| PP-15 | 节点/规则/连接阶梯、内存/CPU/SQL/延迟、数据库变慢/反复重连 | 明确拓扑/时长/阈值的负载任务 | planned |
| PP-16 | 原 authority/Journal 备份与恢复、旧读者/部分迁移/丢历史拒绝 | owner/容器/独立主机分别记账 | planned |

## 交付状态

| 项目 | 状态 | 准确证据 |
| --- | --- | --- |
| 范围、目标、顺序、接受矩阵 | 已记录 | 本文；不是实现/执行证明 |
| P1 | source-authored-unverified | setup-plan/setup CLI、固定建议、六项契约病例、安装说明；角色预检保持原实现 |
| P2 | source-authored-unverified | FR-0033 成员页、FR-0034 本人凭据/0042 迁移/HTTP/页面与契约、SQL、Web 病例已撰写；集中验证未执行 |
| P3 | source-authored-unverified | FR-0035；原 Journal 锁内读取、独立可选用量扩展、0043 同事务投影、当前/未来周期与过期视图；契约/Go/Web/SQL 病例撰写，未执行 |
| P4 | source-authored-unverified | FR-0036/37/39/40；Direct Echo 与独立 Relay/多跳路径测量、原 permit/history、额度／到期 Station 条件及原事件 handoff；SQL0044/45/46、wire/owner/HTTP/Go/Web 病例已撰写 |
| P5 | source-authored-unverified | FR-0038；任务式入口、显式最多六轮可见页读取、取消／旧响应隔离、原 Path/Ingress 批次进度摘要与生命周期病例 |
| P6 准备 | authored-not-executed | [部署／恢复／负载／长稳手册](product-p-deployment-acceptance.md)、原 physical collector 的拒绝默认 inventory 示例；PP-13–16 实际环境门槛仍开放 |
| 所有 P 检查/功能/集成/安装/负载/长稳执行 | 未执行 | 无 P 验收修订/通过数 |
| P commit/push、主线整合、镜像、发行 | 未执行 | 不复用 N 的发布证据 |

完成标准：每个切片都有可审阅实现、公共契约/旧入口说明、病例和真实状态。
源码冻结不等于验证通过；P 整体接受还需要相应授权与实际环境证据，不能仅凭
“写好了验收计划”关闭独立主机或长稳要求。

### P1 源码交接

- `deploy/setup-plan.mjs`：接收原静态报告，拒绝矛盾/越界输入；固定 code 建议，
  不输出原错误/路径/秘密；Control/Agent 与 initial/existing 四种手动计划分开。
- `deploy/setup.mjs`：复用 parsePreflightArguments/rolePreflight，输出文本或 JSON；
  保持静态退出码，所有 runtimeReady/executed/executionAuthorized 为 false。
- `deploy/test/setup-plan.test.mjs`：六项 authored 病例，进入原 deploy Actions glob，
  当前未执行；包括已有服务不重初始化/重注册、阻断传播和秘密不回显。
- `docs/development/deployment-setup-v1.md`、README 和 Compose schema 注释同步；
  原 preflight API、原 bootstrap/enroll/steady owner 及保护历史不改变。

### P2 已发现的兼容约束

`IdentityService.changeMember` 可为新账号设置初始 Token，但明确拒绝通过成员命令
替换现有账号凭据（ACCOUNT_CONFLICT）。账号可加入多个 Scope，Scope owner 不能
借本阶段界面获得替换其他账号全局 Token 的权力。成员页复用原命令；自助 Token
变更必须由账号本人认证并在原账号 owner 内单独设计 CAS/未知结果/审计，先记录 FR。

FR-0033 已接入 owner-only 成员页面：现有账号加入、新账号初始 Token、当前成员
修订、角色/移除、未知结果原键重放、25 行本地分页。原 API、事务、撤权及全局账号
凭据保护保持；`member-console-flow.test.mjs` 的七项病例只撰写，完整 asset/浏览器
及 MySQL/Runtime 证据尚未执行。其完整调用链见 Web PRODUCT-INTEGRATION。

FR-0034 的本人凭据已串行接入：原认证 -> 账号事务内当前 hash 复核/SQL CAS ->
本人审计原子提交；`GET/PUT /me/credentials` 与 account-credentials 页面不接受
Scope/账号覆盖。新 Token 由本人事先保存，未知结果只显式核对原新/旧凭据；不增加
账号凭据的第二权威或伪造 Scope 幂等账本。历史只表示本人轮换，不冒充原运维恢复
记录。模块 Identity3、HTTP3、CredentialStore1、UpgradeAssessment6，迁移 0042
和 Control profile adp3-account-credentials-v1；Agent/旧 profile ceiling 不变。
七项 owner、两项 HTTP、六项 Web 与一项真实 MySQL 病例已撰写，尚未执行；条件
数据库跳过不能作为接受。新 SQL 病例待冻结验证时接入原 phase1 MySQL 作业。

### P3-P6 源码交接

- P3/FR-0035：原 payload gate -> 原锁内 Journal 消费事实 -> 原 Runtime Report ACK ->
  独立可选 `/agent/v3/resource-usage` -> 当前 mTLS／会话／已接受 report 引用 ->
  原事务中的有界 SQL 派生投影 -> SharedResourceLimits 原查询 -> 页面。扩展失败
  不改变 Report 结果、租约或扣额；旧读者保留 unknown。十进制计数、monotonic、
  回放、rollback、历史桶、过期／政策漂移、当前与未来周期病例均已撰写。
- P4/FR-0036：管理端原 Forward Probe 命令 -> 原 planner／permit -> 同一 Gate slot
  的 Echo qualification -> mTLS poll／claim／status -> 原 Agent executor／受控签名服务
  -> 原结果验证与历史。默认关闭；旧 v1-v3 不消费 Echo，原预算／硬截止／撤销／
  UDP idle 与真实 payload 扣额保持。受控 Responder 仍需独立部署及真实网络证据。
- P4/FR-0039：`tcp-path-echo-v1`／`udp-path-echo-v1` 的位置是
  `agent-local-forward-ingress`；原 Node 逐角色授权、Relay assignments、locking
  published Snapshot 与原 ticket／真实 listener 共同限定完整路径。旧五项协商
  保留，七项扩展和 path flag 显式开启；旧读者拒绝，不改 Direct 位置。路径变化、
  旧 endpoint、缺能力／资格、重复 claim、签名绑定和页面回执病例已撰写。
- P4/FR-0037：StationResourceFacts 在原 Station 事务读取公开额度 owner，配置
  schema2 的 shared-usage-high／shared-period-ending。精确比例；缺测／过期不
  触发用量恢复，下一周期使旧 episode invalidated。原 event／handoff／通知
  outbox 事务保持；新增真实 SQL 病例覆盖事件插入后 handoff 失败回滚与无重复。
  该病例验证 handoff 边界，完整真实外发／浏览器证据仍待 Actions。
- P5/FR-0038：task-workflow 的 guide 只导航，batchProgress 只投影原批次／Operation。
  明确启动后最多六轮、间隔十秒，前一轮结束后再安排下一轮；切页、切账号、隐藏、
  错误、停止均终止。原 GET 接收可选 signal／currentness，原 mutation 无自动重放。
- P6：手册给出安装、保留状态升级、原 maintenance／backup／restore／resume、
  独立主机故障、分档负载、24／72 小时长稳与失败保留格式。inventory 默认未审阅，
  placeholder 无法通过原 collector；没有生成任何通过结果或容量数字。

### 当前接口与迁移

P4/FR-0040 另补最近受控路径样本条件：原 Probe history 公开 `readIn` -> 原
principal／Forward 读取权限 -> 原签发者在 locking planner 中重新授权完整路径与服务
-> 同事务 StationPathFacts -> 原 Station event／handoff。最多读取 26 行，最新匹配
样本缺失时不退回旧成功；签名成功样本在当前声明下复核，撤权／绑定变化不可沿用。
配置 schema3 明确样本最大年龄 30–300 秒与耗时上限 1–2000 毫秒，判断的是最近
历史样本，不延长原结果 validUntil、不承诺实时健康／丢包率／SLO。恢复要求新的
成功样本；绑定变更 invalidated。owner／reader／事务桥病例已撰写，尚未执行。

| 公共入口 | P 集成源码版本 |
| --- | --- |
| Control HTTP／detail／startup | 6／4／3 |
| Identity／AccountCredentialStore | 3／1 |
| ResourceLimit module／ResourceUsageStore | 3／1 |
| Probe module／owner／machine API | 5／3／3 |
| Forward Probe API／capability API | 4／3；Direct matrix DTO1、路径扩展 DTO2 |
| Probe history module／API | 3／3 |
| Station module／API | 3／4；旧规则 schema1，额度 schema2，最近路径样本 schema3 |
| UpgradeAssessment | 10；Control 新 ceiling 0042–0046，旧 ceiling 不变 |
| Agent CLI／command／nativeexecution | 2／2／3；默认新开关关闭 |

新增五项迁移只由原 owner／明确 adapter 管理：0042 本人凭据事件，0043 用量派生
heads／samples，0044 原 Station rule enum，0045 原 Probe permit/history enum/check，0046 原 Station 样本告警 rule enum。
没有新 Runtime ledger、Agent authority、消费权威、自动换线或清历史兼容入口。
旧模块别名继续指向原公共 owner；原构造位置追加可选开关／provider，默认保持原行为。
HTTP 的账号／Echo／用量 providers 是明确新增结构消费者；对应 substitution fakes 已
显式迁移。升级 plan 的 Agent profile 仍使用原 runtime／multihop／shared-resource。

### 审阅与验证边界

候选身份目前是上述基线上的 `source/p-product-readiness-20261024` 未提交工作树；
本文件和版本表不是不可变 source SHA。P 各病例为 authored，不是 passed。
旧版本断言、schema catalog ceiling、browser representation imports、Agent CLI flags
及固定 asset 消费者已作源码迁移，完整类型／语法／边界／parity／格式／编译尚未执行。
不能以本次源码阅读替代这些检查，也不能以旧 N 的 CI、标签或镜像验证 P。

原 deployment-tools 作业已加入 setup-plan 病例，原 MySQL 作业已加入本人凭据病例；
同一 shared-resource 文件包含 P 用量与额度事件 SQL 病例。新 owner／wire／Web
病例进入已有 glob；没有触发 workflow。获授权后先做允许的本地静态／编译，再为
准确候选保存／Actions 单独取得相应授权。独立主机和规定时长实验继续单独记账。
持续目标当前为 blocked：源码与验收准备已交付，执行验证待单独授权，独立环境
暂无可用资源。后续验证、环境与接受条件完成后才能标记整体 achieved。

源码收口补记：P4 Control 路径预检增加与原 Agent 具体入口检查相符的前置拒绝：
拒绝通配／metadata／multicast／原 ingress CIDR 不允许的本机地址，并核对已发布
ingress resource 的协议、地址和端口确实对应意图。原 Agent 校验不放宽；新增
拒绝和绑定不匹配病例仅撰写，未运行。这修正了“Control 先接受、Agent 必然拒绝”
的预检缺口，不是新增执行权限或独立网络证明。

接受矩阵的 PP-01–12 已有源码／契约病例和场景说明；PP-13–16 已有执行手册和
输入模板。表内 planned 指未来执行，全部执行证据仍未取得，不等于省略旧行为、
移动端、MySQL/outbox、namespace 或独立主机的接受义务。当前源码候选审阅完成后
才进入单独授权的集中验证；发现接口、迁移、旧读者或原 owner 链路失败时先修复，
不删病例、不放宽生产约束、不用历史绿灯替代本候选。
