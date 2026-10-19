# Runtime Common Values And Relay Native Views

Date: 2026-10-19 (Asia/Shanghai).
Status: FR-0005/0006/0007 source-authored, unverified. Readiness124-126 planned only.
Scope: actual canonical value declarations, public aliases and original Relay
policy call chains. No full A5/source/type/boundary acceptance is claimed.

## Canonical Owners And Public Paths

| Public entry | Canonical source/owner | Existing consumers and compatibility |
| --- | --- | --- |
| @tunex/contracts/policy, interface1 | packages/contracts/src/policy.ts, L1 common numeric Policy contract | Six L1 host/ledger/Relay implementation/port files import it directly; framework public exports the same type/version |
| @tunex/contracts/execution-observation, interface1 | packages/contracts/src/execution-observation.ts, L1 execution facts | L1 runtime contracts/host ports/Relay import Observation directly; framework public exports Observation/Drain/Condition/ExecutionPhase/version |
| Old Policy/Observation/Drain/Condition entries | types.ts now imports/re-exports lower declarations; shared/runtime/index/legacy paths retain existing exports | Native ReportRequest/HelloResponse/default annotation use the same canonical types; no duplicate interface declarations or new shape wrappers |
| DEFAULT_POLICY | Original frozen initializer in types.ts, native default owner unchanged | Same values/property order/object/module identity; no new L1 default or early clock/validation |
| Relay compiler interface3, framework public | Existing RuntimeRelayCompiler plus lower assignment policy read views | nativeRelayCompiler supplies two native projection methods; RelayCoordinator keeps original positional constructor/defaults/static recovery |

Only the two precise new contracts source leaves are L1 within the mixed contracts
package. The package root, schemas, native validation, digest/time/parsers and wire
configs do not become L1/L0. Pure shared ports need not live in the app directory;
source ownership and explicit public entrypoints define this boundary. Core/kernel
are unchanged. No dependency install, lockfile edit or generation is performed.

The original Policy thirteen fields remain required mutable numbers. Common facts
retain original mutable fields, null errorCode, exact Condition union and phase
semantics. ExecutionPhase is the original prepared|active|draining union; native
legacy Assignment uses it and Observation adds absent. Envelopes, parser behavior,
protocolVersion values and native DriverConfig schemas stay with their L2 owner.
Type movement does not validate or authorize unknown input.

## Relay Assignment View Chain

The original host interpreted raw native RelayConfig/MultihopConfig in three policy
methods. The lower port now exposes only the fields required by coordination:

| Lower view | Fields required by the host | Actual native adapter expression |
| --- | --- | --- |
| RuntimeAssignmentNetworkPolicy | egressPolicyRevision, allowMetadataTargets, allowedDestinationCidrs | Shared minimum readonly read contract, no format-specific discriminator |
| RuntimeRelayAssignmentPolicy | Network policy plus binding ingress/egress Node IDs and peerFingerprints | Return assignment.driver.config as RelayConfig, same object reference |
| RuntimeMultihopAssignmentPolicy | Network policy plus path Node IDs/peer fingerprints | Return (assignment.driver.config as MultihopConfig).hop, same object reference |

compatibility/native-relay-assignment-policy.ts contains those two original access
expressions, no cloned schema, normalized record, eager getter map, validator or
authority rule. Extra native fields remain with the original object. The readonly
port view neither freezes nor makes native objects immutable. Errors from malformed
native objects retain the original unchecked access at the same stage; no fallback.

RuntimeRelayHost uses the methods only where the original casts were evaluated:

- pinsChanged retains its existing no-path native peer comparison. In the path case,
  extract the original hop view at the original assignment iteration, then keep the
  same nested some/current peer lookup, conditional credential comparison and Now.
- authorized keeps authorizer/canExecute, topology/profile/endpoint/session checks,
  original lookup order and every policy/digest/peer/expiry short circuit. Only the
  cast expression changes to a provider method. No authorization loop moves to L2.
- authorizationBound still loads deployment/plan, each Node's current facts and
  credential list before collecting original pins with nested flatMap/filter/map.
  It keeps the Set, missing-pin refusal and minimum authority computation.

The compiler retains its receiver; native methods ignore that receiver and return
the original config/hop. Time codec guard stays first, new projection method-kind
guard follows before options/policy copy. Missing direct/custom projections throw
the recorded Error rather than picking a native fallback. This public construction
change advances only Relay to3; Ledger/Node remain2 and policy/observation leaves1.
FR-0004's interface2 remains a historical source record, superseded for Relay by
FR-0007. Wire, SQL, owner transactions, clock defaults and protected history do not
change by this design. Equivalence remains unverified.

## Remaining Type And Wire Work

The originally listed nine-file assignment/snapshot/message dependencies and Host
ADP choices are subsequently source-migrated by FR-0008 into common facts, erased
family ports and native machine codec bindings. See the [current graph](runtime-value-family-native-v1.md).
FR-0009 subsequently replaces native Profile references with an opaque lower slot
and native aliases, while FR-0010 addresses inspected Node native input/support/
prefix expressions. See [current chains](profile-node-native-boundaries-v1.md).
Broader source/consumer/default/candidate work is still open. These follow-ups are
source authorship, not boundary/type/behavior acceptance results.

Further owner migrations must preserve native consumers/defaults through real
public ports and adapters, with an FR where needed. Do not copy full schemas into
L0, relabel native types, exempt whole packages or move authority into a format
adapter. HTTP/Agent native/default/CLI and complete repository/candidate work remain.

## Planned Acceptance And Removal

Readiness124 checks Policy aliases/fields/public subpath/default identity and native
validation/sample behavior.125 checks execution fact aliases/unions/report arrays
and owner drain/observation/replay rules.126 checks projection requirements, same
raw references, getter/error/short-circuit/Now timing and unchanged Relay authority/
transaction/cleanup. Exact source declaration/tool and unknown external augmentation
consumers still need inventory; relocated source symbols are not promised compatible
with uninspected source-text tooling or private-path declaration augmentation.

Keep old public type aliases and native constructor assembly until every actual
consumer/removal gate is mapped and accepted on one frozen source. All cases here
are planned/unexecuted. No test/type/syntax/static/import/boundary check, formatter,
generator, build, CI, experiment, commit or push was run. Public example, independent
physical-host/long-run/backup/release/production gates remain unverified.
