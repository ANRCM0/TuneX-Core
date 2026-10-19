# FR-0011: Explicit Control Native HTTP Entry And Formats

Date: 2026-10-19 (Asia/Shanghai).
Status: **implemented-unverified; authorized-under-standing-source-scope**.
Owner: existing L3 Control HTTP route integration and L2 native transport. The human's
standing source authorization of 2026-10-19 permits this proposal to proceed without
repeated confirmation. Verification, Git and release gates remain separate.

## Task Proposal

1. Layers: L3 route integration/aggregate service contracts; L2 Hono/Node/URL/formats.
2. Consumed public interfaces: existing owner public APIs, NativeRuntimeMachinePort,
   L1 RequestLifecycle.run, Core ID/counter and public native codec functions.
3. Foundation impact: additive HTTP interface1; original Hono/HttpBindings shape,
   options, routes, service authority and L0/L1 interfaces unchanged.
4. Contracts: L3 api/public.ts exposes createControlApp/createApp and the exact original
   input and native result types. Old app/application-ports paths directly alias
   canonical implementations/contracts. Three existing inline format operations
   become native functions with the same evaluation and refusal stages. L2 exposes
   the actual Hono factory/types and URL operations without importing L3 contracts.
5. Acceptance: planned exact-source alias/type, route/error/header/projection and
   authorized Actions HTTP/identity/lifecycle equivalence. Nothing executed now.
6. Parallel impact: server uses the public entry. Old callers remain on aliases;
   no new module transaction, state owner, execution default or composition root.

## Why Current Extensions Are Insufficient

The current app mixes L3 product route integration with direct Hono/Node/URL types
and construction. Its aggregate contracts depend on L3 public APIs, so moving the
whole app to L2 would create reverse source/type dependencies. Keep the original
route integration L3 and consume the Hono factory/types and URL operations through
public L2 services. No general L1 transport layer or widened dependency exemption.
Existing native-control-http already owns TLS, body, error and asset formats. Reuse
that owner for the original session text, Console headers and withdrawal response
rather than duplicating those operations or moving business authorization to L2.

## Impact And Compatibility

Move the complete original route implementation to api/routes.ts, keeping its
relative imports and registration order. Move the original service declarations
to api/contracts.ts; the old path reexports all four original types. api/public.ts
exports CONTROL_HTTP_INTERFACE_VERSION=1, both original factories, those four types
and NativeControlHttpEnvironment/NativeControlHttpApp. The named environment is
exactly original HttpBindings and actor/node/requestId/fingerprint variables; the
app type remains Hono of that environment. These two types are defined by L2
compatibility/native-control-app.ts and reexported explicitly. That L2 file imports
only Hono/node-server and native helpers, never the aggregate L3 contracts. L3
constructs through nativeCreateControlHttpApp, reads native query string/params
through pure L2 functions and extracts the native socket fingerprint through L2.
Expose this native transport at compatibility/control-http/public.ts, avoiding an
eager Hono import from the general compatibility/public.ts barrel used by unrelated
services. Existing helper formats remain additive on the original native barrel.

nativeControlSessionEpoch keeps the original empty/decimal/counter tests, two
Number conversions on success and exact SESSION_SUPERSEDED 409 error. Calls stay
at the original argument position after earlier argument evaluation; do not cache
headers or parse ahead of body/boot validation. nativeControlConsoleHeaders calls
the supplied object's header method four times in the original order and receiver.
nativeControlProbeWithdrawal projects id, state, false and optional ISO exactly at
the old post-revoke stage. Preserve the in/type/second-read getter behavior and
Date conversion; do not pre-read withdrawnAt or grant/revoke authority.

No generalized query rejection is introduced. Each route retains new URL at its
original stage through L2 query functions, including search versus searchParams.size,
and routes that have
no explicit query guard remain so. Route shape/body checks stay transport framing;
public owner APIs retain all authentication, scope/recovery/grant/CAS/replay rules.

The original global middleware sets requestId and Cache-Control before entering
optional RequestLifecycle.run. /health skips authority.allow only; other routes
retain original admission. Optional service admission precedes bearer auth. Cookie
refusal, observation-auth selection, Service Probe query refusal, TLS fingerprint
and machine owner calls stay in order; telemetry retains same-Tx identity binding.
No SQL, wire/schema/protocol, authority, ledger, Journal or protected history change.

## Migration And Version Plan

Server imports api/public.ts. Existing tests/tools/other direct app imports keep
the same factory object through a direct alias; no wrapper instance or fallback.
Old application-ports imports keep the same canonical declarations. Compatibility
interface1 stays additive, new HTTP owner interface1 names the actual native API.
Remove aliases only after actual callers and later authorized boundary/type/route
acceptance are migrated on the frozen revision and removal is separately recorded.
No rollback/history/data migration is required or implied.

## Acceptance And Known Limits

135 planned: named environment and factories equal original native types; options
and positional createApp order including all optional services/undefined/default
requests; function aliases and server composition, no independent Hono app/state.
136 planned: session empty/zero/sign/whitespace/decimal/overflow/counter bounds and
method/getter/throw stages; Console exact four headers/order/receiver and per-request
asset read; withdrawal absent/null/non-number/number/getter/error/ISO/key order.
137 planned: route registration and original query/body/error precedence, middleware
admission/auth/TLS, disabled service and machine guards, owner transaction/replay,
health and unsupported protocol framing, request drain through socket disconnect,
startup cleanup and shutdown. Functional evidence requires authorized Actions.

All cases remain unexecuted. Full HTTP/server/Agent/repository source/type/private/
default/consumer/removal/freeze classification and public Runtime example remain
open. This concrete extraction does not establish A5 closure or foundation acceptance.
No checks/tests/formatters/generators/builds/experiments/CI/commits/pushes/delegation.

## Source Authorization And Acceptance Gate

Record this design before implementation, implement under the standing source
instruction, then mark authored/unverified. The frozen candidate and later exact-
source verification permission remain required for acceptance.
