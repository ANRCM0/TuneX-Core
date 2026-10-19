# Probe Owner Collaboration Boundary v1

Date: 2026-10-19 (Asia/Shanghai). Status: source authored, unverified.
Scope: plan A1; original product rules, not new execution capability.

## Public Owners

The Probe module public entry is `modules/probe-owner/public.ts`, module interface
1. It exposes the existing instance, qualification, permit, measurement, result and
read contracts, together with their original shared product rules. It does not
merge the instance, qualification, permit or history state owners. The existing
Probe owner interface version remains separate and unchanged.

Machine authorization, qualification value/current-slot checks, measurement
descriptions, permit/binding validation and the three storage value providers now
have one implementation inside that owner directory. Application coordination still
owns transaction entry, asynchronous reads, clock sampling, mutation and response
construction. No rule is promoted into L0/L1, no authorization evidence is cached,
and no supplied transaction is retained by these synchronous rules.

The observation declaration public entry is
`modules/observation-service-owner/public.ts`, module interface 1. Original
config/trust/head/revision/audit/receipt rules now belong to that owner rather than
an application-private value file. Exact service reference parsing also belongs
there. The historical parseProbeServiceReference name and the descriptive
parseObservationServiceReference name are aliases of the same function.

ObservationServiceReadPort explicitly describes the original head/revision methods,
including the optional head lock argument and nullable results. It has the same
structural shape as the previous Pick of the public storage interface. The existing
ProbeServiceReference specializes ObservationServiceReference without adding or
removing fields or changing readonly meaning. No read command publishes a service,
issues a permit, proves endpoint ownership or performs a network check.

## Actual Owner Call Chains

| Public entrance | Original coordination and public rules | Port and adapter | Original state owner |
| --- | --- | --- | --- |
| ForwardProbePlanApi.plan | ForwardProbePlans validates intent and current binding; service reference and declaration rules come from the observation owner | ScopeAuthorization, ProbeIntents/RuntimeForwards, ProbeNodes and PublishedProbeReader; original MySQL evidence readers and service resolver | Existing Forward/Node/Runtime publications are read, never republished by Probe |
| ProbeInstanceApi.handle | ProbeInstanceRegistry calls ProbeInstanceOwner; ProbeInstances applies public machine rules before and after slot lock waits | MachineSessionReader and instance storage; one MySqlProbeInstanceStore with original owner values | Existing probe_instances slot, generation and tombstones |
| ProbeTypeRegistryApi / ProbeServiceRegistryApi | Original registries use public machine and qualification rules at the original points; current slot, capability and expiry decisions remain theirs | CurrentProbeInstances and ProbeTypeQualifications; original machine/instance/qualification stores in the supplied transaction | Existing qualification proof for the original instance, not a second Gate |
| ForwardProbeApi.create / existing finite-plan issueIn | ForwardProbes keeps authorization, idempotency and feature gates; ProbePermitOwner.issueCurrentIn enters the original ProbePermits issuer | Original plan/current instance/qualification ports and ProbePermitStorage, with same-transaction ProbeRunRecorder | One permit budget, permit/withdrawal/result records and separate bounded history owner |
| Claim / delivery / typed / service / result APIs | Existing adapters call only the public permit owner; original identity/freshness/committed-before-ACK checks remain | consume, offer, check and receiveResult on the existing owner; same lower store from the preceding slice | No adapter independently consumes, renews or refunds a permit |
| ObservationServicesApi and ProbeServiceResolver / ProbeEchoServiceResolver | ObservationServices owns declarations; ProbeObservationServices reads through public declaration rules and the explicit reader | Existing ObservationServiceStore / ObservationServiceReadPort and one MySqlObservationServiceStore | Inert service metadata and immutable revisions; no Runtime/Agent authority |

These rows describe source wiring, not transaction or behavior evidence. They do
not claim a global snapshot or turn an observation into execution authorization.
Composition still occurs in the existing Control root; no root is added to evade
a product boundary. History capture remains after the original permit mutation in
that caller transaction and does not gain a write path to execution authority.

## Preserved Differences And Compatibility

- requireProbeMachine keeps session/boot rejection before credential checks and
  optional Direct capability checks. Its caller still supplies current locked
  evidence and time; the helper performs no read or clock sampling.
- Application qualification validation stays narrower than persisted qualification
  projection: the former recognizes its original optional servicesVersion only;
  the latter retains the existing servicesVersion/echoVersion and upper-time
  handling. They are not deduplicated into a new common acceptance policy.
- Qualification current-slot checks retain identity, state, registeredAt and expiry
  comparisons. Registration/revocation/inspect still use the original stores,
  action-dependent locking and post-transaction server time.
- Permit storage result checks still differ from the later full application receipt
  checks. No v1/v2 storage hardening or staged echo issuance is added.
- Observation object/field rules, service ID/hash/counter limits, mutable detached
  reference return, config/trust validation, digest framing, error mapping and
  native callback order remain original. Trust decoding stays in public L2.
- The existing manager command still accepts only its original three kinds; staged
  echo preflight/descriptions do not become an issuance path or an enabled feature.

