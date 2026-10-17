# ADR-0016: Bounded Agent-reported Probe result receipts

Date: 2026-10-17 (Asia/Shanghai).
Status: accepted incremental direction, working-tree implementation, Actions acceptance pending.

## Scope

Add the independent [result v1 contract](../protocol/probe-result-v1.md) and
`POST /agent/v3/probe/result`. This is result ingestion only, not execution
admission, remote issuance, a production Agent caller, a health aggregator or
automatic switching. The Core, production Runner, authorization/Journal, socket
executor and existing machine schemas remain unchanged.

The first supported observation is zero-application-payload numeric Direct TCP
connect from `agent-direct-egress`. Only connected/tcp-connected and
unreachable/tcp-connect-failed pairs are representable. Timeout, cancellation,
withdrawal, unsupported and unknown are not rewritten as a network failure.
The source is explicitly `agent-reported`; accepting a report authenticates its
association, not independent proof that an uncompromised physical Agent dialed.
Application health and acknowledgement health remain unknown.

## Owner and acceptance

The closed machine adapter delegates to `ProbePermits.receiveResult`, not a
second coordinator or transaction. Actual Node/fingerprint come from verified
mTLS and session comes from the checked epoch header. Actor/Scope/target and
authority are never accepted from the body.

The existing global SQL permit-budget lock serializes insertion, duplicate
handling, consumption and withdrawal across Control instances. In that same
transaction the owner requires an original consumed, unwithdrawn permit, exact
fingerprint/instance, full binding, timeout and original issue/expiry/consume
times. It reauthorizes the original Actor, Forward and Node Grant and locks
current machine, credential, registered instance and published binding. A
duplicate does not bypass these checks.

Measurement time must not be in the future at the server. Measurement and
validity are within original consume/expiry, and validity and permit must still
be live after result lock waits and writes. No grace, clock-skew extension or
late-result promotion is added. Future Agent serialization must validate and
conservatively map its clock evidence or discard uncertain results; it must not
clamp a timestamp to turn invalid evidence into a measurement. This slice has
no such serializer/caller, and does not claim tolerance of skewed Agents.

## Deduplication and bounds

The permit ID is the single-attempt result key, not an additional run/authority
ID. One immutable observation is stored per retained permit. Content identity
is RFC 8785 JCS SHA-256 of the validated request with only requestId removed.
Fresh requestId values correlate acknowledgements without creating new results.

An exact repeated observation returns the original acceptedAt and duplicate=true
without another insert or budget-clock write. Different content conflicts;
there is no last-write-wins update, reconsumption, refund or expiry renewal.
Corrupt stored bodies/digests/timestamps fail closed, without repair/overwrite.
First insertion and budget clock update roll back together on write or existing
pre-commit maintenance guard failure. The adapter constructs the receipt only
after commit and rejects stale/expired acknowledgements. A lost response does
not erase the committed observation; an identical repeat is safe only while
all original acceptance checks still pass. No automatic Agent retries are added.

Migration 0017 creates the permit-owned `probe_results` table with primary/FK
permit ID, bounded JSON, digest and acceptedAt. No result is backfilled from old
ACKs or reports. Existing permit cap 256 bounds result row count; the FK cascades
deletion only when original permit pruning is allowed after expiry+1000ms.
Idle expired rows can remain until normal owner pruning, so this is not an
automatic timed retention service. The cache is not durable telemetry history.

Results do not change permit consumption, withdrawal, issuance quotas, instance,
Forward, deployment, Snapshot, lease, Journal or authorization high-water. The
existing recovery path preserves result rows while quarantining issued and
withdrawing consumed permits. Preserved results cannot restore current authority.
Control-only profile `adp3-probe-results-v1` explicitly reads through 0017;
older readers and Agent use of that profile are rejected. DDL still requires
maintenance/backup/compatibility review even with Probe disabled.

## Evidence and next slice

127 shared TS/Go vectors, two TS contract groups, two Go contract groups, five
machine-adapter groups, nine owner transaction groups, five real mTLS/MySQL
groups and one upgrade matrix group are authored and Actions-wired. New real
result HTTP tests use SELECT+LOCK TABLES plus INSERT on results and UPDATE on
the budget only, deny execution/permit/result updates and compare protected
table inventories. The suites cover concurrent identical/conflicting results,
immutable receipts, original authorization, malformed/forged requests, rollback,
corruption, recovery preservation and FK cleanup. Fixtures report synthetic
measurements and are not actual Agent target execution or physical-host proof.

Local work is static checks only. No new tests or migrations have run locally;
there is no matching-SHA Actions acceptance or production enablement.
Next: one-use host execution admission and result serialization, then a separate
default-off production loop and real Agent + Control + MySQL combined acceptance.
