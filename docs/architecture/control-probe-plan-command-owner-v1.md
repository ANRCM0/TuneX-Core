# Control Probe Preflight And Command Owner

Date: 2026-10-19. Original source authored, unverified and unfrozen.

## Original Chains

| Entry | Public coordinator | Reused public providers | Original decision owner |
| --- | --- | --- | --- |
| Manager preflight | ForwardProbePlans -> forward-plans.ts | L1 Tx/Scope, Probe intents/Node/published read ports and L2 target/time/Direct config types | Read-only plan; no Agent network grant |
| Manager create / finite plan issueIn | ForwardProbes -> forward-commands.ts | L1 Tx/Scope/idempotency, existing ProbePermitOwner.issueCurrentIn | Same original permit authority and budget |
| Exact controlled declaration | ProbeObservationServices -> observation-services.ts | Observation public reference/head/revision/read contract, same Scope/Tx and original L2 digest/context parsers | Read-only metadata resolution, no signer or connection |

Remaining Probe binding/plan/service/permit/result/owner product contracts now
have canonical leaves inside the existing Probe owner. The public entry exposes
the original types and implementations. Flat paths retain exact aliases, including
CurrentProbeInstances at its historical permit path. Original mutable view spreads,
readonly records, paired echo unions and optional result/service fields are not
strengthened. Existing permit implementation still owns its original mutations;
this slice does not replace or duplicate that authority.

## Preflight And Resolution Order

Preflight retains its own closed five-kind request parser and timeout defaults.
Inside the supplied transaction it performs manager Scope authorization, original
intent parse/revision/state checks, Direct/numeric-address support, authorized Node
facts, non-metadata target policy, per-kind capability checks, published read and
dynamic time sampling. Exactly one active Direct assignment must match original
intent/listener/target/policy fields. Service resolution and exact target comparison
precede original Snapshot/credential/service-window arithmetic. All original plan
flags remain non-executable, unknown-health and not a reservation.

The declaration resolver parses the exact reference, authorizes Scope and reads
head then immutable revision in the original caller transaction. Head identity,
archival/recovery/revision and immutable digest checks precede its captured clock,
history/validity-window checks and context digest. TLS config version and echo
config/protocol checks remain separate methods after the common original read.
Persisted corruption keeps the original catch/error mapping. No earlier SQL trust
validation, nested transaction, new lock, key read or permit issuance is added.

## Command Semantics And Compatibility

The command parser still supports only original tcp-connect, ingress-connect and
ingress-TLS kinds. Preflight echo support does not add command echo issuance.
Constructor enabled/ingress/services dependencies remain exact. create keeps
request framing before its transaction, manager authorization then idempotent
replay before disabled gates and issuance, followed by response recording. Replay
does not create or extend a task. issueIn keeps the caller transaction, original
notAfter forwarding, flags, original issuer and receipt projection/error order.
inspect/revoke still forward to the one permit owner. Finite plan callbacks still
invoke this exact issueIn with their existing same-Tx narrowing deadline.

Old application entries directly alias canonical class leaves. Their original
type/helper exports alias the original canonical declarations and Observation
reference leaf. Control consumes the public Probe entry but constructs the same
instances, optional resolvers, stores, flags, clocks and history/plan bindings.
No new root, task scheduler, publication, wire/schema version or feature appears.

## Deferred Evidence

Readiness81 records original request shape/default/refusal order; authorized
intent/Node/published/assignment/target checks; service reference/trust/window;
per-path clock timing; plan versus command kind sets; flags; idempotent replay;
same-Tx finite issue/deadline and receipts; aliases and type/view mutability.
All planned, none executed. Later functional/MySQL evidence belongs in authorized
Actions on the exact frozen source. No checks/tests/builds/formatters/generators/
experiments/CI/commits/pushes ran for this slice. Permit/claim/delivery/result/type/
service coordinator closure, A2/A3/A4/A5, acceptance, physical and release gates
remain open.
