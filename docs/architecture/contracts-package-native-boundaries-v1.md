# Contracts Package Native Boundaries v1

Date: 2026-10-19 (Asia/Shanghai). Manual source classification, unverified.
Only this document changes in this slice. Package source, exports, assets,
defaults, generated outputs and existing FR-0005 through FR-0010 source remain
unchanged. No new wrapper, provider, public version or foundation change request
is warranted merely to classify these native codec implementations.

## Public Export Map And Three Common Leaves

`packages/contracts/package.json` is the explicit public map. The package is
private ESM version 0.1.0 and exports TypeScript source, with existing core/AJV/
ajv-formats/canonicalize dependencies. Export availability is not acceptance or
permission to execute a feature. Paths below are relative to packages/contracts.

| Package entry | Actual source | Layer and public purpose |
| --- | --- | --- |
| /policy | src/policy.ts | L1 common Policy fields and RUNTIME_POLICY_INTERFACE_VERSION 1; no default policy or parser/native import |
| /execution-observation | src/execution-observation.ts | L1 phase/condition/Observation/Drain facts and EXECUTION_OBSERVATION_INTERFACE_VERSION 1; no envelope, clock or native import |
| /execution-values | src/execution-values.ts | L1 Runtime value/family contracts, RUNTIME_VALUES_INTERFACE_VERSION 2; only public Core NetworkProtocol and the two local common facts as type dependencies |
| root . | src/index.ts | L2 broad compatibility/native barrel spanning legacy/runtime/Transit/Probe/staged echo/observability/catalog plus aliases of some common facts |
| /shared | src/shared.ts | L2 shared native values/defaults/JSON/digest/time/policy validation; not a pure L1 utility entry |
| /runtime | src/runtime.ts | L2 production native Runtime/Relay/Multihop/catalog entry, with selected Direct/common type aliases |
| /probe | src/probe.ts | L2 closed Probe v1 negotiation/instance/claim/delivery/result, v2 types and v3 service families; no staged echo or Transit export |
| /observability | src/observability.ts | L2 Node/Host/Forward/Probe telemetry wire declarations and handwritten validators |
| /experimental/transit | src/experimental-transit.ts | L2 offline Intent/ADP Transit/contract-only negotiation/transport preview delivery; no production registration |
| /legacy/adp2 | src/legacy-adp2.ts | L2 legacy native types/default and ADP2 structural/stateless parser; source compatibility, not production ADP2 enablement |
| /staged/probe-echo | src/staged-probe-echo.ts | L2 direct exports of actual staged probe-echo implementation, not evidence of end-to-end availability |

The L1 RuntimeValueFamily default remains erased: unknown relay profile, generic
driver/source declarations and object envelope extensions. RuntimeAssignmentFor,
SnapshotFor, Hello/Report values and message families retain the existing generic
relationships, without a native protocol/driver/schema default. This document
does not redo the existing public-facts/family migration.

`src/types.ts` imports Policy from policy and ExecutionPhase/Observation/Drain
plus common Hello/Report facts, then specializes old envelopes with protocol 2 and
native Direct driver/config. Its exported Policy, Condition, Observation and Drain
are precise references to L1 declarations, not copied native replacements. Root
`export type *` makes those selected aliases reachable, but does not export the
full common leaf version constants or erased Runtime family surface. Runtime
similarly aliases selected common facts; shared aliases Policy. These L2-to-L1
references are expected. L1 consumers must keep the dedicated common subpaths,
not take a reverse source/type dependency on the root/shared/runtime native graph.

Root/shared value imports transitively reach eager fs/AJV/crypto/catalog work.
Type-only imports do not execute that work in normal TypeScript erasure, but still
count as source dependencies under the foundation agreement. A broad barrel is
not an exemption or a supported substitute for the common public contracts.

## Exact Native Source Leaves And Direct Assets

All listed source leaves are read as native external representation or explicit
barrel implementations; none holds a Runtime ledger, SQL transaction, permit
issuer or product authority. Schema names in this table have the full prefix
`docs/protocol/schemas/` at repository root. Those files are real production fs
inputs resolved relative to import.meta.url, not package-local assets copied by
the TypeScript loader.

