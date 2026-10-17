# ADR-0022: Explicit Bounded Profile Publication Through Original Rule Commands

Status: Accepted for incremental implementation; exact-SHA Actions acceptance pending.
Date: 2026-10-17 (Asia/Shanghai).

## Context

B1 requires explicit Profile publication across selected references, not just
publishing a new immutable Profile or loading one impact into an editor. This
must preserve original per-rule authorization, CAS, idempotency and Runtime
ownership, with honest partial and uncertain outcomes.

## Decision

- Select at most ten changed, non-recovery-suspended rows on one current impact
  page. Freeze their original full proposed specs, Forward revisions, one immutable
  Profile target/digest and independent command keys. Preparing sends no request.
- Reuse the existing Console command queue, not a server Bulk/Batch endpoint or
  durable rollout coordinator. Only `transport.configRevision` may differ from
  each source spec; enabled, protocols, path, listener and target remain unchanged.
- After explicit consent, each first write is preceded by a fresh, bounded original
  Relay plan call for that exact proposal. Its Profile/digest and non-reservation
  flags must match. The original independent PUT still reauthorizes and owns all
  locks, resource checks, intent/revision, idempotency and Operation acceptance.
- Unknown preflight performs no intent write and stops the unsent tail, requiring
  an explicit same-proposal recheck. Unknown write may already be committed and
  requires original-key/body/path replay only, without another preflight or a
  substitute command. A current replay rejection cannot prove the original was
  unaccepted, so it retains uncertainty and blocks the tail.
- Definite initial per-row rejections remain independent. No cross-rule atomicity,
  automatic replacement/retry/resume/rollback, automatic latest Profile selection,
  shared tunnel or new execution authority is introduced.

## Validation and Limits

Queue and selection regressions are authored, and the existing real Chromium ->
HTTPS Control/MySQL -> two Linux Relay Agents fixture adds two-reference partial
CAS rejection and a lost committed Profile update response with same-key replay.
Source TCP/UDP is checked after real Profile changes; one separate authorized
fixture writer deliberately races the frozen copy CAS. Only allowlisted redacted
evidence/screenshots are uploaded. These are authored/CI-wired, not executed results.

No Core, Agent protocol/Journal, database or credential mutation is added. B1/P1
acceptance and broader project closure remain unproven. See the
[publication contract](../spec/profile-publication-v1.md).
