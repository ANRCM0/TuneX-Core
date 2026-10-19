# TuneX VNext · 下一阶段开发目标

更新：2026-10-19（Asia/Shanghai）。初次排期源码基线：
`11b95451464c5adb0068a09cb976492850479b4e`。

## 当前开发节奏（2026-10-18 起）

2026-10-19 subsequent human authorization opens organizing/testing/pushing the
complete A5 candidate. B verification is now active; see
foundation-verification-2026-10-19.md. The source-phase descriptions below retain
their original stage meaning. Matching Actions evidence, foundation acceptance,
upper-module development and release remain distinct gates.

2026-10-19 current handoff: A5 manual source classification and reviewable
candidate records are complete. See ../architecture/foundation-a5-source-closure-v1.md
for Control59/Runtime34/application99, full Control/Agent/assets/support scopes,
actual compatibility consumers/removal conditions and public source versions.
FR-0023-0025 implement the newly found lower timing/credential/native signal
residuals; explicit breaking source and timing-cache impact remain unverified.
Readiness206-220 and all prior current-source cases are planned/unexecuted.
Next is separately authorized saving/freezing plus B check/contract/example/
functional acceptance on the exact revision; no checks/CI/experiments/commits/
pushes ran and no foundation/upper-module/physical/release gate opens. Earlier
source-open snapshots below are historical, not remaining current A5 tasks.

2026-10-19 current A5 continuation: the34 legacy modules/runtime leaves now have
a complete bounded body map, exact construction/default/lifecycle roles and
observed production/Recovery/support consumers. Five type-port forwarding paths
and three Policy type imports now consume the same existing public declarations;
no runtime body, value binding, signature or version changes. See
../architecture/control-runtime-legacy-leaves-v1.md. Readiness203-205 is planned/
unexecuted. Full application/nested-owner/Agent/Web/type/private/default/consumer/
fixture/asset closure and a saved candidate remain open; B verification and upper
module development gates stay closed. Source/docs only, no checks/tests/builds/
CI/experiments/commits/pushes/delegation.

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


2026-10-19 A2 seventh slice: original deployment storage/savepoint and its precise
legacy entry are authored over lower contracts. Shared origin/lineage/migration
rules have a public owner; migration persistence and coordination remain separate
work. Item 60 is planned only. Historical lineage is not a current Forward permit;
conditional deletion, one Runtime ledger and all acceptance gates remain unchanged.

2026-10-19 A2 sixth slice: original Ingress shared rules, lower group persistence
and precise legacy count binding are authored. Public resolvers retain declaration
semantics and original Forward authorization ownership; distinct ingress members
are not PathGroup alternatives or shared physical connections. Item 59 is planned
only; deployment/migration and other source/acceptance gates remain open.

2026-10-19 A2 fifth slice: original publication rules, lower Plan/Outcome storage
ports, SQL/savepoint owner and precise count/event legacy bindings are authored.
Item 58 is planned only. Known refusal versus fatal-error propagation, original
outer transaction and conditional compensation remain; no global atomicity, new
execution authority, A2/foundation acceptance or phase-B verification is claimed.

2026-10-19 A2 fourth slice: original group rules, metadata/provenance SQL and
precise legacy count-override bindings are authored over public lower contracts.
Item 57 is planned only. Explicit candidate selection and original Path history
ownership remain; this does not add automatic selection or accept A2/foundation.

2026-10-19 A2 third slice: original PathBinding rules, lower storage ports, single
SQL store and legacy bindings are authored; complete Forward/Path/Group/Ingress
owner chains and remaining storage debt are recorded. Item 56 is planned only.
No phase-B verification, feature gate, foundation acceptance or release is claimed.

2026-10-19 A2 second slice: original template SQL has parameterized lower ports
and one lower implementation with explicit Control assembly and a precise legacy
zero-argument wrapper. Item 55 is planned only. Other Path/Ingress/Transit owners
and A1 residuals remain open; stages B-E and foundation acceptance are unchanged.

2026-10-19 A2 first slice, source authored and unverified: original PathTemplate
parser, requirements, limits and head/revision checks have one public Path owner.
PathBindings, PathGroups and IngressGroups consume its public rules rather than
private template application helpers. Old exports remain direct aliases; template
coordinators reuse public pagination/digest/ISO/default-clock helpers at original
call points. Item 54 is unexecuted. SQL storage and other Path/Ingress/Transit owners
still need source work. Entering A2 neither accepts A1 nor exempts its remaining
dependencies from the full foundation freeze. No verification, CI or Git writes.

2026-10-19 A1 sixth slice: machine wire/ACK projections now have one L2 formatter
with explicit public aliases, while all authority/freshness/transaction checks stay
in the original adapters. Item 53 is planned only; direct wire/native/default and
A2-A5 work remain, so this does not open B or the upper-module gate.

2026-10-19 A1 fifth slice, resumed after explicit human restoration approval:
source authored, unverified. The missing codec entry directly exports the existing
single native result implementation. Original version dispatch, stored format
checks and v1/v2/v3 result ACK projections live in L2; permit and machine adapters
retain original binding/proof/budget/history, identity, clock/freshness and committed
receipt checks. Wire aliases preserve the same types. Item 52 is unexecuted; no
v4 ACK, broader issuance, verification, delegation, commit or push is included.
A1 and the foundation remain unaccepted; the independent upper-module gate is closed.


2026-10-19 A1 fourth slice: shared Probe and observation rules now live under
explicit public owners, with original state/transaction boundaries and legacy
aliases. The complete entry/rules/port/adapter/state chains are documented in
[owner collaboration](../architecture/probe-owner-collaboration-v1.md). Item 51 is
planned only. A1 remains implementing; B and later stages are not authorized by
this source work, and the independent upper-module gate remains closed.


2026-10-19 A1 第三片更新：permit/withdrawal/result 存储已有下层端口、唯一 SQL
实现与原 L3 值规则，Control/恢复使用显式实现，旧零参/子类/静态入口保留。
此前实例/资格及证据 reader 切片继续保留；item 48–50 均未执行。其余 Probe
owner/private/wire 与后续 A2–A5 仍需源码工作，不把持久化拆分当成 A1 验收，
也不授权检查、提交、CI 或上层并行功能。

2026-10-19 用户确认以 [开发执行方案](forwardx-development-plan.md) 为后续目标：
A 地基源码收口 → B 后续授权集中验收 → C 状态/能力/指标/运维闭环 → D 有证据
的负载与固定拓扑优化 → E 自动策略/新驱动/导入另立项。当前 A1 实例/资格存储、
时钟和 codec 首片已编写，item 48 未验收；Forward Probe 与其余 Probe SQL
混合依赖仍待继续，A1 及地基整体未完成。允许同一地基任务内互斥子代理并行，
共享修改指定单一写方并统一集成；不提前打开上层模块门禁，不授权检查/测试/CI
或提交推送。
### 最新收口标准：四层地基 DoD 与并行门禁

用户已确认按四层职责、依赖边界、地基变更流程和最小公开接口样例继续推进。
[ADR-0048](../decisions/0048-foundation-layer-boundaries.md) /
[四层边界](../architecture/foundation-layers-v1.md) 优先于下方 ADR-0047 的较窄
“源码收口”口径。当前[地基门禁](foundation-readiness.md)仍未通过，不开始上层并行功能开发。

2026-10-19 已完成 [ForwardX 固定修订源码研究](../reference/forwardx-comparison-2026-10-19.md)，
形成 [FXR 优化候选顺序](forwardx-optimization-backlog.md)。先沿既有顺序关闭地基 owner
调用链、再取得冻结源码验收；后续优先复用现有诊断/能力/指标/运维契约改善工作流。
该清单不重开已编写功能，不提前启用自动策略、新驱动或并行模块；候选均未实施。

- 已编写根 AGENTS 六项任务协议、边界声明清单、兼容目标矩阵与 FR 申请/确认流程。
- 首批真实源码拆分：纯发布保留/复用/截止决策进入独立 L0 runtime kernel；
  RuntimeHost 经 L1 事务/状态/Node/Forward/ledger/Relay/authority/codec 端口协调，
  SQL 与 ADP 校验/编译留在 L2；旧构造及导出路径兼容保留，现有权威和协议不变。
- 公共错误/事务/授权/幂等契约及任务/请求生命周期归 L1；Agent 进程 CPU/RSS/FD
  平台取值归独立观察适配器。独立 L3 导入预览样例只依赖公开 L1/L2，未运行。
- 清单首项继续拆分：RuntimeResources 承接既有资源锁、预留、Fence/世代、容量与
  释放协调，MySqlRuntimeResourceStore 承接事务内 SQL；主装配向 Node/ledger 注入同一
  资源服务。Nodes 不再构造完整 Ledger；Relay 改依赖独立 owner 契约，并把 Operation/
  槽位写入交还原 ledger。旧构造和类型路径保留兼容，新增源码仍未验证。
- Ledger 继续提取：完整分配/claim/恢复隔离/退休租约/排空完成协调进入 L1
  RuntimeLedgerHost，SQL 进入事务内 MySqlRuntimeLedgerStore；时钟、ID、编译/解码、
  授权及分配来源显式注入。原 Ledger 类只保留兼容装配，后续仍需拆 Relay/Node 等。
- Relay 协调进入 L1 RuntimeRelayHost；L2 部署写入与只读运行观测分开，原构造/
  静态恢复入口保留。原生 Direct/Snapshot/Relay/多跳编译及端点/目标策略实现已迁入
  L2 compatibility，旧模块路径保留导出，未扩大协议/Core/能力范围，源码仍未验证。
- Node 凭据/运行授权进入 L1 NodeAuthorityHost，业务策略/授权/撤销命令保留独立
  L3 node-owner；L2 承接事务存储、原 pool 机器查询、签发及令牌/哈希/原生校验。
  原 Nodes/策略/凭据 helper 入口保留，不新建信任根；凭据/事务等仍待集中验收。
- Agent Guard/Ticket/同步缓存进入 L1 executiontime，OS 时钟/状态查询进入 L2
  platformclock；Journal 的锁定重读/高水位/Fence/阶段/保存协调进入 L1 executionstate，
  原 state/MAC/native 适配继续持久同一文件。原子写入/平台锁归 L2 platformstate，
  旧调用入口保留。Runner 凭据/TLS/HTTP、资源观察等平台耦合仍待继续，均未验证。
- Agent 主凭据/Relay 凭据文件与校验经 executionidentity 端口进入 L2 agentidentity，
  主 Control TLS/HTTP 经 executionchannel 进入 L2 controlchannel；Runner 保留原 Probe/
  Guard/内存切换与重放顺序。默认构造及旧 helpers 保留，新增显式可信 provider 构造。
  bootstrap/调度、Probe/telemetry 专用 HTTP 与其他平台耦合仍未完成，源码未验证。
- bootstrap/接收者调度经 runtimeplatform 进入 L2 platformruntime；Probe instance/claim/
  delivery 与四类遥测 HTTP/独立 pool 经 Auxiliary 进入 L2 controlchannel。响应限长读取/
  关闭/ACK/one-use 仍归原 owner。主机采样迁入 L2 platformobservation，旧入口保留。
  CLI enrollment、诊断/随机数/runtime helpers 及执行/Probe 内部仍待收口，均未验证。
- 本地观测值/端口进入 L1 runtimeobservation，L2 Native 承接原 runtime/OS 采样；安全
  熵源、测量文件和日志经 runtimeplatform 进入 L2 platformruntime.Local。Runner 保留
  原 read/lock/失败顺序，四类遥测与 Probe ID 使用注入随机源，旧 helper/构造保留；
  新显式本地服务构造要求完整 provider，尚未验证，不代表 Agent 整体已分层通过。
- Identity 公共访问检查进入 L1 IdentityAccessHost；成员/恢复/列表/审计命令与 DTO 保留
  L3 identity-owner，SQL 和独立 pool 查询归 L2。旧构造/helper/type 保留，HTTP identity
  改用独立 Queries，相关 Scope/Node 消费者不再依赖 Identity 具体类，仍待集中验收。
- Transport/Relay endpoint 原命令和 API 进入独立 L3 owner，SQL/native codec 进入 L2，
  L1 仅声明端口；Node 审计/管理与 Forward 引用使用公共契约，旧构造/恢复/helper 保留。
  活跃 endpoint 变更仍拒绝，事务内原子协调不变；源码未验证，不视为整体地基通过。
