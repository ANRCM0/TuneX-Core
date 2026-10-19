# VNext 实施进度

更新：2026-10-19（Asia/Shanghai）。记录实现与证据，不取代目标规范。
下方以各切片的实际日期/基线保留历史记录；“尚未实现”等阶段性描述须结合后续
条目阅读，不能用早期状态覆盖最新代码。
Phase 0 基线提交 `2b679f5`；Phase 1 提交为 `b7e5f5b`。证据 JSON 的
commit 字段是测试时 HEAD；另记录 Agent SHA 和测试命令，明确未提交工作树。

## 当前源码快照与后续排期

2026-10-19 subsequent authorization: the human requested organization, testing
and push of the full A5 candidate. B verification and compatibility-harness
repairs are in progress; local static checks and Actions functional acceptance
are separate. See foundation-verification-2026-10-19.md. No foundation acceptance,
upper-module, merge or release gate is implied by this authorization.

2026-10-19 A5 source closure integrated: manual source/type/private/default/
consumer/asset/removal classification and reviewable candidate records are now
closed in foundation-a5-source-closure-v1.md. The Control59/Runtime34/application99
maps join complete named Control/Agent/assets/support ledgers and actual old
production/Recovery/phase/manual/test/serializer/VM consumers. Nineteen application
named type-export sources and Control Policy/Accepted now use the same public
declarations; value loading, constructor/method bodies and old bridge names stay.

Parallel source reading found three real lower residuals and implemented them
after recording FR-0023/0024/0025: timing2/platformclock2 native status/facts,
identity2/agentidentity2/nativeexecution2 native records/projections, and common
cancellation1/report-read2/notification-effects2. Breaking lower type/JSON/native
event views and parse-at-Evidence/cache frequency changes are explicit; a readonly
production-chain cross-review found no concrete omitted conversion, not a passing
check. All native/history/lifecycle equivalence remains unverified. HostVersion1
metadata vocabulary, wire/schema/default flags and original safety owners stay.

Public versions, boundary/candidate/root records and readiness206-220 are joined.
A5 source completion supersedes earlier open-inventory snapshots only; actual
immutable revision and B verification remain unexecuted. No tests/checks/tooling
expansion/format/generator/build/CI/experiments/commits/pushes ran. Foundation and
upper-module gates stay closed; physical/long-run/recovery/Responder/release gates
retain independent evidence requirements.

2026-10-19 A5 Runtime legacy source continuation: all34 modules/runtime bodies
read and mapped as eight construction/callable bindings, one retained native
RelayExecutionLedger interface and25 value/type forwarders. Five old type-port
forwarders now use existing Forward/Identity/Node public declarations; three
Runtime constructors import the same Policy declaration from its precise public
leaf. Value imports, default objects, signatures, versions and method bodies stay.
Held/per-call Transit services, module-time reservations, captured clocks, supplied
Tx and lazy/static Recovery consumers are recorded with removal conditions in
control-runtime-legacy-leaves-v1.md and the candidate/boundary index.203-205 are
planned/unexecuted. Full application/nested owners/Agent/Web/private/type/default/
consumer/fixture/asset closure, saved candidate and all acceptance gates remain
open. No checks/tests/tool expansion/format/generator/build/CI/experiments/Git
writes/delegation ran; only source/docs reads and edits.

2026-10-19 FR-0022源码已接入：完整读取并逐项映射22个旧Web文件，21个作为具名
native view/form/response适配器保留；rule-console.js实际产品命令编排已拆到L3
RuleCommands1，原DOM/input Set/JSON/编码/UUID/确认/abort/时钟归独立native view。
旧initRuleConsole保持原参数默认和七个返回方法，由原入口绑定public factories；
原单一selected Map/plan/generation/取消句柄、首次预检、未知重放、停止尾部、finally
await refresh顺序保留为源码意图，尚未验证。三个固定JS资产/type/routes接齐，旧
Rule/app/Relay VM源码提取需在集中验收适配canonical factories并保留覆盖。
188人工源码映射已写入browser-native-leaf-inventory-v1.md；185–191与此前验收全部
计划未执行。没有测试/类型/语法/静态/边界检查/格式化/生成/构建/CI/实验/Git写入/委派。
完整A5源码/type/private/default/消费者/资产/版本/移除条件/冻结候选/公开示例仍需
收口，尚未取得地基接受或上层并行开发资格；实时Echo v4接入仍是独立staged边界。

此前2026-10-19 FR-0021源码已补齐既有Echo历史读取链：probe.js原未定义回执投影、
原permit owner按族选择service context，以及同一事务中已有challenge/proof/字节/TLS
摘要捕获。probe-runs.js识别既有Echo摘要，绑定invocation/content digest并显示实际
TCP/UDP和字节数；HTTP/owner/browser/select接通既有echoed筛选。0037迁移与MySQL
history adapter源码已包含对应表示，本片未改SQL/迁移/时钟/事务/history owner。
公开machine API/receiveResult输入仍只声明v1/v2/v3；native v4存储解析不等于新增
实时v4接入、签发UI或能力接受。185–188全计划未执行，188的22个Web逐leaf完整分类
仍待完成。详见docs/architecture/browser-echo-receipt-history-v1.md与FR-0021；
无测试/检查/格式化/生成/构建/CI/实验/Git写入/委派，A5与后续地基接受门禁仍开放。

2026-10-19 FR-0020源码已接入：ConsoleRequest1归属原connected/version/JSON结果/
未知结果幂等键Map；native HTTP保留原fetch/options/abort/JSON/UUID，解码后才判旧连接，
再检查取消和HTTP。失败保留键，成功才删除，原reset在原位置清除，不增加重试或队列。
app.js成为原index入口的实际组合；native main view保留原DOM/表单/24个Console初始化/
页面auth-version/清理/监听顺序。Relay六个form函数与view body移到import-free原生
adapter，原relay-model.js/relay.js保留精确public绑定，不作目录豁免或新增业务根。
五个固定JS资产/type/routes已接齐。现有console-flow VM source harness依赖旧app/relay
私有布局，集中验收需适配canonical factories/UI ports；未改未运行、不新增生产凭据hook。
181–184全计划未执行；无tests/type/syntax/static/boundarychecks/format/generator/
build/CI/browser/native/network/MySQL实验/Git写入/委派。其他具名Web及完整A5/消费者/
type/private/default/公共版本/资产/移除条件/冻结候选与后续接受仍开放。
此前A5源码根目录补齐发现实际生产apps/web与bootstrap入口缺口：原Control
bootstrap已接到公共command/native1，保持argv/env首错、构造在try外、migrate后原
Identity.bootstrap、输出与finally close。FR-0019在实现前记录后，ConsoleModel1与
BrowserNative1分开原UI helper政策与Date/URL格式；旧model.js保持十个导出，三个
固定JS资产路由/type与实际相对ESM import接齐，原CSP/MIME/固定reader保持。
Core四个生产文件已读且未改，开发/生成/fixture/验收工具与生产roots分别记录；
Docker COPY与ignore只做源码读取，没有构建。177–180全计划未执行；无tests/type/
syntax/static/boundarychecks/format/generator/build/CI/browser/native/network/MySQL
实验/Git写入/委派。其他具名Web源码以及完整Control/Agent/type/private/消费者/资产/
公共版本/移除条件/冻结候选仍需逐项收口；本轮不是全仓分类完成或地基接受。
此前FR-0018 源码已接入：agentplatform1 归属原生 Providers/Effects/LocalServices
及 stateless defaults，Control 原名字保留精确别名、构造器/nil/fixture fallback。
canonical named-struct 的声明包/反射身份变化已在FR实现前记录。Probe仍在Guard后调用
原四种构造层级，native选择收口到原Control构造兼容桥；counter核心接收显式scheduler，
两个生产调用点使用单独绑定的原生counter时钟，未改成Runner注入时钟，终态仍先采样。
原L0/L1、协议/schema/Authority/Journal/ledger/预算不变；174–176全计划未执行。
本轮无测试/类型/语法/静态/边界检查/格式化/生成器/构建/CI/实验/Git写入或子代理委派。
完整A5 source/type/private/default/真实消费者/资产/移除条件/例子与冻结候选及所有接受门禁
仍未完成；不得把三个具体source点迁移当成全仓闭合或地基接受。
此前源码集成：UpgradeAssessment1 接齐原计划规则/报告与 native
bounded file/catalog/Authority/CA/MySQL 只读检查，旧两个脚本仅经公开入口精确别名。
OperatorCommand1/native1 接齐原 ops CLI 和 release evidence 入口，保留原环境/参数/
错误白名单/输出退出/Recovery 与 Authority 调用顺序。packages/contracts 逐 leaf、
11条exports及schema/catalog资产完成本片人工分类，三个L1版本1/1/2不变；其余native
barrel未当作L1。Agent实际调用链已收窄到default/fallback、Probe默认构造与生产counter
原生时钟采样，原JSON/time/echo旧残余已由后续源码迁移取代。167–173全计划未执行；
只做源码读写，无tests/type/syntax/static/boundary checks/format/generator/build/CI/
native/network/MySQL实验或Git写入。全A5/消费者/私有类型/资产分发/移除条件/例子与
完整冻结候选及后续接受仍开放；地基与上层模块门禁未打开。
此前并行源码集成：FR-0017 observation/publication/event storage1、各原 owner
恢复操作、RecoveryQuarantine1 与完整 RecoveryWorkflow/native1 已接回旧 operator
入口。原同Tx顺序、Notification端点后采样、publication共享时刻、未知发送结果、
history与唯一ledger/Authority保留；备份/恢复原native body已迁出，提交后凭据再rebind。
Server public preflight/raw bootstrap/native protected-path源码也已接齐；Agent native
codec/generated/schema/alias/辅助CLI/responder精确分类完成本片人工记录。159–166
计划未执行；无tests/type/syntax/static/boundarychecks/format/generator/build/CI/
native/network/MySQL实验或Git写入。Ops CLI/upgrade、packages native格式/资产、
剩余Agent/private/default、完整消费者/移除条件/例子/冻结候选仍需继续；未打开接受门禁。

此前并行源码集成：FR-0016 raw Runtime status storage1/product queries1/native
JSON-time 已接入两个原生产组合，旧 MySqlRuntimeObservations 构造/自有status/递归保留。
Control startup1/client-command1 与 native effects 已接齐；Agent 原生 multihop 配置
保留同 owner 单一实现，Relay 使用原 egress，Forward/Relay 共享原进程预算，Snapshot
同包迁移。153–158 全计划未执行；源码子代理授权不打开验证或上层功能门禁。
完整源码盘点定位下一真实缺口：ops Recovery 同事务跨 owner quarantine 写入、server
bootstrap/secret-path、native contracts/辅助CLI/工具及全量消费者/移除条件/冻结候选。
无 tests/checks/format/generator/build/CI/实验/提交推送；地基未接受。

2026-10-19 Agent command/native CLI source follow-up: L3 agentcommand1 retains
original mode/refusal/run-lock/Runner projection; L2 agentcli1 owns original global
flags/path/proof/key/inspection/token/enrollment/secure boot/diagnostics/signals.
Existing main/run/enrollment compose public Runner/Host/state; no L0/L1 contract or
control.Options identity change. Control offline plan consumes public compiler/facts.
150-152 planned/unexecuted; no checks/tests/CI/experiments/Git/delegation. Control
startup/client/server/ops/MySQL, native dependencies/full candidate and independent
foundation/example/physical/release acceptance remain open.

2026-10-19 Agent observation source follow-up: FR-0015 runtimeobservation2 generic
Host facts and native platformobservation2 explicitly bind observationwire1 DTOs.
Four sample/ACK/body/native formats and local counter DTOs move to L2 with old
aliases; samplers/worker/retention/generation/cursor/budget/timeout/close stay owner.
Native UDP diagnostics preserves exact assertion/one Stats under old mutex/branch.
147-149 planned/unexecuted; generic/reflection/serializer migration explicit. No
checks/tests/CI/Git/delegation; full dependencies/CLI/default/consumer/candidate and
foundation/example/physical/release acceptance remain open.

2026-10-19 Offline Transit source follow-up: FR-0014 adds prepared Activate/Close1
without changing driver HostVersion1. Original controller consumes native identity/
intent/engine/error and existing time/Schedule; same pointer, nil/partial error and
JSON-versus-Prepare branches preserved. Original authority/Journal/save-before-engine/
phase/close remain, native bodies unedited and no Run/poll/driver insertion.
144-146 planned/unexecuted; original mixed native dependencies and full Agent/Control/
CLI/default/type/consumer/candidate/acceptance stay open. No checks/tests/CI/Git/delegation.

2026-10-19 Journal facts/native source follow-up: FR-0013 executionstate3 removes
RawMessage/tags/native protocol/import names from lower facts. Exact original native
records stay under state with intentionally split type identity; all fields/references
project at store/wrapper/Bootstrap/Runner boundaries. Bootstrap/provider2 reflects
new output facts. Original native bytes/history/save-before-bind remain intended;
141-143 planned/unexecuted. Direct lower/type/serializer consumers require migration.
No checks/tests/CI/Git/delegation; full Agent/Control/CLI/default/consumer/candidate
and foundation/example acceptance remain open.

2026-10-19 Agent Journal source follow-up: FR-0012 executionstate2 requires native
protocol/physical-slot codec methods at old host stages. State owns shared original
physical/Transit keys and Runtime envelope; Runner drain tuple/URL/path use existing
native owners. Lock/reload/validate/history/save-before-bind and Ticket/drain/ACK/
tail/defaults remain.138-140 planned/unexecuted; no checks/tests/CI/Git/delegation.
Lower Journal RawMessage/tags/metadata and full Agent/server/CLI/default/private/
consumer/frozen candidate remain open; no whole foundation acceptance.

2026-10-19 HTTP source follow-up: FR-0011 keeps original route coordination/options
under L3 api/public.ts (HTTP1), with original Hono/Node/URL construction/types/context
in L2 control-http/public.ts and epoch/Console/Probe formats in the existing codec.
Old app/ports are exact aliases; server uses public with original services. Query
string versus params.size, middleware/body/error/argument/lifecycle stages remain.
135-137 planned/unexecuted; no checks/tests/CI/Git writes or delegation. Full Agent/
server/CLI/default/private/consumer/frozen candidate and foundation acceptance remain.

2026-10-19 Profile/Node native source follow-up: FR-0009 makes Profile an opaque
family slot and explicitly specializes native Transport/Endpoint/Relay/multihop/
Transit aliases. Native schemas/parsers remain original; Transport get formats its
old createdAt property through the same codec after original reads/parse/digest in
Tx. New required formatter refusal is intentional for custom construction. FR-0010
moves original Node token/CSR/support predicates and fingerprint prefix into its
existing native codec at original stages; authority/network/sign/replay/time/Tx
remain in the host. Source candidates values2/Relay5/configuration2/Transport2/Node3,
with Host3/Ledger3/evidence2 and native protocol/data unchanged.130-134 unexecuted;
the named bounded type/format migration is not full A5 or acceptance. No checks/
tests/formatters/generators/builds/CI/experiments/Git writes or delegation. Full
HTTP/Agent/default/private/consumer/removal/candidate/example work remains.

2026-10-19 Runtime family source follow-up: FR-0008 relocates original common
assignment/resource/tombstone/snapshot/Hello/report/ACK fields into precise L1
execution-values. Native declarations extend/alias them with existing closed
driver/envelope fields; erased family parameters connect host/ledger/Relay/stores/
assignment/evidence. Current native wrappers/compilers/MySQL/Forward/Probe/HTTP and
old wire-bearing aliases explicitly bind NativeRuntimeFamily. Host's original
protocol -> identity -> capability stages and Hello/ACK projection positions are
retained through required codec methods; remaining publication/Tx/authority bodies
stay original. Source candidates Host3/Ledger3/Relay4/evidence2/values1, no ADP/driver
version change.127-129 unexecuted. ProfileConfig/transitive config and full A5/native/
HTTP/Agent/default/consumer/candidate work remain; no type/boundary/behavior acceptance,
checks/tests/formatters/generators/builds/CI/experiments/Git writes or delegation.

2026-10-19 common-value/native-view source follow-up: FR-0005/0006 move the unique
original Policy and Observation/Drain/Condition declarations into two precise
public L1 leaves inside contracts, each interface1. Old native/public types alias
them; DEFAULT_POLICY stays in its original owner. No Core/kernel or wire schema
move. FR-0007 adds two required original-reference native assignment views to the
existing Relay compiler, advancing only Relay to3. Original host pins/auth/bound
loops retain lookup/digest/conditional clock/Tx/authority decisions; old constructor
defaults/static recovery remain. Missing direct/custom projections intentionally
refuse. Readiness124-126 planned/unexecuted; nine L1 files still use raw runtime
wire types and Relay profile transitively. Full A5/native/HTTP/Agent/candidate work
remains. No checks/tests/generators/builds/CI/experiments/Git writes or delegation.

2026-10-19 lifecycle/time source follow-up: FR-0003 records and implements required
BackgroundTaskEffects for direct L1 construction (background interface2). L2 native
interval/monotonic effects and the old one-argument application wrapper share one
original lifecycle; server explicitly binds effects with its five tasks/close order.
FR-0004 records Ledger/Relay/Node authority interface2 and required time codecs;
native providers replace the original Date expressions, including NodeService's
post-commit provision and transaction-bound view. Old constructor/default clock
capture stays; missing direct/custom effects intentionally refuse. Common error/
RequestLifecycle aliases and six common types now use public framework. Manual
source inventory records nine direct L1 shared/runtime type consumers and a Relay
profile transitive dependency as unresolved debt, not exceptions. Readiness121-123
planned/unexecuted; no checks/tests/build/CI/experiments/Git writes or agents. Full
A5 classification/consumers/removal/frozen candidate and foundation gates stay open.

2026-10-19 governance and FR-0002 source follow-up: the human explicitly confirmed
Runtime host interface2, then granted standing authorization to select and implement
similar foundation source proposals without repeated confirmation. AGENTS/template/
plan now retain FR impact/migration/acceptance records and autonomous source work.
RuntimeHost requires now and parseTime/formatTime; native fallback/Date operations
move to supplied L2 effects, old RuntimeController positional constructor binds
original dynamic native clock. Required-effect refusal is intentional for old direct
host/custom codec clients. Runtime query/telemetry aliases now use explicit public
exports; provider/default capture/consumer inventory recorded. Readiness119/120
unexecuted; no checks/tests/build/CI/experiments/Git writes or feature gate opening.

