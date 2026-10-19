# TuneX 开发执行方案

更新：2026-10-20。此文件统一后续顺序，当前实现和证据见
[progress.md](progress.md) 与[验证记录](foundation-verification-2026-10-19.md)。

## 当前交付点

B 已完成当前公共接口范围的接受：readiness 220 项断言与适用执行结果逐项对齐，
完整 baseline 和容器工作流在源码 `e208a3abf17129b0c2898ba2022c69f60f45445a`、
测试合并修订 `c3ce8a67b901f61234b4116190409854818cb6c7` 上通过。
[验证记录](foundation-verification-2026-10-19.md)列出实际作业、跳过与独立环境界限。
PR #112 尚未合并；本轮不启动 C 产品切片、不发布。

后续模块可在新的明确任务中消费这组冻结接口或单独验证的后继修订；须使用独立
分支／worktree、公共入口、契约测试和集成说明。物理多主机、长稳／负载、
独立 Responder 交付与正式发行保留独立门槛。

公共版本、消费者、默认绑定、兼容入口和移除条件见
[候选索引](../architecture/foundation-candidate-index-v1.md)、
[A5 收口记录](../architecture/foundation-a5-source-closure-v1.md)与
[边界清单](../architecture/foundation-boundaries-v1.json)。

## 开发规则

每项工作先说明层级、消费的公共接口、地基影响、契约变化、计划／已执行验收和
其他模块影响。保护 L0 公共 API，复用 L1/L2，保持单一 Runtime ledger、原 Agent
authority/Journal、原事务、锁与授权所有权；冻结公共契约或语义变更先记录 FR。

2026-10-19 的持续授权允许同类地基源码提案记录 FR 后自主选优实施。
后续授权已允许 A5 的测试、提交、推送、PR #111 合并与历史清理，以及完整 B 的
补齐、验证、提交推送和临时文件清理。B 的限定范围接受现已记录；PR #112 合并、
未来产品功能和正式发行仍需各自授权与门禁。

每包交付包含源码修订、公共版本、兼容影响、验收病例／结果和剩余条件。
功能、MySQL、网络、容器与浏览器验收在 GitHub Actions 执行并绑定实际测试修订。
同机进程／namespace 证据不能替代独立物理主机，历史绿灯不能验证后续修改。

## B：已完成限定范围接受

下列三步已在冻结修订上完成，断言、执行和范围决定见验证记录。
后续源码变化重新核对受影响要求；本次接受不扩大独立环境或发行结论。

1. 维护 readiness 1–220 的断言映射，补齐各项记录的余缺，再关联最终准确修订与
   Actions 结果；有对应测试不代表整条通过，不能用总通过数推定全部通过。
2. 对原事务／锁／错误次序、旧入口与新 provider、时间与原生序列化、拒绝路径、
   兼容消费者逐项核对；公共示例和契约应在同一冻结源码可用。
3. 按已满足的公共接口和适用范围记录接受决定；独立保留物理多主机、长稳／负载、
   独立 Responder 构建发布和正式发行门槛。

## C：按顺序完成产品纵向切片

产品范围仍围绕四条主线，详细业务字段和原子性以对应公共契约为准：

| 主线 | 当前契约与增量边界 |
| --- | --- |
| 基础转发 | [Forward](../spec/forward-v1.md)、[能力管理](../spec/native-driver-management-v1.md)、[规则命令](../spec/native-rule-management-v1.md)；保留原授权、资源、Operation 与执行 owner，新 driver 独立声明目标和硬截止 |
| 加密隧道 | [原生 TLS 隧道](../spec/native-tunnel-management-v1.md)、[逻辑隧道入口](../spec/logical-tunnel-management-v1.md)；复用原 Profile/Endpoint/Path，元数据不宣称共享物理链路、独立执行或任意协议支持 |
| 拓扑与切换 | [模板](../spec/native-path-templates-v1.md)、[精确绑定](../spec/native-path-bindings-v1.md)、[发布](../spec/path-publications-v1.md)、[组](../spec/path-groups-v1.md)、[入口迁移](../spec/ingress-migrations-v1.md)；原事务、CAS、逐项结果与有条件补偿，自动策略另立项 |
| 监控与探测 | [诊断](../spec/forward-diagnostics-v1.md)、[遥测聚合](../spec/telemetry-rollups-v1.md)、[Probe 历史](../spec/probe-runs-v1.md)、[观测服务](../spec/observation-services-v1.md)；区分事实来源、授权、测量和健康结论，staged Echo v4 与实时机器接入分别治理 |

