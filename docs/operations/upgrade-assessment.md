# 只读升级与恢复兼容性评估

## Schema 0037: Controlled Direct TCP/UDP Nonce Echo

2026-10-18 当前源码目标为 Control-only `adp3-probe-echo-v1`，上界0037、catalog37项，
末项 `0037-probe-echo.sql`。以下0036及更早章节记录当时范围，不是当前 ceiling。
Agent 仍只采用原 runtime/multihop compatibility Profile；独立 Probe v4 不是 Journal
格式升级。旧Control reader拒绝0037；关闭echo/services/ingress不是DDL回滚。

0037只增量扩展原许可和Run枚举，未修改旧迁移。历史列名 `tls_context` 现在可保存
TLS config1或echo config2完整context（JSON<=16384）；仅三种service-bound测量非空。
新 `echo_challenge` 仅TCP/UDP echo必有、JSON<=512，含原owner生成的nonce及精确
invocationDigest，不是用户payload或第二许可。原256预算、两秒、消费/withdraw/prune
和结果JSON4096限制不变；旧三类对象/hash不凭空增加echo:null或计数字段。

qualification新增nullable `echo_version=1`，须同时 `services_version=1`；同身份旧v2/v3
写入不得擦marker，新身份可重置。资格升级不续期、不复活撤销/隔离实例。Run新增
echo challenge、compact service selection、`result_echo`<=512及nullable请求/响应字节。
echoed/nonce-echo-verified必须256+256且有proof；unverified/nonce-echo-rejected仅记录
有界未验证返回；仅TCP确定connect失败可unreachable且0字节，UDP不允许该结果。
旧TLSproof与分类保持。原4096record、Scope1024、七天保留/loss均未放宽。

迁移明确替换0036具名 `probe_permit_tls_context`、`probe_run_result_classification`、
`probe_run_service_selection`、`probe_run_result_tls`，不搜索/删除未知约束；0036历史
自动命名CHECK风险仍须一并审阅。部分DDL/真实MySQL8.4约束名未验证，不能盲重放、
猜测修复或把只读catalog assessment当迁移完成。维护、备份与人工恢复审阅仍必要。

恢复沿原事务隔离服务head、qualification、permit、活动计划及Run provenance；完整
保留挑战、结果proof/计数、消费、预算、marker、不可变配置与Authority/Journal高水位。
不重放nonce、不退款、不恢复排程或资格；metadata修订耗尽使原恢复事务整体失败。
显式重新发布只推进当前metadata，不能重新授权历史许可；registry不控制独立responder。

Control `TUNEX_PROBE_ECHO` 默认0，须services/ingress/execution及明确一秒clock；Agent
`--probe-echo`默认false，须services/ingress/execution/registration。默认关闭配置不证明
实际资格或网络成功。UDP关闭Probe socket不立即释放原Forward association，仍由原
session/FD上限和idle生命周期收尾。nonce echo只证明本次受控返回，不证明业务应用健康、
独立邻接/公网观察、Relay/多跳、健康聚合或C3。全部仅源码编写，未运行检查、测试、
脚本、格式化、fixtures、网络/MySQL/浏览器、Compose/build/release、CI或Git操作。

## Schema 0036: Controlled Direct Ingress TLS

此前0036切片Control-only `adp3-probe-services-v1` 上界0036，catalog36项，末项
`0036-probe-services.sql`；原Agent runtime/multihop兼容Profile保持，Probe v3
是单独闭合机器契约。旧reader拒绝0036，关闭services/ingress开关不能撤销DDL。
旧迁移不修改，必须继续维护、备份及部分DDL footprint审阅，不盲目重放迁移。

原probe_permits measurement枚举加TLS，nullable tls_context仅TLS必有且JSON<=16384，
其余两类必须NULL；旧object缺键/hash不变。原唯一256预算/两秒/消费/prune/cascade
保持。probe_results仍JSON4096，不复制DER，v3按实际版本严格解析和核摘要；旧两类
v3报告明确service:null/tls:null，不据版本误贴TLS类型。

原probe_runs仅增加compact service_selection<=1024/result_tls<=512，枚举加
verified/unverified及TLScodes；TLSselection不可空、成功才带proof。0036显式移除
原0032第18个自动命名CHECK `probe_runs_chk_18`，再建具名完整分类CHECK，不自动
寻找/删除别的约束。实际MySQL8.4约束名与部分DDL尚未验收；部署名不符必须failclosed
人工review，不尝试猜测修复。record4096/Scope1024/七天/loss和原恢复sticky保持。

qualification只新增nullable services_version，原行NULL/对象缺键；明确v3注册才
设1。同一已qualified/current身份升级不延qualifiedAt/expiresAt，不另建slot；v2
不得降级或擦marker，revoked/quarantined不得重臂。原恢复qualified→quarantined
仍保留marker。Observation service exact metadata CAS/config revision/digest/window
每阶段由原owner复核，archive/republish/recovery均失效旧引用，不重建或退款。
原恢复事务继续保留config/audit/history/预算/Journal/Authority高水位；revision耗尽
整事务失败并人工审阅，不饱和推进、不跳过或归零，不自动恢复计划/资格。

Control services开关默认0，需ingress与execution及原一秒clock；Agent
--probe-services需原ingress/registration/execution且默认false，配置不是活性或时钟
证明。TLSrecords真实走原Forward并计payload，不能把零应用字节写成零业务流量。
本片仅源码编写，无检查/测试/fixtures/校验脚本/格式化/网络/MySQL/浏览器/build/CI或Git状态改动。
升级恢复、并发撤权、时间/字节预算、安全和物理/生产门禁都未验证。

## Schema 0035: Observation Service Declarations

新增 Control-only `adp3-observation-services-v1` 上界0035，迁移目录35项、末项
`0035-observation-services.sql`。此前0034 typed Probe 记录保持历史范围；原 Agent
runtime/multihop compatibility Profiles、ADP/Probe 执行协议和 Journal/high-water
不变。独立 TLS-only operator responder 不是 Agent compatibility Profile，不因此
声明任何 Probe TLS 客户端或新执行端口已实现。旧 reader 拒绝0035，即使 registry
无记录或 responder 未启动；关闭功能/归档不等于 Schema rollback。

0035 只增加有界 Scope 锁/审计损失、服务 metadata head、不可变 config revisions
和独立 owner 审计。原迁移不重写，DDL/部分 footprint 检查与备份/维护/恢复的人工
复核继续；仅目录/Profile 更新不是实际迁移、备份存在、可自动降级或已批准恢复。
半应用表/索引/check/FK 足迹必须按原只读评估流程识别，不启动普通服务来补DDL，
不因可查询数据就跳过迁移顺序/完整性或重放半应用迁移。

原恢复 quarantine 事务 sticky 隔离非归档服务 head，保留 immutable config/digest/
历史和归档事实。
metadata revision 耗尽由 Schema CHECK 阻断整个原 quarantine 事务，保持维护隔离并
人工审阅；不饱和、不跳过 CAS advance、不回绕或清历史。必须明确当前 manager
重新发布满足当前有效期/证书约束的配置，
才可清 recoverySuspended，不自动 resume/renew。历史 revision GET 仍只是声明；
未来 issuer/watch 必须匹配 current head/configRevision/digest、当前授权/NodeGrant/
policy/window。Registry 恢复/归档不会远程关闭独立 responder，也不承诺本片尚未
接入的在途测量撤权。现有 Probe/Runtime/Authority 安全事实不退款、不清计数或高水位。

