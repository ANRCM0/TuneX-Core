# TuneX 当前实施进度

更新：2026-10-24（Asia/Shanghai）。

用户随后授权“合并整理，准备开始实机测试”。PR #118 已合并为 `dc03606`，本地主线
已同步；合并后 baseline `40100306844`、packaging `40100306837` 和自动开发镜像
`40100306858` 已启动，最终结论待记。当前阶段进入[实机测试准备](product-p-physical-handoff-2026-10-24.md)，
主机／拓扑／时段仍待提供，PP-13–16 未执行。下文保留合并前准确源码的验收证据，
不把其通过扩大为主线复验、镜像发布或实机通过。

## P 候选（69dcaa7 准确修订病例范围通过）

当前后继已补实际路径样本 -> Station/outbox SQL 病例，并修复最近路径通知将
Forward 误判为 Node 的私有解析缺陷；整条后继已在准确源码完整 Actions 通过。锁等待产物进一步
确认原 Runtime tick/report/snapshot 的排他锁阻塞 Probe。FR-0044 已先记提案，
新增原 Relay owner 的显式推进入口，在原事务内复用单次锁定输入，保留旧入口、
覆盖转接和当前时间拒绝；原 server 通过既有公共 RuntimeRelay 端口选择它。
新旧写入／输入次数、调用间刷新、到期／错误／覆盖及原生公共绑定病例通过；
旧 RuntimeHost4 不变，原构造可选 Relay 类型显式扩宽为既有公共端口。

[P 方案与持续目标](product-readiness-stage-p-2026-10-24.md)已在独立
`source/p-product-readiness-20261024` 工作树实施：安装计划、所有者成员页、本人
凭据轮换、原 Journal 用量投影、Direct／Relay／多跳受控 Echo、额度／周期／最近
路径样本告警、任务入口／有限刷新与原批次进度。FR-0033–0044、0042–0046 迁移、
契约／HTTP／SQL／Go／Web 病例及[部署质量手册](product-p-deployment-acceptance.md)
已撰写。唯一 Runtime ledger、Agent authority／Journal 与原事务 owners 保持。

准确验证源码为 `69dcaa710ee0298adde0656674b99c5cb6e1f2b8`，实际 PR 测试合并
`62b0b98` 与其 tree 相同。baseline `40069707791` 的 10 个作业及 packaging
`40069707745` 全部通过。契约主运行 2157 通过、150 数据库条件跳过，150 项均与
同候选 native MySQL 通过记录逐名匹配，缺失／原生跳过／失败为 0；Web 231 项与部署工具 30 项通过。真实成员／
凭据／有限刷新、Journal 用量投影、Direct/Relay/三节点签名 TCP/UDP Echo，以及
3/4/8 节点原生转发／浏览器／同机 namespace 故障通过。三节点 TCP 首条成功；
UDP 前三条新许可各到达响应端一次但未形成可接受结果，第四条独立新命令成功，
不能据此宣称首发可靠性或生产延迟保证。
真实额度 Station -> Notification outbox 的写后失败回滚、同事件去重和撤权后零
发送病例也已在该修订的完整 native SQL 作业通过。新增实际 47ms 签名 UDP 样本
经原历史／重授权到 Station schema3/outbox 的写后回滚、去重、陈旧 unknown 保留
firing 事件及策略停用零发送四项检查通过。陈旧使用病例时钟推进，不是实际长稳；
策略停用与成员撤权分开证明，外部投递未验。分项诊断仍有 236ms status／222ms
result 调用，连接获取耗时为 0ms；不能从输入读取减少推定延迟改善。
FR-0043 原 owner Node reader 的新旧投影、输入次数、旧方法覆盖及错误传播病例
已通过，FR-0044 原 owner 三遍完整输入／四遍 Node facts 降为各一遍的独立入口
病例通过，原有 Snapshot 读取失败／资源冲突回滚病例保持原样并通过。
完整范围、扫描 HIGH 观察项及早期失败见 [P 验证记录](product-verification-p-2026-10-24.md)。
候选已推送至草稿 PR #118，未合并、未发布镜像／标签；后续仅文档提交不继承
准确 head 的功能通过声明。整体目标保持 active。以下 N／B／C／D 仍保留历史证据。