以下均为 planned；进入条件为所消费公共接口及对应模块门禁通过。
共享只读 DTO 若确实缺失，先完成最小依赖切片并记录原因。

| 顺序 | 复用与 owner | 交付及验收 |
| --- | --- | --- |
| C1 状态解释（FXR-01） | Console/Web、ForwardDiagnostics、Operation、Ingress 公共 API | 列表摘要、节点下钻、详情／批次一致说明；来源、更新时间、partial/stale/unknown、历史 Operation 和 cleanup pending。覆盖重复身份、旧结果覆盖、权限裁剪、断线及迟到响应；Accepted、Applied、listener ready 和独立 Probe 结论分别显示 |
| C2 能力预检（FXR-02） | NativeDrivers/Node 与原 capability/codec owners | 逐节点展示平台、协议、角色、flag、facts 时效与 supported/unsupported/unknown 原因；服务端独立拒绝。覆盖旧 Agent、部分不支持、权限和预检后变化，失败不动当前实例 |
| C3 指标解释（FXR-03） | 原 telemetry/Probe history/rollup 读模型与 Web | 按 Node/Host/Forward/Probe 四族逐片展示来源、起点、窗口、epoch/gap/coverage/loss/stale。验证精确 uint64、基线、重发乱序、重置、拓扑／实例变化、缺测、rollback、Scope 与有界查询；缺测不能补零 |
| C4 运维开发闭环（FXR-04） | 原 ops、AuthorityStore、Journal、安全恢复 owners 与 L3 导航 | 只读 status/diagnose、数据库故障说明、脱敏支持包、既有升级评估与维护／备份／恢复／review 接线。验证数据库不可达、缺备份、旧 reader、部分迁移和受保护状态损坏均保持原拒绝 |

C1 → C2 → C3 → C4。每包退出需要对应修订的契约／功能证据和公共集成说明。
不新增状态权威、指标数据库、任意 root 安装脚本或远程在线升级机制。
能力目录和预检不授予执行权限，运行数量不证明端到端健康。

## D：负载与固定拓扑

| 顺序 | 复用与 owner | 交付及验收 |
| --- | --- | --- |
| D1 调度评估（FXR-05） | L1 BackgroundTasks/生命周期、L2 telemetry admission/通道、L3 触发策略 | 先取得获授权的观察池、周期任务、页面请求负载基线；有瓶颈才设计按 key 合并、有界唤醒和慢消费者处理。约束活跃数、等待 key／字节、过期／取消／公平性／关闭，覆盖饱和、丢通知、重连、事务失败、清理和内存上界 |
| D2 固定拓扑与人工切换（FXR-06） | 原 Path/Ingress/Forward/Runtime 的 preview/publish/Operation/补偿 API | 固定路径与入口批次先验收，展示精确引用、逐项结果及人工切换。覆盖 CAS、部分失败、撤权、旧计划、监听冲突、条件补偿失效、恢复隔离、重放与租约截止；独立记录物理主机场景 |

D1 没有明确收益时记录结论即可，不为 D2 强建新调度平台。
通知不能续租或替代周期对账；进程锁不能替代跨实例权威。
D2 不承诺全局原子或自动故障转移，也不能把分段耗时之和标为真实端到端。

## E：单独立项的能力

自动策略先定义观测身份与有效性、失败／恢复窗口、迟滞、冷却、人工锁定、旧决策
作废、并发控制和重启恢复；人工切换通过不替代自动策略验收。

外部兼容（FXR-07）先选定目标和版本，提供有界只读预览；实际写入走原 L3 命令。
新 driver 明确平台、协议、硬截止、partial-start cleanup、stop/drain、指标与恢复。
未知版本／字段、超限、冲突和可变别名在改变当前实例前拒绝。
这些方向尚未选择具体兼容协议、导入器或第三方引擎，需各自设计与验收授权。

## 集成与并行开发

地基门禁开放后，独立模块使用独立分支／worktree、模块目录、公共入口、契约测试
和集成说明。共享 exports、组合根和 readiness／边界清单由集成任务串行处理。
子代理仅在明确授权和划定读写范围后使用。无法归属的并发修改出现时停止并确认。

## 源码来源与复用

适用的成熟组件可以在正确 owner 内适配；引入源码时记录上游文件／修订、改动及
版权／许可证，并随源码保留应有声明。不得引入对外部参考 checkout 的构建、导入、
运行或部署依赖。复用不能替换 TuneX 的原权威、身份、事务、拒绝和硬截止规则。
历史参考副本及研究对比报告已移出当前工作树，不作为当前实施证据。