此片没有运行测试、静态/类型/语法检查、脚本、生成器、格式化、fixtures/CI 扩展、
网络、MySQL/恢复、容器 build/release、浏览器、提交或推送。35目录和 Profile 是
未验证源码，不能代替最终 SHA 的升级/恢复、身份/证书、并发/审计、进程关闭及容量
集中证据；D1/C3、物理/生产与正式发布门禁仍未通过。

状态：实现与 Actions 回归已接线，新增切片等待对应提交的运行结果。
评估不会启动服务、执行迁移、签发授权、迁移 Journal 或执行恢复。
它不是发布批准，也不是原子多主机备份。

## 入口与结果

```sh
npm run ops -- assess-upgrade /secure/upgrade-plan.json
```

配置 `DATABASE_URL`、`TUNEX_CONTROL_STATE`、`TUNEX_CA_CERT`。建议使用仅有目标库
`SELECT` 权限的数据库账号，并只读挂载 Authority、密钥、CA 和计划文件。
Control 镜像包含 `scripts/ops`，可通过 `--entrypoint node` 执行
`scripts/ops/cli.ts assess-upgrade <plan>`；不会调用服务启动入口。
MySQL 客户端和真实 backup/restore 的外部工具要求不因此改变。

数据库采集使用 `REPEATABLE READ` 的只读一致性事务，不调用 `migrate()`、
不获取迁移锁、不初始化 Authority、不接触 Agent 网络。Authority 前后 sequence
变化要求重采；DDL 元数据变化拒绝本次采集。文件、节点和迁移历史有明确大小上限，
不会截断清单后仍给出兼容结论。

| 退出码 | decision | 含义 |
| --- | --- | --- |
| 0 | `compatible` | 当前已检查的静态组合没有发现冲突；不批准执行 |
| 1 | `blocked` | 不兼容、数据不完整、损坏、越界或采集失败；禁止借此启动目标 |
| 2 | `review-required` | 需要补齐 Journal、停机 DDL、显式迁移或人工恢复/回退复核 |

所有结果都保留 `runtimeReady:false`、`productionApproved:false`。
`unchecked` 不因退出码 0 自动通过；尤其不证明备份存在、时钟同步、
历史租约耗尽、全部签发者停止或真实流量健康。错误输出固定脱敏，不回显数据库 URL、
底层连接错误、私钥或原始 Journal。

## 计划与身份边界

从 [示例计划](../../deploy/upgrade-plan.example.json) 准备受控副本。
示例的 `a/b/c` SHA/Digest **全部是假值**；不能作为任何镜像的身份证明。
计划严格拒绝未知字段、重复 JSON 键、标签代替 Digest、未知 Profile 和不安全计数器。

- `operation` 为 `upgrade`、`rollback` 或 `recover`。
- `source` / `target` 分别包含 Control、Agent 的完整源码 SHA、镜像 Digest 和兼容 Profile。
- 当前一次计划描述一组统一的源/目标 Agent 镜像；异构版本集群需按部署组独立审阅，
  不能把一个组的镜像声明当作全部主机事实。
- `controlMultihop` 表示目标 Control 是否启用多跳；`agentMultihop` 表示目标 Agent
  是否保留 `--multihop`。两者不能混为同一个开关。
- `journals` 合并每个原 Node 的检查摘要，最多 1000 个。缺失 Node 的摘要要求复核，
  外来或重复身份拒绝。超过规模上限需扩展采集方案，不能删除清单项绕过。

源码、镜像和 Profile 是**操作者声明**，不是本工具独立测量的容器身份；
输出保留 `identitySource:operator-declared`。摘要也没有跨主机认证链和新鲜度证明。
必须另行核对镜像/二进制实际身份、导出来源和时间，禁止把修改后的摘要当作安全证据。

## Agent Journal 检查

使用本切片或之后支持此入口的 Agent 二进制，在原主机读取原状态：

```sh
tunex-agent --inspect-journal --node node-a \
  --state /var/lib/tunex-agent \
  --journal-key /run/tunex-agent-secrets/journal.key
```

命令不需要 Control URL、CA 或在线会话，不创建 instance lock、不绑定端口。
它复用 Runtime Journal 的 MAC、协议、Snapshot 和物理 Fence 校验器；
读取前后内容变化则失败，可在受控窗口重采。不要同时传入 enrollment、
轮换、`--multihop`、Transit import 或 diagnostics 等改变状态的选项。

输出仅有协议/扩展、Node、generation、摘要、最大 Fence/retired 和是否导入 Transit
历史；不导出私钥、MAC、地址或完整快照。这份摘要**不能恢复原 Journal**。
检查已迁移 Journal 时不需要 `--multihop`；实际运行服务时仍须保留相应支持。
旧二进制没有该检查入口时，用已审阅的新检查器只读读取，不能先启动新 Runner。

## 兼容矩阵

Profile 是保守的显式兼容契约，不从 `0.1.0`、tag 或 SHA 大小推断先后：

| Profile | Control Schema 上界 | Agent Journal |
| --- | --- | --- |
| `adp3-runtime-v1` | `0012-transit-delivery.sql` | ADP/3，未迁移执行扩展 |
| `adp3-multihop-v1` | `0013-multihop-execution.sql` | ADP/3，基础 Journal 或执行扩展 1 |
| `adp3-probe-registry-v1` | `0014-probe-instances.sql` | 仅 Control Profile；Agent 仍使用前两种之一，Journal 未变 |
| `adp3-probe-permits-v1` | `0015-probe-permits.sql` | 仅 Control Profile；增加内部许可/签发预算，Agent Journal 未变 |
| `adp3-probe-withdrawals-v1` | `0016-probe-permit-withdrawals.sql` | 仅 Control Profile；保留消费事实并增加独立撤销标记，Agent Journal 未变 |
| `adp3-probe-results-v1` | `0017-probe-results.sql` | 仅 Control Profile；增加有界 Agent 上报结果回执，Agent Journal 未变 |
| `adp3-path-templates-v1` | `0018-path-templates.sql` | 仅 Control Profile；增加不可变路径模板元数据/归档/审计，Agent Journal 未变 |
| `adp3-path-bindings-v1` | `0019-path-bindings.sql` | 仅 Control Profile；增加原 Forward 同事务来源/当前指针，Agent Journal 未变 |
| `adp3-node-telemetry-v1` | `0020-node-telemetry.sql` | 仅 Control Profile；增加独立 Node 进程指标读模型，Agent Journal 未变 |
| `adp3-forward-telemetry-v1` | `0021-forward-telemetry.sql` | 仅 Control Profile；增加独立入口累计遥测与有界原始历史，Agent Journal 未变 |
| `adp3-host-telemetry-v1` | `0022-host-telemetry.sql` | 仅 Control Profile；增加独立 Agent 可见 OS 指标与有界原始历史，Agent Journal 未变 |
| `adp3-probe-telemetry-v1` | `0023-probe-telemetry.sql` | 仅 Control Profile；增加独立 Probe 实际尝试累计与有界原始历史，Agent Journal 未变 |
| `adp3-telemetry-rollups-v1` | `0024-telemetry-rollups.sql` | 仅 Control Profile；增加四族精确series聚合、预算/损失/前驱；Agent协议与Journal未变 |
| `adp3-path-groups-v1` | `0025-path-groups.sql` | 仅 Control Profile；有界路径组及原 Forward 同事务分组来源，Agent 协议与 Journal 不变 |
| `adp3-path-publications-v1` | `0026-path-publications.sql` | 仅 Control Profile；人工持久批次、单项接受/拒绝与条件补偿回执，Agent 协议与 Journal 不变 |
| `adp3-ingress-groups-v1` | `0027-ingress-groups.sql` | 仅 Control Profile；不可变入口组及逐项原 Forward 创建/条件删除的持久批次，Agent 协议与 Journal 不变 |
| `adp3-ingress-migrations-v1` | `0028-ingress-migrations.sql` | 仅 Control Profile；精确历史来源、完整定义差异及显式 add/update/remove 迁移批次，Agent 协议与 Journal 不变 |
| `adp3-station-alerts-v1` | `0029-station-alerts.sql` | 仅 Control Profile；独立站内告警策略、观察状态、事件与管理审计；没有 Agent 协议或 Journal 变更 |
| `adp3-notification-endpoints-v1` | `0030-notification-endpoints.sql` | 仅 Control Profile；通知端点配置、opaque 凭据引用与管理审计；独立文件凭据不入 SQL，无 outbox/投递 worker |
| `adp3-notification-deliveries-v1` | `0031-notification-deliveries.sql` | 仅 Control Profile；独立有界 outbox、尝试明细、持久限速与丢失计数；默认关闭，不改变 Runtime/Agent/Journal |
| `adp3-probe-runs-v1` | `0032-probe-runs.sql` | 仅 Control Profile；由原许可 owner 同事务捕获的独立 ProbeRun 历史；不延长许可、不新增 Agent 协议或自动探测 |

