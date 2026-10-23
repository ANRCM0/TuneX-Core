# N：多用户自助转发产品开发阶段

开始日期：2026-10-21（Asia/Shanghai）；交付收口：2026-10-23。
PR-01–14 的具名源码切片已整合。最终候选 `8738a97` 的基线 `39962890329`
全部 10 个作业及容器打包 `39962890327` 均通过，实际 PR 测试合并修订为 `c8e42bc`。
PR #114 已合并为主线 `9a5f719`，与候选源码树一致；主线基线 `39968900422`
的 10 个作业和容器打包 `39968900303` 亦全部通过。条件跳过对账与完整工件见
[N 验证记录](product-verification-n-2026-10-21.md)。独立主机、负载、安装部署和发行
仍保留各自门槛。
阶段基线：`01b264509a0aa50a261b8cb2cf0b866c282f9818`，保留开始前的全部文档修改。

## 目标与授权

本阶段独立于历史地基 B 与 C／D 的交付记录，以
[产品需求基线](product-requirements-and-gap-analysis-2026-10-21.md)的 PR-01–PR-14
为需求索引，逐项完成多用户私有资源、管理员资源授权、自由组线、自助转发、额度、
探测监控和故障处理的源码闭环。用户于 2026-10-21 明确要求：

> 把这一整个阶段定位为新开发阶段。以逐项完成重点为目标开始进行。设置目标，派代理并行进行，开始。

已建立持续目标。该指令授权本阶段必要的源码、文档、契约病例撰写与具名代理并行；
冻结后集中执行验证、commit／push、合并、镜像及发行仍按各自授权和证据记录。
源码实现、主线整合、静态验证、准确修订 Actions、独立环境与发行分别记账。

用户随后以“好，开始进行测试”授权本候选的集中验证及必要修复。本地按仓库约定
执行静态、类型、边界、生成一致性、格式与编译／vet；功能、MySQL、网络、浏览器
及容器证据进入 Actions。该指令没有单独开放 commit／push、合并或发行。
当前执行情况另记于 [N 验证记录](product-verification-n-2026-10-21.md)，不修改历史
B／C／D 的接受修订或通过数量。

用户随后明确同意保存并推送测试候选、创建草稿 PR 和执行 Actions，以及必要的失败
修复。此授权包含后续修复提交与重测；不包含合并、镜像发布或发行。

用户于 2026-10-23 另行授权“提交合并”，PR #114 随后合并。用户继续授权“好，收口”，
本轮据此核对主线最终 CI 并同步交付状态文档；这不扩展为独立环境、负载或发行授权。

## 阶段顺序

| 阶段 | 对应需求 | 当前交付重点 | 源码状态 | 验收状态 |
| --- | --- | --- | --- | --- |
| N1 归属、授权与可见性 | PR-01–04、06–07、14 | 明确私人／管理员资源、用途子集、规则／线路归属、个人查询与存量分类 | 原 owner、迁移、HTTP 与具名消费者已整合 | 最终候选配置内契约／MySQL 通过 |
| N2 自助使用与自由组线 | PR-05–07、13 | 我的资源、接入、直接组线、保存线路、原命令变更与状态说明 | 账户、个人前台、管理员入口、直接组线和可信手工接入指引已整合；实际部署易用性待验收 | 最终候选具名 Web／浏览器病例通过 |
| N3 管理员资源限制 | PR-08–09、14 | 端口、带宽／流量额度与原资源及执行链接线 | 端口政策及个人用量、共享机器双向 payload 政策、原 Snapshot／Runner／Journal 预扣、管理页与个人配置读取已整合 | 最终候选契约／MySQL／Go 病例通过；未验证长稳负载 |
| N4 探测监控与排障 | PR-10–12、14 | 隔离后的原遥测／诊断整合与必要测量补齐 | 个人隔离和全 Forward 只读 Probe 支持矩阵已整合；未新增业务链路主动测量 | 最终候选具名契约／MySQL／Probe 浏览器病例通过 |
| N5 集中验证与部署质量 | 全部 | 逐项对齐 PA-01–12，准确修订验收与独立质量门槛 | 已关闭配置内失败，PR #114 已合并，准确主线复验通过 | 最终候选和主线配置内验证完成；独立环境／负载／部署／发行未开放 |

