# Agent Command And Native CLI V1

Date: 2026-10-19. Status: authored source candidate; unverified and not accepted.

## Proposal And Public Call Chain

This is the source-only A4/A5 CLI slice under the existing human authorization.
It adds L3 command/public Go API and L2 native/public Go API, each interface1,
without changing existing L0/L1 signatures, foundation semantics or wire versions.
No frozen public type is moved or aliased to a new named declaration. No new FR
for a breaking foundation contract is needed for this additive owner extraction.

| Source and layer | Public API and responsibility | Consumer / owner |
| --- | --- | --- |
| Existing `agent/cmd/tunex-agent/main.go` composition | `run` binds native arguments/Platform and a public Runner constructor; `main` keeps stderr/exit; old `enrollment` delegates | Existing process entry, not a package-wide business exemption |
| L2 `agent/internal/agentcli/arguments.go` | `Options`, `ParseOptions`: original flag syntax/help/default/parser | L3 command accepts this external command format |
| L3 `agent/internal/agentcommand/host.go` | `Host`, structural `Platform`, `Runner`, `Run`: flag dependency and mode coordination, run lock lifetime, Runner option projection | Native platform and `NewRunner` are explicitly supplied by main |
| L2 `agent/internal/agentcli/native.go` | `Paths`, `Native`: path/proof, read-only inspection, enrollment binding, instance lock, entropy/hex, diagnostic path, signals | Existing public authorization/state/agentenrollment APIs; no reverse command/control import |
| Existing L1 enrollment | `executionenrollment.Options/Host` | Native `Enroll` binds the same trusted providers/completion |
| Existing L3 Runner public API | `control.Options/New` and `Runner.Run` | Main supplies `New`; L3 command uses only public Options and Run contract |
| Existing protected owner | state lock and `InspectRuntimeJournal`; original enrollment/Runner writes | No new Journal, authority, migration or history owner |
| Existing Control offline CLI | `apps/control/src/cli.ts` directly consumes compatibility/public compiler and framework/public facts | Old planner path remains an alias for existing consumers; no runtime command |

`agentcommand` is a product module. Its dependency on the public native CLI DTO is
intentional, not a new owner-independent lower host. Native implements the L3
structural interface without importing it: method arguments are primitives,
native `Paths`, L1 enrollment options and standard context callbacks. Its signal
callback executes the supplied outer Runner without a reverse source dependency.
Runner construction/default selection stays in the one existing composition.

## Original Sequence And Compatibility

1. Register all original flags on the global FlagSet in original order; parse;
   capture values. No new FlagSet, environment configuration, repeatability or
   post-parse mutation contract is introduced. Old duplicate registration/help/
   invalid-flag process behavior remains native; repeated public calls are not a
   new supported workflow.
2. Echo dependencies -> services dependencies -> inspection conflicts -> proof
   pair -> required inputs and native lowercase HTTPS prefix. `--relay` alone and
   time-proof flags remain allowed with inspection. No earlier validation of
   ProbeExecution/Ingress, Relay/Multihop or imported history is added; existing
   Runner checks still occur later, after run-lock/entropy as before.
3. Resolve state absolute path -> original proof boundary -> key absolute path ->
   original relative-key predicate -> node.pem/private.pem/journal.json. Preserve
   errors, ignored Rel error and lexical `..` behavior; do not silently canonicalize
   symlinks, change parent-path refusal or harden a different path policy here.
4. Inspection: key read and exactly32-byte requirement, then original authenticated
   inspector, then stdout Encoder/newline. Read/load failures retain the exact
   `JOURNAL_INSPECTION_FAILED` mask; output errors remain returned. No run lock,
   entropy, enrollment token, Runner construction, network or state write in this
   mode. Proof/path checks still precede it.
5. Enrollment: read token only after mode selection, invoke the original native
   enrollment Host and completion callback within its deferred cleanup. Enrollment
   still wins over rotate/other run flags except prior original refusals, acquires
   no new instance lock, and performs no automatic partial-state rollback/reset.
   The old private function remains callable with its original arguments.
6. Run: original instance.lock -> deferred release ->16-byte secure entropy read
   (ignore returned count as before) -> optional native diagnostics path -> same
   Runner option values -> supplied `control.New` -> signal context -> Runner.Run.
   Native boot hex formatting is pure and completed before constructor invocation;
   no new entropy sample is added. Construction failure returns before installing
   signal handlers; run/context cancellation completes before outer lock release.
   Diagnostic sampling/files, shutdown and protected history remain their owners.

Main `run()` and `enrollment(...)` signatures remain. The new direct Host requires
explicit trusted Platform/NewRunner; it offers no zero-value native fallback or
untrusted plugin guarantee. Existing `control.Options` type identity/fields and
`control.New` native default selection are unchanged. A typed nil Runner returned
with error is returned before method use, as with the original constructor path.
The source does not claim safe behavior for an invalid custom provider returning
nil without error, adding a new recovery/retry contract or changing native policy.

Control's offline CLI retains argv/file/strict parser/Forward validation/error/
compiler order and pretty stdout newline; only the old planner import changes to
the existing public compiler and facts entries. It cannot reserve, publish, issue
authorization or run an Agent. Control `main.ts` feature/env/startup, `client.ts`
command mapping/HTTPS, server/ops/MySQL and native engines remain separate mixed
or unclassified work; these files are not declared composition exemptions here.

## Acceptance And Remaining Work

Readiness150-152 records planned first-error/short-circuit/provider order, native
flag/default/path/proof/inspection/error/JSON vectors, token/enrollment partial
failure, run entropy/constructor/signal/lock cleanup and offline plan equivalence.
Original enrollment item32 and Runner/Journal/native acceptance still apply.
No test, type/syntax/static/boundary check, formatter/generator/build, command mode,
native/file/network experiment or CI ran. The declared inventory is source intent,
not an import-closure or runtime-equivalence proof.

Full Agent/Control/native wire/engine/default/private/type/consumer and removal
inventory, reviewable frozen content identity/example and later exact-source
acceptance remain open. Functional/native/network evidence requires later
authorized GitHub Actions; physical-host, long-run, recovery/release and foundation
parallel-feature gates remain independent and unmet without their own evidence.
