# ADR-0025: Bounded Path Publication Through Original Per-rule Commands

Date: 2026-10-17. Status: accepted for incremental implementation; exact-SHA
functional acceptance remains pending.

## Decision

C1 multi-rule publication reuses the original tab-local Console command queue
from [ADR-0022](0022-explicit-profile-batches.md), immutable paths from
[ADR-0023](0023-immutable-native-path-metadata.md), and original-owner acceptance
from [ADR-0024](0024-original-owner-path-bindings.md). There is no bulk API,
persistent rollout, second executor, server-side batch authorization or migration.

An operator selects at most ten available changes from one current path impact
page and one explicitly inspected immutable target revision/digest. Preparation
sends no request. The original queue independently freezes each source spec,
concrete proposed spec, Forward CAS, exact path selection, Profile digest and
distinct idempotency key. Only ordered downstream path and Profile can change;
ingress/listener, business protocols, target and enabled intent remain unchanged.
Changing provenance with identical expansion is permitted without an Operation.

After explicit consent each first dispatch performs the original read-only
path proposal and original Relay plan, with separate five-second deadlines.
The former must still match the frozen source/proposed specs, CAS and selection;
the latter must match the locked Profile/digest and non-authority/gate flags.
Only then does the original independent `/path-binding` PUT revalidate and accept
its own Forward/Operation/resources/provenance in the existing transaction.
Neither read supplies a lease, resource reservation, durable approval or later
authority. There is no cross-rule atomicity or implicit compensation.

Definite initial client rejection affects only its row. Unknown/mismatched
preflight sends no intent, stops the unsent tail and requires explicit rechecking
of both frozen reads. A potentially committed write retains its original
path/body/key for explicit identical replay, without either preview, new CAS,
new key, new target or automatic tail. Current replay denial remains uncertain.
Stop/disconnect discards or aborts local work only, never remote acceptance.

## Validation and Limits

Selection and queue regressions are authored and use the existing web Actions
glob. The existing 3/4/8-Agent Chromium fixture adds two current references, an
explicit fixture CAS race, a real shortened-path deployment, committed response
loss, same-key replay with blocked tail, and explicit continuation for unchanged
expansion/provenance. Actual TCP/UDP and original resource cleanup are asserted;
fixture setup/race/cleanup writes are recorded separately from browser attempts.
Screenshots remain within the existing redacted allowlist, with no new HAR,
trace, token, PKI or protected-state artifact.

No Core, Runtime owner, Agent, machine protocol, authenticated Journal, database
or recovery behavior changes. No automatic latest lookup, automatic switch,
physical tunnel pooling, zero downtime, cross-host atomicity or production
enablement is claimed. Local validation is static only. Exact frozen-source
Actions, measured interruption/loss and unavailable physical/long-run gates remain
separate and unproven. See [publication contract](../spec/path-publication-v1.md).
