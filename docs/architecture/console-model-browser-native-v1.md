# Console Model And Browser Native Effects v1

Date: 2026-10-19 (Asia/Shanghai). FR-0019 source implemented, unverified.

apps/web is shipped production JavaScript, not an independent npm package or a
test fixture. Control serves its fixed assets. Existing model.js claimed pure
helpers but directly read Date.parse/Date.now and built URLSearchParams. This
bounded move separates those operations without changing UI or server authority.

| Entry relative to apps/web | Responsibility |
| --- | --- |
| console-model-owner/public.js | CONSOLE_MODEL_INTERFACE_VERSION1, seven pure helpers and createConsoleModel |
| console-model-owner/service.js | Original UI input/capability/spec/state/page/candidate rules with explicit native effects |
| browser-native/public.js | BROWSER_NATIVE_INTERFACE_VERSION1, native credential time and URL query representation |
| model.js | Original ten-export compatibility/composition entry, binds the same native effects |

Old exports are validScope, parsePorts, parseCidrs, directCapable, allowedProtocols,
directSpec, stateTone, pageCount, listResource and candidateChoices. The seven pure
helpers are direct public aliases; createConsoleModel returns named directCapable,
directSpec and listResource functions. Original function arguments/defaults, mutable
results and arrays, errors and UI limits remain source intent. Old module path
and export collection are retained; function declaration/source-file identity is
different, so source-text/reflection assumptions require explicit review.

## Effect Order And Original Rules

The native effects contract is credentialActive(readValue) and
listResource(kind,page,filters). The factory receives an explicit effects object
without new validation, fallback, cloning, freezing, cache or time read.

directCapable keeps revoked/capability/listener/ports short-circuit order and the
first credentialUntil===undefined read. If present, it supplies a getter thunk to
the native effect. Date.parse(readValue()) resolves Date.parse before reading the
second credentialUntil, then invokes Date.now after parse, as before. Invalid time
still consumes the Now sample and yields false; absent credential text avoids both
native calls. Providers read globals dynamically, not at module initialization.
This is UI availability filtering, not authorization or a guarantee of actual time.

directSpec calls the same bound directCapable first, then original protocol,
String/Number/form reads, allowed listener/port, target checks and output shape.
It adds no native driver/assignment/permission. allowedProtocols, port/CIDR/scope
checks and candidate pinned/page bounds retain their original distinct rules;
server Core, policy and permission checks remain authoritative.

listResource rejects its original closed kind/page range before calling native.
The native effect creates URLSearchParams with page then limit25, iterates filters
in original order, skips only empty strings, applies String and returns
kind+'?'+query. Full concatenation/URL representation stays in L2, including native
primitive conversion. No query key normalization, policy, new bound or error catch.

The owner imports no browser globals, DOM, native adapter, TS Core source or product
server class. The native effect file imports no product owner. model.js is the
existing composition; new consumer modules use owner/public and supplied effects.
Existing direct/Relay UI consumers keep model.js without private source access.

## Actual Asset Delivery And Consumers

Control's existing NativeControlConsoleAsset union and api/routes.ts add exactly:

- console-model-owner/public.js
- console-model-owner/service.js
- browser-native/public.js

Each has a fixed /console/ path, original consoleHeaders, text/javascript MIME and
the same native file reader. No wildcard/request-derived path or new security
header/CSP/connect/credential behavior. /console/model.js imports relative public
and native entries; public.js reexports service.js. Existing index/app/Relay model
imports stay on model.js. New files are actual served dependencies, not merely
Node-only source modules that would fail through the old asset list.

Source packaging was also read: deploy/Dockerfile.control recursively copies
apps/web and apps/control, including these new module directories; .dockerignore
does not exclude their paths. No image/build/import smoke or browser request was
run. COPY source declarations are not a built-image distribution acceptance result.

Known direct consumers read in this slice: app.js and relay-model.js; existing
model/relay-model tests and Console flows use the old names. Remaining Web files
are named in foundation-source-root-catalog-v1.md and require their own complete
policy/DOM/native/consumer classification; this slice is not whole-Web closure.

Root test:web syntax checks list older fixed JS paths; check-boundaries scans
TS/Go for its current generic roots, not all browser JS. Later authorized acceptance
must cover the real new import/assets/type/consumer graph and negative cases, not
rely on those historical lists. No test/check tool was changed or run here.

Readiness179-180 planned/unexecuted: compare old/new helpers, injected and native
clock order, queries/getters/form errors/arrays, actual fixed asset routes/imports,
MIME/CSP and existing browser flows. Functional/browser evidence belongs in later
authorized Actions. No tests/checks/formatters/generators/build/CI/browser/native
experiments/Git writes/delegation. Full A5/candidate/example and later gates remain.