| Native src leaf | Public behavior/types | Direct production asset |
| --- | --- | --- |
| types.ts | ADP2 Messages/Hello/Snapshot/Report/Assignment/Tombstone/ErrorResponse; native DirectConfig, exact common aliases and frozen DEFAULT_POLICY | None |
| validate.ts | parseMessage/validateStructure/validatePolicy/validateSnapshot/validCidr, original stateless native checks | adp-v2-direct.schema.json |
| json.ts | bounded parseJson, duplicate/Unicode/depth/exact integer/trailing-data rejection, native UTF-8 Buffer byte bound | None |
| digest.ts | digest via native createRequire canonicalize and Node SHA-256, JSON/cycle/Unicode/nonfinite rejection | None; installed pinned canonicalize dependency |
| time.ts | compareTimes/validateTime/withinLease over supplied UTC strings, exact fractional ordering without millisecond truncation | None |
| adp3.ts | RuntimeAssignment native driver family, RuntimeSnapshot/Messages, parseRuntimeMessage/validateRuntimeSnapshot/validateMultihopAssignment | adp-v3-runtime.schema.json and adp-v3-execution.schema.json |
| relay.ts | RelayProfileConfig/Binding/Open/Accept/Reject/Resource/Config/Assignment/Tombstone, parseRelayMessage/parseRelayAssignment | native-relay-v1.schema.json and adp-v3-relay.schema.json |
| multihop.ts | MULTIHOP_CAPABILITY, HopNode/HopConfig/MultihopConfig, hopPathDigest/validateHopConfig | None directly; uses Relay native Profile parser |
| native-drivers.ts | NativeDriverDescriptor/Catalog, parseNativeDriverCatalog, NATIVE_DRIVER_CATALOG and digest | packages/contracts/data/native-drivers-v1.json |
| transit.ts | TransitNeighbor/Endpoint/Intent, parseTransitIntent; proposed native.transit.v1 contract | transit-v1.schema.json |
| adp3-transit.ts | TransitAdpAssignment/Snapshot/Tombstone, required capability tuple/refusal, separate offline ADP parser | adp-v3-transit.schema.json |
| transit-negotiation.ts | capability tuple, request/response parse/check, contract-only executionEnabled:false | adp-v3-transit-negotiation.schema.json |
| transit-delivery.ts | PreviewCommand/DeliveryReport/Ack, parseTransitDelivery and digest/time checks; transport-only | adp-v3-transit-delivery.schema.json |
| probe-negotiation.ts | negotiation request/response parse/check, session recognition only | probe-negotiation-v1.schema.json |
| probe-instance.ts | request/response parse/check and stateless register/revoke/absence relationships | probe-instance-v1.schema.json |
| probe-claim.ts | ClaimBinding and consumed receipt request/response parse/check | probe-claim-v1.schema.json |
| probe-delivery.ts | Offer/Poll/Status parse/check, supplied timestamps/freshness relationships | probe-delivery-v1.schema.json |
| probe-result.ts | result request/response/body/digest/check, original v1 unknown health/non-authorizing ACK | probe-result-v1.schema.json |
| probe-types.ts | v2 measurement/identity/offer and Qualification/Poll/Claim/Status/Result family parse/check/body/digest | probe-types-v2.schema.json |
| probe-services.ts | v3 service selection/config/context/TLS and five message pairs; native Buffer/base64/net.isIP/URL representation | probe-services-v3.schema.json |
| probe-echo.ts | v4 service/challenge/invocation/proof/descriptor/messages, frame and Ed25519 verification helpers | probe-echo-v4.schema.json |
| telemetry.ts | NodeTelemetrySample/Ack, telemetryUint64 and typed/raw parse overloads; hand-validated Node process/runtime wire | None loaded by runtime source |
| host-telemetry.ts | Host sample/ACK and typed/raw parsers, bounded availability/resource/namespace fields | None loaded by runtime source |
| forward-telemetry.ts | ingress identity/point/coverage/sample/ACK parsers, exact counters and raw wrappers | None loaded by runtime source |
| probe-telemetry.ts | Probe identity/point/coverage/sample/ACK parsers, exact conservation/coverage and raw wrappers | None loaded by runtime source |

The remaining native src leaves are exactly the barrels index.ts, shared.ts,
runtime.ts, probe.ts, observability.ts, experimental-transit.ts, legacy-adp2.ts
and staged-probe-echo.ts listed in the public map. No src leaf in this inventory
is implicitly exempt because the enclosing package also contains three L1 files.

