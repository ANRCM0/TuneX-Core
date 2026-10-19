# Control HTTP Native Adapter Source Slice

Date: 2026-10-19. Source authored; no checks or acceptance executed.
Latest continuation: FR-0011 below separates the complete original L3 route
integration from the native Hono/Node/URL provider and names both public entries.
Earlier paragraphs record the preceding four-operation and query slices.

The complete current `api/app.ts` was read through its final Runtime routes and
the positional `createApp` compatibility wrapper before this slice. It remains
the existing HTTP adapter, with explicit public product APIs and the original
ordered middleware/routes. It is not declared a business composition exemption
or accepted as a whole by moving four native operations.

## Actual Calls And Ownership

| Original operation | Canonical source | Caller ownership retained |
| --- | --- | --- |
| Native TLS socket, authorized certificate, fingerprint text | `compatibility/native-control-http.ts` nativeControlClientFingerprint | Existing machine middleware position, context set, telemetry exclusions and Node machine lookup |
| Request stream read, byte limit, lock release, strict UTF-8 | Same file nativeControlRequestBody | Each route's unchanged limit, argument evaluation, parser, identity and product call |
| Native exception and code-prefix mapping | Same file nativeControlRequestError | Hono onError, request ID, JSON field order and status |
| Per-request console asset URL and UTF-8 file read | Same file nativeControlConsoleAsset | Same explicit routes, security headers, status and content types |
| Probe revocation timestamp text | Existing public nativeIsoTime | Same number/type guard, withdrawnAt/null and post-owner projection |

The L2 public entry exports the actual four implementations and the closed
console asset type. No new provider, fallback, clock, route, asset cache, body
normalizer or error vocabulary is introduced. The canonical file is at the same
directory depth as `api/app.ts`; its relative `../../../web/` URL resolves to the
same web directory. Each existing route supplies its original literal asset.
All body/asset reads remain per request. NodePolicy now comes through Node public.

The request reader obtains the original reader once, rejects an absent body,
reads until done, accumulates byteLength before comparing the route's limit,
pushes only accepted chunks, and releases the lock in finally. It retains the
original over-limit error and fatal UTF-8 decode after lock release. It does not
cancel the stream, release early, accept replacement characters or inspect a
content-length header. Reader/release/decode error precedence is original intent.

TLS handling still rejects a non-TLSSocket or unauthorized socket before reading
the peer certificate, then rejects a missing fingerprint256 before colon removal
and lowercase. Telemetry still binds its parsed Node to the fingerprint using
the observation transaction, without the Runtime-pool machine lookup. All other
machine paths retain the same lookup after setting the fingerprint.

Error mapping still reads the message prefix before checking ControlError, then
returns an existing ControlError unchanged, maps SyntaxError/TypeError to malformed
JSON, applies the same original status map, or returns retryable 503. This slice
does not repair or broaden existing classification semantics.

## Complete Entry Reading And Remaining Classification

The source reading includes request lifecycle/maintenance, observation admission,
cookie-free bearer authentication, optional observation identity, telemetry and
service-Probe admission, mTLS, console/health, telemetry/aggregate history, Relay
preview, transport/Node administration, Path/Ingress/Publication routes, Probe
history/plans/permit administration, passive observations, credential rotation,
Probe v1/v2/v3 machine families, Transit and Runtime Hello/Snapshot/Report.
The old positional wrapper still delegates the same options to createControlApp.

Remaining source classification includes Hono and node-server public types,
URL/search/header adaptation and inline closed request projections; middleware
classification/default dependency inventory and the original per-route parser
differences must be recorded precisely. The query source continuation is recorded
below; public owner migration does not prove HTTP/runtime equivalence or the A5
whole-repository import/type/default/legacy removal inventory.

## Original Query Codec Continuation

All fifteen original API query files were read before their source move. Fourteen
paths now exactly alias canonical functions in compatibility/native-http-queries.ts;
the Console path exactly aliases its original two-argument product entry in
console-query-owner/http-query.ts. Hono imports Console public and the other query
functions from public L2. Their canonical function names and original return shapes
remain; neutral lower reference/paging/aggregate records preserve the original
optional-undefined declarations without importing product owner types into L2.

Console's canonical product entry supplies its original kind-to-filter map and
validator to nativeConsoleQuery. The native loop looks up the same map reference
on each original iteration, rejects duplicates/unknown names, calls the product
validator after extraction and before the original page validation. The callback
receives the same kind/filter object at that point; no reverse L2 source import
or lower-owned Console enum policy is introduced.