当前 Control 源码启动迁移目录已包含 0032，不能将它声明为旧 Profile 来绕过
回退拒绝。Profile 只声明对应 Schema 可读，不证明模板绑定、切换或执行已验收可用。
既有 [默认关闭的 Probe 操作链](../decisions/0018-probe-production-workflow.md) 原先沿用 `adp3-probe-results-v1`，
该操作链本身不增加 0017 之后的迁移或 Journal 格式；0018/0019 来自独立路径元数据/绑定。
显式启用 Probe 时需审阅一秒集群时钟策略并让 Agent 重新协商；
关闭签发不是删除旧许可、立即撤销所有已接受任务或允许降级的理由。
旧库升至 0014/0015/0016/0017/0018/0019/0020/0021/0022/0023/0024/0025/0026/0027/0028/0029/0030/0031/0032 要求维护/备份/DDL 审阅；应用后即使 Probe/多跳/遥测/告警/投递没有启用，
低于相应 Schema 上界的旧 Control Profile 仍被评估器拒绝。示例计划展示 0015 来源升级至 0019 目标；
source/target 必须根据实际部署分别核验，不能照抄。

0016 为旧 consumed 记录补写撤销标记，保留原 closed_at，并将其作为撤销时间的保守下界；
这不声称旧消费时发生过新撤销操作。原回执不可执行，升级不能让它们获得新的执行资格。
CREATE/backfill 中断后不得自动重建或清空表来绕过；只读评估能识别表与迁移记录不一致，
不能证明行级补写完整或自动修复。维护窗口内复核后再决定恢复启动。

0017 仅创建 `probe_results`，不为旧许可生成结果，不回写消费、撤销或授权水位。
每个保留许可最多一份上报结果，随许可清理级联删除；不是历史监控表或健康权威。
既有恢复隔离继续撤销 consumed 资格，结果行可以保留，但不能据此恢复许可、健康或派发。
新表 DDL 中断同样要求审阅，不得清空 Authority/Journal 来绕过版本拒绝。

0018 增加 `path_templates`、`path_template_revisions`、`path_template_events`，
只保存 Scope 内不可变配置、终态归档与审计，不写 Forward、Runtime 或执行授权。
三表任意部分足迹与迁移记录不一致均拒绝；不能因功能未使用而删除历史或伪造迁移记录。
恢复保留所有模板/历史/归档事实，原幂等键仍由既有流程隔离；保留元数据不等于重新授权引用，
不得恢复为新绑定或自动展开规则。Agent 仍仅使用前两种 Journal Profile，新路径 Profile 不适用于 Agent。

0019 增加 `forward_path_bindings` 不可变来源历史与 `current_path_bindings` 当前指针，
和原 Forward revision/Operation/资源接受同事务保存。完整 SQL 备份必须同时保留两表、
模板修订/归档与原 Forward 历史；不清空/压缩来源历史来绕过每规则 64 条配额。
两表部分 DDL 足迹与迁移记录不一致要求审阅，不能假造记录、自动重放不完整建表或降旧读者。
现有恢复仍隔离旧请求键/身份/Grant/意图，路径历史仅供查询，不自动展开/重放历史 Snapshot、
创建新绑定或解除 `recovery_suspended`。显式新绑定拒绝恢复挂起的 Forward；原恢复工作流另行审查。
归档/保留来源不续期运行授权，关闭功能也不允许回卷 Authority、Journal 或 Fence/Generation 高水位。

0020 增加 `telemetry_heads` 和 `telemetry_points`，仅保存独立 Agent 进程采样、
累计计数接收检查点与原始历史。原始查询按 24 小时窗口过滤、每 Node 最多 8640 点；
过期物理清理每批最多 256 行，维护/容量受限时可能滞后，不承诺精确 TTL 删除时刻。
本切片没有分钟/小时聚合、主机指标或规则 payload 统计，不能用于结算。
新旧 ADP/3 Agent 均可继续使用原机器协议；遥测是独立可选上报，不改变 Hello/report、
执行授权或 Journal 格式。未支持遥测的旧 Agent 显示缺测，不伪造零值或健康结论。
该 Profile 不能用于 Agent；Agent Profile 仍仅接受 `adp3-runtime-v1` / `adp3-multihop-v1`。
0020 应用后回退至 Schema 上界为 0019 的旧 Control 会被评估器拒绝，即使没有遥测点。
两表任意部分 DDL 足迹与迁移记录不一致均要求保留现场并审阅，不自动重建或伪造记录。
恢复在维护窗口、旧 Node/credential 已隔离的同一恢复事务内删除 `telemetry_heads`
接收检查点，并将既有 `telemetry_points.recovery_suspended` 标记为 true；不删除历史点，
不清除授权、Journal 或高水位。导入样本始终是历史资料，不作为恢复后新鲜状态或
跨恢复计数差分基线；完成既有恢复审阅后，必须经新的已认证会话提交新样本才能建立新基线。
该恢复标记不因读取或新样本到达而自动清除。

