# Resource Usage Observation v1

Status: P source candidate; unverified. Foundation decision: FR-0035.

`POST /agent/v3/resource-usage` uses the existing Agent mTLS and
`x-tunex-session-epoch` authentication. Closed version-1 body:

```json
{
  "version": 1,
  "nodeId": "node",
  "bootId": "boot",
  "sessionEpoch": 1,
  "reportSequence": 2,
  "snapshotGeneration": 3,
  "buckets": [{
    "bucketId": "bucket",
    "scopeId": "scope",
    "actorId": "actor",
    "revision": 1,
    "startsAt": "2026-10-01T00:00:00.000Z",
    "endsAt": "2026-11-01T00:00:00.000Z",
    "consumedBytes": "1200"
  }]
}
```

Maximum 512 KiB and 1024 sorted unique buckets, canonical UTC millisecond periods,
safe positive counters, canonical decimal consumption through 9007199254740991.
The reference must exactly match the node's latest accepted Runtime report and
current boot/session. Credential expiry, revocation and retirement are rechecked
inside the projection transaction. Unknown fields and versions are refused.

Original Journal -> state.ReadRuntimePayloadUsage (original lock, authenticate and
clone) -> observationwire.EncodeResourceUsage -> Runner after original Report ACK
-> native HTTP body parser -> ResourceUsage public API -> injected same-transaction
store/report lock and credential check -> resource-limit policy/bucket binding ->
monotonic sample and digest receipt commit. Observation failure does not retry or
change the accepted report; a later report sends a new cumulative sample. Old
Control can return 404. Original ADP schemas and Journal format are unchanged.

`GET nodes/:node/payload-limits/:actor` retains original membership/resource access
rules: self requires grant, owner governance permits authorized inspection.
Historical command receipts keep the old four-field unavailable consumption.
New production reads return consumption with status unknown, stale, policy-outdated
or fresh; usedBytes/remainingBytes are strings or null. New `activePeriod` is null
or the currently configured period, independently of the latest configured head.
No matching active policy means no active allowance, not an automatic next period.

Freshness uses the accepted Runtime report's Control receipt time, never the
Agent's clock or an observation replay. A different current epoch is stale. A
sample for an old policy revision preserves usedBytes but hides remainingBytes.
Fresh remainingBytes is max(0, byteLimit - consumed), or null without a byte cap.
It is an upper bound on currently available allowance: new debits can occur after
sampling. It is neither billing nor exact delivered bytes nor execution authority.
Unknown/stale sample is never zero usage. Retained omitted buckets are not erased.

0043 creates resource_usage_heads and resource_usage_samples under this policy
owner. Upgrade Control first, then Agent. Use reviewed Control profile
adp3-resource-usage-v1; all older profile ceilings and Agent profiles stay intact.
Source cases cover rollback, replay, superseded sessions, malformed decimal,
foreign identity, stale/unknown policies, over-limit consumption and future heads.
They have not been executed. Physical, load and recovery evidence remain open.
