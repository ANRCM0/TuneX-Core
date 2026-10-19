# Enrollment Coordination Interface 1

Source candidate only. This package is L1 and imports no native files, crypto,
HTTP/TLS, wire parser, clock or Journal implementation. Options carry opaque
caller-resolved locations; Roots/Client/Reply are provider-owned generic types.

Host.Enroll retains the original CLI sequence through Platform and Channel ports.
The existing native binding is agent/internal/agentenrollment. CLI owns environment,
flags/path/proof validation, the completion message and the decision to enroll.
The completion hook runs only after final certificate publication and before
deferred reply/client cleanup, preserving the old output/cleanup ordering.

This is not a second state/authority owner, credential issuer, generic reinstall
service or sandbox boundary. Providers are trusted compiled-in effects. The native
Platform uses the original state.AtomicWrite and state.InitializeRuntimeJournal;
it refuses existing certificate/Journal/MAC-key paths before enrollment. No state
clearing, recovery bypass or new execution authorization is provided.

See docs/architecture/agent-enrollment-v1.md and readiness item 32. Old CLI behavior,
provider order, native effects and all compatibility remain unverified. No tests,
formatting, builds, PKI/network/file experiments or CI ran in the source phase.
