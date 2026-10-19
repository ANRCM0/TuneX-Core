# Control Probe Permit And Machine Owner

Date: 2026-10-19. Original source authored only, not frozen or accepted.

## Public Chains And Original State

| Entry | Canonical implementation | Original public providers | State and authority |
| --- | --- | --- | --- |
| Manager create / finite-plan issuer | ProbePermits in probe-owner/permits.ts | Scope/Tx, ProbePermitPlans, machine/current-instance/qualification, permit store | Same original budget lock, generated IDs and authority |
| Manager inspect/revoke | Same class | Same Scope/Tx/store and public L2 result codecs | Historical result or original revocation/withdrawal, no execution grant |
| Legacy claim/delivery/result | ProbeClaims/ProbeDelivery/ProbeResults | Exact existing ProbePermitOwner methods and L2 parser/ACK | Owner commits before adapter ACK; read replies reserve nothing |
| v2 typed machine calls | ProbeTypes | Same owner, measurement rules and v2 codecs | Original two-measurement projection, no separate budget |
| v3 service machine calls | ProbeServices | Same owner, service selection/digest and v3 codecs | Original service proof and selection checks, no separate issuer |
| History capture | permits.ts -> public ProbeRunRecorder.recordIn | Original sanitized capture and same caller transaction | Original history owner; no copied permit or result authority |

The full original class bodies move into the existing public Probe owner. Old
application paths directly alias the same canonical leaves with their exact
former exports. Control constructs the same six instances with original stores,
optional history/qualification, default clocks and machine slots. Canonical
contracts and product rules are local leaves, while history and Observation
collaboration consume their public contracts. No lower SQL, Runtime ledger,
Agent Gate/counter/authority/Journal, feature flag or schema changes here.

## Permit Lock, Clock And Issuance Order

budget still takes the one original store lock before validating retained permits,
withdrawals, uniqueness and safe values, then samples the captured clock against
the persisted observedAt and future-history checks. Issuance keeps manager Scope
authorization -> budget -> same-Tx plan -> selected/current instance and machine
-> resampled time/evidence -> qualification/capabilities -> retained budgets and
window -> original validation -> prune/clock -> insert -> sanitized history.

Original limits remain 256 retained reservations, four live permits and actor/Node
cooldown. Consumption, revocation, restart and instance replacement do not refund
issuance. Expired IDs retain the original one-second margin and are never caller
selected or replay-as-insert. Expiry is the minimum of original two-second bound,
optional finite-plan notAfter, plan, slot, credentials, retirement and qualification.
An optional same-Tx history failure still rolls back the original state writes.

Existing kind handling is preserved exactly, including staged echo branches and
the narrower command/issuer behavior. Moving a permissive parser or a proof helper
does not add echo issuance, broaden receiveResult's public request union or turn
v4 stored-format recognition into enabled execution. These differences require
explicit later compatibility evidence; they are not normalized by this move.

## Consumption, Discovery, Results And Withdrawal

consume keeps budget and exact unused permit/measurement/service/mTLS/instance
match -> same-Tx current plan/binding/qualification/evidence -> close consumed ->
prune/clock -> history -> view. The transaction completes before a machine ACK is
constructed. A lost or stale ACK never refunds or recreates the consumed permit.

offer retains original registered-slot/evidence/qualification order and ambiguity
refusal. It authorizes only the existing candidate and returns executionEnabled
false; no reservation, issuance or renewal follows from delivery. check requires
consumed, non-withdrawn state and current exact binding; its reply is an observation,
not a cacheable continuation grant. Original typed/service filtering differs from
legacy filtering and stays unchanged.

receiveResult retains original parser/digest -> connection identity -> budget and
exact consumed permit/binding/window -> pin/proof -> current authorization -> stored
result read -> clock resample after waits -> measurement/result expiry. An existing
result is validated as persisted evidence before digest equality/conflict; a replay
returns its original acceptedAt and a new checkedAt. New evidence writes result,
sanitized history and persisted clock before a final resample/expiry refusal. Later
failure rolls back that transaction. Result acceptance neither consumes nor renews.

inspect retains its original synthetic requestId codec validation of stored result,
binding/pin/service/window checks, immutable error mapping and historical flags.
revoke keeps manager authority independent of the original Node grant, original
consumed withdrawal replay, issued closure, other-state view and same-Tx history.
Persisted history is not cleared or made a new authority.

## Adapter Timing And Exact Variants

Legacy claim samples its dynamically obtained native clock only after consume
commits. Delivery/result and v2/v3 adapters retain constructor-captured clocks.
All original parser/connection identity checks, 250ms freshness, request/result
identity, expiry and digest checks stay at original points before L2 ACK helpers.

The variants retain their original differences: legacy delivery checks its flags
and maximum Date bound; typed v2 keeps its own narrower measurement set, type
projection and time predicate; service v3 keeps its stricter timestamp ceiling,
service-selection digest and original ordering. Poll classification remains lazy
inside the original formatter callbacks. No common freshness helper is introduced
to silently tighten, relax or reorder any variant.

## Planned Evidence And Remaining Work

Readiness86-88 records class/export/default identity, budgets/locks/clock rollback,
same-Tx history, current-instance/qualification/pin, consumption/withdrawal/replay,
result integrity/conflict and all three adapter families. Every case is unexecuted.
Later functional/MySQL/network evidence belongs in authorized Actions on the exact
frozen source. No tests/type/syntax/static/boundary checks, formatters/generators,
builds/CI/experiments or Git writes ran for this slice.

The former named application Probe implementations are now canonical owner bodies,
but full A1/A5 source/type/default/bridge inventory and cross-owner acceptance
remain open. Other Control modules/HTTP, Agent/native, Runner, physical-host,
release and foundation gates are separate; this is no blanket module acceptance.
