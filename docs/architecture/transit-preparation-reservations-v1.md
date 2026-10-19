# Transit Preparation And Exclusive Reservations v1

Date: 2026-10-19 (Asia/Shanghai). Status: source authored, unverified.
Scope: plan A2, original offline preparation and reservation primitives. No
production Transit execution, new authority or frozen semantic change.

## Public Preparation Chain

The public Transit owner now owns the single original compileTransitResources,
compileTransitPreparation and validateTransitReservationSet implementations.
TransitInput remains mutable at its top level with the original readonly arrays
and port map. Its Profile and Endpoint types use those owners' public contracts;
Node execution facts use the same L1 RuntimeRelayNodeFacts shape that the old
runtime/relay-plan path already aliased. TransitPreparationInput names the original
Omit-plus-reservations/time/pins/limit parameter shape, not a new required field.

The original path checks remain L3 rules: enabled parsed Forward, locked Profile
identity/revision, native Profile integrity/protocols, complete unique Node and
Endpoint facts, scoped role capabilities, destination policy and listener/neighbor
access. Repeated checkPath calls are not memoized or removed. Resource compilation
retains original hop/protocol order, physical TCP for internal UDP, allowed ports,
collision refusal and deepFreeze. These are non-authorizing values.

Preparation still validates time before parsing it, applies the original connection
limit and derives ports from retained reservations before both checkPath and
compileTransitResources. It retains exact reservation count, pin count/distinctness,
live selected peer/session/credential checks, all resource identity fields, a single
deployment generation, assignment IDs/digests and shortest authorization window.
It builds only middle-hop Intents and returns executable:false with the original
activation order, body digest and deepFreeze. Plain Error text/prefixes stay plain
Errors; the reservation-set refusal stays the original ControlError.

L2 native-transit-preparation owns Profile JSON/parser framing, direct CIDR/time
validator aliases and the original Transit Intent field projection/UTC/JSON/parser
sequence. It consumes only Core and lower value contracts, never Transit L3 types.
The formatter takes original checked references, not eagerly copied field values,
and performs no authorization, clock read, I/O or reservation. The existing native
topology, target policy, endpoint parser and digest/parse-time public entries are
reused. No schema, literal, field/key order or parser strictness is changed here.

## One Runtime Resource Owner, Distinct Exclusive Mode

The original reserveRelay operation cannot replace Transit reservations: Relay
permits an already-owning Forward, whereas this original mode refuses every
non-null owner. Transit also locks sorted distinct Node rows first, checks a raw
owner/fence projection and safe/nonnegative fence, and checks capacities in sorted
Node order after all assignments. These differences are preserved, not silently
weakened or hardened. Existing RuntimeResourceAccess and reserveRelay are unchanged.

Public TransitReservations validates the whole resource set before invoking the
required RuntimeExclusiveReservationAccess in the same supplied transaction.
The L1 RuntimeExclusiveReservations host is the extracted original exclusive mode
of the same Runtime resource owner, not a second ledger. It has no path policy or
Transit/module/SQL/platform imports and requires both storage and capacity source.
It receives the original Forward identity reference so id reads stay at assignment
and returned-record projection, rather than capturing it before the first lock.

The existing MySqlRuntimeResourceStore implements the additive raw storage port.
It reuses its existing ensureSlot and assignSlot SQL. Distinct methods retain
SELECT node_id row arrays, owner_id/fence-only FOR UPDATE, and the raw first count
row or undefined. They do not substitute the existing session projection, expand
the slot query, normalize a missing count or add a new affected-row check.

The exact sequence remains validation, sorted Node locks, sorted socket insert/
lock/owner/fence/update/result, then sorted capacity reads. The owner comparison
rejects the same Forward too. Missing slot and unsafe/negative/exhausted fence
keep their original errors. Returned records remain unfrozen as before; no extra
generation validation, reservation retry, nested transaction, commit, pool, lease,
Snapshot, physical cleanup or protected-history reset is introduced. Failure after
earlier writes still relies on the original caller transaction to roll back all.

## Precise Compatibility And Default Binding

modules/runtime/transit-preparation.ts directly exports the original public
functions and types. Staging consumes that public compiler; it remains an explicit
mixed owner for its remaining SQL, native clock, collaborators and abort-release
chain. No new Control route or staging registration is added.

modules/runtime/transit-reservations.ts keeps the original async function signature
and validation export. It binds one stateless TransitReservations to
createMySqlExclusiveReservations. The factory creates no connection or independent
state and passes a callback reading DEFAULT_POLICY.maxAssignmentsPerNode AFTER
each original raw count/Number conversion. It does not capture that value at module
load or constructor time. No SQL or reservation algorithm remains copied in the
old function. Remove these bridges only after caller inventory and same-frozen-
source compatibility acceptance under a separately authorized change.

## Remaining Work And Evidence

Readiness items 65 and 66 are planned only. Staging/abort still needs its original
same-transaction journal, Node/Profile/Endpoint collaboration, historical lease/
Snapshot proof and exact owner/Fence/generation release through the Runtime owner.
The existing generic releaseForwardSlots must not substitute for that exact release.
A1 residuals, Agent Probe/native, Runner, full-source classification and later
plan B-E remain open. Boundary declarations alone do not prove import compliance.
No tests/type/syntax/static/boundary checks, formatter/generator/build, experiments,
CI, commits/pushes or delegation ran. Functional/MySQL/network evidence waits for
later authorization and Actions on the same frozen revision. No foundation or
upper-module acceptance gate opens.

## Later Staging Source Continuation (2026-10-19)

The stage/abort debt described above now has source extraction: public staging,
raw original stage SQL and exact release through the existing Runtime resource
owner, preserving required historical proof and one transaction. See
[staging boundary](transit-staging-owner-v1.md). Item 67 remains unexecuted;
this follow-up does not accept items 65/66, whole A2 or the foundation gate.