# Agent Remaining Source Call Chains V1

Later source follow-up (2026-10-19): FR-0018 has moved native binding structs/
defaults into public agentplatform1, kept Control aliases/nil/fallback constructors,
moved Probe factory selection to the existing construction seam, and bound a
distinct native clock explicitly into both production counter point calls. The old
free helper remains a native wrapper. See [current binding chain](agent-native-default-bindings-v1.md);
174-176 unexecuted. The residual descriptions below are the original inventory
before that source move, not new blockers for those same bodies. Reflection/native
alias identity, complete source graph and all acceptance remain unverified.

Date: 2026-10-19. Read-only source classification plus this document only.
No tests, checks, formatting, generation, builds, experiments, CI or Git writes
were performed. This is not whole-Agent acceptance or permission to open the
parallel module gate.

Task proposal: (1) classify L3 Control/Probe consumption of L1 ports and L2
adapters; (2) consume existing executionhost/executiondriver, runtimeplatform,
executionchannel/executionidentity, Probe and native wire APIs; (3) foundation
source is untouched; (4) no interface or semantics change; (5) record planned
frozen-source Actions acceptance, execute none; (6) edit only this dedicated
document, leaving shared inventory/readiness/public contracts to integration.

## Current Production Chains

Public below means an exported package API, not an external plugin or independent
authority. Default means a native binding at an existing construction/fallback
site. Private means original product orchestration, not automatically migration
debt. Compatibility means an original private name/shape retained over a public
implementation. Native Go types are explicit binding dependencies even when
their implementation has moved.

| Production source and call chain | Classification and actual owner | Remaining source work |
| --- | --- | --- |
| `cmd/tunex-agent/main.go` run -> agentcli.ParseOptions -> agentcommand.Host.Run -> supplied control.New -> Runner.Run | Existing executable composition; agentcommand public Platform/Runner ports; native CLI and control default constructor bind at the executable's original call site. | CLI extraction is already authored. Do not repeat it or introduce a second composition root. |
| `control/runner.go` New -> defaultProviders -> defaultEffects -> defaultLocalServices -> newRunnerWithLocalServices | L3 Runner lifecycle and option relationships; L1 injected contracts specialized with HTTP/TLS/X509 native types; native defaults supplied by `control/platform.go`. Bootstrap loading, certificate and client mechanics execute through their existing public adapter owners. | Native construction/fallback code remains physically in the L3 default seam. Separate that source seam only through an approved compatibility-preserving design; current native type references must remain explicitly classified rather than called L1-pure. |
| Runner Run/request/poll/report -> channelProvider, identityProvider, Bootstrap, scheduler -> nativeexecution runner/credential/time/report codecs | L3 owns SessionEpoch/Guard/Ticket/Journal/current-instance transitions, mutexes, retry/refusal order, drain and reconciliation; lower public APIs own transport, credentials, external format and clock implementation. | The formerly listed raw JSON/time.Parse/report format residuals are superseded by the current nativeexecution source. Do not move authority/history or retry policy merely because it shares a caller with a codec. |
| builtinExecutionDrivers -> private executionRegistry -> publicExecutionDriver -> executiondriver.NewRegistry -> executionhost.NewRegistry; nativeDirect/Relay/Multihop -> adaptExecutionDriver | Public generic L1 executionhost, public native L2 executiondriver and nativeexecution; private descriptors/callbacks retain the original compatibility shapes. nativeexecution owns original native driver bodies and legacy declaration mechanics. Runner owns original duplicate detection, list cloning and ordered product registry. | Private adapters are compatibility consumers, not copied engines. `executionHost.relayIdentity` still exposes relay.Identity; `finishRelayStart` still exposes *relay.Engine. These are precise native type bindings, not an unclassified whole control package. Replacing their types would need impact review; no such change is proposed here. |
| Runner negotiateProbe -> feature-specific probe.New/NewWithIngress/NewWithServices/NewWithEcho -> probe.NewGate | L3 chooses existing feature prerequisites and resolver set. Existing Probe default APIs construct native Schedule/Entropy/Dial through `probe/native`; Gate owns independent permit admission. Runner's injected schedule/entropy are deliberately not propagated automatically. | A real remaining default composition seam is this direct selection of default constructors. Any movement must retain constructor order, one fresh original dialer, Gate creation timing and independent clock domains. Public Effects APIs already exist; replacing live defaults with Runner providers would change behavior, not merely move source. |
| registerProbe -> negotiateProbe -> probeInstanceExchange; poll/claim -> probeDeliveryExchange -> monitorConsumedProbe -> Gate.Run -> project/result/report | L3 session/current pointer, generation/fingerprint/Guard comparison, bounded deliveries, claim/report burns, watch lifetime, conservative server projection and exact receipt family. Public nativeexecution owns HTTP bodies, strict family codecs, timestamps and result field formatting. | Status/result/ACK and echo JSON/reflect/time mechanics are already moved; see agent-execution-wire-source-v1.md. Binding conversion and currentness/measurement/service/challenge policy remain product code. Do not carry forward obsolete raw-format debt from earlier inventory text. |
| probe.Executor.Run -> resolver -> native.ParseDestination -> original product binding/check/expiry -> Destination.Allowed -> original admission/watch -> injected Dial -> native echo exchange or observationtrust.Handshake | Probe is L3 product admission/result owner; native child is explicit L2 socket/address/echo-format adapter; observationtrust is the existing public lower trust owner. net.Conn in Effects/exchange is native binding. | Existing native parsing, CIDR/address formatting, JSON/reflect/frame/time, dialer factory and socket exchange implementations are already lower-owned. Gate budgets/replay, target comparison, outcome, current authority and counter state stay original. No new remaining raw socket implementation is assigned to the parent Probe package by this read. |
| captureProbeCounters -> probeCounterPointValue for live values and frozen tails | L3 owns current-source identity, retention/deduplication/loss, sorting/page/cursor and collection. observationwire owns DTO/text formats. | Concrete remaining mixed effect: probeCounterPointValue directly samples `(platformruntime.Schedule{}).Now().UTC()` before selecting terminal EndedAt. This is reached by production capture, not only a fixture. A later source move must preserve this native-clock sample at every current and terminal call and must not silently replace it with Runner's injected clock. |
| maintainTelemetry/ForwardTelemetry/HostTelemetry/ProbeTelemetry -> send*With -> auxiliary.PostTelemetry -> observationwire.ReadAckBody/Check*Ack | L3 sample selection, per-exporter sequence/drop, timeout/lifecycle and current HTTP status refusal; public L2 observationwire owns field/text/JSON/ACK mechanics; Auxiliary is specialized with *http.Client. | The short private send* wrappers still choose platformruntime.Schedule and controlchannel.Native; live maintain* calls use explicit Runner providers. Classify these as compatibility default sites, separately from production policy. StatusOK/body length/refusal conditions are concrete wire binding consumption; they are not a second HTTP implementation. |

