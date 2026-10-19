# Passive Diagnostic And Audit Owners v1

Date: 2026-10-19 (Asia/Shanghai). Status: source authored, unverified.
Scope: plan A2 fifteenth/sixteenth source slices. No new product capability.

## Public Chains

| Entry | Original rules and coordination | Required lower/public providers | State and compatibility |
| --- | --- | --- | --- |
| audit-owner/public.ts | AuditEvents, closed rows/query/cursor, bounded source merge and per-instance admission | L1 TransactionBoundary, ScopeAuthorization, AuditStorage; L2 native value codecs and MySqlAuditReadStore | Existing owner records remain authoritative; old application class/API/read-model and flat ports/policy entries directly alias canonical leaves |
| forward-diagnostic-owner/public.ts | ForwardDiagnostics, persisted identity/freshness/relationship checks and same-read redacted support | L1 read-only ForwardDiagnosticStorage, transaction and Scope authorization; public Probe binding validator; L2 native codecs/MySqlForwardDiagnosticReadStore | Same original read model; old application class/API, flat ports and policy exports directly alias canonical leaves |

Each owner has candidate module interface 1. Existing HTTP API interface versions,
DTO shapes, constructor/method names and lower storage interfaces remain unchanged.
Actual classes, contracts and policies move into these directories; the old paths
do not contain a second implementation. Server composes the same services through
their public roots, and HTTP consumes only their APIs. No new composition root,
SQL store, event log, execution authority, pool, transaction or route is added.

The legacy leaf-to-leaf aliases are precise compatibility paths, not permission
for new consumers to import private files. They retain the old export surfaces
without pulling the whole new public root into a constants-only/type-only path.
The old observation-policy entries directly re-export the same policy objects.
Audit source/kind/error arrays retain their original runtime mutability and
references; auditStoragePolicy remains shallow-frozen over those same arrays.
Remove aliases only after caller inventory, matching-revision initialization/
identity acceptance and separately confirmed compatibility removal.

## Audit Read Ownership

AuditReadModels owns the original lower-row type projection and storage policy.
It still supplies the original assertion callback to MySqlAuditReadStore; the
full closed-row checks remain at AuditEvents.row, not earlier in SQL projection.
Source order, binary SQL filtering, bounded per-source reads and original source
tables remain in the existing lower adapter. Station's error-code interpretation
now consumes the Audit public vocabulary with the same null/OTHER_ERROR behavior.

Audit query preserves identity/closed-input validation, one wall-clock read before
window construction, explicit frozen cursor window, canonical ISO bounds, filters,
digest and deepFreeze, then actor admission and the caller transaction. Manager
Scope authorization precedes all source reads on the same supplied connection.
Each family is read sequentially, with limit+1, strict descending position checks,
original closed DTO reconstruction and strict merged ordering before slicing.
Result time is sampled at the original final point; cursor, coverage/limits,
timestamp conversion, freezing and byte-limit refusal stay in their original
order. Admission counters/cooldown maps remain per instance, with the same finally
cleanup and native monotonic timing; no shared admission service is substituted.

Audit remains a merge of existing owner records. Operation rows are latest state,
not a transition log. Retention and loss remain source-owned; bounded response
size is not evidence of SQL query cost, completeness or production readiness.

## Diagnostic Projection And L2 Framing

ForwardDiagnostics keeps its original policy validation/default clock, request
and actor admission, Scope authorization, parsed Forward/shape checks, sequential
operation/Node/assignment/deployment/slot/retirement/lease/Probe reads and one
post-read wall-clock sample. Strict evidence/tuple/uniqueness checks and all
freshness precedence, credential/session/Snapshot windows, exact reservation
correlation and historical-lease distinctions remain product rules. Reads do
not invoke Runtime, issue Probe work, renew a lease or release a resource.

The original diagnostic Probe stored-result framing moves to
compatibility/native-diagnostic-probe.ts. nativeDiagnosticProbeResult copies the
checked body, supplies the original temporary 64-zero requestId and dispatches
v3, then v2, otherwise v1 using the same JSON/parser sequence. Unknown versions
are not newly accepted, and staged v4/echo diagnostics are not enabled. The caller
still maps only framing/parse failures to its original diagnostic integrity error.
nativeDiagnosticProbeResultBody is a separate original projection, invoked OUTSIDE
that catch, so projection exceptions are not silently remapped.

L3 retains original result-body preconditions, forbidden retained requestId,
measurement/point/service/TLS trust comparisons, body/binding digests, permit state,
consumed/issued/expiry/measurement/acceptance/withdrawal times and current binding
correlation. Existing compact service/TLS DTO types now come through public L2
aliases to the same wire declarations. No parser/schema/default is changed.

Support redaction remains in the diagnostic owner and uses the same bounded read,
alias traversal/order, exclusions and nested field projections. It drops the same
identifiers/addresses/ports/pins/bodies/credentials, keeps original unknown and
non-authorizing flags, computes the same support byte bound/digest and response
byte bound, and freezes at the same final points. A report, listener count, link
correlation or historical Probe never becomes an independent health/readiness proof.

## Evidence And Remaining Work

Readiness items 68 and 69 are entirely planned. Compare public/legacy API, class,
constant/type identity and module initialization; query/refusal/order/cursor,
SQL/transaction, admission cleanup, Probe parser/projection catch boundaries,
redaction/digest/bytes and cross-owner vocabulary behavior on the same frozen
revision. Existing tests/tooling have not been adapted or run in this source phase.
Functional/MySQL/network evidence belongs in later authorized GitHub Actions.

No tests, type/syntax/static/boundary checks, formatter/generator/build, experiments,
CI, commits/pushes or delegation ran. Declaring these scopes does not prove full
source/type compliance. Station/Notification/Probe history/plan and telemetry
application owners, other HTTP/private/native dependencies, A1 residuals, Agent
Probe/native, Runner and whole-source classification remain open. No A1/A2,
foundation or upper-module gate opens, and later phases remain unimplemented.