- Forward 状态协调归 L3、幂等协调归 L1，持久化归 L2；旧构造和 Runtime/Transit/Relay/path
  消费契约保留；过滤、锁、原始 JSON、修订冲突和 replay invalidation 保持源码意图，
  尚未验证，不增加第二账本或重试。
- 管理 HTTP 的 Node/Forward/access/Node 管理/Profile 授权/detail 接入独立接口声明，
  响应 DTO 留 owner/application，旧类型路径保留；实现与路由不改，仍未验证。其余
  console/Relay preview/path/ingress/Probe/可选观测接口尚待继续，不报告 HTTP 整体闭合。
- Console/catalog/Profile 引用/Tunnel HTTP 已改用独立契约，旧类型入口保留，查询
  实现与时钟不改。MySQL read-model 到 application 类型/helper 的旧反向依赖仍是
  显式债务，不能用接口迁移宣称适配层合规；相关验收 item 24 未执行。
- Relay preview、Transit HTTP 和被动 Node 观察已接独立契约，保留原响应/取消/
  非执行与非健康语义，方法/SQL/路由不改。Transit 混合持久化/原生/时钟实现仍属
  债务；item 25 未执行，不能报告 Runtime/HTTP 整体完成或打开并行门禁。
- path/ingress 五组 HTTP API 已独立声明；部署/迁移通过原事务的入口解析端口
  消费 Group owner。Template/Group 类型和原限额单源公开、旧路径保留；方法/SQL/
  CAS/补偿/恢复规则不改，混合格式/应用依赖仍是债务，item 26 未执行。
- Probe 十一组 HTTP 视图改为独立 API；wrapper 使用原 instance/permit 公共端口，
  旧类型/metadata 导出保留。方法/协议/预算/一次消费/ACK 不改，staged echo 不接通；
  item 27 未执行，混合平台/格式/存储及可选观测契约等仍须继续收口。
- 三类 management read-model 已拆原始读取/SQL 与 L3 业务投影，主装配显式提供
  store/格式/验证/观测值。旧 reader/helper 精确保留兼容而非扩大全文件豁免；SQL
  分页消费者改用独立 L2 helper。item 28 未验证，不宣称全部存储/依赖已合规。
- Agent 通用 executionhost 与 typed/native executiondriver、nativeexecution 已分开，
  旧 helper/HostVersion/零值/实际 OS 语义保留，权威仍归原 Runner/Journal/Guard。
  item 29 未验证，Control 私有兼容、Probe/trust/CLI 和 native 内部分类仍待继续。
- 五类 telemetry/aggregate 可选 API 已独立声明，policy/旧导出保留，行为与 SQL 不改；
  item 30 未执行，其余诊断/审计/告警/通知/历史/计划/service 接口及混合依赖仍待收口。
- 随后八组可选观测服务已改为六个独立 L3 API 入口，显式 DTO/旧 receipt 别名与七组
  限额/audit coverage 公开，原方法/SQL/路由/worker 不变；item 31 未执行。HTTP 的
  实现类派生视图已替换，但 native/private helper、owner 内部格式/加密/存储和全仓
  分类仍是未完成债务，不能据此宣布所有模块合规或打开并行门禁。
- Agent 首次 enrollment 已拆 L1 协调和 L2 原生文件/PKI/HTTPS provider，旧 CLI 入口/
  参数与 Journal 所有者保留，原发布/输出/关闭/失败顺序不改；item 32 未执行。
  Control 私有 precheck/Probe/trust、其他 CLI/native composition 及 engine/wire 仍待收口。
- 原生 Probe 配置/digest/地址投影已移入 nativeexecution，pinned TLS 实现移入
  observationtrust，Runner 绑定/Guard/Ticket/实例/锁与 Probe 旧 denial/连接生命周期保留；
  item 33 未执行。Probe executor/Gate/counters/echo 的原生依赖及其他 Control/engine/wire
  仍未收口，不能把此次原生提取当作整个 Probe 或 Agent 已合规。
- Probe executor/Gate/counter 已复用 L1 调度/熵/泛型拨号端口和 L2 原生 provider；
  旧构造及 Runner 覆盖范围不变，显式效果入口不建立新 Gate/共享预算或重放重置。
  item 34 未执行；net/address/wire/value/native default/echo 依赖仍须继续收口。
- 通知端点/outbox 原 SQL 已移入只消费下层契约的新 L2 store，L3 parser 通过分开的
  同步 provider 由现有 root 装配，旧零参/公开方法及 count/get 覆盖点保留；item 35
  未执行。通知值/native/vault/sender、其他存储逆向依赖和全仓分类仍待继续。
- Probe history/plan 两组 SQL 已拆到只消费下层契约的新 store，原同步 parser/immutable
  和实际过期/失败分类规则由 L3 提供，旧零参/静态恢复/get/lock/put 入口保留；item 36
  未执行。Probe 原生值/wire、其余观测 SQL 和全仓分类仍待继续，未扩功能或启用 echo。
- 观察元数据/审计读取已拆原始端口、L2 SQL 与 L3 原投影/词表，保留原校验时点、
  零参/head/count/静态恢复入口；item 37 未执行。诊断/站内告警 SQL 与原生值仍待继续。
- 诊断/站点告警 SQL 已拆为下层读取/参数化存储与事实端口，L3 保留旧类型断言和
  错误码 Set 映射，原完整业务校验仍在应用入口；旧零参方法和 policyCount 覆盖点
  保留，server 显式装配同一 stationStore。item 38 未执行；其他应用/原生值/遥测
  存储、HTTP、Agent 和全仓分类仍未完成，不能据此打开并行门禁。
- 四族遥测 raw store/两个 mapping 已改用下层参数化记录/端口，原类/SQL/方法体保留；
  聚合 SQL 通过 L3 原 parser/fold/限额同步绑定，旧零参入口与原始点/聚合同事务保留。
  item 39 未执行，遥测应用/值/native/其他 owner 与全仓分类仍未完成。
- 观察服务原生值/证书/地址/staged echo 解码已拆到 L2，L3 保留原 scoped trust 与
  声明规则；UUID/digest/字节/时钟经公共 L2，L1 纯请求封装经原 digest 绑定。旧 helper/
  共享函数/构造入口保留，HTTP 移除该私有值导入；item 40 未执行，其他混合依赖仍待继续。
- 可选观测应用已复用 L2 UUID/digest/JSON/base64/UTC/ISO/单调时钟/bytes 与必要 wire
  codec，保留原 constructor/default clock、cursor/framing、事务/replay/rollback、
  sender key 清零、Probe/Runtime authority 和功能开关；item 41 未执行。
- 观测值 helper 已继续收口：通知 URL 单份 L2 parser，Probe plan/run 与 telemetry
  rollup 使用 L2 time/JSON/bytes/base64/clone/echo-frame，L3 规则与算术不变；item 42
  未执行，剩余 HTTP/Agent/全仓分类仍未完成。
- HTTP app 已改用 L2 JSON/UUID/body/observability wire codec，通用分页移入 L1，旧
  consolePage 兼容；routes/auth/body/errors/filters 保留，item 43 未执行。
- Probe observation service resolver 已改用 L2 context parser/digest，保留原 metadata
  authorization、clock/refusal 与 no-network 语义；item 44 未执行，Probe native/private
  wire 仍待继续。
- Probe machine claim/negotiation/instance/delivery/result/types/services 已改用 L2 parser/
  JSON/time/digest，保留 permit owner、freshness、session、commit-before-ack 和 disabled
  execution；item 45 未执行。
- 唯一 Probe permit owner 已改用 L2 parser/result/proof/time/fingerprint，保留预算、锁、
  issue/consume/check/revoke/replay/history 与 authority；item 46 未执行。
- permit state validator 已改用 L2 context/ISO/digest，保留字段 union、binding、TLS/echo
  window 与纯拒绝规则；item 47 未执行。
- 仍须收口其他 owner 内部持久化和跨模块具体类耦合、Agent 安全/平台混合实现、
  部分业务/HTTP 公共契约及全仓分类/边界约束。边界 JSON 是声明，旧检查器尚未适配。
- 类型/契约/行为/样例与最终源码 Actions 均留集中验证；本轮不运行检查/测试/
  构建/生成器，不开发测试或 CI 工具，不提交/推送。源码接线不打开并行开发门禁。

### 最新优先级：先完成 Core 与兼容接入框架收口

用户于 2026-10-18 再次明确：先完成 Core 内核及兼容层，功能扩展后置。
本节优先于下方继续 D1/D2/D3 或四主线功能的旧排期。

- 最小 Core v1 的既定领域实现范围已齐备，[公共表面](../spec/core-v1-surface.md)
  按源码范围冻结为后续开发基线；Runtime、驱动、Probe、指标及业务工作流仍在外层。
  源码冻结不表示当前版本通过验收或正式发布。
- [分类接入框架 v1](../architecture/framework-integration-v1.md) /
  [ADR-0047](../decisions/0047-classified-integration-framework-v1.md) 本轮源码范围已收口：
  管理详情查询应用服务、HTTP 窄服务与具名装配、契约分入口、Control 原生分类 adapter、
  Agent 独立宿主契约及后台任务/请求排空均已接线，尚未验证。
- 后续同类功能按接入步骤增加 owner/adapter 和显式装配，复用唯一 Runtime/Journal。
  新协议、执行语义、持久 reader 或恢复变化仍需单独演进，不承诺所有功能成本极低。
  框架对应类型/行为/权限/事务/原生生命周期/关闭与兼容验收统一留在源码冻结后的
  集中验证阶段，不以旧版本 Actions 或接线存在代替通过证据。
- 保留全部已有扩展源码；当前 TCP/UDP nonce echo 为未完整接通的开发中切片，
  不记作完成，也不继续扩大扩展功能。后续扩展须在基础框架收口后再排期。
- 继续遵守仅必要源码阅读/编辑、不逐批运行测试或静态检查、不擅自提交/推送的
  当前约定；基础框架冻结与对应验证证据分开记录，未执行的验收仍明确待办。

最新 D1 源码增量（2026-10-18）：[受控 Direct 入口 TLS](../spec/direct-ingress-tls-probes-v1.md)
与 [ADR-0045](../decisions/0045-direct-ingress-tls-probes.md) 已接原 Probe owner/Gate/
有限计划及 registry 当前信任端口，均未验证。真实 TLS 记录从当前原 listener 经
既有 TCP Forward 到精确受控 target，不直接拨服务兜底，不借业务 Relay key；原两秒/
256预算/watch/资格时间不延长。旧类型对象/hash保持，v3三类明确服务selection/proof，
registry availability仅配置、不是活性。此前首片“没有issuer/client”的排期现已推进，
下一步不重做本机connect或另一套计划；仍需独立邻接/外部观测与受控nonce echo、
健康来源/实例/新鲜度聚合，之后才讨论满足前置验收的C3端口，不能跳过门禁。
先继续约定开发、源码冻结后集中验收；本轮不运行检查/测试/脚本/fixtures/网络/build/
CI/Git，不把 source wiring 记作集中验收或生产证据。

D1 后续首片（2026-10-18，本地实现、未验证）：
[Observation service 声明](../spec/observation-services-v1.md) /
[ADR-0044](../decisions/0044-observation-service-authority.md) 已补 manager-only 有界
endpoint/public TLS 叶 pin/不可变配置/metadata CAS、归档/恢复隔离、独立 Console，
并新增有限独立 TLS-only operator responder 与未 build/release 的部署源码。
这不是测量：无新 issuer/Agent TLS client/echo，GET/命令不联网，measurementAvailable
false，证书声明不是 ownership/健康。历史修订不得作当前授权；未来执行 owner/watch
须锁定当前 exact head/config/digest、权限/Node Grant/策略/时间窗，归档/恢复当前并不
停止独立 responder。接下来仍须明确选择观测点与真实测量/撤权端口，不跳入健康/C3，
也不重复实现原 ProbeRun/有限计划。无检查/测试/脚本/fixtures/CI/网络/build/Git。