N1 对列表、详情与监控的隔离从第一条自助规则生效。N4 不是延后基本状态、隔离或
必要观测的理由。新切片复用已有 owner 和源码能力，不以重建框架作为默认前置工作。

## 并行分工与整合

三路代理使用从相同基线创建的独立 worktree；保留当前脏工作区及分支，不为代理
制造提交、切换或清理主工作树。代理只修改具名范围；共享端口、exports、schema
catalog、组合根和 HTTP 集成由主线明确分配并串行合并。

| 任务 | 所有权 | 工作树 | 整合前要求 |
| --- | --- | --- | --- |
| 节点归属／用途 | `node-owner`、Node authority/storage、原 grant effects | `product-node-ownership` | FR-0028 契约与角色调用点完整；不可只新增 DTO |
| 规则／线路归属 | `forward-owner`、`path-owner` 及其存储 | `product-rule-ownership` | 不可变产品 owner 与 authorization_actor 分开，原事务／历史读取保持 |
| 读取隔离 | Console／Control queries、Telemetry／Diagnostics 读取与 MySQL 投影 | `product-visibility` | COUNT／分页前过滤；共享机器完整报告不得泄露其他用户数据 |
| 主线集成 | FR、阶段台账、共同契约、API／组合根、迁移、余下 owner | 当前工作树 | 逐文件审阅并记录归属；未运行检查不标通过 |

本次并行是用户明确指定的具名源码任务，并不宣称后继公共接口已通过接受，也不
将正在改动的共享接口视为可任意供其他并行产品模块使用的冻结版本。

## 首轮设计决定

继续以同一 Scope 作为平台资源命名空间，在其中区分私有资源与管理员提供资源；
先不改变 Agent／Runtime 的 scopeId、资源锁与原事务不变量。同一 Scope 的 owner
承担该 Scope 内管理员资源分配与治理角色；普通可管理成员通过产品归属／授权
获得自助权限，不因 canManage 获得他人私有资源使用权。此选择不新增跨 Scope
共享或全平台超级管理员。后续如需要跨 Scope，共享须单独设计和接受。

旧数据明确标为未分类，不从 grant、Scope owner、authorization_actor 或最后修改者
猜测资源所有权；显式分类须 CAS、审计和明确存量 grant 处理。原凭据、租约、
authority／Journal、Runtime ledger 与保护历史保持原 owner。

## 状态更新规则

每项 PR 记录：所改 owner／接口、兼容入口、主线整合、病例撰写、实际验证修订和
剩余限制。无法完成的产品口径明确列出，不能以有源码或历史绿灯记作接受。
本文件建立时仅完成基线读取、阶段目标与任务分派；下列进展属于同一次授权内的
源码整合，不能扩展为执行验证或接受。

## 首批源码与调用链（源码交接快照）

本节及后续源码交接表保留撰写时点的 planned／authored／未执行状态，不表示当前
仍缺少配置内验证。后续准确修订及执行结果以文首和 N 验证记录为准；独立门槛不变。