2026-10-24 用户确认独立主机和长稳环境“暂无，先完成源码与验收准备”。本轮源码、
安装工具、病例、手册与输入模板已交付，真实环境执行单独保留为待办。其后用户明确
要求“使用action进行测试和验收”，已完成上述有界验证与必要修复。没有独立主机、
负载或规定时长证据，PP-13–16 的相关接受要求仍未满足；不复用同机短测关闭它们。

## N 产品开发阶段（配置内验证通过，已合并主线）

用户已授权按 PR-01–14 设置持续目标、具名代理在独立 worktree 并行源码开发；
主线串行整合共享契约、迁移和组合根。当前归属／用途／查询隔离、存量分类及账户
上下文已进入主线，个人与管理员资源界面、原 Runtime 端口限制、个人端口用量和
全 Forward 只读 Probe 支持矩阵已整合。用户已确认带宽／流量按每用户 × 共享机器、
双向有效载荷与显式周期计量；FR-0032 的政策、原 Snapshot／Runner／Journal 持久预扣、
原 TCP/UDP 引擎、配置 UI／审计、升级拒绝与公共示例已通过本轮配置内 Actions。
无需保存模板的直接组线已接入原 Relay 草稿，页面已补可信手工接入指引；
实际部署易用性尚待验收，三路具名消费者源码已交接整合。最新目录为 41 条迁移、
30 个 Control profile，JournalInspection2 和新增 Agent 预算 profile 的具名病例已在配置内执行。
带宽与额度余额目前不在线导出，页面显示 unavailable/null。当前授权内的源码切片
已通过 PR #114 的配置内验证并合并主线；独立主机、长稳／负载和实际部署保留单独门槛。
准确状态、调用链与剩余项见
[N 阶段台账](product-development-stage-n-2026-10-21.md)。

用户随后授权“好，开始进行测试”，本地完整类型、边界、生成一致性、Web 语法、
Windows Go 编译／vet 及 Linux、macOS 交叉编译已在修复后通过。
实际结果与准确修订 Actions 记录于
[N 验证记录](product-verification-n-2026-10-21.md)。用户进一步授权后已提交并推送，
第四轮候选 `6c51498` 的历史通过保留在验证记录。后续文档头复验发现并修复了真实
peer 过期后的恢复 fixture，最终候选为 `8738a97`，实际 PR 测试合并修订为 `c8e42bc`。
基线 `39962890329` 的 10 个作业及容器打包 `39962890327` 均通过。
147 个数据库条件跳过项已逐名匹配到本轮 MySQL 通过结果；MySQL 411 项和 Web 206 项全通过。
用户于 2026-10-23 授权提交合并，PR #114 已 squash 合并为
`9a5f7193554fb9f58b750358fc82fe0386ea6467`，与最终候选的源码树完全一致。
主线基线 `39968900422` 的 10 个作业及容器打包 `39968900303` 均通过，主线 147 个
数据库条件跳过项亦逐名匹配到同轮 MySQL 的 411 项通过结果。完整结论与工件见
[N 验证记录](product-verification-n-2026-10-21.md)。本轮仅 Markdown 的状态收口提交
不替换已测试实现修订，跳过的重复 CI 不记为新接受。自动镜像发布 `39968900519`
已取消且发布步骤跳过；本轮没有发布镜像或发行。
下列 B／C 的历史接受仅对各自所列冻结修订有效，不能作为 N 后继契约的当前证据。

## 当前结果

B 已完成当前公共接口与配置内环境的限定范围接受。
[readiness](foundation-readiness.md)的 220 项要求均有完整断言与适用执行结果，
详见[断言映射](foundation-b-assertion-coverage.md)和
[准确修订验证记录](foundation-verification-2026-10-19.md)。

| 身份 | 准确值 |
| --- | --- |
| 保存并推送的源码 | `e208a3abf17129b0c2898ba2022c69f60f45445a` |
| 实际 Actions PR 合并修订 | `c3ce8a67b901f61234b4116190409854818cb6c7` |
| 完整 baseline | 39341589653，10 个作业通过 |
| 容器打包 | 39341589509，通过；未发布镜像 |
| PR #112 | 已合并为 `5a764f7`；本轮未发行 |

