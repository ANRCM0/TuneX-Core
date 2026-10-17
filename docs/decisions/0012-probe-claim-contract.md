# ADR-0012: Non-executable remote Probe claims and host verification

Status: accepted implementation direction; working-tree implementation; functional acceptance pending.
Date: 2026-10-17 (Asia/Shanghai).

Follow-up: [ADR-0013](0013-probe-delivery-authority.md) adds internal bounded
offer/status ports and independent consumed withdrawal with migration 0016.
The existing claim wire contract and non-executable host hook below are unchanged.

## Context

[ADR-0011](0011-probe-permit-authority.md) provides internal issuance, durable
single-use consumption and shared issuance reservations. Instance registration
is not authority to probe, and an internal SQL row is not an executable wire grant.
The next increment must expose consumption without bypassing the absent
independent continuous authorizer, dispatcher or result receiver.

## Decision

Add independent `POST /agent/v3/probe/claim`. It accepts a known server-issued
permit ID, current Node/boot/session and registered random instance/generation.
There is no poll, list, discovery, remote issue, caller-selected target, timeout,
binding, actor, fingerprint or timestamp. Invalid/unknown/replayed IDs never
create records. This is an optional additive Probe contract, not an ADP/3
execution extension or a new capability advertised by the ordinary Hello.

The API's actual authorized TLS peer determines the fingerprint and Node;
the session header must equal the closed body. `ProbeClaims` delegates to the
existing `ProbePermits.consume` transaction. It does not open a second owner
transaction, inspect/write tables or substitute Bearer/header identity.
Original Actor authorization, exact binding, current instance, current machine,
deadlines and shared budget rules remain in that owner.

The acknowledgement is constructed only after the consumption transaction
commits. It contains the exact request identity, full binding, bounded timeout,
issue/expiry/consumption/server times, `state: consumed` and
`executionEnabled: false`. It omits actor/scope/fingerprint/target and all secret
material. An expired or inconsistent post-commit receipt is rejected, not
refunded. A lost acknowledgement leaves the SQL permit consumed; replay must
fail, including after application restart. SQL budget/history is still not an
independent rollback-resistant authority.

## Shared validation

[Probe claim v1](../protocol/probe-claim-v1.md) defines a closed 4 KiB contract.
The schema generates Go types; independent strict TS/Go parsers share 55 vectors.
Reject missing/extra fields, duplicate keys at any depth, unsafe numbers,
invalid IDs/digests/calendar dates, cross-protocol messages and typed bypass.
Require full binding identity to equal the envelope, a positive issue window
of at most two seconds and `issuedAt <= consumedAt <= serverTime < expiresAt`.
The response checker compares every request identity, not just permit ID.

## Agent host boundary

The explicit, unexported `Runner.claimProbe` hook is not called by Run, polling,
registration maintenance or a machine command. It is exercised only in Actions
tests until dispatch/continuous authorization is designed. It requires a live
registered instance and Runner-owned current Direct TCP execution binding before
HTTP, validates a request through the strict parser, and burns the permit ID
under Runner's mutex before I/O. IDs are never evicted under that instance;
capacity 256 denies further claims. Failure, timeout, cancellation, denial,
late reply and lost acknowledgement never clear an ID or auto-retry. A newly
registered random instance has a new cache; SQL consumption and original
instance binding still prohibit reuse of old permits across rotation/restart.

HTTPS uses the established Control client and actual client credential, rejects
redirects, limits body to 4096 bytes and duration to two seconds, and ties request
cancellation to the current registration context. No Runner lock spans HTTP.
After response parsing and exact echo checking, compare every binding field to
the locally supplied, already authorized binding. Validate server time through
the existing authorization Guard, then anchor remaining lifetime to the local
monotonic timestamp taken before the request. Subtract policy clock uncertainty
and clip to current instance and execution deadlines. Recheck the same current
registration, fingerprint, Guard, ticket, Snapshot and live assignment after
remote work. Insufficient remaining lifetime or excessive uncertainty denies;
never extend the two-second window to accommodate a slow exchange.

The result is an internal value receipt, not `probe.Permit`, `probe.Grant`, a
callback claiming continued remote authority or a Gate execution input. No
executor is invoked. In particular, a consumed receipt does not prove that an
independent permit remains unrevoked after the reply. The static boundary check
rejects execution construction/calls and production hook wiring in this slice.

## Compatibility and protected state

No new SQL migration: use 0015 and Control profile `adp3-probe-permits-v1` from
ADR-0011. Core, existing ADP/3 and Probe hello/instance messages, execution
Journal, authority high-water, Forward leases and driver registry are unchanged.
Older Controls return an error for the optional endpoint; no fallback may turn
registration or negotiation into permission to probe. Claim failure is not
permission to modify or terminate an otherwise valid Forward deployment.
Recovery still quarantines issued permits and current instances while preserving
closed permits and budget clock. There is no new receipt persistence/replay
format and no new startup or recovery action.

## Evidence and next slice

Authored and wired into Actions, not locally executed:

- Two TS contract groups with the 55 shared vectors and typed/echo isolation.
- Four Control adapter groups for actual machine identity, minimized receipt,
  pre-owner rejection, post-commit failure and no-mTLS denial.
- One Go parser/typed echo group, five Go host groups covering all binding
  dimensions, local authority withdrawal, lost replies/redirects, concurrent
  burn and bounded cache.
- Four real mTLS/MySQL groups covering concurrent single winner, restricted
  table ownership, malformed/forged requests, original Actor/topology/machine
  withdrawal and pre-commit rollback. Existing permit-owner concurrency and
  recovery acceptance stays in place.

Local verification is syntax/types/contract-generation/boundaries/Go vet only.
No matching-SHA functional Actions acceptance is claimed. Next: bounded delivery,
independent continuous permit withdrawal and a result contract. Only after those
boundaries close may the host convert an online authority into a one-use Gate
grant; then prove real connect-only behavior, interruption and no application
payload in Actions. No UI "healthy" or real Probe capability is claimed here.