| 需求 | 当前源码交付与原 owner 调用链 | 未关闭项 |
| --- | --- | --- |
| PR-01–03、14 | 私人 `nodes`／管理员 `shared-nodes` → NodeService → 原 Identity／Node authority store；用途缩减 → AccessChangeReconciler → 全路径 eligibility → 原 Forward／Runtime revoke／lease | 冻结后验证所有默认／别名构造、撤权重放及缺省用途兼容 |
| PR-04、10–11 | ResourceAccess 的原表 claim → Console／Control／Telemetry／Diagnostics／Probe read providers；COUNT、过滤和分页前区分 actor；共享整机报告与 Scope 淘汰计数明确不可见 | 授权 Actions 多用户详情、支持包、计数、游标与全部读取旁路病例 |
| PR-06–07 | 不可变 owner 与 authorization_actor 分离；原 Forward／Path／Ingress 事务完成分类 CAS、审计和回执；配置修订、执行 authorizer 和运行状态不因分类而改写 | 0039 中断迁移、外键／CHECK 与旧数据库/旧消费者兼容待验收 |
| PR-05、13 | Bearer → Identity.context（FR-0029）→ Scope 选择 → ownership 过滤列表 → 用途候选 → 精确 Profile／Endpoint → 原 Relay 临时草稿或 PathTemplate 显式发布／绑定 → Forward command → Operation／原状态说明；管理员治理页复用 shared-nodes／grant／五类分类原命令 | 页面已提供原 CLI 的可信接入步骤；二进制／CA／受保护目录和服务部署仍由运维提供。临时组线、移动端／键盘与未知结果流程待验收 |
| PR-08、14 | FR-0030：共享 Node grant portLimits → Node policy → 原 Runtime resources／exclusive reservations；按原 port_slots 与不可变 Forward owner 计算占用；NodeService.portUsage → 个人账本聚合 → 个人用量面板 | 范围、数量、Relay/Transit 自动选端口和缩减收敛均为未验证源码；不代表带宽／流量已限制 |
| PR-09、14 | FR-0032：管理员 payload-limits → SharedResourceLimits 原事务／Node 锁 → RuntimePayloadPolicy → 原 Snapshot 摘要／能力协商 → Runner 共用 gate → 原受保护 Journal 持久预扣 → 原 Direct／Relay／Transit TCP/UDP 写入路径 | 保守预扣可包含未送达字节；不提供在线已用／剩余值；旧离线授权按原租约／硬截止收敛；全部未验证 |
| PR-12 | FR-0031：原 Probe planner 的只读支持矩阵 → 原鉴权 HTTP → 所有 Forward 的“探测支持”入口；被动诊断和真正可派发的主动测量分别说明 | Relay／多跳业务主动探测仍不支持；本机 TCP connect 不证明外部或端到端可达 |

FR-0028 的 Console Node 投影明确 `resourceSource`、`ownerActorId`、`allowedRoles`、
`canUse`、`readDetail`；`canUse` 是当前读取的前提摘要，提交仍独立授权。普通用户的
Scope 级聚合淘汰计数使用 null 与 withheld 标记，不能补成零。
Web 的四项新表示层资产通过原 `/console` 资产适配器提供；ConsoleModel 接口版本
升为 2，Direct 决策拒绝缺少用途／可使用字段的旧响应。原模板 initializer 增加
`loadDraft`，保留原预览、回执和显式发布。详见 `apps/web/PRODUCT-INTEGRATION.md`。

管理员共享接入与个人私有接入使用不同原端点；两者的接入接口均没有幂等回执，
发送结果不确定时锁住下一次创建，核对后才能显式开始新请求。Grant 编辑从原
node-wide 修订和成员列表开始；保留限制时省略 `portLimits`，清空传 null，替换
传显式对象，零绑定上限不按空值处理。历史分类只能处理未分类记录，不转移已有
owner，也不通过改配置修订、执行 authorizer 或启动规则来完成记账。

个人端口查询仅当前私人 owner 或共享机器上的本人 grant 可读；治理身份不绕过
这项条件。查询不检查机器凭据或执行资格，因此仍有读取权时能解释撤销、超限及
退役中的占用。只返回物理绑定聚合，不返回其他用户、Forward 标识或槽明细；
`executionAuthorized:false`。数量超限与范围违规分别展示，null 区分未限额／不适用。
支持矩阵按显式选择或刷新读取，不新增轮询，不创建任务；账号／Scope 清理、
迟到结果拒绝和原 Direct TCP 命令选择分别保留。

首批具名代理已交接并停止生产源码修改，主线完成指定文件整合；后续只在明确分配
的测试源码范围迁移旧消费者。独立工作树保留，不制造提交或销毁交付源。
边界清单记录 FR-0028–0032 和新资产的源码归属。

