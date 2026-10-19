# Control Probe Storage Boundary V1

Date: 2026-10-18. Source candidate; unverified and not accepted.

## Public Sources And Ownership

L1 framework/public.ts exports Probe history storage interface 1 from
probe-history-store-ports.ts: parameterized historical capture/result/metadata,
plan head/decision/failure/query envelopes, supplied-transaction stores and
synchronous owner values. Binding, service, challenge/proof, config, state/code/
status, decision source/outcome and failure vocabulary remain outer type arguments.
These are persistence contracts, not executable permits, a scheduler or an issuer.
No native wire import, product parser, alert rule or authority logic enters L1.

Existing modules/probe-run-ports.ts and probe-plan-ports.ts retain product names as
exact specializations, plus original capture/recorder/issuer contracts. The native
TLS/echo value types, closed kinds, policies and acceptance receipts stay outside
L1. No capability, default, protocol/schema/package or actual Probe kind changes.

L2 MySqlProbeHistoryStore and MySqlProbePlanStore contain one copy of the original
SQL and native row/JSON/integer/boolean mapping. They import public lower contracts/
Core/SQL helpers, not L3 types, classes or parsers. Existing server/control roots
provide separate frozen probeRunStorageValues and probePlanStorageValues. The
original history recorder still captures original-owner changes in the same
transaction; no new history/permit/authority owner or foreign writes are added.

## Owner Callbacks And Transactions

Read/head/decision/immutable callbacks invoke the original product parsers/digests
synchronously at their old call points. Native size/column/presence checks stay at
their original points, with the same exception mapping and no additional await,
retention, retry, transaction or connection. Optional/missing versus null fields,
JSON property order, binary filters/order and immutable comparison remain source-
preservation intent; the staged echo columns/branches stay exactly as existing
unfinished source, not new support or enablement.

Two actual product rules move out of the SQL file into L3 values:

- Expired active-plan conversion returns the original copy with state/revision/
  nextRunAt/lastCode/updatedAt changes, or null. The lower store calls it in the
  original locked create loop and invokes the original put path only on a result.
- Savepoint failure classification applies the original ControlError/code/status/
  retryability allowlist. Null rethrows the exact original error; an accepted
  failure yields the same code/status only after rollback and release. The one
  permitted retryable-code exception is unchanged.

Savepoint -> action -> classify -> rollback-to/release on accepted failure, or
release on success, retains its original ordering. No unclassified error is
converted to a decision or automatically retried. The original issuer/action and
caller transaction remain authoritative; no new execution delegation is created.

## Compatibility And Native Storage

Old MySqlProbeRuns/MySqlProbePlans remain zero-argument stateless public prototype
wrappers. Run insert/put still dispatch through the original public get override;
plan create through lockScope/put, and put/append through get, at old transaction
positions via precise lower hooks. Hooks are not exposed by ordinary storage
ports or permission for modules to bypass another owner. Both original static
quarantineRecovery methods remain aliases to the original single SQL bodies.
The existing recovery script uses lower static entries directly; it was edited,
not executed. These precise legacy paths are not whole-package exemptions or
new composition roots.

History retains seven-day/1024-row/16-prune limits, missing-head loss accounting,
immutable duplicates, revision+1/CAS and unchanged native 31-column encoding.
Plans retain 32 heads/16 decisions, locked create/expiry/terminal-only eviction,
loss counters, revision/time/immutable checks, bounded decisions/history, due-header
deferral and original sticky recovery revision updates. SQL, locks, arguments and
relative parse/statement order are preservation intent, not verified equivalence.

## Remaining Debt And Acceptance

Probe permit/claim/result/recorder, finite-plan application, worker, manager HTTP,
Agent/Gate/watch and staged echo defaults remain unchanged. Product values still
contain native crypto/wire/format/time dependencies; other observability SQL,
native engines/private bindings and whole-repository classification still need
work. This extraction does not certify the entire Probe or storage subsystem.

Foundation item 36 requires exact frozen-source type/constructor/override/static/
root wiring, callback/SQL/row/lock/error/savepoint/rollback/CAS/retention/loss/
recovery and old behavior equivalence. Functional/MySQL/network evidence belongs
in authorized Actions. No tests/checks/type/syntax/boundary/format/build/scripts/
database/network/CI or Git operation ran for this extraction. Foundation and
parallel gates remain closed.

## Public History And Finite Plan Follow-Up (2026-10-19)

Original historical capture/read and finite plan rules/services/APIs/providers
now live under probe-history-owner/public.ts and probe-plan-owner/public.ts.
Original supplied-Tx recorder and issuer remain with the original permit owner;
no authority or SQL change. Old flat/application APIs/values/provider paths are
precise canonical leaf aliases, preserving legacy SQL hooks/static recovery.
Retained echo projection is L2; original service-selection parser is re-exported
through its previously missing public link. See
[owner chains](probe-history-plan-owners-v1.md), readiness73/74 unexecuted. Earlier
remaining-work statements are historical; other owners/full classification and
all behavioral/foundation acceptance remain open.