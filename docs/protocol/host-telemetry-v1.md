# Host Telemetry Wire v1

Date: 2026-10-18 (Asia/Shanghai). Status: implemented locally, unverified.
Normative closed parsing: `packages/contracts/src/host-telemetry.ts`;
[manually authored Schema](schemas/host-telemetry-v1.schema.json). No generator run.

## Transport

`POST /agent/v3/host-telemetry` is independent mTLS telemetry, not an ADP execution
message. Existing session header, Node certificate/fingerprint and current boot/session
must agree. A strict parsed Node claim is checked by the existing credential owner
inside the observation transaction, not treated as authenticated merely because it
is supplied. Source is agent-reported; execution authorization is always false.

Control `TUNEX_HOST_TELEMETRY=1` and Agent `--host-telemetry=true` are separate explicit
opt-ins, default off, independent of process/Forward switches. Agent uses a ten-second
loop, its own random sample epoch/sequence and cloned mTLS client with two-second
deadline. No redirects, queue, retries or final upload promise.
OS sampling separately has a 500-millisecond budget and at most one non-authoritative
sampling worker per exporter. Uncancellable OS calls cannot accumulate workers or
publish late results; timeout drops the batch and cancellation does not wait for OS I/O.
Failed/missing ACKs
increment exporter uncertainty; data may have committed despite ACK loss.

Sample is at most 8192 UTF-8 bytes; ACK at most 4096. Unknown/missing fields, duplicate
keys, invalid timestamps/counters or inconsistent coverage reject. Machine admission
is bounded before authentication, and the existing observation pool and deadlines
are shared with other telemetry families; no execution wait queue is introduced.

## Closed Sample

Required outer fields: `hostTelemetryVersion:1`, `kind:host-telemetry-sample`,
`nodeId`, `bootId`, `sessionEpoch`, `sampleEpoch`, `sequence`, `capturedAt`, `uptimeMs`,
`platform`, `droppedSamples`, `host`. Epoch is 32 lowercase hex; sequence is a positive
safe integer; uptime is a nonnegative safe integer; cumulative counters and scaled
measurements are canonical decimal uint64 strings. UTC timestamps follow the parser.

`host` has exactly `scope:agent-visible-os`, `cpu`, `memory`, `load`, `filesystem`,
`network`. Each source has `availability:available|unavailable|unsupported`.
Unavailable/unsupported scalar measurements are null, never fabricated zeros.

| Source | Closed measurement fields after availability |
| --- | --- |
| CPU | `logicalProcessors`, `totalTicks`, `idleTicks`, `ioWaitTicks` |
| Memory | `totalBytes`, `availableBytes` |
| Load | `oneMilli`, `fiveMilli`, `fifteenMilli` |
| Filesystem | `scope:agent-root-filesystem`, `totalBytes`, `availableBytes` |
| Network | `scope:agent-network-namespace`, `limit:16`, `available`, `returned`, `omitted`, `truncated`, `interfaces` |

CPU total excludes duplicated guest accounting; idle and iowait remain explicit
cumulative tick sources. Available CPU count is positive and bounded; idle+iowait
cannot exceed total. Memory/filesystem available bytes cannot exceed total.
Load values are thousandths of the OS load average, not CPU percent.

Network inventory is bounded to 128 interfaces, returns at most 16 sorted unique
entries and exact omitted/truncated coverage. Each entry has exactly `name`,
`rxBytes`, `txBytes`; names use the parser's bounded ASCII character set. Exceeding
source bounds makes the source unavailable rather than silently claiming complete
coverage. Unsupported/unavailable network uses an empty inventory, not zero counters
for real interfaces. Raw counters are scoped to the visible namespace, not per-rule
payload or billing, and interface reuse cannot be detected from a name.

## ACK And Continuity

ACK has exactly `hostTelemetryVersion:1`, `kind:host-telemetry-ack`, `nodeId`, `bootId`,
`sessionEpoch`, `sampleEpoch`, `sequence`, `stored:true`, UTC `receivedAt`,
`source:agent-reported`, `executionAuthorized:false`. The exporter checks request
binding before accepting it. A checkpoint commit precedes ACK; replay/conflict/order
validation is independent of process/Forward sequences and execution messages.

CPU ratios require same current Node boot/session, same sample epoch, adjacent
sequence, increasing uptime, unchanged logical CPU count, available sources and
no reported drop or cumulative-tick regression. Otherwise display explicit continuity
status and null derived CPU, never a zero. Network remains raw only; no cross-name
or same-name-reuse rate inference. No health, execution permission or settlement.

All code and Schema remain unverified. Concentrated final-source Actions acceptance
must cover strict parsing, Linux/unsupported sources, bounds, resets/replays, missing
ACK, timeout/admission, restore and Console; none was run in this slice.
