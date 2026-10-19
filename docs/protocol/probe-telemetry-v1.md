# Probe Telemetry Wire v1

Later [typed Direct ingress](../spec/direct-ingress-probes-v1.md) does not extend
this closed v1 wire. Counters/identities remain egress-only; ingress dials are
excluded, not silently folded into old points or rollups. Typed telemetry-v2 is
not implemented by that slice.

Date: 2026-10-18 (Asia/Shanghai). Status: implemented locally, unverified.
Normative strict parsing: `packages/contracts/src/probe-telemetry.ts`;
[manually authored Schema](schemas/probe-telemetry-v1.schema.json). No generator run.

## Transport And Closed Envelope

`POST /agent/v3/probe-telemetry` is independent observation transport, not Probe claim,
execution or result authority. Existing TLS/fingerprint and strict Node/session/boot
claim checks use the credential owner in the observation transaction. Source remains
agent-reported; executionAuthorized is false. Independent Control
`TUNEX_PROBE_TELEMETRY=1` and Agent `--probe-telemetry=true` default off. Enabling metrics
does not enable Probe registration/execution or mint permits.

Agent exports every ten seconds using its own sample epoch/sequence and cloned mTLS
client with two-second deadline. No redirects, persistent queue, retries or guaranteed
final-tail upload. Missing/invalid/partial ACK increases uncertainty; an unacknowledged
batch may already have committed. Four telemetry families share two observation pool
connections, four pre-auth route admissions, two service admissions and a 1.5-second
database deadline. These limits do not prove zero interference or physical capacity.

Sample is at most 65536 UTF-8 bytes, 32 points and two distinct binding Snapshot
generations. A point is at most 4096 bytes, stored exporter metadata at most 2048;
ACK at most 4096. Closed objects reject unknown/missing fields, duplicate keys,
invalid timestamps/uint64 values and inconsistent coverage.

Required sample fields: `probeTelemetryVersion:1`, `kind:probe-telemetry-sample`,
`nodeId`, `bootId`, `sessionEpoch`, `sampleEpoch`, `sequence`, `capturedAt`, `uptimeMs`,
`droppedSamples`, `coverage`, `items`. Sample epoch is 32 lowercase hex; sequence is
positive safe integer; uptime is nonnegative milliseconds. `droppedSamples` is an exact
decimal uint64 string. Point times cannot exceed outer UTC capture time.

Coverage has exactly `limit:32`, `snapshotLimit:2`, `available`, `returned`, `omitted`,
`truncated`, `offset`, `nextOffset`, `unavailableSources`, `tailLimit:128`,
`tailRetentionSeconds:600`, `tailsEvicted`, `tailsExpired`, `historyComplete:false`.
It additionally requires `retiringSourceLimit:8` and `retiringSources` from 0 through
8. Available inventory is at most 2432 and at most 384+retiringSources*256; the page
limit is not a bound on the complete scan or retained-source cost.
Omission accounts for page and Snapshot-generation bounds; rotation is not stable
pagination over a fixed inventory. Tail eviction/expiry remain explicit. Missing
items are not zero attempts or proven absent Probe instances.

## Point Identity And Counters

Each point has exactly `identity`, `state`, `capturedAt`, `endedAt`, `availability`,
`counterEpoch`, `counters`, `overflowed`. State is `current` or `terminal`; terminal
endedAt equals point capture time, otherwise null. Availability is available or
unavailable; unavailable has null epoch/counters/overflow, not zeros.

Identity is exactly `binding`, `instanceId`, `instanceGeneration`. Instance ID is 64
lowercase hex and generation positive. Binding has exactly `nodeId`, `bootId`,
`sessionEpoch`, `snapshotGeneration`, `assignmentId`, `forwardId`, `forwardRevision`,
`deploymentGeneration`, `bindingFence`, `configDigest`, `egressPolicyRevision`, matching
the outer authenticated Node/boot/session. Counter epoch is independent 32 lowercase
hex, not Probe instance ID, permit ID or an execution authorization.

Available counters are exact uint64 decimal strings: `attempted`, `succeeded`,
`failed`, `unknown`, `inFlight`. First four are cumulative; inFlight is a gauge and
may decrease. Unless overflowed, a coherent snapshot satisfies attempted equals
succeeded+failed+unknown+inFlight. Saturation is explicit, not wraparound.

Attempt is counted immediately before the actual authorized single TCP dial, not
when a permit is issued/consumed, task offered or Gate called. Succeeded/failed is
counted only when the original executor returns a valid connected/unreachable Result.
Post-dial authority loss, cancellation or other invalid completion is unknown, not a
valid negative target result. An invocation registers a numeric call before the
check-to-dial race, but that registration is not an attempt. Close transfers existing
inFlight to unknown once; a registered call that reaches the real dial after Close
still adds attempted+unknown, not a valid success/failure. Only after every registered
call leaves can its counter source freeze as terminal. Pending retiring-source points
remain current, never falsely terminal. Close does not wait for metrics or introduce
another network call; late completions cannot count the same outcome twice.

The collector retains at most eight pure numeric CounterSet readers, each with up to
256 bindings, a 600-second TTL and per-point eviction/expiry accounting. Readers keep
no Gate/context/Runner/credential/authorization callback. Completed sources move to at
most 128 value tails. Alongside up to 256 current bindings the scan can reach 2432
points; it is not merely a 128-tail memory budget. Output remains 32 points and at most
two Snapshot generations. Timeout/eviction can lose final observations permanently.

## Provenance And ACK

Runtime mapping performs at most three SELECTs: Node/current optional Probe instance,
up to two historical immutable Snapshots, trusted Forward ownership. Each Snapshot
is bounded at 4 MiB and parsed with complete metadata/config validation. Only exact
active Direct TCP assignment and full binding matches are accepted; Agent Forward
labels cannot choose Scope or revision. Unknown identity is a rejected point; corrupt
persisted provenance fails observation intake without repairing execution state.

Source is `published-snapshot`, publishedUntil from that Snapshot. A current instance
match requires exact instance/generation, Node/boot/session/current certificate,
registered state and unexpired registration, yielding `current-registered` plus
instanceUntil. Otherwise `not-rechecked`/null allows legitimate old tails. Neither
label validates every old permit nor grants current execution or health.

Per-Node independent checkpoint commits before ACK. Duplicate sequence/content may
replay its receipt; changed-content reuse conflicts and old sequence cannot overwrite
the head. ACK has exactly `probeTelemetryVersion:1`, `kind:probe-telemetry-ack`,
`nodeId`, `bootId`, `sessionEpoch`, `sampleEpoch`, `sequence`, UTC `receivedAt`,
`stored:true`, `acceptedPoints`, `rejectedPoints`, `source:agent-reported`,
`executionAuthorized:false`. Request binding and accepted+rejected equal sent item
count are verified. Stored is not a claim every point was accepted or delivered.

No tests, checks, generator, browser, Compose or CI were run. Later concentrated
exact-source acceptance must include execution/cancel/seal races, replay, truncation,
late tail, auth/provenance, partial ACK, bounds, recovery and physical capacity.
