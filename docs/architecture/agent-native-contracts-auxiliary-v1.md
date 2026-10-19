# Agent Native Contracts And Auxiliary Owners v1

Date: 2026-10-19 (Asia/Shanghai). Manual A5 source classification, unverified.
Only this document changes in this slice. No code/API/asset is modified, moved,
generated or executed. No new wrapper or FR is needed to describe these native
owners. This is not a complete frozen source manifest or boundary acceptance.

Main integration follow-up: exact production leaves/assets/public native entries
from this inventory are now declared in foundation-boundaries-v1.json, with no
parser/asset generation or boundary check. Readiness160 contains the five planned
groups by reference; it remains unexecuted. The native source purposes replace the
named old package-level classification debt only, not full consumer/type/private/
asset parity or acceptance requirements.

## Exact Codec Production Leaves And Assets

Paths in this section are relative to agent/internal. Tests are separate planned
acceptance source, not production leaves or evidence. An actual
`embeddedschema` package/directory is not present in the inspected tree: each
validator owns its embedded assets through go:embed. Generated declaration and
schema files are native L2 external representations, not generic L1 facts.

| Native package | Exact production Go files | Exact package assets | Public Go surface and actual consumers |
| --- | --- | --- | --- |
| contracts | validate.go, time.go, types_generated.go | schema.json | MaxCounter, ParseJSON, ValidateStructure, ComputeDigest, CanonicalHost, ValidCIDR, ParseMessage, MessageNames; DirectConfig/Assignment/Policy and six message families. Used by adp3/adp3relay/relaycontracts, all Probe codecs, nativeexecution/forward/relay, Agent enrollment/identity/proof/state, observationwire, Transit codecs and acceptance fixture. |
| adp3 | validate.go, multihop.go, types_generated.go | schema.json, execution.schema.json, both embedded by validate.go | Parse, Names, HopPathDigest, ValidateMultihopAssignment plus exact aliases to adp3execution; consumed by nativeexecution, executiondriver, Relay, Runner legacy typed adapters/state and cmd/adp-validate. |
| adp3execution | types_generated.go | schema.json | Native generated declaration owner; adp3 aliases its full type set. Has no validator/embed entry of its own. Its schema asset is not the directly embedded adp3/execution.schema.json path; both must remain identified in a frozen asset manifest. |
| adp3relay | validate.go, types_generated.go | schema.json | Parse(name,raw,destination); native Binding/ProfileConfig/RelayConfig/RelayDriver/Assignment/Tombstone and generated wire declarations; consumed by adp3, nativeexecution and Relay engine/configuration. |
| relaycontracts | validate.go, types_generated.go | schema.json | Parse; Id/Counter/Digest, Binding, ProfileConfig, Open, Accept, Reject; consumed by adp3/adp3relay, Relay wire/engine and network-fixture negative probes. |
| probenegotiation | validate.go, types_generated.go | schema.json | ParseRequest/ParseResponse, NewRequest, CheckResponse; generated Request/Response and Id/InstanceId/Counter/Time; nativeexecution/probe_http and retained Control negotiation types. |
| probeinstance | validate.go, types_generated.go | schema.json | ParseRequest/ParseResponse, NewRequest, CheckResponse; generated Request/Response and Id/InstanceId/Counter/Epoch/Time; nativeexecution/probe_http and retained Control registration types. |
| probeclaim | validate.go, types_generated.go | schema.json | ParseRequest/ParseResponse, NewRequest, CheckResponse; generated Binding/Request/Response and scalar aliases; nativeexecution/probe_http and retained Control claim types. |
| probedelivery | validate.go, types_generated.go | schema.json | ParsePollRequest/Response, ParseStatusRequest/Response, CheckPollResponse/CheckStatusResponse; Binding/Offer/Poll/Status and scalar declarations; nativeexecution/probe_http/probe_delivery_wire and retained Control delivery types. |
| proberesult | validate.go, types_generated.go | schema.json | ParseRequest/ParseResponse, ResultDigest, CheckResponse; Binding/Request/Response/scalars; nativeexecution/probe_result_wire, Control retained execution and observationwire/probe counter types. |
| probetypes | validate.go, types.go | schema.json | Parse and Check pairs for Qualification/Poll/Claim/Status/Result, ResultBody/ResultDigest; Machine/Descriptor/Binding/Offer and five request/response families; nativeexecution versioned wire and Control typed family. |
| probeservices | validate.go, types.go | schema.json | Same five Parse/Check pairs and result helpers plus ParseServiceSelection/ParseSelection/ParseServiceContext/SelectionFromContext; Binding aliases probetypes.Binding; own Machine/Descriptor/Selection/ServiceEndpoint/ServiceTrust/ServiceConfig/ServiceContext/TLSResult/Offer and request/response types; nativeexecution and Control service family, probeecho aliases/codecs. |
| probeecho | validate.go, types.go, frame.go | schema.json | Same five Parse/Check pairs and ResultBody/ResultDigest; IsEcho/Measurements/DescriptorFor; ParseServiceConfig/Context/Selection/Challenge/Proof/Invocation, SelectionFromContext; CloneContext/CloneExecution; InvocationDigest/RequestFrame/VerifyProof/VerifyEchoResponse/DecodeEchoRequest/SignEchoResponse; nativeexecution, Control echo family and Probe native effect implementation. |

