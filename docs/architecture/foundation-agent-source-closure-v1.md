# Foundation Agent Source Classification Closure V1

Date: 2026-10-19 (Asia/Shanghai). Source inventory, authored and unverified.
The human explicitly authorized parallel agents for A5. This document belongs to
the Agent slice; it does not authorize parallel product implementation or open
the foundation gate. FR-0023/FR-0024 implement the concrete timing/credential lower
representation residuals after recording their proposals. No test or tool changes.
Paths below are relative to `agent/` unless stated.

## Task Proposal And Meaning Of Closure

1. Layers: existing L1 execution/runtime ports, L2 native owners and L3 Agent
   orchestration, plus explicitly named commands and acceptance infrastructure.
2. Consume the current executionhost, executiondriver, executionstate,
   executiontime, executionidentity/channel/enrollment, runtimeplatform,
   runtimeobservation and their public native provider APIs.
3. Foundation L1/L2 source changes under recorded FR-0023/FR-0024; domain Core and
   existing single Guard/Journal/current-instance authority owners stay protected.
4. executiontime2/platformclock2 split parsed lower timing facts from native status;
   executionidentity2/agentidentity2 split lower credential facts from native records;
   nativeexecution2 binds native RelayResponse. Breaking lower serialization/type
   assumptions and native alias identity are explicit in their FRs.
5. Acceptance is planned for an authorized frozen source revision in Actions;
   no tests, checks, formatting, generation, builds, experiments or CI executed.
6. Independent Agent document only; shared readiness/candidate/boundary integration
   belongs to the coordinating agent. No shared composition edits.

Closure here means every named source family has an owner, consumer route and
compatibility/removal disposition. It does not mean every mixed historical
declaration has passed a tool, runtime equivalence is proven, or a frozen candidate
is accepted. The two concrete lower format residuals below are source-migrated
under their FRs, with compatibility and acceptance still unverified.
Existing owner documents are detailed explanations; their historical statements
that the entire Agent graph was outside that earlier slice are narrowed by this
ledger, not converted into evidence of successful acceptance.

## L1 And Native Specialization Leaves

All files in a row share only the stated owner; rows are not directory exemptions.
Public means exported compiled-in Go API, not a supported external binary plugin.

The coordinating owner retains HostVersion1's existing public descriptor vocabulary:
platform metadata names linux/windows, phases prepared/active/draining and protocols
tcp/udp are bounded pure declaration validation in executionhost.NewRegistry.
They are not OS discovery, native implementation branches or a promise of arbitrary
platform support. This is the established host contract recorded by
agent-execution-host-v1.md, so A5 classification does not widen the accepted set or
move its refusal/error priority into another caller. executiondriver owns actual
runtime.GOOS selection. Later acceptance must cover invalid/unknown metadata names,
valid metadata on the wrong actual platform, feature gates and unchanged refusal
order. Adding another supported metadata vocabulary requires a separate FR.

