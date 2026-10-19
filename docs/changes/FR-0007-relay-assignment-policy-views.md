# FR-0007: Relay Assignment Policy Views

Date: 2026-10-19 (Asia/Shanghai).
Status: **implemented-unverified; authorized-under-standing-source-scope**.
Owner and authorization: existing L1 Relay coordinator and L2 native assignment
format owner, under the human's standing 2026-10-19 source authorization. This FR
was recorded before implementation; source is now authored/unverified. No
verification, Git, release or feature gate opens.

## Task Proposal

1. Layers: L1 RuntimeRelayHost/compiler policy view ports and L2 native view adapter.
2. Consumed public interfaces: existing framework RuntimeRelayCompiler, same native
   RuntimeAssignment/RelayConfig/MultihopConfig, same compiler/digest/clock providers.
3. Foundation impact: breaking direct/custom Relay compiler construction; Relay
   interface3 adds two required projection methods, preserving old native wrapper API.
4. Contracts: lower readonly RuntimeAssignmentNetworkPolicy and two peer-binding
   views, with relayAssignmentPolicy/multihopAssignmentPolicy on existing compiler.
   Native methods return original config/hop object references, no clone/validation.
5. Acceptance: planned exact-source contract, field/error/short-circuit/sample
   equivalence and later authorized Actions authority/transaction behavior; none run.
6. Parallel impact: nativeRelayCompiler migrates with the host. Same ledger/Node
   facts/Tx/authority checks remain; no new policy or publication owner.

## Why Current Extensions Are Insufficient

The host currently casts assignment.driver.config to raw RelayConfig/MultihopConfig
to read egress policy, peer bindings and pins. Those types belong to native format
owners alongside parsers and wire schema. Moving their complete schemas into L0/L1
or adding another alias leaves the actual ownership problem. Moving the authorization
loops, digest comparisons or clock reads into a native adapter would transfer safety
decisions from the original host and risks changing sample/short-circuit behavior.

Choose narrowly required lower views on the existing compiler port. The adapter
exposes only the original object reference; the host retains every policy decision.
No full driver-schema copy, new callback protocol, eager projection map, normalized
intermediate record or alternate plan/authority implementation is introduced.

## Exact Contracts And Behavior

RUNTIME_RELAY_INTERFACE_VERSION becomes3, superseding interface2 from FR-0004 for
this host only. Existing parseTime/formatTime requirements and all other signatures
remain. New required methods:

```ts
relayAssignmentPolicy(assignment: RuntimeAssignment): RuntimeRelayAssignmentPolicy;
multihopAssignmentPolicy(assignment: RuntimeAssignment): RuntimeMultihopAssignmentPolicy;
```

RuntimeAssignmentNetworkPolicy exposes readonly egressPolicyRevision:number,
allowMetadataTargets:boolean and allowedDestinationCidrs:readonly string[]. The
Relay view adds readonly binding.{ingressNodeId,egressNodeId} and peerFingerprints.
The Multihop view adds readonly path entries {nodeId,peerFingerprint}. These are
minimum coordination read views, not duplicate native schema declarations.
Extra native fields and original object mutability stay with their owner.

After the existing required-time-codec guard and before options/policy copying,
missing/wrong-kind projections throw Error('Runtime relay assignment projections
are required'). This earlier refusal for incomplete direct/custom compiler clients
is intentional; construction does not project a plan or sample a clock.

The native Relay method returns assignment.driver.config as RelayConfig; Multihop
returns (assignment.driver.config as MultihopConfig).hop. No other property is read,
validated, copied or frozen. Bad objects retain original unchecked access failures
at their original use point rather than being accepted by a new fallback or rejected
by an eager validator. Methods receive the supplied compiler receiver.

Replace only the original cast expressions in pinsChanged, authorized and
authorizationBound. Keep nested some/every/filter/map order, current/peer lookup,
session and policy short circuits, digest evaluation, conditional per-peer Now and
skew reads. authorizationBound still loads each Node's facts/credentials before
extracting pins, deduplicates with the same Set, checks missing pins and minimizes
the same bound. No extra sample, cached cutoff, Tx, I/O or policy/provider callback.

## Impact And Compatibility

Complete host policy loops and the old native peer comparison implementation were
read before design. nativeRelayCompiler is the observed provider literal and
RelayCoordinator the existing native assembly. The wrapper's arguments, defaults,
captured Date.now, static recovery and class inheritance stay unchanged. Unknown
direct/custom compilers must add the required projections for interface3; no
implicit native format fallback is kept in L1. Existing raw public wire config
types/parsers stay with L2 and retain their old names/behavior.

No Node/session grant, plan digest/endpoint revision, policy/credential lifetime,
pins/overlap semantics, ADP/schema, reservation fence, ledger transition, protected
history or Journal owner changes. Native RuntimeAssignment/RuntimeMessages/Snapshot
and RelayProfileConfig references still remain separate L1 type debt; this source
slice removes only direct RelayConfig/MultihopConfig interpretation types.

## Migration And Version Plan

Add lower view declarations/public exports, required compiler methods and native
adapter, bind them in the existing native compiler, replace original cast sites and
record Relay3 in current candidate mapping. Do not alter FR-0004's historical
interface2 record; this FR supersedes it for current Relay construction only.
All actual custom consumers and removal/acceptance conditions remain in A5.
There is no data migration, second versioned state owner or history-reset rollback.

## Acceptance And Known Limits

Readiness126 planned: required method/first-error precedence, same raw config/hop
reference, compiler receiver, no eager clone/validation/default. Cover malformed/
missing config/hop/path/binding and getter/throwing values with original first-error
and short-circuit property access; mismatched Node/session/policy, sorted CIDR digest,
missing peer, changed pins, expired/current overlap and every conditional Now count.
Compare direct versus multihop path in authorizationBound and unchanged same-Tx
publication/refresh/cleanup behavior. Later boundary acceptance checks absence of
L1 native config type/cast references without treating remaining wire types as solved.

No tests/checks/formatters/generators/builds/CI/experiments/commits/pushes executed.
Complete source/type/consumer/frozen candidate, public example, physical/long-run/
release acceptance remain unverified. Source intent is not behavior evidence.

## Source Authorization And Acceptance Gate

Proceed autonomously under the standing source instruction after recording this
scope; no repeated confirmation. Acceptance and all later gates stay independent.
