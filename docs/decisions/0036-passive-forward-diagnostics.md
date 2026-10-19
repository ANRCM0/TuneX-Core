# ADR-0036: Bounded Passive Forward Diagnostics

Date: 2026-10-18 (Asia/Shanghai). Status: D3-A implemented locally, unverified.

## Decision

Add a one-Forward passive diagnosis read with seven ordered layers: intent,
deployment, nodes, listeners, adjacentSegments, target and probe. Include original
Operation/cleanup, port-slot, retirement and lease facts without turning the query
into Runtime acceptance, a live probe or new execution authority. Return a server-built
redacted support bundle derived from that same read, never a second fresh fetch.
See [contract](../spec/forward-diagnostics-v1.md).

The source adapter implements `ForwardDiagnosticReadPort<Tx>` using selected bounded
fields, not full Snapshot/Report/driver config or raw errors. Service validates identities,
safe counters/times/digests, known driver/phase/role/condition enums and error codes
before constructing the public DTO; unrecognized source error codes become OTHER_ERROR.
Missing/mismatched/stale evidence remains explicit;
network/application health stays unknown. A successful Operation, valid credential,
fresh report or listener observation is not end-to-end reachability.

Freshness requires exact Node/boot/session/report sequence/current Snapshot generation
and observation tuple/phase. Its time bound uses both observed and received times,
current Snapshot validity with skew and credential expiry. Projected Snapshot metadata
is a stored provenance read, not cryptographic recomputation/verification of the full
Snapshot's digest. Probe output is original ephemeral Direct TCP IP-literal egress
evidence with exact current-binding/historical meaning; not full-path application health.

Each observation/drain retains the report context from its own SELECT. A concurrent
report or Snapshot update between statements cannot borrow the cached Node query's
timestamp or sequence to appear fresh. Explicit Node/report evidence-match flags
stay false on that race; this is not a global report snapshot.

## Viewer Access, Admission And Isolation

The only new read is Bearer `GET /api/v1/scopes/:scope/forwards/:id/diagnostics`,
with no query parameters. Viewer Scope authorization and projection share its supplied
transaction. Bearer identity lookup precedes that short transaction on the same existing
observation pool; authentication and projection are NOT claimed atomic together.
Pre-authentication admission and projection use the existing two-slot/1.5-second
telemetry database; no fallback to main Runtime pool. No network, Probe request,
notification enqueue, audit write, cleanup, reservation or configuration mutation.

Bounds per Forward:8 Operations,8 Nodes,16 assignments,16 slots,32 retirements,
32 leases and8 Probe rows. Overall response128KiB; support bundle64KiB. Expose
truncation rather than implying exhaustive retained history or deletion safety.
Captured layers are read-committed facts, not a global or multi-host snapshot.

## Support Redaction

Diagnostic intent may contain viewer-authorized original Forward addresses, like the
existing Forward view. Support export is stricter: independent per-export ordinal
aliases replace identifiers; omit boot IDs, addresses/ports/target/host/endpoint, Profile IDs, digests,
free text, request/actor identifiers and all credential/security material. Only closed
bounded public status/code/time/counter relations survive. This is allowlisting, not
generic string replacement over arbitrary persisted JSON.

Neither DTO returns full wire/config/report bodies, raw errors/audit details, policies,
fingerprints, tokens, certificates/private keys or credentials. Support is one-Forward
diagnostic material, not a database backup, Authority export, forensic archive or proof
of network/runtime correctness. It derives from the same validated source collection;
there is no export-triggered refetch that might mix another evidence generation.

## Storage And Remaining Scope

Reuse Schema0028 and existing pool/admission; no migration, compatibility Profile,
Agent/ADP/Journal change, deployment flag or execution worker. Existing audit writes,
privileged full SQL backup and protected recovery are not repurposed as viewer exports.
Bounded audit querying, station events, recovery notifications, dedupe/silence/rate
policies, independent notification outbox, protected webhook credentials and SSRF-safe
sender remain separate future slices. Notification failure must never become Forward
deployment failure. D3-A does not complete D3 or enable C3 policy.

## Evidence

Source/document edits and necessary reads only. No tests/new fixtures, static/syntax/
type/contract/boundary checks, generators, formatting, network/browser/Compose/CI,
migration execution, commit or push. Freshness, redaction, malformed persisted inputs,
pool isolation/cancellation, query budgets and UI remain locally unverified. No final
acceptance or production-readiness claim is made.