0021 增加 `forward_telemetry_heads` 接收检查点和 `forward_telemetry_points` 规范化原始点，
独立于 0020 进程遥测的 epoch/sequence 和状态。完整备份保留两表；恢复在原 Node/credential
隔离之后、同一恢复事务内删除该非授权 head，并将既有原始点标记 `recovery_suspended=TRUE`。
旧点不当作新鲜观察、计数连续基线或恢复执行授权；不清除原始历史、Journal、Authority 或高水位。
原始历史逻辑 TTL 为 24 小时，每 Node 最多 4096 点（包括恢复点）；容量淘汰可以早于 24 小时。
每点 body 最多 4 KiB，exporter metadata 最多 2 KiB，即每 Node 至多 24 MiB 逻辑 JSON；
行、索引、数据库 JSON 表示、SQL 日志及备份开销另计，不是物理磁盘容量保证。
过期清理每事务最多 256 点，逻辑 TTL 不承诺到秒物理删除，查询最多 512 点。
该 Profile 仅 Control 可用；独立可选遥测不改变 ADP/3、Agent Journal 或原机器会话协议。
已应用 0021 后回退至 0020 及更早 Control Profile 一律拒绝，即使开关关闭或表为空。
部分建表足迹、迁移记录不完整或恢复中断继续要求人工审阅，不通过重建旧状态绕过。
当前映射只读取原 Runtime 已发布/已退役 assignment 和同 session lease，不持有第二套执行权威。
新增入口、存储、Console 与部署接线均为未验证代码；集中补齐精确 SHA 的 Actions 和容量证据前，
不声称兼容、恢复或负载行为已被实际验证。

0022 增加 `host_telemetry_heads` / `host_telemetry_points`，完整备份包含两表；
原 credential 隔离后的恢复事务删除 Host 接收 head、标记旧点 `recovery_suspended=TRUE`，
不删除原始点或重置 Authority/Journal/高水位。独立版本不改变 Agent ADP/Journal Profile。
每 Node 8640 点含恢复历史，单点 body 8192 字节，至多 67.5 MiB 逻辑 JSON，不含物理
行/索引/数据库表示/日志/备份；容量可早于 24 小时淘汰，不能承诺完整保留窗口。
Schema 0022 应用后旧 Control 上界拒绝，即使开关关闭；部分 DDL/恢复中断依旧人工审阅。
此接线未检查/测试/Actions，不是已验证升级或恢复方案。

0023 增加 `probe_telemetry_heads` / `probe_telemetry_points`，不是原许可/claim/result
权威表或新的执行账本。备份两表；原 credential 隔离后清该接收 head、标记旧点恢挂，
不清原 Probe claim/result、Runtime 或保护历史。原始点含恢复数据每 Node 最多 4096，
24 小时逻辑 TTL、至多 24 MiB 逻辑 JSON（每点 4 KiB+metadata 2 KiB），物理开销另计，
容量可提前淘汰。Control-only `adp3-probe-telemetry-v1` 上界 0023，Agent Profile 不变；
旧 Control 即使功能关闭也拒绝。部分 DDL/恢复中断人工审阅，不伪造记录或清历史。
当前接线未检查/测试/CI，四族共用观察池和历史 Snapshot 解码影响仍需集中容量验收。

0024 增加 `telemetry_rollup_scope_heads`、`telemetry_rollup_heads`、
`telemetry_rollup_cursors`、`telemetry_rollup_buckets`，完整SQL备份包含四表。
Scope预算行只序列化观察配额，Node-family head保留累计损失；不是新执行/财务权威。
恢复保留两种head和损失记录，仅清cursor、标记旧bucket恢挂且upsert不清该标记。
原始/Probe/Runtime/Journal/Authority历史不删除；恢复后新观察不得续接旧前驱计数。
分钟7天/小时30天、每Node-family10081/721桶和512cursor、每Scope500000/50000桶、
16384cursor/4096Node-family头均包含过期/恢复行；body各8192字节。容量可提前淘汰自身行，
Scope超限拒收观察，不偷其他Node空间。逻辑JSON上限不含SQL/索引/日志/备份物理开销，
也不新增raw的Scope硬容量。详见[契约](../spec/telemetry-rollups-v1.md)。
`adp3-telemetry-rollups-v1`仅Control，上界0024；Agent Profile不变，旧Control即使默认
关闭也拒绝。部分DDL/恢复中断仍人工审阅，无检查/测试/CI通过声明。

新增 SQL 迁移必须审阅此矩阵与目录校验后再接入。当前工具拒绝未知迁移、
历史空洞、旧 V2 库和未经本基线验证的 MySQL 系列；支持的 MySQL 基线为 8.4.x。
数据库只记录迁移名称，不记录历史 SQL 内容摘要；输出的 `schemaFiles` 是检查器
当前源码文件 SHA256，**不声称证明数据库当年执行过完全相同的 SQL**。

| 场景 | 处理 |
| --- | --- |
| 新 Control + 基础旧 Agent，多跳关闭 | Schema 可读、Journal/历史匹配时静态兼容 |
| 旧 Schema → 多跳 Schema | 停发授权、备份与 DDL 审阅；不自动执行 |
| 基础 Journal → 执行扩展 1 | 要求显式迁移审阅；评估本身不迁移 |
| Control 关闭多跳，Agent 保留新 Journal 与支持 | 先完成多跳意图停用及部署撤回，再检查；不降级 Journal |
| 已迁移 Journal → 旧 Agent，或新 Agent 去掉 `--multihop` | 拒绝，即使 Control 已关闭多跳 |
| 新 Schema → 旧 Control | 拒绝；不得通过恢复旧库、删除迁移记录或清空状态伪造回退 |
| 同 Node 的旧库 generation 低于 Journal | 拒绝；不降低 Agent 高水位 |
| 同 generation 但 Snapshot digest 不同 | 拒绝；不能用缓存替换现有执行历史 |
| 已应用迁移缺少已知表/列，或未记录迁移已有部分 DDL | 拒绝；保留现场，按既有恢复流程审阅 |
| 回退 | 至少人工复核；不承诺历史镜像具有本工具的新拒绝保护 |
| 恢复 | 要求维护状态，始终保留既有 restore/review 流程的人工出口 |

DDL 检查覆盖本仓库已知 CREATE/ADD COLUMN/ENUM 变更足迹，不能证明所有索引、
约束、字段属性和数据回填完全等价。DDL 与迁移记录之间没有原子性；
即使足迹齐全，数据回填中断仍可能需要人工处理，不能根据退出码 0 盲目重试启动。

## Schema 0025: C2-A 路径组

0025 的五个精确建表足迹为 `path_groups`、`path_group_revisions`、
`path_group_events`、`forward_path_group_bindings`、`current_forward_path_group_bindings`。
目录审阅固定到 25 个迁移、末项 `0025-path-groups.sql`。现有只读足迹比较将这五表
逐一与迁移记录关联：部分表存在但迁移未记录，或已记录而缺表，均阻止启动评估；
不自动重放部分 DDL、补造迁移记录或删除已存在表。足迹不是列/外键/数据等价证明。

`adp3-path-groups-v1` 仅 Control、Schema 上界 0025；所有旧 Control Profile 拒绝
已应用的 0025，即使从未创建分组。Agent 仍只能使用原 runtime/multihop Profile，
不增加 ADP/Journal 格式、运行开关或执行器。首次 C2-A 仅保存出口候选/完整备用路径，
显式单候选应用复用原 Forward 命令与 Runtime；不是入口多规则组或批次补偿。

完整 SQL 备份同步保留这五表、原模板/路径绑定与 Forward 修订、审计和当前指针。
每 Scope 64 组包含归档、每组 64 修订、每 Forward 64 条组绑定历史，恢复不得删除、
压缩或重写历史以释放配额。原恢复隔离身份/Grant/幂等键并挂起 Forward；恢复出的
组定义、当前指针、候选和历史只是资料，不重新预览/选择/应用，不创建 Operation，
不解除 `recovery_suspended`，也不使旧 Runtime/Journal 获得新授权。
维护、停止全部签发者、授权耗尽、新库新信任和人工复核流程不变。

