# TuneX 开发文档

本目录维护当前开发需要的环境、架构、公共契约、协议、决策、集成方式与验收资料。
当前状态以[实施进度](development/progress.md)与
[P 准确修订验证记录](development/product-verification-p-2026-10-24.md)为准；
[N 验证记录](development/product-verification-n-2026-10-21.md)保留历史修订证据。
当前新增源码工作为 [P 产品完善阶段](development/product-readiness-stage-p-2026-10-24.md)，
与历史 N 验证分别记账。
N 已经 PR #114 合并为 `9a5f719`；历史地基 B 的接受仍见
[B 验证记录](development/foundation-verification-2026-10-19.md)。

## 开发与验收

| 文档 | 用途 |
| --- | --- |
| [P：产品易用性与运行闭环](development/product-readiness-stage-p-2026-10-24.md) | 当前串行完善方案、P1–P6 实施顺序、公共接口与 PP-01–16 验收矩阵；源码与执行分别记账 |
| [P 准确修订验证](development/product-verification-p-2026-10-24.md) | `aae0632f` 的 10 作业 baseline、容器打包、150 跳过项与 native SQL 对账、实际往返和剩余环境范围；未合并或发布 |
| [P 部署与质量验收](development/product-p-deployment-acceptance.md) | 安装、保留状态升级、原维护／恢复、独立主机故障、负载与 24／72 小时长稳；准备完成，执行未取得 |
| [受控路径 Echo](spec/controlled-path-echo-v1.md) | Direct 与 Relay／多跳的测量位置、显式协商、完整原 owner 链路、兼容和证据边界 |
| [开发入口](development/getting-started.md) | 工具、依赖、源码入口与本地／Actions 验证分工 |
| [实施进度](development/progress.md) | 当前实现、合并源码、准确证据与剩余门槛 |
| [开发执行方案](development/development-plan.md) | 地基接受、产品切片、负载／人工切换和独立能力的顺序 |
| [下一阶段目标](development/next-milestones.md) | 当前可推进项及退出条件 |
| [N：多用户产品开发阶段](development/product-development-stage-n-2026-10-21.md) | 新阶段目标、逐项状态、并行分工、兼容与验收门槛 |
| [产品用途、流程与缺口](development/product-requirements-and-gap-analysis-2026-10-21.md) | 多用户私有／管理员资源、自助组线、额度、探测监控及源码缺口；产品需求基线 |
| [转发参考学习](development/forwarding-reference-study-2026-10-21.md) | Forwardx 引擎闭环、参考 TuneX 调用链与开发者扩展方向；仅源码分析 |
| [转发框架诊断与路线](development/forwarding-open-development-plan-2026-10-21.md) | 当前完整调用链、原生扩展缺口、参考取舍与后续顺序；源码诊断与提案 |
| [地基 readiness](development/foundation-readiness.md) | 1–220 验收病例、证据映射与并行开发门禁 |
| [验收规范](testing/acceptance-v1.md) | 安全、可靠性与实际网络测试要求 |
| [多跳开发与验收](development/multihop-execution.md) | 默认关闭的执行能力、Actions、物理主机和发行门槛 |
| [升级／恢复开发](development/upgrade-recovery-development.md) | 兼容性输入、原保护状态、只读检查与故障验收不变量 |

development 其余文件保留现行模块的接线、开发命令与验收场景。
带日期的历史结果只验证其标识修订，不代替当前验证。

## 地基与模块集成

| 文档 | 用途 |
| --- | --- |
| [总体架构](architecture/overview.md) | 组件边界、数据流与职责 |
| [四层地图](architecture/foundation-layers-v1.md) | L0/L1/L2/L3 公共依赖方向 |
| [兼容目标](architecture/compatibility-targets-v1.md) | 明确支持的兼容目标、拒绝边界与当前源码路线 |
| [机器边界清单](architecture/foundation-boundaries-v1.json) | 源码分类、公共入口、具名兼容桥和默认绑定 |
| [A5 收口](architecture/foundation-a5-source-closure-v1.md) | 完整 Control、Agent、Web 和资产／消费者索引 |
| [候选公共版本](architecture/foundation-candidate-index-v1.md) | 版本、兼容影响与验收关联 |
| [源码根目录表](architecture/foundation-source-root-catalog-v1.md) | 源码、组合根、支持工具与资产归属 |
| [公共接入说明](architecture/framework-integration-v1.md) | 模块与 adapter 开发方式 |
| [扩展示例](../examples/foundation-extension/README.md) | 仅消费公共入口的最小集成示例 |
| [FR 模板](templates/foundation-change-request.md) | 公共接口／语义变更的影响、迁移和接受记录 |

architecture 其余文件维护当前 owner/native/public/消费者映射，不构成独立接受证明。
[ADR-0048](decisions/0048-foundation-layer-boundaries.md) 与
[FR-0001](changes/FR-0001-foundation-layer-boundaries.md) 记录地基治理；
decisions 与 changes 保留仍约束当前源码的设计与兼容变更。

## 领域、API 与协议

| 文档 | 用途 |
| --- | --- |
| [Core](spec/core-v1.md) 与 [Forward](spec/forward-v1.md) | 纯领域与最小转发语义 |
| [Control API](spec/control-api-v1.md) 与 [Runtime/Agent](spec/runtime-agent-v1.md) | 公共命令、Operation、部署状态与恢复 |
| [产品资源访问](spec/product-resource-access-v1.md) | N：私有／共享、用途、个人端口额度、读取隔离与显式存量分类；配置内验证已通过 |
| [账号本人凭据](spec/account-credentials-v1.md) | P2：本人 Token 轮换、事务内复核、未知结果核对与账号审计；准确修订契约／MySQL／浏览器结果见 P 验证记录 |
| [共享资源带宽／流量](spec/shared-resource-payload-limits-v1.md) | FR-0032：每用户 × 共享机器的双向 payload、显式周期、保守预扣与恢复边界；准确修订结果见 N 验证记录 |
| [共享额度公共示例](../examples/shared-resource-limits/README.md) | 仅消费公共端口的政策注入、原事务与显式周期命令示例；N Actions 加载检查通过，不授予部署或执行权限 |
| [ADP/3](protocol/agent-deployment-v3.md) 与 [执行扩展](protocol/agent-deployment-execution-v1.md) | 当前在线协议及版本化多跳执行 |
| [ADP/3 在线切换](development/adp3-cutover.md) | 当前 Direct 在线协议、旧 ADP/2 拒绝与状态边界 |
| [模块边界](architecture/module-boundaries.md) | 原 owner、公共调用与事务归属 |
| [原生能力管理](spec/native-driver-management-v1.md) | 声明能力、平台／角色与服务端拒绝 |

spec 与 protocol 其余文件维护当前独立模块及机器契约。旧版本协议仍被显式兼容
解析器及负例消费，保留相应规范、Schema 与 fixture，不代表启用旧在线协议。
protocol/schemas 和 fixtures 是运行／生成／验收输入，须随消费者同步。

规范优先级为已接受 ADR、版本化协议／领域规范、架构与开发方案、示例。
设计基线、源码、CI、地基接受、合并、镜像发布与正式发行分别记录。
