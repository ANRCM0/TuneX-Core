# Probe Evidence Read Boundary v1

Date: 2026-10-19 (Asia/Shanghai). Status: source authored, unverified.
Scope: execution plan A1; no new Probe or Runtime behavior.

## Ownership And Reuse

The framework public entry exports runtime evidence read interface 1.
MachineSessionEvidence/Reader describe the original credential/session projection;
PublishedRuntimeEvidence/Reader describe an existing Snapshot with its boot, session
and credential context. Both are read ports, never issuers, publishers or connection
owners. PublishedRuntimeEvidence uses the same existing stable RuntimeSnapshot value
type already consumed by L1 hosts; it does not import a parser or a product type.

The old ProbeMachineEvidence/Reader and PublishedProbeSnapshot/Reader names specialize
these lower contracts. ProbeIntents reuses the existing RuntimeForwards port instead
of declaring another Forward state reader. Readonly fields, nullable/undefined
results and method signatures are retained in source intent. No new business DTO
or universal authority is moved into Core.

The existing pool-backed NodeMachineLookup is not substituted: it serves a distinct
TLS lookup, not this transaction-bound session and credential projection. Likewise,
RuntimeStateStore.snapshot does not replace the scoped publication/context query.
Reusing either implementation would change the query, lock or authorization facts.

## Original Adapters

MySqlProbeMachineReader, MySqlProbeReader and MySqlProbePermitIntents retain their
names, constructor behavior, method bodies and SQL. Only their type dependencies
now point at the public framework contracts, without reverse L3 Probe imports.
Existing Control composition and legacy/test consumers continue using these same
classes. No wrapper, callback phase, connection, pool or transaction is introduced.

Machine projection retains FOR SHARE, fingerprint-before-node SQL arguments, lazy
stored JSON decoding, string-only capability filtering, missing-value defaults and
the original numeric revocation interpretation. It does not grant authorization.
The original requireProbeMachine owner still checks current identity, credentials,
capabilities and time after the read.

Snapshot projection retains its scoped node/runtime/current-generation joins,
revocation and one-MiB body predicate, optional FOR SHARE, original JSON/parser
framing, and undefined return for mismatched node/session/generation/expiry.
Malformed parser input still throws; no fallback or extra body check is added.
Forward intent projection retains its shared lock, notFound point, stored-value
interpretation and Boolean flags. Neither reader writes another owner's tables.

## Forward Probe Effects And Compatibility

ForwardProbePlans uses the existing public target policy, DirectConfig type and
dynamic wall-clock/Date-parse/ISO helpers. Its one time read remains after awaiting
the published state. ForwardProbes uses the existing command-request framing, ISO
and service-selection helpers. Product validation, Scope/Node/store call order,
current Direct binding checks, service matching, two-second limits, issuance flags,
idempotency and executionEnabled:false remain with the original owners.

Planner echo preflight is not broadened into echo command issuance. Existing private
Probe service-reference/measurement collaboration is not certified by changing the
native imports. No wire, schema, permit budget, issuer, feature or retry is added.

The preceding registration slice's repeated framework exports are consolidated,
and the existing permit validator's echo challenge parser gets the missing direct
public binding to the same staged contract function. Parser identity, public type
compatibility and module initialization behavior still require acceptance.

## Planned Evidence And Remaining Work

Readiness item 49 covers exact record/type shapes, SQL/lock/parameter and refusal
equivalence, parser/export identity and native-effect call order on frozen source.
No test, check, formatter, build, experiment, CI, commit or push ran.

MySqlProbePermits still imports product permit/result validators and types. Its
single budget/withdrawal/result owner needs separate source work, not a broad SQL
package exemption. Remaining Probe private/value/type dependencies and the other
Control, Agent and full-repository work stay open. A1 and the foundation are not
accepted, and the independent upper-module gate remains closed.

## Later A1 Source Follow-Up (2026-10-19)

The earlier remaining-permit paragraph is a historical snapshot. The subsequent
[permit storage slice](probe-permit-storage-v1.md) separates that SQL and its
product values with a precise old entry. Readiness item 50 is still unexecuted;
remaining Probe/private/wire work and A1/foundation acceptance remain open.