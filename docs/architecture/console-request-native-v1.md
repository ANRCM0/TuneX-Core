# Console Request Coordination And Native HTTP v1

Date: 2026-10-19 (Asia/Shanghai). FR-0020 source implemented, unverified.

| Source relative to apps/web | Public contract and owner |
| --- | --- |
| console-request-owner/public.js | CONSOLE_REQUEST_INTERFACE_VERSION1 and createConsoleRequests |
| console-request-owner/service.js | L3 connection/result/unknown-outcome coordination and one pending-key Map |
| browser-native/public.js | Existing BrowserNative1 plus browserConsoleRequestEffects native HTTP/abort/JSON/error/UUID callbacks |
| app.js | Existing index-selected composition binds state/request/native/model/Console callbacks |
| browser-native/control-console.js | Original native view owns unchanged ephemeral auth/connectionVersion and reset sequence, supplies lazy state reads |

The L3 factory receives state.scope()/token()/version() and effects. It calls no
state reader/effect at construction: it creates the original Map and defines
connected/request/mutate/clearPending. Original named request/mutate signatures
remain. The owner has no native/browser/product-private imports and no credential
copy, version increment, client, timer or persistence. The native file imports no
product owner. Outer product callbacks execute through supplied ports, not reverse
source imports. Auth remains page memory, not an independent server authority.

## Original Request Stages

1. connected checks scope then token with the original short circuit/message.
2. Capture connection version, then call native send with the same arguments.
3. Native builds Bearer/Accept, optional content/idempotency headers, then evaluates
   fetch endpoint and options in original order. scope/token are read lazily at
   those positions. Omit credentials, no-store, redirect error, no-referrer, default
  15000ms timeout, composed caller signal and optional JSON body remain original.
4. Native send returns fetch directly, with no extra async wrapper or await. The
   owner awaits that promise, then readJson(response) inside the original catch.
5. Invalid JSON retains its original error before any stale/abort/status decision.
   After JSON, compare current version; stale rejection precedes caller abort.
6. Native caller-signal check precedes original response.ok/status/error rendering.
   Message fields, Chinese separator, httpStatus and malformed-result behavior are
   unchanged source intent; there is no new optional guard/normalization/catch.

Native global functions remain dynamic at use, not cached at factory setup. No
request is added, retried, accepted or returned early by moving the code. Exact
callback/property/error/async ordering still requires matching-source acceptance.

## Original Pending-Key Behavior

mutate first native-serializes [method,resource,input], even before the connected
check. If absent, generate/store one native UUID; otherwise reuse the Map key.
Call the same request, delete only after success and return its result. All
transport/JSON/stale/abort/HTTP errors retain the original key. The explicit
connection reset clears the same Map at its original position; it never revokes
or rolls back a remote command. No timer, retry loop, automatic recheck, scope in
signature, input clone/freeze, key rotation or new concurrency semantics.

Same-signature concurrent calls still share their existing key; each original
success can delete it. Input is still serialized separately for signature and
request body. This source move does not add an atomic queue or mutable-input
guarantee. Child consoles keep their own explicit one-command/batch replay rules.

The native main view calls createRequests at the old Map allocation site with
lazy getters to the same auth/version variables. The later let initialization
still precedes any request because the factory does not read those closures.
clearConnectionData keeps version increment, reader invalidation, secret/editor/
overview resets, pending clear and every later UI/Console reset in original order.

## Public Entry, Assets And Acceptance

The original app remains the only index module invocation; child constructors
receive the same connected/request/mutate callbacks, options and result/error
objects. App has no new named exports. Function declaration/source/stack identity
is different and private reflection/source assertions are not promised.

Two fixed owner module assets, plus the three native view/Relay modules covered
in console-browser-composition-v1.md, are declared in Control's native asset union
and explicit routes with original MIME/CSP/headers/reader. Native public reexports
define functions without mounting the DOM; existing model-only imports are intended
to remain usable without invoking a view. No import/browser/build check ran.

Readiness181-183 planned/unexecuted: state/native/getter/error/async/default stages,
unknown result/key/concurrent/reset behavior, real asset/import/view consumers.
No tests/type/syntax/static/boundary checks, formatting/generation/build/CI/native/
network/MySQL/browser experiments, Git writes or delegation. Other Web files and
the full source/type/private/consumer/assets/candidate gates remain open.
