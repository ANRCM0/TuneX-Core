# Passive Forward Diagnostics v1 (D3-A)

Status:2026-10-18 (Asia/Shanghai), source implementation locally unverified.
[ADR-0036](../decisions/0036-passive-forward-diagnostics.md). A passive one-Forward
view, not audit query/alert delivery, a network test, full-plan authorization or D3
completion. The original D3-A slice reused Schema0028. The later D1 consumer
integration below reads the original Probe owner's Schema0036 fields; diagnostics
still adds no owned migration, execution flag, Agent protocol or Journal change.

## Request And Access

`GET /api/v1/scopes/:scope/forwards/:id/diagnostics` uses original Bearer identity
and no-store response. All query parameters are rejected. Scope viewers may read;
missing membership/resource remains opaque. Scope authorization and the deliberate
SELECT-only projection share one caller-owned transaction. Bearer authentication
precedes this transaction on the same observation pool, so token identity lookup
and projection are not represented as one atomic authentication transaction.

Request admission occurs before authentication against the existing bounded observation
pool. That pool has two slots and1.5-second transaction deadline, no queued fallback
to the main Runtime pool. Budget/unavailable failures return sanitized errors rather
than broadening privileges or using a Runtime connection. The read never invokes a
live Probe, arbitrary socket/HTTP request, notification queue, executable Runtime
method, cleanup, lease renewal, reservation or business write.
The diagnostic host admits at most two pre-auth requests and two active reads,
retains at most128 actor admission keys and applies a one-second per-actor cooldown.

## Response Shape

The response contains `diagnosticVersion:1`, Scope ID/capturedAt, limits and these
fixed top-level labels:

```json
{
  "source": "persisted-control-and-agent-state",
  "readOnly": true,
  "networkCheck": "not-performed",
  "executionAuthorized": false,
  "health": "unknown",
  "consistency": "read-committed-not-global-snapshot",
  "snapshotDigestVerification": "projected-not-recomputed"
}
```

Seven-layer fields are `intent`, `deployment`, `nodes`, `listeners`,
`adjacentSegments`, `target`, `probe`, alongside original `operations`, `cleanup`
and `support`. Bounded collections carry `limit`, `truncated` and `items` where
applicable. `nodes` follows configured path order with position/role and nullable
evidence. Intent has selected desired identity/revision/digest/enabled/deleting/
recovery/protocol/mode/path/listen/Transport reference fields, not a full driver config.

The returned `support` wrapper is exactly `{redacted:true,sameRead:true,bytes,digest,
bundle}`: bytes is the UTF-8 JSON byte count of bundle, digest is that redacted bundle's
content digest, not an included original config or Snapshot digest. `bundle` has
`supportVersion:1`, fixed scope-1/forward-1 aliases and the bounded redacted layers.

## Seven-layer Meaning

The result follows `intent -> deployment -> nodes -> listeners -> adjacentSegments ->
target -> probe`. It retains original Operation/cleanup, port-slot, retirement and
execution-lease facts as bounded context.

| Layer | Meaning and limits |
| --- | --- |
| intent | Selected original desired Forward fields and deleting/recovery intent; not a full driver config or runtime application |
| deployment | Original deployment stage/generation/target revision and Operation progress/cleanup; succeeded is not network health |
| nodes | Ordered path Nodes and validated current persisted report/session/Snapshot metadata, stale/unknown reasons and age/expiry |
| listeners | Exact assignment/listener observation and lifecycle, constrained by current evidence identity/phase; not public reachability |
| adjacentSegments | Ordered neighbor facts from native assignments; absent/mismatched/stale links remain unknown, never invented successful hops |
| target | Original desired final target and any matching reported facts, not a newly attempted dial or application response |
| probe | Original ephemeral Direct TCP egress, local-ingress connect or controlled-service TLS permit/result facts with explicit measurement/point and historical/current-binding labels, not complete business-path health |

