# Agent Enrollment Boundary V1

Date: 2026-10-18. Status: source candidate, unverified and not accepted.

2026-10-19 follow-up: [Agent command/native CLI](agent-command-native-v1.md) now
places original flag/mode/lock coordination in L3 agentcommand1 and native CLI
effects/enrollment binding in L2 agentcli1. Main retains run/enrollment signatures
and composition. The earlier table describes the original extraction snapshot;
enrollment Host/native implementation and item32 remain unchanged and unverified.

## Entrypoints And Owners

| Layer | Public source | Responsibility |
| --- | --- | --- |
| L1 | agent/internal/executionenrollment | Generic Host, Options, Credential, Platform and Channel; ordered enrollment coordination and deferred cleanup |
| L2 | agent/internal/agentenrollment | Native file/CSR/key/CA/certificate, HTTPS and bounded response parsing providers |
| Existing composition | agent/cmd/tunex-agent/main.go | Flags, environment, path/proof checks, inspect/lock/signal behavior and old enrollment function |
| Existing protected owner | agent/internal/state | Atomic writes and InitializeRuntimeJournal, not copied or replaced |

Both new packages declare interface version 1. This does not change CLI flags,
Control enrollment wire, Journal/MAC layout, state migration, Runner authority or
package versions. Existing runtime credential rotation/Relay identity providers
are unchanged. Enrollment has different pending-key/CSR/refusal semantics from
rotation; reusing its methods would change the original workflow. The new ports
therefore describe only the existing first-enrollment effects, not a new universal
credential/authority manager.

The host's native Roots/Client/Reply types are generic parameters; it imports no
OS/filesystem/crypto/HTTP/TLS/parser/native Journal or clock implementation. It
does not open sockets, inspect protected files or validate certificates directly.
Trusted outer providers perform those effects without a reverse source dependency.
This is compiled-in dependency injection, not a security boundary for untrusted
plugins. Native merely binds providers over the one lower workflow.

## Preserved Sequence And Refusal

The CLI keeps its old enrollment signature, environment read and success text.
Existing flags and absolute path/proof/MAC-key-outside-state checks run first.
The host checks the token, then asks the native platform to refuse existing
certificate, Journal and MAC-key paths, creates the original directories, and
prepares/reuses the original private key and enrollment.csr. It encodes the same
request before loading the configured CA; it never adopts the returned CA.

The native channel retains the original trimmed URL plus /enrollment/v1, JSON
content type, TLS 1.3 minimum, ten-second client timeout, redirect refusal, no retry,
32769-byte body read and 32768-byte strict JSON parse bound. It preserves read /
HTTP-status / ParseJSON / Unmarshal ordering. The native platform then validates
the same Node common name, configured-root client-auth chain and TLS key pair at
the original native clock-read point, before generating the 32-byte protection key.

Final effects remain MAC-key atomic write -> original InitializeRuntimeJournal ->
certificate atomic write -> CLI completion callback -> reply close -> idle-client
close. Cleanup errors remain ignored as before. The reply stays open through
validation, all final writes and the success message. Completion runs once on
success only; it is not an authorization callback or a retry hook.

No rollback, file deletion, automatic partial-state repair, replacement of an
existing Journal, new enrollment lock, protocol fallback or execution permission
is added. Partial failure may leave the same protected files as before, so a later
attempt still encounters the original existing-state refusal. Native read-error /
existing CSR/private-key branches are preserved, not presented as new hardening
or proof of recovery safety. Any change to those semantics requires its own
approved compatibility/recovery decision.

## Remaining Work And Acceptance

This closes the enrollment body source separation, not all Agent/CLI/native debt.
CLI retains genuine composition effects; Control private execution prechecks,
Probe/trust, native engine/wire internals and full dependency classification still
need work. state and contracts retain existing mixed/native migration debt; this
binding neither exempts those whole packages nor certifies a different owner.

Readiness item 32 requires exact frozen-source fake-provider order/error/lifecycle
cases plus old CLI/native/PKI/file/HTTP equivalence on authorized Actions, including
all failure/partial-write/refusal branches and Linux/Windows compatibility. No
test/check/format/build/PKI/network/file experiment or CI has run for these changes.
Physical-host, operational/release and foundation/parallel gates remain separate
and unmet without the required evidence.