本切片仅编辑源码与文档，未执行检查、测试、迁移、Compose 或 CI，未编写新验收
脚本/fixture。兼容与恢复路径未验证，不据此宣称 C2 完成或可生产使用。

## Schema 0026: C2-B 持久人工路径发布

新增三个精确表足迹为 `path_publications`、`path_publication_attempts`、
`path_publication_events`。目录审阅推进至 26 个迁移、末项
`0026-path-publications.sql`；任一部分建表足迹与迁移记录不一致均拒绝。
不得自动重试不完整 DDL、清表或伪造迁移记录；足迹并非完整约束/数据等价证明。
仅 Control 的 `adp3-path-publications-v1` 上界为 0026，旧 Control Profile 即使
没有使用批次仍拒绝已应用的 0026。Agent 的原 Profile/ADP/Journal 不变，无新增开关。

现有完整 SQL 备份包含这三表以及其源 Forward/模板/组/绑定/Operation/幂等历史，
不另造恢复格式。每 Scope 64 批次包含终态和恢复项；每批 1 至 10 项、每项仅一次
apply 和一次条件 compensation，最多 20 个不可变尝试。计划 JSON 上限 131072 字节，
每尝试结果 32768 字节；不包括物理行/索引/日志/备份开销，不声称已测容量。

原恢复隔离事务为每个尚未 `recovery_invalidated` 的 head 在 `revision+1` 插入
一次 `recovery` 审计（原 creator 作为归属 actor、恢复事务时间），随后同事务置
`recovery_invalidated=TRUE` 并将 revision 加一。既有 cancelled 标记、计划、源/目标、
所有尝试/receipt/审计均保留；重复隔离不重复推进版本。版本公式为
`1 + attemptCount + cancelled + recoveryInvalidated`，上限 23，小于表约束 24。
不重置版本、清历史、补造拒绝或把历史接受改为未接受。

未执行项只读派生为 suspended；恢复批次不能继续 apply、cancel 或 compensation，
也没有自动 worker/恢复执行器。原幂等键隔离、Forward/Operation 恢复挂起及
Authority/Journal/high-water 安全边界不变，恢复 receipt 不等于新授权。
人工维护、新库/新信任、授权耗尽与恢复复核仍由原工作流负责。

此切片仅源码/文档接线，未运行检查、测试、迁移、Compose、网络或 CI，未增加
验收脚本/fixture；兼容、SAVEPOINT、未知提交和恢复路径均未验证，C2 未完成。

## Schema 0027: C2-C 入口组和独立 Forward 创建

新增六个精确足迹为 `ingress_groups`、`ingress_group_revisions`、
`ingress_group_events`、`ingress_deployments`、`ingress_deployment_attempts`、
`ingress_deployment_events`。目录审阅推进至 27 个迁移、末项
`0027-ingress-groups.sql`；部分建表与迁移记录不一致仍拒绝，不自动重建或伪造记录。
Control-only `adp3-ingress-groups-v1` 上界 0027；旧 Control 即使入口组未使用也拒绝。
Agent/Profile/ADP/Journal 和开关不变；完整 SQL 备份自然包含六表，不另造恢复格式。

入口定义每 Scope 64 组含归档、每组 64 修订、1 至 8 个完整锁版成员；不同入口、
相同业务协议，不做组合积。独立 ingress 批次每 Scope 64 个含终态、每批最多 8 项、
每项一次 create 和一次条件删除补偿，最多 16 个不可变尝试。计划不含 Forward ID，
不预留身份/资源；原 owner 在逐项 create 接受时生成身份。持久计划/成员与原接受
receipt/原 PathBinding 序号同事务记录的是历史创建归属，**不是当前路径绑定指针**。

恢复在同一个原 quarantine 事务内，为尚未 invalidated 的 ingress head 在 revision+1
插入一次 recovery 事件，随后置 invalidated 并递增 revision。保留组定义/修订/审计、
批次计划/尝试/receipt/取消状态；pending 派生 suspended，不自动 create、cancel 或
compensate。版本公式 `1 + attempts + cancelled + recoveryInvalidated` 最大 19，
小于表上界 20，不重置版本或压缩历史。已创建 Forward/Operation 继续由原恢复挂起；
历史归属不重新授予执行权、不复用 ID、不重放 Snapshot、不创建恢复执行器。

补偿只在完整已接受 revision/spec/nullable 原 path/group 来源匹配时接受原删除意图；
`deleting:true` 是删除意图，不代表资源清理完成。现有 Authority/Journal/high-water、
授权耗尽、维护、新库新信任与人工恢复复核不变。新接线未运行检查、测试、迁移、
Compose、网络或 CI，未新增验收 fixture，不能声明 C2 或生产验收完成。

## Schema 0028: C2-C2 显式入口修订迁移

新增三个精确足迹为 `ingress_migrations`、`ingress_migration_attempts`、
`ingress_migration_events`，目录 28 项、末项 `0028-ingress-migrations.sql`。
源/目标同一入口组的精确修订均有外键；计划保留两份完整定义/差异和 immediate 历史
origin/state 守卫，不创建 current ingress pointer。部分建表与迁移记录不一致仍拒绝，
不自动重放不完整 DDL 或伪造记录。Control-only `adp3-ingress-migrations-v1` 上界 0028；
即使没有迁移批次，旧 Control 也拒绝已应用 0028。Agent/ADP/Journal/开关不变。

每 Scope 64 批次含终态/恢复项、1 至 8 条显式 add/update/remove 总动作、最多 8 个
精确来源、16 个不可变尝试；head/event 上界 20，公式最大 19。remove 不可补偿；
add 仅条件原删除，update 仅条件完整 source 授权恢复，不直接回放历史或覆写后续编辑。
计划 131072 字节、尝试结果 32768 字节是逻辑 JSON 限制，物理开销未测。

完整 SQL 备份同时保留新增三表和原 deployment/migration 来源批次、原 Forward、
PathBinding、Operation/幂等历史；无需递归重放 lineage 或新增恢复格式。
同原 quarantine 事务对未 invalidated head 插入一次 revision+1 recovery 事件，
随后置 invalidated 并推进 revision，不清源/目标定义、lineage、attempt、receipt、
cancel 或 audit。pending 派生 suspended，恢复批次不能 apply/cancel/compensate，
不自动按定义 diff 对账。原 Forward/Operation/身份/Grant/幂等隔离与独立
Authority/Journal/high-water、授权耗尽/新信任/人工复核保持不变。

所有新逻辑仅源码/文档接线，未执行检查、测试、迁移、网络、Compose 或 CI，
未新增验收脚本/fixture。逐项原接受不是跨规则原子迁移，历史来源不是当前成员表；
不能据此宣称 C2 已验收或 C3 就绪。

## 备份和恢复责任