2026-10-19 newest Runtime policy source batch: original Forward executor/registry/
native adapters and Snapshot registry/Relay source are canonical Forward public
implementations. Profile/Access/Node reconcilers now belong to Transport/Identity/
Node public. Full original authorization/resource/Relay/adapter and Node management/
grant declarations have canonical owner leaves with exact old aliases. Control
keeps original instances/callbacks/Tx and one ledger/collector; original L1 hosts
and all storage bodies remain. Native compiler/catalog/clone are public L2.
Runtime directory manual source table records actual wrappers/aliases/debt, not
whole-A5 compliance. Readiness115-118 unexecuted; no checks/tests/format/generation/
builds/CI/experiments/Git writes or agents. L1 RuntimeHost native clock fallback/
Date formatting and full source/type/default/consumer/removal/freeze work remain.

2026-10-19 newest source batch: Agent original v2/v3/v4 status and four-family ACK
codecs, generic result field/JSON projection, two-stage echo context and shared
native RFC3339Nano parsing now have public L2 implementations. Parent retains
original family/receipt/equality/watch/Guard, once-only report, conservative time
projection/entropy/cutoff and provider/history/short-circuit sample decisions.
Original fifteen HTTP query files now have exact aliases to native codecs or
Console public owner entry; same product validator timing, per-family duplicate/
empty/revision/page/first-error differences and neutral lower record shapes.
Readiness111-114 planned/unexecuted; no checks/tests/format/generation/builds/CI/
experiments/Git writes or agents in this turn. Remaining HTTP URL/header/inline
projection/types/default and native URL/protected-key/engine/wire/CLI/Runtime
chains plus complete A5 source/type/consumer/removal/freeze inventory stay open.

2026-10-19 latest source integration, authored/unverified: complete original Path
and Ingress coordinator classes/APIs/flat contracts now have canonical public
owners and precise old aliases; existing Control/HTTP roots bind same instances,
stores and callbacks. Original Path references use public Node/Transport/Endpoint
contracts; mixed limit definitions now have canonical Path/Ingress local owners.
Complete HTTP entry was read; original TLS/body/error/console IO is public L2,
without route/admission/auth/limit changes. Agent qualification/poll/claim/v1 status,
wire times/service context and Runner report/drain/Snapshot/credential projections
have original native leaves, preserving burn/samples/Guard/callback/history/order.
Readiness106-110 planned only; no tests/checks/format/generate/builds/CI/experiments/
Git writes. Remaining HTTP query/native-type/default and Runtime/private adapter
chains, Agent execution status/result/echo/ACK and whole A5 candidate inventory stay
open. B needs later human verification authorization, C/D gated, E separate scope.

2026-10-19 current source batch, authored and unverified: original Profile grant
and complete Forward command bodies now canonical/public with exact old aliases,
original command ports/Tx/replay/provenance/retry/compensation/default fallbacks.
Original passive Node observation has public product owner/raw L1 reader contracts
and exact native lifecycle effects; lower MySQL body unchanged. Original root Relay
preview delegates to required public owner over same RelayCoordinator. Agent original
HTTP/JSON/bounded-body and v2/v3/v4 result-wire mechanics moved into native L2;
claim/current-instance/clock/trust/report-once/authority and version differences stay.
Readiness98-105 entirely planned/unexecuted. No tests/checks/format/generation/builds/
CI/experiments/commits/pushes. Remaining Path/Ingress bodies/contracts, Runtime/private
native defaults, full HTTP chain, Agent status/qualification/delivery/time/credential
formats and whole A5 freeze inventory remain actual source work. B unexecuted and
requires later human verification authorization; C/D not started, E separate approval.


2026-10-19 next integrated source batch, authored and unverified: original Control
Probe permit authority and five v1/v2/v3 machine adapters now have canonical public
owner bodies and exact old leaves. Original Control/Transport/Tunnel read services
and projections now use public owners; Identity Access/Node command/API/effects
join their existing public owners. Native catalog/logical tunnel implementations
and original Path/Forward command APIs have canonical owner leaves; same roots,
providers, stores, effects, flags, defaults and transaction/receipt identities stay.
Agent legacy header/declaration checks and echo endpoint mechanics move to native
L2 at original points, preserving distinct duplicate/clone/strict-last/error order.
Readiness86-97 entirely planned/unexecuted; no checks/tests/format/generation/builds/
CI/experiments/commits/pushes. Source agents were explicitly authorized; feature
parallelism/acceptance stays closed. Remaining Forward/Profile/Path/Ingress/HTTP
and Agent body-I/O/JSON/wire/time/source-type-default inventory are explicit source
blockers; whole A1-A5 and B-E not complete. No physical/release evidence inferred.


2026-10-19 integrated source continuation, authored and unverified: A1 original
instance/hello/qualification, preflight/command/Observation resolver and product
contracts now live in the public Probe owner; inert Observation command/query
chain is public. A2 Console query/rules/projections/API now has its own public
owner with same original Control/HTTP/store bindings. A3 original native address,
echo socket/format and default provider bodies moved to explicit probe/native L2;
parent retains global admission/Gate/counter/authority. A4 original Runner wire,
Direct/Relay assignment and native catalog/capability bodies moved into existing
nativeexecution L2, with same original Runner lifecycle/state and legacy errors.
Readiness78-85 is entirely planned/unexecuted. Original source/default/ordering
compatibility is not proven by these moves. Human authorized source-task agents;
no checks/tests/builds/experiments/CI/commits/pushes or gate opening. A1 permit/
claim/delivery/result/type/service, A2 other queries/commands/full HTTP, A3/A4 public
native references/authority/Journal/CLI and A5 whole classification remain open.


2026-10-19 A1 instance/negotiation/qualification source continuation, authored and
unverified: original five classes and exact machine/instance/evidence/measurement
contracts now live under public Probe owner. Original per-path default clock and
ACK timing, same-Tx generation/replay/expiry/credential/tombstone/recognition rules,
lower SQL and precise leaf aliases remain. Readiness79/80 unexecuted; remaining
A1 permit/command/plan/result/service coordination and A2/A3/A4/A5 remain open.
Human explicitly authorized source-task subagents on 2026-10-19. Source-only
agreement still excludes checks/tests/builds/experiments/CI/commits/pushes; no
acceptance or parallel feature gate opens.


2026-10-19 A2 twenty-sixth source slice, authored and unverified: original inert
ObservationServices command/query, API, product contracts and storage values now
live in the existing public declaration owner. Exact old leaf aliases, mutable
limits, same root instances/SQL, archived identity/quota, CAS/replay/clock and
immutable-revision/head/audit/receipt order remain source intent. Legacy wrapper
head/count hooks/static recovery unchanged. Readiness78 unexecuted; no tests,
checks, builds, experiments, CI, commits, pushes, delegation or gate opening.
A1 Probe coordination and other application/HTTP, Agent/native, Runner and full
source/type/default/bridge classification remain open.


2026-10-19 A2 twenty-first through twenty-fifth source slices, authored and
unverified: five original telemetry services and their shared API/contracts/
policies, mapping/recorder/read shapes and rollup rules/provider now live under
public telemetry-owner. Each class retains independent state/budgets/flags and
original lower SQL/mappers/observation pool. L2 owns original four ACK projections
and exact wire-type aliases; mapped count guards remain L3. Same root instances,
raw-then-rollup same-Tx order, epoch/replay/clock, exact BigInt deltas and original
quality/coverage/fold/query/capacity semantics remain source intent. Old paths
are precise leaf aliases. Readiness75-77 unexecuted. A1, other application/HTTP,
Agent/native, Runner and full classification remain open; no checks/tests/builds/
experiments/CI/commits/pushes/delegation or gate opening.


2026-10-19 A2 nineteenth/twentieth source slices, authored and unverified: original
Probe history recorder/read and finite plan services, rules/APIs/contracts/policies/
storage values now live in independent public owners. Probe-owned command API
acceptance declarations moved with exact legacy aliases; existing issuer/recorder
same-Tx roots, savepoint isolation, scheduling/expiry/replay/CAS and lower SQL stay
unchanged in source intent. L2 owns original retained echo invocation framing and
restores the missing original service-selection parser export. No new echo plan,
issuer, status filter, permit authority or feature flag. Readiness73/74 unexecuted.
Telemetry/rollup, A1 residuals, Agent/native, Runner and full classification remain
open; no checks/tests/builds/experiments/CI/commits/pushes/delegation or gate opening.


2026-10-19 A2 seventeenth/eighteenth source slices, authored and unverified:
StationAlerts and Notification endpoint/delivery services, rules, APIs, policies
and storage values now live in independent public owners. Station owns the same
supplied-Tx event handoff; Notification consumes public Station contracts/rules.
Original Vault/Sender declarations move to L1; native implementations import lower
ports without product types. Existing lower SQL/native bodies and server instances
stay unchanged. Original event/enqueue/policy atomicity, command replay/CAS, vault
stage before SQL publish, claim/preflight/Fence/attempt guards, key zeroing and
physical-idle-before-lease-release are source intent. Old paths directly alias
canonical leaves. Readiness70-72 unexecuted. Probe history/plan, telemetry, A1
residuals, Agent/native, Runner and full classification remain open; no tests/
checks/builds/experiments/CI/commits/pushes/delegation or gate opening.


2026-10-19 A2 fifteenth/sixteenth source slices, authored and unverified: the
original Audit and passive Forward diagnostic classes, APIs, read contracts and
policies now live in independent public owners. Audit read projection/policy stays
L3 over the same lower SQL; Station consumes its public error vocabulary. Diagnostic
Probe framing/body projection now uses separate original L2 functions, preserving
the parse catch boundary and all L3 identity/trust/time/state checks. Old entries
directly alias canonical leaves; server/HTTP use public owners. Per-instance
admission, original transactions, query/cursor/order, redaction/bytes and disabled
authority flags remain source intent. Readiness items 68/69 are unexecuted. Other
mixed owners, A1 residuals, Agent/native, Runner and full classification remain
open; no checks/tests/builds/experiments/CI/commits/pushes/delegation or gate opening.


2026-10-19 A2 fourteenth source slice, authored and unverified: public
TransitStagingService now owns original offline stage/abort coordination over
required public transaction/Node/Forward/Transport/Endpoint/reservation providers.
MySqlTransitStagingStore keeps original staging SQL and read-only Runtime/history
observations; exact physical release remains with MySqlRuntimeResourceStore via
the extracted RuntimeReservationRelease mode. Preserve all-slots-check before any
release, owner/Fence/generation predicates and same-Tx stage CAS/rollback. The old
five-argument coordinator retains own async methods, verifier/type aliases and
lazy unused-collaborator behavior. No live registration/execution or history reset.
Readiness item 67 is unexecuted. Other mixed owners, A1 residuals, Agent/native,
Runner and whole-source classification remain open. No checks/tests/builds,
experiments/CI/commits/pushes/delegation ran; no foundation or upper gate opens.


2026-10-19 A2 twelfth/thirteenth source slices, authored and unverified: original
preparation/resource-set rules now live in the public Transit owner, consuming
public Profile/Endpoint contracts, L1 Node facts and pure L2 format providers. Old
compile/type/validation entries directly alias the same implementations. Exclusive
reservation now delegates to the same Runtime resource owner through required raw
transactional storage and a late capacity provider. The existing MySQL resource
store reuses ensureSlot/assignSlot and retains exact original Node/minimal-slot/raw
count projections. It rejects even same-Forward owners; reserveRelay is unchanged.
The old reservation function binds the original dynamic DEFAULT_POLICY and creates
no pool, transaction or second ledger. Items 65/66 are planned only. Staging/abort
SQL and protected release, A1 residuals, Agent/native, Runner and full classification
remain open. No checks/tests/builds/experiments/CI/commits/pushes/delegation ran; no
foundation, upper-module or phase B-E gate opens.


2026-10-19 A2 eleventh source slice, authored and unverified: the location inventory
corrected the assistant's wrong src/runtime lookup; all seven Transit entries were
already under modules/runtime and needed no recovery. Original offline coordination
now has a public TransitCoordinationService, required raw lower storage and one
original SQL store. The old single-argument journal keeps its own public async
methods and lazy db dispatch; Control binds explicit providers. Actor/stage checks,
sorted sessions/physical ownership, proof-before-transition, exact revision/digest
CAS, two distinct begin timestamps and withdrawal-only recovery remain source-
intended unchanged. No default verifier, confirmation route, live execution or
reservation release is added. Item 64 is unexecuted. Staging/preparation/reservations,
A1 residuals, Agent/native, Runner and full classification stay open; no gate opens.
No checks/tests/builds/experiments/CI/commits/pushes or delegation ran.


2026-10-19 A2 tenth source slice, authored and unverified after explicit human
continuation: original preview delivery now uses public TransitPreviewDelivery,
required raw lower storage and the existing peek-only offline planner. One SQL
store owns outbox/receipt queries and writes; the old one-argument class retains
its own methods and lazy db/planner dispatch. Enqueue keeps its two original
transactions, poll its LIMIT 16 and per-row clock, and report its current-machine
before duplicate/high-water/freshness/CAS ordering. ACK never calls confirm or
grants execution. Shared retained-stage validation, preparation/coordination types
and offline step use public owner contracts. The restored coordination-step path
directly exports the existing coordination-values implementation, without copying
or deleting it. Item 63 is unexecuted. Staging/coordination SQL, preparation and
reservations, A1 residuals, Agent/native, Runner and full classification remain
open. No checks/tests/builds/experiments/CI/commits/pushes/delegation ran; no gate opens.


2026-10-19 A2 ninth source slice, authored and unverified: contract-only Transit
negotiation now uses a public product owner, a required raw machine-session lock
reader and one original SQL implementation. Raw numeric/null evidence and deferred
facts decoding retain original refusal order, FOR UPDATE and one dynamic clock
sample. The pure ACK formatter retains the same capability tuple, mutable response
and executionEnabled:false. Old one-argument construction/hello and API aliases
remain precise entries; Control assembles explicit providers. Item 62 is planned
only. Delivery/staging/coordination/reservations/preparation, A1 residuals, Agent/
native, Runner and full classification remain open. No verification, CI, Git writes
or delegation ran; no foundation, upper-module or phase B-E acceptance is claimed.


2026-10-19 A2 eighth source slice, authored and unverified: IngressMigration uses
lower parameterized Plan/Outcome/Failure contracts and one original SQL/savepoint
store. Control binds the original public refusal provider and existing origin,
group and Forward owners. Legacy zero-argument methods preserve lazy count/event
hooks; same-group coherence still precedes quota dispatch, filtered COUNT stays
direct, and original LIMIT 16/revision<20/CAS/recovery semantics remain. Apply and
compensation retain distinct add/update/remove behavior; remove is irreversible.
Readiness item 61 is planned only. Transit, A1 residuals, Agent/native, Runner and
whole-source classification remain open. No checks/tests/builds/experiments/CI,
commits/pushes or delegation ran; A2/foundation and upper-module gates stay closed.


2026-10-19 A2 seventh slice, source authored and unverified: IngressDeployment
uses lower parameterized Plan/Outcome storage and one original SQL/savepoint owner,
explicitly assembled in Control. The legacy zero-argument class retains count/event
dispatch, filtered list COUNT stays direct, and original LIMIT 16/revision<20/CAS/
recovery/outer-transaction semantics remain source-intended unchanged. Original
origin/lineage/migration parsers now have one public Ingress implementation and
old aliases; the deployment refusal provider directly reuses the original Path
provider without copying its Set. Item 60 is unexecuted. Migration SQL/coordination,
Transit, A1 residuals, Agent/Runner and full classification remain open; no gate
opens and no verification, CI, commit, push or delegation ran.

2026-10-19 A2 sixth slice, source authored and unverified: Ingress has a dedicated
public owner for the original group/selection/input/plan rules. Parameterized L1
group records/ports serve one L2 SQL store, explicitly bound in Control; old parser
exports and zero-argument methods preserve identity and lazy count overrides.
Original distinct ingress Nodes/common protocols, actor-dependent reference checks,
resolver ordering, Scope/head locks, quota/CAS/audit and native effects remain in
source intent. Item 59 is unexecuted. Deployment/migration/Transit, A1 residuals,
Agent/Runner and full classification stay open; no verification, CI or Git write.

2026-10-19 A2 fifth slice, source authored and unverified: original PathPublication
shared rules and refusal values now have a public Path owner. Parameterized lower
Plan/Outcome records and ports serve one SQL/savepoint store, explicitly bound in
Control. Old zero-argument methods and lazy count/event calls remain; refusal
classification precedes rollback while failure projection follows release. Original
shared/update locks, attempt/CAS/event order, outer transaction, recovery isolation
and conditional compensation stay source-intended unchanged. Item 58 is unexecuted.
Ingress/Transit, A1 residuals and Agent/Runner/full classification remain open.
No verification, experiments, CI, commit, push or delegation ran.

2026-10-19 A2 fourth slice, source authored and unverified: original PathGroup
shared rules now have a public Path owner; parameterized lower metadata ports and
binding ports serve one original SQL implementation. Control binds both lower
stores; old zero-argument classes and lazy publish -> this.count subclass dispatch
remain. Original Scope/head and Forward lock ownership, quotas/CAS, LIMIT 64 group
history and exact original Path provenance stay source-intended unchanged. Item 57
is unexecuted. Other Path/Ingress/Transit, A1 residuals and Agent/native/full-source
classification remain open. No verification, CI, commit, push or delegation ran.

2026-10-19 A2 third slice, source authored and unverified: original PathBinding
selection/expansion rules now have one public Path owner; lower L1 records/ports
and one L2 store own original provenance SQL. Control binds that store explicitly;
old parser exports and zero-argument storage methods remain precise compatibility
entries. Forward row-lock and supplied transaction, numeric sequence/64-entry
invariant, immutable history/current pointer, reference and preview meanings stay
source-intended unchanged. Item 56 is unexecuted; other A2 owners, A1 residuals,
Agent/native and full classification remain open. No verification or Git write.

2026-10-19 A2 second slice, source authored and unverified: PathTemplate persistence
now uses parameterized L1 records/ports and one L2 MySqlPathTemplateStore. Control
binds that store explicitly; the old zero-argument class and public methods remain
precise compatibility entries. Original SQL, raw JSON/Boolean mapping, paging,
locks and publish/archive/audit order are retained in source intent. Readiness
item 55 is unexecuted. Other A2 owners, A1 residuals and full classification remain
open; no verification, CI, commit or push ran and no gate is opened.

2026-10-19 A2 first slice, source authored and unverified: original PathTemplate
parser, requirements, limits and head/revision checks have one public Path owner.
PathBindings, PathGroups and IngressGroups consume its public rules rather than
private template application helpers. Old exports remain direct aliases; template
coordinators reuse public pagination/digest/ISO/default-clock helpers at original
call points. Item 54 is unexecuted. SQL storage and other Path/Ingress/Transit owners
still need source work. Entering A2 neither accepts A1 nor exempts its remaining
dependencies from the full foundation freeze. No verification, CI or Git writes.