| Query family | Original distinctions retained |
| --- | --- |
| Console | Duplicate check first, per-kind field names, product filters before pageWindow, page/limit keys explicitly present even when undefined |
| Profile references | Locked revision counters without a new 64 ceiling; pagination follows the original entry loop |
| Tunnel/publication paging | Original distinct unknown/duplicate error texts and mutable query objects |
| Path list/revision/references | Prefix text unchanged; detail revision has no new 64 ceiling, reference revisions retain 64 bound |
| PathGroup references | targetRevision presence refuses before Path reference parsing, then returns original shallow copy |
| Ingress list | Original entry loop then pagination then group ID validation |
| Telemetry history | Only from/to/limit duplicate/unknown parsing; no new pagination or time policy |
| Aggregate | Original Set, own-property duplicate and non-empty checks, then Object.assign; not normalized to the other duplicate parser |
| Audit/Station/Notification/ProbePlan | Original closed names, duplicate errors, insertion order and allowed empty strings |
| ProbeRun | Original resultStatus literals and error at its entry point before subsequent keys |
| Observation revision | Original single-key/duplicate pre-pass then canonical counter capped at 64 |

Readiness113 records unexecuted old/public alias and return-type compatibility,
duplicate/unknown/empty/encoded key order, numeric boundaries, distinct first errors,
mutable/fresh objects and Console callback/map/page timing. Hono/node-server types,
remaining URL/header/inline request projections and complete lifecycle/default
classification remain explicit source work; query migration is not whole HTTP
or A5 acceptance. No tests/tools/CI/build/experiments/Git writes ran.

## Planned Acceptance

All cases are unexecuted. Later authorized same-frozen-source Actions must compare
old/current public entry signatures and middleware order, maintenance/health and
lifecycle failures, unavailable admission before authentication, cookie and bearer
refusal, all four telemetry machine lookup exclusions, mTLS failure order and
fingerprint normalization. Compare absent/empty/streaming body, every route's
original limit and limit+1, multi-byte split chunks, reader/release errors, invalid
UTF-8 and release-before-decode behavior; do not add stream cancellation.

Compare existing ControlError identity, malformed native exceptions, all status-map
codes, prefix errors, unknown retryable 503, response fields/status/requestId,
not-found and unsupported protocol responses. Compare every console asset byte,
relative resolution, repeated reads, missing/read-failed assets, CSP/content types
and request lifecycle. Cover revocation timestamp/null/failure after the original
owner call. No tests, syntax/type/static/boundary checks, formatters, generators,
builds, CI, network/MySQL/browser/container experiments, commits or pushes ran.

## FR-0011: Product Routes And Native Transport Public Entries

The full original app body now lives at `api/routes.ts` under L3 `api/public.ts`
(CONTROL_HTTP_INTERFACE_VERSION1). `api/contracts.ts` contains the original four
aggregate declarations, each consuming explicit owner public APIs and the original
native Runtime family. `api/app.ts` directly aliases both factories through public;
`api/application-ports.ts` directly aliases the four canonical types. These are
the same function objects and service shapes in source, with equivalence unverified.

L2 `compatibility/control-http/public.ts` exposes the original Hono construction,
native environment and result types, URL string/params, context socket extraction
and existing inline format operations. `native-control-app.ts` imports only Hono,
node-server types and local native fingerprint code. It never imports the L3
aggregate service contracts. The separate public transport entry keeps Hono out
of the unrelated general compatibility barrel. L3 route integration imports the
precise native services and types, with no direct Hono/node-server/global URL or
Node socket extraction. It keeps product route names and closed request framing;
all business scope/identity/grant/recovery/CAS/replay policy remains in its owners.
No broad HTTP/L3 dependency exemption or additional composition root is introduced.

| Entry -> source -> provider | Original effects/defaults and removal conditions |
| --- | --- |
| api/public createControlApp -> routes -> nativeCreateControlHttpApp | One new Hono with the exact original HttpBindings and four context variables; no config/native fallback or second service instance |
| api/public createApp -> same routes factory | Original positional order and all optional services/explicit undefined values; requests absent exactly as before |
| api/public NativeControlHttpEnvironment/App -> L2 exact type aliases | Original Hono result stays explicitly native, never relabeled L1; type compatibility must pass on frozen source |
| routes -> nativeControlQueryString/Params | Original new URL at each call, no cache/catch/normalization; query guard/parser still occurs at the original argument or statement |
| routes -> nativeControlRequestFingerprint -> original native TLS check | Same context.env/incoming/socket optional reads and exact unauthorized/missing cert/normalization errors; original machine exclusions afterward |
| routes -> nativeControlSessionEpoch | Same truthy/decimal/counter tests, Number read stages and 409 text; original caller header/body/boot ordering |
| routes -> nativeControlConsoleHeaders -> supplied context.header | Four headers in original order with same receiver; route then reads its original asset per request |
| routes -> nativeControlProbeWithdrawal | Post-owner id/state/false/withdrawnAt projection with original in/type/second-read/ISO/getter/error stages; no independent revoke/clock |
| server -> api/public | Same control/runtime/authority/requests and thirteen optional services; HTTPS listener/TLS/default host/startup/close code unchanged |

