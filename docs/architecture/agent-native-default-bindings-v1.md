# Agent Native Default Bindings And Counter Clock v1

Date: 2026-10-19 (Asia/Shanghai). FR-0018 source implemented, unverified.
This follows the concrete remaining sites in agent-remaining-source-callchains-v1.
It does not assert full A3/A4/A5 or foundation acceptance.

## Public Types And Existing Constructors

The new L2 package agent/internal/agentplatform exposes InterfaceVersion1, canonical
Providers/Effects/LocalServices structs and DefaultProviders/DefaultEffects/
DefaultLocalServices. It imports only public lower contracts and existing native
providers, plus concrete TLS/X509/HTTP types needed for this native specialization.
It has no Control/Probe import, product command, feature flag, state authority,
client cache, runtime loader, filesystem/clock read or new IO implementation.

| Native binding | Original default preserved |
| --- | --- |
| Providers.Identity | agentidentity.Native |
| Providers.Channel | controlchannel.Native |
| Effects.Bootstrap | platformruntime.Bootstrap |
| Effects.Schedule | platformruntime.Schedule |
| Effects.Auxiliary | controlchannel.Native |
| LocalServices.Observation | platformobservation.Native |
| LocalServices.Entropy/Measurements/Log | Separate original platformruntime.Local stateless values |

Control's old Providers/Effects/LocalServices names alias these canonical structs.
All original fields/order/types remain; no field, provider requirement, public
constructor or option is added. Canonical named type identity moves packages:
reflection/tooling/source-text consumers expecting control as declaration owner
need migration. This is explicit source-candidate compatibility, not a claim that
reflection is unchanged. FR-0018 was recorded before the source move.

Existing New -> newRunner -> newRunnerWithEffects -> newRunnerWithLocalServices
default stages remain in Control. The explicit NewWithProviders, NewWithEffects
and NewWithLocalServices retain their original nil checks/error text before those
stages, without making fields optional or filling failed explicit providers.
Private identity/channel/scheduler/auxiliary/observer/entropy/measurement/log methods
retain partial package-local fixture fallbacks, now projected from L2 default
groups. Extra stateless group literals have no intended observable effects.

These are precise existing construction/compatibility methods, not an exemption
for every Control source or permission to move business decisions into L2. New
modules consume public contracts and supply providers in their real composition.

## Probe Construction At Its Original Stage

The original mode selection is now newNativeProbeExecutor in control/platform.go,
the existing constructor/default seam. negotiateProbe captures node/boot/session/
Guard under its original mutex, unlocks, refuses failed Guard, then calls that
helper. It still constructs NewGate, optionally EnableCounters, installs deferred
failed-session close, formats/sends the same negotiation, parses time and rechecks
current session/Guard in its original order.

The construction helper selects exactly Echo -> Services -> Ingress -> base.
It calls the original public probe.NewWithEcho/NewWithServices/NewWithIngress/New
with original bound resolver method values. Those original constructor bodies,
resolver nil/error hierarchy, native effects/fresh Dialer, scheduling/entropy and
counter defaults are untouched. No native Probe construction is moved into the
lower agentplatform package; the L3 product producers are wired only by the old
Control construction seam. Feature prerequisites still belong to Runner New.

No permit, independent issuer, current-instance check, peer target or execution
receiver is added. Guard rejection still precedes construction, and failed
construction still precedes NewGate, counters and the deferred-close phase.

## Explicit Counter Clock And Original Native Domain

At the original Runner struct assembly, private probeCounterClock is bound to
nativeProbeCounterScheduler(), which projects agentplatform.DefaultEffects().Schedule.
This is a native stateless binding, without a Now call. It is deliberately
independent of the caller's effects.Schedule. Neither public Effects nor
LocalServices gains a clock field or a new required provider.

Both production counter source and frozen-tail call sites pass
runner.probeCounterScheduler() to probeCounterPointWith. The core's first
operation remains schedule.Now().UTC(), even for terminal/unavailable values.
It then selects current versus supplied EndedAt and uses TimeText, intentionally
retaining terminal offset representation. Availability, pointers to epoch/overflow,
counter decimal formatting and exact JSON records remain the original code.

The original free probeCounterPointValue(identity,values) name now lives in the
same existing compatibility seam and delegates to the core with native defaults.
Zero-value/partial private Runner fixtures also fall back to that native provider;
there is no public arbitrary clock override or silent switch to injected Runner
schedule. Private field binding/layout is not a reflection compatibility promise.

Collection still uses Runner scheduling for retention and page capturedAt, and
Probe CounterSet still uses its executor providers. Original mutexes, snapshots,
session filtering, deduplication/loss saturation, 32-point/2-generation pages,
8 retiring sources,128 tails,10-minute retention, sort/cursor and original Gate
close/reader lifecycle are unchanged source intent. There is no new budget,
sample loop, lazy worker or time-based authority in this binding package.

## Compatibility Consumers And Removal

Production Agent command keeps public control.New; other explicit Control users
can keep old aliases/constructors. Existing Runner public type signatures remain
on those names. Source acceptance must examine actual named-type/reflection,
unkeyed/keyed literals and all real consumer imports, not only compile an isolated
new package. Private test/fixture helper names and fallback semantics remain.

Removing Control aliases/default helper names or changing native clock domains
requires actual consumer migration and explicit compatibility/acceptance scope.
This slice changes no L0/L1, wire/schema/version/default timing value, Authority,
Journal/history, runtime ledger, immutable driver catalog or live Transit state.

Readiness174-176 records planned alias/default/nil/construction/Probe/native-clock/
counter/compatibility cases. None executed. No tests, type/syntax/static/import/
boundary checks, formatters/generators/build/CI/native/network/MySQL experiments,
commits/pushes or subagent delegation ran in this slice. Full public/private/type/
asset/consumer/export/default classification, reviewable dirty candidate identity,
minimal example execution and foundation/physical/release gates remain open.