| Exact leaves under internal/ | Layer and public surface | Actual consumers and disposition |
| --- | --- | --- |
| executionhost/driver.go, executionhost/registry.go, executionhost/prepared.go | L1 Host/Driver/Instance/Descriptor/Features/Selection/ProbeTarget, Registry and PreparedInstance; generic trusted callbacks, no native engine | executiondriver specializes native assignment/policy/identity; nativeexecution offline adapter uses PreparedInstance. Keep clone, bounded registry, zero-value and error order. |
| executiondriver/driver.go, executiondriver/registry.go | L2 native public aliases and Registry, EnabledOnCurrentPlatform; ADP3/relay.Identity and actual runtime.GOOS | nativeexecution and control declaration/translation/selection; platform is the local process platform, never observed/remote authority. |
| executionstate/types.go, executionstate/runtime.go | L1 RuntimeHost, RuntimeStore, SnapshotInput/Codec and tagless history facts, interface3 | state runtime adapter; platformruntime Bootstrap output; Runner converts facts back to native records. One original authenticated Journal host. |
| executiontime/clock.go, executiontime/guard.go, executiontime/synchronization.go | L1 injected Sample/Clock, Guard/Ticket, tagless parsed synchronization facts and decisions, interface2 | authorization delegates; platformclock supplies samples and native status projection; Runner uses old authorization API. Guard latching, immutable tickets, holdover/cache/host/source checks retain original ownership. |
| executionidentity/provider.go | L1 Provider with native Certificate/Roots parameters, locations and tagless credential facts, interface2 | agentidentity implements explicit native/facts boundaries; agentplatform selects default; Control production consumes facts while JSON fixture aliases use native records. No key loading or issuance implementation in this declaration. |
| executionchannel/provider.go | L1 generic Provider/Auxiliary, HTTPError, Reply and forbidden-URL sentinel, interface1 | controlchannel implementation; agentplatform, Control Runner/Probe/exporters. Reply Body lifetime remains with caller. Status/HTTP terminology is explicit channel contract. |
| executionenrollment/host.go | L1 typed Platform/Channel/Host, options/credential and ordered enrollment, interface1 | agentenrollment binds native implementations; agentcli and agentcommand consume options. Original partial final writes and deferred reply/client cleanup persist. |
| runtimeplatform/ports.go, runtimeplatform/dial.go | L1 Bootstrap, scheduling/timer, entropy, measurements/logging and generic Dialer, interface2 | platformruntime implements; Probe and Control use public providers. Scheduling is distinct from authorization evidence; measurements cannot write Journal/credentials through this port. |
| runtimeobservation/ports.go, runtimeobservation/host.go | L1 Provider[HostValue], process/memory and tagless host facts, interface2 | platformobservation specializes native host output; no native Host JSON fallback in lower facts. |
| agentplatform/native.go | L2 Providers/Effects/LocalServices canonical native groups and stateless defaults, interface1 | Control old names alias these exact groups; TLS/X509/HTTP/native observation types are explicit L2 specialization. No Control or Probe product implementation dependency. |
| agentcommand/host.go | L3 command mode decisions and Platform/Runner ports, interface1 | cmd/tunex-agent supplies agentcli.Native and control.New. control.Options and agentcli.Options/Paths references are explicit product-command contracts, not a purported generic L1 host. |

## Native Providers And Protected State Leaves

| Exact leaves under internal/ | Owner and public entry | Consumer, platform/default and private scope |
| --- | --- | --- |
| agentidentity/native.go, agentidentity/records.go | L2 Native and canonical native credential/rotation/Relay records, explicit facts conversions and original file/crypto adapters, interface2 | executionidentity provider and Control old helper wrappers; preserve bundle corruption versus missing semantics and no invalid-bundle fallback. |
| agentenrollment/native.go | L2 Native(), Platform and Channel implementations | executionenrollment host via agentcli; explicit X509/HTTP/file/key/CSR binding. Partial durable writes remain under original state owner. |
| agentcli/arguments.go, agentcli/native.go | L2 parsed flags/Options, Paths and Native command effects | cmd/tunex-agent and agentcommand. Native URL/path/env/signal/boot ID/inspection/enrollment effects stay here; inspection refuses mutating flag combinations before file work. |
| controlchannel/http.go, controlchannel/auxiliary.go, controlchannel/runtime_values.go | L2 Native client/request/auxiliary implementation, public old HTTP wire aliases/values | Control requests and four telemetry/Probe families via executionchannel. Native HTTP/TLS/URL/JSON mechanics, redirect and bounded bodies are this adapter's purpose. |
| platformruntime/native.go, platformruntime/local.go, platformruntime/dial.go | L2 Bootstrap, Schedule, Local, Dialer/native factory | agentplatform defaults, Probe native effects and existing private wrappers. Bootstrap delegates state/authorization rather than owning a second store; local files are measurements only. |
| platformclock/clock.go, platformclock/clock_linux.go, platformclock/clock_windows.go, platformclock/clock_other.go, platformclock/synchronization_values.go | L2 SystemClock and host/source native sample implementation, canonical native SyncStatus and pure SynchronizationFacts, interface2 | authorization.SystemClock and native status projection. Uptime before UTC wall sample; original build-tag choice and unsupported fail-closed behavior. |
| platformclock/synchronization_linux.go, platformclock/synchronization_windows.go, platformclock/synchronization_other.go, platformclock/windows_status.go | L2 OS synchronization evidence and Windows text parser | authorization public wrappers and time-proof command. Original Linux/Windows source identity and unsupported-platform refusal persist. |
| authorization/clock.go, authorization/guard.go, authorization/synchronization.go | Existing native compatibility owner over executiontime and platformclock; old Clock/Sample/Ticket/SyncStatus/ProofOptions names and Guard methods | Runner, state-independent consumers and time-proof retain public imports. Private Guard wrapping is not another authority; synchronized clock preserves proof-or-OS provider choice and host/source checks. |
| authorization/proof.go | L2 ValidateProofBoundary/WriteProof/ReadProof, native envelope/HMAC/IJSON/file/path representation | platformruntime Bootstrap, agentcli, time-proof; uses state.AtomicWrite, never mutates execution high-water. Keep 32-byte key, 8192-byte envelope, exact fields and boundary refusal. |
| platformstate/files.go, platformstate/lock_linux.go, platformstate/lock_windows.go, platformstate/lock_other.go | L2 AtomicWrite and AcquireLock, original platform implementations | state compatibility delegates. Unsupported lock platform fails rather than silently becoming unlocked. Atomic rename/sync/lock semantics remain native acceptance work. |
| state/platform.go | Existing AtomicWrite/AcquireLock delegates | state internals, agentidentity/enrollment, agentcli, authorization/proof and auxiliary commands; old public entry names cannot be removed before these consumers migrate. |
| state/journal.go, state/native_journal_types.go | L2 canonical native Journal/RuntimeJournal, protected general Load/Save/Initialize/key-envelope implementation | credential bundles, Runner and other state code. Native raw JSON/tags/order/MAC remain here; no history reset or copied durable authority. |
| state/adp3_journal.go, state/adp3_transit_journal.go | L2 runtime and offline Transit authenticated records/validation, explicit upgrade/import and original protected history | Runner and offline TransitController; import is explicit retired high-water, no live offline execution fallback. |
| state/runtime_adapter.go, state/runtime_facts.go, state/runtime_values.go | L2 original native store/input/codec and explicit facts/native projections | executionstate RuntimeHost at existing AcceptRuntimeSnapshot boundary; same bytes/maps/pointers and failure return identity by source intent. |
| state/inspect.go | L2 authenticated read-only summary API | agentcli inspection and state tests; no Initialize/Enable/reset/network/permission issuer path. |
| platformobservation/native.go, platformobservation/process.go, platformobservation/process_linux.go, platformobservation/process_other.go | L2 Native, process/memory public samples | agentplatform/Control telemetry and diagnostics; OS process details and unsupported/null fields remain explicitly native. |
| platformobservation/host.go, platformobservation/host_linux.go, platformobservation/host_other.go | L2 native Host aliases/provider and capture/empty values | Control host telemetry; observationwire canonical JSON identity, one existing pending capture worker. OS-visible scope is not physical-host/cgroup evidence. |