2026-10-19 A1 sixth slice, **source authored, unverified**: negotiation, instance,
claim, delivery, typed qualification/poll/claim/status and service qualification/
poll/claim/status ACK projections now use one L2 machine formatter. Adapters retain
request parsing, mTLS identity, owner calls, freshness/deadline, transaction and
same-owner refusal checks; measurement and server-time callbacks remain at original
evaluation points. Public wire type aliases are explicit. Item 53 unexecuted; no
new protocol/issuer/feature or v4 ACK. Remaining direct wire/native/default and
A2-A5/full classification remain open; A1/foundation not accepted.

2026-10-19 A1 fifth slice, resumed after explicit human restoration approval:
source authored, unverified. The missing codec entry directly exports the existing
single native result implementation. Original version dispatch, stored format
checks and v1/v2/v3 result ACK projections live in L2; permit and machine adapters
retain original binding/proof/budget/history, identity, clock/freshness and committed
receipt checks. Wire aliases preserve the same types. Item 52 is unexecuted; no
v4 ACK, broader issuance, verification, delegation, commit or push is included.
A1 and the foundation remain unaccepted; the independent upper-module gate is closed.


2026-10-19 A1 fourth slice: source authored, unverified. Probe machine/qualification,
permit state, measurements and original storage values now have owner-local
implementations and public entrypoints. Observation declarations own their original
reference/config/trust rules and an explicit transactional read port. Coordinators
use these public rules; legacy functions/providers remain direct aliases. Separate
instance/qualification/permit/history state, original transactions, SQL and feature
flags remain unchanged in source intent. Readiness item 51 is unexecuted; wire type,
native/default and full-repository classification remain open. A1 and the foundation
are not accepted. No tests/checks/builds/experiments/CI/commits/pushes ran.


2026-10-19 A1 第三片，**源码已编写、未验证**：permit/withdrawal/result 的原 SQL
集中到参数化 L2 store，L1 仅有持久化记录和调用端口，原 measurement/context
解码、permit 校验与 v3/v4 result 规则由 L3 同步 provider 提供。Control/恢复
显式使用下层实现，旧零参类与各 prototype 方法、子类覆盖和静态入口仍保留。
原预算锁、两组 LIMIT 257 扫描、4096-byte 次序、v1/v2 非补校验和两个恢复取时点保持源码
意图；未复制 SQL、增加 authority、清空历史或启用功能。item 50 未执行；其余
Probe/private/wire、Path/Ingress/Transit、Agent/native 和全仓分类仍开放。A1 及
地基未接受，未运行检查/测试/构建/实验/CI，未提交推送。

2026-10-19 A1 第二片继续，**源码已编写、未验证**：machine session 和 published
Snapshot 读取契约归 L1，ProbeIntents 复用 RuntimeForwards；三个原 MySQL reader
直接使用下层契约，保留原类、SQL、解析和事务。Forward Probe 使用公共 L2 时钟、
ISO、目标策略、请求摘要及 service selection，原业务规则和执行开关不变。整理
前片重复注册导出并补齐既有 echo challenge parser 公共绑定。item 49 未执行；
permit 存储、其他混合依赖、Agent/native 和全仓分类仍开放，不把 A1 标为完成。
未运行检查、测试、构建、网络/MySQL/CI，未提交推送。

2026-10-19 按 [开发执行方案](forwardx-development-plan.md) 启动 A1，
**首片源码已编写、未验证，A1 尚未完成**：Probe 实例/资格记录有参数化 L1 定义，
L2 保留原 SQL，L3 提供原状态/期限/转换校验；旧零参类与静态恢复入口继续转接
同一实现，原装配与恢复代码使用新 store。实例五个取时点改用动态 L2 helper，
保留锁后重取；qualification 使用公共 codec，整理 parser 重复导出。item 48
未执行；执行开关、预算、协议和保护历史不变。用户允许同一地基任务内部互斥
子代理分工，不开放上层模块门禁。Forward Probe 及 permit/read/machine/intents
SQL 仍待继续；未运行检查、测试、构建、网络/MySQL/CI 或提交推送。
2026-10-19 Probe permit state validator 继续分层，**源码已编写、未验证**：纯
`validProbePermit`/binding 校验改用 public L2 context/selection/invocation digest 与
ISO，字段 union、state/expiry/fingerprint、TLS/echo scope/protocol/window/refusal
保持；无 storage/clock/network/mutation/authority/fallback。item 47 未执行，Agent
native 与全仓分类仍待继续。

2026-10-19 Probe permit owner codec 继续分层，**源码已编写、未验证**：唯一
ProbePermits authority 改用 public L2 parser/result-body/digest/proof/JSON/ISO/
certificate fingerprint/default clock；原锁、预算、issue/consume/check/revoke/
withdrawal/replay/duplicate/history/qualification 顺序和 protected store 保留。
item 46 未执行；未运行检查、测试、构建、网络/MySQL/CI 或提交推送，Agent/Probe
剩余 native/state 及全仓分类仍待继续。

2026-10-19 Probe machine codec 继续分层，**源码已编写、未验证**：claim/negotiation/
instance/delivery/result/typed/service adapters 改用 public L2 Probe parser、JSON、
UTC/ISO、default clock 与 digest；原 session/freshness/permit owner/commit-before-ack/
executionEnabled=false/refusal 规则保留。item 45 未执行，未运行检查、测试、构建、
网络/MySQL/CI 或提交推送，Probe permit/native、Agent 与全仓分类仍待继续。

2026-10-19 Probe observation service codec 继续分层，**源码已编写、未验证**：service
resolver 改用 public L2 Probe/TLS/echo context parser 与 digest，保留原授权、head/
revision、archive/recovery/version/transport/window/clock 和 refusal 顺序；不增加
network/secret/permit/sender/echo execution/Runtime write。item 44 未执行，未运行检查、
测试、构建、网络/MySQL/CI 或提交推送，Agent/Probe 其余 native wire 与全仓分类仍待继续。

2026-10-19 HTTP codec/query 边界继续分层，**源码已编写、未验证**：api/app 的 JSON、
UUID、UTF8 body 与 observability/Runtime/Transit/Probe parser 改用公共 L2；通用分页
移入 L1，旧 consolePage 兼容。路由、middleware、TLS/auth、body 限制、错误映射和
业务 filters 保留，未增加协议 fallback/network/authority/feature。item 43 未执行，
未运行检查、测试、构建、网络/MySQL/CI 或提交推送，其他 HTTP/Agent/全仓分类仍待继续。

2026-10-18 观测值与 wire codec 继续分层，**源码已编写、未验证**：通知 URL 解析
移入 L2 并由 application/infrastructure 共用；notification/station、Probe plan/run
及 telemetry rollup values 改用 L2 digest/time/JSON/bytes/base64/clone/staged-echo
frame 绑定。原字段顺序、错误/配额/生命周期、Probe 历史规则、rollup 算术与无执行/
无 DNS 语义保留，item 42 未执行。未运行检查、测试、格式化、构建、MySQL/网络/CI 或
提交推送，HTTP/Agent/全仓分类和地基门禁仍未完成。

2026-10-18 可选观测应用原生效果继续收口，**源码已编写、未验证**：telemetry/
diagnostics/audit/station/notification/Probe history/plan 应用改用公开 L2 的 UUID、
摘要、JSON/base64、UTC/ISO、单调时钟、字节和必要 wire codec；原构造/默认时钟、
游标字节、错误顺序、准入 map、事务/replay/rollback、sender/handoff、Probe/Runtime
authority 与功能开关保留。通知签名 key 仍在发送 finally 清零，诊断 DER 指纹字节不变。
item 41 未执行；未运行检查、测试、格式化、构建、MySQL/网络/CI 或提交推送，其他
应用/HTTP/Agent/全仓分类和地基门禁仍未完成。

2026-10-18 观察服务值/平台效果继续拆分，**源码已编写、未验证**：L2 承接原对象、
IP/URL/URN、staged echo 解码、公钥/证书投影，L3 保留配置与 scoped trust 规则；旧
helper 导出保留，HTTP 不再导入业务 observationObject 实现。ObservationServices 的
UUID/digest/UTF8 字节/单调时间和默认 Date.now 函数捕获改走公开 L2，原构造/时钟覆盖/
准入 map/事务顺序保留。L1 承接纯请求身份/key/封装，L2 注入原 digest，旧共享函数
签名兼容；item 40 未执行。没有运行检查、测试、格式化、构建、原生 PKI/网络/MySQL/
CI 或提交推送，其他 owner/HTTP/Agent 和全仓分类仍待继续，并行门禁仍关闭。

2026-10-18 遥测原始点/来源/聚合存储继续分层，**源码已编写、未验证**：L1 参数化
记录/存储/来源端口消除四组 raw store 和两个 mapping 对 L3 类型的引用，原类/方法体/
SQL/wire 解码保留。聚合 SQL 移入显式 L2 store，L3 同步提供原 parser/fold 和同一份
限额，旧零参公开方法保留；server 共享同一个 store，原始点与聚合仍在原事务内。
未新增池/事务/权威/worker/schema/功能，item 39 未执行。应用/值/native/HTTP/Agent
及全仓分类仍待继续；未运行检查、测试、格式化、构建、脚本、MySQL/网络/CI 或提交
推送，地基/并行门禁仍关闭。

2026-10-18 转发诊断/站点告警存储继续实拆，**源码已编写、未验证**：L1 只读投影与
参数化存储/事实端口、L2 三组 SQL 和单份原生行映射、L3 原类型断言/错误码 Set
绑定分开。完整策略/事件校验仍由原应用执行，旧零参公开方法和 policyCount 覆盖点
保留，server 显式装配并共享原 stationStore；不新增表/连接/事务/权威/worker。
item 38 未执行；应用/值/native/遥测存储/HTTP/Agent 及全仓分类仍需继续。未运行
检查、测试、格式化、构建、脚本、MySQL/网络/CI 或提交推送，地基/并行门禁仍关闭。

2026-10-18 观察服务元数据/审计读取继续分层，**源码已编写、未验证**：L1 原始读取/
元数据端口、L2 SQL/格式映射与 L3 词表/类型投影分开；不把旧类型断言冒充新校验，
完整配置/trust 及审计闭集检查仍在原调用点。旧零参/head/count/静态恢复入口保留，
已有 root/ops 改用下层；item 37 未执行，诊断/站内告警 SQL 及原生值依赖仍待收口。
未运行检查、测试、格式化、构建、脚本、MySQL/网络/CI 或提交推送，并行门禁仍关闭。

2026-10-18 Control Probe 历史/计划存储继续实拆，**源码已编写、未验证**：L1 参数化
存储/值端口不导入业务 wire/enum/parser，L3 保留旧类型的精确特化、capture/recorder/
issuer 和业务闭集。两组新 L2 store 承接原 SQL/行映射，旧 parser/immutable 回调同步
注入；active 计划过期转换和 savepoint 可隔离错误规则移回 L3，原事务/回滚/释放顺序
保留。已有 server/control/recovery 改用下层，旧零参/静态恢复及 get/lock/put 覆盖点仍
兼容；未扩展历史/计划/worker/echo/schema/权威。item 36 未执行，其他 SQL、值/native/
wire 及全仓分类仍待继续；未运行检查、测试、格式化、构建、脚本、MySQL/网络/CI 或
提交推送，地基/并行门禁仍关闭。

2026-10-18 通知端点/outbox 存储继续实拆，**源码已编写、未验证**：参数化 L1 存储
字段/端口与同步值回调承接下层契约，业务 config/payload/状态/错误/规则留 L3；两个
新 L2 store 保留原 SQL/行映射，不再导入 application/module。原解析器经两个独立
family binding 由已有 server 显式注入，旧零参类保留无状态公开方法与 count/get 覆盖点。
原事务/锁/去重/immutable/CAS/限额/淘汰/损失/速率/历史顺序不改，sender/vault/worker/
权威未动；其余值文件/native/vault/sender/SQL 依赖仍待收口。item 35 未执行，没有
运行检查、测试、格式化、构建、MySQL/网络/CI 或提交推送，地基/并行门禁仍未通过。

2026-10-18 Probe executor/Gate/counter 平台效果继续拆分，**源码已编写、未验证**：复用
L1 Scheduler/Entropy 并添加泛型 Dialer，L2 保留原零配置 net.Dialer；旧四个构造器仍用
原生默认，新增四个显式效果构造器拒绝缺失 provider，不改变 Runner 既有覆盖范围。
原时间/deadline/ticker、Gate 32-byte 随机实例、counter 16-byte epoch/结束时刻与共享
准入冷却经 provider 执行，保留唯一 Gate/CounterSet/进程预算及旧私有兼容 helper。
未引入重放清理、新预算或 echo 行为；net/address/wire/value/native default/echo 仍是
混合依赖债务。item 34 未执行，没有运行检查、测试、gofmt、构建、原生/网络/CI 或
提交推送，地基/并行门禁仍未通过。

2026-10-18 Agent Probe 原生边界继续实拆，**源码已编写、未验证**：Control 原生 Direct
配置/digest/egress revision/端口、观察入口地址和服务/业务目标匹配进入 L2 nativeexecution；
Runner 保留绑定、Guard/Ticket、唯一当前实例/指针、锁、回调、deadline/CIDR copy。
原 pinned TLS 实现进入 observationtrust，旧 Probe 握手入口/denial/budget 别名及 socket
生命周期保留；TLS 1.3、SNI/ALPN/leaf、双向字节限制与取消不放宽。Gate/watch/once/
global budget/原协议和 echo 未改，另外移除源码阅读发现的两个未使用 context import。
item 33 未执行；Probe executor/Gate/counters/echo 的 native/time/entropy/network/wire、
其他 Control 私有兼容及 engine/wire 仍是债务。没有运行检查、测试、gofmt、构建、PKI/
网络/CI 或提交推送；地基/并行门禁仍未通过。

2026-10-18 Agent 首次登记流程继续实拆，**源码已编写、未验证**：L1 executionenrollment
经 generic Platform/Channel 协调，L2 agentenrollment 承接原文件/密钥/CSR/CA/证书/
HTTPS/JSON 实现；CLI 保留原参数、环境、路径/proof/检查/锁和 enrollment 入口。
原 AtomicWrite/InitializeRuntimeJournal 所有者不变，最终 MAC-key → Journal → 证书
→ 成功输出 → body/idle 关闭顺序通过完成回调保留；无重试、自动修复、状态重置或
执行授权扩展。item 32 未执行，Control 私有兼容、Probe/trust、其他 CLI/native 与
engine/wire 分类仍待继续。没有运行检查、测试、格式化、构建、PKI/文件/网络实验、
CI 或提交推送；没有因接线存在而宣称 Agent/地基验收或打开并行门禁。

2026-10-18 其余八组可选观测 HTTP 契约继续收口，**源码已编写、未验证**：诊断、审计、
站内告警、通知端点/投递、Probe 历史/有限计划和观察服务改用六个独立 L3 API 入口，
HTTP 不再从这些实现类派生 never-Tx 视图；原方法/SQL/路由/权威与 worker 不改。
显式 DTO 保留原 owner/wire 值和红线；七组限额及 audit coverage 单源公开，旧常量/
ProbePlanReceipt 导出保留。源码边界清单新增实际 API/owner 契约与混合应用/格式/存储/
HTTP 依赖债务，未冒充全仓合规。item 31 未验收，Agent/native、内部存储/格式与全仓
分类仍须继续；没有运行检查、测试、格式化、构建、网络/数据库/browser/CI 或提交
推送，没有接通 staged echo，地基/并行门禁仍关闭。

2026-10-18 可选 telemetry HTTP 契约继续收口，**源码已编写、未验证**：四类 telemetry
与 rollup 采用独立 API/响应声明，保留 wire ACK、admission 泛型、原查询/delta/精度与
可空/只读/宽类型区别。五组冻结 policy 单源公开、旧导出保留，各 family 对象与计数器
不合并；原摄取/查询/聚合/SQL/路由不改。item 30 未验收，native/time/Buffer/存储债务
和其余可选观测/Agent/全仓分类仍待继续；未运行检查、测试、格式化、构建、网络/
数据库/browser/CI 或提交推送，地基/并行门禁仍未通过。

2026-10-18 Agent execution host/原生驱动继续实拆，**源码已编写、未验证**：L1
executionhost 持有 generic Host/Driver/Instance/registry，不导入 ADP/Relay 或读取 OS；
旧 executiondriver 保留 HostVersion 1、公开类型/方法及零值行为，作为原生类型/实际 OS
绑定。Direct/Relay/Multihop 原生转换、start/replace/phase/cleanup/error 单源迁到 L2
nativeexecution，Control 旧 helper 委托；未把遥测平台当执行依据。Runner 的 Journal/
Guard/Ticket、授权/资源/退休/Probe 顺序未改，未加协议/capability/默认开关或接通 echo。
旧 Control precheck/类型、Probe/trust/CLI 和 native engine/wire 内部仍是债务。未运行
检查、测试、gofmt、构建、生成器、原生/网络/数据库/browser/CI 或提交推送；item 29
未验收，地基与并行门禁仍未通过。

2026-10-18 management read-model 继续实拆，**源码已编写、未验证**：L1 只声明原始行/
分页/过滤及事务内读取端口，L2 承接原 Console/Profile/Tunnel SQL 和格式值，三组业务
投影留在 L3；SQL adapter 不再导入 application DTO/helper。同步投影回调在最后一次
读取后执行，不跨入新的异步投影阶段；主装配显式接线。旧三个 reader 保留无状态原型
方法/零参构造及结构替换能力，SQL 分页 helper 独立且旧路径继续导出，七个消费者仅
改 helper 导入。原 SQL/参数/过滤/时钟/解码/错误/事务顺序是保留意图，仍待验收。
未运行检查、测试、格式化、构建、生成器、网络/数据库/browser/CI 或提交推送；item 28
未验证，其他混合 adapter、可选观测/Agent/全仓分类和地基门禁仍未完成。

2026-10-18 Probe HTTP/owner 契约继续收口，**源码已编写、未验证**：Forward preflight/
管理与九组机器 API 采用独立声明，复用原 v1/v2/v3 wire 类型；主要 wrapper 改用公共
instance/permit 端口，不再从具体 owner 类派生方法。原 acceptance/instance 类型及
measurement/qualification 声明单源公开、旧路径导出保留；有限计划 receipt 类型不再
依赖 ForwardProbes 实现。owner 方法、事务、budget、one-use/撤权/result/history 与
commit-before-ACK 未改；未加路由/版本/续期/预算退款，staged echo 未扩大或接通。
native/time/crypto/SQL/暂存耦合继续列债务。未运行检查、测试、格式化、构建、生成器、
网络/数据库/browser/CI 或提交推送；item 27 未验收，整个地基/并行门禁仍未通过。

