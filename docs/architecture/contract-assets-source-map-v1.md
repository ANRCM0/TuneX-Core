# Contract Assets Source Map v1

Date: 2026-10-19 (Asia/Shanghai). Manual source/representation mapping; not a
generated parity report, successful schema compilation or accepted package.
No parser, generator, formatter, checker, test, build or network operation ran.

This closes the named source-to-loader/output navigation for the21 current
docs/protocol/schemas files and the native driver catalog. It does not prove
their semantics, copied bytes, generated declarations, fixtures, default values
or every importing consumer equivalent on the eventual frozen revision.

## Schema Files, Consumers And Representation Owners

Schema paths below are relative to docs/protocol/schemas. TS leaves are relative
to packages/contracts/src; Go paths are relative to agent/internal. Package
public entries are in packages/contracts/package.json and its updated README.

| Source schema | Declared ID | Native TS loader | Agent source asset/owner |
| --- | --- | --- | --- |
| adp-v2-direct.schema.json | urn:tunex:adp:2:direct | validate.ts | contracts/schema.json embedded by validate.go; generated types_generated.go |
| adp-v3-runtime.schema.json | urn:tunex:adp:3:runtime | adp3.ts | adp3/schema.json embedded by validate.go; same parser uses the explicit extension copy separately |
| adp-v3-execution.schema.json | urn:tunex:adp:3:execution:1 | adp3.ts separate execution validator | adp3/execution.schema.json embedded by validate.go; adp3execution/schema.json is a generator output with canonical generated types, not another embedded runtime parser |
| native-relay-v1.schema.json | urn:tunex:relay:1 | relay.ts | relaycontracts/schema.json embedded by validate.go; generated types_generated.go |
| adp-v3-relay.schema.json | urn:tunex:adp:3:relay | relay.ts separate assignment/tombstone validator | adp3relay/schema.json embedded by validate.go; generated types_generated.go |
| transit-v1.schema.json | urn:tunex:multihop:transit:1 | transit.ts | transitcontracts/schema.json embedded by validate.go; handwritten native Transit values |
| adp-v3-transit.schema.json | urn:tunex:adp:3:transit:1 | adp3-transit.ts | adp3transit/schema.json embedded by validate.go; handwritten offline types/validator |
| adp-v3-transit-negotiation.schema.json | urn:tunex:adp:3:transit:negotiation:1 | transit-negotiation.ts | transitnegotiation/schema.json embedded by validate.go; handwritten values/validator |
| adp-v3-transit-delivery.schema.json | urn:tunex:adp:3:transit:delivery:1 | transit-delivery.ts | transitdelivery/schema.json embedded by validate.go; handwritten values/validator |
| probe-negotiation-v1.schema.json | urn:tunex:probe:negotiation:1 | probe-negotiation.ts | probenegotiation/schema.json embedded by validate.go; generated types_generated.go |
| probe-instance-v1.schema.json | urn:tunex:probe:instance:1 | probe-instance.ts | probeinstance/schema.json embedded by validate.go; generated types_generated.go |
| probe-claim-v1.schema.json | urn:tunex:probe:claim:1 | probe-claim.ts | probeclaim/schema.json embedded by validate.go; generated types_generated.go |
| probe-delivery-v1.schema.json | urn:tunex:probe:delivery:1 | probe-delivery.ts | probedelivery/schema.json embedded by validate.go; generated types_generated.go |
| probe-result-v1.schema.json | urn:tunex:probe:result:1 | probe-result.ts | proberesult/schema.json embedded by validate.go; generated types_generated.go |
| probe-types-v2.schema.json | urn:tunex:probe:types:2 | probe-types.ts | probetypes/schema.json embedded by validate.go; handwritten typed values/validator |
| probe-services-v3.schema.json | urn:tunex:probe:services:3 | probe-services.ts | probeservices/schema.json embedded by validate.go; handwritten service/TLS values/validator |
| probe-echo-v4.schema.json | urn:tunex:probe:echo:4 | probe-echo.ts | probeecho/schema.json embedded by validate.go; handwritten staged Echo values/validator |
| telemetry-v1.schema.json | urn:tunex:telemetry:1 | specification asset; telemetry.ts validates by hand | observationwire/telemetry.go native DTO/encoder/ACK parser; no schema embed |
| forward-telemetry-v1.schema.json | urn:tunex:forward-telemetry:1 | specification asset; forward-telemetry.ts validates by hand | observationwire/forward_telemetry.go and counter_types.go; no schema embed |
| host-telemetry-v1.schema.json | urn:tunex:host-telemetry:1 | specification asset; host-telemetry.ts validates by hand | observationwire/host_telemetry.go and host_types.go; no schema embed |
| probe-telemetry-v1.schema.json | urn:tunex:probe-telemetry:1 | specification asset; probe-telemetry.ts validates by hand | observationwire/probe_telemetry.go and counter_types.go; no schema embed |

