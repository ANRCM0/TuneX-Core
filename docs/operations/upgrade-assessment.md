# 只读升级与恢复兼容性评估

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

当前 Control 源码启动迁移目录已包含 0017，不能将它声明为旧 Profile 来绕过
回退拒绝。新 Profile 增加结果回执表读取范围，不代表远程派发或执行可用。
后续 [默认关闭的 Probe 操作链](../decisions/0018-probe-production-workflow.md) 沿用该 Profile，
不增加迁移或 Journal 格式。显式启用时需审阅一秒集群时钟策略并让 Agent 重新协商；
关闭签发不是删除旧许可、立即撤销所有已接受任务或允许降级的理由。
旧库升至 0014/0015/0016/0017 要求维护/备份/DDL 审阅；应用后即使 Probe 没有启用，
低于相应 Schema 上界的旧 Control Profile 仍被评估器拒绝。示例计划展示 0015 来源升级至 0017 目标；
source/target 必须根据实际部署分别核验，不能照抄。

0016 为旧 consumed 记录补写撤销标记，保留原 closed_at，并将其作为撤销时间的保守下界；
这不声称旧消费时发生过新撤销操作。原回执不可执行，升级不能让它们获得新的执行资格。
CREATE/backfill 中断后不得自动重建或清空表来绕过；只读评估能识别表与迁移记录不一致，
不能证明行级补写完整或自动修复。维护窗口内复核后再决定恢复启动。

0017 仅创建 `probe_results`，不为旧许可生成结果，不回写消费、撤销或授权水位。
每个保留许可最多一份上报结果，随许可清理级联删除；不是历史监控表或健康权威。
既有恢复隔离继续撤销 consumed 资格，结果行可以保留，但不能据此恢复许可、健康或派发。
新表 DDL 中断同样要求审阅，不得清空 Authority/Journal 来绕过版本拒绝。

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

## 备份和恢复责任

- 数据库操作者保存受保护的 SQL 与原有 MAC 备份清单，包含完整 Runtime、
  Relay/多跳部署、Transit staging/coordination/delivery、预留、租约、退役、
  Operation、幂等历史、`probe_instances`、`probe_permits`、`probe_permit_budget` 和 `probe_permit_withdrawals`；
  使用既有 `backup`，不另造第二套恢复格式。恢复隔离 issued 许可，为 consumed 补写独立撤销，
  保留原消费状态/时间、已有撤销时间、许可 ID 与预算时间下界，不重开或退款。
  实例表是非执行归属状态，恢复事务将其隔离并保留恢复出的标识/代数，
  不降低或重建独立 Authority 水位，也不把 SQL 代数冒充防回滚授权。
- Control 操作者独立保管 Authority 状态、MAC 密钥和 CA/私钥，不与可回滚的 SQL
  混为一个授权来源，也不为旧系统重新初始化空 Authority。
- Agent 操作者保留每个原始 Runtime/Transit Journal、独立 MAC key、身份材料及高水位；
  多跳关闭或进程重启不改变保留责任。

恢复必须继续按 [恢复与容量操作](../development/recovery-and-capacity.md) 的
maintenance → 停止全部签发者 → 可信时钟及历史授权耗尽 → 新库/新信任恢复 →
隔离旧身份与意图 → 精确 recovery ID 审阅 → resume 流程执行。
评估不会调用这些操作，也不会替它们生成批准。

## 验证范围

功能回归只放 GitHub Actions。本地只做语法、类型、格式等静态检查。
`contracts` 包含纯兼容矩阵、严格输入和 Go Journal 只读测试；
`phase1` 单独运行真实 MySQL 验收，使用 SELECT-only 账号与真实 Agent 检查二进制，
比较所有测试表和受保护文件的前后摘要，覆盖旧库、部分 DDL、恢复复核和错误脱敏。
容器 CI 检查评估模块已打包、可在无网络容器中加载。
这些不代替独立物理主机、长期升级/恢复演练或发布批准。
