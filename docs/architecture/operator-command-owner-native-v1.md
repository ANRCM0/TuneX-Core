# Operator Command Owner And Native Effects v1

Date: 2026-10-19 (Asia/Shanghai). Source implemented, not executed or accepted.

The original ops CLI now binds public command coordination and native effects.
This moves its existing body; it adds no operation, default, authority or recovery
guarantee. L0/L1 public contracts and the protected AuthorityStore remain unchanged.

| Public entry | Responsibility |
| --- | --- |
| modules/operator-command-owner/public.ts | OPERATOR_COMMAND_INTERFACE_VERSION1, command/effect types, runOperatorCommand, operatorCommandFailure and runReleaseEvidenceCommand |
| compatibility/public.ts nativeOperatorCommandEffects | OPERATOR_COMMAND_NATIVE_INTERFACE_VERSION1, original argv/env/fs/path/trust/JSON/output/exit bindings |
| modules/upgrade-assessment-owner/public.ts | Original assess-upgrade workflow and report policy |
| modules/recovery-owner/public.ts | Original backup/restore workflow and supplied-Tx quarantine contracts |
| scripts/ops/recovery.ts | Existing native/owner recovery composition with original public exports |
| scripts/ops/cli.ts | Existing ops composition, supplying native effects, upgrade workflow and original recovery exports |
| scripts/ops/check-multihop-release.ts | Existing release evidence composition, supplying the original public native verifier |

Paths are relative to apps/control/src unless prefixed scripts/. The new L3 owner
imports only public Recovery and native AuthorityRecord contracts. It has no Node,
SQL, filesystem, process or private AuthorityStore source import. Its authority
view extends the original Recovery view with maintain/resume; it creates no issuer.
The L2 native file imports no product module. All providers are explicit at the
old CLI composition. These existing roots are not exemptions for other consumers.

## Command And Failure Semantics

argv is sliced once and destructured into command/argument/reviewId/extra. Only
assess-upgrade has the original strict argument check. It runs before constructing
AuthorityStore, and required DATABASE_URL/state/CA reads remain inside its try.
Reports are pretty JSON followed by exit0/1/2 for compatible/blocked/review-required.
The original twelve error codes are whitelisted; every other value becomes
UPGRADE_INSPECTION_FAILED with version1, blocked, runtimeReady:false and
productionApproved:false. This catch still includes serialization/output failures.
Its fallback output is compact, then exit1; fallback failures reach the old outer
failure path. Malformed assess-upgrade usage remains outside this catch.

All other commands first require TUNEX_CONTROL_STATE and construct the same native
AuthorityStore, including unknown commands. status/maintenance/resume call exactly
read/maintain/resume(argument) and pretty-print their original records. No argument
validation is added to those commands. Backup reads notification directory first,
then evaluates database/authority/directory/nullish dump default and optional field
in original order. An empty explicit directory does not become the env fallback.

Restore keeps argument/reviewId/stopped-issuer short-circuit refusal, notification
directory read, and original object evaluation: source URL -> target -> resolved
manifest -> same authority -> required CA/read/digest -> nullish mysql executable
-> credentials -> stopped flag -> checker -> optional clock JSON -> notification.
The clock-args environment variable is deliberately read twice when truthy, as
before; parsing is not hardened. The result remains recoveryId/database/owner
credentials/reviewRequired:true. Commit/credential/rebind behavior remains with
the original Recovery owner/native chain; the command adds no transaction/retry.

The old outer failure path prints Error.message, otherwise Operator command failed,
then sets exit1. Native output still calls console.log/error and process.exitCode;
it does not exit the process or suppress an earlier output. Exact failures, getter
evaluation, emitted JSON and async rejection behavior need matching-source evidence.

Release evidence reads argv2, then argv3 ?? source env, checks both with the same
usage text, calls the original verifier and pretty-prints. It retains top-level
await without the ops failure catch or a new exit-code policy. The native verifier
still checks its original fifteen evidence gates, exact source/digests/clean tree,
independent physical hosts and bounded contained artifacts. This source change
does not run that verifier, authenticate a bundle or satisfy any release gate.

## Compatibility And Acceptance

Old script invocation paths remain. The two scripts expose no new named exports.
Backup/restore/trusted-time exports stay at recovery.ts; upgrade old exports are
exact public aliases. Public effect contracts are new L3/L2 source candidates,
not a change to a frozen L0/L1 interface; no new FR is needed for this slice.
There is no supported reflective/private-layout equivalence claim. Removing old
entries requires actual consumer migration and exact-source command acceptance.

Readiness170-171 records all command/default/first-error/output/failure order,
upgrade redaction/exit and recovery/release delegation cases. They are planned,
unexecuted. Functional/native/MySQL evidence belongs in authorized GitHub Actions.
No tests, type/syntax/static/boundary checks, formatters, generators, builds, CI,
native/network/MySQL experiments, commits or pushes ran in this source slice.