源码包含四层分类、公共版本、当前消费者、默认与兼容入口、Control／Agent／Web／
资产／支持工具，以及 FR-0001–0027。B 修复保留原 owner：通知取消注册容量回收、
Audit 关联读取、队列发布续租时点、MySQL 原生 JSON 整数 expiry 及追加升级 profile。
Runtime ledger、Agent authority/Journal 与受保护历史继续由原 owner 维护。

## 执行证据

完整配置内 Actions 包含 TypeScript／Web、Go 全包/build/vet/race、边界与公开示例、
Windows 原生执行、macOS 明确不支持分支、MySQL/mTLS/回滚与并发、安全／恢复／容量、
Probe/Relay Chromium 和 3/4/8 节点 namespace 故障恢复，以及容器构建／拒绝／扫描。
逐项结果、条件跳过与实际运行号以验证记录为准，不能拼接旧修订绿灯。
本地仅执行获授权的静态检查，未运行功能、MySQL、网络或浏览器实验。

## 2026-10-20 C1–D2 源码批次

本节保留 2026-10-20 源码交接与检查时点。下述切片随后经 PR #113 合并为
`bc8507b`，并已包含在 N 主线中；dirty tree、草稿和未执行措辞均须按相应时点阅读。

该时点的未提交工作树已写入 C1–C4/D2 的只读 Web 切片：

- C1 状态解释：Forward 列表增加运行状态摘要；分层诊断增加 Operation/Listener/
  Probe/清理计数与 partial/stale/unknown 说明。摘要来自既有 `GET forwards/:id`
  与诊断响应，不新增权威或健康结论。列表当前按可见行逐条读取（最多 25 条），
  未新增批量契约；D1 需测量该读取模式，若成为瓶颈再加批量读模型。
- C2 能力预检：转发表单按已加载 Node Policy 展示逐节点可选/不可选/未知原因；
  平台、角色、flag 未单独上报时保持 unknown，提交仍由服务端独立校验。
- C3 指标解释：四族 telemetry 与聚合面板增加来源、delta、coverage、freshness
  和缺测语义说明；不新增采集、聚合或健康判断。
- C4 运维闭环：概览增加当前页失败 Operation、报告过期/撤销节点、审计/告警/
  通知/执行记录入口与数据库失败不补零说明。
- D2 固定拓扑入口：概览增加路径模板、候选组/手动切换、持久发布、入口迁移的
  统一导航；不改变 Path/Ingress 命令、CAS、补偿或 Operation 语义。

D1 仅记录[负载基线评估方案](load-baseline-2026-10-20.md)，未执行负载、长稳或
资源实验。本批行为参考 ForwardX `0f8d096`（2.3.286，AGPL-3.0-only）的状态计数、
预检和指标语义，但为 TuneX L2 独立实现，未复制源码；临时参考克隆已清理。
本轮源码完成后，已按 2026-10-20 验收授权执行本地单测、类型、边界、契约、Go
构建/UDP smoke（结果见下），并提交为分支 `verify/c1-d2-20261020` 通过配置内
Actions/容器验收（见下节）。独立物理主机和长稳/负载实验未执行。D1 仍未执行；
不得据此宣称正式发行或完整 D2/跨环境验收。

计划验收覆盖（完整验收仍需相应环境执行）：C1 覆盖 Direct ready/partial/unknown、过期/缺失报告、
多节点计数、truncated、迟到响应不覆盖新结果；C2 覆盖撤销、凭据过期、报告过期、
缺能力、未知 Policy 及服务端拒绝；C3 覆盖 baseline/gap/counter-reset/historical/
unavailable/overflowed/terminal、coverage 截断与缺测不补零；C4 覆盖失败 Operation、
过期节点、权限裁剪、数据库/请求失败和只读导航；D2 只验证现有 Path/Ingress 入口、
CAS/补偿/Operation 语义未变及人工切换导航。

## 2026-10-20 C1–D2 本地验收

测试树为 `84d1a35` 加本批未提交变更（dirty tree，无独立提交）。结果：