## L3 Runner Leaves And Exact Compatibility Consumers

Runner private methods share package-local authority and locks. Their cross-file
calls are same-owner implementation references, not cross-module public APIs.
Native ADP/Probe DTO type references are existing declared L2 consumption; they
do not turn all Runner logic into L1 or allow new private adapter imports.

| Exact leaves under internal/control/ | Product responsibility and public lower route | Compatibility/default/removal disposition |
| --- | --- | --- |
| runner.go | Options/New/Runner.Run; boot/Hello/session/Guard/Ticket/snapshot/reconciliation, persist-before-bind and original instance maps | Explicit NewWith* remain in platform.go. state and nativeexecution APIs own durable and wire details; never move current authority into a codec. |
| platform.go | Providers/Effects/LocalServices aliases, NewWithProviders/NewWithEffects/NewWithLocalServices, default/fallback group projections, Probe construction seam and native point scheduler | FR-0018 exact nil/partial-fixture and native versus injected clock semantics. Probe constructor precedence Echo -> Services -> Ingress -> base after Guard remains. |
| credentials.go, relay_credentials.go | Machine and Relay rotation, atomic reload, native-current identity and request retry lifecycle | executionidentity provider, nativeexecution wire/time; old credentialBundle/rotationRequest and loadCredential/prepareRotation names support same-package fixtures. Keep key/CSR retry identity and no corrupt-bundle fallback. |
| execution_drivers.go, execution_driver_adapter.go | Original private ordered declarations/current registry conversion, duplicate/error/clone order and trusted host callbacks | executiondriver public registry plus nativeexecution declarations. Private descriptor/host/driver shape is fixture compatibility, not a new extension port or second engine. relay.Identity is explicit native specialization. |
| native_direct_driver.go, native_relay_driver.go | Original private Direct/Relay/Multihop names delegate to nativeexecution | Preserve helper signatures, nil callback presence and partial start cleanup. finishRelayStart now consumes executiondriver.Instance through FinishRelayStartInstance; do not repeat older concrete-*relay.Engine debt from historical inventory. |
| native_direct_probe.go | Exact current assignment/instance/ticket/Guard/target binding and direct ingress/service resolution | nativeexecution public destination/endpoint functions and observationtrust. private probeDirect constructs original public Probe default and remains deliberately unwired to a machine endpoint. |
| probe_registration.go, probe_negotiation.go | Registration session, capability/feature negotiation, Gate ownership and independent instance validity | Public Probe, nativeexecution codecs, existing channel/provider seams. Retain native constructor timing and failed-session close. |
| probe_claim.go, probe_delivery.go, probe_workflow.go | Bounded claims/delivery exchanges, exact receipt, burn/tombstone/replay/freshness decisions | Native request/response codecs and Auxiliary own HTTP/format mechanics; private delivery reservation is original process scope, not a reusable permit issuer. |
| probe_execution.go, probe_authority_watch.go | Once-only consumed receipt, watch supervision/currentness/target rechecks, result authority and close/drain | Probe Gate/Executor and native codecs; original 25ms supervision, no overlapping status request and exact report window. Watch scheduler fixture fallback remains explicit. |
| probe_types_instance.go, probe_types_delivery.go, probe_types_execution.go | Typed machine/current generation, delivery/claim/status/result family and exact binding policy | probetypes/probe family DTO and nativeexecution codec public calls; private helper defaults are compatibility paths. |
| probe_services_instance.go, probe_services_delivery.go, probe_services_execution.go | Pinned observation-service family currentness/selection/result and retained service context | probeservices/observationtrust/nativeexecution; no service can override original business target or authorize an instance. |
| probe_echo_instance.go, probe_echo_delivery.go, probe_echo_execution.go, probe_echo_target.go | Exact echo machine/challenge/selection/current native ingress/result proof and target policy | probeecho/nativeexecution and existing Probe APIs; source opt-in feature does not establish deployed realtime Echo v4 issuer readiness. |
| probe_counters.go, forward_counters.go | Current/tail/source identity, bounded retention/page/loss/cursor and original close/reader lifecycle | payloadstats/Probe detached snapshots plus observationwire representation. Native Probe point clock is deliberately separate from Runner retention/page scheduler. |
| diagnostics.go | Product sampling/order and original local diagnostic values | platformobservation, nativeexecution.ReadUDPDiagnostics and measurement provider; direct *forward.UDP implementation assertion is lower-owned. |
| telemetry.go, forward_telemetry.go, host_telemetry.go, probe_telemetry.go | Four existing sampling/exporter lifetimes, sequence/drop/ACK decision stages | observationwire owns encoding/ACK; Auxiliary owns HTTP. Private send* native wrappers remain; live With paths use Runner providers. No telemetry result grants authority. |
| host_resources.go | Old private host resource names alias public native owner | platformobservation/observationwire types; direct lower facts serialization is not native Host JSON. |
| transit_runner.go, transit_runner_bridge.go | Public offline TransitController, prospective private Runner bridge/current physical guard | state offline Journal and nativeexecution PreparedInstance. Not called by deployed Run/poll/catalog; keep separate Control permission and Guard. No live registration or default activation. |

