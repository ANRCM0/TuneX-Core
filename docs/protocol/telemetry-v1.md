# Node Process Telemetry v1

Status: implemented, unverified. Decision:
[ADR-0027](../decisions/0027-independent-node-telemetry.md).
Structural contract: [telemetry-v1 Schema](schemas/telemetry-v1.schema.json).

## 1. Transport and Independence

```text
POST /agent/v3/telemetry
Content-Type: application/json
X-TuneX-Session-Epoch: <current positive ADP session epoch>
```

The existing end-to-end Node mTLS middleware authenticates the certificate.
Node ID, boot and session in the sample must match that authenticated Node's
current recorded runtime session. Credentials are checked again in the intake
transaction. The endpoint accepts no query parameters; body maximum is 8192
bytes. Unknown/duplicate JSON keys, unsupported versions and malformed fields
reject. A response has at most 4096 bytes for the Agent exporter.

Telemetry does not extend ADP/3 messages, renew a lease, create an Operation,
mutate an Assignment or change Journal state. No capability in this channel
enables execution. `TUNEX_TELEMETRY=1` opts Control into collection and Agent
`--telemetry=true` independently opts the Agent into sampling. Both default off.
History queries do not enable collection or probe the Node.

## 2. Closed Sample

```json
{
  "telemetryVersion": 1,
  "kind": "telemetry-sample",
  "nodeId": "node-a",
  "bootId": "boot-a",
  "sessionEpoch": 1,
  "sampleEpoch": "0123456789abcdef0123456789abcdef",
  "sequence": 1,
  "capturedAt": "2026-10-18T00:00:00.123456789Z",
  "uptimeMs": 10000,
  "platform": "linux",
  "process": {
    "goroutines": 10,
    "heapAllocBytes": "1048576",
    "runtimeBytes": "8388608",
    "cpuTimeNanos": "10000000",
    "maxRssBytes": "16777216",
    "openFileDescriptors": 12
  },
  "runtime": {
    "snapshotGeneration": 0,
    "authorizationActive": false,
    "tcpStreams": "0",
    "udpAssociations": "0",
    "drainingInstances": 0
  },
  "droppedSamples": "0"
}
```

All fields are required; all three objects reject additional fields. Identifiers
follow the Core ID alphabet and length, while `sampleEpoch` is exactly 32 lowercase
hex characters. Session and sequence are positive safe integers; uptime and
snapshot generation are safe nonnegative integers. Platform is a declared GOOS
name, not a free-form dimension. Capture timestamps are valid UTC RFC3339 with
zero to nine fractional digits, years 1970..9999, no leap second or offset.

Byte values, cumulative CPU nanoseconds, stream/association gauges and failed
exports use canonical uint64 decimal strings, from `0` through
`18446744073709551615`, without whitespace or leading zeroes. These are not JSON
numbers. The TypeScript parser checks the exact upper bound; the structural Schema
alone does not encode every calendar/numeric boundary. Cross-language vectors
are deferred and not claimed as executed evidence.

Goroutines are bounded at 10000000, optional FD count at 1000000000, and draining
instances at 1000000. `cpuTimeNanos`, `maxRssBytes` and `openFileDescriptors` are
required but nullable when unavailable. Null does not mean measured zero.

## 3. Measurement Semantics

| Field | Meaning |
| --- | --- |
| `uptimeMs` | monotonic elapsed time since `Runner.Run` entry, not OS uptime |
| `heapAllocBytes` | Go allocated heap bytes at capture |
| `runtimeBytes` | Go runtime `MemStats.Sys`, not process private or host memory |
| `cpuTimeNanos` | cumulative process user+system CPU time where supported |
| `maxRssBytes` | peak process RSS where supported, not current RSS or host memory |
| `openFileDescriptors` | best-effort process FD directory count on supported Linux |
| `tcpStreams`, `udpAssociations` | sums of local execution-instance remaining gauges, including drains |
| `authorizationActive` | sampled Agent ticket check only, not current Control authority |
| `droppedSamples` | cumulative failed/unacknowledged export attempts before this sample |

Local execution gauges include native roles and deduplicate the same immutable
assignment/deployment/fence identity. They are not unique end-user connections,
business payload bytes or cross-node traffic totals. Samples are best-effort,
not an atomic OS/process/runtime snapshot. No final sample at termination,
complete tail coverage, host metric, packet loss rate or billing usage is implied.

## 4. Sequence, Admission and Receipt

Each exporter run creates a random sample epoch and attempts one sample every
ten seconds. It increments sequence per attempt, not per stored point. There is
one independent transport/request at a time, two-second timeout and no retry
queue. Failed/unrecognized acknowledgments increment `droppedSamples`; an
uncertain attempt may already have committed, so this is not exact point loss.

Intake serializes only the Node's telemetry checkpoint. A new point must have
advancing uptime/sequence; a new epoch cannot replace the same Node session's
exporter epoch. New authenticated Node sessions establish baselines. Exact
last-sequence/body replay returns the original stored receipt without append or
rate-budget refund. Older sequences or changed-body reuse reject. New points
arrive at most once per nine seconds per Node; capture time must be within five
minutes of server receive time. ADP report counters are independent.

After durable commit, HTTP 200 returns exactly:

```json
{
  "telemetryVersion": 1,
  "kind": "telemetry-ack",
  "nodeId": "node-a",
  "bootId": "boot-a",
  "sessionEpoch": 1,
  "sampleEpoch": "0123456789abcdef0123456789abcdef",
  "sequence": 1,
  "stored": true,
  "receivedAt": "2026-10-18T00:00:00.124Z",
  "source": "agent-reported",
  "executionAuthorized": false
}
```

ACK identity must match the original sample. Non-200, invalid/mismatched ACK,
timeout or `stored:false` is an exporter failure; it never affects execution.
Disabled collection is 503; admission/rate rejection is 429; session/sequence/
epoch/time conflicts are 409; original authentication errors remain unchanged.
There is no post-commit current-state lookup that can replace the durable receipt.