### Reference And Loader Meaning

The read21 schema documents declare their own URN IDs and local #/$defs references.
The observed reference declarations do not introduce a second repository file or
an external resource URI. They include local nested definitions for Profile/Relay/
multihop configs, Probe machine/permit/service/challenge/proof and telemetry facts.
The JSON Schema dialect URL in $schema and each resource's $id identify schema
semantics/resources; they are not repository file paths or proof of a network
fetch. No validator/resolver was executed, and this reading does not prove that
every local target exists, compiles, refuses malformed input or resolves correctly.

TS native loaders register the loaded resource and compile named definitions at
module initialization. adp3.ts has separate Runtime and execution-extension AJV
instances; relay.ts separately registers native Relay and ADP3 Relay resources.
Importing runtime/root/shared can therefore initialize transitive native schema
work even when an application calls only one export. Preserve original error
timing; do not convert missing/malformed assets to a permissive fallback.

Agent codecs use their embedded byte variables and original sync.Once compiler
initialization, configured resource IDs and named definitions. adp3/validate.go
registers runtime and execution resources, chooses the extension validator at
the existing Snapshot executionExtension site, and retains its separate value
types from adp3execution via generated aliases. Schema availability is distinct
from driver/capability/feature/Guard/Journal acceptance. No schema moves into L1.

Reading document IDs does not prove identical embedded bytes. Those independently
saved Agent copies remain part of the candidate and need parity and compilation
acceptance; schema-level semantic checks and native post-parse checks also remain.
The four telemetry specification assets do not become the runtime validators
merely because they are copied into the Control image with other schemas.

## Exact Existing Generation And Comparison Responsibilities

The following scripts were read as source, never invoked, including their check
modes. They remain unchanged in the current source-only phase.

| Existing tool/input | Declared output/responsibility | Deliberate scope limit |
| --- | --- | --- |
| scripts/generate-multihop-schema.mjs, adp-v3-runtime.schema.json | Derives adp-v3-execution.schema.json with new ID, hop/config/driver/role and executionExtension declarations | Does not write an Agent embed/type file or enable execution |
| scripts/generate-go-contracts.mjs, ADP2 Direct | contracts/schema.json and types_generated.go | One named generator target |
| Same tool, native Relay and ADP3 Relay | relaycontracts and adp3relay schema.json/types_generated.go | Separate message/config versus assignment/tombstone families |
| Same tool, execution extension | adp3/execution.schema.json and alias types_generated.go; adp3execution/schema.json and canonical types_generated.go | Does not write adp3/schema.json; shared Go types do not make Runtime schema accept the extension implicitly |
| Same tool, five independent Probe v1 schemas | probenegotiation/probeinstance/probeclaim/probedelivery/proberesult schema.json/types_generated.go | Does not generate typed v2, services v3, Echo v4, Transit or telemetry values |
| scripts/check-transit-adp-schema.mjs | Reads existing offline ADP Transit, negotiation and delivery source/embed pairs; original production Runtime refusal and contract-only assertions | Comparison source only, not a generator or executed result; does not cover transit-v1.schema.json or every embedded asset |

The Go generator calls gofmt and mkdir before its write/check branch. Its check
mode normalizes actual CRLF to LF for each named output, but is still a formatter/
process invocation prohibited during this source phase. Do not run it to obtain
an asset list or interpret its final console message as current evidence.

