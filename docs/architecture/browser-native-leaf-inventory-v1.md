# Browser Native Leaf Inventory v1

Date: 2026-10-19 (Asia/Shanghai).
Status: manual source classification authored; behavior/boundaries unverified.
Scope: the22 named leaves previously listed in browserSourceInventory.remainingSources.
Record revision1 is documentation identity, not a new runtime API version.

## N Source Successor, 2026-10-21

The original 22-leaf map below preserves its dated scope. FR-0028–0032 add five
explicit L2 representation leaves, all served through the original fixed asset
adapter: account-context.js (authenticated scope discovery), line-builder.js
(purpose-specific path draft), template-reference.js (exact template/owner view),
admin-resource-console.js (shared grants/classification/port usage) and
resource-limit-console.js (payload policy CAS, unknown-result replay and personal
configuration view). Their consumers are the original Control/Relay/Path/Ingress
views; no blanket apps/web exemption is declared. Current source imports and
declarations reside in the boundary inventory. Header/byte-exact asset cases,
unit/DOM flows and public interfaces are authored only, not executed acceptance.
See [Web integration](../../apps/web/PRODUCT-INTEGRATION.md) for public operations,
late-result clearing and the explicit unavailable consumption contract.

## Six-Part Source Proposal

1. Layers: existing21 L2 view/form/representation adapters; originally mixed Rule
   now binds L3 RuleCommands1 and L2 native view under FR-0022.
2. Public inputs: existing exported init functions and their request(method,
   resource,body,key,options), byId, notify and named UI callbacks below.
3. Foundation: no L0/L1 semantics change. Classification identified the actual Rule
   product state machine; FR-0022 then preceded its source split.
4. Contracts: old initializer arguments/defaults/return methods remain; Rule bodies
   move under RuleCommands1 and an additive BrowserNative1 factory. The other
   unversioned legacy APIs do not silently become BrowserNative1 members.
5. Acceptance: complete source-body and actual entry/default/caller/asset reads
   performed as source work. Readiness188 contract/boundary/browser acceptance
   remains planned/unexecuted; no test/check/tool expansion or execution.
6. Other modules:21 native bodies stay; FR-0022 changes only Rule binding and three
   assets. Original service authority/transactions/storage remain outside.

## Why These Are Native Adapters

Each original body was read, including both public functions in path-templates.
The21 unchanged leaves bind DOM/forms, JSON/URL/time/number/base64/crypto representations,
closed external response/receipt validation, cancellation and ephemeral interaction
state. No source import was observed in those21 bodies. Rule's independent command
construction/preflight/replay/tail state machine is L3 with a real source split,
not an L2 exemption; see [Rule chain](rule-command-owner-native-v1.md). Callbacks are
supplied to initializers; invoking them does not create an adapter-to-product
source dependency. This is a per-leaf classification, not a folder exemption or
an automated import/private/type/dependency pass.

Client CAS/plan/outcome checks constrain what a page submits or displays. They do
not replace server authorization, same-transaction acceptance, native trust checks,
one Runtime ledger or Agent authority/Journal. Native response validators can
check an external contract's semantic relationships without becoming execution
policy owners. No second framework or wrapper is added merely to rename a file.

## Exact Public Initializers And Defaults

All names below are original named exports at the stated existing JS path.
All take request/notify/byId. D means document=globalThis.document; C means
confirm=globalThis.confirm; K means randomUUID=()=>crypto.randomUUID(), called
when a command is prepared, not sampled by module import. Old initializer APIs
remain unversioned; RuleCommands1 is separate. A later candidate identifies them
by its exact source revision/content along with remaining version governance.