- 数据库操作者保存受保护的 SQL 与原有 MAC 备份清单，包含完整 Runtime、
  Relay/多跳部署、Transit staging/coordination/delivery、预留、租约、退役、
  Operation、幂等历史、`probe_instances`、`probe_permits`、`probe_permit_budget`、`probe_permit_withdrawals`、`probe_results`，
  以及三张 `path_templates` / `path_template_revisions` / `path_template_events` 表、
  两张 `forward_path_bindings` / `current_path_bindings` 表，以及 `path_groups` /
  `path_group_revisions` / `path_group_events` / `forward_path_group_bindings` /
  `current_forward_path_group_bindings` 五表、`path_publications` /
  `path_publication_attempts` / `path_publication_events` 三表，以及 `ingress_groups` /
  `ingress_group_revisions` / `ingress_group_events` / `ingress_deployments` /
  `ingress_deployment_attempts` / `ingress_deployment_events` 六表，以及 `ingress_migrations` /
  `ingress_migration_attempts` / `ingress_migration_events` 三表、`telemetry_heads` / `telemetry_points`，
  以及 `forward_telemetry_heads` / `forward_telemetry_points`；
  Host 遥测还包含 `host_telemetry_heads` / `host_telemetry_points`，沿用完整 SQL 备份格式；
  Probe 累计另外包含 `probe_telemetry_heads` / `probe_telemetry_points`，保留原 Probe 安全表；
  四张 `telemetry_rollup_scope_heads` / `telemetry_rollup_heads` / `telemetry_rollup_cursors` /
  `telemetry_rollup_buckets` 同步备份，恢复保留配额/损失头、重置前驱并标记旧桶；
  使用既有 `backup`，不另造第二套恢复格式。恢复隔离 issued 许可，为 consumed 补写独立撤销，
  保留原消费状态/时间、已有撤销时间、许可 ID 与预算时间下界，不重开或退款。
  实例表是非执行归属状态，恢复事务将其隔离并保留恢复出的标识/代数，
  不降低或重建独立 Authority 水位，也不把 SQL 代数冒充防回滚授权。
  路径元数据归档/修订不删除重写，不以恢复旧模板代替当前 Node/Profile Grant 或 Forward 接受事务。
  遥测恢复只重置非授权接收检查点并隔离旧采样，不以导入的指标恢复会话、freshness 或累计差分。
- Control 操作者独立保管 Authority 状态、MAC 密钥和 CA/私钥，不与可回滚的 SQL
  混为一个授权来源，也不为旧系统重新初始化空 Authority。
- Agent 操作者保留每个原始 Runtime/Transit Journal、独立 MAC key、身份材料及高水位；
  多跳关闭或进程重启不改变保留责任。

恢复必须继续按 [恢复与容量操作](../development/recovery-and-capacity.md) 的
maintenance → 停止全部签发者 → 可信时钟及历史授权耗尽 → 新库/新信任恢复 →
隔离旧身份与意图 → 精确 recovery ID 审阅 → resume 流程执行。
评估不会调用这些操作，也不会替它们生成批准。

## 验证范围

历史验收职责将功能回归放在 GitHub Actions，本地原仅执行静态检查。
2026-10-18 起按当前开发节奏，本阶段连语法、类型、格式等静态检查也不运行，
只做必要源码/差异阅读与修改；以下既有验收范围留到全部功能源码冻结后集中补齐。
`contracts` 包含纯兼容矩阵、严格输入和 Go Journal 只读测试；
`phase1` 单独运行真实 MySQL 验收，使用 SELECT-only 账号与真实 Agent 检查二进制，
比较所有测试表和受保护文件的前后摘要，覆盖旧库、部分 DDL、恢复复核和错误脱敏。
容器 CI 检查评估模块已打包、可在无网络容器中加载。
这些不代替独立物理主机、长期升级/恢复演练或发布批准。
0020 遥测新增代码按当前开发安排未运行测试、静态检查或 Actions；对应兼容矩阵、
部分 DDL、恢复标记、去重/重置和有界清理验收统一留待后期集中执行，不沿用旧切片结果。
0021 同样未运行验证；不能把新增 Profile、目录校验与恢复 SQL 的实现记为通过验收。
0022 至 0025 的 Host/Probe/聚合及路径组兼容、部分 DDL、恢复保留与来源一致性同样
未验证。本批不扩展测试或边界检查工具，不继承旧切片成功作为新源码证据。

## Schema 0029: D3-B 独立站内告警

新增 `station_alert_scopes`、`station_alert_policies`、`station_alert_events` 与
`station_alert_policy_events` 四个 Control-owned 表，目录 29 项、末项
`0029-station-alerts.sql`。Control-only `adp3-station-alerts-v1` 上界为 0029；
Agent 仍只使用原 runtime/multihop Profile，不改变 ADP、执行扩展或 Journal。
启动迁移包含 0029，即使 `TUNEX_STATION_ALERTS=0` 也不能声明为旧 Profile。
维护、备份、DDL 审阅和部分 schema footprint 检查沿用现有升级 owner；检测到部分
表结构时停止并人工审阅，不盲目重放 DDL、不删除新表来伪装兼容。

被动观察只读取原 Forward/精确 revision 的 Operation 或 Node report 标量头；
自身 due schedule、dedup 状态和站内事件在短事务中提交，不改变原 Runtime 状态。
单策略观察损坏会回滚原事务；另一个自身 Scope 锁事务只按原 revision 与 due cutoff
有条件延后下一次观察，避免饿死其他策略，不覆盖新配置或把错误状态改为 healthy。
告警事件不是完整 Operation 转移历史，report stale 不是目标健康结论。每 Scope
策略 ID 64（含禁用）、事件 1024、管理审计 256；追加时最多清 16 条过期事件，
再按容量滚动淘汰，loss counters 保留丢失提示，额度不证明物理成本。

正式恢复沿用 `scripts/ops/recovery.ts` 的 maintenance/隔离/rebind/review/resume：
同 quarantine 事务将所有策略设为 `suspended='recovery'`、`next_evaluate_at=0`，
重置派生 observation state；所有旧事件标记 recovery suspended。配置、静默期限、
管理审计、loss counters 与原事件保留，不生成假 recovered、不自动重放观察或外发。
显式重新发布须建立新 config revision，不能把恢复前 episode 与新观察串联。
本片无 webhook queue/credentials，不新增网络投递；后续引入时必须另行加入旧队列取消
与渠道重新审阅，不能把当前隔离声明当作未来队列已受保护。

0029 代码未执行任何测试、静态/语法/类型/格式检查、脚本、CI 或容器/网络验收，
不继承历史通过结果，不代表完整升级、恢复或生产安全门禁已通过。

## Schema 0030: D3-B2 通知端点与独立凭据

新增 `notification_endpoint_scopes`、`notification_endpoints` 和
`notification_endpoint_events`，目录 30 项、末项 `0030-notification-endpoints.sql`。
Control-only `adp3-notification-endpoints-v1` 上界 0030，Agent Profile、ADP、Journal
均不变。维护/备份/部分 DDL 审阅仍由原升级 owner 负责，旧 Profile 无论是否实际创建
endpoint 都不能读取已应用的 0030；关闭站内告警或不配置文件凭据不等于回退 Schema。

本片仅端点意图、独立凭据文件和管理接口；没有 outbox、delivery flag、投递定时器或
网络验收。独立受限 sender 源码即使存在也没有接入发送 worker；GET、发布、禁用和
恢复不得测试 URL、拨号或补发。端点 SQL 只保留非秘密配置、opaque ref 和审计，
完整目标 URL（含路径）与 HMAC signing key 只在独立文件中加密保存，不进 SQL 备份、
普通日志或支持包，不复用 Authority key。

