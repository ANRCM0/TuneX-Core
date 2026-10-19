# ADR-0037: Bounded Owner-Record Audit Query

Date: 2026-10-18 (Asia/Shanghai). Status: D3-A2 implemented locally, unverified.

## Decision

Add a manager-only Scope audit query over fifteen existing owner-record families.
The new `AuditReadPort<Tx>` deliberately projects SELECT-only allowlisted fields;
it does not become an audit writer, execution owner or universal event ledger.
See [contract](../spec/audit-events-v1.md).

Manager authorization and all source projections share a supplied transaction.
Bearer lookup precedes that transaction on the existing two-slot/1.5-second
observation pool; authentication plus projection are not claimed atomic together.
Actor admission/cooldown applies without falling back to the main Runtime pool.
No GET writes, new DDL, scheduling, network calls or Runtime acceptance methods.

## Bounded Query, Not A Historical Snapshot

Use a fixed default24-hour window, at most31 days, and25 rows by default, at most50.
Apply all closed filters, time bounds and cursor predicates before each source's
limit+1 query. Merge by descending `(occurredAt,source,key)`; the key hashes the
complete source primary-key tuple. No COUNT or unbounded history materialization.
The cursor binds Scope, fixed window, filters and limit through a query digest;
continuations explicitly resend the same canonical UTC millisecond window.
It is unsigned pagination position, not authorization, authenticity or snapshot proof.
Every page reauthorizes the current manager and reads current committed facts.

Concurrent inserts and mutable Operation updates can change subsequent pages.
`hasMore` describes the bounded query, not all possible past actions; source coverage
does not prove complete retention, immutable transition history or absence of events.
Related lifecycle and attempt records are separate source facts, not independent
command counts. Unsupported associations remain null instead of using current
Forward state to fabricate historical Node/Forward/Operation relationships.
Single-value associations are deliberately not exhaustive relations: Node-security
detail arrays of Operation IDs are not flattened into invented scalar associations.

## Attribution And Redaction

Preserve `recordType`, `timeMeaning`, `actorAttribution`, revision kind and Node
association semantics. Original owner events identify initiators where recorded;
machine events can be unattributed. Batch recovery rows originally store a creator,
not a recovery operator: expose unattributed recovery, never a false initiator.
Operation rows are latest mutable state observations, with requester explicitly not
the status actor. No invented status-transition events or backdated current errors.
Batch/attempt recovery flags are current owner-head observations at read time,
not reconstructed historical event-time state.

Node association comes only from explicit source Node identity or that record's
immutable Forward spec/template config/group definition. Batch lifecycle records
cannot invent member-level Forward/Operation associations. Global `recovery_events`
has no Scope attribution and is excluded; do not infer it from current membership.

Only closed metadata/code/status/time/identity fields leave the projection. Omit raw
details, config/spec/plan/outcome bodies, errors/free text, request keys/digests,
fingerprints, certificates, credentials, policies and protected recovery state.
This manager query retains authorized original identifiers; it is not the aliasing
diagnostic support export, SQL backup or forensic completeness proof.

## Remaining Work

Reuse Schema0028 and existing records; no new retention or GC policy is implied.
Station events, alerts, dedupe/silence/recovery notifications and independently
controlled SSRF-safe webhook delivery remain separate future work. No export,
notification or automatic execution is added here. Source-only implementation has
not been tested, statically checked, formatted, CI-validated, committed or pushed
in this slice. D3, C3 acceptance and the project remain incomplete.
