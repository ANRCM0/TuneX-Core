# Runtime Platform Effects

Public Go interface 1, source candidate and unverified. Bootstrap and Scheduler
declare effects without a native filesystem, OS clock or wire-reader dependency.
The platformruntime provider binds the original proof boundary check, configured
CA, protection key, authenticated Journal load/explicit migration and standard Go
wall/monotonic duration/timer/context operations.

Runner still orders flag validation -> proof boundary -> CA -> key -> Journal ->
migration refusal -> credential reload -> explicit migration -> client creation.
No missing Journal initialization or implicit import is introduced. The CLI retains
its original instance-lock and enrollment ownership.

Scheduling is not the Guard's authorization clock. The default provider delegates
Now/Since/Until/After/timers/tickers/context timeouts/deadlines/AfterFunc to their
original standard operations, without a queue, catch-up loop, retry or cancellation
policy. Guard still requires independently bounded synchronization evidence.

Old New/NewWithProviders retain native effect defaults. Additive NewWithEffects
requires all explicit providers/effects; package-local legacy Runner construction
keeps its old native defaults. Native provider effects never create a second
Journal or authority. Entropy, MeasurementFiles and LocalLog additionally declare
secure random reads, local diagnostic/counter-file effects and unchanged warning
output. Their native provider retains the existing random source, path/mode/atomic
write behavior and stderr sink. They do not replace protected-state owners or
turn measurements/logs into authorization, and add no retry or fallback.

Old explicit constructors retain their existing requirements and native local
effects. Additive NewWithLocalServices requires every explicit service alongside
the original effects/providers; it rejects nil services before bootstrap I/O. These
are trusted compiled-in providers, not sandboxed plugins. Acceptance cases are
foundation-readiness 17-19, unexecuted.

Dialer[Connection] additionally declares a trusted context/network/address effect
without importing a native network or Probe type. L2 platformruntime owns the
original default native dialer. Probe effects reuse Scheduler/Entropy and this
generic port without changing existing Runner provider scope or creating another
Gate/process budget. See agent-probe-effects-v1.md and unexecuted item 34.