`TUNEX_NOTIFICATION_SECRETS` 是显式可选的独立绝对目录，须与 Control state、PKI、
备份及恢复凭据输出任意方向都不重叠。Linux 操作员须预置 root/records 为运行 UID
拥有的 0700 目录、独立 raw32-byte key 为 0600 文件；不自动初始化或 rekey，不在
Windows 上把 POSIX chmod 当作 ACL 保证。启用该配置时，ops backup/restore 的
notificationSecretsDirectory 选项由 CLI 同一环境传入，输出目录在创建前后检查
realpath/最近存在父目录，并拒绝 symlink 组件和双向重叠；错误不输出秘密目录路径。
未显式配置时不猜测或创建目录，也不改变原 Windows 无 vault 的使用边界。
操作员直接调用库函数时也必须传相同选项；未提供配置的工具不能发现未声明的秘密。

文件 stage 先持久化再提交 SQL，二者不是原子事务；SQL 回滚/进程中断可能留下 orphan。
单进程串行与独占 writer.lock 不自动打破 crash 陈旧锁，操作员需在确认原写者停止后
维护。全目录最多 4096 entries、每 endpoint 32（含 temp/hardlink），追加时最多清理
16 个超过 24 小时、非 current head/new reference 的同 endpoint 单链接旧文件；
崩溃双 hardlink 遗留和损坏需人工处理，额度耗尽会拒绝新发布。父目录必须可信，
该实现不承诺抵御同 UID 恶意替换路径；这些限制不是磁盘、性能或长期稳定性验收。
0030 初片只保护 endpoint head ref；下述 0031 已增加活动发送 lease pins，并以
endpoint/credential revision fence 拒绝旧队列，队列本身不持久化旧 credential ref。

原 restore quarantine 事务将全部 endpoint 设为 `suspended='recovery'`，保留 config、
opaque ref、revision、额度计数和审计，不自动解密或发送。新 Authority binding digest
与旧文件 AAD 不匹配；数据库 review/resume 后仍需 manager 显式重新发布，增加
credentialRevision 并创建新绑定。不能修改旧 ref、清空密钥或安全 high-water 来绕过。
SQL backup 不导出 vault 文件或独立 key；这也意味着 SQL 单独恢复不具备通知凭据恢复
能力，受保护材料应由另行审阅的运维流程管理，不能随普通 SQL 备份混装。

0030 与凭据/路径防护代码仅已本地编写，没有检查、测试、脚本、网络或 CI 证据，
不代表 D3 完成、真实投递可用或生产就绪。

## Schema 0031: D3-B2 独立有界 Webhook Outbox

新增 `notification_delivery_scopes`、`notification_deliveries`、
`notification_delivery_attempts`、`notification_delivery_rates`；目录 31 项、末项
`0031-notification-deliveries.sql`。Control-only `adp3-notification-deliveries-v1`
上界 0031，旧 Profile 即使投递关闭也不能读取该 Schema。Agent Profile、ADP、
Journal 与 Runtime 授权安全历史不变；仍需维护、备份、DDL 和部分 footprint 审阅。

`TUNEX_WEBHOOK_DELIVERY=1` 显式启用独立非重入 worker，默认 0；启用却未配置合法
`TUNEX_NOTIFICATION_SECRETS` 会拒绝启动。仅有端点配置或 station alert 开关不代表
已启用发送；未配置 vault 时仍可读 metadata/禁用端点，但不能发布新凭据。
自动投递循环与 Runtime 分开，每秒最多取一项；`worker:false` 关闭自动循环，
不撤销内部显式 service 方法的调用能力。所有 GET 仍只读，不测试地址或触发投递。

只在新 station event 的同事务 handoff 路由，不扫描旧事件补发。每 Scope delivery
最多 1024 行（含 terminal），attempt 明细最多 256；硬满时拒收 recipient 并记录
queueRejected，不驱逐 queued/claimed/retry-wait，不回滚已有源事件。
七天仅 terminal retention，追加时最多清 16 条过期 terminal，再按容量最多淘汰一条
terminal；关联明细清理单独记 attemptsEvicted。event+endpoint 唯一键只在保留行期间
去重；被删除后不再提供永久 dedupe。每条 delivery 自身 attemptCount 不随明细淘汰
重置；routingRejected 统计路由拒收事件，silence/disabled/queueRejected 统计 recipient，
rows/attempts loss 统计相应行，不把不同单位相加冒充失败投递数。

事件有效期一小时，最多六次发送 claim；30 秒 claim、30 秒起步至最多五分钟重试，
endpoint 持久 minimum interval 至少十秒，每 Scope 最多两个未到期 claim。claim 在
网络前提交并计尝试，finish 使用 revision/fence/expiry；崩溃后的 expired claim 记
unknown 并退避，不当作未发出重试。DNS、HTTPS 与响应读取不持有 SQL 事务。
时钟必须同步，host clock 回退/失准会影响期限；设置 flag 不是时钟或活性验收。
五秒发送预算不意味着底层 DNS 真能取消；活动凭据 lease 一直 pin 至 DNS/socket
真正退出，关闭可能等待不可取消 DNS，操作员应准备受控停机，不盲删 writer.lock。

队列只存脱敏 payload、配置 revision、管理 actor 与 authority binding，不复制完整
目标 URL、key 或旧 credential ref。发送前重新检查当前授权/策略/端点及 revision；
endpoint/credential 变更使旧路由失效，不据新凭据继续旧任务。GC 同时保护 current
head/new ref 和活动 lease pins；不是无限期保留历史凭据，也不允许恢复旧 ref 绕 fence。
HTTP 2xx 只代表该 HTTP 对端接受，不代表业务处理成功、Exactly Once、全序或绝无重复；
接收端必须按稳定 delivery ID 做可接受的不确定重复处理。

原 restore quarantine 同事务把所有 delivery sticky 标为 recovery suspended；
queued/claimed/retry-wait 改 cancelled、revision+1、清 claim、nextAttemptAt=0，
lastCode=RECOVERY_SUSPENDED，updatedAt 不回退。被中断 claimed 的 outcome 为 unknown；
所有 pending attempt 明细（含 terminal head 下遗留）转 unknown/RECOVERY_SUSPENDED，
finishedAt 不早于 startedAt。已有 terminal delivery 的状态/HTTP 接受证据原样保留，
只加 sticky marker。revision 达 MAX_SAFE 则整个恢复事务失败并人工审阅，不跳过或绕回。
rate heads 的未来限速边界保留，不清零；不重新排队、不补发、不做历史 catch-up。
端点仍需 review/resume 后显式重新发布，但重新发布也不会复活旧取消任务。

0031 仅本地源码编写，未运行任何检查、测试、脚本、网络或 CI；本批没有实际发送，
不代表 outbox 活性、SSRF/DNS/文件竞态防御、升级恢复或全 D3/生产门禁已通过。

## Schema 0032: D1 独立 ProbeRun 历史

新增 `probe_run_scopes` 与 `probe_runs`，目录 32 项、末项 `0032-probe-runs.sql`。
Control-only `adp3-probe-runs-v1` 上界 0032；Agent 仍使用原 runtime/multihop Profile，
不改变 ADP、Probe wire schema、Journal 或授权高水位。不新增历史执行开关，历史不是
自动 Probe 排程或新的许可入口。旧 reader 即使没有探测记录也拒绝已应用的 0032；
维护、备份、DDL/部分 footprint 审阅与不可盲目重放规则保持不变。

