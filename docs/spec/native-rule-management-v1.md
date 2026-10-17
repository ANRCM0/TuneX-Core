# Explicit Native Rule Management v1

Status: Implemented and statically checked; functional acceptance is Actions-only
and remains pending for the exact commit. Decision: [ADR-0020](../decisions/0020-explicit-native-rule-commands.md).

## 1. Ownership and Non-goals

This is a Console workflow over existing [Forward/Operation commands](control-api-v1.md),
not a new execution engine or generic bulk API. Forwarding owns desired intent;
Runtime retains authorization, resources, Operations, publication, cleanup and
recovery. No schema/migration, machine contract, Core or Agent Journal changes.

The product uses native Direct TCP/UDP, native TLS Relay and feature-gated ordered
multihop only. Copying a rule does not select a new driver, bypass feature gates,
share physical tunnel resources or manufacture health evidence.

## 2. Copy Proposal

From a Forward row, Copy opens the original matching editor with source configuration:

- New create intent, not an update to the source ID or revision.
- `enabled:false` initially; the user can explicitly edit the new configuration.
- Listener port is blank/required and must be selected again. No availability or
  reservation is inferred, even for a disabled copy: the original server validates
  and reserves its resources on acceptance.
- Direct uses the existing authorized candidate query and `directSpec` builder.
  Relay/multihop retain exact `transport.profileId/configRevision`, business
  protocols, target and ordered path and use the existing plan/build/submit flow.
  The source ingress is initially selected but not locked as an existing rule.
- No source ID, scope override, revision, current authorizer, Operation, applied
  generation, Probe or health is copied into the new ForwardSpec.

Source revision is descriptive provenance for a detached draft, not a persistent
template/binding. Later source edits cannot automatically publish this copy.
Existing create idempotency and conflict behavior still apply.

## 3. Current-page Enable/Disable Plan

At most ten checked rows from the currently rendered page are retained. A fresh
list render (including refresh/filter/page change) clears selection. Recovery-
suspended rows are unselectable; this is advisory UI behavior, not protection
against concurrent recovery or a replacement for the original recovery review.

Preparing a plan sends no mutation. Each row freezes a detached full native spec,
only changing `enabled`, plus its current `expectedRevision` and a distinct random
idempotency key. The dialog exposes the frozen JSON and expected revision before
consent. The request remains exactly:

```text
PUT /api/v1/scopes/{scope}/forwards/{id}
Idempotency-Key: {row-key}
{ expectedRevision, spec }
```

There is no atomic batch promise or server Batch resource. A revoked grant, stale
revision, conflicting port, unsupported plan, exhausted budget or lost connectivity
can affect one row independently. Every call traverses the original owner-owned
Forward acceptance and Runtime preparation in its own transaction. No speculative
authorization from the list/plan is reused by the server.

## 4. Bounded Dispatch and Outcomes

One in-flight command at a time; at most ten initial sends; each request has a
five-second deadline. The state of each row is:

| State | Meaning |
| --- | --- |
| pending | Never sent in this local plan |
| sending | One original command currently in flight |
| accepted | Validated acceptance IDs/revision; Operation is not yet necessarily applied |
| unchanged | Original PUT returned current revision and `operationId:null` |
| rejected | Complete initial client rejection (400/401/403/404/409/413/422/429); uncertain replay denial stays uncertain |
| uncertain | Network/abort/JSON/server error or invalid acceptance; may already have committed |

Definite rejections are preserved and the serial loop can continue to independent
pending rows. Any uncertain outcome stops the tail. The Console never invents a
new key, re-reads a revision to substitute a new command or starts automatic retries.
After renewed consent, Replay Same Command resends only that exact key/body/path.
It does not resume the tail; Continue Unsent Commands requires another confirmation.
Changing grants/intent can still cause replay to be rejected under original rules.

Stop aborts the current local request and stops the tail. That outcome is uncertain,
not a remote cancellation guarantee. Closing pending/uncertain work requires an
explicit discard warning. Disconnect clears/aborts all local state and discards
late callbacks; it cannot revoke committed work. Keys/plans exist only in tab memory,
with no storage, service-worker queue, export of credentials or cross-session replay
promise. The authoritative history remains the existing server idempotency/ledger.

Profile revision publication reuses this queue with a separate first-write
read-only plan stage and explicit same-proposal recheck; see
[Profile publication](profile-publication-v1.md). An uncertain write replay that is
currently rejected still cannot establish whether the original committed, so it
remains uncertain and does not release the unsent tail.

## 5. Explicit Failed Operation Retry

Operation detail includes its scope-authorized `forwardId` alongside existing
status, targetRevision, sourceOperationId, recoveryInvalidated and cleanupPending.
The existing same-transaction membership/read authorization is preserved.

The Console first GETs the selected Operation and its Forward (five seconds each).
It proposes retry only if the source is failed, not recovery-invalidated, still
latest, matches the current desired revision, and is not deleting/recovery-suspended.
Those preflight reads are not an authorization lease or a reservation. Server retry
again checks original current revision, failed source, management/Node/path authority,
capacity and recovery constraints inside the original command transaction.

Only explicit consent submits:

```text
POST /api/v1/scopes/{scope}/operations/{source}/retry
Idempotency-Key: {key}
{ expectedRevision }
```

JSON contains exactly that one field; duplicate JSON members retain the original
strict parser rejection. Retry returns a new Operation with sourceOperationId and
does not change Forward revision. The same local uncertainty/replay rules apply.
The stricter Console latest-source check is not a claim that its two reads lock
out a concurrent authorized retry or intent change.

## 6. Validation and Residual Gates

- Twelve new queue/controller groups cover selection bounds, snapshot detachment,
  consent, partial rejection, uncertain tail stop, same-key replay, malformed
  acceptance, no-op, serial/double-submit, stop, disconnect and retry preconditions.
  Two existing Console harness tests add Direct and locked multihop copy flows.
- Two HTTP tests cover scoped Operation identity and closed retry/delegation;
  existing owner-port/MySQL retry, rollback, resources and authorization acceptance
  remain the server command regressions.
- The existing real HTTPS Chromium/Agent/Control/MySQL Actions fixture creates two
  disabled Direct copies, races one frozen CAS, verifies partial results and exact
  TCP echo through both real Agent listeners, loses a committed disable response,
  explicitly replays the same command, and retries one fixture-injected failed
  Operation without changing desired revision. Desktop/390px screenshots and only
  redacted evidence use the existing restricted artifact allowlist.
- These tests are authored/CI-wired, not executed locally or accepted for the current
  commit. Browser CA trust remains an isolated disposable-fixture exception, not
  production TLS proof. Subsequent real Relay copy/Profile referenced-rule flows
  and [3/4/8-Node multi-hop copy](../testing/native-multihop-console.md) are also
  authored and CI-wired, not executed acceptance. Other tunnel workflows,
  physical hosts and long-duration behavior remain pending.