D1 最新增量（2026-10-18）：[typed Direct 入口 TCP](../spec/direct-ingress-probes-v1.md)
与 [ADR-0043](../decisions/0043-typed-direct-ingress-probes.md) 已本地编写、未验证。
它只连接同 Agent 当前 Direct 实际数字监听端点，受原 Resource/实例/Node listener
和目标 CIDR 共同约束；不当作外部可达、应用健康、TLS/echo 或全路径。probeVersion2
qualification 绑定原 Gate 代次并统一 poll 两类，旧 wire 保持原 egress，原两秒/预算/
watch/报告和有限计划事务不变。Schema0034 类型化持久来源；v1 Probe 计数/遥测/聚合
仍 egress-only，新入口不混入。新 Control/Agent ingress 开关默认关闭、须原执行/注册/
严格 clock；恢复资格隔离而不重建或续跑。无检查/测试/脚本/fixtures/CI/网络/Git。
接下来仍需按独立观测点契约完成其他 D1 类型及健康聚合，不重建已落历史/有限计划，
也不提前 C3 自动切换；最终源码冻结后的集中验收、物理/生产门槛仍未通过。

按用户最新要求，改为**先集中开发，后集中测试和修复**。本节优先于下方历史
切片中“逐批运行静态检查”“随开发持续执行 CI”等旧节奏描述：

- 开发阶段不运行测试，不触发、追跑或重跑验收 Actions，不逐项追修测试失败。
  不再将逐批语法、类型、契约或边界检查作为推进前置；仅做必要代码阅读和差异核对。
- 优先完成既定功能链路；新增回归用例、验收夹具与 CI 接线扩展统一记录为待办，
  后期与已知失败、超时及兼容性缺口一起补齐，不让测试工具开发占据当前功能切片。
- 保留已有测试、契约、安全不变量及发布门禁，不通过删断言、放宽校验或跳过门禁
  获得“通过”。开发完成只记“已实现、未验证”，取消或未执行的任务不算成功。
- 源码冻结后进入集中测试与修复阶段，再运行最终 SHA 的完整 Actions 矩阵；
  修复后按最终 SHA 重新取证，不拼接旧版本成功。物理主机缺失的门槛仍保留未通过。
- 当前开发变更默认留在本地，不因逐批推送自动触发测试或 Dev 发布；后续需要同步
  时先明确工作流触发范围，不擅自关闭仓库工作流或绕过正式发布门禁。

最新源码已推送至 `8f35889e13b09a19d215dc10bc6855a3ca98b366`，尚未取得完整验收通过。
本次已对其主 CI `39047429043` 与关联 Dev 发布 `39047429209` 提交取消请求；
停止继续追踪本轮结果。历史运行和修复记录保留，不再作为当前开发的阻塞队列。
按用户随后确认的 [隧道与转发管理框架](../architecture/project-framework-and-boundaries.md)，
先收口现有能力的隧道业务入口，再继续既定 D2 基础指标与有界历史及其余产品/运维功能。

首批实现（2026-10-18，未验证）：按
[ADR-0026](../decisions/0026-logical-tunnel-management.md) 新增 `NativeTunnels` 业务组合，
通过原模板与绑定 owner 提供 `/tunnels` 列表/详情/发布/归档/引用影响和 Forward
`tunnel-preview`/`tunnel-binding`。原 ID、修订、配额、幂等摘要与持久回执共用，
不另开事务或执行台账。Console 将 Relay 入口收口为隧道管理，增加只读有序拓扑、
锁定配置摘要和“载入精确修订”动作；未知绑定命令阻止替换目标。
这是逻辑配置复用，不是独立 Tunnel 实体、常驻连接池或物理共享；Core、Agent、
机器协议、数据库和 Journal 未改。当前仅本地源码开发与必要差异阅读，未运行测试
或静态检查，未扩展测试/CI 工具，未提交或推送；别名等价性与浏览器场景留到冻结后。

D2 首批实现（2026-10-18，未验证）：按
[ADR-0027](../decisions/0027-independent-node-telemetry.md) 接入默认关闭的独立 Node
进程遥测。Agent 十秒采样、独立 mTLS 传输、两秒超时且不排队重试；Control 以
独立小 SQL 池保存 epoch/sequence 去重检查点和原始历史，不修改 ADP Report 或 Runtime
台账。迁移 0020 同步新 Control 兼容 Profile、目录评估与恢复历史隔离。
查询采用最近 24 小时/每次最多 512 点，持久硬上限每 Node 8640 点，过期物理清理
每批最多 256 行并可能滞后；Console 增加只读进程指标对话框，明确来源、时区、
缺测/重置/缺口和历史会话，不推导健康。Compose 两角色开关已接线、默认均关闭。
当前仍仅本地开发，未运行测试/静态检查/浏览器/数据库/Compose 或 CI，也未增加
测试工具、提交或推送。**D2 未完成**：下一步继续入口 TCP/UDP payload/连接累计
计数与实例 epoch/尾部覆盖，随后主机基础资源、分钟/小时聚合和容量预算；不以本批
节点存量之和代替规则流量或结算，不将源码存在作为验收通过。

D2-B1 本地生产端（2026-10-18，已实现、未验证）：
[原生 payload 累计计数](../spec/native-payload-counters-v1.md) 接入 Direct/Relay 入口，
提供独立实例 epoch、完整绑定身份、Close 后冻结及有界内存尾部；diagnostics
显式启用时每十秒写受保护本地 `forward-counters.json`，最多 256 项轮转覆盖，
终态最多 128 项/十分钟，重启丢失。没有远程 payload Schema、导出、接收 API、
MySQL 历史或 Console 消费，也不改封闭的 process telemetry-v1。下一步仍须完成
独立版本化 Forward payload 远程接收、服务端映射/授权/去重、有界历史与 Console，
然后继续主机基础资源、Probe 累计、聚合和容量。没有测试/静态检查/CI 或测试
工具扩展，未提交/推送；D2 和全项目目标继续保持未完成。

D2-B2 远程入口计数（2026-10-18，本地实现已接线、未验证）：
[ADR-0028](../decisions/0028-independent-forward-telemetry.md) 与
[Forward 遥测契约](../spec/forward-telemetry-v1.md) 承接此前 B1 的远程缺口，新增独立
上报、Runtime 已发布/退役身份映射、有界 0021 原始点和单实例历史/Console，默认关闭。
32 点/64 KiB 批次、十秒循环、两秒独立传输、共享两连接遥测池与 1.5 秒数据库期限；
没有队列、重试或最终尾部送达承诺。每 Node 4096 点含恢复历史，24 小时逻辑 TTL，
容量淘汰可能提前；24 MiB 仅逻辑 JSON，不含数据库物理开销。读取最多 512 点，
缺口/重置/终态/截断明确，latest 不等于整规则总量，不用于健康或结算。
没有测试、静态检查、生成器、浏览器/Compose、CI、提交或推送；新增源码和接线不是验收。
后续继续主机资源、Probe 累计、分钟/小时聚合与容量，再按最终 SHA 集中测试修复，
不回到逐批测试循环；**D2 和全项目目标继续开放**。

D2-C Agent 可见 Host 遥测（2026-10-18，本地实现、未验证）：
[Host 契约](../spec/host-telemetry-v1.md) 与 [ADR-0029](../decisions/0029-independent-host-telemetry.md)
增加独立 Linux OS/根文件系统/网络命名空间来源、缺失/unsupported 和 CPU tick 连续性，
不推 cgroup/物理主机额度或网卡速率。十秒采样、500 毫秒 OS 预算、单采样 worker、
两秒独立传输、8 KiB/4 KiB sample/ACK；默认关闭，三个遥测族共享原两连接观察池。
0022 head/raw、恢复隔离和部署开关已接线，8640 点含恢复数据、24 小时逻辑 TTL、
67.5 MiB 仅逻辑 JSON，容量可提前淘汰；30 秒三族顺序清理各最多 256 点，读最多 512。
本批不测试/检查/运行生成器或 CI，未提交/推送。下一步继续 Probe 有效尝试/成功累计、
聚合和物理容量；最终源码集中验收与发布门禁保持开放，不据本批关闭 D2。

D2-D Probe 累计（2026-10-18，本地实现、未验证）：
[独立累计契约](../spec/probe-telemetry-v1.md) 和 [ADR-0030](../decisions/0030-independent-probe-telemetry.md)
接入真实 dial 的尝试/有效成功失败/unknown/inFlight，不从 consumed permit 或结果行推分母。
完整历史 Snapshot/绑定来源映射和 optional current instance 注解不授予执行权限，不改原 Probe
claim/result 安全事实。0023 独立读模型/恢复/部署接线，32 点/两 Snapshot/64 KiB批，
共享两连接、四族顺序清理；4096点含恢复、逻辑TTL24小时/24MiB JSON，query最多512。
Close 不是立即终态：最多8个纯数值退休源各256绑定/600秒，等待已登记调用退出后冻结，
不等待指标关闭、不保留Gate/Runner/授权对象，总扫描2432点，输出32点/两Snapshot。
默认关闭、10秒/2秒无重试队列或最终尾部保证。没有检查/测试/生成器/新fixture/CI，
未提交/推送。后续继续聚合/物理容量与其他功能，全部冻结后集中测试修复，D2仍开放。

D2-E 分钟/小时聚合与容量策略（2026-10-18，本地实现、未验证）：
[契约](../spec/telemetry-rollups-v1.md) 和 [ADR-0031](../decisions/0031-bounded-telemetry-rollups.md)
将新接收点以exact-series同原事务折叠到7天分钟/30天小时桶，cursor独立于raw，不异步追扫已淘汰点。
默认Control-only开关关闭，无Agent协议或执行权威改变；跨桶有效区间全归结束receipt桶，不插值或伪p95。
0024 Scope/Node-family行数+8192body配额、可见自身淘汰/Scope拒收、cursor过期、恢复sticky历史，
UTC对齐半开窗/512点/keyset分页和逻辑容量报告已本地接线。逻辑上限非物理磁盘测量，raw无新增Scope硬上限。
未测试/检查/生成器/新fixtures/浏览器/Compose/CI或提交推送；下一批继续 C2 组/备用路径与
D3 诊断/基础告警等未交付功能，不因本批转入逐项测试。代表性容量/争用/故障恢复、
最终 SHA 验收与发布证据留到全部约定功能源码冻结后的集中阶段，不以此关闭 D2。

C2-A 出口候选组与固定优先级备用路径（2026-10-18，本地实现、未验证）：
[组契约](../spec/path-groups-v1.md) 与 [ADR-0032](../decisions/0032-bounded-path-groups.md)
将一至八条完整的精确模板引用保存为有序不可变修订，限制每 Scope 64 组、每组 64
修订，归档项仍计配额；相同入口/业务协议，出口候选组另要求不同终端 Node。
组发布不自动修改已有规则，也不自动选择首个或健康候选；观察表达为完整分支 OR、
每分支必经节点 AND，当前健康保持 unknown，不从指标或 Operation 成功推导健康。
单规则预览/显式候选应用接入原 ForwardCommands，同一事务完成原路径绑定、
组来源历史、CAS、幂等回执、资源与 Operation；展开不变仅更新来源，不虚增执行。
普通拓扑编辑脱离当前组，历史保留；明确应用普通路径也脱离组，即使展开配置相同。
0025 元数据/来源、升级兼容和恢复保留语义已接线，Console 提供元数据与单规则入口。
本批没有测试、静态检查、生成器、夹具或 CI 扩展，未提交/推送。入口组多 Forward
部署、持久跨规则 saga 的逐项结果/取消/条件补偿和其界面仍待后续功能切片；已有浏览器
内存队列不冒充持久 saga。**C2 及整个功能目标仍未完成**，C3 自动切换前置验收仍未满足。
后续先完成上述 C2 缺口，再继续 D3 诊断/告警及其余产品/运维功能；全部源码冻结后
集中补齐测试、边界接线、真实数据库/浏览器、容量/恢复与最终 SHA/发布证据。