直接组线通过 `lineBuilder.useDraft` → 原 Relay `loadPathDraft` 进入停用的新规则草稿。
它重新读取每一跳对应 ingress／transit／egress 的用途候选、精确 Profile 和能力开关，
不创建模板、不写配置、不预占端口；目标由用户填写，再走原预览与 Forward 命令。
另一路 `loadDraft` 仍进入模板编辑器，发布与应用分别显式操作。原 Relay 候选列表
新增用途选择，已选各跳分别按其真实用途读取，切换账号或 Scope 时清回入口用途。

Node 原始存储 `create` 只写 claim／enrollment；私人接入的初始 owner grant 改由
NodeService 在原事务中显式插入。共享接入不授予创建者隐式使用权，管理员必须
随后使用原 grant 命令授权。这一语义与产品来源的区别同时进入 FR-0028 和 Node 病例。

## 逐项需求状态（源码交接快照）

下表“整合”只表示交接时点的工作区源码，不等于当时已经测试通过、冻结接受或实际环境可用。
该时点全部 PA 病例仍为 planned／authored，未执行；后续配置内执行及准确修订见文首与验证记录。

| 需求 | 当前源码结果 | 后续接受与限制 |
| --- | --- | --- |
| PR-01 私有机器 | NodeService 普通接入明确 private owner 与初始本人 grant；其他主体不能由 grant 转成 owner | PA-01、12；存量分类与原别名/恢复需准确修订验证 |
| PR-02 用户与治理权限 | 私人使用与 Scope 治理分开；原管理命令保留停用／撤销／分类，不赋予私有执行资格 | PA-01、08、12；治理不会转移不可变 owner |
| PR-03 入口／中转／出口授权 | 独立 shared-nodes，显式授予用途子集；候选、Direct／Relay／Transit 原命令与续租接入用途 | PA-02、03、08；共享创建者也须显式 grant |
| PR-04 个人可见性 | ResourceAccess → Console／Control／Telemetry／Diagnostics／Probe 与引用；COUNT／分页前过滤，shared report 与 Scope losses 隐藏 | PA-04、09；具名查询／MySQL 旧病例已迁移源码，不宣称完整兼容 |
| PR-05 自由混用 | 用途选择器可将自有与获授权共享节点直接载入原 Relay 停用草稿；多跳仍检查真实开关和能力 | PA-03、05、11；原 Profile／Endpoint 是配置前提，选择不是授权 |
| PR-06 保存“我的线路” | PathTemplate／Group／Ingress owner 与显式分类；保存草稿、发布、引用和应用分别操作 | PA-05、08、12；保存不占端口或建立可达性证据 |
| PR-07 转发生命周期 | 原 Forward 创建／变更／复制／启停／删除／重试复用 immutable owner、CAS、幂等、Operation 与执行 authorizer | PA-03、08；不承诺无损更新或未知结果回滚 |
| PR-08 端口限制 | 原 Runtime slots → NodePortLimitPolicy；每人共享机器范围／绑定数与个人用量查询，内部／排空占用按原释放记账 | PA-06、08；并发、缩减、恢复、自动选端口均待实际验证 |
| PR-09 带宽／流量 | 按用户 × 共享机器 × 显式周期聚合双向有效载荷；原 Agent gate／Journal 先持久化扣额再写 socket，共用速率桶；政策 CAS、审计、配置 UI 已整合 | PA-07、08、12；未验证持久性／并发／网络；消费值 unavailable，不冒充精确送达计费 |
| PR-10 机器监控 | 复用原 Node／Host telemetry 与诊断，私人／治理完整读、共享使用者基础读分开 | PA-04、09；数据缺测和 Agent 可见 OS 边界保留 |
| PR-11 规则监控 | 原 Forward 流量／连接／实例、聚合、诊断、支持包按归属过滤；Scope 级损失可 withheld | PA-04、09；整机指标不冒充个人额度，缺测不补零 |
| PR-12 必要探测 | 保留原 Direct TCP／受控测量入口；所有 Forward 的只读矩阵说明命令开关、前提和观测位置 | PA-10；Relay／多跳业务主动探测仍不支持，矩阵不产生网络证据 |
| PR-13 普通用户入口 | 当前账户 Scope 发现、个人资源／转发／线路、管理员资源入口和页面可信接入指引 | PA-11；系统服务、发行安装包、账号注册／恢复仍非本前端切片 |
| PR-14 撤权与变更影响 | 用途／端口变更沿原 reconciler；payload 政策沿原 Runtime 发布，Runner 对新旧 drain 执行耗尽／到期停止 | PA-03、07、08、12；离线按原租约／硬截止，不声称即时物理清除 |

