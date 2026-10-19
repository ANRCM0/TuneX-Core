# Agent Probe Effects Boundary V1

Date: 2026-10-18. Source candidate; unverified and not accepted.

## Public Contracts And Compatibility

L1 runtimeplatform now adds Dialer[Connection] with a context/network/address
effect and native result type parameter. It imports no network or Probe types.
Existing Scheduler and Entropy contracts/methods stay unchanged. L2
platformruntime.NewDialer owns one original zero-configured net.Dialer per default
Executor and delegates DialContext with exactly the supplied arguments; it adds
no destination validation, timeout, retries, proxy, authority or closure policy.
Its zero-value native wrapper is also usable. Caller context still bounds the
connection and Probe still owns its original close points.

The existing product-specific probe package declares source interface version 1
and an Effects bundle containing those three ports, with net.Conn as the current
native binding. These are not new wire/schema/capability/version dimensions.

| Old default constructor | Additive explicit constructor | Resolver requirements |
| --- | --- | --- |
| New | NewWithEffects | Egress |
| NewWithIngress | NewWithIngressEffects | Egress, ingress |
| NewWithServices | NewWithServicesEffects | Egress, ingress, service |
| NewWithEcho | NewWithEchoEffects | Egress, ingress, service, echo |

Explicit effects require all providers, without fallback, and preserve the same
resolver prerequisite order. Old entries retain native defaults and old signatures.
Runner Probe negotiation/direct callers continue using the old default entries.
Runner's existing explicit constructor requirements and the previous scope of its
Schedule/Entropy overrides are not silently expanded to Probe authority timing.

## Original Ownership And Timing

Executor reads time, creates two bounded contexts and its 25ms monitor ticker
through Scheduler at the original points. Pure context cancellation remains local.
Its private dial field remains usable by existing package-local fixtures, but its
default function now comes from the one L2 native dialer. No resolver, address
validation, trust/echo parse, attempt accounting, socket close or outcome mapping
is moved into the generic network port.

NewGate uses the Executor's full-buffer secure source for the same 32-byte random
instance ID, returning the original denial on source failure. Gate's local time
read uses the same schedule. Its original mutex/identity/binding/closed/replay/
256-ID burn/claims/cancellation sequence is unchanged. It remains one Gate, not a
new reusable authority or cache that can be cleared under the same identity.

The process-global admission map remains shared across every Executor/provider.
Acquire uses the original local time point; release reads the captured Executor
schedule while holding the original mutex and applies the same one-second cooldown.
There are still four active requests, 128 keys and no queue or per-provider budget.
The old acquire helper remains a native wrapper. Injected schedules must share the
same process/native deadline domain: mixing arbitrary clock domains is unsupported
and cannot be used as independent evidence or permission to reset the global map.

CounterSet uses the same Executor source for the original 16-byte epoch read before
Gate lock/eligibility checks. Epoch failure still means unavailable counters, not
execution denial. The registry stores only its schedule, not a Runner/Gate owner,
for original UTC completion timestamps. Counter saturation/attempt/unknown/inFlight,
sealing, draining calls and detached snapshots remain with the one registry.
Legacy standalone helpers and zero-value fixtures retain native fallback values.

Providers are trusted compiled-in effects. They cannot replace Guard synchronization
or mint independent permits. Native certificate/trust checks and the existing
staged echo implementation retain their own native operations; no echo source,
default or composition changed here. Sharing a clock port does not permit extending
deadlines or changing one-use authorization semantics.

## Remaining Debt And Acceptance

The executor/Gate/counter main paths no longer construct native clocks, entropy or
dialers directly. The precise native default factories remain compatibility
bindings, not whole-package exemptions. Probe still contains native net.Conn/
net.Error types, numeric address/formatting, trust/echo wire references and unchanged
staged echo effects. Product value/type/native separation and whole-repository
classification still need work; this is not generic L1 Probe completion.

Readiness item 34 requires frozen-source old/explicit constructor substitution,
nil/missing providers, resolver error order, scheduling/random/dial argument and
call order, shared budgets/clock-domain requirements, no replay reset, Gate and
counter close/failure behavior, native transport/cancel/socket ownership and
unchanged Runner provider scope. Functional/native/network/Linux/Windows evidence
belongs in authorized Actions. No checks/tests/gofmt/build/CI or experiments have
run for this extraction. Foundation and parallel acceptance remain unmet.
