# FR-0019: Console Model And Native Effects

Date: 2026-10-19 (Asia/Shanghai).
Status: implemented-unverified.
Owner and authorization: existing browser Console and Control HTTP asset owners;
human's standing2026-10-19 source authorization, proposal recorded before code.
No tests/checks/generation/build/CI/browser experiment or Git operation authorized.

## Task Proposal

1. Layers: L3 console-model-owner product helpers; L2 browser-native time/query
   representation; existing model.js composition/compatibility entry and fixed
   Control native asset serving. Core/L0/L1 remain unchanged.
2. Consumed public interfaces: original ten browser model functions, fixed
   NativeControlConsoleAsset/nativeControlConsoleAsset and existing Console HTTP
   routes/headers. The browser owner takes explicit native effect callbacks.
3. Foundation impact: additive browser public candidate1 and native effects1;
   extend the L2 asset name union/routes with three explicit internal JS modules.
   No existing endpoint, bearer/token, authorization, protocol or timing policy change.
4. Contracts: keep original model.js named export set, bound default behavior and
   all existing imports; new public.js exports pure helpers and createConsoleModel.
   Native effects preserve Date.parse(value)>Date.now() and URLSearchParams body.
5. Acceptance: planned179-180 on an exact source, old/new function behavior/default/
   short-circuit/errors/Clock/URL/assets/CSP and browser consumers. None executed.
6. Other modules: no UI features, DOM/layout/style changes, new execution/permission
   or Core duplication. Other Web sources are pending individual classification,
   not exempted or assumed L2 by belonging to the browser directory.

## Why Current Extensions Are Insufficient

The existing model.js claims pure helpers but directly reads a native clock and
formats external URL queries. It is shipped by Control as actual production JS,
not an acceptance-only fixture. Move those two native operations to a public L2
browser owner and keep policy/validation in a product owner with explicit effects.
Do not label the whole browser package a pure L0 model, L1 contract or L2 adapter.

Core's public TypeScript source cannot be newly imported by this raw browser ESM
delivery without a separate build/delivery change. Preserve existing bounded UI
input checks, which are not server authorization or a duplicate authority, rather
than introducing a new Core export/bundler/domain implementation in this slice.

## Impact And Compatibility

Original model.js exports remain validScope/parsePorts/parseCidrs/directCapable/
allowedProtocols/directSpec/stateTone/pageCount/listResource/candidateChoices.
Its three effect-dependent functions are bound once to native callbacks, which
read Date/URLSearchParams dynamically when called. Keep function names/arguments,
filters default, mutable result/array shape, Chinese error text, short-circuit and
evaluation order. Function source text/declaration file identity changes; reflective
or source-text assumptions are not promised. No existing consumer edits required.

directCapable only parses time/reads Now after every original policy requirement,
and only when credentialUntil is present; Date.parse occurs before Date.now even
for invalid text. directSpec calls that same bound predicate at its old first stage.
listResource rejects invalid kind/page before constructing URLSearchParams and
then retains original filter iteration/String conversion/encoding/order. No added
normalization/guard/catch/freshness cache/default time sampling.

New fixed assets: console-model-owner/public.js, console-model-owner/service.js and
browser-native/public.js. Their routes use the same consoleHeaders, content type
and explicit native file reader. No wildcard/request-derived filesystem path,
directory listing, new CSP/connect permissions or API credentials are added.
index.html/app.js/relay-model.js retain original import paths through model.js.

## Migration And Version Plan

Introduce console model contract1 in owner/public.js and browser native interface1.
Move existing pure functions and the two dependent chains to service.js, then bind
native effects at original model.js. Add exactly three union members/fixed routes
needed for those relative imports. Keep old module path/export collection until
all actual consumers and accepted matching-source import/behavior cases migrate.

No L0/L1/DB/Journal/Authority/native driver/ADP/Probe versions or state change.
This creates no protected-history migration, rollback/reset, transaction, timer,
background polling, token persistence, client cache or server trust decision.
Do not freeze/accept the whole browser or repo based on this bounded move.

## Acceptance And Known Limits

179: all ten old exports, invalid/capable/expired/absent/NaN credential paths,
parse-before-Now and lazy clock counts, bound directSpec first-error, port/CIDR/
protocol/input/result behavior; list guard/default/filter order and URL encoding;
candidate bounds/pinned selection, state tones/page count and existing direct/Relay
consumers. No test runs or new test/CI tooling in this source phase.
180: actual Control fixed asset list and relative ESM import chain with exact
MIME/CSP/security headers/unknown route behavior, existing Node import consumers,
supported browser behavior and original UI requests/credentials. Functional/browser
acceptance belongs in later authorized Actions. No claim of current runnable UI.

Core/tool/root inventory177 and independent bootstrap178 are separate source
slices, not evidence of this browser acceptance. Full Web policy/DOM/HTTP/type/
asset/consumer classification and complete A5 candidate remain open.
