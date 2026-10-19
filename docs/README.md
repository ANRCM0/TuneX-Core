# TuneX VNext · Architecture Specification Index

**基线：v1.1 · 决策状态：Accepted for implementation · 2026-10-12**

当前机器协议为 **ADP/3**；ADP/1–2 保留历史契约与演进记录。基线版本、Core/Forward v1、Control API v1 与 ADP 协议版本分别管理，不混用。规范文档描述目标行为；开发入口与实施进度单独记录当前实现和证据，不代表完整目标已完成。

“定稿”在本仓库意指：作为后续开发的**设计基线**，修改必须通过 ADR、契约同步和测试；**不**表示已编写或已验证实现。

| 文档 | 规范角色 |
| --- | --- |
| [总体架构](architecture/overview.md) | 目标、边界、数据流与组件部署 |
| [Core v1](spec/core-v1.md) | 最小实体、值对象、规则和依赖方向 |
| [Core v1 公共表面](spec/core-v1-surface.md) | 后续开发采用的源码冻结基线；集中验收待执行 |
| [四层地基边界](architecture/foundation-layers-v1.md) / [ADR-0048](decisions/0048-foundation-layer-boundaries.md) | L0 最小决策、L1 宿主端口、L2 外部适配、L3 模块及实际迁移范围 |
| [地基 DoD 与并行门禁](development/foundation-readiness.md) | 当前未通过；源码、未实现项与集中验收分别记账 |
| [A5 source closure and B handoff](architecture/foundation-a5-source-closure-v1.md) | Manual source classification/reviewable candidate complete, FR-0023-0025 integrated; exact saved revision and all B acceptance remain unexecuted |
| [Complete Control source ledger](architecture/foundation-control-source-closure-v1.md) / [Agent source ledger](architecture/foundation-agent-source-closure-v1.md) / [Assets and support consumers](architecture/foundation-assets-consumers-closure-v1.md) | Named leaves/real consumers/defaults/private/native/assets/removal conditions; no directory exemption, checks or behavior acceptance |
| [FR-0023 timing facts](changes/FR-0023-agent-synchronization-facts.md) / [FR-0024 credential records](changes/FR-0024-agent-credential-native-records.md) / [FR-0025 cancellation port](changes/FR-0025-control-cancellation-port.md) | Explicit source breaking/counter migrations implemented-unverified; original native and safety-owner intent retained, no acceptance or release inferred |
| [Runtime legacy leaf source map](architecture/control-runtime-legacy-leaves-v1.md) | Exact34 old Runtime leaves, eight construction/callable bindings, retained interface, public type sources and observed consumers;203-205 unexecuted |
| [Application legacy leaf source map](architecture/control-application-legacy-leaves-v1.md) | Exact99 application leaves, original Control/default/callback composition and same public type declarations;206-208 unexecuted |
| [FR-0002 Runtime 显式时间 effects](changes/FR-0002-runtime-host-explicit-time-effects.md) | Host interface2 源码已实现未验收；同类后续提案按持续源码授权自主选优实施 |
| [FR-0003 后台任务 effects](changes/FR-0003-background-task-explicit-effects.md) / [FR-0004 owner 时间 codec](changes/FR-0004-owner-host-time-codecs.md) | Background/Ledger/Relay/Node authority interface2 源码已编写，121/122 未验收；旧原生构造入口保留 |
| [L1 生命周期/effects 源码分类](architecture/framework-lifecycle-effects-v1.md) | 原定时/退避/drain/格式调用链、精确兼容差异与九个文件的 shared/runtime type 债务，121–123 计划未执行 |
| [FR-0005 公共策略值](changes/FR-0005-runtime-policy-public-values.md) / [FR-0006 执行事实](changes/FR-0006-execution-observation-values.md) | 原唯一声明迁至精确 L1 入口，旧别名/default/wire 保留；124/125 未验收 |
| [FR-0007 Relay 原生策略视图](changes/FR-0007-relay-assignment-policy-views.md) / [源码调用链](architecture/runtime-common-values-and-relay-views-v1.md) | Relay interface3 要求两个原对象视图，原授权/时钟/Tx 决策留宿主；126 未验收，raw runtime type 债务仍开放 |
| [FR-0008 Runtime 公共事实/native 值族](changes/FR-0008-runtime-values-and-native-family.md) / [调用链与兼容绑定](architecture/runtime-value-family-native-v1.md) | Host3/Ledger3/Relay4/evidence2/values1，旧 native 入口显式专门化；127–129 未验收，Profile/其他 A5 债务仍开放 |
| [FR-0009 Profile 不透明端口](changes/FR-0009-opaque-profile-native-binding.md) / [FR-0010 Node native codec](changes/FR-0010-node-native-input-codec.md) / [调用链](architecture/profile-node-native-boundaries-v1.md) | values2/Relay5/config2/Transport2/Node3 源码候选；原 schema/native 类型及权威/Tx 保留，130–134 未验收 |
| [FR-0011 HTTP public/native](changes/FR-0011-control-native-http-entry.md) / [source chain](architecture/control-http-native-adapter-v1.md) | HTTP1 original L3 routes and L2 Hono/Node/URL/formats with exact old aliases; 135-137 unexecuted |
| [FR-0012 Agent Journal native values](changes/FR-0012-agent-journal-native-representation.md) / [source chain](architecture/agent-journal-native-values-v1.md) | executionstate2 required protocol/slot codec; original protected keys/Runner stages,138-140 unexecuted; lower JSON/type debt open |
| [FR-0013 Journal facts/native records](changes/FR-0013-agent-journal-facts-and-native-records.md) / [source chain](architecture/agent-journal-facts-native-v1.md) | executionstate3/Bootstrap2/provider2, tagless facts and original native records with explicit conversions; type identity split and141-143 unexecuted |
| [FR-0014 Offline Transit native binding](changes/FR-0014-offline-transit-native-binding.md) / [source chain](architecture/offline-transit-native-binding-v1.md) | PreparedInstance1/native adapter1, driver HostVersion1 unchanged; exact old controller/native stages,144-146 unexecuted; no live registration |
| [FR-0015 Agent observation wire/Host family](changes/FR-0015-agent-observation-wire-native-family.md) / [source chain](architecture/agent-observation-wire-native-v1.md) | runtimeobservation2/platformobservation2/wire1; exact native DTO/ACK/body/default and original counter/export owners,147-149 unexecuted |
| [Agent command/native CLI](architecture/agent-command-native-v1.md) | L3 command1/L2 CLI1, original global flags/inspect/enroll/run/proof/lock/signal and public Control offline planner;150-152 unexecuted, no L0/L1 contract change |
| [FR-0016 Runtime status read owner](changes/FR-0016-runtime-status-read-owner.md) / [actual chain](architecture/runtime-status-read-owner-v1.md) | Raw storage1/product queries1/native JSON-time; original SQL/recursive correlation/freshness and legacy constructor,153-155 unexecuted |
| [Control startup/client native owners](architecture/control-startup-client-native-v1.md) | Original config/release/start/signal and all command/key/body/HTTPS chains;156-157 unexecuted |
| [Agent native engine owners](architecture/agent-native-engine-owner-v1.md) | Forward/Relay/operational counters precise native owners, original config projection and shared budgets;158 unexecuted |
| [Server bootstrap/native preflight](architecture/control-server-bootstrap-native-v1.md) | Original public preflight, raw SQL/authority and native notification paths/lifecycle;159 unexecuted |
| [Agent native contracts/auxiliary inventory](architecture/agent-native-contracts-auxiliary-v1.md) | Exact codec/generated/schema/alias/CLI/responder purposes, retained internal Direct reuse;160 unexecuted |
| [FR-0017 Recovery owner workflow](changes/FR-0017-owner-recovery-quarantine-ports.md) / [complete chain](architecture/recovery-owner-workflow-v1.md) | Original supplied-Tx owners, full backup/restore policy and explicit native effects;161-166 unexecuted |
| [Observation recovery owners](architecture/observation-recovery-owners-v1.md) / [Recovery native effects](architecture/recovery-native-effects-v1.md) | Original10/2/4SQL, mutable state/post-endpoint clock and native file/dump/OS-clock/type chain; unverified |
| [Upgrade assessment owner/native](architecture/upgrade-assessment-owner-native-v1.md) / [Ops command owner/native](architecture/operator-command-owner-native-v1.md) | Original plan/readonly inspection and CLI/release effects, exact old public aliases;167-171 unexecuted |
| [Contracts package native map](architecture/contracts-package-native-boundaries-v1.md) / [Current Agent call chains](architecture/agent-remaining-source-callchains-v1.md) | Exact public leaves/barrels/assets and live/private default distinctions;172-173 unexecuted, later FR-0018 migrates the three named source sites |
| [FR-0018 Agent native defaults](changes/FR-0018-agent-native-default-bindings.md) / [current chain](architecture/agent-native-default-bindings-v1.md) | Canonical native binding1/Control aliases, original Probe construction seam and distinct explicit native counter clock;174-176 unexecuted |
| [Source root catalog](architecture/foundation-source-root-catalog-v1.md) / [Control bootstrap command](architecture/control-bootstrap-command-native-v1.md) | Protected Core four files unchanged; tool/production roots and original bootstrap owner/native1;177-178 unexecuted |
| [FR-0019 Console model/native](changes/FR-0019-console-model-native-effects.md) / [actual browser asset chain](architecture/console-model-browser-native-v1.md) | Original ten exports and explicit time/query effects, three fixed module assets;179-180 unexecuted, remaining Web bodies are A5 scope |
| [FR-0020 Console request/native composition](changes/FR-0020-console-request-native-effects.md) / [request](architecture/console-request-native-v1.md) / [main and Relay](architecture/console-browser-composition-v1.md) | Request1/native main/Relay forms and views, precise old entries and five served module assets;181-184 unexecuted, VM source harness adaptation deferred |
| [FR-0021 Echo receipt/history](changes/FR-0021-echo-receipt-history-completion.md) / [source chain](architecture/browser-echo-receipt-history-v1.md) | Existing historical read/selection/same-Tx capture/digest/filter source completion;185-188 planned/unexecuted, live v4 input and full Web inventory stay separate |
| [FR-0022 Rule owner/native](changes/FR-0022-rule-command-owner-native-view.md) / [source chain](architecture/rule-command-owner-native-v1.md) / [22-leaf map](architecture/browser-native-leaf-inventory-v1.md) | Actual Rule policy/native split and three fixed assets;21 other native leaves mapped individually;188-191 acceptance unexecuted |
| [Candidate review index](architecture/foundation-candidate-index-v1.md) | Independent public counters, current consumer/asset/distribution inputs and dirty addition/deletion replacements; coverage gaps recorded,192-196 unexecuted; not a frozen revision or complete A5 closure |
| [Contract asset source map](architecture/contract-assets-source-map-v1.md) / [package imports](../packages/contracts/README.md) | Named21 schema/load/embed/generated/handwritten paths and catalog/provider correspondence; actual11 exports documented,197-199 unexecuted |
| [Control legacy module leaves](architecture/control-legacy-module-leaves-v1.md) | Complete bounded59-file map, six existing constructor/static bindings and five public type consumer fixes;200-202 unexecuted, full nested/caller closure remains open |
| [Remaining source and freeze gaps](architecture/foundation-remaining-source-inventory-2026-10-19.md) | Manual inventory with later Recovery/ops/contracts/Agent-default/Web integration; full consumer/type/asset/candidate closure remains unverified |
| [PathTemplate owner](architecture/path-template-owner-v1.md) | Original public template rules, Path/Ingress collaboration and legacy aliases; item 54 unexecuted |
| [PathTemplate storage](architecture/path-template-storage-v1.md) | Parameterized lower ports, one original SQL store and precise zero-argument legacy entry; item 55 unexecuted |
| [PathBinding owner/storage](architecture/path-binding-owner-v1.md) | Public original path rules, lower provenance store, same-Forward-transaction chains and legacy entries; item 56 unexecuted |
| [PathGroup owner/storage](architecture/path-group-owner-v1.md) | Public original group rules, metadata/provenance SQL and dynamic-count legacy entry; item 57 unexecuted |
| [PathPublication owner/storage](architecture/path-publication-owner-v1.md) | Original durable plans, lower SQL/savepoints, business refusal provider and precise legacy bindings; item 58 unexecuted |
| [IngressGroup owner/storage](architecture/ingress-group-owner-v1.md) | Public shared ingress rules, lower group SQL, original member/reference behavior and legacy count binding; item 59 unexecuted |
| [IngressDeployment owner/storage](architecture/ingress-deployment-owner-v1.md) | Original creation/conditional deletion, lower SQL/savepoint, historical lineage and precise legacy bindings; item 60 unexecuted |
| [IngressMigration owner/storage](architecture/ingress-migration-owner-v1.md) | Original lineage/current-state coordination, lower SQL/savepoint, action-specific compensation and precise legacy bindings; item 61 unexecuted |
| [Transit negotiation owner](architecture/transit-negotiation-owner-v1.md) | Original raw lock-bound session reader, contract-only ACK and precise legacy entries; item 62 unexecuted |
| [Transit preview delivery](architecture/transit-delivery-owner-v1.md) | Original outbox/receipt SQL, public shared stage/step rules, disabled ACK and precise legacy entries; item 63 unexecuted |
| [Transit offline coordination](architecture/transit-coordination-owner-v1.md) | Original phase/proof/CAS/recovery owner, raw journal SQL and precise legacy entries; item 64 unexecuted |
| [Transit preparation/reservations](architecture/transit-preparation-reservations-v1.md) | Public compiler, L2 Intent framing and existing Runtime exclusive resource mode; items 65/66 unexecuted |
| [Transit staging/abort](architecture/transit-staging-owner-v1.md) | Public offline coordinator, raw stage SQL and exact release through the same Runtime resource owner; item 67 unexecuted |
| [Passive diagnostics/Audit owners](architecture/passive-diagnostic-audit-owners-v1.md) | Original public owner rules, read contracts, precise legacy aliases and L2 stored Probe framing; items 68/69 unexecuted |
| [Station/Notification owners](architecture/station-notification-owners-v1.md) | Producer-owned transactional handoff, original rules/workers and lower Vault/Sender contracts; items 70-72 unexecuted |
| [Probe history/finite-plan owners](architecture/probe-history-plan-owners-v1.md) | Original capture/read/decision owners, supplied-Tx issuer and L2 retained echo framing; items 73/74 unexecuted |
| [Telemetry public owners](architecture/telemetry-public-owners-v1.md) | Five independent original services, read-only mappings, precise deltas/fold and L2 ACKs; items 75-77 unexecuted |
| [Forward/Profile command owners](architecture/forward-profile-command-owners-v1.md) | Original acceptance/replay/Path/Ingress/retry/compensation and exact collaboration ports; items 98-101 unexecuted |
| [Control HTTP native source](architecture/control-http-native-adapter-v1.md) | Original TLS/body/error/asset implementations, complete entry reading and remaining adapter classification; item 106 unexecuted |
| [Path/Ingress coordinator source](architecture/path-ingress-source-continuation-v1.md) | Full original classes/APIs/contracts, public references and local limits; items 107/108 unexecuted |
| [Agent execution wire source](architecture/agent-execution-wire-source-v1.md) | Original status/result/ACK, staged echo context and shared native time with unchanged parent decisions; items 111/112/114 unexecuted |
| [Control execution policy owners](architecture/control-execution-policy-owners-v1.md) | Original Forward registry/adapters, Access/Node/Profile reconcilers and Snapshot sources, exact old bridges and Runtime directory classification; items 115-118 unexecuted |
| [Passive Node/Relay preview owners](architecture/node-observation-relay-plan-owners-v1.md) | Raw L1 read contracts, original observation cancellation and required Relay preview provider; items 102/103 unexecuted |
| [Control/Transport/Tunnel query owners](architecture/control-transport-tunnel-query-owners-v1.md) | Original detail/reference/peer projections, required L1 stores and exact clock/default semantics; items 89-91 unexecuted |
| [Access/Node command owners](architecture/access-node-command-owners-v1.md) | Original same-Tx writer/effects/audit/receipt and native hash/format aliases; items 92/93 unexecuted |
| [Native catalog/logical tunnel owners](architecture/native-catalog-tunnel-owners-v1.md) | Original catalog/view/forwarding, same command identity and canonical Path/Forward APIs; items 94/95 unexecuted |
| [Control Probe permit/machine](architecture/control-probe-permit-machine-owner-v1.md) | Original single permit authority and v1/v2/v3 machine adapters, same-Tx history and precise aliases; items 86-88 unexecuted |
| [Control Probe preflight/command](architecture/control-probe-plan-command-owner-v1.md) | Original preflight/issuer/resolver chains, canonical Probe contracts and exact old entries; item 81 unexecuted |
| [Agent Probe native owner](architecture/agent-probe-native-owner-v1.md) | Original native address/echo/format/default adapters; Gate/global budget/counter remain original; item 82 unexecuted |
| [Runner wire/native continuation](architecture/runner-execution-source-continuation-v1.md) | Original wire/assignment/catalog and preserved Runner lifecycle/legacy defaults; items 83/84 unexecuted |
| [Console query owner](architecture/console-query-owner-v1.md) | Original read coordinator/projections/filter rules, required L1 stores and precise aliases; item 85 unexecuted |
| [Control Probe registration owner](architecture/control-probe-registration-owner-v1.md) | Original hello/instance/qualification coordination, precise native defaults and legacy aliases; items 79/80 unexecuted |
| [Observation declaration owner](architecture/observation-service-owner-v1.md) | Original inert declaration service/API/contracts, same-Tx writes and precise old entries; item 78 unexecuted |
| [Transit source location inventory](development/transit-source-location-inventory.md) | Correct modules/runtime paths and existing single implementations; no source restoration was needed |
| [参考代码复用映射](development/reference-code-reuse-map.md) | 2026-10-19 用户允许成熟片段复用；实际来源/适配/版权许可与原阶段门禁分别记录 |
| [ForwardX 参考后的开发执行方案](development/forwardx-development-plan.md) | A 地基源码、B 集中验收、C 产品闭环、D 负载与拓扑、E 单独立项；当前 A1 已有源码片、A2 继续中 |
| [Probe 实例与资格存储](architecture/probe-registration-storage-v1.md) | L1 参数化记录、L2 原 SQL、L3 原规则与精确旧入口；item 48 未验收 |
| [ForwardX 源码对比（2026-10-19）](reference/forwardx-comparison-2026-10-19.md) / [优化候选顺序](development/forwardx-optimization-backlog.md) | 固定上游修订、实际源码证据、能力差异与适配限制；参考副本已更新，候选未实施 |
| [Probe 授权证据读取](architecture/probe-evidence-read-v1.md) | 下层会话/发布读取契约、原三个 SQL reader 与 Forward Probe 效果；item 49 未验收 |
| [Probe 许可持久化](architecture/probe-permit-storage-v1.md) | 参数化存储端口、原 SQL 与产品校验分离，保留旧类和恢复入口；item 50 未验收 |
| [Probe And Observation Owner Collaboration](architecture/probe-owner-collaboration-v1.md) | Public product rules, original owner call chains and direct legacy aliases; item 51 unexecuted |
| [可选观测 HTTP 公共契约](architecture/observability-http-contracts-v1.md) | 八组独立 L3 API、原 DTO/策略兼容与接入边界；源码已编写，item 31 未验收 |
| [Agent 首次登记边界](architecture/agent-enrollment-v1.md) | L1 协调、L2 原生文件/PKI/HTTPS、原 CLI 与 Journal 所有权；源码已编写，item 32 未验收 |
| [Agent Probe 原生边界](architecture/agent-probe-native-boundary-v1.md) | L2 配置/地址投影与 pinned TLS，Runner/Gate/watch 原权威保留；源码已编写，item 33 未验收 |
| [Agent Probe 平台效果](architecture/agent-probe-effects-v1.md) | L1 调度/熵/泛型拨号端口、L2 原生 provider 与原 Gate/共享预算；源码已编写，item 34 未验收 |
| [通知存储边界](architecture/notification-storage-boundary-v1.md) | 参数化 L1 存储契约、L2 SQL 与 L3 原值校验，保留旧入口；源码已编写，item 35 未验收 |
| [Control Probe 存储边界](architecture/probe-storage-boundary-v1.md) | 历史/计划 SQL、同步值校验及 L3 过期/失败规则，保留旧入口与恢复方法；item 36 未验收 |
| [观察元数据与审计存储](architecture/observation-read-storage-v1.md) | L1 原始读取/元数据端口、L2 SQL 与 L3 原投影，保留验证时点；item 37 未验收 |
| [转发诊断与站点告警存储](architecture/diagnostic-station-storage-v1.md) | L1 读取/参数化存储、L2 SQL/事实投影与 L3 原类型/错误码绑定；item 38 未验收 |
| [遥测存储边界](architecture/telemetry-storage-boundary-v1.md) | 四族原始点/来源下层端口与聚合 SQL、L3 原解析/折叠/限额，保留原子写入；item 39 未验收 |
| [观察声明原生值边界](architecture/observation-value-boundary-v1.md) | L2 对象/IP/证书/平台值，L3 原 trust 规则与 L1 请求封装，保留旧入口；item 40 未验收 |
| [观测应用原生效果](architecture/observability-application-effects-v1.md) | 可选观测应用复用 L2 UUID/digest/时间/游标/codec，L3 保留策略、事务与 authority；item 41 未验收 |
| [观测值与 Wire Codec](architecture/observability-value-codecs-v1.md) | 通知 URL、Probe 值/echo frame、遥测聚合值复用 L2 原生 codec，L3 保留规则；item 42 未验收 |
| [HTTP Codec 边界](architecture/http-codec-boundary-v1.md) | HTTP 组合使用 L2 wire/body codec 与 L1 分页，L3 保留路由/auth/filter；item 43 未验收 |
| [Probe 观察 Codec](architecture/probe-observation-codecs-v1.md) | Probe service/TLS/echo context 复用 L2 parser，L3 保留授权与 metadata 规则；item 44 未验收 |
| [Probe Machine Codec](architecture/probe-machine-codecs-v1.md) | Probe machine adapters 复用 L2 parser/time/JSON，L3 保留 permit/freshness/ack；item 45 未验收 |
| [Probe Permit Codec](architecture/probe-permit-codecs-v1.md) | 唯一 permit owner 复用 L2 parser/proof/time，L3 保留 authority/budget/replay；item 46 未验收 |
| [Probe Permit State Codec](architecture/probe-permit-state-codec-v1.md) | permit 状态 validator 复用 L2 context/ISO/digest，L3 保留字段与拒绝规则；item 47 未验收 |
| [兼容目标矩阵](architecture/compatibility-targets-v1.md) | 明确支持范围、拒绝语义与未实现目标 |
| [地基变更申请](templates/foundation-change-request.md) / [FR-0001](changes/FR-0001-foundation-layer-boundaries.md) | 接口/语义变化的提案、确认、迁移与兼容流程 |
| [公开接口扩展示例](../examples/foundation-extension/README.md) | 独立 L3 模块经 L1 事务/授权与 L2 格式适配做预览；源码已编写，未运行 |
| [分类接入框架 v1](architecture/framework-integration-v1.md) / [ADR-0047](decisions/0047-classified-integration-framework-v1.md) | 原生接入端口、契约分入口、任务生命周期及接入步骤；源码收口、未验证 |
| [Forward v1](spec/forward-v1.md) | 最小转发契约、并发、资源约束和生命周期 |
| [Node observation v1](spec/node-observation-v1.md) | 被动报告观察的授权、预算、期限及来源；不是独立主动健康探测 |
| [Node process telemetry v1](spec/node-telemetry-v1.md) | 默认关闭的 Agent 进程/本地执行存量指标与有界原始历史；不含主机、payload 或结算，已实现未验证 |
| [Native payload counters v1](spec/native-payload-counters-v1.md) | D2-B1 原生入口累计计数、完整实例身份与有界本地终态尾部；远程链路另由 D2-B2 承接，均未验证 |
| [Forward telemetry history v1](spec/forward-telemetry-v1.md) / [wire contract](protocol/forward-telemetry-v1.md) / [Schema](protocol/schemas/forward-telemetry-v1.schema.json) | D2-B2 默认关闭的独立入口累计上报、Runtime 来源映射与有界单实例历史/Console；本地接线未验证，不是规则总量或结算 |
| [ADR-0028](decisions/0028-independent-forward-telemetry.md) | 独立 epoch/sequence、共享小遥测池、0021 读模型及恢复隔离；保留唯一 Runtime 权威 |
| [Host telemetry v1](spec/host-telemetry-v1.md) / [wire](protocol/host-telemetry-v1.md) / [Schema](protocol/schemas/host-telemetry-v1.schema.json) | D2-C 独立 Agent 可见 OS/文件系统/网络命名空间与 CPU tick 连续性；非物理主机/cgroup 容量，未验证 |
| [ADR-0029](decisions/0029-independent-host-telemetry.md) | 默认关闭的主机可见指标、0022 有界读模型与恢复隔离；共享既有 observation 池，未完成 D2 |
| [Probe telemetry v1](spec/probe-telemetry-v1.md) / [wire](protocol/probe-telemetry-v1.md) / [Schema](protocol/schemas/probe-telemetry-v1.schema.json) | D2-D 实际 dial 尝试/有效成功失败/unknown/inFlight、完整历史绑定来源和有界单实例历史；未验证，不是消费分母或网络丢包率 |
| [ADR-0030](decisions/0030-independent-probe-telemetry.md) | 独立 Probe 累计读模型、0023 兼容/恢复与共享观察池；不修改 permit/claim/result 权威 |
| [Telemetry aggregates v1](spec/telemetry-rollups-v1.md) / [ADR-0031](decisions/0031-bounded-telemetry-rollups.md) | 四族原事务内分钟7天/小时30天精确series聚合、Scope/Node配额与可见缺口；默认关闭、本地未验证，非物理容量或结算 |
| [Telemetry wire v1](protocol/telemetry-v1.md) / [Schema](protocol/schemas/telemetry-v1.schema.json) | 独立 mTLS 采样/回执、精确 uint64 字符串、采样 epoch/sequence；不扩展 ADP/3 执行消息 |
| [ADR-0027](decisions/0027-independent-node-telemetry.md) | 独立采样/传输与小型非排队 SQL 池，0020 读模型、上限、恢复历史隔离及后续 D2 缺口 |
| [Forward probe v1 基础切片](spec/forward-probe-v1.md) | 授权预检、Agent 内部 TCP connect-only；默认关闭的操作链另见管理契约 |
| [Forward probe management v1](spec/forward-probe-management-v1.md) | 幂等签发、受限单次执行、历史回执与撤销；真实组合 Actions 待对应提交 |
| [Bounded Probe runs v1](spec/probe-runs-v1.md) / [ADR-0041](decisions/0041-bounded-probe-run-history.md) | D1 既有 Direct TCP 单次运行独立有界历史，原 owner 同事务捕获、manager 分页/详情与丢失计数；不扩执行/健康/调度，源码本地未验证 |
| [Bounded Probe plans v1](spec/probe-plans-v1.md) / [ADR-0042](decisions/0042-bounded-probe-plans.md) | D1 finite manual/scheduled Direct TCP intent, original-owner atomic issuance and default-off timer; source-only, unverified, not health or a new Probe protocol |
| [Same-Agent Direct ingress probes v1](spec/direct-ingress-probes-v1.md) / [ADR-0043](decisions/0043-typed-direct-ingress-probes.md) / [typed wire v2](protocol/probe-types-v2.md) | D1 explicit local listener TCP point, typed qualification/unified poll and original authority/budgets; excluded from egress-only v1 metrics, source-only/unverified, not external/full-path/application health |
| [Observation services v1](spec/observation-services-v1.md) / [ADR-0044](decisions/0044-observation-service-authority.md) | D1 manager-declared endpoint/public leaf trust, immutable config and metadata CAS, archive/recovery isolation plus independent finite TLS-only responder; metadata owner does not issue permits or prove ownership/health, source-only/unverified |
| [Direct ingress TLS probes v1](spec/direct-ingress-tls-probes-v1.md) / [ADR-0045](decisions/0045-direct-ingress-tls-probes.md) | Exact current service trust through the original Direct listener, sole Probe owner/Gate/budget, probeVersion3 compact evidence and Schema0036; no echo/external/health/C3 acceptance, source-only/unverified |
| [Native TLS tunnel management v1](spec/native-tunnel-management-v1.md) | 有界只读 Endpoint/凭据窗口/相邻规则，原 Profile/CAS 流程与真实 Relay 浏览器接线；非网络或删除安全证明 |
| [Native logical tunnel management v1](spec/logical-tunnel-management-v1.md) | 复用原路径模板/绑定 owner 的隧道列表、发布归档、精确拓扑与规则绑定入口；配置复用不等于物理共享，已实现未验证 |
| [ADR-0026](decisions/0026-logical-tunnel-management.md) | 已确认框架的首批业务收口；新旧 API 共用持久身份、原幂等摘要/回执与唯一 Forward/Runtime 接受 |
| [Bounded path groups v1](spec/path-groups-v1.md) / [ADR-0032](decisions/0032-bounded-path-groups.md) | C2-A 出口候选/完整备用路径、原 Forward 同事务单候选应用与有界来源历史；持久 saga 见后续 C2-B，入口组/C3 延后，不代表 C2 完成 |
| [Durable path publications v1](spec/path-publications-v1.md) / [ADR-0033](decisions/0033-durable-path-publications.md) | C2-B 有界人工持久批次、逐项接受/拒绝、取消未来 apply 与条件补偿；原 owner 同事务，不跨规则原子，入口新建见 C2-C，本地未验证，C3 延后 |
| [Ingress groups v1](spec/ingress-groups-v1.md) / [ADR-0034](decisions/0034-bounded-ingress-groups.md) | C2-C 有界入口定义与 NEW 独立 Forward/Operation 创建、历史归属及条件删除补偿；修订差异/显式迁移见后续 C2-C2，无当前入口指针/VIP/DNS/global HA，本地未验证 |
| [Explicit ingress migrations v1](spec/ingress-migrations-v1.md) / [ADR-0035](decisions/0035-explicit-ingress-migrations.md) | C2-C2 同组修订完整差异、精确历史 lineage 与最多八个显式 add/update/remove；原 owner 同事务、remove 不可补偿，无 current pointer，本地未验证 |
| [Passive Forward diagnostics v1](spec/forward-diagnostics-v1.md) / [ADR-0036](decisions/0036-passive-forward-diagnostics.md) | D3-A viewer 同事务有界被动七层诊断与同次读取脱敏支持包，独立观察池/no network；非备份/健康证明，审计查询见 D3-A2，事件/webhook 后续，未验证 |
| [Bounded audit events v1](spec/audit-events-v1.md) / [ADR-0037](decisions/0037-bounded-audit-query.md) | D3-A2 manager-only Scope 十五来源有界只读审计，固定时间窗/keyset/去敏与原始归属限制；非完整历史快照，无新写入/通知，已实现未验证 |
| [Bounded station alerts v1](spec/station-alerts-v1.md) / [ADR-0038](decisions/0038-bounded-station-alerts.md) | D3-B 固定三规则策略、持久条件/站内事件、去重/恢复/静默/确认；默认关闭，无网络发送/执行权，源码本地未验证，不代表 D3 完成 |
| [Protected notification endpoints v1](spec/notification-endpoints-v1.md) / [ADR-0039](decisions/0039-protected-notification-endpoints.md) | D3-B2 首片 manager 元数据与独立 Linux 加密凭据仓；首片未接线/deliveryAvailable=false 是历史范围，后续 outbox 见 ADR-0040，均本地未验证 |
| [Bounded notification deliveries v1](spec/notification-deliveries-v1.md) / [ADR-0040](decisions/0040-bounded-notification-delivery.md) | D3-B2 第二片新站内事件同事务有界 outbox、固定载荷/签名、claim/fence/限速/重试与 DNS 后再授权；默认关闭、未知可能重复、恢复取消旧队列，本地未验证，非 D3 完成 |
| [Explicit Profile publication v1](spec/profile-publication-v1.md) | 当前影响页最多十条固定修订，逐条新预检与原 CAS/幂等更新；部分失败与不确定重放，非原子发布 |
| [Native PathTemplate metadata v1](spec/native-path-templates-v1.md) | C1 首片不可变路径/精确 Endpoint 与 Profile 锁版、CAS 配额/归档；不创建绑定或切换，待 Actions |
| [ADR-0023](decisions/0023-immutable-native-path-metadata.md) | 路径元数据归属、原引用授权、升级恢复和后续同事务 Forward 绑定边界 |
| [Native path bindings v1](spec/native-path-bindings-v1.md) | 精确模板绑定/有界来源历史与引用影响，单规则显式切换走原 Forward 同事务接受；待 Actions |
| [ADR-0024](decisions/0024-original-owner-path-bindings.md) | 原 Forward 接受与路径来源原子保存、无变化绑定、配额/归档/恢复和切换限制 |
| [Explicit path publication v1](spec/path-publication-v1.md) | 当前影响页最多十条固定路径/CAS，逐条原提案/Relay 预检与原绑定命令；部分失败/不确定重放，待 Actions |
| [ADR-0025](decisions/0025-explicit-path-batches.md) | 复用原 Console 队列，不增加 Bulk/持久批次或第二执行器；保留独立事务与切换限制 |
| [Deployment Protocol v2](protocol/agent-deployment-v2.md) | Snapshot / Assignment / Observation / 租约与版本 |
| [Runtime & Agent v1](spec/runtime-agent-v1.md) | 部署状态机、双节点编排、故障恢复 |
| [模块边界](architecture/module-boundaries.md) | 模块拥有者、同步调用、持久化所有权 |
| [隧道与转发管理框架](architecture/project-framework-and-boundaries.md) | 已确认的增量开发方向；按隧道/转发划分业务与适配边界，明确逻辑定义/物理连接区别；首批入口已实现、未验证 |
| [Core 与兼容接入层现状](architecture/core-and-compatibility-status.md) | Core、协议兼容底座、宿主扩展接入的实际边界与缺口盘点；不是新协议 ADR |
| [分类接入契约与原生驱动注册](decisions/0006-classified-extension-contracts.md) | 三类扩展边界；Agent 注册、Console 查询与 Transport 解析端口；授权与 Journal 保持不变 |
| [ADR-0007](decisions/0007-bounded-agent-probe.md) | 主动 Probe 的 Agent 执行位置、独立许可、绑定/egress 与资源预算；远程协议留待后续 |
| [ADR-0008](decisions/0008-probe-contract-negotiation.md) | 独立只读机器协商与内部单次许可门禁；协商不是发包授权 |
| [Probe negotiation v1](protocol/probe-negotiation-v1.md) | mTLS 会话/实例绑定、共享 TS/Go Schema 与拒绝旧版；尚无远程执行许可和派发 |
| [ADR-0009](decisions/0009-probe-instance-ownership.md) | 内部持久 Probe 实例归属、CAS 替换/撤销与恢复隔离；不是远程登记或执行许可 |
| [ADR-0010](decisions/0010-probe-registration-lifecycle.md) | 独立远程登记、默认关闭的 Agent 门禁生命周期；不开放执行 |
| [Probe instance v1](protocol/probe-instance-v1.md) | mTLS 查询/登记/撤销、共享 TS/Go Schema、CAS 与失败/关闭边界；登记不是许可 |
| [ADR-0011](decisions/0011-probe-permit-authority.md) | 内部许可签发/持久单次消费、同库签发预算与恢复隔离；领取回执另见 ADR-0012 |
| [ADR-0012](decisions/0012-probe-claim-contract.md) | 独立 mTLS 单次领取与 Agent 完整绑定校验；回执不可执行、尚无派发与持续撤权 |
| [Probe claim v1](protocol/probe-claim-v1.md) | 已知许可 ID 的消费回执、共享 TS/Go 严格契约与不确定结果边界 |
| [ADR-0013](decisions/0013-probe-delivery-authority.md) | 内部有界任务选择、消费后当前授权检查与持久撤销；不开放远程派发或发包 |
| [ADR-0014](decisions/0014-probe-delivery-contract.md) | 不可执行的有界任务获取与消费后状态协议；仍未接入 Agent 主循环或持续撤权 |
| [Probe delivery v1](protocol/probe-delivery-v1.md) | mTLS poll/status、请求关联、空/单任务、最小绑定回执与时间边界 |
| [ADR-0015](decisions/0015-probe-agent-authority-watch.md) | Agent 内部有界请求与失败关闭观察监视器；不构造执行许可或接入生产循环 |
| [ADR-0016](decisions/0016-probe-result-receipts.md) | 原许可 owner 同事务接收有界上报结果，单份记录/重复回执，不更新健康或接入执行 |
| [Probe result v1](protocol/probe-result-v1.md) | 独立 mTLS 结果契约、TS/Go 内容摘要、去重与接收时间边界 |
| [ADR-0017](decisions/0017-probe-host-execution.md) | 内部单次宿主执行准入、持续检查与保守结果序列化；尚未接入生产调度或回传 |
| [ADR-0018](decisions/0018-probe-production-workflow.md) | 默认关闭的管理入口与 Agent 串行闭环；保留原权威、预算、失权关闭与不确定结果不重试 |
| [ADR-0001](decisions/0001-vnext-clean-slate.md) | 与历史 V2 脱钩及清理范围 |
| [ADR-0002](decisions/0002-runtime-contract-closure.md) | 租约、会话、切换与实施依赖收口 |
| [Control API / Operation v1](spec/control-api-v1.md) | 幂等、事务、连续修改、终态及状态查询 |
| [节点安全与恢复](operations/node-security-and-recovery-v1.md) | 注册、撤销、重装、备份恢复及 Relay 安全门槛 |
| [只读升级与恢复评估](operations/upgrade-assessment.md) | Schema/Journal 兼容矩阵、只读状态采集、备份责任与明确回退拒绝 |
| [ADP/2 direct Schema](protocol/schemas/adp-v2-direct.schema.json) / [fixture](protocol/fixtures/adp-v2-direct.json) | Phase 2 机器可校验契约；不宣称 Relay 支持 |
| [开发路线](development/roadmap.md) | 从空白 Core 到实网转发的交付门槛 |
| [Docker / 1Panel 部署手册](../deploy/README.md) | 分主机 Control/Agent、首次初始化与 Enrollment、真实 TCP/UDP、Relay 与恢复测试 |
| [下一阶段开发目标](development/next-milestones.md) | 多跳代码交付后的部署/升级、诊断审计、证据流程、Console、集中验收与发布排期 |
| [ForwardX 经验吸收计划](development/forwardx-gap-closure.md) | 功能差距、独立实现顺序、产品 UI/运维与验收 |
| [转发平台四主线适配方案](development/forwarding-platform-plan.md) | 基础转发、加密隧道、拓扑切换、监控探测的模块设计、迁移边界与 Actions 交付顺序 |
| [Forward-first Web Alpha](development/forward-first-web.md) | 节点、Direct、Operation 的可视化界面及安全边界 |
| [Relay Web 与节点诊断](development/relay-console.md) | 双节点 Relay 引导、只读诊断和安全安装手册 |
| [Multi-hop implementation and acceptance](development/multihop-execution.md) | Default-off execution, unified acceptance commands, physical inventory and release evidence |
| [Six-batch delivery ledger](development/multihop-delivery.md) | Implementation status and deferred validation; no runtime completion claim |
| [ADR-0005](decisions/0005-mixed-multihop-execution.md) | One physical ownership journal and explicitly versioned complete mixed execution |
| [开发入口](development/getting-started.md) | 工具版本、构建/测试、离线编译和开发 MySQL |
| [Phase 1](development/phase1.md) | 真实 MySQL/HTTPS/Go TCP 创建切片、启动及验收范围 |
| [实施进度](development/progress.md) | 当前工作树证据与后续实施范围；不是目标规范 |
| [验收规范](testing/acceptance-v1.md) | 安全、可靠性、实网测试矩阵 |
| [Native multi-hop Console acceptance](testing/native-multihop-console.md) | 3/4/8 Agent 的真实 Chromium 复制/锁版/启停/清理接线；尚未执行 |