The Transit comparator has three distinct textual comparisons: ADP Transit
normalizes actual CRLF; negotiation replaces literal escaped backslash sequences;
delivery compares raw strings. These source semantics are not a uniform newline-
normalization guarantee. Later concentrated verification must preserve intended
contract checks while resolving cross-platform newline/parity coverage; this
slice neither changes the checker nor claims any pair differs or passes.

The runtime schema, offline Intent/Transit copies and handwritten Probe/telemetry
families must have explicit source/copy/default/consumer acceptance. Adding all
of them to the existing generator is not authorized or required by this map.
Do not delete the adp3execution schema output simply because the native parser
embeds adp3/execution.schema.json instead; its generator/check consumer still
exists. No copied schema becomes the authoritative L0/L1 declaration.

## Native Driver Catalog And Actual Compiled Providers

packages/contracts/data/native-drivers-v1.json is the only catalog data input in
the inspected TS chain. native-drivers.ts reads it at module initialization,
parses bounded JSON, requires the closed three-ID catalog/descriptor fields,
deep-freezes the result and computes its existing native digest. Runtime/root
entries expose the existing catalog/constants/parser. This is metadata and a
native representation check; schemaId is descriptive data, not an automatic
schema loader, plugin source path or execution authorization.

| Catalog descriptor/order | Current declared schema, roles and transport | Original Agent compiled source |
| --- | --- | --- |
| native.direct.v1, first | urn:tunex:adp:3:runtime; direct/active, tcp+udp with native tcp/udp carriers, no required Agent flag | nativeexecution/direct.go Direct(), original native Start/Replace/Phase/Probe hooks |
| native.relay.v1, second | urn:tunex:adp:3:relay; ingress/egress, prepared/active/draining; tcp carrier for both business protocols; --relay | nativeexecution/relay.go Relay(), original TLS/engine/phase/classification hooks |
| native.multihop.v1, third | urn:tunex:adp:3:execution:1; ingress/transit/egress and same three phases; tcp carrier; --relay and --multihop, Control multihop gate | nativeexecution/relay.go Multihop(), original path/TLS/phase/classification hooks |

nativeexecution/catalog.go BuiltinDrivers returns the same named native provider
order directly; it does not load the TS JSON or register a provider named by its
contents. The typed executiondriver maps to the existing generic executionhost,
and original Control wrappers/registry still bind actual callbacks, features and
platform decisions. Catalog/Go declarations remain separate representations;
their correspondence was navigated, not byte/behavior accepted.

Capabilities() begins with adp.3 and appends capabilities only for the existing
enabled-on-platform/feature drivers, with duplicate suppression. Its original
Probe additions additionally depend on explicit ingress/services/Echo options
and actual native hooks. Catalog metadata has no live Transit descriptor and
does not install Echo execution or certify Probe ingress. Metadata limits,
privilege/security/usage declarations do not replace real OS policy, configured
limits, identity/Guard checks or measured counters. Keep catalog1/descriptor1/
assignmentSchema1 separate from host-interface and protocol versions.

## Consumer, Distribution And Acceptance Closure

The package README now names all11 supported imports instead of its historical
ADP2-only description. Three common entries remain lower; other native entries
keep their exact exports and type identities. No alias removal, export expansion,
schema/default/version change or new runtime loader follows from this doc fix.

Control's existing COPY of packages/contracts and docs/protocol/schemas supplies
the source-relative TS paths declared above. Agent/responder builders copy Agent
source, including its embed/type inputs. These are actual source declarations,
not evidence that images build, all import graphs load, binaries contain expected
assets or staged features are end-to-end available. Source/copy/fixture/dependency
license and exact-content acceptance remain independent where not proven.

Readiness197-199 covers the named21 schema/copy/generated/handwritten roles,
package-entry loading/refusal and catalog/provider correspondence. All cases are
planned/unexecuted. No test/CI tooling is expanded and no parser/Go schema/schema
copy is changed in this slice. Broader A5 per-leaf/type/private/default/consumer/
fixture closure and final frozen revision remain open; foundation and upper-
module acceptance gates stay closed.
