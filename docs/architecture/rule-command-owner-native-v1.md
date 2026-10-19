# Rule Command Owner And Native View v1

Date: 2026-10-19 (Asia/Shanghai).
Status: source implemented; unverified.
Proposal: [FR-0022](../changes/FR-0022-rule-command-owner-native-view.md).

## Actual Source Ownership

| Entry/source | Responsibility |
| --- | --- |
| apps/web/rule-command-owner/public.js | L3 RuleCommands1 constant and createRuleCommands factory |
| apps/web/rule-command-owner/service.js | Canonical selected-command state, batch/Profile/path construction, retry, acceptance, dispatch, discard/stop/clear coordination |
| apps/web/browser-native/rule-console.js | Original DOM/input Set/render/events/defaults/native formats and effects; createNativeRuleConsole(createCommands) |
| apps/web/browser-native/public.js | Existing BrowserNative1 entry adds that native factory |
| apps/web/rule-console.js | Original initializer composition, two public imports and named initRuleConsole function value |
| apps/web/app.js and browser-native/control-console.js | Existing real app import and view invocation, unchanged in this slice |

The old mixed body is removed after actual policy/view separation. There is one
canonical command owner and original UI, not copied framework/kernel or a new
execution authority. The other21 native leaves have their own exact inventory;
Rule command construction is not declared an L2 format exemption.

## Source-Candidate Public Ports

createRuleCommands({request,notify,refresh,view,effects}) creates one selected Map
and live state with selected,plan,active,stopped,generation,controller. The opaque
cancellation handle has no browser implementation/type import in L3. Native view
observes the same state without a copied/frozen shadow model. This composition
state is not returned by the old initializer or exposed by a remote endpoint.
Factory construction calls no view/effect, clock, DOM, request or UUID operation.

It returns state and select(item,checked,uncheck),page(dropInputs=true),batch,
profileBatch,pathBatch,retry,dispatch,stop,discard,clear. Native checkbox checks its
original disabled/checked inputs first; owner select performs original removal/
ten-limit/clone/notification order. resetInputs follows selected.clear and precedes
selectionState, retaining the native input Set and its optional clearing.

| Port | Original source semantics |
| --- | --- |
| request/notify/refresh | Local original callbacks, five request arguments, same awaiting and error behavior; no extra async request wrapper |
| view.selectionState/resetInputs/render/show/clear | Original synchronous, lazy DOM effects at original policy positions |
| view.consented/clearConsent | Original checkbox read/clear at dispatch and finally |
| effects.id/revision/hash | Original native checks; hash preserves RegExp.test coercion |
| effects.clone/ordered/json | Original JSON roundtrip, recursive sorted representation and stringify as separate calls; left/right getter evaluation order retained |
| effects.encode | Dynamic encodeURIComponent lookup per call |
| effects.newKey/confirm | Wrappers call original parameter functions as plain local calls, preserving caller this-binding |
| effects.newAbort/options/aborted/throwIfAborted/abort | Original native controller/signal,5000ms options and optional controller behavior at original positions |
| effects.checkedAt | Original new Date().toISOString only after successful preflight |
| effects.completeRejection/errorText | Original status list and String(error.message??fallback).slice(0,260) |

These new version1 ports require synchronous effects and lazy view callbacks.
Native source imports no L3 implementation; createCommands is injected at the old
module binding. L3 imports no DOM/native implementation. No generalized permission
framework, background queue, competing authority or new runtime state is created.

## Command Rules, Defaults And Order

Ordinary batch commands/CAS/keys are prepared before discard confirmation as
before. Profile/path batches retain exact references/spec relationships, first
error, one-to-ten bounds and key order. Selection clones the original Map entry.
Path provenance no-op and changed execution config retain separate null/real
Operation behavior. Retry still discards local state, GETs Operation then Forward
with one options object, checks latest failed/non-recovered desired revision and
shows an unsent command rather than submitting automatically.

Dispatch requires consent, blocks mixed uncertain/preflight-failed batches, filters
unsent rows and supports explicit single-row replay/recheck. First path/Profile
write performs the original preview/relay-plan checks. Unknown write replay skips
replacement preflight. Native abort/generation/plan identity, writeStarted and
recognized first rejection retain original positions. Replay refusal cannot
disprove a prior commit. Stop aborts current local dispatch; uncertain/preflight-
failed stops the tail. There is no transaction across Forward commands.

Finally still clears active/controller/consent, renders then awaits refresh; refresh
failure retains command results and original notification. No retry, new key/CAS,
Scope key, queue, clock sample, timer, remote rollback or cancellation is added.
Application connection fencing stays in the original request owner.

The native factory returns a normal named initRuleConsole without constructing
state or accessing native globals at module binding. Invocation keeps original
destructuring/default order: request,notify,byId,refresh,document:dom=globalThis.
document,confirm:ask=globalThis.confirm,newKey=()=>crypto.randomUUID(). Returned
keys/order remain page,checkbox,batch,profileBatch,pathBatch,retry,clear. Original
selectionState remains after listener setup, with no eager HTTP/clear/refresh.

Main view still constructs ruleConsole after transportConsole; its Profile callback
and the later PathSwitch callback use it lazily. View input Set and owner Map/state
are single per-init instances. No main state/credential hook is added. The old
export declaration becomes const bound to that named function, changing canonical
source/private closure/stack/reflection layout. Ordinary API compatibility is
intended, unverified. Existing rule-flow imports the old name. console-flow reads
old rule/app/Relay source and strips export function into a private VM scope; later
authorized adaptation must also follow canonical Rule owner/native ports, retain
coverage and expose no production auth/state hook. No test was changed or run.

## Assets And Acceptance

Three literal routes/NativeControlConsoleAsset members follow actual imports:
rule-command-owner/public.js,rule-command-owner/service.js,browser-native/rule-
console.js. Existing UTF8 reader/MIME/headers/CSP stay. Chain: app -> old Rule entry
-> owner/public and native/public -> service/native implementation. Recursive web
COPY is only a source declaration; no module load/browser/image run proves it.

Readiness189: original command/CAS/preflight/replay/rejection/stop/retry/refresh/
unknown outcomes.190: native DOM/default/getter/time/UUID/abort/callback order and
old direct/private consumers.191: fixed assets/import graph/MIME/CSP/packaging and
negative boundary/tool adaptation. All and prior cases, including188, remain
planned/unexecuted. No tests/type/syntax/static/boundary checks, formatter,
generator/build/CI/native/MySQL/network/browser experiment, Git write or delegation.
Full A5 candidate/public-version/example and later foundation/physical/release
gates stay open. Source intent is not accepted behavior/equivalence evidence.