The layer names express a diagnostic order, not a claim each layer has independent
current network evidence. No OR/AND automatic health or routing decision follows.
Viewer intent may show original Forward addresses already authorized by Scope access;
that does not authorize new Node/Profile usage or active probing.
`deployment` is the latest retained original Relay deployment and may target an older
Forward revision (`matchesIntent:false`); it can be null for Direct or no matching
record. No synthetic Direct deployment or current-success claim replaces null.
`cleanup.complete` is always false. Empty/truncated slots, retirements or leases do
not prove physical cleanup complete; lease `windowOpen` is historical issued-window
fact and its currentAuthorization remains not-rechecked.

## Source Projection, Validation And Freshness

`ForwardDiagnosticReadPort<Tx>` supplies bounded selected metadata and the original
bounded Probe result bodies needed to validate their actual versioned digests.
For TLS permits only, it also supplies at most16KiB of public service context per
row for internal context/digest and result-pin correlation. That full context/DER
never enters the diagnostic DTO or support bundle. It reads original Forward, bounded Operations, ordered Nodes, assignments,
deployment, slots, retirements, leases and Probe facts. The service constructs new
closed output values after checking allowed fields, identifiers, safe counters,
timestamps/digests, known driver/schema, role/protocol/phase/condition enums and bounded
error codes. Raw persisted JSON and free-text exceptions do not pass through.
Known operational error codes are copied from a fixed allowlist; any other source
code becomes `OTHER_ERROR`, not source text or a broadened enum. Malformed identity,
enum/time/tuple or incompatible persisted shape fails as sanitized integrity error.

Errors/observations include a fixed `nextStep` advice code: review current permissions
and leases, reservations and cleanup, config/protected state, Operation/cleanup before
an explicit retry, peer/target before an explicitly authorized Probe, or original-owner
diagnostics. It is operator guidance only, never an executable command, bypass,
instruction to erase protected state or guarantee that retry is currently allowed.
Observation advice is null when no error code exists; Operation retryable can remain
null when the original stored error omitted that fact. Operation updatedAt is an
original progress timestamp, not a newly invented exact fault-occurrence timestamp.

Node freshness requires report Node/boot/session/sequence to match current Node/runtime
metadata and current Snapshot generation. Report observed and received times both
constrain freshness; so do current Snapshot validity minus skew and credential expiry.
Snapshot node/session/generation and timestamp relationships must match. An observation
only describes current assignment when its exact assignment/Forward revision/
deployment generation/fence/protocol/phase tuple belongs to that current evidence.
Historical deployments, leases or assignment fragments cannot be promoted to current
merely because their IDs look plausible.

Each observation and drain carries its own projected report context rather than the
timestamps of an earlier Node query. The service compares boot/session/sequence,
Snapshot generation and observed/received times with that earlier evidence before
claiming a fresh correlation. Assignment `nodeEvidenceMatches` and report
`matchesNodeEvidence` remain false when those read-committed statements raced;
later observations do not inherit an earlier report's freshness. Drains preserve
their separate context too; a later drain query is not assumed to share the
observation query's report sequence.

Snapshot digest is selected stored provenance. Projecting its metadata does NOT
recompute, authenticate or cryptographically verify the full Snapshot body. Similarly,
redacted assignment metadata is not an independent recompile or proof full driver
configuration was executed. Mismatch/invalid/stale/missing facts have explicit unavailable
or unknown semantics instead of fabricated success. Current generation/credential alone
does not prove health. Read-committed layers are not a global/multi-host snapshot.

Original Probe evidence is bounded and ephemeral. A result is linked to its exact
original Direct TCP binding, measurement, observation point and validity, with
historical versus current-binding labels. v1, v2 and v3 keep their actual native
body/digest; v3 is not projected into a v2 hash. The public permit projection adds
measurement/point and compact service selection (null for the two older measurements).
TLS evidence is checked against that permit's context and exact public leaf pin;
the raw diagnostic result may carry the whitelisted TLS proof. This is historical
Agent-reported evidence, not a new current service-authority lookup. A present retained result need not be complete/current or
prove this entire Forward path/application. No result is fetched by executing a Probe
during this GET. Unsupported Relay/multihop/UDP/application measurements remain unknown.
`bindingMatchesCurrent` and result `windowOpen` are separate facts, not a combined
health/current-complete claim. Permit consumed close time must precede expiry; revoked
or quarantined close time may occur after expiry. Existing withdrawal/result timing
semantics are retained rather than rejecting all post-expiry terminal records.
`historyComplete:false` and ephemeral-original-permits retention apply even when no
rows are returned or a retained result is present.