| Existing apps/web/ leaf | Public initializer, extra inputs/defaults | Returned public operations |
| --- | --- | --- |
| probe.js | initProbeConsole; display; getScope=()=>''; delay=pause; C | open,clear,capabilities,issue,query,revoke,wait,prepare,stop |
| probe-runs.js | initProbeRuns; getScope; D | clear |
| probe-plans.js | initProbePlans; getScope; D,C,K | clear |
| transport-console.js | initTransportConsole; detail,edit,prepareProfileBatch; C,D | catalog,references,open,clear |
| rule-console.js (FR-0022 composition) | initRuleConsole; refresh; document:dom=globalThis.document; confirm:ask=globalThis.confirm; newKey=()=>crypto.randomUUID() | page,checkbox,batch,profileBatch,pathBatch,retry,clear |
| tunnel-console.js | initTunnelConsole; deployment; D | open,status,references,clear |
| observation-services.js | initObservationServices; getScope; D,C,K | clear |
| path-templates.js | initPathTemplates; tunnelManagement=false,onSelectDefinition; D,C,K. initPathSwitch; preparePathBatch,tunnelManagement=false; D,C,K | templates:list,inspect,capture,clear; switch:lock,current,prepare,submit,references,prepareBatch,selectDefinition,clear |
| path-groups.js | initPathGroups; D,C,K | clear,list |
| path-publications.js | initPathPublications; getScope; D,C,K | clear |
| ingress-groups.js | initIngressGroups; getScope; D,C,K | clear |
| ingress-migrations.js | initIngressMigrations; getScope; D,C,K | clear |
| forward-diagnostics.js | initForwardDiagnostics; getScope; D,C | open,clear |
| audit-console.js | initAuditConsole; getScope; D | clear |
| station-alerts.js | initStationAlerts; getScope; D,C,K | clear |
| notification-endpoints.js | initNotificationEndpoints; getScope; D,C,K | clear,leave:wipeSecrets |
| notification-deliveries.js | initNotificationDeliveries; getScope; D | clear |
| telemetry-console.js | initTelemetryConsole; D | open,clear |
| forward-telemetry-console.js | initForwardTelemetryConsole; D | open,clear |
| host-telemetry-console.js | initHostTelemetryConsole; D | open,clear |
| probe-telemetry-console.js | initProbeTelemetryConsole; D | open,clear |
| telemetry-aggregate-console.js | initTelemetryAggregateConsole; getScope; D | openNode,openForward,clear |

The request callback still reaches ConsoleRequest1 and the same current auth/
connection-version state. Some leaves also track Scope explicitly; others rely on
that original request binding. This document does not invent a uniform Scope,
cloning, cancellation, command-key, return-shape or error policy across them.

## Shared Pure Helper

`apps/web/forward-status.js` is an L2 pure projection helper, not another leaf.
`browser-native/control-console.js` imports it directly; the composition root
passes `summarizeDiagnosticRecord` into `initForwardDiagnostics` as an initializer
input so the diagnostics leaf retains no source import. The helper only validates
the fields it displays, derives bounded Operation/Listener/Probe counts and
unknown/partial flags, and performs no HTTP, DOM, storage, command or health
decision.

`apps/web/forward-preflight.js` is a second L2 pure helper, consumed only by
`browser-native/control-console.js`. It derives per-node capability/credential/
report-freshness reasons from the already loaded Node Policy. Platform, role and
flag dimensions remain `unknown`; the result is advisory and does not grant
execution. The service still validates authorization, target, port and credential
on submit.

## Native Responsibilities And Actual Request Triggers

