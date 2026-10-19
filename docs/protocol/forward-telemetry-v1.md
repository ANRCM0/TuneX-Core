# Forward Telemetry Wire v1

Status: implemented locally, unverified, 2026-10-18
(Asia/Shanghai). Normative closed message parsing is in
`packages/contracts/src/forward-telemetry.ts`; a manually authored
[JSON Schema](schemas/forward-telemetry-v1.schema.json) accompanies it. No Schema
generator was run, and no new fixtures or protocol tests were run or added for this slice.
ADP/3, execution messages,
process telemetry-v1 and Agent Journal formats are unchanged.

## Transport And Admission

`POST /agent/v3/forward-telemetry` uses the existing verified machine mTLS identity
and session header. No cookies, redirects, new credentials or execution rights.
Both Control `TUNEX_FORWARD_TELEMETRY=1` and Agent `--forward-telemetry=true` are
explicit, independent opt-ins, default off. They do not require process telemetry.
Middleware verifies TLS/fingerprint; the strict parsed Node claim is authenticated
by `Nodes.credential(tx,node,fingerprint)` in the observation transaction, not a
redundant main-pool machine lookup. This changes connection routing, not identity
requirements or the credential owner's checks.

Agent samples at most once per ten seconds with a separate random sample epoch,
sequence, cloned mTLS transport and two-second request deadline. It keeps no queue,
does not retry a rejected or unacknowledged batch and promises no final-tail upload.
Transport/parse/partial-ACK failure increases `droppedSamples` in the next attempt;
the current batch can already be partially or fully committed when its ACK is lost.
This is uncertainty, not proof that every point was dropped or execution stopped.

The wire sample is at most 65536 UTF-8 bytes and 32 points; each point at most
4096 bytes. ACK is at most 4096 bytes. Closed objects reject unknown/missing fields,
duplicate JSON keys and invalid counters/times. Empty item lists may carry coverage.
Control uses four pre-auth route slots, two active service slots and the existing
shared two-connection telemetry database pool with no wait queue/retry and a
1.5-second hard database deadline. Full admission returns an explicit failure;
telemetry must not queue behind or create execution authority.
Persistent per-Node admission has a nine-second minimum between new accepted batches,
allowing scheduling/network jitter around the Agent's ten-second sample interval.

## Closed Sample

All listed fields are required; the TypeScript parser is the exact structural
contract, including closed nested objects and consistency checks.

| Field | Meaning |
| --- | --- |
| `forwardTelemetryVersion`, `kind` | `1`, `forward-telemetry-sample` |
| `nodeId`, `bootId`, `sessionEpoch` | Authenticated Node/current boot/current session |
| `sampleEpoch`, `sequence` | Independent 32 lowercase hex sample epoch and positive safe integer |
| `capturedAt`, `uptimeMs` | UTC RFC3339 timestamp and nonnegative monotonic exporter uptime milliseconds |
| `snapshotGeneration` | Observed local generation, not a grant or a claimed server mapping |
| `droppedSamples` | Exact decimal uint64 exporter uncertainty counter |
| `coverage` | Required bounded page/terminal-tail coverage below |
| `items` | Zero through 32 closed points |

`coverage` has exactly `limit`, `available`, `returned`, `omitted`, `truncated`,
`offset`, `nextOffset`, `unavailableSources`, `tailLimit`, `tailRetentionSeconds`,
`tailsEvicted`, `tailsExpired`, `historyComplete`. Limits are 32/128/600 seconds;
counts, rotation offsets and truncation must agree with the item list and inventory.
`historyComplete` is always false. Tail eviction/expiry are decimal uint64 strings.
Pages rotate over a changing live inventory; offsets are not durable pagination
tokens and omission must not be interpreted as an absent or zero-traffic instance.

## Point And Exact Identity

Each point has exactly `identity`, `state`, `phase`, `capturedAt`, `endedAt`,
`availability`, `counterEpoch`, `counters`, `overflowed`.

Identity has exactly `nodeId`, `bootId`, `sessionEpoch`, `assignmentId`, `forwardId`,
`forwardRevision`, `deploymentGeneration`, `bindingFence`, `role`, `protocol`,
`driverId`, `driverSchemaVersion`, `configDigest`, `resource`. Resource has exactly
`protocol`, `address`, `port`. Identity must agree with the outer Node/boot/session.
Only `direct` / `relay-ingress` / `multihop-ingress` are allowed, paired with
`native.direct.v1` / `native.relay.v1` / `native.multihop.v1`, schema version 1.
TCP/UDP and physical ingress resource protocol agree; IP address and port are bounded.
Config digest is `sha256:` plus 64 lowercase hex digits.

`state` is `current`, `draining` or `terminal`, an Agent lifecycle observation, not
Control readiness. `phase` is `prepared`, `active` or `draining`; direct is active.
Point time cannot exceed sample time. Terminal `endedAt` equals point `capturedAt`;
other states have null `endedAt`. Closing a local engine does not prove delivery.

Availability is `available` or `unavailable`. Unavailable has null counter epoch,
counters and overflow flag, not synthetic zero values. Available has a 32 lowercase
hex per-instance `counterEpoch`, boolean overflow and exactly these uint64 decimal
string counters: `payloadSentBytes`, `payloadReceivedBytes`, `tcpAccepted`,
`tcpConnected`, `tcpClosed`, `udpAssociationsCreated`, `udpAssociationsClosed`,
`udpDatagramsSent`, `udpDatagramsReceived`. The opposite transport's event fields
must be `"0"`. Bytes follow [native ingress accounting](../spec/native-payload-counters-v1.md),
not host interface bytes, wire overhead, per-hop totals or billing. Duplicate complete
identity/counter-epoch entries in one sample are rejected.

## Mapping, Commit And ACK

Runtime's supplied-transaction SELECT-only mapping compares every reported identity
field against a complete parsed current published Snapshot, or an exact immutable
retirement plus same-session execution lease. It derives Scope from the trusted
Forward, requires the Node Scope to agree and checks driver/config/resource bindings.
Unknown identities are rejected points, not arbitrary Agent-selected Forward labels.
Retired safe instances remain published provenance; publication provenance never grants
execution. A boot/session mismatch has no valid mapping. Corrupt persisted mapping
fails intake; it does not trigger execution-state repair.

The independent per-Node ingestion checkpoint commits before acknowledgment.
Same epoch/sequence/content supports replay; changed content conflicts, old sequence
does not overwrite the head, and epoch/uptime resets are not cross-instance deltas.
Accepted points and rejected identities are counted separately; no rule sums are made.

ACK has exactly `forwardTelemetryVersion:1`, `kind:forward-telemetry-ack`, `nodeId`,
`bootId`, `sessionEpoch`, `sampleEpoch`, `sequence`, UTC `receivedAt`, `stored:true`,
`acceptedPoints`, `rejectedPoints`, `source:agent-reported`, `executionAuthorized:false`.
Counts are nonnegative and sum to the sent item count. Exporter verifies all request
bindings and counts. `stored:true` acknowledges the committed ingestion receipt,
not acceptance of every point, health, execution, complete history or settlement.

## Deferred Acceptance

No tests, static checks, generator, browser, Compose validation or Actions run for
this slice. Final exact-source contract/mTLS/admission/replay/partial ACK/late-tail/
recovery/capacity acceptance remains required under the Actions-only functional rule.
