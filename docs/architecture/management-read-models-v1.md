# Management Read Models v1

Date: 2026-10-18 (Asia/Shanghai). Source candidate, unverified and not accepted.

## Ownership

- L1 management-read-ports declares raw storage rows, a page window, read selectors,
  opaque filter strings, injected validation/time and supplied-transaction stores.
  It does not own Console/Profile/Tunnel DTOs, provenance, permissions, health or
  product response flags. Unknown stored JSON stays unknown until the original
  projection/validation point; these rows do not certify retained data.
- L2 mysql-management-read owns the original SELECTs, parameters, predicates,
  ordering, limits and driver rows. It imports L1 contracts, not application types
  or executable helpers. No connection pool, transaction, retry, write, authority
  or new query capability is introduced.
- L2 mysql-read-pagination retains consolePageSql's bounded-integer checks and
  LIMIT/OFFSET interpolation. All other values remain bound. Native projection
  values encapsulate existing stored JSON reads, wall-time observation and ISO
  formatting; iso(at) and currentIso() are separate so undefined input is not
  silently treated as the current time. These are not Guard or lease clocks.
- L3 management-read-models owns the old Console, Profile-reference and Tunnel
  projections. It consumes public query DTOs and injected L1 stores/values; no SQL,
  mysql2, JSON parser implementation, global time read or platform branch is here.
  Its constructor has no hidden native defaults. Query applications still authorize
  and invoke it on the same existing transaction.

Both new interface families are source-candidate version 1. Existing public query
interfaces and product DTOs remain unchanged. ConsolePaging/Filters/ListKind retain
their original shape through lower raw page/filter/selector declarations.

## Synchronous Projection Contract

Each raw store receives a trusted synchronous projection. It invokes it exactly
once after the last SELECT, before returning, without awaiting, retaining or
retrying it. The callback performs the original projection only, not asynchronous
work, authorization, another transaction or cross-owner writes. Exceptions propagate
through the same caller transaction and existing error mapping.

Filter validators and projection callbacks are trusted synchronous providers;
an async validator or a thenable projection result is outside this contract.
Composition supplies plain synchronous functions, not user-selected executable
callbacks. The interface is not a sandbox or a new runtime policy engine.

This is an injected outward callback, not a reverse source import: L2 knows raw
rows and the callback signature, not the L3 class/DTO. The arrangement keeps JSON,
number/boolean/ISO conversion and observation effects at the original SQL-return
point rather than adding an intervening asynchronous projection boundary. Matching
behavior, exception and event-loop ordering still requires exact-source acceptance.

Console raw SQL receives the original filter validator and observation callback
from the existing composition root. It calls them at the old predicate points,
including two Forward observation samples and both count/page filter validations.
Candidate capability selection stays in L3 before those reads. No extra filter
snapshot, normalization, enum policy or implicit latest reference is invented.

Preserve count-before-page reads, original count/page argument choice, deterministic
ordering, binary/JSON reference filters, four-row peer selection, explicit caller
time for peer windows and read-committed (not global snapshot) semantics. Raw/query
projection does not grant execution or establish independent health, certificate
verification, physical reachability or deletion safety.

## Composition And Compatibility

ControlApplication remains the existing composition root. It explicitly binds
the three L3 projection services to their L2 stores and native values, and retains
the original ConsoleQueries/TransportQueries/TunnelQueries authorization workflow.
New consumers use public ports; do not treat legacy construction as a service locator
or permission to import application implementations from a new storage adapter.

MySqlConsoleReadModels, MySqlTransportReader and MySqlTunnelReader remain old-path,
zero-argument compatibility classes. Their prototype methods delegate to stateless
default-provider projections; they contain no copied SQL/projection and acquire no
private class fields that would make formerly structural fake implementations
nominal. Default bindings allocate provider objects only, not a pool, cache, work
queue, clock sample or database query. Their outward imports are classified precise
legacy bindings, not newly accepted L2 modules or additional composition roots.

The old mysql-console-read consolePageSql export aliases the one lower helper;
production SQL consumers import mysql-read-pagination directly. Old classes/helper
cannot be removed until callers have migrated and exact frozen-source compatibility
acceptance plus the normal change process authorize removal.

## Unexecuted Acceptance

Foundation readiness item 28 covers raw/store/projection substitution, SQL and
parameter/order traces, single synchronous callback and errors, native JSON/time/
format behavior, caller transaction/authorization, DTOs, legacy structural classes
and helper identity/import effects. Remaining mixed adapters and whole-repository
classification are separate work. No check, test, build, database/browser/network
experiment, CI, commit or push has run for this slice; the foundation/parallel gate
remains closed.
