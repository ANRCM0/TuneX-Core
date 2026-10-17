# Explicit Path Publication v1

Status (2026-10-17): implemented and statically checked; functional/UI/network
acceptance is Actions-only and remains pending for the exact commit. Decision:
[ADR-0025](../decisions/0025-explicit-path-batches.md).

## 1. Ownership and Frozen Selection

This completes the authored multi-rule publication portion of C1, not C1
acceptance. It reuses the [original command queue](native-rule-management-v1.md),
[immutable templates](native-path-templates-v1.md), and
[same-transaction path binding owner](native-path-bindings-v1.md).
There is no bulk endpoint, durable Batch, new executor, authorization owner,
database migration, Agent feature or machine/Journal change.

The path panel explicitly inspects a target template revision (1-64), immutable
config/digest and exact Profile digest. The current impact page offers at most
ten selected available changes, in selection order. Unchanged, archived,
recovery-suspended and incompatible rows cannot be selected. Target/form edits,
paging, refresh/failure, single-rule submission and disconnect clear selection;
stale detached controls cannot select old rows. This remains a READ COMMITTED
page, not a scope-wide snapshot or proof that every referenced rule is included.

Prepare Explicit Path Batch performs no request. The original queue detaches
each source spec, expected Forward revision, concrete proposed spec, target
selection and Profile digest, and allocates a distinct original key per row.
The dialog displays both specs, command body, CAS and interruption limits before
consent. Queue validation derives the target path/Profile itself: target,
ingress/listener, enabled intent and exact business protocol set must not change.
No latest revision, caller-supplied Endpoint override or automatic publication is
used. A changed binding with equivalent expansion is valid metadata-only work.
Later input or page refresh cannot silently replace the frozen queue.

## 2. Serial First Dispatch

At most one HTTP call is in flight. Each has a five-second client deadline, not
a deployment deadline or availability promise. Each first dispatch, after
explicit consent, sends:

```text
POST /api/v1/scopes/{scope}/forwards/{id}/path-preview
{expectedRevision, template: {templateId, revision, configDigest}}

POST /api/v1/scopes/{scope}/relay-plan
{exact frozen proposed ForwardSpec}

PUT /api/v1/scopes/{scope}/forwards/{id}/path-binding
Idempotency-Key: {unchanging independent per-row key}
{expectedRevision, template: {templateId, revision, configDigest}}
```

The path proposal must match the frozen source/proposed specs, Forward/CAS,
exact template selection and spec-change boolean, and return `previewOnly:true`,
`reserved:false`, `executionAuthorized:false`, `fullPlanAuthorization:false`.
The Relay plan must match the exact Profile ID/revision/digest and return
`reserved:false`, `executionSupported:false`, `runtimeEnabled:true`.
Unknown or mismatched observations do not become replacement proposals.

The PUT independently rechecks original management, grants, target policy,
recovery eligibility, current CAS, template/archive/Endpoint/Profile references,
gates, capacity and resources under the existing original acceptance transaction.
Preflight success is not authority, a reservation or a CAS lease. Concurrent
changes may reject this PUT; no re-read/substitute key or rollback is automatic.
Binding quota/write failure still rolls back all original owner changes.

The queue validates and retains the path receipt (exact selection, bounded
sequence and historical Forward revision), not just a generic Operation ID.
Changed expansion must yield the next Forward revision and original Operation.
Equivalent expansion retains Forward CAS with no Operation; queue `unchanged`
means unchanged executable spec, while `pathBinding.changed` can show a newly
recorded provenance selection. The original separate provenance-CAS limitation
still applies to concurrent equivalent-spec attachments.

## 3. Failure and Uncertainty

The existing states remain `pending/checking/sending/accepted/unchanged/rejected/
preflight-failed/uncertain`. Complete recognized initial client rejections are
independent per row; later pending rows can continue. Server/network/aborted or
malformed preflight means no path intent was sent, stops the tail, and needs
renewed consent to Recheck Same Proposal. That action repeats both original reads
on the frozen inputs and then, only if valid, sends the unchanged original PUT.
It does not resume the tail automatically.