## Exact Remaining Default And Compatibility Sites

The production native default seam is `control/platform.go`: defaultProviders,
defaultEffects, defaultLocalServices, plus identityProvider/channelProvider/
scheduler/auxiliary/observer/entropy/measurementFiles/localLog fallbacks. Explicit
NewWithProviders/NewWithEffects/NewWithLocalServices reject their required nil
arguments before entering these constructors. Removing fixture fallbacks or
changing the original partial-injection behavior is a compatibility change.

Other exact private default sites are probeRequestID, probeFreshUntil,
projectProbeResult, probeTypesMachine, probeServicesMachine, probeEchoMachine,
serviceProbeResult, probeAuthorityWatch.scheduler and the four send* wrappers.
Their live owner paths use the corresponding With/provider methods; keep these
fixture/legacy entrypoints distinct from the live native counter sample above.
Probe's nativeEffects, scheduler/randomSource, newCounterRegistry and CounterSet
scheduler fallback similarly bind existing native factories; live Gate counters
are constructed with that Gate executor's providers. None is another authority.

These are candidates for a subsequent private default-binding source slice, not
an implementation authorization or a finding that all public APIs must become
generic. Foundation public type or semantic changes require their own approved
change request before implementation.

## Excluded Pre-Integration Path

`control/transit_runner.go` NewTransitController -> state.LoadTransitJournal ->
nativeexecution offline identity/start/prepared adapters remains a public but
explicitly pre-integration API. transitControllerForIntegration and
transitPhysicalGuard are private prospective bridges. Current Run/poll do not
call them; they require an independent Transit Control permission and existing
live ticket/physical guard. Their native Schedule default is a separate offline
source classification item, not a deployed Runner call chain. Do not activate
this path or infer multi-host readiness from source extraction.

## Planned Acceptance

Later authorization must freeze a source revision and run relevant functional,
native/network and compatibility evidence in Actions. Compare old/default and
explicit constructors, nil/error order, default factory identities and fresh
dialer counts; preserve native versus injected clock domains and call positions,
including terminal counter samples; compare public/private descriptor conversion,
list cloning and error order; cover every Probe family claim/status/report burn,
watch revocation and exact-instance refusal; compare wire bytes, native type
bindings, ACK/body/status failure and telemetry counters. Keep independent
physical-host gates unverified without those hosts. No case in this document was
executed, and the document does not certify all A3/A4/A5 source closure.