Leaf-level `export` is not an additional package subpath. For example,
adp3.ts exports validateMultihopAssignment for its source implementation, while
the inspected root/runtime barrels export parseRuntimeMessage and
validateRuntimeSnapshot, not that function. Likewise src/types.ts has no dedicated
package /types export. Use the actual package map above; this table does not
authorize private src subpath imports or invent missing public exports.

Telemetry/host-telemetry/forward-telemetry/probe-telemetry-v1.schema.json also exist
under docs/protocol/schemas as native specification assets. The four actual TS
telemetry implementations do not read/compile those schemas; they use handwritten
closed-key/value rules. This reading found no corresponding TS/mjs production
loader of those four schema paths. Runtime dependence and conformance/parity are
different claims: schema existence is not proof the handwritten validators match.
Do not add eager AJV loads just to make the manifest uniform.

## Native Initialization, Defaults And Error Order

These TS validators differ from Agent Go lazy codecs: filesystem schema reads,
AJV construction/formats registration and named-validator compilation occur at
module evaluation. Missing/unreadable assets, invalid JSON, unavailable CJS
dependency or schema compile errors can fail import before parser calls. Root
and native barrels reach multiple such leaves; narrowing public imports is part
of dependency ownership, not proof of production behavior or side-effect-free
initialization. No initializer is converted to lazy state in this slice.

`validate.ts`, adp3 Runtime/execution, Relay and ADP3 Relay, Transit Intent/ADP and
Transit delivery retain their existing full-string regexp adapter where present.
Original Probe and negotiation compiler setup differs; this inventory does not
silently add that adapter or normalize an error. Relay primitive setup has its
original formats choice, while ADP3 Relay registers formats separately. Request
and response pair checkers preserve request-first validation, then exact version-
specific identity/descriptor/service/challenge/result-digest/time checks.

Types.DEFAULT_POLICY is the same one frozen native default object, not L1 Policy
semantics: poll 10, lease 300, renewal lead 120, skew 5, freshness 30, drain 30,
connect 10, UDP idle 60 seconds; TCP 1024/UDP 4096 per assignment, Snapshot
4194304/Report 1048576 bytes and 1000 assignments. Existing adapters may capture or
read that same default at their own original call points; a public alias does not
authorize changing those timing choices. This slice changes no defaults.

Native-driver catalog initialization reads/parses the existing exact three-driver
data and computes its digest once. Its flags/platforms/schema IDs/limits/security/
prepare/drain/probe/usage fields are catalog declarations, not a driver loader,
local executable/tool discovery, current telemetry availability or authorization.
No installed/advertised catalog claim is expanded from those JSON descriptions.

JSON byte bounds use Buffer/TextEncoder as actually implemented; safe integer
token checks happen before floating-point evidence is lost. Time UTC fractional
comparison in time.ts is distinct from Probe/telemetry canonical Date.parse rules.
Digest is json validation -> pinned JCS -> UTF-8 SHA-256 with sha256: prefix.
Changing these native implementations to generic L1 helpers would require a real
contract/migration decision, not moving their imports through a broad barrel.

ADP3 parses protocol-3 structure before native stateless validation, with an
explicit execution-extension schema. Non-Snapshot paths reuse legacy parseMessage
through an internal protocol-2 projection; the public output remains the original
protocol-3 value. DirectConfig remains native, consumed by ADP3/Direct compilation.
Legacy exports cannot be removed merely because production rejects incoming ADP2.
Offline Transit and staged echo exports remain available without being installed
in production Runtime or granting live execution. Normal probe.ts deliberately
does not export staged echo, even though root currently does.

Telemetry parsers preserve independent family meanings: Node process/runtime;
Host Agent-visible OS and unsupported-platform/null availability; Forward ingress
payload/state/tail; Probe actual attempts/conservation/retiring-source coverage.
They do not own rollup business policy, database state, current authorization,
health or billing. uint64 is canonical decimal text and exact BigInt arithmetic,
not JavaScript rounded counters. No missing measurement is manufactured as zero.

## Actual Public Consumers And Compatibility Conditions

Source navigation identified these concrete public chains, not a complete import
analysis or runtime experiment:

- framework/public.ts and Runtime host/ledger/relay/port files consume the three
  dedicated L1 subpaths. compatibility/native-runtime-family.ts specializes the
  erased family with native runtime/Relay values. Preserve that direction.