Observed remaining old app consumers are the existing Console serving/MySQL,
Forward Probe/API/MySQL, Node observation MySQL, Path binding/template MySQL,
Probe claim/delivery/instance/negotiation/ports/result, rule-command, Transit,
Transport-query and Tunnel-query test sources plus check-boundaries.mjs. These
were identified by source search only, not run or adapted. Keep aliases until all
actual callers/tool rules migrate and corresponding frozen-source checks pass;
this observed list is not full-repository consumer proof.

### Middleware And Lifecycle Order

Registration order remains global requestId/Cache-Control -> optional lifecycle
wrapper -> maintenance admission/action -> the original family-specific admission,
bearer/observation identity and machine middleware -> route. The global action
skips authority.allow only for /health. It remains inside requests.run when supplied;
there is no newly mandatory lifecycle option or shutdown bypass. onError and
notFound retain original requestId/error/body/status projection.

Observation service, ProbePlan, Probe history, Notification delivery/endpoint and
Station selection retain original regex/first-match order and unavailable error.
Cookie refusal precedes bearer authentication. Observation identity is selected
only for the original path families; normal routes use control.identity. Machine
Service Probe query refusal precedes native fingerprint; four telemetry paths skip
the initial Node machine lookup and retain their same observation-Tx authorization.
Transit boot header validation remains before epoch/body and owner invocation.

RequestLifecycle still counts actual application completion in finally. The server
stops request/task admission, closes connections, awaits task/request/server settles,
then closes original secrets/observation/main databases. HTTPS startup failure
retains original cleanup. No new timeout, timer or socket-completion substitution.

### Route Framing Kept At The Product Integration

| Original route families | Representation/owner distinctions retained |
| --- | --- |
| Console, health, agent/v2 | Same asset paths/security/content types, maintenance response and protocol3; original unsupported protocol409 framing |
| Four telemetry ingest families | Same unavailable guard/query test, body8192 except Forward65536, parse before ingest argument evaluation, no extra machine lookup |
| Telemetry/aggregate/history/diagnostic/audit/station/notification | Original per-family query codecs and unavailable/body guards, same optional services and actor selection |
| Transport/Endpoint/Node/Relay/catalog/Tunnel | Same individual closed fields/counter/ID/casts/32768 credential or Relay body bounds and product APIs; no generic input hardening |
| PathTemplate/Group/binding and native Tunnel binding | Same 8192/1024 limits, original per-action counters/object predicates, preview/apply bound methods and idempotency headers |
| Path publication and Ingress deployment/migration | Same 16384 create/preview and 1024 action/cancel limits, original field projection, position regex (Path1..10, Ingress1..8), previewDigest and same owner transactions |
| Probe history/plan/permit/admin | History detail checks queryParams.size; other original no-query guards check queryString. Missing guards stay missing. Plan8192/command1024, empty revoke validation and original withdrawnAt projection |
| Passive observation, Forward CRUD/operations and management | Same body-default1MiB/1024 distinctions, request signal, original loose/closed predicates, method receiver/response status and owner authority |
| Agent Probe families/Transit/Runtime | Original parser variants, limits4096/8192/default, session/boot/header evaluation order; no new issuance, wire version or command authority |

Every original URL expression is now the equivalent L2 string/params operation at
the same site; no shared early guard broadens refusals. This preserves the original
search versus size distinction and invalid native URL error mapping. All inline
request field projections are product HTTP framing in L3, not SQL/Runtime policy.
Native body/TLS/error/asset implementations from the earlier slice remain single
canonical implementations.

Readiness135-137 are planned/unexecuted: factory/types/aliases/options, exact native
formats/getters/errors and complete route/middleware/lifecycle/owner equivalence.
No tests/checks/formatters/generators/builds/CI/experiments/Git writes/delegation.
Server/CLI native composition, remaining Agent and complete source/type/default/
private/consumer/removal/frozen candidate inventory remain open; this slice is not
full HTTP, A5, foundation or public Runtime-example acceptance.