| Leaf | Actual format/view/lifecycle responsibilities and bounded behavior |
| --- | --- |
| probe.js | Native acceptance/receipt descriptor and v1-v4 stored-result projections, DOM issue/read/revoke/wait. Init clear has no HTTP; open reads execution-capabilities. Explicit wait polls at most8 times within5s with400ms delay; revoke then queries receipt. Unknown issue outcome retains original key/body. Issue controls retain three TCP kinds; Echo historical completion is FR-0021 |
| probe-runs.js | Closed historical record/envelope/query/cursor validation, native canonical SHA256 and invocation/content digests, base64 Echo representation, real byte/protocol display. Init clear sets native Date window; list/detail/next remain separate UI actions with5s abort. No issuance or live-binding evaluation |
| probe-plans.js | External finite-plan/decision/permit/preflight shapes and content/config/context digests, forms/UTC windows/consent/CAS/pending command. Init clear sets defaults, no HTTP. UI preview/save/read/run/cancel/replay; scheduled config is delegated server intent, not a browser timer. Original three TCP kinds and sixteen-decision bound remain |
| transport-console.js | Native catalog and Profile revision/reference query serialization, page25, select at most10, inspect/detail/editor/batch callbacks. Init clear has no HTTP; open reads references, catalog loads when caller requests it. Preview is non-reserving; loading editor or preparing a rule batch is not acceptance |
| rule-console.js | Public binding now composes L3 RuleCommands1 with L2 native view. L3 owns selection10/fixed command construction/retry/preflight/replay/stop/tail/finally-refresh. Native owns DOM/input Set/JSON/encoding/clock/UUID/abort/error mechanics. See FR-0022; no L2 product-state-machine exemption |
| tunnel-console.js | Native persisted Node/peer/endpoint/reference response projection and bounded page display, no socket probing. Init clear has no HTTP; open and refresh issue status/reference reads concurrently. Reference path/role relationships are external-format checks, not permission or deletion proof; deployment is an injected UI callback |
| observation-services.js | Native TLS/Echo declaration config/certificate/public-key/base64/URL syntax and config/context/fingerprint representations, registry metadata DOM and original pending CAS commands. Init clear has no HTTP; prepare hashes locally; explicit list/read/publish/archive/replay use original API. URL parsing does no lookup/target access, browser does no certificate-chain or Echo-signature verification |
| path-templates.js | Native template/config and logical-tunnel management shapes. Capture reads ordered downstream endpoint revisions; inspect/list use exact native references. Metadata command success refreshes list. Separate switch initializer locks exact template, reads current provenance, previews, checks fresh relay-plan then writes original binding; references feed optional batch callback. Production sets tunnelManagement=true; default remains false. Selected definition callback is lazy and performs no write |
| path-groups.js | Native ordered group/candidate/AND-OR topology, exact template/expanded-spec/digest/history representation. Init clear has no HTTP. List/inspect/reference/binding reads and preview/check/apply are explicit; candidate remains operator-selected, not automatic priority failover. No-op provenance and actual Operation acceptance stay distinct |
| path-publications.js | Native persistent batch plan/source/spec/attempt/receipt/digest consistency, UI preview/save/read/one-item apply or compensation/cancel. Init clear has no HTTP; max10 items, batch revision24. Unknown results keep original command. Buttons represent original server decisions, not a cross-Forward transaction, background dispatcher or rollback authority |
| ingress-groups.js | Native member/template/IP/host/protocol/spec formatting and metadata/deployment batch projections. Init clear has no HTTP; ordered members max8, batch revision20. Explicit save plan assigns no Forward UUID; each create or conditional cleanup is separately confirmed and submitted, with original receipt/digest association |
| ingress-migrations.js | Native source-origin/ref/group/diff/action/plan/state/attempt representations and DOM. Init clear has no HTTP; max8 origins/actions, explicit add/update/remove, remove has no compensation. Preview/save/read/one-item action/cancel/replay; no inferred global membership, automatic diff execution or revival |
| forward-diagnostics.js | Closed raw diagnostic/support representations, bounded redacted alias projection and same-read digest, native display and textarea support preparation. Init clear and open have no HTTP; reload is separate GET. Support action revalidates locally and selects text; no upload/export request. Existing diagnostic Probe schema covers three TCP measurements, not the raw Echo history family |
| audit-console.js | Native source/kind/error/time/attribution/query/cursor/order/coverage response validation and table formatting. Init clear sets Date/window/options, no HTTP. Explicit5s read/next uses persisted records; no audit writer or reconstructed transition log |
| station-alerts.js | Native fixed-rule/config/evidence/state/event/audit response relationships, canonical digests and UTC forms. Init clear sets defaults, no HTTP. Explicit policy/event reads and publish/silence/ack commands retain original CAS/key/unknown outcome. No target evaluation, health decision or notification dispatch happens in the page |
| notification-endpoints.js | Native public config/digest/HTTPS destination syntax and secret form lifecycle. Init clear sets interval60, no HTTP. Commands keep one original sensitive pending payload for explicit replay; GET displays redacted metadata. leave clears secret input values, not a claim to zeroize memory or cancel a retained command. Disable is original server metadata intent, not withdrawal of past requests |
| notification-deliveries.js | Native delivery/attempt/event/payload-ID/digest/status/query/cursor representations and read-only DOM. Init clear sets Date window, no HTTP. Explicit5s list/detail/next only; no send/test/retry/redrive. HTTP2xx is kept distinct from application processing and unknown/dead-letter from non-delivery |
| telemetry-console.js | Native process sample/platform/decimal/time/session/delta response validation, BigInt CPU/memory display and DOM. Init binds listeners; open immediately reloads bounded15m/1h/24h history,128/256/512 points with5s abort. No extrapolated host capacity, current authority or health |
| host-telemetry-console.js | Native OS availability/Linux-versus-unsupported wire constraints, network-interface coverage, counter/delta continuity and BigInt display. Init binds listeners; open reloads same bounded history. Host scope means agent-visible OS/root/network namespace, not verified physical host; interface cumulative bytes do not imply throughput |
| forward-telemetry-console.js | Native IP/resource/driver/instance identity, counter/coverage/epoch/terminal/continuity validation and per-instance payload rates. Init binds listeners; open reloads same bounded history. No cross-node/protocol/epoch sum or topology/current-lease inference |
| probe-telemetry-console.js | Native complete binding/Probe instance/counter epoch/coverage/frozen-tail/continuity checks and BigInt subset ratios. Init binds listeners; open reloads bounded history. Unknown/inFlight/overflow/terminal/gap handling constrains display, not permit execution or a network loss/health conclusion |
| telemetry-aggregate-console.js | Native series/IP/metric/bucket/quality/coverage/keyset/digest and logical capacity formats with BigInt arithmetic. Init binds listeners; open selects target/default minute window without HTTP. Read/next and Scope capacity are separate5s actions; no automatic poll or physical-space guarantee |

