# Probe Owner And Native Effects Interface 1

Source candidate only, unverified. This remains the original product-specific
measurement owner, not an extracted generic L1 authority or a second Gate.

Old New/NewWithIngress/NewWithServices/NewWithEcho keep their original resolver
requirements, error order and native defaults. Additive NewWithEffects,
NewWithIngressEffects, NewWithServicesEffects and NewWithEchoEffects require
explicit Scheduler, Entropy and generic Dialer providers. No missing explicit
provider falls back. Runner's existing constructor/provider semantics do not
change: its Probe construction still uses the old native entries, not an implicit
copy of the Runner schedule/entropy overrides.

The same Executor schedule now supplies its old local read/deadline/ticker points,
Gate time and process-admission release cooldown, and CounterSet end times. The
same secure source supplies Gate identity and counter epochs at the old points.
The old package-local dial field/native helper signatures and legacy zero-value
fixture defaults remain. There is still one shared process admission budget and
one original Gate/claims/counters owner; no reset, eviction or per-provider budget
is introduced. All schedules must share the process/native deadline domain.

Effects are trusted compiled-in operations, not a plugin sandbox or authorization.
Guard synchronization, independent permits/current bindings, the 256-ID burn and
watch/once/report ownership still control work. Native trust/TLS and staged echo
retain their native clock operations; effects do not enable them or override
certificate/authority time. The native child package now owns numeric destination
parsing/formatting/policy adaptation, bounded echo socket I/O and exact default
provider factories. The native child also owns the original echo JSON roundtrip,
timestamp parsing, deep equality and framing-validity adapter. Parent wrappers
retain constructor and denial identities; product binding, selection, challenge,
protocol and temporal authorization stay with the original owner. Public native
connection/wire type references and caller/current-instance composition still
need full-source classification.

See docs/architecture/agent-probe-native-owner-v1.md for the source chains, exact
default and private compatibility bindings, residual dependencies and planned
acceptance cases for this additional source slice.

See docs/architecture/agent-probe-effects-v1.md and readiness item 34 for required
exact-source acceptance. No tests/checks/gofmt/build/native/network/CI or Git
operations have run for this extraction; the parallel gate stays closed.
