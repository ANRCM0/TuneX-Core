# Console query owner candidate

Date: 2026-10-19. Source authored only; acceptance is planned and unexecuted.
This dirty source slice is not a frozen revision or an opened module gate.

## Ownership and source chain

`apps/control/src/modules/console-query-owner/public.ts` exposes the original
ConsoleQueries, ConsoleReadModels, filter/page rules and existing version-1
contracts. No second query implementation or state owner is introduced.

HTTP console query parsing consumes public owner rules. The original chain is
HTTP parameters -> closed filter validation and pagination -> ConsoleQueries ->
the supplied authorization/transaction boundary -> ConsoleReadModels -> required
L1 ManagementReadStore -> original MySQL read store -> original owner tables.
The store synchronously invokes product projection callbacks. SQL remains with
the existing adapter; this owner contains read coordination and product views.

The composition root continues to supply the existing ManagementReadStore and
ReadProjectionValues explicitly, including nativeReadProjectionValues and the
same validateConsoleFilters function. There are no new defaults, clock sources,
transactions, authority records or execution services. Integrated Control and HTTP bindings now use
this public entry for ConsoleQueries, ConsoleReadModels and validateConsoleFilters,
and its ConsoleQueryApi type in api/application-ports.ts.

## Ordering, mutability and compatibility

List methods compute paging, copy/freeze filters and validate before entering the
authorization transaction. Candidates require management authorization; other
reads use the original read authorization. Diagnostics validates its Node ID
before authorization and retains the original projection-level validation.
Authorization and store reads use the same supplied transaction.

The filter-name object and nested arrays retain original runtime mutability;
Readonly remains a type declaration. Page/results and DTO fields retain their
existing mutable shapes. The page/limit defaults remain owned by L1 pageWindow.
No extra freezing or validation is added. Candidate mode defaults to direct;
capability lists preserve original order and protocol expansion. Views remain
persisted facts with independentProbe:false, fullPlanAuthorization:false and
reserved:false where originally present.

Original Number/null/Boolean/JSON mappings remain in the same projection callbacks.
Overview samples currentIso inside its store callback. Diagnostics samples now
inside its callback, bounds projected failures to 50 and retains age/lease rounding,
the Chinese explanatory note and the original missing-resource error. No clock
sampling moves to an earlier authorization or storage step.

Old application/console-queries.ts, console-query.ts and console-query-contract.ts
are precise leaf aliases. The mixed management-read-models.ts directly aliases
ConsoleReadModels while retaining original TransportReferenceReadModels and
TunnelReadModels implementations. Legacy constructor identity and prototype methods
therefore refer to the same canonical class, not wrappers or copied implementations.
MANAGEMENT_READ_MODEL_INTERFACE_VERSION remains at the old mixed entry as before;
CONSOLE_QUERY_INTERFACE_VERSION remains 1 at canonical and compatibility entries.

## Planned acceptance and remaining scope

After verification authorization, cover old/new class and export identity, callback
timing and binding, required-provider behavior, same-transaction authorization/read,
candidate management refusal, pagination defaults/limits, filter enum/ID rejection,
duplicate/unknown HTTP parameters and validation/refusal order. Cover mutable filter
names/results, copied frozen input filters, candidate mode/protocol capability order,
null counts/JSON/Boolean/time projections, missing diagnostic nodes, error filtering
and the 50-entry bound, age/lease rounding and the exact original informational flags.
Functional/MySQL/HTTP evidence belongs to GitHub Actions on the authorized frozen
revision; no checks or tests ran for this source slice.

Control/Transport/Tunnel queries, their remaining projections, NativeDrivers,
NativeTunnels, access/Node/Profile/Forward commands, HTTP route chains and complete
source/type/default/compatibility classification remain separate open source work.
This additive owner relocation preserves existing interfaces and semantics and
does not request a frozen public-contract change. Shared classification/readiness
and composition integration belong to the main agent.

Readiness85 records these planned cases. Shared boundary declarations and existing
Control/HTTP imports have been integrated as source, without executing acceptance.