2026-10-18 path/ingress 公共契约继续收口，**源码已编写、未验证**：PathGroup/
PathPublication/IngressGroup/IngressDeployment/IngressMigration 五组 HTTP API 使用
独立声明；入口部署与迁移消费事务内 IngressGroupResolver，不再依赖具体 Group 类。
Template/Group 类型与四组原限额各保留一个公开来源，旧类型/值路径继续导出；六组
owner ports 改用公开分页声明和 framework domain 别名。原业务方法、SQL、路由及
CAS/replay/逐项接受/条件补偿/恢复隔离未改，初始化迁移与类型兼容仍待集中验收。
已登记 native 格式/应用协调混合债务，不宣称整体分层通过。未执行检查、测试、格式化、
构建、生成器、网络/数据库/browser/CI 或提交推送；item 26 未验收，地基门禁仍关闭。

2026-10-18 Relay/Transit/被动 Node 观察 HTTP 契约继续收口，**源码已编写、未验证**：
独立 RelayPlanApi/响应 union、原 runtime owner 的 Transit HTTP 契约及 NodeObservationApi
替代对应 class-derived 视图；实现仅增加接口声明，原方法、事务、SQL、路由及安全顺序
未改。保留 Relay 非预留、Transit contract-only/received-only、被动报告非独立健康证据
的边界；Transit SQL/原生/时钟混合实现明确列为债务，不因接口提取宣称分层通过。
未运行检查、测试、格式化、构建、网络/数据库/browser/CI 或提交推送；item 25 待验收，
path/ingress/Probe/可选观测接口、Agent 与全仓分类仍未完成，地基/并行门禁保持关闭。

2026-10-18 查询 HTTP 契约继续收口，**源码已编写、未验证**：Console/catalog/Profile
reference/Tunnel 采用独立 Api，原分页/过滤/投影/read-port 类型迁出实现并保留旧路径
重导出；原生 descriptor 复用 L2 公开类型，不复制 schema。查询方法、SQL、时钟与路由
未改；保留原可变/只读/可空/unknown 和来源/非授权含义，不新增健康或物理兼容证据。
已显式登记三个 MySQL read-model 的 application 类型/helper 反向依赖为未收口债务。
未执行检查、测试、格式化、构建、网络/数据库/CI 或提交推送；item 24 未验证，剩余
HTTP/adapter/Agent 与全仓分类和地基门禁仍未完成。

2026-10-18 管理 HTTP 契约继续收口，**源码已编写、未验证**：NodeApi 与 Forward/
路径绑定、成员/Node/Profile 授权、Node 管理及详情查询的独立契约替代相应 class Pick/
never-Tx 派生；实现声明 implements，原响应与 capability 类型路径保留重导出。业务 DTO
仍归 L3/application，未改业务方法、路由、凭据和事务顺序，未把 policy/lastError/raw
spec 宣称为新验证类型。未运行检查、测试、格式化、构建、browser/PKI/网络/数据库/CI
或提交推送；剩余 console/Relay preview/path/ingress/Probe/可选观测接口与 Agent/
全仓分类仍未完成，item 23 未验收，门禁关闭。

2026-10-18 Forward/idempotency owner 继续分层，**源码已编写、未验证**：L1 存储/格式
端口与 IdempotencyHost、L3 ForwardStateService 承接状态投影、引用选择、锁定重放和
冲突决定；L2 保留原 MySQL SQL/参数/锁/JSON。旧 Forwarding()/Idempotency() 与 ports
入口保留，ForwardCommands、Runtime/Transit/Relay/path 消费者继续使用原事务和唯一
Runtime ledger。未新增 parser、retry、event、authority 或历史重置。未运行检查、测试、
格式化、构建、数据库/网络实验、CI 或提交推送；item 22 与行为等价均未验证，其他
HTTP/Agent/分类工作仍未完成。

2026-10-18 Transport/Relay endpoint owner 继续分层，**源码已编写、未验证**：独立
L3 owner 承接原 Profile/授权/endpoint 命令及公共 API，L1 声明存储/codec 端口，L2
保留原事务 SQL 与原生闭合解析/摘要/存储值/ID/修订/请求 key 规则。Node 管理与审计、
Forward 引用锁改用 owner 公共契约；旧构造、Transport 静态恢复和 parser/type 路径
保留。HTTP/主装配不再从两者具体类派生 API；活跃 endpoint 变更继续拒绝，原子协调
仍归原事务/应用。未运行检查、测试、格式化、构建、原生/数据库实验、CI 或提交推送；
Forwarding/idempotency、其他 HTTP/模块与 Agent 及全仓分类/集中验收仍未完成。

2026-10-18 Identity owner 继续分层，**源码已编写、未验证**：公共 bearer/Scope/owner
检查进入 L1 IdentityAccessHost，原 SQL 与独立 pool 认证查询进入 L2，成员角色/变更/
恢复/列表及审计命令保留在独立 L3 identity-owner。旧 Identity(db)、helper/type 入口
与原响应形状保留。HTTP 改用独立 IdentityQueries；主装配、Node、Transport 与 Relay
endpoint 的身份依赖改为显式 owner/授权契约。原锁序、事务、错误和恢复顺序仅为源码
保留意图，未执行检查、测试、原生/数据库实验、构建、CI 或提交推送；其他业务/HTTP
与平台混合 owner 及全仓分类尚未完成，地基与并行门禁仍未通过。

2026-10-18 Agent 本地观测/熵源/测量文件继续分层，**源码已编写、未验证**：L1
runtimeobservation 持有 Process/Host 值与独立读取端口，L2 platformobservation.Native
执行原内存/进程/主机/PID/平台采样，旧类型为同一声明的别名。runtimeplatform 新增
Entropy/MeasurementFiles/LocalLog，platformruntime.Local 承接原安全随机数、诊断与
同目录 counter 文件写入和 stderr；Runner 保留读值/锁/失败/最终写入顺序。四类遥测
epoch 与 Probe 请求 ID 改用注入熵源，旧构造/helper 仍保留，新显式本地服务构造拒绝
缺失 provider。未执行检查、测试、格式化、构建、原生实验、CI 或提交推送；CLI、
执行/Probe 耦合、业务/HTTP 契约与全仓分类及集中验收仍未完成，门禁继续关闭。

2026-10-18 Agent bootstrap/调度/专用 HTTP 继续分层，**源码已编写、未验证**：
runtimeplatform/platformruntime 分离启动读取及操作调度，Runner 保留原启动与显式迁移
顺序；Auxiliary/controlchannel 分离 Probe 与四类遥测的请求/client pool，原调用方保留
响应读取/关闭、ACK/取消/one-use 决策。主机资源类型和 Linux/non-Linux 采样迁入 L2
platformobservation，旧类型/函数入口保留。阅读当前 poll 代码时补回其仍需的 strconv
import。未运行检查、测试、gofmt、构建、网络/文件/OS/CI，未提交推送；剩余平台与
模块/HTTP/分类和集中验收继续推进，不把源码提取报告为地基完成。

2026-10-18 Runner 凭据与主控制通道继续分层，**源码已编写、未验证**：L1
executionidentity/executionchannel 定义 generic provider，L2 agentidentity/controlchannel
承接原文件/密码学/CA/TLS/HTTP 操作。Runner 仍拥有 Probe 失效、Guard 更新、内存
凭据切换和续约/重放决定，旧构造、helpers/type 入口与原 HTTP client 类型保留。
Relay 首次文件缺失才续签，后续 MAC/读取失败仍拒绝；机器保存/reload/清理和 Relay
保存/清理/安装顺序按原源码保留。未运行检查/测试/gofmt/构建/凭据或网络实验/CI，
未提交推送；Agent 剩余平台耦合与后续契约/分类/集中验收继续保持未完成。

2026-10-18 Agent 安全/平台边界继续提取，**源码已编写、未验证**：executiontime
承接原 Guard/Ticket/同步缓存决策，platformclock 承接 Linux/Windows 时钟与 OS 状态；
authorization 旧入口绑定原 provider、委托单一底层 Guard。executionstate 通过显式
锁/存储/验证投影端口协调原 Journal 接受，state 旧入口仍使用原 MAC/key/path 与
native 编解码。Journal JSON/type 别名、持久先于 socket、原 Fence/会话/阶段拒绝保持
源码意图；原子写入/OS 锁迁到 platformstate 后由旧 state API 委托。没有创建/迁移/
清空任何运行状态，没有执行检查、测试、gofmt、build、OS/文件/网络实验、CI 或提交
推送。Runner 凭据/TLS/HTTP 和其他平台/模块债务仍未完成，目标与门禁状态不变。

2026-10-18 Node 分层继续推进，**源码已编写、未验证**：NodeAuthorityHost<Tx> 承接
原凭据/运行授权协调，L3 node-owner 保留业务策略/授权/撤销及查询命令与 DTO；
MySqlNodeAuthorityStore 承接事务内 SQL，原 pool 机器查询单列端口，PKI/令牌哈希/
原生校验由 L2 提供。旧 Nodes 构造、静态恢复隔离、策略及 Identity helper 路径保留。
签发后复查、重放/当前凭据顺序、重叠上限、锁与审计按原源码流程提取，尚无行为
等价证据。未运行检查/测试/PKI/网络/CI 或提交推送；Agent/其他 owner/HTTP 与全仓
分类仍未收口，目标保持进行中，门禁关闭。

2026-10-18 Relay 与原生编译器继续收口，**源码已编写、未验证**：L1 RuntimeRelayHost
接管原阶段协调、授权续约/撤回及观测判定；L2 MySqlRelayDeploymentStore 只写部署表，
MySqlRelayObservations 提供同事务只读运行投影。旧 Relay 构造与静态恢复隔离入口保留，
原 Ledger 继续拥有 Operation/槽位写入。所需 runtime 值契约下沉到 L1，原类型路径保留。
Direct/Snapshot/Relay/多跳编译、原生拓扑、端点解析及 literal-IP 策略迁至 L2，提供
nativeLedgerCompiler/nativeRelayCompiler；旧函数入口及 mysql.json 保留同一定义的导出。
没有增加协议/功能或 L0 API，也没有运行检查/测试/CI/网络或提交推送。Node/Agent 等
剩余条目和集中验收尚未完成，目标保持进行中，门禁关闭。

2026-10-18 持续目标已建立，Ledger 完整协调继续分层，**源码已编写、未验证**：
RuntimeLedgerHost<Tx> 接管分配/容量/可发布性、Operation 接受与 claim、恢复隔离、
退休/租约/排空/完成流程，经显式存储、时钟、ID、编译/解码及授权端口执行；
MySqlRuntimeLedgerStore 保留原事务内 SQL 和锁谓词。旧 Ledger 构造仅绑定原 provider，
Operation/assignment 类型旧路径保留别名。未新增权威、表或协议，也未运行检查/测试/
CI 或提交推送；旧编译器位置、Relay/Node 等后续条目及集中验收仍未完成，门禁关闭。

2026-10-18 地基清单继续推进，**源码已编写、未验证**：L1 RuntimeResources 通过
事务内资源端口协调既有 Node 锁、Direct/Relay 预留、Fence/世代、容量及槽位释放；
L2 MySqlRuntimeResourceStore 只使用传入事务。server 向 Nodes/原 RuntimeLedger 注入
同一资源服务，Nodes 不再为资源访问构造完整 Ledger。Relay 的 Node/Forward/endpoint/
ledger 依赖改独立契约，Operation 错误/失败/成功/清理和槽位释放走原 owner，不再由
Relay 直接写入这些表。原构造入口、Operation/资源类型旧路径、协议与持久格式保留。
Ledger 分配编译/退休租约完成、Relay 部署 SQL/跨 owner 读取、Node 存储/PKI 等仍待拆分。
未运行检查、测试、构建、网络或 CI，未提交/推送；没有扩展测试工具，也没有打开并行门禁。

2026-10-18 [四层地基边界首批提取](../architecture/foundation-layers-v1.md) /
[ADR-0048](../decisions/0048-foundation-layer-boundaries.md)，**源码已实现、未验证**：
用户严格 DoD 已落根 AGENTS 六项任务协议、FR 变更申请/授权记录、版本/错误/日志/
配置约定和兼容目标清单。Core 不扩为整个 Runtime，独立 L0 runtime kernel 仅提取
既有 Snapshot 保留/复用/截止决策。L1 RuntimeHost 移除 SQL、具体 Node/Forward/
Relay/AuthorityStore 类和解析器依赖，改经显式事务内端口；L2 MySQL 状态适配器
保留原 SQL，codec 接原 ADP/3 校验和编译。旧 RuntimeController 构造入口只做装配，
原单一 ledger/claim/授权前置/租约/报告/清理所有权不变。
共用错误/事务/Scope/幂等类型、任务及请求生命周期迁入 L1，生产源码改公开入口，
旧 import 路径再导出同一定义；Agent CPU/RSS/FD 的 OS 读取提取到 platformobservation。
新增独立 L3 公开接口导入预览样例及 flat-format L2 适配，仅演示规范化/授权/日志/
排空，无业务写入或执行。边界声明未接/未跑自动检查，示例未运行；ledger/Relay/
Node 内部、Agent 安全平台、部分业务契约与全仓边界仍有迁移待办。
本轮无检查/测试/格式化/生成器/build/网络/CI/提交/推送，也未扩展验收工具。
[地基 DoD](foundation-readiness.md) 与上层并行门禁仍未通过，不把上轮较窄源码收口
当成稳定地基，不宣称本轮实现可运行或行为等价已获验证。

2026-10-18 [统一分类接入框架 v1](../architecture/framework-integration-v1.md) /
[ADR-0047](../decisions/0047-classified-integration-framework-v1.md)，**本轮源码范围收口、未验证**：
新增 ControlQueries 与独立 Runtime 观察读端口，管理详情 SQL/事务移回应用/基础设施；
HTTP 使用 owner 公共方法的结构视图与具名可选服务装配，旧 createApp 为兼容委托。
契约包增加 shared/runtime/probe/observability/experimental/legacy/staged 子入口，
Control 源码按用途导入，原聚合入口保留。Control 原生 preparation adapter 与快照
来源使用既有 catalog；Agent 原 Direct/Relay/多跳通过独立 executiondriver 宿主版本、
平台/Schema/role/phase/protocol/gate 注册与解析端口，原 Runner/Journal 权威保留。
五类独立周期任务复用有界注册、非重入、延后与停止/等待机制，HTTP 跟踪真实应用
处理完成后才关闭依赖；owner 仍负责取消、预算和 I/O 截止。
[Core v1 公共表面](../spec/core-v1-surface.md) 按源码范围冻结并提供三类接入步骤。
本轮未执行静态/类型/语法检查、测试、生成器、构建或最终 SHA Actions；用例与边界
检查适配/扩展留待集中验证，不宣称当前工作树可运行或已通过验收。保留未完成 echo，
不表示四主线、外部引擎、自动切换、物理/长期运行或生产发布完成。

2026-10-18 D1 后续 [Direct 入口 TLS 测量](../spec/direct-ingress-tls-probes-v1.md) /
[ADR-0045](../decisions/0045-direct-ingress-tls-probes.md)，**本地源码实现、未验证**：
原 Probe owner 经当前 Direct TCP 数字入口连接到精确登记的原 target，执行固定
TLS1.3/SNI/专用叶 pin/scoped URI/ALPN 握手。服务四字段引用锁定当前 metadata CAS/
config revision/digest；每阶段重查当前授权、策略、实例和有效期，不选择 latest。
probeVersion3 只强化原 slot qualification，统一 poll 三类且不回退；原 Gate burn、
256全局预算、两秒截止/watch/单次报告与有限计划上限不变。fullcontext仅 offer/permit，
receipt/result/history为compact selection/contextDigest/白名单 TLS proof，无DER重复。
原 Forward 诊断消费者同步接收实际 v1/v2/v3 摘要与 measurement/point，不再把 v3
egress 结果误按 v1 解析；TLS fullcontext 只作有界内部关联，支持包剥服务身份/摘要/pin。
Schema0036/Control-only Profile36、默认关闭 Control/Agent开关、Console明确类型和
原键重放已源码接线；服务 registry 本身仍不签发，measurementAvailable仅配置。
TLS记录真实成为原Forward payload并可能下游拨号/计数，零TLS应用字节不是零业务字节。
缺报/取消/授权或期限丢失保持unknown，不捏造失败；当前health仍unknown。此前0035
“尚无测量client”仅对应当时首片范围，已由本片接线，不代表其验收通过。
本轮无检查、测试、校验脚本/格式化/fixtures/生成器、网络/MySQL/浏览器、build、CI或提交/推送；
相邻/外部观察、TCP/UDP nonce echo、Relay/多跳Probe、健康/C3及物理/生产门槛仍开放。

2026-10-18 D1 受控观测服务身份/公有信任首片，**本地源码已实现、未验证**：
[ADR-0044](../decisions/0044-observation-service-authority.md) /
[契约](../spec/observation-services-v1.md) 新增 manager-only endpoint/专用 serverAuth
叶证书 pin 声明，metadata CAS 与不可变 configRevision/digest 分开；32 服务/Scope
含归档 ID、64 配置修订、独立有界审计及恢复 sticky 隔离。GET/发布/归档不访问目标、
不读私钥或 mint Probe，旧修订只读不是可选执行权。独立 observation pool 与 Console
提供手动读/本地摘要准备/确认发布/归档，未知提交仅原键重放，断连清公有证书详情。
新增独立 Linux TLS-only responder 与 scratch UID10001/只读/hostnet/无自动重启部署
源码，需单独 operator 身份、精确 SNI/ALPN、来源 CIDR 和有限 expiry/admission/byte/
time/drain；CIDR 不是 Scope client 认证，registry 归档/恢复不远程杀进程。无应用
I/O、echo/mTLS/UDP/proxy，尚无新 measurement issuer/Agent client；measurementAvailable
false，不声明 D1 TLS/echo/外部观测或健康完成。新增 owner 仅自己的 detail 审计，原
中央十五源查询未扩展。本片没有测试/静态/类型/语法检查、脚本/格式化、生成器/fixtures/
CI 扩展、网络、镜像 build/release、提交或推送；D1/C3/物理/生产与集中验收仍开放。

2026-10-18 D1 typed Direct 入口 TCP 切片，**本地源码已实现、未验证**：
[ADR-0043](../decisions/0043-typed-direct-ingress-probes.md) /
[契约](../spec/direct-ingress-probes-v1.md) 增加独立 tcp-ingress-connect /
agent-local-direct-ingress，只从同 Agent 网络命名空间当前 Direct TCP 实例取得实际
数字监听地址/端口，精确匹配原 Resource，并同时受 Node listener/port 和原目标 CIDR
限制；不接受任意目标、通配重写、DNS/zone/metadata/multicast。TCP 自连接可能触发
业务 accept/下游拨号和业务计数，零 payload 不等于无副作用；不是外部/全路径/应用健康。
独立 probeVersion2 闭合机器族、原 Gate/slot qualification 与统一双类型 poll 已编写，
旧 wire v1 保持原 egress，不向旧 Agent 派入口任务，不因 typed 失败回退。原许可 owner、
两秒/全局256/一次 burn/撤销 watch/报告期限及计划同事务预算不变。Schema0034 保存
实际 measurement/qualification，旧缺键对象保留原 hash；历史不混观测点。新入口明确
不进入 egress-only v1 Probe counters/telemetry/rollup，不宣称 typed metrics-v2。
Control/Agent 默认关闭新 opt-in，依赖原执行/注册/一秒 clock，资格不是新执行授权。
原 REST 增 kind、有限 ProbePlan 同上限；恢复 quarantine 不续资格、不恢复计划。
本片无测试/静态/类型/语法检查、脚本/格式化、夹具/CI 扩展、网络、提交或推送。
远端/相邻观测、TLS/受控 echo/UDP/Relay/多跳、健康聚合仍待开发，D1/C3/物理与发布
门禁继续开放；后续仍先完成功能源码，再集中测试修复，不将此片当验收完成。