- compatibility/native-runtime.ts, runtime-codec.ts, native-relay-plan/resources/
  configuration, native-multihop-plan.ts and native-runtime-catalog.ts consume
  runtime/shared; native-module-values.ts and native-node-codec.ts consume native
  digest/JSON/CIDR/time. These are actual L2 providers, not new L1 wrappers.
- compatibility/native-http-codecs.ts consumes runtime/probe/observability/
  experimental-transit parsers; native-observability-codecs.ts exposes original
  observability/Probe and explicit staged echo aliases. Native Probe machine,
  result, history and declaration effects consume those public type/format owners.
- compatibility/native-transit-machine/delivery/preparation.ts consumes the
  experimental Transit export and original shared/runtime formats. Contract-only
  metadata parsing does not create a live Transit registration or capability.
- Root remains used by scripts/phase1/acceptance.ts and phase2 access/capacity/
  faults/linux-agent/multihop/probe/recovery/Relay scripts and some type references;
  actual native-recovery.ts/native-upgrade-format.ts also import root parseJson.
  These consumers prevent claiming root is unused or safe to delete. Their code
  is not edited or fully classified by this package slice.

No new aliases are introduced. Existing root/shared/legacy/runtime type aliases
must stay until exact public users/fixtures and any promised compatibility migrate
with same output/default/import-error evidence. Three L1 subpaths remain the
correct lower entrypoints even when a native barrel reexports a common type.
The README's historical ADP2-only package description does not cover current
exports; this discrepancy is recorded here without rewriting that separate file.

## Production And Tool Asset Relationship

Later source navigation is recorded in
[contract-assets-source-map-v1.md](contract-assets-source-map-v1.md): all21 schema
IDs/loaders/Agent copies, exact generator versus handwritten targets, local
reference declarations, actual native catalog/provider chain and the three
different Transit textual comparison semantics. The package README's historical
ADP2-only description is now corrected to the unchanged11 public exports. This
supersedes the earlier recorded README discrepancy; no parser/export/version/
asset/tool changes or executed parity evidence follow.197-199 remain unexecuted.

Runtime source paths in the table are the production TS schema inputs. The source
schemas also drive separate tool/Agent outputs. scripts/generate-multihop-schema.mjs
reads ADP3 Runtime and derives adp-v3-execution.schema.json. The current
scripts/generate-go-contracts.mjs reads ADP2 Direct, native Relay, ADP3 Relay,
ADP3 execution and v1 Probe negotiation/instance/claim/delivery/result schemas,
producing Agent package schema copies/generated types; its ADP3 alias generation
targets adp3execution's actual declarations. The generator invokes gofmt, including
its check mode. None was run. Reading its source is not generated-output parity.

Other Agent handwritten/embedded codec assets and scripts/check-transit-adp-schema
have separate native/acceptance roles; no graph or asset equality is inferred
here. Package tests and test/fixtures/conformance.json remain acceptance source,
not production initialization assets or executed evidence. Full test fixtures,
all nested schema references, distribution packaging of repository-relative docs
assets and byte parity with generated/copied assets remain later freeze work;
this inventory does not claim recursive schema dependency closure.

## Planned Acceptance And Limits

1. Compare common leaf type/version identity, erased generic defaults and L1-only
   dependency direction with root/runtime/shared aliases and negative native
   imports on one frozen source. No broader barrel counts as L1 permission.
2. Preserve each export's API/type/default/import initialization, schema/catalog/
   dependency errors and package asset resolution. Verify generated/tool/source
   parity after authorization, not by filenames or this manual table.
3. Exact JSON/Unicode/integer/byte/depth/JCS/digest/time/refusal boundaries, native
   ADP2 internal reuse versus ADP3 live rejection, Relay/Multihop bindings and
   offline Transit/staged-echo separation, parser order and immutable projections.
4. Probe versions/service/selection/context/TLS/challenge/proof/frame/counters and
   message digest identity; separate structural validation from live authority,
   certificate trust and product permit/currentness checks.
5. Four handwritten telemetry families versus their actual schemas/fixtures,
   precise uint64/BigInt, null/availability/coverage/epoch/tail/conservation/order
   and body bounds; no new health, billing or execution interpretation.

Every case is planned and unexecuted. No tests, type/syntax/static/import/boundary
checks, formatter, generator, build, network/native/CI experiment or Git write
ran. No package code change is justified by the inspected native codec purposes.
The full consumer/schema/default/private graph and integrated dirty-source frozen
manifest remain open. A5/foundation acceptance and upper-module gates remain unmet.