Legacy application machine authorization, observation values, three Probe storage
value entries, and flat permit-state/measurement entries directly re-export the
same owner implementations. The qualification application and observation resolver
retain their old named helper exports as direct aliases. No validator is copied
back into those paths. Old zero-argument MySQL wrappers bind these public owner
values to the one lower SQL implementation; they are precise compatibility entries,
not permission for arbitrary adapters to import product code.

## Planned Acceptance And Remaining Work

Readiness item 51 records public/legacy function identity, type/readonly/nullability
equivalence, module initialization, rule rejection ordering, differing qualification
validators, same-transaction collaboration and original feature/issuance boundaries.
Existing tests and source-string boundary rules need later authorized adaptation;
no test or CI tooling is expanded during this source phase.

Direct wire type dependencies and remaining application/native/default bindings
still require source classification and acceptance. The owner entries do not prove
whole A1 closure, and Path/Ingress/Transit, Agent/native, Runner and whole-repository
work remain open. No test, type/syntax/static/boundary check, formatter, generator,
build, experiment, CI, commit or push ran. Foundation acceptance and the independent
upper-module parallel gate remain closed.

## Machine Wire Follow-Up (2026-10-19)

The L2 machine codec now owns the pure projections for negotiation, instance,
claim, poll/status, typed qualification and typed poll/claim/status, plus service
qualification and service poll/claim/status. The old adapters still parse input,
check mTLS-bound identity, call the current owner, sample freshness/time, compare
instance/permit/measurement/service facts and only then invoke the formatter.

The codec receives already-authorized values and callbacks for the original field
evaluation points. It does not read a clock, retain a transaction, inspect a
permit, choose a capability or issue execution authority. Typed/service poll
measurement descriptions remain caller-supplied functions and are evaluated only
when an offer exists. Qualification server-time callbacks retain the original
post-transaction timing. Response parser/check functions, key order, disabled
flags, state fields and null offer behavior remain unchanged in source intent.

Probe machine wire type aliases are re-exported through the public L2 compatibility
entry. This is an additive source classification and direct compatibility route,
not a new protocol version or a blanket exemption for application wire imports.
Readiness item 53 covers exact projection identity, callback timing, parser/check
ordering, field/nullability/key compatibility, freshness-before-formatting and
same-owner refusal behavior. It is unexecuted; remaining direct wire/native/default
dependencies and A1 acceptance stay open.

## Result Codec And ACK Follow-Up (2026-10-19)

After explicit human authorization to restore the interrupted slice, the missing
native-probe-result-codec.ts entry directly re-exports the existing single
native-probe-result.ts implementation. The compatibility public entry keeps its
original path. No existing native implementation is deleted or duplicated.

The L2 implementation now owns the original result version dispatch, parser/body/
digest combination, stored v4/v3 format check and v1/v2/v3 result ACK projection.
ProbePermits consumes the same decoder at online receipt, historical inspection
and duplicate-result call points. Its binding, instance, proof, budget, transaction
and history decisions stay with the original authority. The product storage value
provider calls the native stored-format guard at its original check point; SQL
still applies the 4096-byte write bound first. v1/v2 remain unchecked by that guard.

The three result adapters retain request-version parsing, machine identity, owner
receipt/commit, clock sampling, freshness, digest and deadline checks. Only then do
they call their matching ACK formatter. Typed/service measurement descriptions are
computed by the same product rule at the old projection point and passed as data;
the lower formatter never imports that owner or chooses a measurement. Object key
order, UTC calls, JSON/parser calls and final request/response checks retain their
source order. Native helpers do not read a clock or authorize execution. No v4 ACK,
public issuer widening, feature, protocol, schema or history reset is introduced.

Result request/body/response aliases retain the original wire types through the
public L2 entry. Readiness item 52 records unexecuted equivalence, refusal, ordering,
module initialization and restored-entry identity cases. Remaining machine wire,
application/default/native and repository classification work stays open; this is
not A1 or foundation acceptance.

## Public Command API And History/Plan Consumers (2026-10-19)

Original Forward Probe plan/command/acceptance API declarations now live in the
Probe owner. The old application path is a direct leaf alias; existing application
commands, HTTP and independent history/finite-plan owners consume public contracts.
The original permit owner calls public ProbeRunRecorder using the same Tx, and the
finite plan still uses original previewIn/issueIn bindings/savepoint. Retained echo
history formatting is L2 and missing service-selection parser wiring is restored,
without new issuance/filter/kind/flag behavior. See
[owner chains](probe-history-plan-owners-v1.md), readiness73/74 entirely unexecuted.
A1 application coordination and other source/classification/acceptance remain open.
## Observation Declaration Public Chain (2026-10-19)

Original inert declaration service/API/contracts/storage values now belong to the
existing public Observation owner. Old application/flat paths are exact leaf
aliases; same server/Control/HTTP roots, lower SQL and legacy override/static paths
remain. See [owner chain](observation-service-owner-v1.md), readiness78 unexecuted.
This source move is not A1/A2/foundation/physical/release acceptance.