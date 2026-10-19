# FR-0020: Console Request And Browser Native Composition

Date: 2026-10-19 (Asia/Shanghai).
Status: implemented-unverified.
Owner and authorization: existing Console app/native HTTP owners, under the
human's standing2026-10-19 source authorization. Record precedes implementation.
Source reads/edits only; no tests/checks/browser/build/CI/Git writes/delegation.

## Task Proposal

1. Layers: L3 console-request-owner connection/result/unknown-outcome coordination;
   L2 browser-native HTTP/format/main/Relay view and native forms; old compositions.
2. Consumed public interfaces: original request(method,resource,input,stableKey,
   options={}), mutate(method,resource,input), connected(), app's ephemeral scope/
   token/connectionVersion and native fetch Response/AbortSignal behavior.
3. Foundation impact: additive CONSOLE_REQUEST_INTERFACE_VERSION1, native effects/
   view/form factories under existing BrowserNative1 and five fixed JS modules.
   No L0/L1, HTTP API, authorization, default timeout or existing model change.
4. Contracts: createConsoleRequests(state,effects) owns the original pending-key
   Map; returns original connected/request/mutate plus clearPending for the old
   reset site. State reads remain callbacks to the same app-owned fields. Native
   methods send/readJson/throwIfAborted/checkResponse/signature/newKey preserve
   original operations and stages, without an extra async wrapper or retry.
5. Acceptance: planned181-184 on exact source; source/type/alias/default/getter/
   network/JSON/stale/abort/HTTP/concurrent-key/clear/actual asset/browser consumers.
   None executed now; functional/browser evidence later in authorized Actions.
6. Module impact: all original Console constructors receive the same signatures;
   original native view keeps auth, version increment and UI reset sequence. No token
   persistence, second session authority, new operation or UI/DOM/layout changes.

## Why Current Extensions Are Insufficient

app.js directly combines stable-key retention and stale-connection policy with
native fetch/AbortSignal/JSON/error/UUID implementation. Existing request callbacks
already allow all child consoles to consume one public request service; reuse
that seam instead of modifying each console, creating a new client or caching a
credential snapshot. No shared lower framework or Core expansion is necessary.

## Impact And Compatibility

Keep required scope/token short-circuit, capture connection version, then original
native headers/endpoint/options/fetch order. Native effects read scope/token lazily
through the supplied state callbacks at original positions, with dynamic browser
globals. Fetch is returned directly, not wrapped in another async function.

Read JSON in the original try/catch, then compare the current version, then test
the caller signal, then handle response.ok/status/error. Invalid JSON still wins
over stale/abort/HTTP status; stale wins over abort/status. No cancellation or
connection change makes a new response trustworthy. Preserve Chinese error text,
httpStatus property and original options timeout default15000/headers/body flags.

Mutation first computes JSON.stringify([method,resource,input]), even disconnected,
then creates a key only if that signature is absent. Original Map key is retained
on every request rejection and deleted only after success; explicit connection
reset clears it at its old location. No clone/freeze/normalization/fixed cache,
scope addition to signature, key rotation, automatic retry or concurrency fix.
Repeated serialization of caller input remains original behavior, not a new
guarantee against mutable input or an atomic queue. Existing child consoles keep
their own explicit command/replay policies and use the same request function.

Original app's auth object and connectionVersion stay canonical. Owner stores no
credential copy and does not increment version. Its initial Map is created at the
old Map site; callback closures are not read during factory construction, before
the later let declaration is initialized. clearConnectionData retains its order.
Function source/declaration identity changes; app has no new named export surface
and private/source-text/reflection equivalence is not claimed.

## Migration And Version Plan

Create console-request-owner/public.js and service.js, bind explicit state/native
effects at old app Map creation, use original function names for child callbacks,
replace only the old Map.clear invocation. Move native bodies into a separate
browserConsoleRequestEffects export, without changing BrowserNative1's existing
model effect methods or globals' dynamic timing. Add two fixed /console module
routes and NativeControlConsoleAsset members with original headers/MIME/reader.
No wildcard/user-derived filesystem path or CSP/connect/credential change.

Old app/index/module invocation and model.js ten-export compatibility remain.
No protocol/schema/DB/Authority/Journal/ledger/catalog/Agent version or state change.
New owner/asset aliases can be removed only after actual consumer migration and
matching-source acceptance. This is a source candidate, not whole-Web closure.