## Native Execution, Engines, Probe And Observation Leaves

| Exact leaves under internal/ | Native/product owner and public consumption |
| --- | --- |
| nativeexecution/catalog.go, nativeexecution/legacy_registry.go | L2 BuiltinDrivers/Capabilities and ValidateLegacyDriverHeader/Declaration; consumed only by existing Control registry and native adapters. Original Direct, Relay, Multihop order; local platform selection; original error precedence. |
| nativeexecution/direct.go, nativeexecution/relay.go, nativeexecution/probe.go | L2 public native driver/phase/replace/start/classification and current Direct observation projections; control old private adapters consume them, forward/relay own engines. |
| nativeexecution/offline_transit.go | L2 identity/prepared instance/offline codec/error binding; TransitController only, not live catalog. |
| nativeexecution/runner_wire.go, nativeexecution/runner_report_projection.go, nativeexecution/runner_keys.go, nativeexecution/assignment_wire.go, nativeexecution/credential_wire.go, nativeexecution/wire_time.go, nativeexecution/diagnostic_values.go | L2 public external DTO parsing/encoding/report projection/native assignment/credential/time/key/diagnostic formatting; Runner, credentials, telemetry and offline callers retain product decisions and original call order. |
| nativeexecution/probe_http.go, nativeexecution/probe_delivery_wire.go, nativeexecution/probe_qualification_wire.go, nativeexecution/probe_result_wire.go | L2 public bounded Probe HTTP/body/strict family/value conversions; Control Probe code owns transport invocation/currentness/claim/result burns, not this package. |
| forward/tcp.go, forward/udp.go, forward/authorization.go, forward/budget.go, forward/probe_ingress.go, forward/payload.go | L2 native Direct socket/config/authorization/payload and original process TCP/UDP permit owners; nativeexecution consumes public Start/Replace/Observe/lifecycle/counter APIs. Relay/Transit share AcquireNodeBudget, never another process budget. |
| relay/engine.go, relay/udp_engine.go, relay/frame_connection.go, relay/multihop.go, relay/native_configuration.go, relay/tls.go, relay/wire.go | L2 native Relay/Multihop socket/TLS/frames/config conversion/lifecycle; nativeexecution and existing Transit consume public APIs; same Engine maps, nodeConnections and shared Forward permits. |
| transit/engine.go, transit/tls.go, transit/wire.go | L2 existing offline Transit Prepare/Engine/Identity/Binding and native TLS/frame implementations; offline adapter/controller and tests consume. Native time/socket/crypto, bounded replay and supplied allow callback retain original semantics. No deployed Runner driver. |
| egress/policy.go | L2 public numeric-address/CIDR destination policy | Forward, Relay and Transit native engines; no DNS resolver, socket or current-authority owner. |
| payloadstats/snapshot.go, payloadstats/counters.go | Detached read shape and existing native entropy/atomic counters | Forward/Relay mutate through existing Counters; Control consumes Snapshot read only. Operational payload values do not establish billing/health/capacity authority. |
| probe/probe.go, probe/gate.go, probe/echo.go, probe/service_tls.go, probe/counters.go, probe/platform.go | L3 binding/result/Gate/CounterSet/admission and trusted Effects specialized to net.Conn | Control uses public constructors/Gate/Executor; native child and observationtrust perform effects/format. Permit/replay/admission/current checks are original product ownership; native compatibility defaults are explicit existing seams. |
| probe/native/defaults.go, probe/native/destination.go, probe/native/echo.go, probe/native/echo_format.go | L2 Schedule/Entropy/fresh Dialer factory, numeric/CIDR/address and bounded native echo exchange/frame formats | Parent Probe via public exports; native child imports no product parent. No independent target or issuer. |
| observationtrust/trust.go, observationtrust/handshake.go | L2 public pinned-leaf Context/Trust/Verification, New/Current/Handshake and native TLS wire cap | Probe/Control service target paths; handshake keeps native time, exact TLS1.3/ALPN/SAN/pin and supplied continuously checked authority callback. No key load or Agent store. |
| observationwire/values.go, observationwire/counter_types.go, observationwire/telemetry.go, observationwire/forward_telemetry.go, observationwire/probe_telemetry.go, observationwire/host_types.go, observationwire/host_telemetry.go | L2 canonical native four-family DTO/time/decimal/JSON/ACK mechanics | Control aliases/exporters/measurements and platformobservation native Host specialization; no product CounterSet/Gate, live reads or writer authority in DTOs. |