## 规范约定

- **MUST / 必须**：无条件约束；不满足即不兼容本规范。
- **MUST NOT / 不得**：禁止行为。
- **SHOULD / 应当**：默认规则，例外需显式记录理由。
- **MAY / 可以**：可选能力，但不能悄悄改变基础语义。
- `Forward` 表达用户意图；`Deployment`、`Assignment` 是 Runtime 内部对象。
- `Desired`、`Applied`、`Healthy` 是不同维度，不得合为一个布尔值。

## 规范优先级及变更

在 VNext 实现范围内：已接受的 ADR > 版本化协议及领域规范 > 总体架构与开发路线 > 示例。冲突须修正规范，不能让实现细节暗中改变契约。破坏性修改协议需新版本并记录升级/拒绝策略；VNext **不承诺兼容旧 V2**。

历史源码与许可证档案在 `legal/` 中保留；它们不是新的业务文档。



Current direct TCP/UDP lifecycle development and evidence: [Phase 2](development/phase2.md).

Credential rotation, revocation and target-policy withdrawal: [Node security](development/node-security.md).

Suspend-aware tickets, data-plane expiry checks and fault evidence:
[Authorization faults](development/authorization-faults.md).

OS synchronization providers, protected proof and native Linux Agent acceptance:
[System time](development/system-time.md).

Owner-managed members, explicit Node grants and persistent execution authority:
[Access management](development/access-management.md).

Independent authority, old-backup recovery, operator commands and bounded Linux capacity evidence:
[Recovery and capacity](development/recovery-and-capacity.md).

Relay contract preparation, immutable Transport Profiles and explicit capability gate:
[Phase 3 preparation](development/relay-preparation.md).

Complete direct/Relay runtime contract preparation and protected physical high-water:
[ADP/3](protocol/agent-deployment-v3.md).

Current online machine protocol and explicit old-state refusal:
[ADP/3 cutover](development/adp3-cutover.md).

Explicit Relay Agent capability, protected peer identity and prepared assignment compiler:
[Relay Agent](development/relay-agent.md).

Durable two-Node Relay acceptance, readiness coordination and real multiprocess flow:
[Relay Control](development/relay-control.md).

Held TCP target/path switches, same-client UDP reset and partial activation/deadline/retry:
[Relay switch and faults](development/relay-switch-faults.md).

Independent Linux network namespaces, actual Relay partitions and activation/path compensation:
[Relay network isolation](development/relay-network-isolation.md).
