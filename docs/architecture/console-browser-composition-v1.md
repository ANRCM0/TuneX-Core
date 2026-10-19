# Browser Console Native Views And Composition v1

Date: 2026-10-19 (Asia/Shanghai). FR-0020 source implemented, unverified.

This slice moves exact original main/Relay view and native Relay form bodies,
without redesigning UI, changing command meaning or excluding other Web files.
Its scope amendments were recorded in FR-0020 before the corresponding moves.

| Source relative to apps/web | Exact responsibility |
| --- | --- |
| app.js | Existing index.html /console/app.js composition: public model, request/native and original Console initializer bindings only |
| browser-native/control-console.js | L2 mountControlConsole, complete original DOM/form/clipboard/time/page state and listeners with explicit helper/request/initializer callbacks |
| relay-model.js | Original six-export form compatibility composition, binds public model parsePorts/directCapable into native forms |
| browser-native/relay-forms.js | L2 createNativeRelayForms, original native Relay capability/profile/endpoint/Forward/multihop form projection bodies |
| relay.js | Original public initRelayConsole name bound to native view factory with those six helpers |
| browser-native/relay-console.js | L2 createNativeRelayConsole returns original named initializer/body/return object, native DOM/preview/deployment view |
| browser-native/public.js | BrowserNative1 public factories and original model/new request native effect objects |

The native files import no product module. Root binding passes public helper and
initializer callbacks; executing those callbacks does not create a reverse source
dependency. These are exact existing entry/module/constructor compatibility sites,
not a new root authorizing arbitrary business or table access. Public L3 request
coordination and model policy remain in their separate existing owner surfaces.

## Main View And Connection Lifetime

The old main body was moved intact into mountControlConsole, apart from invoking
the supplied createRequests(state) at its old Map site. All ten model helpers and
24 original Console initializer callbacks are explicit root dependencies. The
root calls mount once at the original module evaluation point, after imports.
No native file mounts or reads DOM/time/network at mere import/factory definition.

One original auth object, page/store/filter/candidates/readVersions/totals,
connectionVersion/editor/secret/overview state remain in the native view. Every
render, event registration and initial display('overview') remains in original
body order. No new credential persistence, client, polling, root session copy,
worker or permission. Form-to-native HTTP representation and ephemeral view state
belong here; product helpers and request/unknown-outcome coordination are supplied.

Connect still validates trimmed scope/token, clears connection data, sets the same
auth fields, clears token input, enables controls, displays overview and refreshes.
Disconnect still clears auth before reset, clears input/indicators and reports
local credential removal. Reset keeps version/reader invalidation before secret/
editor/overview/pending-key clear and the original later list/dialog/Console resets.
Clipboard secret, Node registration view, Direct editor and action/CAS callbacks
retain their original source and no stronger acceptance/health claims are added.

## Relay Native Form And View Scope

The complete original relay-model.js was read. Its six exports remain relayCapable,
multihopCapable, multihopSpec, relayProfile, relayEndpoint and relaySpec. Factories
only define the same named functions and return them; parsePorts/directCapable
execute at their original call sites, never during factory setup.

Its native.relay.v1/wire1/mutual-tls13 profile fields, protocol-specific bounds,
frame/UDP relationships, endpoint projection and native driver capability checks
are explicit L2 external representation. UI checks are not server authorization,
Core validation, actual trust/peer readiness or a new execution mode. Objects,
arrays, case/error/validation/property evaluation and field order stay source
intent. No schema/parser normalization, clone/freeze or new fallback is introduced.

The entire original Relay view body now lives inside the returned initRelayConsole
function. Signature/destructured callbacks and returned refresh/populateNodes/
refreshCandidates/clear/edit/copy/deployment methods are unchanged source intent.
Known profile cache is still per initializer. No callback/DOM/native effect is
eagerly invoked just by creating that initializer.

Original candidate/path/order/pinned-profile edit, plan invalidation/version checks,
preview JSON equality, CAS/expectedRevision submission, profile/endpoint editing,
deferred refresh and historical-spec deployment remain in the same body. The
preview is still non-reserving; response uncertainty still relies on original
request/mutation behavior. No safety fix, retry, compensation, automatic topology
selection or physical-network claim is hidden in this source relocation.

## Actual Served And Packaged Graph

Five fixed additions in FR-0020 are console-request-owner/public.js, its service.js,
browser-native/control-console.js, relay-forms.js and relay-console.js. All have
explicit /console paths, same consoleHeaders/text/javascript/native file reader.
No wildcard/dynamic path, directory listing, CSP/connect/credential permission.
The previous three FR-0019 assets remain. app/model/relay legacy URLs are unchanged.

app -> public request/native view; model -> model public/native; relay -> six
legacy helpers/native view; native public -> import-free native definitions.
There is no native source import back into a product owner. Factories do not mount
views when model/Relay-model are imported by Node tests. This is the intended
source graph, not a demonstrated import/cycle/browser result.

Existing Docker Control COPY recursively includes apps/web and .dockerignore does
not name these directories; those source instructions were read, never built or
used as a substitute for distribution acceptance. Case183/184 must use actual
served relative imports, root initialization/DOM/listeners/resets and original
Direct/Relay/browser flows with matching source. The current console-flow.test.mjs
source harness specifically reads app.js/relay.js, strips import/export-function
text and accesses old lexical auth/load/store in a VM. Those source/layout
assumptions require canonical factory/UI-port adaptation after authorization;
the harness was not edited/run and no pass/failure is reported. Retain its flow
coverage without adding production credential/state hooks for test extraction.

No L0/L1, Core, protocol/schema, native driver, DB, Authority/Journal/ledger or
protected history change. Source/declaration/function stack identities moved;
reflection/private/source-string compatibility is not claimed. Readiness181-184
all planned/unexecuted. Full other-Web/type/private/default/consumer/candidate and
foundation/physical/release gates remain open. No checks/tests/formatter/generator/
build/CI/experiments/Git/delegation occurred in this source slice.