Engine details and compatibility remain in agent-native-engine-owner-v1.md,
agent-probe-native-owner-v1.md, agent-probe-effects-v1.md,
agent-observation-wire-native-v1.md and offline-transit-native-binding-v1.md.
Those files explain lifecycle/budget/type semantics; this table identifies the
actual leaves rather than declaring every future file in those directories native.

## Codec And Embedded Asset Closure

All the following are L2 wire/schema owners. `validate.go` names native Parse,
Check or family-specific public validators; it is production code, not a test
runner. Generated Go declarations and embedded JSON are one candidate input set.

| Package under internal/ | Exact Go leaves | Exact embedded/native assets | Consumers |
| --- | --- | --- | --- |
| contracts | validate.go, time.go, types_generated.go | schema.json | ADP3/native engine/state/proof/other codec validators, adp-validate and fixtures; ADP2 native shape reused internally, no online protocol downgrade. |
| adp3 | validate.go, types_generated.go, multihop.go | schema.json, execution.schema.json | Runner/state/executiondriver/nativeexecution and Relay/native validators. |
| adp3execution | types_generated.go | schema.json | adp3 extension declaration specialization. |
| adp3relay | validate.go, types_generated.go | schema.json | adp3 Relay extension and native adapters. |
| adp3transit | validate.go | schema.json | state and offline Transit controller/native adapter. |
| relaycontracts | validate.go, types_generated.go | schema.json | Relay wire/engine, Transit and negative fixture. |
| transitcontracts | validate.go | schema.json | Offline Transit engine. |
| transitnegotiation | validate.go | schema.json | Offline Transit native/schema public family; auxiliary/test consumers, not live permission negotiation. |
| transitdelivery | validate.go | schema.json | Offline Transit delivery validation and fixtures; does not activate a Runner consumer. |
| probeinstance | validate.go, types_generated.go | schema.json | Control registration and native Probe codec. |
| probenegotiation | validate.go, types_generated.go | schema.json | Control negotiation and native qualification codec. |
| probeclaim | validate.go, types_generated.go | schema.json | Control claim and native Probe codecs. |
| probedelivery | validate.go, types_generated.go | schema.json | Control delivery and native Probe codecs. |
| proberesult | validate.go, types_generated.go | schema.json | Control result/native codecs and observationwire counter Binding. |
| probetypes | validate.go, types.go | schema.json | Control typed family, native codecs and Probe binding projections. |
| probeservices | validate.go, types.go | schema.json | Control service family and native codecs. |
| probeecho | validate.go, types.go, frame.go | schema.json | Control echo family, Probe/native exchange and native codecs; public proof/clone/frame helpers do not issue permits. |