C2-B 持久多规则组发布（2026-10-18，本地实现、未验证）：
[持久发布契约](../spec/path-publications-v1.md) 与
[ADR-0033](../decisions/0033-durable-path-publications.md) 为一个精确组候选保存最多十条
Forward 的不可变源状态、路径/组来源序号及目标展开；预览摘要确认后只创建计划，
不立即修改 Forward。每次明确确认只推进一项，原 Forward supplied-Tx 接受、Runtime
Operation、逐项接受/拒绝、审计和外层幂等回执同事务，不再有提交后补记批次的窗口。
每项 apply/compensate 各至多一次；预期域拒绝先回滚保存点内全部原命令修改，再保存
脱敏拒绝决定；数据库、完整性、恢复和提交未知不冒充普通失败。Scope 最多 64 批次，
终态与恢复批次仍计入，不删除历史重置额度。取消与推进串行，只停止剩余未接受项，
不撤销原 Operation。补偿复核完整接受后的 revision/spec/路径及组序号和空指针，
重新验证旧路径授权并恢复完整源意图/新来源；实际回切是新原生接受，元数据撤回不虚增执行。
0026 三表、兼容 Profile、恢复禁续执行、手动 Console 查询/逐项推进/条件补偿已接线。
原浏览器内存队列保持原样，没有后台 Worker、自动续跑、选路或跨规则原子保证。
没有测试、静态检查、生成器、新夹具、CI、提交或推送。并发/保存点/响应丢失/撤权/
恢复/历史配额和 Console 兼容统一留到功能冻结后集中验收。
下一片继续入口组多 Forward 的原 owner 创建与精确路径来源原子接受，再推进 D3；
**C2/全项目仍未完成，C3 前置验收与物理/发布门禁仍未通过**。

C2-C 第一片：入口定义与独立创建（2026-10-18，本地实现、未验证）：
[入口组契约](../spec/ingress-groups-v1.md) /
[ADR-0034](../decisions/0034-bounded-ingress-groups.md) 新增独立的入口定义，不把原出口候选
的 OR 语义改成多入口展开。每组至多八条完整锁版模板、不同入口 Node、相同业务协议；
Scope 最多 64 组（含归档）、每组 64 修订。发布/归档只改元数据，不改变已部署规则。
操作者逐成员填写明确监听地址/端口及共享目标和启用意图，不生成成员与目标的笛卡尔积。
服务器预览、摘要确认后只保存持久创建计划；每次手动创建一个成员，原 owner 才分配
Forward ID，并在同事务完成原创建资源/Operation、精确 PathBinding、批次来源与回执。
每个入口是独立 Forward/Operation，无端口或物理连接共享；不是 VIP、DNS 切流或入口 HA。
原键不确定重放、取消未来创建及条件删除补偿延续持久协调边界；后者必须精确匹配原
接受后的 revision/spec/来源序号，只请求原删除 Operation，不证明资源或连接已清理。
最多 64 创建批次/Scope、每批八项/每项创建及删除补偿各一次，终态/恢复历史不清零额度。
入口来源是不可变创建计划/成员/原接受回执的历史归因，没有新的“当前入口组绑定”指针。
0027 六表、Control-only Profile、原恢复隔离与手动 Console 已接线，Agent/Core/Journal 不变。
本片没有测试、静态检查、生成器、新夹具、CI、提交或推送；行为仍须冻结后集中验证。
**仍待开发：已有入口部署到新组修订的成员差异/影响预览和显式 add/update/remove 迁移**；
不能用再次创建相同成员或旧创建回执冒充当前组成员状态。先完成此缺口，再继续 D3。
C2/D2/项目目标、C3 前置验收和物理/发布门禁继续开放。

C2-C 第二片：已有入口修订迁移（2026-10-18，本地实现、未验证）：
[显式迁移契约](../spec/ingress-migrations-v1.md) /
[ADR-0035](../decisions/0035-explicit-ingress-migrations.md) 将上述已有部署缺口接入源码。
输入为同一入口定义的两个精确修订、最多八个明确历史来源和最多八个总操作；服务器
读取创建或前次迁移的直接接受/恢复回执，另向原 Forward owner 锁定并比对当前完整
revision/spec/nullable 路径与组来源序号，不将旧回执冒充当前成员或允许静默 rebase。
预览保存源/目标定义、完整成员并集差异、所选来源基线与显式 add/update/remove；
差异最多十六行不等于可以自动生成十六个操作。确认后仅建持久计划，不修改规则。
每次手动一步仍通过原 owner：add 新建独立规则；update 只换精确 path/Profile，保留
监听/目标/启用/协议/入口；remove 请求原删除。节点或业务意图替换须明确 remove+add，
两条独立 Operation，顺序可能带来重叠或中断，端口重用仍等原 Runtime 安全清理。
已接受 add 可条件删除，已接受 update 可在完整接受态匹配且旧路径重新授权后恢复；
**remove 不可补偿**，不复活旧 ID、墓碑或 Snapshot。取消只停止未来动作。
每 Scope 64 个迁移批次（终态/恢复仍计入）、八个来源/八个操作/最多十六次决定；
来源只解析直接回执、不递归历史。0028 三表、原键/保存点/逐项原子接受、恢复隔离和
手动 Console 已接线，没有 current ingress pointer、Worker 或跨规则原子切换。
普通人工改动后的来源显式 rebase 尚不提供：精确基线不匹配即拒绝，不强行纳入迁移。
该有界工作流不声称发现全部现存组成员或使全部入口已收敛，更不提供 VIP/DNS/全局 HA。
没有测试、静态检查、生成器、新夹具、CI、提交或推送；集中验证与物理/发布门禁仍开放。
接下来推进 D3 诊断/告警与其他产品/运维功能；C3 必须继续等待 C1/C2/Probe 历史验收，
不能因上述源码存在而启动自动故障转移或宣布 C2/D2/项目完成。

D3-A 第一片：被动 Forward 诊断与脱敏支持包（2026-10-18，本地实现、未验证）：
[诊断契约](../spec/forward-diagnostics-v1.md) /
[ADR-0036](../decisions/0036-passive-forward-diagnostics.md) 从原 owner 表投影七层链路、
最多八条 Operation、八个路径节点、十六项当前发布资源/预留、各三十二项退役/租约和
八项短时 Probe 回执。精确原身份、代次、Fence、phase、报告来源与当前节点的匹配，
与真实网络/目标健康分开；缺测/历史/截断和读取期间变化不伪造健康或已清理。
GET、Bearer 短事务和 Scope 投影复用独立 observation pool，不回退 Runtime 池；
没有 Probe 签发、网络拨号、数据库写入、通知或恢复动作。闭合白名单支持 JSON 同次
生成、别名化且移除网络地址、原 ID、摘要/配置/策略/凭据；不是备份或完整事件审计。
Console 有独立只读面板、手动刷新/取消和确认后的支持包展示；不混用可回滚的部署面板。
保持 Schema0028、原升级/恢复和唯一执行权威。本片未运行测试/静态检查，未扩展夹具/
CI、提交或推送。下一步继续只读审计查询、站内事件及独立有界受控 webhook；D3 和
整个目标仍未完成，功能源码冻结后的集中验收及物理/发布门禁保持未通过。

D3-A 第二片：管理审计查询（2026-10-18，本地实现、未验证）：
[只读审计契约](../spec/audit-events-v1.md) /
[ADR-0037](../decisions/0037-bounded-audit-query.md) 以 manager-only 同事务授权组合十五类
原 owner 来源。固定 UTC 半开窗口最多三十一天，精确交集在每来源 limit 前应用，
最多五十项/keyset 页；游标绑定窗口/Scope/筛选/页长，不等于授权或完整一致快照。
Node 历史关联来自本源不可变修订，批次事件不伪造逐规则关联，恢复操作者不可推断，
Operation 最新可变状态不冒充迁移日志。没有 raw details/config/凭据、全局恢复归属、
审计重写、导出或执行命令。独立 Console 手动读取/翻页，清除旧页和认证隔离；复用
有界 observation pool，不回退 Runtime。无测试、静态检查、新夹具/CI、提交或推送。
下一片推进站内事件与独立受控通知；D3/项目和集中验收、SQL 容量/物理/发布证据仍开放。

D3-B 第一片：站内事件与固定告警政策（2026-10-18，本地实现、未验证）：
[站内告警契约](../spec/station-alerts-v1.md) /
[ADR-0038](../decisions/0038-bounded-station-alerts.md) 新增单个明确目标的部署失败、报告
失鲜与凭据临期三规则，manager 原幂等/CAS 发布及有期限静默，viewer 读取持久事件。
独立默认关闭 observer 每次仅评价一个政策，当前管理权限、条件去重/严格恢复、事件
和下次时间同事务；不读取即不评价，GET 不生成事件。坏政策条件延期/全局退避不进入
Runtime 正确性链。静默保留条件和事件，ack 不恢复；未知、缺测、换实例不伪造健康。
六十四政策/一千零二十四事件/二百五十六管理审计的 Scope 上限、淘汰计数、Schema0029、
Control-only Profile、恢复挂起和独立 Console 已接线。恢复显式重新发布推进配置修订，
不自动恢复观察或重放事件。本片未测试、未静态检查、未扩展夹具/CI、提交或推送。
下一片继续独立受控 webhook/outbox、限速/重试和凭据/SSRF 保护；D3/全项目尚未完成。

D3-B2 第一片：受保护通知端点与发送边界（2026-10-18，本地实现、未验证）：
[端点契约](../spec/notification-endpoints-v1.md) /
[ADR-0039](../decisions/0039-protected-notification-endpoints.md) 新增独立 manager-only
元数据/原键/CAS/有界管理审计，显式 PUT 轮换完整目的 URL 与签名密钥，停用不依赖
vault 可读性。GET 与 Console 不回显秘密或发请求；写入未知只保留模块内原请求同键重放。
Linux vault 使用独立预置密钥、AEAD 身份绑定、单 writer、严格文件/目录权限和有界 orphan
保存/清理，不更改原 Authority/Journal/high-water。Schema0030/Control-only Profile 和
原恢复挂起接线；SQL 仅保存不透明引用及非秘密配置，文件密钥不随 SQL 备份导出。
SSRF 防护的固定公网 HTTPS adapter 已编写但尚未被服务调用，没有外发/测试 API 或
发送定时器；`deliveryAvailable:false` 不得解释为排队或可靠投递已实现。独立通知队列、
事件原子交接/溢出记账、当前身份/静默复核、速率/重试上限和死信仍在下一片。
本片未测试、未静态检查，未扩展夹具/CI、提交或推送；所有功能验收和物理/发布门禁仍开放。

D3-B2 第二片：有界 outbox 与独立投递循环（2026-10-18，本地实现、未验证）：
[投递契约](../spec/notification-deliveries-v1.md) /
[ADR-0040](../decisions/0040-bounded-notification-delivery.md) 已接新站内事件同事务 handoff，
稳定投递 ID、固定脱敏摘要/修订快照和分别抑制/溢出/保留损失；不回扫或补发旧历史。
默认关闭的独立 worker 在持久 claim/rate/fence 后才读凭据和联网，DNS 后再次复核当前
政策/端点/凭据/管理权/静默/恢复身份。当前引用 pin 到真实网络 drain 后释放，不以
超时结果释放仍活动依赖；迟到结果不能越过旧 fence。Scope 一千零二十四头/二百五十六
尝试、两项活跃 claim、六次尝试/一小时寿命和三十秒至五分钟退避均为源码约束，
不是容量证据。HTTP 接受不代表业务完成，无 exactly-once 或顺序保证，接收方必须去重。
Schema0031/Control-only Profile、原恢复隔离、默认关闭 Compose、manager-only 历史
GET 与只读 Console 已接线；恢复取消旧待发，保留终态/速率/损失且不自动补队列。
七天终态保留为新入队时惰性清理，尝试可提前淘汰并显式计数，不能宣称完整投递历史。
没有发送/测试/重驱写 API，配置可用不等于 worker 存活或健康。本片未运行测试、静态
检查、脚本、网络功能请求、数据库/浏览器/CI，也未扩展夹具/工作流、提交或推送。
下一步继续核对约定范围中剩余产品/运维入口；源码冻结后再集中补并发/权限/SSRF/TLS、
崩溃/恢复、容量/保留/关闭及浏览器验收。D3/全项目未完成；C3 仍须 C1/C2/Probe 历史
验收，不能把当前未验证源码当作自动切换的安全前置，物理/发布门禁仍未通过。

