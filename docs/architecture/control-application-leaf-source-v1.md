# Control application and HTTP leaf source closure

Date: 2026-10-19. Bounded source read/edits only. No tests, type/syntax/static/
import/boundary checks, formatters, generators, builds, CI, network/native/MySQL/
browser experiments or Git writes ran. Source ownership below is separate from
unexecuted behavior/contract acceptance and does not accept the whole foundation.

## Exact covered scope and result

Covered current top-level apps/control/src/application/*.ts except control.ts,
the current apps/control/src/api/ leaves/contracts/public/routes, and the three
explicit old readers mysql-console-read.ts, mysql-transport-read.ts and
mysql-tunnel-read.ts. Application control.ts, canonical modules, native adapters,
framework, server/bootstrap/main/client and shared documents were not modified.

The current application leaves contain precise canonical owner exports, shared
framework/native compatibility exports, the old requestIdentity forwarding function
and MANAGEMENT_READ_MODEL_INTERFACE_VERSION. They contain no remaining duplicate
command/query coordinator or copied DTO implementation in this covered scope.
Their private canonical-leaf reexports are explicit old-path compatibility bridges,
not new ordinary consumers bypassing public owners. Replacing their selective or
star exports with whole-owner barrels would risk changing the old export surface
or runtime dependency evaluation, so this slice retains those exact export sets.

The active HTTP contracts already consume public Identity/Node/Transport/Endpoint/
Relay/Transit/Forward/Console/ControlQuery/Tunnel/Native/Path/Ingress/Probe/Telemetry/
Diagnostics/Audit/Station/Notification/History/Plan/Observation APIs. The HTTP routes
consume these local HTTP contracts, public NodePolicy, public native Runtime machine
and HTTP/native codec/query effects, public Core/framework and Console public query
rules. There is no missing cross-owner private type declaration to move or duplicate
in those active HTTP contracts. No application/API runtime source edit was needed.

The concrete remaining ordinary old-type consumers were the three old reader
compatibility assemblies. Their ConsoleReadPort/ConsolePaging/ConsoleFilters,
TransportReferenceReader and TunnelReadPort references now target existing owner
public entries, selecting the very same canonical declarations. This is the only
runtime-source-file edit in this slice and is type-only.

## Bounded compatibility bridges and actual consumers

| Old entry or bridge | Canonical owner/shape | Consumer and preservation decision |
| --- | --- | --- |
| application/console-query.ts and console-query-contract.ts | Console rules/contracts leaves | mysql-console-read keeps the original value/rules bridge; its type imports now use Console public |
| application/management-read-models.ts | Same Console/Transport/Tunnel read-model classes, original version constant | All three old readers retain their original class value imports and module-level reader construction |
| application/transport-query-contract.ts and tunnel-query-contract.ts | Transport and Tunnel query contracts | mysql-transport-read/mysql-tunnel-read now consume owner public types directly |
| application command/query/service/API/storage-value leaves | Existing exact canonical owner leaves | Existing old application import consumers keep export names, function/class identity and selective/star surfaces; active HTTP contracts use public owners |
| application/probe-history-api.ts | Original history API plus original finite-plan API types | Both exact canonical type sets remain, rather than broadening to either full owner barrel |
| application/ports.ts, errors.ts, request-lifecycle.ts and background-tasks.ts | Existing framework/native public contracts/implementations | Existing old callers keep original names and compatibility default/provider behavior |
| application/command-request.ts | Original requestIdentity function -> public nativeCommandRequest -> original L1 request builder | Its original function name/arity/forwarding identity is retained, rather than changing it to a different function alias |
| api/app.ts and application-ports.ts | HTTP public create functions and local canonical HTTP contracts | Existing server/test/old HTTP callers retain their original names; no new service DTO or constructor |
| api/*-query.ts aliases | Console owner query or original native-http-queries leaf | Old helper consumers retain exact function identity; active routes use public Console/native helpers |

The three MySql*Reader classes are pre-existing legacy assembly bridges, not the
canonical lower SQL stores. They retain their implicit zero-argument constructors,
original public async methods and module-local singleton reader. The Console reader
still binds one MySqlManagementReadStore with nativeReadProjectionValues.now and
the original validateConsoleFilters, plus the same values object. Transport and
Tunnel readers still bind their original stores with the same values object.
Every call still forwards tx/actor/scope/node/profile/paging/filter/revision/now in
the original order to the same reader receiver; return shape, null/undefined and
Promise wrapping remain unchanged. No store/transaction/schema/business rule moves.

Type-only imports do not change module initialization. In particular this slice
does not replace the management-read-models and console-rules value imports with
broader owner barrels whose eager dependency order differs. Compatibility readers
can be removed only after their remaining old consumers migrate to the original
explicit public reader/store assembly and corresponding compatibility acceptance.
No additional ordinary implementation should use these old assembly bridges as a
precedent for private owner imports or L2 SQL-to-product coupling.

## HTTP behavior preserved and planned acceptance

No route, body/query codec, context type, authentication selector, middleware order,
service admission, mTLS/fingerprint/epoch, request budget, error projection, status,
DTO, idempotency-key mapping or createApp positional default was edited. Active HTTP
remains a product coordinator over public services with native HTTP effects, not
a new composition root or independently owned transaction/authority. The old API
aliases remain precise and all current product contract imports are public.

Planned, unexecuted cases for the three type-source edits are exact public/legacy
declaration assignability, unchanged constructor/method surfaces, old/new class and
validator identity, original module-level reader count/provider binding, identical
Tx/argument/receiver/return projection, old zero-argument callers and selective old
exports. Existing HTTP contract/public-entry cases must still validate the same
frozen revision, including middleware/authentication/error/admission order and
legacy createApp behavior. Those runtime cases were not rerun or inferred here.

Within the exact covered application/API scope, source leaf ownership and explicit
compatibility-consumer classification are now recorded; no unassigned ordinary
cross-owner private type consumer remains identified there. The only retained
cross-owner canonical private paths are the precise old compatibility reexports
described above, and the reader value bridges deliberately preserved for original
initialization. Their removal is a future consumer migration, not unfinished source
extraction hidden behind a package exemption. Behavioral/type/boundary acceptance
remains unexecuted; control.ts and other agents' scopes are outside this result.
