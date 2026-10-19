# Agent Native CLI V1

Source candidate, unverified. `InterfaceVersion = 1` exposes the original CLI
external argument format and native effects; no L0/L1 contract changes here.

- `ParseOptions` uses the original process-global `flag` registrations, help,
  defaults and `flag.Parse`, then captures their values. It does not choose modes
  or enforce product flag dependencies, and is still not repeatable on the same
  populated FlagSet without the original duplicate-registration behavior.
- `Native.ResolvePaths` retains the original absolute-path, proof-boundary and
  key-relative checks and the three original filenames. It does not create paths.
- `InspectJournal` uses the original key length/error masking, protected state
  inspector and stdout JSON encoder; it does not acquire the run lock or connect.
- `Enroll` reads the original token only when invoked, supplies the existing
  agentenrollment Host and completion text, and retains its cleanup lifetime.
- `AcquireInstance`, `BootID`, `DiagnosticsPath`, `RunWithSignals` retain the
  original state owner, secure 16-byte entropy, native paths and interrupt/SIGTERM
  context with cancellation inside the outer instance-lock lifetime.

Native imports existing L1/L2 APIs and never imports `agentcommand` or `control`.
It cannot construct a Runner, grant authorization, migrate/clear history or choose
a new driver. The existing main composition supplies Runner construction to L3.
See `docs/architecture/agent-command-native-v1.md`; all acceptance remains planned.