2026-10-18 开发节奏调整：用户要求先集中开发，后集中测试和修复。
立即停止逐批运行测试、追踪 Actions、扩展验收工具和追修 CI 失败；
不再将逐批静态检查作为推进门槛，仅保留必要代码阅读与差异核对。
当前源码已推送至 `8f35889e13b09a19d215dc10bc6855a3ca98b366`，未取得完整验收通过；
已提交取消该 SHA 主 CI `39047429043` 和关联 Dev 发布 `39047429209` 的请求，
不再继续轮询。本次不改测试或工作流，不移除正式发布门禁。
既有失败、超时、新回归及兼容性缺口留至冻结源码后的集中 Actions 测试与修复；
开发期间按“已实现、未验证”记账，不将取消/未执行写成成功。
后续按已确认框架先收口隧道业务入口，再继续 D2 基础指标与有界历史，详见
[当前开发节奏](next-milestones.md#当前开发节奏2026-10-18-起)。
下方历史逐批测试/修复描述不覆盖本次新约定。

2026-10-18 首批框架落地，**已实现、未验证，当前仅本地变更**：
[ADR-0026](../decisions/0026-logical-tunnel-management.md) /
[逻辑隧道管理 v1](../spec/logical-tunnel-management-v1.md)。新增 `NativeTunnels` 组合原
PathTemplate、PathBindings 和 Forward 命令，提供统一隧道列表、精确修订/拓扑、
发布/归档、引用影响及显式规则绑定 API。新旧名称共用原持久身份、配额、幂等摘要
和原回执；不在提交后追加读，也不创建第二事务、存储或 Runtime 执行权威。
Console 继续使用原控制器及批量队列，增加隧道概览和精确修订载入绑定动作，保留
待决命令、同键重放和断连隔离。发布只保存配置，每条 Forward 仍独立部署；
没有物理连接共享、自动切换或独立 Tunnel ACL。Core/机器协议/Agent/Schema/Journal
均不变。本批没有运行测试、类型/语法/边界检查、数据库或浏览器，也未添加测试、
追跑 Actions 或推送；后续集中补齐别名等价、授权/CAS、待决状态与移动端验证。

2026-10-18 D2 第一部分，**已实现、未验证，当前仅本地变更**：
[独立 Node 进程遥测](../spec/node-telemetry-v1.md) /
[ADR-0027](../decisions/0027-independent-node-telemetry.md)。Agent 新增默认关闭采样循环
及独立 HTTP 传输，保留旧本地 diagnostics。上报进程 Heap/Go Runtime、可用平台的
CPU/峰值 RSS/FD 和本地执行存量；缺失值使用 null，不把它们称为主机或规则 payload。
Control 新增独立版本化 mTLS 接收、原凭据 owner/当前会话复核、小型非排队 SQL 池、
单 Node 接收预算及有界历史读取。0020 增加运维检查点/原始点并同步升级兼容、恢复
标记和默认关闭 Compose 开关；不变更 Core、ADP 执行消息、Runtime 权威或 Journal。
Console 新增 Node 进程指标入口、只读时间窗和连续性/来源/缺测展示，无自动轮询。
本批没有运行任何测试、静态检查、真实数据库/浏览器/Compose 或 Actions，没有新增
测试夹具/CI、提交或推送。规则 payload 累计计数、主机资源、聚合历史与其容量验证仍待
后续开发；本批不是 D2 或全项目完成，集中验收仍按最终源码单独取证。

2026-10-18 D1 有限计划片，**本地实现、未验证，未提交/推送**：
[持久 ProbePlan](../spec/probe-plans-v1.md) /
[ADR-0042](../decisions/0042-bounded-probe-plans.md) 保存不可变 Direct TCP/IP-literal 配置、
精确 Forward 修订、原始绑定和独立决策记录。Manager 显式预览/确认创建仅存配置，
不发行许可；手动计划逐次 CAS 执行，scheduled 模式显式委托原创建者，每次仍以其
当前 Scope/Node Grant 走原签发 owner。手动执行使用当前操作人的 Node Grant，另要求
创建者仍是 manager，不借用创建者的 Node 权限。普通修订变化拒绝，不自动重基或恢复。
每 Scope 三十二计划（含终态）、每计划最多十六次接受/闭合拒绝决策、一小时寿命；
scheduled 间隔三十至三千六百秒，默认关闭的独立一秒 worker 每轮最多一个候选，
不补扫漏过 tick、不持有网络执行权。决策、原许可/Run 捕获和 head 同事务提交；未知
SQL/commit 失败不保存虚假拒绝，旧 header 条件延期不能重复已提交的决策。
每次许可仍受原两秒/全局预算/实例/绑定/授权限制，新 trusted deadline 只能将其
缩短至计划截止。取消只阻止未来签发，不撤回已接受许可；completed 只表示决策预算
用完，不代表 TCP 执行或成功。结果仍按原 probeId 手动读独立 ProbeRun 历史。
列表/详情/预览/命令使用原幂等、当前授权和 observation pool，无 Runtime 回退；
独立 Console 无自动读取或重试，未知写仅显式原键重放。Schema0033/Control-only
Profile、部署默认关闭开关及恢复 sticky/suspend 已接线，恢复不重放旧计划或回执。
有限终态惰性清理/容量淘汰保留 loss；不淘汰 active 来容纳新计划。读取不补发、
重建或测健康，配置开关不是 worker liveness。未运行测试/静态检查/脚本/网络/数据库/
浏览器/CI，未扩展夹具、提交或推送。并发/不确定提交/撤权/时限/恢复/配额/浏览器
统一留待源码冻结后验收；邻接/入口 TLS/受控 echo/健康聚合、C3 和发布门禁仍开放。

2026-10-18 D1 历史片，**本地实现、未验证，未提交/推送**：
[有界 ProbeRun 历史](../spec/probe-runs-v1.md) /
[ADR-0041](../decisions/0041-bounded-probe-run-history.md) 补原短许可/结果随清理消失后的
逐次运行历史，不以 D2 累计计数代替 Run。原 ProbePermits 在实际 issued、consumed、
revoked、withdrawn 和首次结果接受后，经窄 recorder 同事务保存白名单摘要；原幂等
重放不建新 Run，缺失旧头只记 updatesWithoutHead，不扫描回填旧许可或由 GET 造历史。
原两秒许可、全局二百五十六预算、到期加一秒后的惰性 prune、当前授权/实例/绑定复核和
Agent 零 payload 的 Direct TCP 工作流不变。history 不持有 fingerprint、requestId、
原结果正文、目标地址、配置或凭据，不取得签发/消费/续期/执行权。保留完整原始绑定、
实例、时间、状态与已接受结果标量；consumed/到期/无结果不推导 dial 已发生、成功或失败。
独立两表不跟随原 permit/Forward/Node 删除级联，每 Scope 最多一千零二十四头，逻辑
七天；新 insert 分批清过期，容量满可更早淘汰任意状态历史，分别计 rowsExpired/
rowsEvicted/updatesWithoutHead。淘汰历史不撤销或退还实际许可。恢复只首次 sticky
标记并推进历史修订，不改原 state/closed/withdraw/result/updatedAt，也不制造新执行事实。
当前 Scope manager 可手动读固定 UTC 窗口、精确原 Forward/Node/Probe/状态筛选和 keyset
列表/详情；同事务授权走既有两槽 observation pool，无 Runtime 回退或原预算锁。
独立 Console 与原单次命令/短期回执等待分开，显示 UTC/上海时间、缺口和原来源；
不自动读取/翻页、发 Probe、重试、撤销或导出。原结果 digest 是 owner 捕获而非重算
省略的 wire；摘要 contentDigest 不是签名或当前健康证据，health 始终 unknown。
Schema0032/Control-only Profile、升级/部分 footprint、原恢复流程及文档已接线。
本片没有运行测试、静态/语法/类型检查、脚本、真实网络/数据库/浏览器/CI，没有新增
夹具/工作流、提交或推送。并发/重放/原两秒时限/历史丢失/恢复/权限/浏览器待集中验收。
D1 的邻接/入口 TLS/受控 nonce echo、持久计划及健康聚合仍未由本片实现；C3 前置
验收、D1/全项目和物理/发布门禁仍未通过，不把这条历史读面当作自动切换就绪。

2026-10-18 D3-B2 第二片，**本地实现、未验证，未提交/推送**：
[有界通知投递](../spec/notification-deliveries-v1.md) /
[ADR-0040](../decisions/0040-bounded-notification-delivery.md) 将新站内事件经 supplied-Tx
交接给独立 outbox；不扫描旧历史、不由 GET 生成队列。每个事件/端点稳定投递 ID，
仅保存固定非秘密摘要及政策/端点/凭据修订快照，URL/key/credentialRef 不进入队列。
关闭开关、静默、路由损坏、队满及有限保留均有分别记账；队满不回滚原站内事件，
未知 SQL 故障仍回滚事件/条件/交接同一事务。每 Scope 最多一千零二十四投递头、二百
五十六尝试明细，终态惰性七天清理；不淘汰待发头，缺明细不重置尝试预算。
默认关闭的 `TUNEX_WEBHOOK_DELIVERY=1` 独立一秒非重入 worker 不复用 Runtime：
先复核两位原管理者的当前权限、政策/端点修订、订阅、静默与 Authority 绑定，再持久
claim/fence/rate/attempt，事务外读凭据及 DNS/HTTPS。每端点持久速率、Scope 活跃上限
两项；最多六次尝试、一小时事件寿命、三十秒至五分钟退避。过期 claim 先记 unknown，
不直接重发；迟到结果须精确匹配 claim 修订/fence/期限才可回写。
全部 DNS 检查后、socket 前短事务再次授权；这只是发送前时点复核，不是即时绝对撤回。
当前凭据引用 pin 到实际 DNS/guard/socket drain 后才释放，超时结果不冒充物理完成；
不可取消依赖可持续占用有界容量并延长关闭等待。HTTP 2xx 仅表示对端 HTTP 接受，
未知/重试/死信都可能已产生远端效果，接收方须按稳定 ID 去重，无 exactly-once/顺序保证。
Schema0031/Control-only Profile、原恢复事务取消待发并保留历史与速率、不自动恢复旧队列
已接线；Core/Agent/Journal/high-water 和原部署结果不变。Manager-only 历史 GET 与独立
Console 只手动读固定窗口/精确过滤/keyset、损失和尝试明细，不提供发送/测试/重驱 API。
`deliveryAvailable`/`workerState` 仅反映配置，不证明循环存活、对端健康或实际送达。
本片没有运行测试、静态/语法/类型检查、脚本、真实网络/数据库/浏览器或 CI，没有扩展
夹具/工作流、提交或推送；并发、SSRF/TLS、权限/轮换、崩溃/恢复、保留/成本与 UI 均待
全范围源码冻结后集中验收。D3/全项目未完成，C3 前置验收与物理/发布门禁仍未通过。

2026-10-18 D3-B2 第一片，**本地实现、未验证，未提交/推送**：
[受保护通知端点](../spec/notification-endpoints-v1.md) /
[ADR-0039](../decisions/0039-protected-notification-endpoints.md) 增加独立 manager-only
端点元数据 owner、完整替换/凭据轮换 CAS 和不依赖凭据可读性的安全停用。最多十六个
端点（含停用身份），每个订阅最多十六个明确站内政策；GET 只返回非秘密配置与有界
管理审计，不读凭据、不解析 DNS、不发送请求。原幂等回执也不含目的 URL、密钥或引用。
完整 URL 与 HMAC key 一起进入独立 Linux 文件 vault，使用单独预置密钥 AEAD 保护并
绑定 Scope/端点/credentialRevision/当前数据库与恢复身份；不复用 Authority key。
文件先持久化再发布 SQL 引用，回滚遗留有额度的 orphan；在原端点锁下的显式发布最多
清理十六个超过二十四小时的非当前单链接材料，同修订失败尝试也可清理。文件完整性、
目录权限/所有权、exclusive writer lock 和缺失/损坏都 fail-closed，不能自动初始化或
清除陈旧锁。可选 `TUNEX_NOTIFICATION_SECRETS` 与 Control state/PKI 分离；未配置仍可
查看/停用元数据，不能发布新凭据。Schema0030/Control-only Profile 与原恢复挂起接线。
独立 HTTPS adapter 已编写：每次解析全部 DNS 并拒绝非保守公网范围、固定选定地址、
保留原 Host/SNI/证书校验、限定 TLS/端口/字节/时间与并发；无代理、重定向或自动重试。
但它尚未接入服务或站内事件，没有 outbox、发送定时器或发送/测试 API；所有读取明确
`deliveryAvailable:false`。独立 Console 仅手动管理，敏感输入确认后立即清空，未知写仅
闭包内原请求同键重放，不进入全局 pendingKeys、日志、支持包或本地存储。
本片没有运行测试、静态检查、脚本、真实网络/数据库/浏览器或 CI，未扩展夹具/工作流。
DNS/TLS/权限/崩溃/恢复/SQL/浏览器/成本与容量均待集中验收；端点源码不等于通知完成。
下一片接有界事件交接、独立 outbox、当前授权/静默复核、限速/重试/死信和实际发送循环。
D3/全项目仍未完成，C3 前置验收和物理/发布门禁保持未通过。

2026-10-18 D3-B 第一片，**本地实现、未验证，未提交/推送**：
[站内事件/基础告警](../spec/station-alerts-v1.md) /
[ADR-0038](../decisions/0038-bounded-station-alerts.md) 增加独立告警 owner，只接受单个明确
Forward/Node 的固定三类规则：当前部署 Operation 失败、报告数据失鲜、机器凭据临期。
政策由当前 manager 以原幂等/CAS 发布；配置修订、管理者接管或恢复后显式重新发布才
重建条件基线，同配置/同管理者/未挂起发布是 no-op。静默最多七天，不清条件；确认仅
表示已阅，不修复、恢复或取消原 Operation。Viewer 仅读已持久站内事件。
默认关闭的 `TUNEX_STATION_ALERTS=1` 独立五秒非重入 observer 每次只处理一个到期
政策，在既有 observation pool 中重新检查 managedBy 当前管理权限，并将条件、去重
episode、事件和下次时间同事务提交。失败全局退避，坏政策按窄 revision/due 头先建
身份并条件延期，避免损坏正文在完整读取前抛错而持续饿死其他政策；不覆盖新配置。
初次 firing 是当前采样检测，不回填故障开始时间。新明确成功 Operation 才可记部署
状态恢复，旧失败不被改写；报告先需同进程/会话新鲜基线，换实例为 invalidated 而非
recovered；缺测、过期、隔离、未扫描和未知均不自动健康。凭据恢复需明确有效延期。
每 Scope 最多六十四政策（含关闭 ID）、一千零二十四事件、二百五十六管理审计；滚动
淘汰/增量到期有损失计数，不代表物理容量、完整迁移日志、零漏报或投递保证。
0029 四张自身表、Control-only 兼容 Profile、原恢复事务隔离和独立 Console 已接线。
恢复保留政策/静默/审计/历史，清派生条件、挂起政策并标历史，须重新授权发布且推进
configRevision，不能重放旧事件或清 Journal/high-water。Console 仅手动读写，未知提交
仅原键/body 重放，无导航自动查询、网络 Probe、导出、转发写入或外部通知。
本片没有运行测试、静态/语法/类型检查，未扩展夹具/CI、提交或推送。受控 webhook、
独立投递队列与限速/重试仍待后续，D3/全项目及集中验收、物理/发布门禁仍开放。

2026-10-18 D3-A 第二片，**本地实现、未验证，未提交/推送**：
[只读审计查询](../spec/audit-events-v1.md) /
[ADR-0037](../decisions/0037-bounded-audit-query.md) 从十五类原 owner 记录投影有界时间线，
每页以当前 Scope manager 权限和投影同事务核验。默认二十四小时、最多三十一天，
单页二十五/最多五十项；Actor、Node、Forward、Operation、错误码与来源精确交集，
所有筛选在各来源窗口截取前生效。完整主键元组摘要与时间/来源构成稳定 keyset，
游标绑定原 Scope/固定窗口/筛选/页长，但不是签名授权或一致快照，不计算总数。
历史 Node 只按自身不可变配置关联；批次事件不拼接逐项 Forward/Operation，恢复记录
不把旧创建者当恢复操作者。Operation 使用最新可变状态/更新时间和 requester 标记，
不是完整迁移日志。全局无 Scope 的恢复记录不纳入，不输出原 details/config/plan、
指纹、凭据、请求键或自由异常；只读查询保留授权内原标识，不混入脱敏支持包。
复用既有两槽 observation pool、存储期限和有界 Actor 冷却；无 Runtime 池回退、DDL、
状态写入或新执行权威。独立管理审计导航仅手动查询/翻页，输入或认证变化清旧结果，
展示 UTC/上海时间和来源覆盖限制；没有自动读取、导出、Probe 或通知。
本片未运行测试、静态/语法/类型检查，未扩展夹具/CI、提交或推送。输出有界不证明
现有 SQL 索引成本、历史完整性或生产容量；站内事件及受控通知仍待开发，D3/项目
和集中验收/物理/发布门禁仍未完成。

2026-10-18 D3-A 第一片，**本地实现、未验证，未提交/推送**：
[被动规则诊断](../spec/forward-diagnostics-v1.md) /
[ADR-0036](../decisions/0036-passive-forward-diagnostics.md) 增加一个 Forward 的意图、部署、
节点、物理监听、邻接段、最终目标和 Probe 七层只读视图，附原 Operation 脱敏失败码、
独立的有界预留/退役/历史租约窗口和各段缺测/截断说明。旧 revision、未启用、删除、
恢复隔离、过期或会话变化不推断为健康；邻接段配置和局部 ready 不证明链路可达。
观测事务使用既有两槽非排队 observation pool 和 1.5 秒存储期限；Scope 与投影同事务，
Bearer 查询另在其前的短事务，不声称身份与全局状态原子。多语句 report 变化分别保留
本源时间/sequence，无法与先前节点元数据精确匹配时不显示新鲜匹配。完整 Snapshot
摘要不在投影重算，不返回完整 wire/config、策略、指纹、凭据或任意异常 JSON。
同次读取生成最多 64 KiB 的闭合白名单支持 JSON，原实体标识改成本次 ordinal 别名，
再去掉地址/端口、目标、Profile/配置摘要和自由文本；总响应最多 128 KiB。独立 Console
手动读取、五秒取消与断连隔离，支持包需明确确认，仅显示验证过的脱敏内容，不导出详情。
没有启动网络探测/通知或新执行器，也没有 Schema/ADP/Agent/Journal 变化。本片未运行
测试或静态检查，未扩展夹具/CI、提交或推送。审计查询、站内事件和独立受控 webhook
仍待后续开发；D3/C3 前置验收、容量/恢复/浏览器/物理/发布证据仍开放。

2026-10-18 C2-C 第二片，**本地实现、未验证，未提交/推送**：
[已有入口显式迁移](../spec/ingress-migrations-v1.md) /
[ADR-0035](../decisions/0035-explicit-ingress-migrations.md) 补充源/目标精确修订的成员并集
差异、最多八个历史来源和八个显式增改删总动作。历史创建/前次迁移直接回执与当前
原 Forward 完整状态分开复核，包含 nullable 来源及序号；人工变化或已删除/已恢复
隔离来源拒绝，不静默覆盖。预览摘要固定完整计划，确认只建元数据，不自动执行。
add/update/remove 经原 supplied-Tx owner 与尝试/审计/原键回执逐项提交；更新保留所有
业务意图仅换 path/Profile，入口或意图替换使用明确新建和删除，接受删除不代表清理完成。
add 补偿条件删除，update 补偿重验完整接受态并重新授权旧路径；remove 不可补偿，
不得清墓碑、复活旧 ID 或重放 Snapshot。取消只停止未来项，未知提交只原键/body 重放。
0028 三表、Control-only Profile、恢复隔离与独立 Console 已接线；来源无递归/当前组
指针，全定义差异不等于全球成员发现、自动批量执行或跨主机原子收敛。普通编辑后的
来源 rebase 不提供，仍须另行明确设计，不放宽当前完整状态守卫。
未运行测试或静态检查，未扩展夹具/CI、提交或推送。下一步 D3，C3 前置验收与最终
源码的并发/丢回执/补偿/恢复/浏览器/容量/物理/发布验证仍开放，不能记项目完成。

2026-10-18 C2-C 第一片，**本地实现、未验证，未提交/推送**：
[入口组定义与独立创建](../spec/ingress-groups-v1.md) /
[ADR-0034](../decisions/0034-bounded-ingress-groups.md) 保存最多八个完整锁版模板的独立入口
定义，不同入口 Node/相同业务协议；64 组/Scope（含归档）、64 修订、无自动展开或跟随。
逐成员明确监听、共享目标/启用意图，经预览摘要确认只创建持久计划。每次手动一步
由原 Forward owner 分配 ID，原创建资源/Operation、精确路径来源、批次尝试和原键回执
同事务提交；没有先普通创建再补绑定/补审计的窗口。每入口仍是独立规则与部署资源。
持久状态区分逐项原接受、脱敏域拒绝和 HTTP 未知；仅同键同请求重放，不自动继续尾部。
取消停止未来创建，条件补偿只在完整接受状态/来源序号仍相同时走原删除意图，保留
所有历史并遵守原 Runtime drain/cleanup；202 不等于物理删除完毕。入口组来源明确是
历史创建归因，不是当前绑定、物理共享、VIP/DNS、全局 HA 或健康结论。
0027 六表、升级/恢复与手动 Console 已接线；每 Scope 64 批次、每批八项、最多十六次
创建/删除补偿决定，恢复只隔离且不续跑。没有测试/检查/新夹具/生成器/CI/提交/推送。
**已有入口部署迁移到新组修订的成员 diff/影响和显式增改删尚未实现**，继续推进此功能，
不以重复创建替代迁移，也不宣布 C2/D2/全项目或最终验收完成。

2026-10-18 C2-B，**本地实现、未验证，未提交/推送**：
[有界持久组发布](../spec/path-publications-v1.md) /
[ADR-0033](../decisions/0033-durable-path-publications.md) 冻结最多十条当前 Forward/CAS/
完整 spec 与路径/组来源序号，先确认预览摘要再建计划；创建不改 Forward，不自动派发。
每次显式一步进入原 Forward supplied-Tx 接受，与 Runtime/来源、批次不可变尝试、
审计和外层原键回执同事务。已识别域拒绝回滚保存点后单独保存决定，未知数据库/
完整性/恢复错误不记成已拒绝；HTTP 202 的批次决定仍可能是逐项拒绝，不代表部署成功。
取消仅停止待执行项；条件补偿比对整个已接受 Forward 状态与精确路径/组指针，
重新授权旧完整意图，以新接受/来源恢复，不回放旧 Snapshot 或降低高水位。
元数据-only 撤回可无 Operation，真正路径回切推进新 revision/Operation。最多 64 批次/
Scope、每项两种各一次；恢复保留计划/尝试/取消审计且禁续执行。Console 无自动查询/续跑。
0026 三表、Control Profile/升级目录和恢复已接线；Core、机器协议、Journal、Agent 与
唯一 Runtime 所有权不改。没有测试/检查/新夹具/生成器/CI/提交/推送，仍需冻结源码集中验收。
入口组独立多 Forward 的原子创建/绑定仍待后续功能切片；不据本批关闭 C2 或项目目标。

2026-10-18 C2-A，**本地实现、未验证，未提交/推送**：
[出口候选组/固定备用路径](../spec/path-groups-v1.md) /
[ADR-0032](../decisions/0032-bounded-path-groups.md) 增加有序完整模板候选与不可变组修订，
同入口/业务协议、出口组不同终端 Node；每组最多八分支，Scope/修订/来源历史各自有界。
模板与组修订均精确锁版，发布或归档不隐式改现有 Forward。拓扑只表达 OR 完整分支与
AND 必经节点，所有健康 unknown，没有自动选择或后台切换。
显式单规则组预览及应用进入原 Forward 接受，原路径与组来源、资源、Operation、
幂等回执同事务；未知提交只同键同请求重放，不新建部署。目标/监听/启停变更可保留来源，
拓扑编辑或明确普通路径应用脱离组且保留历史。元数据、Console 和 0025 升级/恢复已接线。
本批仅必要源码/差异阅读和修改，没有检查、测试、生成器、新夹具、CI、提交或推送。
入口组、持久多规则 saga 的逐项状态/取消/条件补偿仍待开发；浏览器队列不是持久 saga。
本批不关闭 C2/D2/项目或 C3 前置验收，冻结源码后的集中验证与物理门禁继续开放。

2026-10-18 D2-E 聚合与容量策略，**本地实现、未验证，未提交/推送**：
[精确series分钟/小时聚合](../spec/telemetry-rollups-v1.md) /
[ADR-0031](../decisions/0031-bounded-telemetry-rollups.md) 同原raw/head观察事务提交，
两层直接fold新观察、cursor独立于raw淘汰；默认Control-only关闭，不改Agent协议、不补扫旧点。
七天分钟/三十天小时保留count/sum/min/max/有效增量和覆盖质量，区间全部归结束receipt桶，
boundaryIntervals明确可能跨前桶，不均匀插值、不累加原累计、不伪p95/健康/结算。
0024预算/损失/cursor/bucket：Node-family10081分钟/721小时/512前驱；Scope500000/50000桶、
16384前驱/4096头，含过期/恢复行；自身有界淘汰、Scope超限拒绝观察，不抢别Node空间。
共享原两连接，prune每事务一个Scope最多256总行、无raw/Runtime锁；恢复清前驱、保留损失头、
旧桶恢挂sticky。逻辑JSON预算不等于物理容量、raw也无新增Scope磁盘硬上限。
对齐UTC半开桶窗、精确series/Forward/Node查询及keyset分页非跨页一致快照，lossScope标注不冒充单Forward。
未运行测试/检查/生成器/新夹具/浏览器/Compose/CI，未提交推送；容量/争用/恢复/冻结源码集中验收仍待，
**D2不因本地聚合代码存在而完成**。

2026-10-18 D2-D，**本地实现、未验证，未提交/推送**：
[Probe 累计遥测](../spec/probe-telemetry-v1.md) /
[ADR-0030](../decisions/0030-independent-probe-telemetry.md) 增加实际 dial attempt、
有效 succeeded/failed、unknown 及 inFlight；Close 在途转 unknown 一次，已登记调用
Close 后才 dial 仍计 attempt+unknown；全部调用退出才终态冻结，晚完成不重复计。
独立默认关闭的上报/历史/Console、full ProbeBinding+instance/gen+epoch 来源；Runtime
只读最多两个历史 Snapshot、Node/current 可选 instance 与 trusted Forward Scope，不写原
许可/claim/result/Runtime 安全状态。原短期表不能当总 attempt 分母，TCP 失败不是丢包率。
0023 Profile/恢复隔离/Compose 接线，32 点/两个 Snapshot/64 KiB、4 KiB point+2 KiB metadata、
4 KiB ACK、10 秒/2 秒无队列重试或尾部承诺。共享原两观察连接，四族清理顺序每族256，
每 Node4096点含恢复历史、24小时逻辑TTL/24MiB逻辑JSON，非物理容量，读最多512。
退休采样最多8个纯数值源、每源256绑定、600秒TTL；无Gate/Runner/授权引用，pending为
current、冻结后进128value-tail，总扫描可2432点，32输出/128尾部不等于总内存成本。
未测试/检查/生成器/新夹具/浏览器/Compose/CI；没有提交推送。D2 仍待聚合/容量及全部
功能冻结后的集中验收，未据本地源码宣布完整性、生产就绪、健康或结算能力。

2026-10-18 D2-C，**本地实现、未验证，未提交/推送**：
[独立 Host 遥测](../spec/host-telemetry-v1.md) /
[ADR-0029](../decisions/0029-independent-host-telemetry.md) 采样 Linux Agent 可见 OS、
根文件系统和网络命名空间，其他平台 unsupported；不是物理主机/cgroup 配额证明。
独立默认关闭开关、epoch/sequence、十秒循环、500 毫秒 OS 预算与最多一个采样 worker、
两秒网络期限，8 KiB sample/4 KiB ACK，不排队/重试/复用迟到样本。CPU 仅在精确连续
ticks 条件成立时可推 ratio；网络只显示原始累计，不推接口复用速率或规则总量。
0022 独立 head/raw 表、Control Profile/恢复隔离/Compose 同步，复用原两连接观察池。
每 Node 8640 点含恢复行，24 小时逻辑 TTL、67.5 MiB 逻辑 JSON，不含物理开销且可提前淘汰。
三族 30 秒清理按顺序各最多 256 点，失败继续后族；读取最多 512、actor 一秒冷却。
Console/协议/手写 Schema 和本地接线均未检查或测试，未运行生成器、浏览器、Compose 或 CI。
Probe attempt/success 累计、分钟/小时聚合、物理容量与最终源码集中验收仍待，**D2 未完成**。

2026-10-18 D2-B2，**本地实现已接线、未验证，未提交/推送**：
[独立 Forward 遥测](../spec/forward-telemetry-v1.md) /
[ADR-0028](../decisions/0028-independent-forward-telemetry.md) 承接 B1 入口计数，增加
默认关闭的独立 epoch/sequence 及十秒 mTLS 导出、完整 Runtime 发布/退役来源映射、
0021 原始历史与单实例只读 Console。32 点/64 KiB 批次、两秒请求；共享既有两连接
非排队遥测池，1.5 秒数据库硬期限，不写 Runtime/Operation/Journal 或续期授权。
每 Node 至多 4096 点（含恢复点），逻辑 TTL 24 小时、至多 24 MiB 逻辑 JSON，
物理数据库开销及容量证据另计；过期每事务清 256 点，容量可提前淘汰，读最多 512 点。
新 Control Profile/目录评估/恢复隔离/Compose 开关同步；恢复保留旧点并标记历史，
仅重置非授权 head。迟报/部分拒绝/ACK 丢失、轮转截断和尾部丢失均不能冒充完整总量。
Console latest 是一个实例而非整规则汇总，delta 依赖精确连续性，不推断健康或结算。
本批未测试、未静态检查、未运行生成器/数据库/浏览器/Compose 或 Actions，未新增测试，
不沿用早期绿色结果。主机资源、Probe 累计、分钟/小时聚合、物理容量和最终源码集中
验收仍待；本批不是 D2 或全项目完成。

2026-10-18 D2-B1，**已实现、未验证，当前仅本地变更**：
[原生 payload 计数生产端基础](../spec/native-payload-counters-v1.md) 新增入口实例
原子累计、独立计数 epoch 和完整绑定身份；Close 后冻结终态，只保留最多 128 项/
十分钟内存尾部，淘汰/到期显式记数，不保留引擎引用，不修改 Journal/Fence。
Direct 正数 Write 计入已写字节，Relay TCP 只计完整成功帧，UDP 完整成功的空包
计次数不计字节；这些差异与尾部丢失不用于结算。显式 diagnostics 启用时每十秒
写受保护 companion `forward-counters.json`，最多 256 项确定性轮转，停止后仅
best-effort 最终本地写入。当前/排空/终态不是健康，关闭也不证明指标已送达。
没有 payload 远程 Schema/导出/API/MySQL/Console，现有 process telemetry-v1
保持不变；这不是完整 D2 或远程流量功能。下一步继续独立版本化远程 Forward
payload 的映射/授权/去重、历史与 Console，主机资源、Probe 计数、聚合/容量仍待。
本批未运行测试、语法/类型/契约/边界检查、浏览器或 CI，未新增测试/夹具/CI，
未提交或推送；集中验收、物理主机与发布门禁均未据此通过。

2026-10-17 最新推送核验：十个本地提交已按授权快进到远端 `main` 的
`bd3e8f40c78a317a3557459884e01a0119edd6be`，无新合并提交，未合并无关 PR #100。
容器运行 `39045142479` 成功；主 CI `39045142480` 已出现失败，Dev 发布
`39045142497` 尚受主 CI 门禁约束，不能声明发布/验收成功。当前针对日志修复
MySQL 聚合序号文本导致的首条来源额度误判、Probe 在真实 Hello 之前创建 Direct
的竞态，以及只读 JSON 投影/协议 Snapshot 对象原型两处断言；新增整数字符串、
额度和非法类型 adapter 回归向量。权限、64 条历史上限、原协议解析与发布门禁不变；
只做本地静态检查，修复需新 SHA 的完整 Actions。下方尚未推送/待运行文字保留为历史切片。

2026-10-17：owner-owned 写端口、独立观察、Probe 协商/实例/许可/领取/投递/监视/
结果与默认关闭生产闭环已保存到本地 `47843fd`，尚未推送，详细批次见
[开发目标](next-milestones.md)。当前增量补上 [Probe 管理 Console](../spec/forward-probe-management-v1.md)：
固定 Forward revision 签发、同键重放、不确定结果、历史查询、最多五秒/八次等待及显式撤销。
十组新控制器回归已编写；真实 HTTPS Chromium 桌面/390px 流程已接入同一
真实 Agent/Control/MySQL `probe-workflow` job，包括已提交响应丢失后原键重放。
本机仅静态检查，未运行浏览器、网络或数据库测试；对应 SHA 的 Actions 仍未取得。
后续继续剩余原生能力、规则/隧道/拓扑、遥测、审计/支持包与交付，不能将本批当项目完成。

2026-10-17 后续：Probe Console 已存本地 `724b9bd`，同样尚未推送。当前增量按
[ADR-0019](../decisions/0019-native-catalog-and-profile-impact.md) 接入既有 native 版本化目录、
Profile 期望引用/锁版配置影响与 Console 载入原编辑器流程。共用授权事务、只读投影与
原 Transport resolver；只预览配置，不建立第二执行台账或自动发布。
契约、Go 注册表一致性、端口、UI、SELECT-only MySQL/API 回归已编写并接 Actions，
本机未运行功能或真实 MySQL/浏览器验收。目录中的 OS/能力声明不冒充该平台验收。

2026-10-17 后续：原生目录/Profile 影响已存本地 `32db050`，同样尚未推送。
当前增量按 [ADR-0020](../decisions/0020-explicit-native-rule-commands.md) 补上规则复制、显式失败重试和最多十条当前页启停计划。
所有提交仍逐条使用原 owner-owned CAS/幂等/Runtime，不提供跨规则原子性或自动补偿；
未知提交停止尾部，只有另行确认才重放原键/原请求。复制默认停用/重新选端口，链路保持锁版/原预检。
新增 16 组队列、复制与 HTTP 回归，真实 Chromium/Agent/Control/MySQL 夹具补部分 CAS、
实际 TCP、已提交响应丢失重放和注入失败后的重试；仅静态通过，均待 exact-SHA Actions。
本批不关闭其他隧道/引用编辑浏览器、拓扑、遥测、审计与交付缺口。

2026-10-17 后续：规则管理已存本地 `5d68f1f`，同样尚未推送。当前增量按
[ADR-0021](../decisions/0021-native-tunnel-read-model.md) 补同事务授权的隧道只读元数据、
最多四项 Peer 窗口、Endpoint 和当前规则有序相邻引用；不签发、不读取 PEM/原始 Report、
不测网络、不证明健康或删除安全。Node/Endpoint Console 入口、分页取消、原部署详情与精确 Profile 修订查看已接线。
新增 7 组端口、1 项真实 SELECT-only MySQL/API、7 组 UI 及 4 组修订/失效回归；
真实 Relay Chromium 流程补发布新 Profile 后原规则不变、引用影响载入原编辑器、重新预检/CAS 更新，
以及停用复制/另选端口/显式启删和双协议实际流量。Actions 仅上传脱敏证据和指定截图。
本机仍只做语法/类型/契约/边界/文档静态检查，没有运行功能、数据库、浏览器或网络验收；
新树没有 exact-SHA Actions。显式 Profile 批次发布、真实多跳复制浏览器与后续拓扑/遥测/交付仍未完成。

2026-10-17 后续：隧道管理已存本地 `e8bf7d5`，尚未推送。当前增量按
[ADR-0022](../decisions/0022-explicit-profile-batches.md) 接入 Profile 当前影响页最多十项显式发布，
仅改变冻结的 Profile 锁版，逐项先用原计划检查再用原 owner CAS/幂等命令，无跨规则事务。
预检失败不等于更新已发送；更新不确定仅重放原请求，不再重查并替换命令。当前权限拒绝重放也不清除原提交不确定性。
新增 8 组队列、4 组选择回归，真实 Relay Chromium 接线补双引用 CAS 部分失败、已提交响应丢失后原键重放与真实 TCP/UDP。
全部仍只编写/接线，本地静态检查通过；无新增功能/MySQL/网络/浏览器执行结果，未取得 exact-SHA Actions。
B1/P1 验收、真实多跳复制浏览器以及路径模板/切换、遥测、审计、交付等项目缺口仍未关闭。

2026-10-17 后续：显式 Profile 批次已存本地 `6059da8`，尚未推送。当前增量补
[真实多跳 Console 复制验收](../testing/native-multihop-console.md)：现有 3/4/8 Agent 进程矩阵各接原 Chromium/HTTPS Control/MySQL，
新 Profile 已发布但源/副本仍锁旧版；默认停用复制、另选端口、有序路径/六中继上限、编辑失效后原预检及独立启停删 CAS。
脚本独立检查 TCP/UDP、每节点两项物理资源、停用保留/删除释放、源规则不变及清理；补两组轻 DOM 回归。
隔离网络步骤仍不启浏览器；不支持的显式组合在 PKI/数据库/网络副作用前拒绝。只新增指定截图 allowlist，不上传浏览器凭据或受保护状态。
本机仅静态检查，所有新增真实浏览器/数据库/网络断言均未执行，无 exact-SHA Actions；不关闭 B1/P1、物理主机或项目验收。

2026-10-17 后续：多跳浏览器接线已存本地 `d0f4c96`，尚未推送。本批按
[ADR-0023](../decisions/0023-immutable-native-path-metadata.md) 实现 [C1 路径模板元数据首片](../spec/native-path-templates-v1.md)：
同事务原授权/精确引用、不可变修订/摘要、Scope 配额/CAS/幂等、终态归档和独立 Console 表单。
不写 Forward/Runtime/资源或签发授权；读取显式标注当前引用未复核、无绑定/资源/执行许可。
迁移 0018 与 Control-only 升级 Profile、部分 DDL 拒绝、恢复/历史保留责任已同步；Agent/Core/Journal 不变。
8 组端口、9 组 UI、真实 MySQL 并发 CAS/配额与 SELECT-only、现有 3/4/8 Agent 真实 Chromium 模板流程已编写并接线。
本地仅静态检查，无本批匹配 SHA 的功能/数据库/浏览器/网络 Actions；C1 的绑定、引用影响和手动切换仍未实现，
不关闭 C1、B1/P1、遥测/运维交付或整个项目目标。未经新的用户推送同意不触发远端 CI/自动 Dev 镜像。

2026-10-17 后续：路径模板元数据已存本地 `3d88abe`，尚未推送。按
[ADR-0024](../decisions/0024-original-owner-path-bindings.md) 增加精确路径绑定、来源/历史和显式单规则切换。
绑定与原 Forward CAS/原执行准备、实际展开配置/Operation/容量和原幂等响应同事务；没有第二执行器或 Core 字段。
元数据来源可不重启相同展开配置；普通拓扑编辑解除当前来源指针并保留不可变历史，模板修改/归档不隐式改规则。
Console 提供精确目标/当前 CAS、独立提案与确认、原预检/同事务命令和未知提交原键重放；当前拒绝重放保留原不确定性。
迁移 0019/Control-only 兼容上界、部分 DDL、完整 SQL 来源保留及原恢复隔离已同步。
新增 9 组端口/9 组 UI 与真实 MySQL 并发 CAS/来源配额/整事务回滚/SELECT-only；3/4/8 Agent Chromium
接真实缩短路径、已提交回执丢失后同键重放、TCP/UDP、新 CAS 显式切回和归档不改规则，再原 CAS 停删/清理。
本地仅静态检查，功能/MySQL/浏览器/网络均未执行，无本批 exact-SHA Actions；
多规则路径逐条发布、冻结源码验收/中断测量及后续遥测/运维交付仍待推进，C1 和全项目目标保持开放。

2026-10-17 后续：精确绑定/单规则路径切换已存本地 `917dcb8`，尚未推送。按
[ADR-0025](../decisions/0025-explicit-path-batches.md) 补当前影响页最多十条的
[显式路径批次](../spec/path-publication-v1.md)，复用原队列/提案/Relay 预检与原绑定命令。
目标、源/展开配置、CAS 和独立键均固定；明确拒绝逐项处理，未知预检不写意图，未知写入只同键重放且不自动继续尾部。
9 组队列/4 组选择回归，以及原 3/4/8 Agent Chromium 的双引用/CAS 部分失败、短路径 TCP/UDP、
新修订显式恢复/已提交回执丢失后重放、尾部新确认和无 Operation 来源更新均已编写/接线。
第三条停用夹具规则与竞态 API 单独计数，资源由原删除回收；没有新迁移、Core/Agent/机器协议/Journal 改动。
本机仍只静态检查，没有本批功能/MySQL/浏览器/网络或 exact-SHA Actions 证据，不关闭 C1/B1/P1 或全项目。
冻结源码验收/中断测量仍待执行，后续继续指标/有界历史及既定遥测/运维交付。

2026-10-16 后续核验：`cdb67a8` 的主 CI `38837400564`（7 个 job）、
容器 `38837400557`、Dev 发布 `38837400575` 全部成功，上一切片的只读升级/
恢复评估完成该 SHA 的 Actions 回归，不等于真实升级、备份或生产恢复演练。
当前推进 [Console 服务端查询与全量概览](console-query.md)：有界筛选、
独立授权候选、Scope 全量聚合，以及 Direct/Relay 编辑器的分页解耦。
新测试已接入 Contract 和 Phase1 SELECT-only MySQL，等待本切片提交后的 Actions；
本地只做类型、语法和边界检查，真实浏览器/物理主机验收仍未执行。

后续核验（2026-10-16）：`6e9586d` 主 CI `38831559895` 的 7 个 job、
容器 `38831559907` 和 Dev 发布 `38831559896` 均通过；3/4/8 节点及隔离矩阵
已经完成该 SHA 的 CI 验证。下方历史失败/待核验文字保留为切片记录。
当前新增 [只读升级与恢复评估](../operations/upgrade-assessment.md)：
SELECT-only MySQL、受保护 Authority 校验、Agent Journal 无副作用摘要、
Schema/Journal 回退拒绝矩阵、机器可读结论及备份责任。
纯矩阵、真实 MySQL/Agent 和容器接线已编写，等待本切片对应提交的 Actions；
本地未运行功能测试，不代表完成真实升级或生产恢复验收。

2026-10-16 源码基线：`11b95451464c5adb0068a09cb976492850479b4e`。
已提交默认关闭的多跳统一所有权/授权、混合执行 Snapshot、生产 Runner
适配、Report 驱动协调、Console 路径管理与验收/发布门槛工具。
六批交付的具体范围和未通过出口见 [多跳交付台账](multihop-delivery.md)。
独立 Transit v1 仍是离线组件；生产路径采用 ADR-0005 的 `native.multihop.v1`。

该初始基线的容器运行 `38825824444` 通过；主 CI
`38825824472` 的 contracts/Go race 与 Relay 隔离/容量/轮换通过，但七项
多跳 MySQL 回归和 3/4/8 节点创建失败，相关后续验收跳过。镜像发布
`38825824411` 被同 SHA 门禁阻止，不是已发布本提交镜像的证据。
后续 `b8217fe` 已修复领域输入边界，其 CI `38830077965` 的 contracts/Go race
和 Relay 隔离作业通过，多跳 MySQL 为 5/7；两项冻结 Report 夹具错误和
3/4 节点验收 DELETE 请求未声明长度的问题由 `95315f8` 修复。
3/4 节点已有双协议、续期、重启、重放与撤权恢复的部分运行结果，但完整
多跳与隔离矩阵不计通过。后续完整树待新 SHA 的 Actions，细节见交付台账。
浏览器、物理主机和最终冻结版本验收仍待执行；历史 Direct/Relay 本地证据
不能自动证明此版本回归通过。运行测试继续在 CI / GitHub Actions 执行。

下一阶段按 [开发目标](next-milestones.md) 推进部署/升级保护、诊断与审计、
证据流程和 Console，再冻结版本验收。分角色 Compose、部署预检、
backup/restore 与内部 candidate 镜像机制均已有基础，后续为增量补齐。
分角色预检/用例与固定 Node 的 CI 接线已提交为 `73b019d`；统一最新 CI 判断器
与 candidate/正常发布接线已提交为 `c9629e4`。功能回归全部交由 Actions，
不能把本地静态检查或旧树通过记录混用为这批变更的运行结果。
源码核验还确认全量概览、
独立节点候选、服务端筛选、审计查询/支持包和真实浏览器 CI 仍需增量开发。
1Panel、双物理主机 Relay、长周期稳定与配套恢复三项 P0 继续保留。

## 历史切片记录

| 工作项 | 状态 | 实现及验证范围 |
| --- | --- | --- |
| 旧 V2 隔离、新工作区、纯 Core | verified | `2b679f5`；历史源码归档、纯解析/CAS、13 项 Core 测试 |
| TS/Go ADP/2 direct 契约 | verified（静态部分） | `2b679f5`；共享正反例、摘要向量；不是完整 ADP-16 的运行验收 |
| Direct Planner | verified（离线部分） | `2b679f5`；16 项 Planner 测试、完整快照和资源约束 |
| MySQL/Hono Control | implementing（本地验证通过） | scope/owner/grant、一次性注册、指纹凭据、Forward/预留/Operation/幂等响应同事务；READ COMMITTED/当前锁定读取 |
| Runtime / Operation | implementing（本地验证通过） | 持久 scanner/claim、过期 Worker 防护、当前 session、不可变快照、续期与全节点容量、Report 持久去重及 ACK |
| 在线 Go Agent TCP | implementing（本地验证通过） | mTLS Hello、MAC journal、先持久化后 bind、目标 CIDR/DNS、TCP 半关闭、限额、租约/证书截止与报告重试 |
| CLI / Phase 1 本地实网 | implementing（本地验证通过） | HTTPS 创建/查询 Node、Forward 与 Operation；独立 Agent/target 进程的双向 payload；事务与协议故障注入 |
| Linux CI / 实节点证据 | implementing | CI 已配置 MySQL 8.4.9、Go race 与同一实网脚本；本次未运行远程 Linux CI |
| Phase 2 生命周期、安全与恢复 | implementing | 更新/启停/删除/重试、UDP、持久清理、证书轮换/撤销、Linux 时钟/挂起故障与完整验收 |

命令：`npm run check`、`node scripts/run-go.mjs vet ./...`、
`npm run test:phase1`。本地基线仍为84项 TS测试；新 Go TCP/state/control
测试验证半关闭、目标策略、journal损坏、续期不重启、等代不续期、
写盘失败不应用与取消后不重新绑定。

实网脚本使用项目缓存中的 MySQL 8.4.9（Windows/x86_64），验证创建重放、
并发首次写入、端口冲突、后段故障回滚、claim恢复/锁后终态读取、
身份拒绝、持久 ACK/异正文拒绝、旧会话拒绝、租约过期报告健康隔离及
完整快照容量前置检查。证据位于忽略的 `.artifacts/phase1/run-*/evidence.json`。

本次修复 HTTPS 重定向、bind/截止竞争、目录 fsync 错误、快照容量、
Worker 读视图/执行期限、永久错误码、旧授权借用新租约等边界问题。

Phase 1 的 TCP 创建实现与本地内部出口已完成，Linux 平台出口仍待 CI/实节点
证据，不标完整阶段 verified。单节点更新、删除、UDP 的实现进展见下方 Phase 2 记录；Relay 和发布安全审计尚未完成。
不得把本地创建切片或 CI 配置当作生产就绪声明。


## Phase 2 direct lifecycle update

Baseline: `b7e5f5b`. Current changes implement direct TCP/UDP creation, target/port
updates with CAS/no-op, enable/disable, deletion and explicit failed-Operation retry.
They supersede the earlier table's planned status for these lifecycle functions,
while full Phase 2 remains `implementing`.

TCP sockets transfer listener ownership independently of old execution records;
old streams retain their configuration and bounded drain. UDP associates each client
with a distinct checked target socket, bounds queues/replies and expires idle state.
TCP/UDP process-wide limits are 4096 streams and 4096 associations respectively.
Runtime retains retirements, tombstones and per-session maximum authorization
expiries; current reports cannot release unexpired historical holders.

Validation: `npm run check`, Go vet, `npm run test:phase1` (20 checks) and
`npm run test:phase2` (direct lifecycle and historical-lease/scanner regressions).
Evidence includes actual payloads, socket/slot reclamation, commit and Agent SHA.
Current worktree evidence is not a committed or Linux production acceptance claim.

Outstanding: Node credential rotation/revocation, target-policy withdrawal,
clock/suspend and restart faults, remaining direct acceptance matrix and measured
capacity on Linux. Phase 3 Relay contracts/security, Phase 4 supported transport
evolution and Phase 5 Web/release remain outstanding. Full project goal stays active.

Development details: [Phase 2](phase2.md).

## Node security slice

Baseline: `9a704d8`. The current implementation adds enrolled credential records,
bounded rotation overlap with persistent CSR/request replay, authenticated keypair
reload, Node revocation and policy CAS/withdrawal Operations. Runtime checks the
actual certificate again in the transaction and bounds each fetched snapshot by
its effective expiry. Policy changes advance execution generation/fence while
preserving Forward intent revision; expired/revoked identities cannot obtain new
authority. Owner deletion remains available for cleanup after Node revocation.

The MySQL/HTTPS/TCP security suite covers duplicate rotation, old-credential
expiry, held-stream preservation, policy updates/denial, Agent `--rotate`, revoked
credential rejection, pending historical cutoff and secret-free audit. Evidence
is under `.artifacts/security/run-*/evidence.json`; static and existing direct
network suites are regression gates. Details: [Node security](node-security.md).

Full Phase 2 remains implementing: offline hard-deadline/clock-suspend faults,
Linux real-node/race/capacity measurement, grant-management and backup/recovery
evidence are still required. Relay/transport/Web/release work is also outstanding.

## Linux race evidence

Commit `5203c15` passed `go test -race ./...` with Go 1.26.3 on the existing
`TXBoard-Baseline` WSL2 Linux/amd64 environment (kernel
`6.6.87.2-microsoft-standard-WSL2`). All four tested packages passed: contracts,
control, forward and state. Both command packages compiled with no package tests.
The locked toolchain and module/build caches stay inside the ignored project cache;
no existing system toolchain, Redis or database service was changed.

Redacted local evidence: `.artifacts/linux-race.json`. This closes the Go Linux
race-detector gap described above. It does not close Linux MySQL/HTTPS/independent
Agent acceptance, namespace fault tests, capacity measurement or release rehearsal.

## Authorization fault slice

Baseline: `015b81c`. The direct runtime now uses a suspend-aware wall/uptime Guard
and immutable execution tickets. TCP/UDP check tickets before data-plane IO;
blocked-read completion is rechecked before bytes reach another endpoint. Clock
failure latches closed; renewed snapshots do not renew old drain instances.

The real Control/MySQL/Agent fault harness passed six short-policy scenarios:
Control outage with bounded continuing TCP/UDP, hard cutoff, offline restart,
online higher-generation recovery, drain hard cutoff and corrupt-state rejection.
The existing lifecycle (22 checks) and Node security (8 checks) suites also passed.
Native WSL/Linux Go race tests include the new authorization and forward packages.

Pinned-version Linux container integration was attempted with a project-specific
temporary daemon; registry and trusted cache connections timed out. The daemon
was closed, existing WSL services were not changed. This is an environment evidence
gap, not a passing integration result. Details: [Authorization faults](authorization-faults.md).

Full goal remains active: OS time-sync status, Linux integration/capacity/recovery,
remaining direct matrix, Relay, Web and release gates are still outstanding.

## OS synchronization and native Linux Agent

Baseline: `44ee3b8`. Linux now reads synchronized kernel state/error bounds directly;
Windows parses service state plus root/phase/holdover bounds and rejects stale or
failed synchronization. A real OS collector can provide atomic MAC-protected,
short-lived evidence to an unprivileged Agent; host/platform/age/error bounds are
checked and there is no ?assume synchronized? runtime flag.

Current Windows status fails the new policy and is recorded as a rejection, not
a passing OS clock. Existing positive Windows suites need a genuinely healthy
time source or the real supervisor proof; earlier evidence does not automatically
prove this stricter version. No OS configuration was weakened for testing.

Real native Linux Agent/client/target acceptance now runs against locked-version
Windows Control/MySQL over the private WSL interface, including actual kernel time
proof, mTLS/ACK, both payloads, lifecycle and outage/restart. This is explicitly a
mixed-platform topology, not a wholly Linux stack. Native Linux race tests also pass.
Details and remaining gates: [System time](system-time.md).

## Access management slice

Baseline: `151e9b2`. Owner-only member role and Node-use grant commands now use
CAS, persistent idempotency and shared-transaction access audit. Existing account
credentials cannot be overwritten; the scope owner cannot be demoted or removed.
Forwarding records the actual execution authorizer separately from Operation audit
requesters. Runtime rechecks current active manager membership, explicit Node use
and policy before signing another snapshot.

Real MySQL/HTTPS/native Linux Agent acceptance passed membership/concurrency,
rollback, grant withdrawal/restoration, owner-policy authorizer preservation,
same-Node actor isolation, removed-actor replay refusal, cleanup and CLI cases.
Evidence is `.artifacts/access/run-*/evidence.json`; current local topology is
Windows locked Control/MySQL plus native Linux Agent/client/target. CI's native
Linux/MySQL access gate is configured but is not counted as remotely verified.

Details: [Access management](access-management.md). Remaining work includes full
capacity/recovery/release evidence, Relay/transport contracts and implementation,
the product Web surface and identity/recovery ergonomics. Full project goal stays active.


## Independent authority, old-backup recovery and bounded capacity

Baseline: `61d97f4`. Control now persists each issued authorization upper bound in
an independently protected MAC record before database publication. Explicit fresh
initialization, maintenance and database/CA binding prevent old MySQL restoration
from silently resetting execution authority. Missing or partial authority state
cannot be initialized over existing Nodes.

The operator CLI performs actual single-transaction MySQL backup and checked
fresh-database restore. It waits for historical leases plus clock/error margins,
quarantines old Node credentials, observations, Operations, Forward execution and
idempotency replay, rotates account credentials into a protected file, and requires
the exact recovery review ID before resuming Control. Rebuilding each reviewed
Forward requires a fresh Node identity and explicit new revision; Agent high-water
is retained. SQL/manifest/credential files are synchronized and permission-protected;
backup encryption and Windows ACL remain deployment responsibilities.

The real native Linux Agent recovery suite passed 9 checks. The capacity suite passed
6 bounded checks, measuring 64 TCP/32 UDP, resource reclamation, unchanged execution
across renewal and simultaneous reconnect of four actual Agents. These local samples
are not maximum performance promises. Current topology is Windows locked Control/
MySQL with native WSL/Linux Agent/client/target. Native Linux CI entry points are
configured; no remote run is claimed. Unit/static gates and Linux race also pass.

Details and operator procedure: [Recovery and capacity](recovery-and-capacity.md).
Evidence remains in ignored `.artifacts/recovery/` and `.artifacts/capacity/`, with
commit/dirty state and platform data. Full Phase 2 stays implementing pending matrix,
budget and environment gates; Relay, product Web and release work remain outstanding.


## Phase 3 prerequisite: Relay v1 contract and immutable Transport Profiles

Baseline: `7c4037b`. ADR-0003 fixes the initial two-Node TLS 1.3 data-plane design,
independent peer certificate purpose, exact deployment binding, bounded TCP/UDP
framing and internal physical resource ownership. Those role/fence changes require
ADP/3; current ADP/2 stays direct-only and rejects Relay requests.

Transport now owns immutable Profile revisions with owner-only publication, CAS,
no-op, shared-transaction replay responses and scoped historical queries. The strict
Relay wire/Profile schema has generated Go types and 18 shared TS/Go vectors.
Real MySQL/HTTPS acceptance passes 7 checks including concurrency, rollback,
authorization, old-revision durability, CLI and explicit unsupported execution.
Details: [Relay preparation](relay-preparation.md).

This prerequisite is not Phase 3 completion: use-grant withdrawal, Node endpoints,
ADP/3 assignment/state migration, authenticated encrypted peer execution and real
two-Agent failure/lifecycle evidence are still required. Full project stays active.


Clean-commit evidence for the preceding recovery/capacity slice: `7c4037b` passed
9 recovery checks (`.artifacts/recovery/run-JYtN7H/evidence.json`) and 6 capacity
checks (`.artifacts/capacity/run-Zc93Nk/evidence.json`), both with dirty=false.
Measured 64 TCP/32 UDP, 170 FD, 201 goroutines, about 9.3 MB heap/33.6 MB runtime
and four-Agent reconnect about 1.4 seconds. Two bounded load samples verified
51.2/54.5 MB/s bidirectional payload; p95 about 4.9/12.7 ms. These are mixed-platform
local samples, not a maximum supported or release capacity claim.


## Relay preparation authority and physical resource plan

Baseline: `14ba7db`. Profile use grants now require an explicit active-manager
permission, owner CAS/idempotency and persistent audit. Node internal endpoints
have explicit bind/reachable host/TCP ports, owner CAS, replay and Node audit.
The authenticated preview/compiler checks both Node grants and current credentials,
exact Profile revision/digest, egress endpoint and ADP/3/Relay wire capabilities.
It returns unreserved physical resources, including separate internal TCP sockets
for UDP; it does not accept a deployment. Active Relay grant/endpoint mutation is
refused until durable withdrawal coordination exists. Old-backup recovery clears
all Profile use grants while preserving immutable config history.

The expanded real MySQL/HTTPS suite passes 10 checks; direct regressions, strict
contracts and Go verification remain gates. ADP/3 assignment/state cutover, peer
credentials, prepare/activate and actual encrypted two-Agent flow are next. All
unverified Phase 2 and release requirements remain open.


## ADP/3 Relay resource contracts and authenticated TLS primitives

Baseline: `b65097b`. Single Relay Assignment/Tombstone schema, generated Go types
and 18 shared TS/Go vectors now bind physical sockets, both Node sessions/fences,
locked Profile/config digests and role-specific endpoint/policy. They are preparation
contracts; whole-node ADP/3 messages and Agent state cutover are not yet supported.

Real socket TLS primitives enforce TLS 1.3/ALPN, complete mutual chain/purpose/expiry
verification, exact Node URI and leaf pins, with session tickets disabled. Dedicated
clientAuth+serverAuth leaves are mandatory, so current machine certificates cannot
silently become Relay server identities. Control/frame bounds and exact active
Open binding reject prepared downstream, stale session and expired authority.
Unit socket negatives cover wrong Node/CA/pin/purpose/expiry and TLS 1.2 downgrade.

Current Agent still advertises direct only. Two-Agent encrypted TCP/UDP traffic,
peer credential management, prepare/activate/lifecycle and release safety review
remain required; no whole Phase 3 or project completion is claimed.


## Relay execution engine socket slice

Baseline: `f83995b`. An isolated Go engine now prepares/activates authenticated
Relay TCP/UDP from strict assignments, opens ingress only after a real active-egress
probe, preserves TCP FIN and separates UDP client associations. Direct/Relay share
process TCP/UDP permits; Profile totals, queue/credit/idle and authorization checks
remain bounded. Hard execution/credential cutoff closes held traffic. TCP drain
retires listener acceptance and keeps bounded old streams; UDP drain closes sessions.

Real TLS socket tests exercise encrypted payload, half-close, prepared refusal,
UDP mapping/empty payload/idle, offline-style hard cutoff, old binding, CIDR denial,
budget return, drain and tracked peer expiry. This is an engine test, not two-Agent
Control acceptance. Whole ADP/3 snapshots, state/journal migration, peer certificate
issuance/rotation, coordinator/replacement and real multi-process acceptance remain
open. Current Agent stays direct-only and project goal remains active.


## Complete ADP/3 runtime schema and protected physical journal

Baseline: `a839ca4`. Whole-node direct/Relay Snapshot, Hello and Report/ACK shapes
now use strict protocol 3 parsing in TS/Go with 26 shared vectors. Physical resource
ownership is independent of customer protocol, and mixed direct/Relay snapshots
reject collisions, wrong role/session/digest and old TLS resource resurrection.

Protected RuntimeJournal binds protocol/Node and persistent Snapshot/fences/retired.
Exclusive initialization refuses existing/corrupt files; snapshot acceptance locks
and reloads durable high-water, refuses stale callers, and persists before any socket
mutation. Corrupt/missing/foreign state and write failure remain closed. Parser/state
components do not restore cached authority or automatically reset ADP/2 counters.

Current online Control/Agent still use ADP/2; dedicated peer credential management,
ADP/3 database/runtime cutover, multi-process activation/flow/faults and release gates
remain open. Full project is not completed by this protocol slice.


## Dedicated Relay peer credential issuance

Baseline: `b12c298`. Current enrolled machine mTLS/session may now request a separate
P-256 Relay leaf with exact Node URI and clientAuth/serverAuth purpose. Persistent
request/CSR response replay, current-machine checks and two-leaf bounded overlap
prevent repeated issuance from silently expanding trust. Peer leaves are not machine
API credentials; valid execution cutoff is bounded by DB/Node state independently
of certificate NotAfter. Node retirement and old-backup recovery revoke all peer rows.

Real MySQL/HTTPS suite passes 12 checks including URI/EKU, replay/conflict, purpose
separation, overlap capacity and retirement. Agent peer key loading/renewal and
ADP/3 runtime pin publication are not yet connected; complete two-Agent lifecycle
and release gates remain outstanding.

## ADP/3 Online Direct Cutover

Baseline: `0e07483`. Control now persists and serves complete ADP/3 physical-resource
snapshots; standard Agent enrollment/startup uses protected RuntimeJournal and only
binds after persistent acceptance. Hello/Report/ACK, credential rotation and direct
lifecycle use `/agent/v3/*`. Old endpoint, payload and persisted protocol history
are refused; counters and identities are never reset as an upgrade mechanism.

Static verification passes 161 TS tests plus Go tests/build/contracts/offline plan.
Real Linux Agent passes 7 checks, access 14, recovery 9, bounded capacity 6 and
Transport 13, with topology and dirty status recorded. Existing Go vet/race gates
remain required. Details: [ADP/3 cutover](adp3-cutover.md).

This completes the direct protocol cutover slice, not Relay or full project delivery.
Peer identity loading and two-Agent runtime activation/traffic are next.

## Relay Agent Execution And Prepared Plan

Baseline: `f05d187`. Explicit Relay capability now loads a dedicated Node/session-issued
peer identity, persists a MAC-protected bundle and refuses corrupt/altered expiry.
Agent reconciles strict prepared/active/draining Relay assignments after journal writes,
probes before ingress activation and again for downstream health, preserves execution
during renewal and retires physical fences on removal. Failures retain actionable
retry classification; machine credentials cannot replace Relay peer leaves.

Control's deterministic compiler binds both Node sessions/credentials and all physical
reservations into immutable validated prepared assignments. It neither publishes nor
allocates. The persistent multi-Node acceptance/readiness coordinator is still pending.

Real Linux `--relay` identity/direct regression passes 9 checks. Two Runner tests use
simulated Control plus real TLS sockets for encrypted TCP/UDP/phase/renewal/failure
behavior; they are not independent two-Agent Control acceptance. Details:
[Relay Agent](relay-agent.md). Full Phase 3 and release gates remain open.

## Relay Control And Real Two-Agent Flow

Baseline: `56895c3`. Runtime owns durable two-Node Relay plans/stages and uses the
shared physical resource/fence/lease/retirement ledger. Forward acceptance reserves
all ingress/egress protocol resources with intent/Operation/replay in one transaction.
Current prepared and active/ready reports drive tail-to-head publication; Agent
independently probes before ingress opens. New sessions rebuild internal generations
and both Node/peer credentials bound Snapshot authority.

Profile and downstream Node grants withdraw through persistent Operations; direct
authorization/lifecycle gates remain in force. Updates, disable/enable, new boot and
delete preserve historical holders and wait for safe reclamation. Forward health
aggregates both Node reports. Recovery quarantines Relay deployments as well as trust,
intent, operations and replay. Details: [Relay Control](relay-control.md).

Actual MySQL/HTTPS/two independent native Linux Agent acceptance now verifies encrypted
TCP/UDP, activation safety, identity/no-downgrade, transaction rollback, renewal,
coordinator restart, lifecycle, authority withdrawal/restoration and offline cleanup.
The topology is mixed Windows Control/MySQL plus WSL same-host Linux processes;
namespace/two-host and complete Phase 3/release gates remain unverified.

Local verification on October 13, 2026: 14 Relay acceptance checks, 13 Transport,
14 direct access, 9 same-protocol recovery, 165 TS tests and Go build/vet/Linux race.
Each evidence artifact records the tested commit and whether its tree was dirty.

## Relay Held-Stream Switch And Failure Recovery

Baseline: `e7e6212`. Applied API observations now include the derived Forward revision,
Node and role so clients distinguish a healthy old configuration from an applied new
intent. Real tagged targets and continuous clients verify target/path switches with
established TCP, same-client UDP reset, bounded drain and safe former-egress release.

The expanded three-Agent suite passes 19 checks, adding actual external UDP bind
conflict, full-intent degraded state, scanner cleanup with an explicitly injected
overdue DB deadline, delayed Report duplicate/terminal protection and explicit retry
without changing desired revision. Actual clock and leases remain enforced. Shared
165 TS/Go/build/vet/Linux race gates pass. Details:
[Relay switch and faults](relay-switch-faults.md).

Full goal stays active. Same-host multiprocess evidence does not complete network
partition, production limits, transport evolution, product Web or release gates.

## Relay Network Namespace Isolation And Compensation

Baseline: `8bf7fe4`. Three actual Linux Agents now execute in distinct network
namespaces with run-owned bridge links and scoped internal-port packet drops.
End-to-end HTTPS authentication through an opaque Control proxy remains enforced.
The experiment found and fixed unreachable Relay peers being misclassified as
customer target outages; those peer failures now report retryable
`DOWNSTREAM_UNAVAILABLE` while target/authorization errors retain their meanings.

The 12-check suite verifies prepared/stale-observation activation barriers, actual
activation and active-network partitions, unchanged-generation recovery, genuine
old-generation/session replay refusal, failed replacement-path deadline withdrawal,
explicit new-revision compensation and physical cleanup. Deadline injection is only
an overdue disposable DB Operation; clocks, synchronization and historical lease
waits remain real. Details: [Relay network isolation](relay-network-isolation.md).

Clean prior-slice evidence: `8bf7fe4` passed 19 Relay switch/fault checks with
dirty=false (`.artifacts/relay/run-ddaHsm/evidence.json`). Current isolated-network
evidence records its own tested commit/tree status. A native Linux CI job is configured
but not counted as remotely verified. Local Control/MySQL remain on Windows, with
three WSL Linux namespaces on one physical host. Sustained Relay capacity, production
privileges, transport evolution, Web, deployment and release gates remain open.

## Runtime Intent Lock Boundary

Baseline: `132642e`, whose clean namespace suite passed 12 checks with actual network
cleanup (`.artifacts/relay-isolation/run-B4q1dQ/evidence.json`). The switch regression
then reproduced a 503 after Agent restart: InnoDB diagnostics confirmed opposite
Forward/runtime_nodes lock ownership, rather than a failed Relay identity or payload.

Runtime completion's Operation/Forward JOIN now explicitly locks only Operation rows
with MySQL 8.4 `FOR UPDATE OF o`; intent stays a read under the existing Node lock.
Both Relay suites add a real second-connection Forward lock and require authentic
Agent Report sequences to advance before release. This preserves CAS, persistent ACK,
Operation terminal-state and historical lease semantics. The expanded suites contain
13 namespace checks and 20 switch/fault checks; evidence records the actual tested
commit and dirty status. These regressions do not complete the remaining roadmap.

Local verification passed 20 Relay switch checks
(`.artifacts/relay/run-QfwaTn/evidence.json`), 13 namespace checks
(`.artifacts/relay-isolation/run-wu7g5O/evidence.json`), 7 direct Linux Agent checks
and the 165-test shared check. These artifacts record baseline `132642e` plus
dirty=true; committed validation must use the artifact's own recorded SHA/status.

Clean-commit validation subsequently passed on `a079e96`: 20 Relay switch/fault
checks (`.artifacts/relay/run-yibvsj/evidence.json`) and 13 namespace/lock checks
(`.artifacts/relay-isolation/run-RKrD9a/evidence.json`), both dirty=false. The latter
also verifies actual network teardown.

## Sustained Relay Load And Non-Root Deployment

October 14, 2026 (Asia/Shanghai). Baseline: `a079e96`. Two actual isolated Relay
Agents now run under independent non-root UIDs/GIDs, zero Linux capabilities,
NoNewPrivs and a 256 soft/hard FD limit. Actual process status, secret/state file
ownership, namespace identity and unprivileged kernel time synchronization are
asserted rather than inferred from the launch command.

The eight-check harness verifies sixty seconds of exact payloads on 16 TCP streams
and 8 UDP associations, multiple real renewals without an execution-generation
change, counter/FD reclamation, an immutable cap-12 Profile revision, rejection of
extra TCP/UDP and continued existing traffic. Actual Control outage tests every
client through the real signed-lease safety deadline, with no clock or DB deadline
injection. Agents then restart with protected existing journals and higher sessions;
Control restores its protected authority and exact TCP/UDP forwarding. Safe deletion
and executable/run/namespace-checked cleanup are required before successful evidence
is written. Details: [Relay capacity](relay-capacity.md).

Development evidence `.artifacts/relay-capacity/run-UTf8VP/evidence.json` records
`a079e96` plus dirty=true and verified process/network cleanup. Its bounded sample
verified 1.44 GB of bidirectional payload in sixty seconds (about 24.1 MB/s), with
p95 round-trip latency about 4.1 ms and peaks of 50/58 FD on the two Agents. Both
Nodes published four active snapshots and recovery sessions reached epoch 2.
These are local measurements, not a maximum supported capacity claim. Shared
165-test TS/Go/build/contract checks, Go vet and native Linux Go race also passed.

At exact saturation, readiness probes share the peer budget and health may degrade
while admitted traffic stays live; the completed Operation remains terminal. Local
Control/MySQL are still Windows processes with WSL Linux Agents on one physical
host. Sustained recovery beyond peer-credential overlap, complete direct/Relay
matrix closure, automatic peer rotation/pin transitions, transport evolution,
product Web, external deployment and release gates remain open. CI is configured,
not counted as a remotely verified run. The full project goal remains active.


## Relay 自动换钥与过期在线恢复

2026-10-14（Asia/Shanghai）。基线 `868dac4`。Agent 现在在有效 peer 授权到期前
自动换钥，持久 CSR/request ID 支持签发提交后响应丢失的精确重试。新的 MAC bundle
先原子保存，再加载身份；崩溃遗留请求按已保存 request ID 清理。有界 overlap 的
cooldown 防止持续签发第三个有效身份。机器凭据接近到期时调用既有安全轮换流程。

Control 编译时只使用当前 peer pin，历史退役凭据保留但不再缩短新计划。任一端
peer pin 变化创建更高 deployment generation/fence 和新的持久 policy Operation，
保持用户 revision/session，继续按尾到头 active/ready 屏障执行。旧 TCP 有界排空、
UDP association 重置，旧成功 Operation 仍为终态。过期但 MAC 完整的 peer bundle
不能离线恢复授权；新的在线 Hello、签发和完整快照必须保留原 journal/high-water。
损坏状态拒绝，停机期间已过期的可信签发重放也能安全换成新请求。

`npm run test:relay-rotation` 本地 9 项实网检查通过：非 root/零 capabilities、
两端当前 active/ready、丢响应后的同 CSR 重试、两次自动换钥、真实 overlap 后的
两段 36 秒流量、原 CA 签发旧 peer 对当前 binding 的拒绝、停机到真实有效期耗尽
后的新 session 恢复，以及历史部署/物理资源清理。证据
`.artifacts/relay-rotation/run-vavDNm/evidence.json` 记录 `868dac4` + dirty=true，
同时验证 process/network cleanup；恢复 session 从 1 升到 2，快照从 19 升到 32，
两段新流量错误均为零。更早的 8 项换钥切片证据是
`.artifacts/relay-rotation/run-fSHXUE/evidence.json`，不包含新增真实过期恢复。
完整行为、期限配置和限制见 [Relay rotation](relay-rotation.md)。

公共检查当前通过 166 项 TS 测试、全部 Go 测试/构建、Schema/fixture、边界和
离线 TS→Go 校验；Go vet、原生 Linux race 和 13 项 Transport/凭据回归通过。
提交前实网回归还通过 20 项 Relay 切换/故障
（`.artifacts/relay/run-BYoE1y/evidence.json`）、13 项网络隔离/锁边界
（`.artifacts/relay-isolation/run-XkKszE/evidence.json`）和 8 项持续容量/硬截止
（`.artifacts/relay-capacity/run-Pe8mcH/evidence.json`）；证据均记录当前基线和
实际 dirty 状态，隔离/容量证据同时验证独占资源清理。
CI 新增轮换验收和证据收集，远程结果需按实际运行核验。前一容量切片另有
`868dac4` 干净提交的 8 项证据
`.artifacts/relay-capacity/run-3ocRRm/evidence.json`，dirty=false。

本阶段之后完整项目仍未完工：direct/Relay 全矩阵收口、长周期生产凭据演练、
在线 endpoint/入口迁移、Link 复用与受支持传输演进、Forward-first Web/Node 管理/
审计、全 Linux 外部 MySQL/反代部署、SBOM/许可证和完整发布演练仍需完成。
按用户本轮要求，完成本阶段文档、提交和推送后停止开发；后续阶段保持未完成，
待明确恢复后继续。本地实网是单物理机混合拓扑，不能据此声明生产就绪。