| 命令 | 结果 |
| --- | --- |
| `npm run test:web` | 166/166 通过，0 失败 |
| `npm test` | 1936 通过，153 跳过，0 失败 |
| `npm run typecheck` | 通过 |
| `npm run test:boundaries` | 952 个源文件检查通过；18/18 测试通过 |
| `npm run contracts:check` | 通过 |
| `npm run test:go` | 全包通过 |
| `npm run build:go` | 通过 |
| `npm run test:udp-smoke` | 2/2 通过 |
| `node scripts/verify-offline-plan.mjs` | 通过 |

新增测试合计 13/13 通过（`forward-status.test.mjs` 7 项、`forward-preflight.test.mjs`
6 项）；`console-module-assets` 验证新增 `forward-status.js`/`forward-preflight.js`
的固定路由、安全头和字节一致性。`npm test` 的 153 个跳过仍是数据库条件项，不是数据库
通过；本地未执行 MySQL/mTLS、浏览器、Actions、容器、独立物理主机或长稳/负载
实验，D1 仍未执行。该证据绑定 dirty tree，不能替代准确提交修订的 Actions 验收，
也不代表正式发行。

## 2026-10-20 C1–D2 Actions 验收

C1–D2 源码已提交为分支 `verify/c1-d2-20261020`，草稿 PR #113，通过配置内
GitHub Actions 在**确切修订**上完成功能验收：

| 身份 | 准确值 |
| --- | --- |
| 被测源码修订 | `8172791d31a0f8f92d7bd76a26523c5a67dcda95` |
| CI run | 39374960189，`success` / `completed` |
| 容器 run | 39374960192，`success` / `completed` |
| 追加文档提交 | `01b2645`（仅 docs，父提交 `8172791`） |
| 文档提交 CI/容器 run | 39378382526 / 39378382574，均 `success`，11/11 通过 |
| PR #113 | 上述候选通过后于 2026-10-20 合并为 `bc8507b`；未发行 |

11 个作业全部通过、无失败无重试：`contracts`(4m30s)、`deployment-tools`(10s)、
`windows-agent`(1m20s)、`unsupported-platform`(1m5s)、`probe-workflow`(3m53s)、
`relay-isolation`(8m29s)、`multihop (3)`(8m6s)、`multihop (4)`(10m41s)、
`multihop (8)`(30m19s)、`phase1`(20m23s)、`containers`(1m32s)。覆盖 8 节点
namespace 故障恢复、Windows 原生执行、macOS 明确不支持分支、MySQL/mTLS/回滚、
Probe/Relay Chromium 与容器构建。发布类 workflow（images.yml / candidate-images.yml）
未被 PR 触发；上述候选验收时未发布镜像、未合并 PR、未打标签或正式发行。
PR #113 随后合并的事实另见表内记录。独立物理主机、长稳/负载
（D1）仍未执行，`multihop`/namespace 证据共享同一 Linux runner，不构成独立平台或
容量证明。

## 后续进入条件

后续模块可消费上述冻结公共接口或经过独立验证的后继修订；任务仍需明确授权，
采用独立分支／worktree、模块目录、公共入口、契约测试和集成说明。当前 main 已
包含 PR #112（`5a764f7`）、PR #113（`bc8507b`）和 PR #114（`9a5f719`）；
各阶段的接受范围仍绑定各自准确修订，不以旧 A5 或 B 的结果替代 N 后继验证。
C1–C4/D2 的源码切片已在分支 `verify/c1-d2-20261020`（修订 `8172791d`）通过配置内
Actions 验收，PR #113 已合并；D1 负载与独立物理主机证据仍未执行。后续顺序见
[开发方案](development-plan.md)与[下一阶段目标](next-milestones.md)。

独立物理多主机、长稳／负载、独立 Responder 构建发布、正式发行与生产就绪
仍需各自证据。多 Agent／namespace 共享同一 Linux runner；IPv6 等原测试的
环境条件分支不构成独立平台证明。公开示例是无执行授权的预览，不能替代部署验收。

A5 的准确候选、测试修订与 PR #111 合并保留在验证记录。旧 V2、参考 checkout、
源码归档与过时盘点已经移出当前树；持久回归测试、迁移、Schema、fixtures、
公共契约和 FR 继续保留，本轮只清理临时 JSON／脚本／下载日志。