D1 历史片：独立有界 ProbeRun（2026-10-18，本地实现、未验证）：
[逐次历史契约](../spec/probe-runs-v1.md) /
[ADR-0041](../decisions/0041-bounded-probe-run-history.md) 补现有 Direct TCP 单次 Probe 的
独立持久历史：原许可 owner 的接受/消费/撤销/withdraw/结果同事务白名单捕获，既有
两秒许可、预算/prune、机器协议和执行权不变，不补扫旧收据或在读取时生成工作。
一千零二十四 Run/Scope、七天逻辑查询和惰性清理/最老任意状态淘汰均有损失计数，
后续生命周期缺头只记 updatesWithoutHead，绝不重建许可/历史起点或退款。原结果及
完整绑定只是历史来源，不追认当前拓扑/授权；未收到结果始终 unknown，不是失败率。
Manager 列表/详情、固定 UTC 窗口/精确筛选/keyset、独立手动 Console 和 Schema0032/
Control-only Profile/恢复 sticky 已接线。恢复保留状态/结果事实，首次只加标记和历史修订。
读取不占原执行预算/Runtime 池，不签发、重试或撤销 Probe，不保存原 wire/地址/凭据。
本片无测试、静态检查、脚本、夹具/CI 扩展、网络/数据库/浏览器、提交或推送，源码
存在不代替原两秒报告预算/并发/删除/淘汰/权限/恢复/浏览器的集中证据。
盘点同时确认：原 backup/restore/maintenance/resume/只读升级评估已有入口，不重建；
D2 聚合/遥测、D3 诊断/审计/事件/投递、C1/C2 手工路径/组/迁移已有未验证源码，
不能将历史早期“待开发”当作仍须从零实现。D1 其他 Probe 类型/计划和健康聚合仍是
明确功能缺口；按单独契约分片，不把累计指标冒充逐次结果或把局部连接冒充完整路径。
C3 仍待 C1/C2/Probe 历史验收及版本化 Runtime 接受端口，不提前自动改 Forward 意图；
P6 新驱动/物理共享/其他通知渠道后置，最终源码冻结后再集中测试与修复。

D1 有限持久计划（2026-10-18，本地实现、未验证）：
[ProbePlan 契约](../spec/probe-plans-v1.md) /
[ADR-0042](../decisions/0042-bounded-probe-plans.md) 补上上一片明确缺少的持久计划，
不是扩充 Probe 协议或自动路由。不可变精确 Forward 修订/Direct TCP 配置和原始绑定，
最多三十二计划/Scope、十六次决策/计划、一小时寿命；显式预览/创建不发行许可。
手动 run/CAS 使用操作人当前 Node 权限且创建者仍有管理权；scheduled 明确委托原
创建者，每次重新走其原授权/实例/绑定检查及两秒许可预算，期限只能缩短至计划末端。
独立默认关闭 worker 一秒最多一候选，不补 tick；未知事务错误不冒充拒绝，conditional
defer 不替代 decision。取消只停未来、恢复 sticky 挂起且无 resume/rearm，旧收据仅
幂等重放。接受/拒绝耗决策槽，不从 completed 推执行/成功；原 Run 历史独立查询。
Manager API/独立手动 Console、Schema0033/Control-only Profile 和升级/恢复/部署接线，
有限终态保留及损失明确。无 Runtime 池回退、控制端网络、测试/静态检查/脚本/CI、
夹具扩展、提交或推送；全部待集中验收。D1 其他观测点/协议与健康聚合仍须独立安全
契约，不能因为有限调度有源码而关闭 C3 的接受/证据前置或自动启用切换。

## 历史推进与证据记录

最新推送状态（2026-10-17）：经明确授权，原十个本地提交已快进同步到远端
`main`，源码为 `bd3e8f40c78a317a3557459884e01a0119edd6be`；无额外合并提交，
未合并独立离线原型 PR #100。该 SHA 容器检查 `39045142479` 已通过；
主 CI `39045142480` 暴露被动观察投影断言、Snapshot 原型比较、Probe 首次
Hello 时序和真实路径绑定额度失败，Dev 发布 `39045142497` 仍受主 CI 门禁约束。
本次修复保留只读有界投影与协议解析，等待真实 Agent 能力发布再接受 Direct，
并严格转换 MySQL 聚合序号的整数字符串后执行原 64 条来源上限；新增 adapter
边界向量，不修改授权、协议、DDL 或发布门禁。修复仅本地静态通过，待新 SHA
完整 Actions，不将失败前的部分通过或其他历史绿灯当作当前验收。

首轮修复已推送 `97ec447`，主 CI `39046137093` 已越过上述失败点，继续暴露
Probe 测试把外层状态字段传入封闭 Core、Path HTTP 用例误写既有 422/409 为
400、重复复制时读取尚未可见的旧表单，以及将双节点 Relay 的 ID 排序误当路径
顺序。继续修复夹具/断言，保持真实角色、集合、新鲜度及 TCP/UDP 验证；只有
3--8 节点才断言逐段反向激活顺序。对应完整 Actions 仍待取得。

后续产品方向已聚焦基础转发、加密隧道、拓扑与切换、监控与探测，
详见 [四主线适配方案](forwarding-platform-plan.md)。
本文继续负责近期基线收口与验收队列；新主线不把已交付功能重新列为从零开发，
也不把现有缺失的生产门槛视为已通过。

