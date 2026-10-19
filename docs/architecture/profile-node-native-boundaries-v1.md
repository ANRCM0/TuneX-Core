# Profile And Node Native Boundary Source

Date: 2026-10-19 (Asia/Shanghai).
Status: FR-0009/0010 source-authored, unverified. Readiness130-134 planned only.
Scope: inspected Profile/native configuration and Node input/output predicates;
not a full source/type/boundary/behavior acceptance result.

## Opaque Profile And Explicit Native Consumers

RuntimeValueFamily now has an opaque relayProfile field. RuntimeRelayProfile,
transport resolver, resource/plan/multihop inputs and configuration codec carry the
same family. The lower default is unknown and does not import or duplicate native
RelayProfileConfig. NativeRuntimeFamily alone selects the existing closed schema.
Native aliases preserve the old concrete Profile/transport/input/config-codec types.

| Existing consumer | Current public source relation | Original behavior retained in source |
| --- | --- | --- |
| RuntimeRelayHost | RuntimeRelayTransport<Tx,F> and family plan/profile inputs | Only passes config to the injected compiler; original facts/locks/reservations/authority/Tx |
| nativeRelayConfigurationCodec | NativeRelayConfigurationCodec selects native family; profile still calls original parser | Same JSON/parse/digest/encode/ID/refusal, plus original native ISO formatter |
| Native resource/Relay/multihop compilers | Explicit NativeRuntimeRelayProfile/MultihopInput aliases | Original profile parse, schema, digest, protocol/capability/pin/resource/plan order |
| Transport public contracts | Native ResolvedProfile/View/Resolver/config-codec aliases | Original closed Profile API fields, owner/revision/replay/Tx and unchanged wrapper constructor |
| Relay Endpoint contracts | Native configuration codec2 alias, original endpoint config | No new formatter call/guard, same module1 and method bodies |
| Transit preparation native source | Native Profile alias, original endpoints/Node facts | Same already-checked input projection/native parse, no new issuer or execution |
| Old Runtime multihop input export | NativeRuntimeMultihopInput as MultihopPlanInput | Existing native callers retain the closed payload and compiler arguments |

TransportService get now calls its codec formatter at the old createdAt response
property, after original auth/current revision/record/decode/parse/digest inside the
same Tx. Native codec uses existing nativeIsoTime. No time sample, normalization,
replay/publish/grant branch or storage timestamp changes. Missing formatter now
refuses in direct Transport construction before provider effects; this intentional
public construction change is recorded in FR-0009. Endpoint binds the same complete
native codec but does not invoke that new method or add a runtime guard.

Source candidates are Runtime values2, Relay5, configuration2 and Transport2. Host3,
ledger3, evidence2 and Endpoint1 remain. Profile driver/wire/security/schema/data,
general framework/kernel and existing constructor/default/static APIs are unchanged
by this source migration. No package/dependency/lockfile/generator change is needed.

## Node Native Predicates And Projection

Node authority interface3 requires four methods on its existing codec:

| Native method | Actual original predicate/expression | Host stage preserved |
| --- | --- | --- |
| validEnrollmentToken | typeof string and exact original 32..128 alphabet regex | After Node isId, before CSR preflight/digest/Tx |
| validCredentialRequest | typeof string, <=16384 length, original PEM prefix | After each original ID/token check, before original caller-specific invalid error/digest/Tx |
| supportsDirectRuntime | Original adp.3 then native.direct.v1 includes checks | After Node/Scope/listener/port checks, before Forward protocols/targetAllowed |
| relayFingerprint | Original sha256 template prefix, no parse/normalization | Original fingerprint field in credential map, before certificate/validUntil evaluation |

The native capability predicate receives the same facts object and reads its
capabilities separately at the two original points. It does not cache an array,
pre-read Forward protocols, issue authority or persist facts. CSR preflight is not
a new cryptographic validation or key policy. Signing still occurs only in the
original signer after original owner checks and replay logic. Unknown/invalid input
is rejected with the original host errors; no native fallback or new acceptance.

Node constructor keeps overlap/lifetime then format guard, followed by the four
native method-kind checks before provider assignment/time/I/O. Missing custom
methods intentionally refuse. Nodes still binds one native codec, signer, store,
machine lookup, resources/secrets and captured clock with its original constructor
and static recovery. Host keeps membership/grant/credential/time/session/listener/
port/target decisions, locks, same Tx writes, replay and audit.

The fingerprint extension was added to the FR record before its source implementation.
It preserves original blind prefix/coercion/error behavior rather than adding a
second digest/algorithm or correcting malformed historical values. No signer,
authority/Journal/high-water, SQL, certificate/lifetime/overlap or native schema change.

## Source Classification And Remaining Work

The originally listed runtime assignment/snapshot/message/Profile type dependencies
are now represented by lower common facts or opaque family slots in this inspected
graph, with native types selected outside L1. This removes the named mixed dependency
in authored source; no import/type/boundary checker ran and no full-framework/repo
classification is claimed. Native codec method requirements and opaque defaults
are explicit public changes, not compatibility exemptions.

Full A5 still needs all other Control/Agent source/type/private/native/default and
actual compatibility/removal records, exact complete frozen candidate and public
version/evidence map. HTTP framework/native types/URL/header/projection, Agent
URL/protected keys/engine/wire/CLI and any further mixed owner must be read and
resolved in its real owner. No original ledger/authority/Journal is replaced.

## Planned Acceptance

130 covers opaque/native Profile types and old aliases;131 covers native compile/
codec/Transport/Endpoint/Transit/Tx/default parity;132 covers formatter refusal and
original get format timing/errors.133 covers Node predicates/first errors/getters
and fingerprint map/coercion;134 covers full enrollment/rotation/Relay/replay/expiry/
same-Tx authority/rollback/native wrapper behavior. All are planned/unexecuted.

Later authorized acceptance must use one exact frozen source; source declaration,
private augmentation and unlisted custom clients need inventory. Public example,
Actions behavior/MySQL/network, independent physical-host/long-run/backup/release
and production gates remain unverified. No tests/checks/formatters/generators/builds/
CI/experiments/commits/pushes or delegation occurred in these source slices.