The21 native bodies remain at existing entries; Rule keeps its original initializer
after the actual split. Validation rules are not silently generalized between
families. Browser lower imports cannot be added merely because a directory name
looks native; future source/type dependencies still require classification.

## Real Composition And Consumer Paths

Existing index.html loads /console/app.js as a module and /console/style.css.
app.js explicitly imports these23 initializers from22 leaves, alongside the earlier
Relay initializer, and passes them into mountControlConsole from BrowserNative1.
That existing native view invokes them with the same request/UI callbacks.

Transport edit/deployment callbacks call original relayConsole operations; its
Profile batch callback and PathSwitch preparePathBatch call original ruleConsole
methods lazily. PathTemplates onSelectDefinition calls PathSwitch.selectDefinition
then scrolls the existing title. These callbacks preserve original initialization
order, including references to later-initialized objects which are not invoked at
factory construction. This is the actual existing composition, not a new root.

clearConnectionData clears the same UI/auth-version/pending/selection/secret states
and all original leaf clear operations. Navigation out of notifications invokes
notificationEndpoints.leave. Clear/disconnect/abort keep their original per-leaf
meaning; none becomes a remote cancellation or rollback guarantee.

Existing direct-import test consumers read in apps/web/test include probe-flow,
path-template-flow, path-switch-flow, transport-flow, rule-flow and tunnel-flow.
Their source imports original names. console-flow additionally concatenates old
app/Relay and several leaf source bodies in a VM; the earlier FR-0020 private-layout
adaptation remains pending. Model/relay-model test imports remain documented in
their own slices. This list records observed source consumers, not proof that all
repo-wide callers/private consumers/fixtures were discovered or tests cover all
22 leaves. No test was changed or run.

## Assets, Versions And Acceptance

All22 filenames already have literal /console/<filename> GET routes in
apps/control/src/api/routes.ts and cases in NativeControlConsoleAsset in
compatibility/native-control-http.ts. The native reader resolves only a supplied
typed asset under the existing web URL and reads UTF8. Existing consoleHeaders,
Javascript MIME, HTML/CSS entries and CSP remain. The21 unchanged leaves need no new
route; FR-0022 adds three fixed Rule modules. The FR-0019/20 relative module graph is
still required. This source correspondence is not browser/import/build evidence.

Docker's recursive web COPY is recorded in foundation-source-root-catalog-v1.md;
packaging, actual delivery, import MIME/CSP and unknown-path refusal need exact
candidate acceptance. package.json test:web explicitly checks an older fixed JS
list and then test globs; that text does not cover every production leaf/module.
Boundary tooling/current JS/type/private/asset coverage must be adapted later under
verification authorization without removing original coverage or adding production
state/credential hooks. No generator, checker or browser was run to build this map.

These are actual legacy public initializers, not wrappers scheduled for arbitrary
removal. Removing or moving them requires updating app imports, injected callbacks,
fixed routes/asset union, DOM contracts, direct tests/private VM consumers and
packaging in one explicitly recorded compatibility migration, with exact-source
evidence. No removal is authorized by this classification. BrowserNative1,
ConsoleModel1,ConsoleRequest1 and RuleCommands1 remain distinct public surfaces.

Readiness188 now has its manual source map; acceptance remains planned/unexecuted.
It must cover every initializer/default/return, invocation trigger, old request/
error/abort/unknown-result/getter/time/order behavior, schema/digest/UI contract,
actual caller/clear/asset graph and negative boundaries on the frozen candidate.
FR-0021 cases185-187 cover the actual Echo source fixes, not a live-v4 capability.
FR-0022 cases189-191 cover the actual Rule owner/native split and delivery graph.
All current-source type/syntax/static/boundary/contract/browser/native/MySQL checks,
full A5 candidate/version/example and independent physical/release gates remain
unverified. No whole-layer acceptance follows from this source classification.
