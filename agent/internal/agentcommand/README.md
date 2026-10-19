# Agent Command Owner V1

Source candidate, unverified. `InterfaceVersion = 1` describes the existing L3
command workflow, not a new L1 foundation host or a deployed protocol version.

`Host.Run(agentcli.Options)` retains ordered flag dependency/refusal decisions,
inspection/enrollment/run selection, the instance-lock lifetime, and Runner option
projection. `Platform` describes existing native operations structurally; its
native implementation does not import this owner. `NewRunner` is supplied by the
existing CLI composition through public `control.Options/New`, with no fallback
inside this host. `Runner` requires only the existing `Run(context.Context)`.

The host consumes public native argument/path records and existing enrollment
options; it owns no flags, environment, files, signal handling, random source,
Journal format, execution authorization or state migration. Probe/Relay feature
refusals inside Runner remain in Runner, at their original later stage.

See `docs/architecture/agent-command-native-v1.md` and planned/unexecuted readiness
150-152 for the complete native/default/consumer/compatibility chain. No example,
test, build, import check or command mode has been executed for this source.