See agent-native-contracts-auxiliary-v1.md and agent-execution-wire-source-v1.md
for strict bytes/limits/field/error-order details. Repository schema and generation
tool consumers are external to these Go packages: scripts/generate-go-contracts.mjs,
scripts/check-transit-adp-schema.mjs and scripts/verify-offline-plan.mjs consume
these existing files. No generator or parity check ran. Schema/source parity,
embedded asset completeness, aliases and type/reflection identity remain required
frozen-revision acceptance rather than inferred from matching filenames.

## Production And Auxiliary Commands

| Exact leaves | Role, lower API and behavior boundary |
| --- | --- |
| cmd/tunex-agent/main.go | Existing production executable; ParseOptions -> agentcommand.Host{Platform:agentcli.Native, NewRunner:control.New} -> Run. Old run/enrollment names retained; no extra composition root. |
| cmd/adp-validate/main.go | Offline native message-format CLI over adp3.Parse and bounded stdin; no sockets, cache restore or execution grant. |
| cmd/time-proof/main.go | Operator native synchronization proof/check/watch CLI over authorization and state.AtomicWrite; original paired out/key, key boundaries, 5-second refresh and unsynchronized failure recording. Never clears Journal. |
| cmd/tunex-observation-responder/main.go | Independent explicit operator native service root over observationresponder.Config/Run; no Agent authority, application echo or outbound execution. |
| internal/observationresponder/config.go, internal/observationresponder/server.go, internal/observationresponder/tls.go, internal/observationresponder/wire_budget.go, internal/observationresponder/key_permissions_linux.go, internal/observationresponder/key_permissions_other.go | L2 bounded explicit endpoint/TLS service, source tokens/connections/raw wire/deadline/expiry/cleanup. Linux key owner/mode check, !linux refusal; caller's Config is not remote authority. Exact SAN/ALPN/service-purpose and partial-start close remain in the original owner. |
| cmd/network-fixture/main.go | Acceptance executable flags/target/probe/port/monitor, original explicit fixture IPv4 and bounded target lifetime/tag; local sockets, randomness, JSON and signal cleanup. Never production Agent authorization. |
| cmd/network-fixture/load.go | Acceptance bounded TCP/UDP load, per-client verified bytes/error classes/progress/quantile and expected cutoff. Existing client/payload/duration limits and corruption refusal; partial dial closes previously opened sockets. |
| cmd/network-fixture/tcp_proxy.go | Acceptance opaque TCP proxy, 128 permits and original 3-second dial/30-second deadlines/cancel/half-close/wait. TLS remains end-to-end. Not a production proxy module or physical-host proof. |
| cmd/network-fixture/relay_negative.go | Acceptance real current Open with machine/old peer/TLS1.2 negative attempts; strict binding and protected prior bundle public APIs. No malformed-Open shortcut or new peer issuer. |
| cmd/network-fixture/udp_route_monitor.go | Acceptance tagged original/successor sequence/loss monitor and occupyUDP helper; old-after-successor rejection and real UDP loss reporting. No transparent-migration claim. |

Auxiliary roots are intentionally named existing executables, not broad exceptions
permitting product modules to perform platform effects. The fixture bodies are
now classified by concrete function purpose; their behavior remains unexecuted.
Non-test auxiliary buildability is a later acceptance obligation.

## Test, Private Fixture And Distribution Consumers

The following exact test leaves remain source inputs for later Actions. They are
not run, rewritten, regenerated or considered current evidence by this ledger.