All listed schema.json assets except adp3execution/schema.json are embedded by
their own validate.go. adp3 additionally embeds execution.schema.json. Headers of
generated files identify protocol schema origins under docs/protocol/schemas;
this reading does not assert generated-output equality or run a generator. Keep
source schema, copied package asset and generated declarations in later exact
revision acceptance; a filename alone is not a content identity.

adp3/types_generated.go is a compatibility alias leaf, not another declaration
generator output owner. It aliases Id/Counter/CounterOrZero/Time/Digest/Protocol/
Phase/Condition, Listen/Target/DirectConfig/Driver/Assignment/Tombstone/Observation/
Drain/Policy, HelloRequest/HelloResponse/Snapshot/ReportRequest/ReportAck/
ErrorResponse, Binding/ProfileConfig/RelayConfig/RuntimeConfig/Resource and
HopNode/HopConfig/MultihopConfig to the same adp3execution declarations. Existing
typed consumers keep type identity and native JSON tags. Removing this path needs
every actual native/Runner/state/engine consumer migration and explicit accepted
source compatibility; it is not dead simply because a new owner exists.

probeecho's Binding/Selection/Machine/TLSResult alias probeservices; services'
Binding aliases probetypes. Echo owns its extended Descriptor, config/context,
Challenge/Proof/Invocation/Execution/Offer and actual v4 message fields. Its
StatusRequest aliases ClaimRequest. Do not flatten these version distinctions,
drop businessProtocol/Service/Challenge/TLS/Echo/payload fields or merge their
result digests when classifying native dependencies.

## Initialization, Errors And Real Legacy Direct Use

Each validator uses its own lazy sync.Once compile, schema map and sticky compile
error. No parser shares another package's compiler state or execution authority.
contracts/adp3/adp3relay/Probe validators assert formats; relaycontracts retains
its original compiler setup without silently adding AssertFormat. Preserve
package-specific unknown-name/schema/identity/semantic errors and original
bounded IJSON -> schema -> JCS -> typed decoding/semantic order. Probe pair
checkers validate request before response and retain their exact echo fields.
No parser samples a current lease clock or issues a ticket merely by parsing a
receipt; wire timestamps are relations between supplied values.

contracts ParseJSON keeps bytes/UTF-8 bounds, duplicate key/depth, exact safe
integer, trailing-data and lone-surrogate/JCS rejection. ComputeDigest keeps
json.Marshal -> JCS -> SHA-256 with sha256: prefix. contracts/time.go keeps its
private UTC instant/fraction comparison rather than replacing arbitrary supplied
fraction strings with nanosecond-rounded wall time. ADP3 keeps its 4 MiB general/
1 MiB Report limits, relaycontracts 4096 and adp3relay 16384. Probe defaults are
4096; service/echo have their existing larger PollResponse/context bounds and
echo has its smaller Challenge/Proof bounds. These values are not unified here.

The actual Direct source chain remains important:

1. adp3.Parse first validates ADP/3 structure (or the explicit execution-extension
   Snapshot schema), then canonicalizes and validates native semantics.
