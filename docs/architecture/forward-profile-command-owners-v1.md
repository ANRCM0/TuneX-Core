# Forward And Profile Grant Command Owners

Date: 2026-10-19. Original source authored only; no frozen revision or acceptance.

## Public Chains

| Entry | Canonical product coordination | Original supplied ports | Original owner state |
| --- | --- | --- | --- |
| Profile grant change | transport-owner/grant-commands.ts | L1 owner/Tx/idempotency, TransportGrantWriter/Effects | Original Profile grant and Runtime reconciler |
| Forward create/update/remove/retry | forward-owner/commands.ts | L1 Scope/Tx/idempotency, ForwardWriter, ForwardOperationCommands, ForwardCommandPreparation | Original Forward, Operation and Runtime ledger |
| Path/Group attachment | Same ForwardCommands | Public Path binding/group contracts and rules | Original immutable/current provenance owners |
| Ingress/publication preview/apply/compensate | Same supplied-Tx methods | Public Path publication/provenance contracts and original injected preparations | Same caller transaction, original per-Forward receipt/state |

Full original class bodies move to existing Transport/Forward public owners.
Their old application entries are exact canonical class/type leaf aliases. The
Profile grant API/version is canonical in grant-api.ts; Forward command API was
already canonical. The original operation kind/retry/operation/preparation
collaboration ports now live in forward-owner/command-ports.ts. Their old Runtime
port entry directly aliases them and retains its original resource/Relay host
declarations. No resource, Operation or Runtime implementation is copied or moved
into business commands, and no direct SQL/table ownership changes.

Existing Control roots instantiate the same classes with the same constructors,
writers, operations, preparation, newId and optional Path/Group/provenance. HTTP
consumes public APIs. Original frozen source/public semantics and L0 APIs do not
change. The helpers use original public L2 nativeValueDigest/nativeCommandRequest,
while pure domain decisions keep their public Core entry.

## Profile Grant Identity And Order

The Profile command keeps its own actor/Scope/Profile/subject/revision/Boolean/key
validation and detached frozen command. Its original request digest is exactly
the object containing method, path, expectedRevision and allowed. It is not
replaced by a differently shaped generic command envelope. The L2 digest alias
points to the same original implementation.

One transaction performs owner authorization -> claim/replay -> applyGrant ->
changed-only reconcile -> original changed 202/unchanged 200 body -> receipt.
An unchanged grant does not invoke effects. Replay follows authorization and
precedes writer/effects/receipt. Required effects rejection and failure/rollback
order remain at original points.

## Forward Acceptance And Distinct Public Methods

Ordinary create/update/remove/retry retain read authorization -> idempotent replay
-> manage authorization. Create replay additionally reads the recorded Forward.
Path/Group apply retain manage authorization before replay. Request parsing,
expected revision checks, key identity and optional collaborator refusals keep
their original individual order, without one common normalization path.

Create retains new ID -> preparation -> original Forward insert -> plan ->
Operation accept -> capacity -> optional binding -> receipt. Update still invokes
preparation before deciding whether a revision changed. Only a changed revision
writes the spec, preserves prior metadata when applicable, sets authorizer, plans,
accepts the correct enable/disable/update Operation and asserts capacity. Exact
path attachment may update provenance without restarting an unchanged Forward.
Group detach, Path accept and Group accept keep their original order.

Removal obtains the original execution removal lock before revision equality and
counter exhaustion checks, then marks deleting -> accepts Operation -> capacity
-> receipt. Retry reads an Operation reference -> locks the current Forward ->
execution lock -> rereads Operation -> recovery/revision/status refusal -> prepares
retry -> authorizer -> new Operation referencing source -> capacity -> receipt.
No replay creates another Operation or turns historical recovery data authoritative.

## Caller Transactions And Compensation

Ingress/publication methods keep the supplied Tx and original parse/identity/
manage/current-state checks. Their inner accept calls keep respond=false, so no
nested transaction or duplicate durable receipt appears. Preview remains a read
and authorization result, not a reservation or execution permission.

Current exact Forward/provenance digests are compared before application or
compensation. Ingress migration keeps its same ingress Node/business protocol
set and exact path/Profile-only replacement constraints. Group/template selection
and full expanded-spec equality remain original. Compensation authorizes the
original restoration before matching immutable selections and desired state.
The optional resolveCreateIn compatibility branch remains: absent method uses
the original resolve fallback. It is not made a new required provider method.

Current Group/path metadata detach stays before topology replacement where the
original method requires it. Immutable history is retained. Any later capacity,
provenance, effect or response failure remains inside the original transaction.
There is one Runtime ledger and original Agent authority/Journal; no competing
queue, planner, event protocol or cross-owner table writer is introduced.

## Deferred Evidence

Readiness98-101 records class/port/API aliases, Profile digest/changed-effects,
Forward CRUD/replay/operation/capacity, Path/Group same-revision provenance,
Ingress/publication same-Tx methods and original retry/compensation/fallback cases.
All planned, none executed. Later functional/MySQL evidence belongs in authorized
Actions on the exact frozen source. No tests/type/syntax/static/boundary checks,
formatters/generators/builds/CI/experiments or Git writes ran for this slice.

Runtime preparation/private/native implementation, remaining Path/Ingress body/
contract ownership, complete HTTP chains, Agent wire/time and full A5 source/type/
default/bridge inventory remain explicit source work. No whole A2/foundation/
physical/release acceptance or parallel feature gate is implied.