| Package | Exact test leaves and compatibility dependencies |
| --- | --- |
| control | credentials_test.go, diagnostics_test.go, execution_catalog_test.go, execution_drivers_test.go, native_direct_probe_test.go, probe_claim_test.go, probe_delivery_test.go, probe_execution_test.go, probe_negotiation_test.go, probe_registration_test.go, probe_workflow_test.go, relay_credentials_test.go, relay_runner_test.go, runner_test.go, transit_runner_test.go; same-package Runner/private helper/descriptor/current-instance fixtures, native Journal/wire fields, injected/partial providers and offline bridge. |
| state | adp3_journal_test.go, adp3_transit_journal_test.go, inspect_test.go, journal_test.go, lock_test.go, multihop_journal_test.go; native records/envelopes/bytes/private loaders and lock/import/refusal helpers. |
| authorization | guard_test.go, synchronization_test.go; old Guard wrapping/Clock/Sample/SyncStatus names, latching and provider order. |
| forward | authorization_test.go, tcp_test.go, tcp_lifecycle_test.go, udp_test.go; private sockets/config/authorization/permits and cleanup. |
| relay | engine_test.go, multihop_test.go, tls_test.go, wire_test.go; native engine/identity/protocol/partial-start/frame details. |
| transit | engine_test.go; offline native engine and explicit supplied permission, not live registry acceptance. |
| probe | probe_test.go, gate_test.go; private executor/dial/Gate/counter defaults, native destinations and original provider paths. |
| contracts | validate_test.go; native ADP2 structural/JCS/IJSON/representation rules. |
| adp3 | validate_test.go, multihop_test.go; online version and extension shape/error ordering. |
| adp3relay, adp3transit, relaycontracts, transitcontracts, transitnegotiation, transitdelivery, probeinstance, probenegotiation, probeclaim | Each named package has validate_test.go; native parser/schema/private family helpers, not a generic contract-conformance proof. |
| probedelivery, proberesult | Each has contract_test.go; exact request/result/native Binding shapes and first-error behavior. |
| egress | policy_test.go; exact numeric/CIDR/native address classification. |
| cmd/network-fixture | load_test.go; private bounded load/error/result semantics, acceptance infrastructure only. |

Current canonical type moves must retain known keyed/unkeyed literals, alias method
sets and native JSON assumptions through the relevant public owners. Test source
and source-text/reflection consumers cannot be called compatible merely because
the exported spelling stays. FR-0013 intentionally separates executionstate facts
from state native records; FR-0015 moves native Host/DTO identity; FR-0018 moves
canonical provider-group identity into agentplatform. Keep these explicit changes
in acceptance, including private Runner layout and embedded counter composite
literals; do not add implicit serializers or reflect-name shims to hide them.

Repository consumer routes outside `agent/` are .github/workflows/ci.yml;
deploy/Dockerfile.agent and deploy/Dockerfile.observation-responder;
deploy/compose.observation.example.yaml; deploy/test/upgrade-packaging.test.mjs;
scripts/check-boundaries.mjs; scripts/time-proof.ts;
scripts/phase1/acceptance.ts; and scripts/phase2/acceptance.ts, access.ts,
capacity.ts, faults.ts, linux-agent.ts, multihop.ts, native-linux.ts, recovery.ts,
relay-capacity.ts, relay-isolation.ts, relay.ts, security.ts.
These are actual packaging/command/acceptance consumers, not production imports
of a Go internal private symbol. The root candidate inventory must retain them
and their generated/build inputs. This Agent slice does not edit or run them.
agent/go.mod and agent/go.sum are native dependency/toolchain inputs; agent/README.md
and the named package README.md files describe usage, not behavior evidence.
Local agent/.cache is not a distributable production implementation or accepted
candidate substitute. The committed/frozen manifest must identify repository
inputs independently of local caches and untracked build output.

## Lower Representation Residuals Source-Migrated

FR-0023 and FR-0024 record the actual design, standing authorization, breaking
source assumptions, versioning and unexecuted acceptance before implementation.
These concrete mixed contracts are no longer left as accepted L1 exceptions:

