# Explicit Profile Publication v1

Status: Implemented and statically checked; functional acceptance is Actions-only
and remains pending for the exact commit. Decision: [ADR-0022](../decisions/0022-explicit-profile-batches.md).

## 1. Original Ownership

This extends the [existing Console command queue](native-rule-management-v1.md),
using [Profile impact](native-driver-management-v1.md) and original
`POST relay-plan` / `PUT forwards/{id}` interfaces. It adds no bulk API, persistent
Batch, executor, new rule authorizer, resource ledger, database migration, Core
field, machine protocol, Agent flag or protected Journal mutation.

Publishing a Profile revision still leaves all Forward references unchanged until
separate explicit updates. A selected batch is a tab-local list of independent
commands, not an atomic rollout or proof that all paths can execute together.

## 2. Selection and Frozen Proposal

Only an explicit, current impact page with an immutable target revision/digest
offers selection. At most ten changed, non-recovery-suspended rows are retained.
Unchanged rows are not selectable. Paging, revision input, query/preview refresh,
dialog close and disconnect clear selection and invalidate detached controls.

Prepare Explicit Profile Batch sends no request and hands detached rows to the
original queue. Each row validates source Profile/revision, Forward expectedRevision,
and that proposed spec differs only in the explicit `transport.configRevision`.
Target Profile ID and digest are frozen; enabled, protocol, Node order, listener,
target and all other desired configuration remain unchanged. Each row gets a
distinct original PUT key; the dialog shows the full spec and expected revision
before consent. A later input/list refresh cannot silently replace the frozen plan.

No Node grant, resource availability or recovery eligibility is leased by the
impact page. UI suspension checks are advisory; Control remains the final owner.

## 3. Serial First-Write Path

At most one request is in flight; at most ten rows per local plan. Each HTTP call
uses the existing five-second client deadline. First dispatch performs two separate
requests for each selected row:

```text
POST /api/v1/scopes/{scope}/relay-plan
{exact frozen proposedSpec}

PUT /api/v1/scopes/{scope}/forwards/{forwardId}
Idempotency-Key: {unchanging per-row key}
{expectedRevision: frozenRevision, spec: exact frozen proposedSpec}
```

The plan must return the same Profile ID/revision/digest, `reserved:false`,
`executionSupported:false` and `runtimeEnabled:true`. The queue stores only bounded
Profile/checked-time/non-authority metadata, not an execution authorization. Plan
success is not a CAS lease, reservation, active session or health/traffic proof.

The PUT then independently rechecks original membership, use grants, policies,
current revision, feature gates, capacity and resources within the original owner
transaction. It remains the sole writer of desired intent and the single Runtime
ledger. A concurrent change between preview and PUT must reject the old CAS; there
is no automatic re-read, revised expectedRevision, replacement key or compensation.

## 4. Preflight Versus Write Uncertainty

The original `pending/sending/accepted/unchanged/rejected/uncertain` states are
extended with:

| State | Meaning |
| --- | --- |
| checking | Read-only first-write plan in flight; no PUT started |
| preflight-failed | Plan unavailable, aborted or malformed/mismatched; no intent sent; tail stopped |

Complete recognized initial client rejections, including a denied plan or stale
PUT CAS, retain per-row rejection and allow independent pending rows to continue.
Unknown preflight stops dispatch and blocks Continue Unsent Commands. After fresh
consent, Recheck Same Proposal checks that exact frozen proposal and, only on
success, sends its original PUT/key. It does not automatically resume the tail.

Unknown PUT response may already be committed. After fresh consent, Replay Same
Command sends only the original PUT/key/body/path. It does not perform another
plan, select a newer Profile, revise CAS, replace keys or resume pending rows.
A current 4xx rejection of an uncertain replay does not prove the original was
unaccepted: the row stays uncertain, retains the original command and blocks the
tail. This correction also applies to the earlier enable/disable/retry queue.
Operators may inspect known Forward/Operation facts; local discard is explicit
and is not rollback or cancellation.

Stop during a preflight cannot later send PUT from a late response. Stop during
a write is uncertain. Close/disconnect behavior remains the original bounded
queue contract: no remote cancellation/undo, tab-memory-only plans and no automatic
background resume. Acceptance remains distinct from applied or healthy status.

## 5. Authored Regression and Real Fixture

Eight new queue regressions cover ten-row detached proposals, strict only-revision
changes, first-plan grant denial, post-plan CAS failure, unavailable/mismatched plans,
stop/disconnect, unknown-write replay without new preflight and rejected replay
retaining original uncertainty. Four selection regressions cover ten-row limits,
stale/paged/closed selection, suspended/unchanged rows and malformed target digest.

`scripts/phase2/profile-batch-console.ts` extends the existing Actions/Linux-only
real Relay Chromium fixture. It publishes two new Profile revisions, freezes a
two-reference batch, deliberately races one copy via a separate authorized writer,
and checks one rejected old CAS and one accepted source update with real TCP/UDP.
It then drops a source update response after actual committed acceptance, observes
uncertainty, and verifies exactly the same key/body is replayed without another
plan or replacement Operation. The source performs real TCP/UDP again, and the
existing fixture deletes/cleans the copy and later safely deletes the source.

The redacted evidence separates the one fixture race write, UI update attempts,
Profile publication calls, fresh plan count and replay behavior. Screenshots use
the existing `console-tunnel-*.png` allowlist; no PKI, raw protected state, HAR or
traces are uploaded. Neither this browser topology nor injected race is independent
physical-host, spontaneous failure or long-run acceptance.
Unsupported Relay browser opt-in rejects before any PKI/artifact/database setup;
the static boundary check also guards that ordering.

Local work is syntax/type/contract/boundary/docs checks only; no functional,
MySQL/network/browser/container execution or exact-SHA Actions evidence is claimed.
The follow-up [real multi-hop copy flow](../testing/native-multihop-console.md)
is authored/CI-wired, not executed; broader B1/P1/project acceptance remains pending.