## Acceptance And Known Limits

### Source Scope Amendment Before Native View Move

After the request extraction, full original app source reading identifies the
remaining body as native browser view assembly: DOM/form/clipboard/time/display
and ephemeral page/connection state, with existing product helper and console
callbacks. Move that unchanged body into browser-native/control-console.js as
mountControlConsole(dependencies), and keep app.js as its original index-selected
composition entry. Pass ten model helpers, the existing console initializer
callbacks and createRequests(state) explicitly; the L2 adapter imports no L3.
The callback may execute outer product code without a reverse source dependency.

The native view retains the single original auth object, connectionVersion,
store/page/readVersions/secret/candidate state and complete event/render/reset
ordering. At the original Map site it calls the supplied request factory with
lazy state readers; only the request owner owns pendingKeys. App supplies the
factory binding to native HTTP effects. No new composition entrypoint, duplicate
credential/session owner, UI policy, automatic request or layout/style change.

Add one further fixed asset browser-native/control-console.js and reexport mount
from the native public entry. Thus this FR now adds three new asset members/routes
in total (two request owner files and one native view file). Case183 covers the
full native view/root callbacks/initialization/DOM/listener/reset/secret behavior
and actual import/COPY path, not only parsing two new JS files. No provider/state
reader is called early by factory setup; the original later let initialization
remains before any view-triggered request. No existing native/model method set
changes. Reflection/private source-file/stack identity changes are not guaranteed.
This amendment is recorded before moving that source and remains source-only.

### Source Scope Amendment Before Native Relay Form/View Move

The complete relay-model.js/relay.js bodies have been read. Their profile driver/
wire/security/capability/form projection and DOM/preview/deployment presentation
are native external-format/view implementations. Move them to import-free L2
browser-native/relay-forms.js and relay-console.js with explicit helper callbacks.
The old six model exports bind parsePorts/directCapable from the public original
model entry at relay-model.js. Old initRelayConsole binds those six callbacks at
relay.js and retains its original argument destructuring/return object. These are
the existing module/constructor entrypoints, not new business composition roots.

Preserve every original validation/error/native field/array/mutable return and
constructor/invalidation/cache/plan/CAS/unknown-outcome/deployment/listener sequence.
Do not normalize profiles, add schema checks, make preview a reservation, change
history replay, connect a new execution mode or duplicate Core/Authority rules.
New factories only define functions at module setup; no native DOM/time/network
operation occurs before the original init calls. Add two fixed module assets,
making five fixed asset additions in this FR in total. Case184 records exact six
aliases/native form/view/constructor/browser behavior, planned/unexecuted.
Layers L2/native format/view plus original composition; consumed original model
helpers/Console callback ports; no L0/L1 changes; additive factory exports under
BrowserNative1 with old public export sets preserved; no other Console edits or
concurrent module work. This full amendment precedes implementation.

181: same state read/required/version stages, lazy field/default/getter behavior,
JSON-before-stale-before-abort-before-HTTP errors and exact thrown messages/status.
182: native fetch receiver/options/headers/body/signal order, no extra async stage,
signature/key generation before connected check, failure retention/success deletion,
same-signature concurrent behavior, session clear at original phase and no retry.
183: app->owner public->service/native real fixed ESM assets, MIME/CSP and existing
Console consumers/clear/reset flows in actual browser and Node source consumers.
The current console-flow.test.mjs harness reads old app/relay source, strips import/
export function text and exposes old lexical auth/load/store in a VM. Source reads
confirm it requires adaptation to canonical native/request factories and existing
UI ports after authorization; it was not edited/run and no pass/failure is claimed.
Do not expose new production credential/state hooks merely to preserve private
test source extraction. Keep its original flow coverage when adapting acceptance.
184: original six Relay form exports and initRelayConsole argument/default/return
shape, exact native validation/fields/capabilities and callback ordering, plan
invalidation/CAS/replay/deployment/history/cache/DOM and actual fixed assets.

All planned/unexecuted. Full remaining Web/app native view/product/default/source/
type/consumer/asset/candidate and foundation/physical/release gates remain open.
Do not label app.js wholly pure/L2 or classify other consoles from their directory.