A sent write with unknown or malformed acceptance may have committed. Replay
Same Command sends only its original path/body/key, without either preview,
new CAS, new selection or replacement operation. A current 4xx denial of replay
cannot prove the original was not accepted and retains uncertainty. The tail
stays blocked until resolved or explicitly discarded. After resolution, Continue
Unsent Commands requires fresh consent and performs each remaining first-write
preflight independently. There is no background retry/resume or compensation.

Stop during either read cannot send a late PUT; stop during a write is uncertain.
Close/disconnect drops tab-memory work only and does not cancel or undo a remote
commit. Accepted is not applied, healthy or traffic-verified. Same-listener
replacement can interrupt traffic; TCP uses bounded drain/authorization expiry,
UDP may reset associations and lose datagrams. Return to an old path is a new
explicit authorized revision/Operation/generation, never Snapshot replay.

## 4. Authored Regression and Real Fixture

Nine queue regressions cover ten-row detachment, exact expansion boundaries,
metadata-only receipt, independent stale/grant/quota rejection, mismatched path
proposal, unknown second preflight, committed-response replay/current denial,
malformed receipts and stop/disconnect across all phases. Four selection
regressions cover bounds, unavailable states, detached/stale controls and declined
queue replacement. Existing Profile/enable/disable/retry regressions remain.
All are included by the existing `npm run test:web` glob in Actions, not run locally.

`scripts/phase2/path-batch-console.ts` extends the existing Linux Actions-only
3/4/8-Agent Chromium flow after its single-rule switch and before copy cleanup.
Separate authorized API fixture setup creates a second disabled Forward, a new
full-path template and metadata-only bindings for that rule and the active copy.
Publishing a shorter revision does not change either rule. The browser selects
both current references and freezes CAS; a separate fixture writer changes only
the disabled rule's target after freezing. Its fresh proposal gets a definite
CAS rejection without a path-binding write; the independent active copy takes
the shorter path and passes real native TCP/UDP.

A newly published full-path revision is another explicitly selected batch. The
first active-copy PUT really commits, then a browser route drops its response.
The tail stays pending; explicit identical replay obtains the original receipt
without either preflight. Only renewed consent continues the disabled tail,
which attaches new provenance without an Operation/revision/generation. The
active copy is back on the full ordered path and passes real TCP/UDP. Desktop
partial/uncertain and 390px screenshots use `console-multihop-*.png` only.

The helper asserts four browser path proposals, three Relay plans, four binding
attempts with three distinct keys, and nine separate fixture setup/race/cleanup
commands (including one explicit race). The disabled extra rule keeps its own
two physical slots per Node, never opens business listeners, and original delete
releases its ownership. The parent then uses original CAS/Operations to stop and
delete the active copy, checks source-only resources and unchanged source
revision/spec/Profile lock, and verifies source TCP/UDP again. Browser opt-in
adds a third ingress port and six downstream TCP ports solely to support three
independent Forward reservations. These are selected ports, not OS reservations.

The complete page session now asserts 21 browser intent attempts / 18 keys,
eight Relay plans and seven path proposals. API fixture commands are separate,
not browser gestures or spontaneous failures. No new job, artifact surface or
production feature enablement is introduced. Schema 0019 compatibility, original
recovery suspension/key quarantine and historical provenance retention are
unchanged. Discard/replay is not a recovery bypass.

All scenarios are authored/CI-wired, not executed evidence. Exact-SHA Actions,
frozen-source matrix review, measured interruption/UDP loss, physical/public NAT
and long-run/operational gates remain separate. C1, B1/P1 and whole-project
acceptance remain open; no atomic rollout, zero downtime, physical sharing or
automatic routing is claimed.