页面接入指引使用原 CLI 的 `--enroll` 与运行开关，只在交互终端输入 token，不生成
含凭据的命令、服务或日志。实际 Control URL、可信 CA、Agent 二进制、目录保护和
后台服务仍由部署流程提供。页面步骤、真实安装、运行报告、业务测量各自需要证据。

## 消费者源码交接（源码交接快照）

主线已整合以下具名消费者的后继源码；这里只记录撰写与接口迁移，不记录通过数。

| 范围 | 已整合的源码适配 | 未提供的证据 |
| --- | --- | --- |
| Node／Identity／Runtime | 明确 private/shared claim、真实用途与端口政策注入、不可变 Forward owner、原事务与初始 grant；别名／工厂和 MySQL 病例同步 | 并发、缩减、恢复、旧入口与真实 SQL 均未执行 |
| Forward／Relay／Transit | 新增 lockOwnership 等契约的显式替身、原资源／执行 host 接线与既有拒绝断言 | 未证明类型兼容、执行授权或资源清理效果 |
| Console／Diagnostics／HTTP | ReadPrincipal、ResourceReadAccess、个人／治理区分、NodeApi 九方法和独立 context/usage 查询 bag | 未执行 HTTP、分页或隐私场景 |
| Telemetry／Transport／Tunnel | 七个具名 owner/port/MySQL/HTTP 病例加入原事务身份、共享整机拒绝、个人 withheld losses 与分页前个人过滤 | 真实 MySQL 总数与页面行为仍待准确修订 Actions |
| Path／Ingress／Probe | 首批十一文件已交接整合：新 access/principal、template owner heads、classification writer、legacy dispatch、原批次 createdBy 与完整 Forward metadata/native 链 | 未执行默认构造、原顺序、CAS／审计、回滚、permit 或数据库病例 |
| 组／发布后续消费者 | 九个具名文件补 owner head、个人 count/page、分类 CAS/审计、公开 storage v2、批次创建者归属；保留保存点与原恢复归因 | 真实 SQL、完整声明一致性及旧代理接线未执行 |
| 治理接口后续消费者 | 九个具名文件明确 Scope owner 和同 Scope can_manage 成员的区别；Audit／Station／Notification／Observation 拒绝提前于受保护读取与写入，原 worker 对权限失效记录 suspension | 未执行真实 Identity、机器 worker、容量、失败或回滚病例 |
| Probe／Telemetry／NodeObservation 后续消费者 | 六个具名文件补原创建者计划/历史、个人 losses、独立读取策略、机器 intake 不调用产品读取授权；MySQL 对不同 manager 的拒绝和只读快照 | 未执行取消、连接释放、保存点、数据不变或 HTTP 病例 |
| 升级与公开示例 | 主线同步 41 条目录、30 个 Control profile、新 Agent 预算 profile／JournalInspection2；新增 0039–0041 中断 footprint；新增共享 payload 公共 provider 示例 | 不证明真实迁移、运行示例、准确修订兼容或接受 |
| Payload 执行与消费者 | Runtime／Transit 必需政策、TS/Go wire、原 Runner／执行状态／Journal、Direct／Relay／Transit TCP/UDP、HTTP／审计／UI 具名病例已整合 | 全部仅创作；并发、socket、崩溃／重启、降级和真实 SQL 未执行 |
| Web | 个人 context、用途候选、共享 DTO、临时／保存草稿、未知请求锁、Probe 矩阵与 null/withheld 元数据的具名病例 | 未执行浏览器、移动端、键盘或旧响应兼容验证 |