2. Non-Snapshot messages reuse contracts.ParseMessage through an internal
   protocolVersion-2 projection after ADP/3 structural rejection. The returned
   public message is decoded from the original ADP/3 canonical bytes.
3. A Direct Snapshot assignment is projected to the original listener/config
   shape inside a synthetic ADP/2 Snapshot for retained stateless native rules;
   an empty synthetic Snapshot reuses original time/lease-format validation.
   This is internal codec reuse, not acceptance of a wire ADP/2 Snapshot by the
   production ADP/3 entry, and not execution of retained authority.
4. nativeexecution.DirectAssignment/directPolicy separately convert actual ADP/3
   values into contracts.Assignment/DirectConfig/Policy for original Forward
   TCP/UDP engines. Thus the generated ADP/2-named Direct declarations have live
   production consumers. Deleting them would break original conversion/engines.

Contracts legacy six-message validation is also a callable public codec surface.
Removing it requires migrating ADP3 stateless semantics, native Direct types,
fixtures and every protected/native ParseJSON/digest consumer with compatibility
evidence; renaming an import or asserting production protocol 3 is insufficient.
No live API now chooses protocol 2 as a result of this classification.

Probe v1/v2/v3/v4 packages are native closed representations, not product Probe
executor ownership. v1 constructor defaults preserve protocol 3/probe 1 and exact
kind/capability/timeout/attempt/payload values. v2/v3/v4 remain separately bounded
families. v3 parses structural service context/digests, not the live registry or
full X.509 authority. v4 frame.go owns fixed 256-byte nonce frames, domain bytes,
Ed25519 signatures and supplied-now DecodeEchoRequest; a signable EchoRequest has
private decoded/frame/publicKey fields. A zero/caller-invented request cannot
become signable through exported metadata alone. These pure/native crypto formats
do not authorize an Agent, enable echo issuance or make the separate TLS-only
observation responder into an echo server.

## Auxiliary Production Roots And Independent Native Service

| Exact source | Classification, lower public chain and original behavior |
| --- | --- |
| agent/cmd/adp-validate/main.go | Native operator format root: one message name, bounded stdin, adp3.Parse only; usage exits 2, read/parse failure exits 1, success JSON declares protocolVersion 3. It binds no socket and issues no authority. |
| agent/cmd/time-proof/main.go | Native operator root over authorization.ValidateProofBoundary/SynchronizedClock/ReadSystemSynchronization/WriteProof and state.AtomicWrite; no flags reads native OS sync; check mode validates without setting the OS clock; out/key must pair and directories differ; missing key gets original 32 random bytes; watch refreshes every 5 seconds; provider failure writes unsynchronized status; errors return to stderr/exit 1. It does not own Runtime tickets/Journal or clear protected execution history. |
| agent/cmd/tunex-observation-responder/main.go | Existing independent service root: explicit identity/listen/cert/key/CIDRs/expiry flags, native signal cancellation, observationresponder.Config -> Run. Defaults max connections/rate are each 16 with hard ceiling 64; CLI rejects positional/unbounded inputs. No Agent/Relay identity provider is loaded. |
| observationresponder/config.go | L2 explicit operator configuration, exact numeric endpoint/canonical DNS/UTC-ms finite expiry/source CIDRs and identity URI; Config, ALPN and bounded constants are public. No upstream or DNS target selection. Zero optional limits use original 16 defaults, explicit invalid values reject. |
| observationresponder/server.go | L2 public Run; actual listener/accept, source admission, endpoint-wide tokens/map, TLS deadline/supervision and cancel/close/wait. No product control/permit/Runtime state collaborator. |
| observationresponder/tls.go | L2 bounded operator file/PEM/DER/X.509/key handling, exact service SAN and dedicated server purpose, SNI/ALPN/TLS1.3 and native revalidation. Native effects are its purpose, not leakage into generic L1. |
| observationresponder/wire_budget.go | L2 private TLS wireBudgetConn, public MaximumReadWireBytes/MaximumWriteWireBytes 32768 each, atomic exhaustion and fixed read/write/error behavior; it does not parse or forward application payload. |
| observationresponder/key_permissions_linux.go | Linux-only effective UID and regular mode 0400/0600 check; exact build-tag native adapter. |
| observationresponder/key_permissions_other.go | !linux adapter returns false; unsupported ownership/Windows ACL evidence remains fail-closed, not a new portability claim. |

