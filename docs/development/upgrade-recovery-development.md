# Upgrade And Recovery Development

The production entrypoints remain `scripts/ops/cli.ts`, `scripts/ops/upgrade.ts`,
`scripts/ops/upgrade-inspect.ts` and the original recovery workflow. Their owner
boundaries and native bindings are documented in
[upgrade assessment](../architecture/upgrade-assessment-owner-native-v1.md) and
[recovery workflow](../architecture/recovery-owner-workflow-v1.md).
This document describes developer invariants and acceptance, not host operations.

## P Source Compatibility Inputs

The unverified P successor's complete Control schema profile is
`adp3-path-sample-alert-v1`, ceiling0046, UpgradeAssessment10. Earlier new P
profiles have ceilings0042 (account events),0043 (usage projection),0044 (quota
Station rules),0045 (controlled path Echo); earlier profiles retain their exact
reader ceilings. Agent runtime/multihop/shared-resource Journal profiles remain
unchanged. Migrations never imply a safe old reader, and flag opt-out never erases
new protected or schema state. The example upgrade plan contains placeholder
identities and must be replaced with actual inspected source/target inputs.

The original backup/restore/maintenance/authority/Journal owners still apply;
P usage projections and recent sample alerts confer no execution authority. P's
actual restore, partial-DDL and old-reader acceptance is unexecuted. The following
paragraphs describe the historical pre-P schema slice, not P's final footprint.

## Historical Compatibility Inputs

The historical Echo-only schema profile is `adp3-probe-echo-v1`, with migration ceiling
0037 and `0037-probe-echo.sql` as the final marker. The older profiles remain
explicit refusal/compatibility inputs to tests. Agent Journal compatibility uses
the existing runtime/multihop profiles; staged Probe Echo v4 is not a Journal
format upgrade or a new live machine API.

Migration 0037 extends the existing permit/run history enums and nullable Echo
fields. It preserves the original budget, deadlines, result bounds, transaction
owner and old non-Echo projections. Unknown markers, partial DDL footprints and
an older reader facing newer state must produce the explicit blocked or review
result. Disabling a feature does not roll back DDL or protected execution history.

## Protected State And Refusal

MySQL, Control AuthorityStore and authenticated Agent Journal/high-water form the
protected recovery boundary. A database restore alone does not establish a safe
rollback. Keep the original maintenance, backup, restore, review and resume owners;
never add an alternate authority, clear history or replace identity as a shortcut.

The assessment path must not run migrations, initialize Authority state, enroll,
take the Agent instance lock or start Runner. MySQL inspection uses a consistent
READ ONLY transaction. Authenticated Journal inspection requires the real bounded
key and stops on path/authentication/compatibility failures before any mutation.
MySQL DDL can leave partial migration footprints, so inspection must distinguish
those from a complete known schema.

Plan-declared build identity is different from verified runtime identity. An
assessment result neither authorizes execution nor certifies runtime or release
readiness. Credentials, raw protected state and private support artifacts must
not enter source control or public logs.

## Acceptance

Pure plan/compatibility cases, SQL-splitter regression cases and fake Agent command
ports cover ordering and refusal. Packaging tests follow the actual command/native
entrypoints. Real SELECT-only MySQL grants, full-database digests, migration markers,
Journal authentication, backup/restore and runtime fault cases run in Actions.
Record exact source and case results; historical passes do not validate later
changes. See [verification](foundation-verification-2026-10-19.md),
[node security](node-security.md) and [recovery/capacity](recovery-and-capacity.md).