Path 发布批次继续使用自身不可变 createdBy，和模板／候选组 head 的业务 owner
分别记账；存储、ResourceAccess 与列表条件统一，不添加不存在的 owner 列或猜测
存量身份。Probe 支持查询在原 owner 内限制四个并发读，槽位跨全部 planner 调用
持有并在成功／失败后释放；新容量病例亦未执行。这两项属于当前源码修正。

本次 N5 源码续接由三路原具名代理分别收尾组／发布存储、治理接口及
Probe／Telemetry／NodeObservation 消费者；24 个具名测试文件已由主线阅读差异
并整合，代理停止本批修改。范围限定测试文件，未扩展生产契约。
主线先同步 UpgradeAssessment4 的 40 条迁移、29 个 Control profile 消费者，
随后 FR-0032 增至 UpgradeAssessment5、41 条迁移、30 个 Control profile 和显式
Agent 预算 profile。保留旧 profile ceiling 和 0038 的专门 CHECK 病例，
补充 0039–0041 已有 footprint 但无迁移收据、缺失 footprint 的拒绝场景。
真实 MySQL 病例继续使用 SELECT-only 检查连接及数据库／文件不变断言。
公开 import-preview 示例没有读取保存资源，源码合同保持不变，其说明明确
预览不会证明资源归属或获得发布权限。上述病例和示例仍未执行。

这些具名迁移不等于所有消费者已关闭，也未宣布源码冻结。完整旧入口、公开示例、
源码版本／SQL 断言、资产和准确修订接受仍须按 N5 收口；历史 B 的断言和执行数量
保持原记录，不能据此次源码变化直接改成后继接受结果。

三路原具名代理的源码交付已由主线整合，独立工作树保留为交付来源，未提交或
清理它们，主工作树分支保持原位。PR-09 曾因产品口径缺失将持续目标标为 blocked。
用户于 2026-10-21 明确回复“按此建议设计”和“采用建议口径”，该产品阻塞现已解除，
实际源码工作随后恢复。此前 blocked 记录属于这一产品阻塞的历史状态。
PR-01–14 的目标不变；消费者源码、冻结、集中验证分别记账。

## 已确认限额口径与实施边界

端口切片按用户 × 管理员机器的物理 `protocol + port` 占用计数，TCP/UDP 分开，
内部 Relay／Transit listener 与 draining/旧占用在原 owner 释放前计入。私有机器不
消耗共享 grant 额度。平台 `maxAssignmentsPerNode` 等上限仍独立适用。

带宽／流量采用用户确认的“每用户 × 每台共享机器”双向有效载荷口径，管理员显式
设置起止周期，可选月度但不自动续期。私有机器免扣，共享多节点各自计量。FR-0032
明确 bytes/s、bytes 与有界 burst、先持久化预扣再写 socket、UDP 整包与 TCP 前缀、
重启零速率 credit、不可清除的历史，以及原 Runner 对耗尽／零额度／到期的关闭。
既有入口遥测不反算硬余额；页面的已用／剩余为 unavailable/null。

政策配置只写自己的四张表，原 Runtime 仍是唯一资源账本；Agent 预算在原 MAC
Journal 中。旧实例和 drain 共用原桶，新周期不清历史；控制桶不授予 assignment。
离线 Transit 不支持这项执行扩展，受限共享资源在 staging 前拒绝。已经签发的旧
Snapshot／离线授权仍按原租约和硬截止有界收敛，不承诺数据库写入即刻停止远端。
首次从未计量配置为零／不适用周期或能力不支持时，旧未计量连接沿原 stop/drain
截止收敛，不追溯扣费；已有受限桶的 drain 接收同桶政策更新。页面保存配置不等于
远端连接已清除。这个兼容边界也须列入集中网络验收。
公开规范、完整 owner／兼容入口台账与公共示例见
[FR-0032](../changes/FR-0032-shared-resource-payload-limits.md)、
[payload 规范](../spec/shared-resource-payload-limits-v1.md)和
[示例](../../examples/shared-resource-limits/README.md)。

## 源码交接与集中验证入口（源码交接快照）