- executionidentity/provider.go now holds tagless credential facts. Canonical
  native CredentialBundle, RotationRequest, RelayResponse and RelayBundle live in
  agentidentity/records.go with exact original tags/order/omitempty. The eight
  public *Facts/*FromFacts converters explicitly copy all scalar/string fields and
  preserve OverlapUntil pointer identity. Provider methods retain facts signatures;
  Native prepares/validates/loads/saves through the same native implementation with
  conversion at its boundary. Native.ValidateMachineRotation delegates the same
  original body now named validateMachineRotation; LoadRelay delegates loadRelay.
  No new file load, parser, default, entropy, save or authority stage is added.
- Control private credentialBundle/rotationRequest/relayCredentialResponse/
  relayCredentialBundle aliases now point to agentidentity native types. Existing
  fixture JSON and protected pending/response DecodeProtected destinations retain
  native spelling; live provider request/bundle values remain facts. The public
  nativeexecution.RelayCredentialResponseBundle takes native RelayResponse and
  provider RotationRequest facts, then returns RelayBundle facts. Its other request
  and renewal wire helpers retain their original bytes/timing and facts flow.
- executiontime/clock.go now holds parsed tagless SyncStatus with ObservedAt
  time.Time, ObservationValid and SourceAccepted. platformclock owns the exact old
  native record and RFC3339/source-name interpretation through SynchronizationFacts.
  authorization.SyncStatus aliases that native record; its public validation and
  Evidence callback explicitly project. Native proof/OS/default paths and command
  output use unchanged native fields. Parse/source validity is carried as facts,
  rather than returned early, so original post-evidence sample/host/source/decision
  error order remains. Pure RFC3339 parsing moves from every lower validation to
  the native Evidence projection and its result is cached until refresh; this is
  an explicit computation-position/frequency change, not a claim of identical
  parser execution order or demonstrated runtime equivalence. The converter
  performs no clock read, I/O or serialization. Planned cases combine invalid text
  with host/source mismatch and cover both samples, refresh and 30-second edges.

Versions are executiontime2, platformclock2, executionidentity2, agentidentity2
and nativeexecution2; Guard/Host/Journal/wire/schema versions remain unchanged.
The agentplatform group still exposes its same interface1 constructor/signatures;
its Identity binding now implements provider2 facts. Native canonical named-type
identity moves packages; lower direct serialization and custom lower timing
Evidence implementations must migrate as explicitly recorded. No hidden lower
MarshalJSON or native format fallback is added. Source equivalence is not yet
verified, including reflection/tooling and unknown downstream consumers.

## Removal Conditions And Planned Acceptance

Control private wrappers/default fallbacks remain while package-local tests and
existing entrypoints use them. Remove only after actual consumers migrate and
the exact frozen source demonstrates old/default versus explicit construction,
nil/zero/partial-provider behavior, callback presence, first error, factory count,
clock domain/sample position and lifecycle equivalence. Keep native constructor
selection at its existing stage; no new root may bypass it.

authorization/state compatibility APIs remain while native callers listed above
depend on their old imports and persisted proof/Journal formats. Removing an alias
does not authorize a key, protocol, schema, high-water or history migration.
Native wire/engine APIs remain while their production/offline/auxiliary consumers
remain. Offline Transit and staged Echo require their separate permissions and
integration gates; deleting compatibility source cannot manufacture acceptance.

The coordinator should attach these planned groups to readiness, all unexecuted:

1. Complete Agent leaf/asset/test/auxiliary and repository consumer inclusion on
   the actual frozen candidate, embedded schema/generated/source parity, public
   alias/type/reflection/JSON/method-set and FR-0023/FR-0024 facts/native separation.
2. CLI -> Host -> Runner/default -> native driver/provider -> original state chain,
   explicit constructor nil/error stages, partial fixture fallbacks, OS build-tag
   and actual-platform refusal, independent scheduling/Guard/native point clocks;
   native SyncStatus malformed/unknown source conversion, unchanged proof bytes/MAC,
   two-sample/cache/holdover/host/source ordering, and every credential native/facts
   field/omitempty/pointer plus strict/permissive/missing/corrupt/replay/save boundary.
3. Private registry clone/header/duplicate/callback order; one Guard/Journal/
   current-instance owner; save-before-bind, partial start close, replacement,
   drain, close-before-tail and original shared Forward/Relay/Transit budgets.
4. All Probe feature families: current exact binding/receipt/instance/watch, burns,
   independent Gate permit admission, default fresh dialer/mode priority,
   wire/ACK/status/body/cancel/close and counter retirement/terminal-time behavior.
5. All named auxiliary command and fixture native inputs/outputs/limits/partial
   cleanup, responder platform ownership refusal and bounded TLS resources;
   explicitly distinguish offline Transit and real deployed Echo integration.

The existing detailed readiness cases and owner FR plans remain applicable. No
test, syntax/type/static/import/boundary check, formatter, generator, build, CI,
network/native/MySQL/browser experiment, commit or push ran in this Agent slice.
Independent physical hosts, long-run/recovery/release gates and foundation
contract/example acceptance remain unverified and closed without their own evidence.