架构收口优先切片（2026-10-16）：先按
[ADR-0006](../decisions/0006-classified-extension-contracts.md)
整理既有 native 的接入边界，再继续扩展产品能力。首批 Agent 静态驱动注册、
能力声明与生命周期适配，以及 Console 授权查询/只读投影与 Transport
锁版解析端口已在工作树编写。2026-10-17 又完成首个 owner-owned
Profile Grant 写用例与 Runtime 撤权/恢复效果端口，移除可变授权回调，
共用既有事务、幂等记录和执行台账；新增 7 组端口与 3 项 MySQL 回归。
同日继续适配成员与 Node Grant 写用例，保留原 Control 委托入口，
共用受限 Runtime 宿主端口，新增 11 组端口与 4 项 MySQL 回归。
同日第五批适配整节点策略/吊销，保留 Scope 管理权限、原执行主体、
策略拒绝意图与两类凭据失效的独立规则，新增 10 组端口与 6 项 MySQL 回归。
同日第六批将 Forward 创建/更新/删除/重试收口为应用命令与原生准备端口，
保留重放可见性、无变化授权、删除容量检查和失败重试规则，
新增 14 组端口与 6 项 MySQL 回归。
同日第七批移除 `additionalAssignments` 可变回调，改为必选快照 collector、
不可变静态来源集合和窄 Relay reader，保留容量/发布差异与单一执行权威，
新增 10 组端口与 5 项 MySQL 回归；离线恢复仅显式装配无发布来源的 helper。
同日第八批接入独立被动观察宿主、授权只读来源及节点观察 API，
补充并发/频率/期限/取消和报告来源、新鲜度规则，不开放任意目标网络探测，
不把已存上报当独立健康，新增 14 组端口与 3 项 SELECT-only MySQL/API 回归；
契约见 [Node observation v1](../spec/node-observation-v1.md)。
同日第九批按 [ADR-0007](../decisions/0007-bounded-agent-probe.md) 接入不可执行的 Forward
探测预检与 Agent 内部 connect-only 执行器，绑定当前会话/快照/执行和目标策略，
要求独立 Probe 许可，补并发/冷却/取消/零应用数据规则；新增 7 组 Control 端口、
2 项 SELECT-only MySQL/API 与 11 组 Go 回归。远程协议、签发、防重放、派发及结果接收未实现，
生产尚不能从 Control 触发真实探测，详见 [Probe 基础契约](../spec/forward-probe-v1.md)。
同日第十批按 [ADR-0008](../decisions/0008-probe-contract-negotiation.md) 编写独立只读 mTLS
协商、TS/Go 严格契约与 30 份共享向量、Agent 单次许可/实例门禁及 HTTPS 协商钩子。
响应强制 `executionEnabled:false`，不写协商状态或签发许可；尚未接入 Runner 主循环。
新增 2 组 TS 契约、5 组端口、9 组 Go 及 2 项真实 HTTPS/mTLS SELECT-only MySQL 回归。
同日第十一批按 [ADR-0009](../decisions/0009-probe-instance-ownership.md) 编写内部持久实例归属，
同事务机器校验、首登/替换 CAS、不续期重试、撤销与恢复隔离；新增迁移 0014，
同步只读升级评估及 Control-only 兼容 Profile。没有新增远程登记接口或执行许可，
`executionEnabled:false`，不改已有只读握手。新增 9 组端口、1 组升级矩阵与
4 项真实 MySQL 回归，既有备份/恢复脚本另加隔离断言。
同日第十二批按 [ADR-0010](../decisions/0010-probe-registration-lifecycle.md) 编写独立远程登记协议，
共享 TS/Go 严格解析与 37 份向量，机器 adapter 仍委托原事务实例 owner。
Agent 新增默认关闭的 `--probe-registration`，登记前关闭旧门禁，支持 CAS 轮换、
单调时钟新鲜度、身份/凭据/授权失效及停机关闭；正常退出尽力远程撤销。
原握手保持只读、所有响应仍不可执行，无新迁移或 Journal 变化。
新增 5 组 TS、9 组 Go 和 2 项真实 mTLS/MySQL 回归；真实 Agent 恢复验收启用登记选项。
同日第十三批按 [ADR-0011](../decisions/0011-probe-permit-authority.md) 编写 Control 内部许可权威：
同事务锁定授权、完整绑定与当前实例，最多两秒签发，消费重查原始 Actor 并持久单次关闭，
同库共享 Actor/Node/集群签发预算，不因消费/撤销/轮换提前退款。
新增迁移 0015 与 Control-only 兼容 Profile，恢复隔离 issued 许可并保留预算时间下界；
没有远程签发/消费接口或发包，内部视图仍不可执行。新增 11 组端口、1 组事务复用、
1 组升级矩阵与 6 项真实 MySQL 回归，并扩充真实 Agent 备份/恢复断言。
同日第十四批按 [ADR-0012](../decisions/0012-probe-claim-contract.md) 编写已知 ID 的独立 mTLS 单次领取，
共享 TS/Go 严格契约与 55 份向量；原许可 owner 同事务重查并消费，提交后才构造最小回执。
Agent 新增尚未接入生产循环的校验钩子，请求前烧录 ID、不重试不确定结果、缓存不淘汰，
前后重查当前实例/完整执行绑定，校验 Guard 时钟与保守单调截止；回执不转换为执行授权。
新增 6 组 TS、6 组 Go 与 4 项真实 mTLS/MySQL 回归，接入 Actions；无新迁移、无发包。
同日第十五批按 [ADR-0013](../decisions/0013-probe-delivery-authority.md) 补齐投递前的内部权威端口：
当前实例最多选择一个 issued 许可，消费后可重新核对原始权限、完整绑定和时限；两者都是不可执行观察，
不创建/续期许可或修改消费状态。新增独立持久撤销，关闭已消费许可的后续资格而不覆盖消费事实或退款。
迁移 0016 回填旧 consumed 的撤销标记，新增 Control-only 兼容 Profile；恢复隔离 issued 并撤销 consumed，
保留已消费记录、旧撤销、ID 和预算。新增 9 组端口、5 项真实 MySQL 与 1 组升级矩阵回归，接入 Actions。
本批没有新增机器消息、Agent 轮询、持续监视器或发包入口，不把内部 check 当持续授权租约。
同日第十六批按 [ADR-0014](../decisions/0014-probe-delivery-contract.md) 接入不可执行的 mTLS poll/status：
机器 adapter 只委托原 offer/check，空任务也验证当前实例；返回最小化绑定、原时限与请求关联标识，
提交后超过 250 ms 的观察或过期结果拒绝，不写状态、续期或清除撤销。共享 TS/Go 严格解析与 184 份向量，
新增 2 组 TS 契约、6 组 Control adapter、2 组 Go 和 5 项真实 mTLS/MySQL 回归，接入 Actions；
只读接口验收账号使用 SELECT 加 LOCK TABLES，不赋予 DML，另以独立账号准备/消费许可并核对全表摘要。
未改 Core、原协议、Journal、迁移或 Agent 生产循环；服务端 250 ms 观察年龄不等于网络撤权时限或执行租约。
同日第十七批按 [ADR-0015](../decisions/0015-probe-agent-authority-watch.md) 编写 Agent 内部有界 poll 请求与消费后观察监视器：
200 ms 请求、4 KiB、随机关联、HTTPS/禁止跳转；新鲜度从请求前单调起点扣减服务器观察年龄，
只接受原消费回执的完整绑定/原时间/超时，先成功再可用，过期、拒绝或本地失权永久关闭。
同一回执只尝试启动一次，共享进程 4/Node 1/最多跟踪 128 Node 与发现冷却；监视串行、成功后间隔 50 ms、最多 40 次，
固定截止只能缩短，取消后等 HTTP/监督协程真正结束才释放槽位。25 ms 本地检查/250 ms 失鲜是合作式限制，不冒充实时撤权 SLA。
新增 11 组 Go 回归并显式接入 Actions/race；未接生产调用、自动领取/发包或结果接收，不构造 Grant/Permit。
同日第十八批按 [ADR-0016](../decisions/0016-probe-result-receipts.md) 编写独立结果协议与 mTLS 接收：
原许可 owner 同事务重查已消费/未撤销许可、原 Actor、完整绑定和原时限，单许可只存一份结果，
JCS 摘要仅排除随机关联 ID，相同内容返回原回执、不同内容冲突；结果不消费、续期、退款或更新健康。
新增迁移 0017，结果随原许可清理，最多沿用 256 条保留上限；同步 Control-only 兼容 Profile 和恢复边界。
新增 127 份 TS/Go 向量、2 组 TS/2 组 Go 契约、5 组 adapter、9 组 owner、5 项真实 mTLS/MySQL 及 1 组升级回归，接入 Actions。
结果来源仅标记 agent-reported；本批无 Agent 上报调用、一次性执行接线、生产调度或健康聚合。
同日第十九批按 [ADR-0017](../decisions/0017-probe-host-execution.md) 编写内部单次宿主执行准入与结果序列化：
原回执监视器先校验成功，再经原实例 Gate 单次发包；失败不清除回执/Gate 防重放记录，不构造新的执行实例或目标。
结果句柄保留监视器，导出固定上报前再次检查失权/过期/截止收缩；消费回执增加私有服务端时间及本地单调锚点，
保守映射并向下取毫秒截止、向上取耗时，异常证据拒绝而不钳制成有效结果。没有上报 HTTP 调用、生产入口或新迁移。
新增 9 组 Go 回归，覆盖真实回环零应用数据、并发单次执行、撤权/超时、取消后持槽到退出和结果失效/时间边界，接入 Actions/race。
同日第二十批按 [ADR-0018](../decisions/0018-probe-production-workflow.md) 接入默认关闭的管理签发/查询/撤销和 Agent 串行闭环。
签发幂等记录与原 owner 许可在同一事务，实例只由锁定事实选择；重复键只返回旧接受，不续期或重建。
Control 显式选择一秒最大时钟偏差策略，Agent 分别 opt-in 登记与执行；注册本身仍不发包。
生产流程复用原有界 poll/领取/监视器/Gate/结果句柄和 200 ms HTTPS 上报；领取/上报不确定不重试，退出先等工作与监视器排空。
新增 5 组 owner/管理、2 组 HTTP、6 组 Go 回归，以及独立 `probe-workflow` Actions 的真实 Agent/Control/mTLS/MySQL/零负载 TCP 组合脚本。
保留原两秒许可、一秒发现冷却与失败关闭；任务可能到期而没有结果，不把 202 当送达保证。
本批没有新增 Core、机器 Schema、迁移、Journal、长期历史或健康聚合，契约见 [Probe 管理 v1](../spec/forward-probe-management-v1.md)。
同日第二十一批接入 Console 的一次性 Direct TCP 探测、已知 ID 查询、有界等待及显式撤销。
失败保留原键/原请求供手动重放，不确定提交需确认后才能放弃；成功不自动再签发。
断开、切换 ID 与停止等待取消/丢弃旧响应；历史连接成功仍标记 agent-reported / health unknown。
新增 10 组轻量 DOM/控制器回归，并将桌面/390px 真实 Chromium 接到同一真实 Agent/Control/MySQL Actions，
覆盖已提交响应丢失、同键重放、查询撤销、无凭据落盘与历史结果展示；仅输出脱敏 JSON/指定截图。
本机不下载或运行浏览器，Playwright 为固定版本开发依赖；测试上下文仅忽略一次性夹具 CA，不替代生产 TLS 验收。
生产闭环此前已存本地 `47843fd`，尚未推送；本批及前批均待对应提交的 Actions，未借用历史绿灯。
同日第二十二批按 [ADR-0019](../decisions/0019-native-catalog-and-profile-impact.md) 接入三个已存在 native 的版本化声明，
共享目录/摘要与 Agent 编译期注册表一致性回归，分开业务协议/物理承载、进程开关、Node 证据与执行授权。
新增 Scope 授权目录 API、SELECT-only Profile 期望引用分页及显式锁版配置影响；预览需管理权限与原 Profile Grant，
只产生 proposedSpec / expectedRevision，不做 Node/端口授权、不预留资源或发布操作。
Console 可从 Profile 行查看引用/影响并显式载入原 Relay 编辑器，仍须重新预检及 CAS 提交；修改输入/关闭/断开会丢弃旧预览。
新增 2 组 TS 目录、1 组 Go 对齐、7 组应用端口、6 组 UI 及 1 项 SELECT-only MySQL/API 回归，已接 Actions；
本机仍仅静态检查，不代表功能已验收。无新驱动、Core/机器 Schema、迁移或 Journal 变化。
契约见 [原生能力与 Profile 影响](../spec/native-driver-management-v1.md)。
同日第二十三批按 [ADR-0020](../decisions/0020-explicit-native-rule-commands.md) 接入规则复制、显式失败重试与当前页最多十条启停计划。
复制默认停用并清空入口端口，Relay/多跳保留原 Profile 锁版与有序路径，仍需原预检。
批次固定每条配置/expectedRevision/独立幂等键，串行、单请求五秒；明确拒绝保留逐项结果，
不确定结果停止后续派发，只能另行确认后重放原命令，不自动继续尾部或刷新 revision。
重试重新读取当前失败 Operation/Forward，再经原 owner 命令提交；Operation 详情增加授权 forwardId，重试输入闭合。
新增 12 组队列/UI、2 组复制及 2 组 HTTP 回归；真实 Chromium/Agent 夹具补 Direct 复制、并发 CAS 部分失败、
实际 TCP 字节、已提交响应丢失同键重放、注入终态失败后的显式重试和 390px 布局接线。
本机只做静态检查，尚无本批 exact-SHA Actions；没有新批次持久实体、Core、迁移、机器协议或 Journal 变化。
契约见 [原生规则管理](../spec/native-rule-management-v1.md)；Relay/多跳复制与真实引用规则编辑浏览器证据仍待补齐。
同日第二十四批按 [ADR-0021](../decisions/0021-native-tunnel-read-model.md) 补原生 TLS 隧道只读状态与当前期望引用。
Scope/精确 Node 校验与 SELECT-only 投影共用事务；最多四项 Peer 指纹/时间元数据，窗口受 Node 撤销和机器凭据截止约束，
不读取 PEM/签发响应/原始 Report，不签发、不测网络，健康始终 unknown；引用包括停用/恢复挂起并推导有序相邻角色，
不覆盖历史租约或证明可删除。Console 的 Node/Endpoint 入口、分页/失效取消、原部署入口和 Profile 精确修订查看均接好。
新增 7 组端口、1 项 SELECT-only MySQL/API、7 组隧道 UI 及 4 组精确修订/失效回归，扩展资产/CSP/匿名拒绝测试。
真实 Relay Chromium→HTTPS Control/MySQL→双 native Agent→TCP/UDP 脚本补引用规则 r1→r2 的原预检/CAS 更新，
以及默认停用复制、另选端口、启用/删除和安全清理；只接线未执行，仅上传脱敏 evidence/指定截图，不上传 PKI/受保护状态。
前一批规则管理已存本地 `5d68f1f`；本批仍仅静态检查，均待授权推送后的 exact-SHA Actions。
本批契约见 [原生 TLS 隧道管理](../spec/native-tunnel-management-v1.md)；显式多规则 Profile 批次发布、真实多跳复制浏览器及长期轮换仍待补，未关闭 B1/P1。
同日第二十五批按 [ADR-0022](../decisions/0022-explicit-profile-batches.md) 补显式 Profile 批次发布，复用原 Console 队列而不增加服务端 Bulk/Batch。
最多选择当前影响页十条变化且未恢复挂起的规则，固定目标 Profile revision/digest、每条配置/CAS/独立键；只允许改变 Profile 锁版。
确认后每项先调原只读计划并核对目标，再走原独立 PUT 授权/资源/Runtime 事务；预检不确定与更新不确定分开，
前者未写入、停止尾部并需显式重查原方案，后者仅同键/同请求重放、不重查替换命令，也不自动继续尾部。
修正既有队列边界：重放被当前权限拒绝仍不能证明原请求没提交，继续保留不确定，不解除尾部阻塞。
新增 8 组队列与 4 组选择回归；真实 Relay 浏览器接线补双引用冻结后外部授权写入制造 CAS 部分失败，
以及真实提交后响应丢失/原键重放且不再预检，更新后均走实际 TCP/UDP。夹具竞态与 UI 尝试分开记录，不冒充自发故障。
前一批隧道管理已存本地 `e8bf7d5`；本批仍仅静态检查，功能/浏览器/MySQL/网络均未在本机执行，待授权推送后 exact-SHA Actions。
契约见 [Profile 显式发布](../spec/profile-publication-v1.md)；无 Core、数据库、机器协议、Agent Journal 或 credential owner 改动。
同日第二十六批补 [真实多跳复制浏览器接线](../testing/native-multihop-console.md)，不新增生产契约或 ADR。
现有 3/4/8 独立 Agent 进程 Actions 各增加 Chromium 流程；新 Profile r2 发布后源/副本仍保留 r1，
复制默认停用/空端口，检查全部有序中继，编辑使原预检失效，显式重新预检后才创建、启用、停用和删除。
独立真实 TCP/UDP 客户端检查源/副本；同库核对每 Node 两项 Fence 资源、停用保留和删除后安全释放，源 revision/spec 不变。
新增两组轻 DOM 回归覆盖八节点/六中继路径和关闭多跳门禁不降级；桌面/390px/中继引用/部署截图接受限上传。
隔离矩阵仍浏览器关闭，非法显式组合在副作用前拒绝。无 Core、Control API、机器协议、迁移或 Journal 变化。
前一批已存本地 `6059da8`；本批仅静态检查，浏览器/MySQL/网络均未执行，无本批 exact-SHA Actions，不关闭 B1/P1。
同日第二十七批按 [ADR-0023](../decisions/0023-immutable-native-path-metadata.md) 实现 C1 首片
[路径模板元数据](../spec/native-path-templates-v1.md)：Scope 内 2-8 个有序 Node、精确下游 Endpoint/Profile 修订、
不可变配置/摘要、同事务原 Node/Profile 授权与 Endpoint 检查、CAS/原幂等、128 标识/64 修订配额和终态归档审计。
归档保留历史且不回收标识；查询只验证 Scope 与保存完整性，不冒充当前引用授权/资源/执行。
Console 独立结构化模板面板包含显式有界捕获、精确历史读取、不可变发布/归档、可能已提交后的原键重放和断连失效。
迁移 0018 / Control-only Profile / 部分 DDL 拒绝和完整 SQL 备份责任同步；Agent/Core/机器协议/Journal 不变。
新增 8 组端口、9 组 UI、真实 MySQL 并发 CAS/配额/SELECT-only 回归；3/4/8 Agent Chromium 延伸真实模板表单、
已提交丢响应后原键重放、无变化、第二修订与历史归档，再确认源 Forward/资源和实际 TCP/UDP 不变。
全部只编写/接线，本机仍仅静态检查；前一批存本地 `d0f4c96`，本批无 exact-SHA Actions。
**C1 尚未完成**：模板规则绑定、引用影响、同事务展开并走原 Forward 接受的显式发布/手动切换仍未实现；
不得把模板发布当作规则切换、物理资源共享或第二 Runtime。既有推送权限待用户明确同意，未尝试替代渠道触发 CI/Dev。
同日第二十八批按 [ADR-0024](../decisions/0024-original-owner-path-bindings.md) 实现
[路径绑定与显式单规则切换](../spec/native-path-bindings-v1.md)：固定模板修订/摘要、原 Forward CAS，
同一事务复核原引用/执行准备、展开实际配置、原 Operation/资源/容量、不可变来源和原幂等响应。
入口与业务协议保持不变，目标/监听/启用意图不由模板覆盖；展开不变可无 Operation 保存来源。
每 Forward 最多 64 条保留记录；普通拓扑编辑解除当前来源指针并留历史，普通启停/删除不消耗该配额。
Scope 只读来源/历史、有界当前引用与精确目标影响，Console 独立固定修订/读 CAS/提案/确认/原预检/原命令。
未知结果锁原键与请求，只显式重放；当前拒绝重放仍不证明原请求未提交。模板发布/归档不隐式切换或撤销已有展开规则。
迁移 0019 / Control-only `adp3-path-bindings-v1` / 旧读者拒绝 / 部分 DDL / 来源保留与恢复隔离说明同步。
新增 9 组端口、9 组 UI、真实 MySQL CAS 并发/来源配额/整事务回滚/SELECT-only 与升级评估回归；
既有 3/4/8 Agent Chromium 增加不重启绑定、发布后不自动应用、真实缩短路径、丢提交回执后原键重放、
独立 TCP/UDP、新修订显式切回原路径和归档不改展开规则，随后走原停删/安全清理。
前一批已存本地 `3d88abe`；本批均只编写/接线与静态检查，无 exact-SHA Actions，未触发远端 CI/Dev。
**C1 仍未完成验收**：多规则路径显式逐条发布、冻结源码 Actions 及中断时长测量仍待推进；
不能宣称零停机、跨主机原子、物理共享、自动路由或整个项目完成。
同日第二十九批按 [ADR-0025](../decisions/0025-explicit-path-batches.md) 补
[有界显式多规则路径发布](../spec/path-publication-v1.md)，复用原 Console 队列与原 `/path-binding`，不新增 Bulk/持久批次或第二执行器。
当前影响页最多十条可用变化，固定目标配置/摘要、每条源/展开配置/CAS/独立键；每次首次派发重查原路径提案与 Relay 计划。
只改变有序下游路径/Profile，保留监听、目标、业务协议和启用意图；相同展开可无 Operation 保存新来源。
明确初次拒绝逐项保留，未知预检不写意图/停止尾部并显式重查；未知写入只原键请求重放，不重查/换键/自动继续。
新增 9 组队列、4 组选择回归；既有 3/4/8 Agent Chromium 增加两个真实引用、独立夹具写者制造冻结 CAS 失败、
实际短路径 TCP/UDP、显式新修订恢复路径/真实提交后丢回执、同键重放不继续尾部，以及新确认后无部署来源更新。
独立夹具的创建/绑定/发布/竞态/清理 API 命令与浏览器尝试分开计数，第三条停用规则的资源由原删除安全释放；源规则仍不变。
无 Core/Runtime owner/Agent/机器协议/迁移/Journal 或恢复行为变化。前一批存本地 `917dcb8`；本批仅静态检查，
功能/MySQL/浏览器/网络断言未执行，无 exact-SHA Actions，未触发远端 CI/Dev。C1 的冻结源码验收/中断与 UDP 损失测量仍待执行。
下一步核对真实组合验收并推进后续指标与有界历史切片，
内部门禁与实例表不冒充完整远程防重放或执行撤权；
并继续盘点剩余 API 读写及原生适配验收，不宣布统一框架完成。
此调整不取消下方
审计/支持包、证据与集中验收缺口，也不表示统一模块框架已经完成。

