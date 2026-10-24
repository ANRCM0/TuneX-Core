# TuneX 文档

项目进入稳定维护，当前入口为[维护说明](maintenance.md)。安装、开发、接口和
验收资料按用途维护；开发阶段计划与逐轮过程记录由 Git 历史保留。

## 安装与运维

| 文档 | 用途 |
| --- | --- |
| [安装与接入](operations/installation.md) | Control／Agent；全新安装与已有状态分别处理 |
| [实机测试](operations/physical-testing.md) | 固定源码／制品、inventory、业务测试与原始证据 |
| [升级与恢复](operations/upgrade-recovery.md) | 兼容输入、保护状态、拒绝条件 |
| [维护与容量](operations/recovery-and-capacity.md) | 原维护、备份、恢复、review／resume 和容量入口 |
| [节点安全](operations/node-security.md) | 身份、凭据、PKI 和授权 |
| [访问管理](operations/access-management.md) | 成员、授权及权限范围 |
| [系统时间](operations/system-time.md) | 原 Guard、同步证明与截止 |

## 测试与维护

| 文档 | 用途 |
| --- | --- |
| [修订与验收状态](testing/verification-status.md) | 准确源码、CI、已知限制与剩余门槛 |
| [验收要求](testing/acceptance-v1.md) | 安全、可靠性和实际网络测试要求 |
| [部署与长稳验收](testing/deployment-acceptance.md) | 安装、恢复、独立多机故障、负载及 24／72 小时 |
| [Direct UDP 实测](testing/direct-udp-live-smoke.md) | 原客户端与业务 payload 检查 |
| [授权故障](testing/authorization-faults.md) | 到期、撤权、原保护历史和失败行为 |
| [Relay 网络隔离](testing/relay-network-isolation.md) | 同机 namespace 的场景及证据范围 |

## 开发与架构

| 文档 | 用途 |
| --- | --- |
| [开发接入](development/getting-started.md) | 工具、依赖、源码和检查入口 |
| [Web Console](../apps/web/README.md) | 浏览器职责、凭据内存与不确定命令 |
| [总体架构](architecture/overview.md) | 组件边界、数据流和职责 |
| [四层地图](architecture/foundation-layers-v1.md) | L0／L1／L2／L3 与公开依赖方向 |
| [源码边界清单](architecture/foundation-boundaries-v1.json) | 源文件分类、公开入口和兼容桥 |
| [公共模块集成](architecture/framework-integration-v1.md) | 模块与 adapter 接入 |
| [公共版本索引](architecture/foundation-candidate-index-v1.md) | 独立版本、消费者及兼容影响 |
| [模块边界](architecture/module-boundaries.md) | 原 owner、公共调用与事务归属 |
| [公共扩展示例](../examples/foundation-extension/README.md) | 公共端口、生命周期和非执行预览 |

development 其余文件维护现行模块接线和开发命令；architecture 中的细分源表维护
owner／native／public／消费者归属。源表中的历史切片状态不是当前验收结论。

## 契约与设计依据

spec 维护领域／API／产品契约，protocol 维护机器协议及其 Schema／fixture；
decisions 维护 ADR，changes 维护冻结接口变更 FR，templates 提供变更模板。
这些文件仍是源码兼容和接入依据，未随过程文档清理删除。

- [Core](spec/core-v1.md)、[Control API](spec/control-api-v1.md)及[Runtime／Agent](spec/runtime-agent-v1.md)。
- [ADP/3](protocol/agent-deployment-v3.md)及[执行扩展](protocol/agent-deployment-execution-v1.md)。
- [共享资源带宽／流量](spec/shared-resource-payload-limits-v1.md)及[用量投影](spec/resource-usage-observation-v1.md)。
- [受控路径 Echo](spec/controlled-path-echo-v1.md)及[凭据轮换](spec/account-credentials-v1.md)。
- [FR 模板](templates/foundation-change-request.md)。

旧版本协议的 Schema／fixture 仍由显式兼容解析与负例消费，保留不代表启用旧在线协议。
当前准确证据以[验收状态](testing/verification-status.md)为准；稳定维护不替代实机验收。