The responder startup chain is parseConfig(time.Now) -> load operator TLS ->
cancellation check -> explicit tcp4/tcp6 listen -> actual endpoint verification
-> original server/maps/token state -> supervise -> accept/admit/handshake.
Credential/input rejection precedes listen. The original partial listener mismatch
closes that listener. Normal cleanup cancels supervisor, stops sockets, waits for
supervision and admitted workers. Native timing/order is not injected or changed.

Dedicated service credential handling keeps Lstat/Open/Stat/SameFile/mode/size/
read/post-Stat guards, one PEM block, 16 KiB PEM/8 KiB DER, exact DNS+URI SAN,
ServerAuth-only leaf and original bounded RSA/ECDSA/Ed25519 choices. Non-Linux
private-key ownership is unverified and rejected. Service validity is finite,
at most seven days and no later than the leaf. A 100 ms supervisor and admission/
handshake checks retain certificate/time failure. TLS handshake is bounded by
2 seconds, overall connection by 3 seconds and credential/service expiry. Raw
TLS wire has the separate fixed 32768-byte limits; reaching a limit closes the
socket with the original error. Source CIDRs restrict network origin, not Scope
authentication. Completion performs no application read/write, echo, dial or
business Open. It must not be described as a general health/execution service.

## Acceptance Infrastructure And Integration Boundaries

agent/cmd/network-fixture production-buildable Go sources are main.go, load.go,
tcp_proxy.go, relay_negative.go, udp_route_monitor.go; load_test.go is test source.
Their purpose is acceptance infrastructure, not Agent production authorization:
isolated target/probe/load/proxy/negative/route modes, explicit IPv4 and bounded
fixture/run identities, original native sockets/time/randomness and probe data.
This slice reads the entry/purpose and consumers, not a full line-by-line safety
classification of every fixture body. Do not classify the fixture package as a
production execution owner or count a hosted fixture as independent physical-host
evidence. No fixture source or experiment changes here.

No runtime code change is warranted by these inspected codec/responder/native
root purposes. Main can integrate the exact table leaves and assets as L2/native
roots, and fixture files separately as acceptance infrastructure. No new provider,
public version, FR, root, private-import exception or alias is added. Existing
aliases/removal conditions remain explicit rather than claiming dead legacy code.

This scope does not certify product Probe executor source, Control/state/authority,
Transit codecs/engines, telemetry observationwire, or operator Recovery. Those
appear as consumers only. scripts generation tooling, external source-schema
content parity, network-fixture full bodies, all test/fixture imports and the
integrated whole-repo source/type/private/default graph remain outside this slice's
complete classification. All must be represented in final A5/freeze work.

## Planned Acceptance, Not Executed

1. Exact schema/generated/alias identities and their full production assets on
   one frozen revision; embedded compilation failures and sync.Once/sticky error
   order, unknown names, limits, IJSON/integers/JCS/digest and sub-ns UTC fractions.
2. ADP3-first protocol refusal, internal synthetic ADP2 reuse, native Direct config/
   policy conversion, extension schema selection, logical/physical/tombstone/path/
   digest error order and no live ADP2 or authority fallback.
3. All Probe family constructors/parse/check/type aliases and version-specific
   Service/Challenge/TLS/Echo/payload/digests, structural-versus-X.509 distinctions,
   frame/proof/malformed/zero signable requests and exact supplied-time boundaries.
4. Auxiliary usage/stdin/output/error/default behavior, proof mode/out/key/watch/
   unsynchronized handling and no execution-history effects. Native system/network
   evidence belongs in later authorized Actions, not local source inspection.
5. Observation responder canonical inputs/explicit address/SNI/ALPN/SAN/leaf,
   permission/platform/TOCTOU/key bounds, source/token/connection/wire/deadline limits,
   partial start/cancel/expiry/cleanup and absence of upstream/application/Agent
   authority. Physical unsupported-platform evidence remains unverified.

No tests, type/syntax/static/import/boundary checks, formatting, generators,
builds, CI, network/native/PKI experiments or Git writes ran. This manual source
inventory is not enforcement, behavior proof, full frozen A5 or accepted A4.