后续核验：`6e9586d340e12cf3d7adce68f3286b440ae82321` 的主 CI
`38831559895`（7 个 job）、容器 `38831559907`、Dev 发布 `38831559896`
均成功，包含 3/4/8 节点及隔离矩阵。下方旧失败/待核验文字是历史切片，
不覆盖该结果；也不代表物理主机或生产验收通过。
当前按队列 3 实现 [只读升级与恢复评估](../operations/upgrade-assessment.md)，
新增实现/用例/镜像接线等待本切片对应 SHA 的 Actions，不借用上述结果。

Direct、双节点 Relay 和默认关闭的 3–8 节点多跳已经有实现。下一阶段优先补齐
部署、升级、诊断和证据交付，再冻结版本集中验收。多跳六批的代码交付与运行验收
分别记录在 [交付台账](multihop-delivery.md) 和
[执行与验收手册](multihop-execution.md)，不重新安排为待从零开发的功能。

初始基线的容器构建运行 `38825824444` 通过；
主 CI `38825824472` 的 contracts/Go race 与 Relay 隔离作业通过，但七项
多跳 MySQL 回归和 3/4/8 节点创建失败，后续相关步骤跳过；镜像发布
`38825824411` 被同 SHA 门禁阻止，不能据此领取本提交的已发布镜像。
根因与证据范围见 [交付台账](multihop-delivery.md#exact-commit-ci-follow-up-2026-10-16-asiashanghai)。
领域输入修复已提交为 `b8217fe`。其 CI `38830077965` 的 contracts/Go race
与 Relay 隔离通过；多跳 MySQL 已推进至 5/7，余下两项是冻结 Report 的测试
夹具赋值错误。3/4 节点已通过真实双协议、续期、重启、重放与撤权恢复，
随后在验收客户端未声明长度的 DELETE 请求处失败，完整多跳仍不计通过。
验收夹具/请求修复已提交为 `95315f8`；分角色预检为 `73b019d`，
统一发布门禁为 `c9629e4`。这些后续变更等待完整新 SHA 的 Actions 结果。

历史切片的通过记录不能自动覆盖本次源码。按上方最新开发节奏，开发期间不运行
测试，也不逐批扩展或追踪验收接线；测试统一留到源码冻结后的
CI / GitHub Actions 集中执行和修复。本地不启动功能、MySQL、网络、容器或浏览器验收。
最终冻结版本后集中核对完整矩阵。暂无独立物理主机，对应验收保持待执行，
不重复索要主机，不以托管 CI 的同宿主机环境替代。

## 1. 当前基线与实际缺口

| 能力 | 当前已有实现 | 下一步补齐 |
| --- | --- | --- |
| Direct / Relay | ADP/3、受保护租约与 Journal、双节点协调、TCP/UDP、轮换和故障脚本 | 对冻结版本重跑完整矩阵；完成双物理主机及长周期证据 |
| 多跳 | 混合 Snapshot、统一物理 Fence、Runner 角色适配、真实 Report 协调、Console 路径编辑；领域边界及验收客户端修复已提交 | 新 SHA 的完整 MySQL、3/4/8 Agent 与隔离矩阵待核验；物理主机门槛未通过 |
| 部署 | 分角色 Compose、角色/证书/权限只读预检、非 root 镜像、首次初始化与 Enrollment 流程 | 预检实现和 CI 接线已提交，结果待对应 SHA 核验；升级评估继续推进 |
| 恢复 | Authority 维护模式、MySQL 备份/恢复、旧授权隔离与人工恢复审查 | 补版本兼容矩阵、多跳状态备份清单和升级/恢复操作评估 |
| 诊断与 Console | 有界分页列表、Node diagnostics、部署节点/租约/失败详情、历史配置恢复；JS 模型/语法与 API 测试 | 服务端筛选/独立候选/全 Scope 概览已有实现；Probe/原生目录/Profile 影响与浏览器 Actions 已接线未验收；继续审计、支持包及其余管理流程 |
| 发布 | 同 SHA 的 CI/容器门槛、Dev/Stable 镜像、SBOM/扫描、手动内部 candidate、15 项多跳证据校验；统一最新 CI 判断已提交 | 门禁回归待 Actions 核验；补完整证据生成/汇总、运行镜像身份核对和候选发布决策；当前没有自动 RC 通道 |

现有 `candidate-<SHA>` 工作流仅生成内部候选镜像；`vX.Y.Z-rc.N` 通道仍需单独设计。
已有 `release:multihop-check` 校验器不代表所有门槛都有证据生成器或已验收。

## 2. 优先级与依赖

| 批次 | 优先级 | 开发交付 | 依赖与验收出口 |
| --- | --- | --- | --- |
| 0 | P0 | 当前多跳 CI 缺陷修复及基线恢复 | 已有本地修复；按新 SHA 验证七项 MySQL、3/4/8 节点、隔离及后续回归，不重跑旧 SHA 冒充验证 |
| A | P0 | 部署预检、升级兼容评估及恢复操作保护 | 可先开发；集中验收时证明分角色初始化/重启/升级/拒绝回退可重复 |
| B | P0 | 统一只读诊断、审计查询与支持包 | 可与 A 的独立工作交错推进；先确定 API，再由 Console 消费 |
| C | P0 | 证据生产、汇总与候选镜像流程加固 | 复用现有 CI 和发布校验器；测试尚未运行时必须显示缺失/未通过 |
| D | P1 | Console 产品化 | 消费 B 的查询契约；补已有 Direct/Relay/多跳操作，不扩展传输 |
| E | P0 | 冻结源码后的集中验收与缺陷修复 | A–D 开发完成后启动；无物理主机时保留对应门槛未通过 |
| F | P1 | RC 决策、供应链与正式发布 | E 的声明范围全部通过，三项既有 P0 和安全审阅完成后才推进 |

原排期关键路径为 0 → A/B → C/D → 源码冻结 → E → F；当前按上方新节奏先推进
可独立开发的 A/B/C/D 功能，将 0 中的测试追修并入冻结后的 E。C 批中的 candidate
门禁修复是独立的早期 P0，在任何下一次内部 candidate 发布之前完成。
交错推进表示可独立拆 PR，
不要求多代理执行。每次修复都记录受影响范围，按新 SHA 重新取得相关证据，
不得把不同源码的报告拼成一个通过的发布包。

### 可执行交付队列

顺序是建议的开发/审阅队列，不是承诺工期；集中验收另有冻结出口。
本轮已将多跳领域修复、验收夹具修复、部署预检、发布门禁和规划文档分别
审阅和分组，不因同一轮推进就混成一个功能变更。

| 顺序 | 交付 | 当前状态 | 退出条件 |
| --- | --- | --- | --- |
| 0 | 多跳领域输入边界与验收客户端修复 | 已提交；完整新 SHA CI 待核验 | 严格 parser 保留未知字段拒绝；带数据库管理字段的路径、Report 夹具和删除回收在 Actions 中通过 |
| 1 | 分角色部署预检 | 实现、用例及 CI 接线已提交 | 按对应 SHA 验证角色/证书/权限/旧状态拒绝；不宣称静态预检证明运行就绪 |
| 2 | 内部 candidate 门禁统一 | 共享判断器、工作流和回归已提交 | exact-SHA/event/branch/latest-attempt；旧成功但最新失败/等待时拒绝；运行门禁测试，不手动触发 candidate 发布 |
| 3 | 只读升级与恢复评估 | 实现、回归与 CI/镜像接线已编写；待对应 SHA Actions | 源/目标版本、Schema/Journal、镜像与备份责任输出机器可读决策；不兼容组合在副作用前拒绝 |
| 4 | 服务端查询、节点候选与全量概览 | 已实现；当前端口重整后的源码待对应 Actions | scope 授权、有界筛选/分页、候选节点查询与全量聚合不受当前页影响；为必要查询补索引与回归 |
| 5 | 审计查询与脱敏支持包 | 待开发 | 复用已有事件表，白名单导出、大小/时间范围限制、跨 scope 拒绝和敏感值负面测试 |
| 6 | 证据摘要、汇总和运行身份核对 | 校验器/部分生产器已有；汇总待开发 | 15 项门槛来源明确；准确保留 failed/skipped/missing；核对源码、Digest、实际运行身份及清理结果 |
| 7 | Console 查询/表单与部署诊断收口 | 既有表单、Probe/原生目录/Profile 影响、规则复制/有界启停/重试已编写；真实浏览器接线待 Actions，其余流程待补齐 | 消费 4/5 的 API，展示独立状态与失败位置；增加真实 HTTPS 浏览器 CI，覆盖权限/CAS/重试/危险操作 |
| 8 | 冻结版本集中验收与发布决策 | 待前述交付完成 | 按 E/F 对最终 SHA 和镜像取证；物理主机不可用的项保持未通过，多跳继续默认关闭 |

每项只以实际证据升级状态；工作量和时间估算在对应 PR 的范围审阅后给出。
开发期间不持续执行 CI 回归；既有测试和新增缺口留待冻结后的集中验收，
不影响继续独立功能开发，也不提前宣布最终冻结验收完成。

## 3. A · 部署、升级与恢复保护

### PR 1 · 分角色部署预检

在现有 `deploy/preflight.mjs`、`deploy/test/preflight.test.mjs`、
分角色 Compose 和 [部署手册](../../deploy/README.md) 上增量实现：

- 显式选择 Control 或 Agent，只要求当前角色的变量、镜像和目录；保留可说明的兼容入口。
- 检查配置引用的证书有效期、Control URL/SAN、信任材料及运行 UID 所需读写权限，
  区分静态可判断的事实与必须由实际主机/网络确认的事项。
- 核对 State、PKI、Secrets 的边界、只读挂载要求和 Journal 缺失；显示实际时钟检查
  的结果或“未检查”，不从配置存在推断同步健康。
- 输出稳定错误码及脱敏的机器可读结果，供 1Panel 手册和后续诊断消费。
  预检不创建目录、不修权限、不初始化 Authority、不兑换 Enrollment。
- 补 1Panel 管理通信的 mTLS/四层透传适用说明；Host 网络保持现有部署基线，
  Bridge/NAT 故障单独诊断，不通过放宽身份校验或执行期限取得通过。

集中验收要求：单独的 Control/Agent 配置均可检查；错 CA/SAN、过期证书、
权限不符、缺失状态和错误挂载均有确定拒绝或未满足项；不输出令牌/私钥。

开发记录：分角色预检、initial/existing 阶段、机器可读报告与回归用例已编写，
新增 `deployment-tools` CI 作业并为容器工作流固定 Node 版本，提交 `73b019d`；
尚未记录对应完整提交的 Actions 通过结果。

### PR 2 · 升级兼容与恢复评估

基于现有 `scripts/ops/cli.ts`、`scripts/ops/recovery.ts`、数据库迁移器与
Agent Runtime Journal 增加只读升级评估，不另建一套恢复系统：

- 记录源/目标源码、镜像 Digest、数据库迁移版本、ADP/执行扩展和 Journal
  兼容性；备份清单关联 Authority、信任材料与 Agent 高水位的保管责任。
- 明确旧 Agent → 新 Agent、启用多跳迁移、新 Control/旧 Agent、停用多跳、
  旧镜像读取新 Schema/Journal 的允许与拒绝矩阵。
- 多跳关闭后仍使用支持新 Journal 的 Agent；已发布旧镜像无法补加拒绝检测时，
  在评估结果与操作手册中明确禁止该回退组合，不承诺任意镜像回滚。
- 区分可重试启动、需要停发授权、需要恢复审查和不可直接降级；复用现有
  backup/restore/maintenance/resume 流程，不复制实现。
- 为 DDL 中断、迁移中断、同身份旧 Journal、旧 MySQL 恢复与未耗尽历史租约
  编写回归场景；保留原高水位和已签发授权上界。

集中验收要求：可支持的升级成功，不兼容组合在副作用前被评估拒绝；
恢复后不能续用旧身份授权，不以清空数据库/Journal 或重新注册掩盖迁移失败。
只读评估不声称能原子捕获仍在运行的多主机备份。

## 4. B · 诊断、审计与支持包

### PR 3 · 统一诊断查询与全量概览

2026-10-16 本切片已实现 [服务端查询与全量概览](console-query.md)：
三类列表有界筛选、独立 Grant/能力候选、Scope 单语句聚合及现有 Console 接线，
并加入分页外记录、SELECT-only 全表只读性和轻量 DOM 数据流回归。
等待本切片 SHA 的 Actions；这不表示完成真实浏览器或所有关联诊断的集中验收。

从已有 Console 查询服务/MySQL 投影、Forward/Operation 查询和部署状态投影扩展：

- 建立 Node → Forward → Operation → Deployment/Assignment 的查询关联，
  展示 generation、session、Fence、当前阶段、错误码和发生时间。
- 复用现有授权与 Report 新鲜度判断，区分 Desired、Applied、续权许可、
  报告新鲜度、历史租约截止、清理/隔离状态；独立 Probe 缺失时显示未知。
- 提供按 scope 计算的概览聚合；当前页面基于一页 Operation 计算的运行/失败
  数量不能作为全量统计。增加分页外记录的回归场景。
- 列表筛选由服务端执行并保持访问控制、有界分页及稳定排序；
  不为了获取全部节点候选而把分页上限无限放大。

集中验收要求：撤权立即影响续权/ready 展示，旧报告不覆盖新实例；
跨 scope 请求拒绝，分页切换不改变全量计数，诊断读取不触发执行或网络探测。

后续独立 PR 补只读审计查询和支持包导出：复用已有审计存储，按 actor、Node、
Forward、Operation、时间及错误码过滤；新写入行为沿用所属模块事务。
支持包采用字段白名单、大小/时间范围上限和权限检查，不打包环境文件、
数据库 URL、认证头、令牌、私钥或完整受保护 Journal。

## 5. C · 证据生产与候选发布流程

先补工具和契约，再于集中验收时取得真实结果：

- 梳理现有 15 项 `MULTIHOP_RELEASE_GATES` 的来源，为每项登记生成命令、
  必需环境、产物格式、审查责任与未通过原因。
- 在现有验收脚本/CI 上提供统一摘要，保留其原始报告；关联 tested SHA、
  干净工作树、命令、环境/拓扑、二进制哈希、清理结果及镜像 Digest。
- 汇总器只接受实际结果。缺失、失败、取消或未运行的门槛不能手填为通过；
  仍需人工审查的物理主机和运维演练必须保留操作者审查来源。
- 核对运行中 Control/Agent 的实际镜像或二进制身份与清单。物理采集器现已检查
  Agent 二进制，镜像 Digest 仍来自 inventory，须补运行来源的核对或明确拒绝
  将未经核实的值作为镜像发布证据。
- 沿用 `release:multihop-check` 的完整性校验；汇总、校验、测试执行和人工批准
  分别记录，不将普通 JSON 声明当作独立认证。
- 对内部 candidate 复用 exact-SHA 门槛，统一核对工作流事件、分支和最新
  run attempt；不能仅因找到历史成功运行便忽略同 SHA 后续失败或未完成重跑。

加固前的源码核验发现：正常 `images.yml` 按 push/main 和最新运行/attempt
判断，`candidate-images.yml` 却只查询同 SHA 是否存在成功记录。
提交 `c9629e4` 已将两者统一到 `deploy/ci-prerequisites.mjs`：API 查询显式限定
SHA/push/main，再独立核对工作流路径和最新运行的当前 attempt；不完整、
重复或异常响应拒绝。两条发布流程在构建前和首次 registry push 前均检查。
新回归覆盖“先成功后失败/取消/等待、非 push、不同 SHA、畸形响应”和 CLI，
由容器 Actions 执行，尚无新树通过声明，也没有手动触发 candidate 发布。
这不依赖完整证据汇总器，不重新开发已有的镜像发布、SBOM 和扫描通道。

随后拆成“证据格式/汇总工具”和“CI 接线”两个 PR。此批不触发
候选镜像发布、正式打标签或自动部署。RC 通道是否新增在 F 批决策。

## 6. D · Console 产品化

已有路径编辑、预览、部署详情和历史配置恢复继续保留，重点补可操作性：

- Node/Forward/Operation 的服务端搜索、筛选和分页；节点选择单独提供有界
  候选查询，避免只能选择列表第一页。
- Node 注册、权限、凭据和 Direct/Relay/多跳表单按当前能力和授权展示，
  缺失能力、Endpoint、Profile Grant、Session 或租约时有明确原因。
- 将已有部署事实展示成节点进度、失败位置、清理/隔离原因和可执行的恢复提示；
  历史配置恢复继续创建新 revision，不倒写 generation 或 Fence。
- 接入 B 批审计与全量概览，保持 401/403、CAS 冲突、幂等重试、
  危险操作确认和移动端交互一致。

建议拆“查询/表单”和“部署详情/审计”两个 PR。UI 场景接入 Actions，
E 批再统一核对最终版本结果；不把样式完成视为浏览器或真实链路验收通过，
不增加自动选路或新驱动。

当前 `test:web` 只做 JS 语法与模型测试，不是浏览器端到端验收。
应补真实浏览器到 HTTPS Control 的登录/鉴权、分页选择、表单校验、CAS 冲突、
幂等重试、删除确认和桌面/移动布局用例。浏览器请求成功与真实 Agent 流量
仍是不同层次，后者沿用运行验收脚本，不能互相替代。

## 7. E · 冻结版本后的集中验收

这是开发出口，不能省略为最终发布前的一句检查。先固定候选源码并构建，
由 C 批工具核对每层结果。可用环境中的测试由 CI / GitHub Actions 执行，
开发期间的通过记录仍需对应最终候选源码。

| 顺序 | 验收层 | 必须覆盖 |
| --- | --- | --- |
| 1 | 单元、契约和静态回归 | TS/Go 一致、混合 Snapshot、Journal 迁移、Fence、重放、租约、权限、Go race |
| 2 | MySQL 与真实单机进程 | 并发/回滚、七项多跳事务回归、Direct/Relay 回归、3/4/8 Agent TCP/UDP、重启恢复 |
| 3 | Linux 网络隔离 | 下游未 ready、断链、延迟/丢包、撤权、旧命令、硬截止、历史租约与资源回收 |
| 4 | 容器和实际管理界面 | Digest/来源、分角色 Compose、1Panel 初次安装/重启/升级、真实 HTTPS 浏览器操作 |
| 5 | 独立物理主机 | 既有双物理主机 Relay；至少三台多跳流量、身份拒绝、断链/恢复及运行来源 |
| 6 | 长周期与恢复 | 持续 TCP/UDP、peer 轮换/过期、Control/MySQL 故障、配套备份恢复及资源趋势 |

现有入口集中在 [多跳执行手册](multihop-execution.md)、
[验收矩阵](../testing/acceptance-v1.md) 和 [部署手册](../../deploy/README.md)。
补充用例必须明确对应入口，不能只增加表格。长周期测试在开始前写明持续时长、
负载、允许错误和资源趋势判据；短时容量样本不能替代。

无物理主机时先完成可用环境的层次，物理与相关运维门槛维持未通过，多跳保持
默认关闭，不创建生产批准包。不能用同宿主机 namespace 或虚拟机数量替代。

若发现功能缺陷，回到对应 PR 修复、更新 tested SHA 并重跑受影响验证；
正式包仍须覆盖最终源码和镜像，不沿用修复前的通过结论。

## 8. F · RC 与正式发布

- 核验 exact-SHA 的 main CI、容器扫描和 Dev 镜像；目前已有发布机制，
  无需重新开发相同通道。新增 RC 需明确预发布标签、覆盖拒绝与批准规则。
- 完成漏洞处置记录、SBOM/许可证审阅、来源/签名决策和可追溯发布清单。
- 将支持范围、容量样本、已知限制、升级/恢复矩阵和故障处置写入运行手册。
- 1Panel 部署可靠性、双物理主机 Relay、长期稳定运行与备份恢复三项 P0
  独立通过后，再决定正式标签和生产多跳开关。

发布、打标签、启用生产和部署属于之后的实际操作；本计划不自动执行这些操作。

## 9. 本轮边界与交付规则

Link 复用、动态选路/自动故障转移、QUIC/TST、新内核驱动及商业模块继续单独
排期，等待当前声明支持能力完成验收。离线 Transit v1 保持离线模块，
不另建会与生产 Runner 竞争物理资源的执行路径。

每个 PR 记录：目标行为、代码范围、契约/Schema、兼容/迁移、失败/恢复路径、
待执行测试和实际证据。开发状态与证据状态分开，使用
planned / implementing / locally-verified / ci-verified / released 并注明范围；
实现已提交但未跑运行测试的项保持 implementing。只写静态检查通过时，
不得省略“静态”二字。

下一步先收口队列 0/1，再完成早期 candidate 门禁修复，并推进 PR 2、PR 3。
完成后检查新增查询和证据格式是否闭合，
再接 C/D；A–D 完成即冻结范围，进入集中验收，不持续追加新传输功能。