原 Probe permit owner 在 issue/consume/revoke/withdraw/result 实际变更的 supplied
transaction 内捕获闭合摘要；原两秒许可、全局256预算、prune 与结果 cascade 原样
保留。历史表只引用自身 Scope，不向许可、Forward 或 Node 建 cascade FK，因此短许可
清理及原规则删除不清除该 Scope 保留期内的脱敏历史。它不恢复执行资格，也不回放旧
许可。仅新捕获，无旧表 catch-up；非 issue 更新缺历史 head 时只计 updatesWithoutHead，
不重建虚假 admission 或把未知测量改为失败。

每 Scope 最多1024 run，按 issuedAt 七天惰性保留；仅新 insert 最多清16条过期历史，
容量满再淘汰最老任意状态一条，包括尚无结果的记录，分别计 rowsExpired/rowsEvicted。
历史状态不是活许可，淘汰不退款或撤销原执行预算；后续原更新无法匹配时另计丢失。
存储保留 actor、完整安全 binding/instance、生命周期时间及结果白名单标量，不保存
fingerprint、requestId、wire body、目标地址或配置。所有读取 manager-only、固定窗口/
精确交集/keyset，有界输出不证明 SQL/物理磁盘成本；无结果不是 connect failed，
connected 只代表 agent-direct-egress 的 Direct TCP connect，不证明入口、TLS、UDP、
完整业务健康或自动路由可用，当前健康仍 unknown。

原 recovery quarantine 事务只给历史 sticky recoverySuspended=true，并将新标记记录
revision+1；原 state/closedAt/withdrawnAt/result/updatedAt 全部保留，不模拟 quarantined
许可或新 attempt。已标记记录不重复推进；revision 耗尽由 CHECK 使整个事务失败，需
人工审阅，不能跳过/回绕。原许可 owner 继续独占实际隔离、withdrawal 与预算 clock，
不清授权安全历史，不因 archive 存在而允许执行或在恢复后自动补发。

0032 仅本地源码编写，没有测试、静态/语法/类型/格式检查、脚本、MySQL、网络或 CI
验收；不代表完整 D1、历史完整性、升级恢复或生产门禁已通过。

## Schema 0033: Bounded Probe Plans

新增 `probe_plan_scopes`、`probe_plans`、`probe_plan_decisions`，目录33项、末项
`0033-probe-plans.sql`。Control-only `adp3-probe-plans-v1` 上界0033；Agent 原
runtime/multihop Profile 不变，不增加 ADP/Journal 执行权限。旧 reader 即使没有
计划也拒绝0033；关闭 schedule/execution flag 不撤销 DDL。继续维护、备份和部分
footprint 审阅；不靠启动迁移自动修复半应用 Schema，不盲目重放。

三表只通过自有 FK 关联，不引用原 Scope/Forward/Node/permit；计划 Scope head
独立加锁，不在原业务 scopes 行取得 FOR UPDATE。immutable config/origin binding
只表达原 tcp-connect/Forward revision/timeout，manual 或 scheduled，30..3600秒间隔、
最多16次且总寿命不超过一小时。每一步 supplied transaction 调用原 issuance owner，
保留 enabled gate/当前 manager 和 binding 授权/全局预算/两秒上界，再以计划有效期
收紧许可期限。不生成 child idempotency key；outer key、decision 与 permit 同事务。
commit uncertain 不解释为安全重发，重试据原 key 和计划持久状态处理。

`TUNEX_PROBE_SCHEDULE` 默认关闭；启用要求原 execution 开关和明确一秒 clock skew，
操作员仍须验证时钟同步。只选有限到期候选并锁 head 重验，一次最多一步；下一次基于
本次决策时刻，不 catch-up。savepoint 仅隔离专用 allowlist 的明确领域拒绝，其中
PROBE_PERMIT_LIMIT 的429/retryable 是唯一 retryable 例外，拒绝也计一次有限决策。
其他 retryable、SQL、integrity、clock 错误 whole transaction 失败，不写虚假 attempt。

每 Scope32条含 terminal，每计划最多16条 immutable decision。新建时最多处理32条
本 Scope head，把过期 active 安全终结；之后最多清16条七天 terminal，满时仅淘汰
最老 terminal 一条，无 terminal 则拒新，不清有效 active。独立 loss 记录 expired/
evicted plan 数及关联 decision 行损失，不清零、不声称完整历史或精确 TTL。
查询固定窗口/精确过滤/keyset，有界输出不代表物理 SQL 成本保证，GET 不创建许可。

原 recovery quarantine 事务同时 sticky 标记所有计划：首次 false->true revision+1，
active 改 suspended/RECOVERY_SUSPENDED，nextRunAt=0；terminal 状态、取消事实、
decision 和已接受 probe ID 全保留，无新 attempt、不退款或重置安全历史、不自动
恢复调度。revision 耗尽由 Schema CHECK 阻断整个事务，需人工审阅而非跳过/回绕。

0033 仅源码与文档编辑；未运行检查、测试、类型/语法/格式/静态验证、脚本、MySQL、
网络、容器或 CI，不能据此宣称并发、持久性、升级恢复、调度活性或生产安全验收。

## Schema 0034: Explicit Typed Probe Classification

Control-only `adp3-typed-probes-v1` 上界0034，目录34项、末项 `0034-typed-probes.sql`。
Agent 原两个 compatibility Profile 不变，独立 Probe v2 契约不改变原 ADP/Journal。
旧 reader 拒绝0034，即使 ingress 开关为0或没有新测量；开关不是 Schema rollback。
新增 ALTER 只为原 `probe_permits` 和 `probe_runs` 保存 measurement enum，原旧行明确
default `tcp-connect-v1`；新 `tcp-ingress-connect-v1` 才重建 optional measurement 键。
旧对象、历史 digest 和观测点不变，不能因升级把 egress 解释成 ingress。旧迁移保持
原样，DDL/部分 footprint 审阅及维护/备份规则继续；不自动修复或重放半应用迁移。

`probe_type_qualifications` 是无原业务 FK 的独立 proof，不分配新 instance/预算；
own empty seed 行序列化首次 register/revoke，非 empty proof 固定原 node/boot/session/
fingerprint/instance ID/generation 与有限期限，get 使用 supplied transaction 的 SHARE
或 UPDATE 锁。服务必须先锁原 slot 并重验，再锁 qualification；不能因 proof 仍存在
而绕过已撤销或替换的原实例，也不能重臂同一 revoked/quarantined identity。

原 restore quarantine 同事务只把 qualified 改 quarantined，保留原时间/代次，empty
和已撤销事实不变。原 permit 隔离/withdrawal/budget 继续由原 owner，history 保留
分类和结果事实，仅按原 sticky marker 处理，不重建许可、不退款、不清计数或高水位。
新旧测量仍共用原单次/两秒/全局预算，不新增 slot；旧 telemetry v1 只计原 egress，
新 ingress 不进入旧累计。入口 connect 可能触发既有监听的正常下游拨号，不将这种
副作用误写成独立 echo/TLS/外部入口成功或健康证据。

Control ingress 开关默认关闭，要求原 execution 与明确一秒 clock skew；Agent 另行
显式 opt-in，操作员仍须验证时钟。关闭任一新开关不退款或反向撤销已产生的原许可，
读取不发起网络，恢复不自动重发。0034 仅源码/文档编写，未运行任何检查、测试、
脚本/生成器、网络、MySQL、CI、容器、Git 或浏览器；升级恢复/安全/活性均尚未验收。
