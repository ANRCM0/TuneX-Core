# ADR-0014: Non-executable bounded Probe delivery and status contracts

Date: 2026-10-17 (Asia/Shanghai).
Status: accepted protocol direction; working-tree implementation;
functional acceptance pending Actions.

## Decision

Expose [ADR-0013](0013-probe-delivery-authority.md)'s existing offer/check ports
through independent mTLS `POST /agent/v3/probe/poll` and `/probe/status`.
Use one strict [delivery schema](../protocol/probe-delivery-v1.md), shared TS/Go
vectors, generated Go types and closed machine adapters. The API cannot reach
`probePermits` directly. The adapter has only offer/check methods, performs no
transactions, network work or mutations, and builds minimized responses only
after the original owner's transaction has completed.

Poll discovers null or one current issued ID with its original complete binding
and bounds. It never issues, reserves, consumes, renews or guarantees a claim.
Status observes an already consumed, unwithdrawn ID after full reauthorization.
It never issues a lease, consumes again, refunds a reservation or clears the
sticky withdrawal fact. Identity is taken from the verified connection; request
Node/session must agree. Empty mailboxes do not bypass current machine checks.

Keep `executionEnabled:false` for every response and `state:consumed` for status.
Expose no Actor/Scope, fingerprint, target, internal owner view or mutable
execution permission. Use the existing owner/global budget lock and guarded
transaction; no independent queue, callback registry, poll state or new authority.

## Correlation and freshness

Both closed requests carry a 64-hex `requestId` for exact response correlation.
It is not a durable one-use token: the server does not store or enforce its
uniqueness and repeated read-only requests remain valid. Future consumers must
generate a fresh random request ID before each exchange. They must also retain
the prior consumed receipt and compare every binding and original deadline.

Expose owner `observedAt` / `checkedAt`, original issue/expiry/consumption times
and adapter `serverTime`, with a maximum 250 ms server-side observation age.
Reject invalid/backwards/late clocks and post-commit expiry before constructing
an acknowledgement. Reparse typed values and responses in both languages,
including exact echo checks, UTC milliseconds, safe counters and closed nested
objects. Body limit stays 4096 bytes.

The 250 ms bound is NOT an Agent cancellation SLA or execution lease. It excludes
transport and scheduling delay and does not keep authorization valid after the
transaction. Status may race with later revocation, so a positive result alone
cannot permit work. A future monitor must use a pre-request monotonic instant,
an explicit end-to-end staleness budget and conservative immutable deadlines,
close permanently on uncertain outcomes, and preserve Runner/Gate safety limits.
No monitor or executable conversion is introduced here.

## Compatibility and ownership

No changes to Core, old ADP/3, Probe hello/instance/claim, Runner, Journal,
Authority high-water, execution drivers, Gate or registration flags. Agent adds
only an isolated parser package, not an HTTP client or production polling loop.
The existing claim hook remains statically forbidden from production admission.

No new migration or compatibility profile: Control uses the existing 0016
`adp3-probe-withdrawals-v1` schema boundary. Historical profiles keep their reader
ceilings. Do not deploy the new status service against a pre-0016 permit schema:
missing withdrawal state must fail closed, never imply continued authority.
Recovery/backfill preserve ADR-0013's original consumed/withdrawal facts and
budget. This slice does not add a full backup scenario or acceptance claim.

## Evidence and next slice

Authored and Actions-wired, not functionally executed locally:

- 184 shared vectors, 2 TS contract groups and 2 Go groups for closed requests,
  empty/single offers, complete bindings, safe numeric/Unicode parsing,
  time ordering/250 ms boundary, typed echo and cross-protocol rejection.
- 6 Control adapter groups for actual machine identity, output minimization,
  immutability, original-owner denials, maintenance failure, post-commit expiry,
  invalid clocks, inconsistent owner results and no Bearer substitution.
- 5 real HTTPS/mTLS + MySQL groups for read-only successful/denied observations,
  singleton offer -> one-use claim -> status -> sticky withdrawal, injection and
  empty-mailbox association refusal, current source withdrawal and guard failure.

The read-only fixture uses SELECT plus LOCK TABLES, not DML grants; locking is
needed for the existing FOR UPDATE owner reads. Setup/consume writes use a
different principal and all table digests are compared around observations.
Existing restricted claim/registry, recovery, Direct/Relay and Go race suites
remain wired. No migration, functional or matching-SHA Actions pass is claimed.

Next: bounded Agent polling/status exchange and fail-closed work monitoring with
explicit elapsed-time, concurrency, non-resurrection and cancellation bounds;
then result ingestion and one-use execution admission. Remote issuer/UI and
actual connect-only dispatch remain separate, not implied by this protocol.

Follow-up: [ADR-0015](0015-probe-agent-authority-watch.md) adds internal bounded
Agent exchanges and consumed-receipt observation monitors without production
polling or executable admission. The evidence above remains this historical
protocol slice's scope, not acceptance of the later monitor.