本阶段当前授权内的具名源码切片已整合，PR-09 产品决定不再阻塞实施。此处“交接”
指实现、契约、兼容入口和验收源文件可供审阅，不是全量类型／依赖图／运行兼容性
已验证。持续目标的源码交付可在此记为完成；N5 的执行接受和独立部署／发行门槛
继续保留。当前工作区仍未提交，没有用于接受的准确保存修订，不以基线 SHA 冒充。

| 病例 | 集中验证应消费的具名源码入口（非通过证明） |
| --- | --- |
| PA-01–02 | `node-resource-ownership.test.ts`、`resource-access-owner.test.ts`、`identity-context.test.ts`、原 Node／Identity MySQL 病例 |
| PA-03、08 | `product-rule-ownership-contract.test.ts`、`shared-node-port-limits-contract.test.ts`、原 Forward／Relay／Transit／Access owner 与 MySQL 病例 |
| PA-04、09 | 原 Console／Control／Telemetry／Diagnostics／Transport／Tunnel／Probe 历史的个人投影、计数与只读 MySQL 病例 |
| PA-05、11 | `product-context-flow.test.mjs`、`native-relay-complete.test.mjs`、`console-flow.test.mjs`、原模板／绑定／批量发布病例与公共示例 |
| PA-06 | `shared-node-port-limits-contract.test.ts`、`node-port-usage-contract.test.ts`、原资源 SQL／Transit 原事务病例 |
| PA-07 | `shared-resource-limits-contract.test.ts`、`shared-resource-limits-mysql-acceptance.test.ts`、TS/Go `shared-resource-limits`／`resource_limits` wire 病例、payloadbudget／executionstate／state／Runner／native 引擎病例 |
| PA-10 | `forward-probe-capabilities-contract.test.ts`、`probe-capability-matrix-flow.test.mjs`、原受控 Probe／TLS／Echo 病例 |
| PA-12 | `upgrade-assessment`／`upgrade-inspection-complete`／`upgrade-mysql-acceptance`、原受保护 Journal、恢复与兼容构造病例 |

以上按原目录归属消费，未给缺少执行的条目填入通过数。完整 HTTP provider 和路由
矩阵、逐资产真实字节／安全头病例、公共版本／类型病例仍须一起运行。Go 原生镜像
已按现有生成器源码的 nullable anyOf、定义顺序与别名规则手工同步；未运行生成器、
gofmt 或生成一致性检查，不能声称字节级生成 parity 通过。

现有 `npm test` glob 包含新 Control／contracts 病例，Web 与 Go 的原 glob 亦包含
新增文件。新 MySQL 病例在没有 `TUNEX_TEST_DATABASE_URL` 时跳过；未来验收须在
已授权 Actions MySQL 环境显式包含
`node --test apps/control/test/shared-resource-limits-mysql-acceptance.test.ts`，
不能把无数据库的跳过当作 SQL 接受。本次没有改动 CI 工具或启动工作流。

后续冻结／验证时先保存准确源码身份，再检查全部后继契约及生成资产，修复失败后
重新绑定实际测试修订；功能、MySQL、网络、浏览器和容器证据仍在 Actions。独立
物理主机、长稳／负载、实际安装部署和发行分别验收。源码交接不开放未经验证的
后继公共接口给其他并行产品，也不替代这些执行门槛。

以上“病例仅撰写、检查未执行”描述源码交接时点。后续测试授权已经开启 N5，
最新本地检查、失败修复和待执行项以 [N 验证记录](product-verification-n-2026-10-21.md)
为准。首个 N 候选已保存并推送为 `6bf8e3c`，后续修复保存为 `7854ad7` 和
`3168f87`、`6c51498`。各轮失败、修复、条件跳过和准确测试修订分别保留；第四轮
已关闭 MySQL Path binding 和 8 节点 Console 失败，147 个数据库条件跳过项均逐名
匹配到本轮 MySQL 通过结果。后续 peer 过期恢复 fixture 修复及最终候选 `8738a97`
的通过亦见 N 验证记录；PR #114 已合并为 `9a5f719`。文档提交不替换已测试源码的
身份，本轮没有发布镜像或发行。