## Hard Bounds And Incompleteness

Per response:8 Operations,8 ordered Nodes,16 assignments,16 slots,32 retirements,
32 leases and8 Probe records. Each bounded collection exposes truncation when more
rows exist; these are query windows, not exhaustive history, deletion safety or proof
resources can be reclaimed. Overall DTO is limited128KiB, support bundle64KiB.
Malformed/capacity-limited source cannot silently expand the read or drop security
checks. Logical response bounds are not measured physical SQL/pool capacity evidence.
The128KiB total includes the nested support wrapper/bundle. Exceeding a byte bound
fails with sanitized integrity error rather than silently exporting unchecked fields;
collection truncation is independently explicit on its bounded row window.

No full Snapshot, Report, driver/Profile config, Node policies, raw Operation error,
audit details, machine credential fingerprint, token/hash, certificate/private key or credential appears
in the public DTO. Public error material is only validated known fields/codes, never
unbounded source-owned exception text. Viewer access does not grant administrative
backup/recovery state or protected paths.
The deliberately public controlled-observation leaf fingerprint is the sole TLS
pin in the raw result proof; it is not a machine credential fingerprint. Compact
service identity/revision/config/context digests remain scoped viewer details and
are excluded from export with that public pin.

## Same-read Redacted Support Bundle

The service builds support material from the SAME validated diagnostic read, not a
second endpoint call, new transaction or fresh network query. It has its own64KiB
bound and cannot include a broader Scope/resource set than that one Forward diagnosis.

Support is stricter than the viewer DTO. Per-export ordinal aliases replace identifiers
so meaningful relations remain local to the export without revealing persistent IDs.
Alias kinds are node, assignment, operation and permit, assigned within each export;
Scope/Forward use fixed scope-1/forward-1. Boot IDs are not exported. Safe fixed
driver/protocol/status enums and revision/generation/fence counters remain values,
not identities. No cross-export stable pseudonym or secret mapping is returned.
It omits original identifiers, machine addresses AND ports, target/host/endpoint, Profile IDs,
digests, free text, request identifiers and actor identifiers. Tokens, token hashes,
policies, fingerprints, cert/key/credential material, full config/wire/raw errors and
protected Authority/database/credential paths are excluded entirely. There is no
generic recursive redactor that might miss an unknown secret key: only approved
closed fields are copied.
TLS support keeps only fixed version/ALPN/verified fields, never leafFingerprint;
the complete compact service selection is omitted. The fixed exclusion label
`observation-identifiers-and-trust-pins` makes this boundary explicit. Measurement,
point and historical status remain safe fixed enums; they are not permission or
health. Client reconstruction uses the same closed whitelist as the server.
The support wrapper's own digest authenticates no external provenance: it is only
the content digest of this newly redacted bundle, with all original config/plan/
Snapshot digests removed from its layers.

This support bundle is not a full SQL backup, disaster-recovery artifact, forensic
archive, global snapshot, health proof or fresh execution permission. Original
privileged backup/authenticated manifest and independent Authority/Journal/high-water
recovery responsibilities remain unchanged. Removing secrets does not make incomplete
history complete or network observations independent.

## Remaining D3 Scope And Evidence

Station events, audit query, dedupe/transition state, recovery notifications, silence,
rate/retry limits, durable notification outbox, protected endpoint credentials and
SSRF-safe controlled webhook remain follow-ups. This read does not send or enqueue
notifications, and notification failure must not change Forward/Operation success.
Mail/Telegram and C3 routing policy remain separate. Do not label D3 done.

Only source/document edits and necessary reads. No tests/new fixtures, static/syntax/
type/contract/boundary checks, formatting/generators, network/browser/Compose/CI,
migration execution, commit/push. Redaction, freshness identity, malformed data,
admission/pool isolation and final-source functionality are locally unverified.
