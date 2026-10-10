# V2 data migration and recovery

Baseline schema migration:
`backend/prisma/migrations/20261102000000_tst_unified_forward/migration.sql`.
It is additive and does not reset the database. All historical applied migrations
remain unchanged so Prisma checksums and existing upgrades remain reproducible.

## Impact

- Existing Link resources default to `managed_by=manual`; they do not become
  automatic reuse candidates. New TST resources have `carrier=tst_v1`.
- Historical non-TST Link resources/deployments become `legacy_unsupported`.
  Their business rules remain stored, with `legacy_transport_unsupported` status.
  Existing IDs, revisions, traffic checkpoints, ciphertext and history remain.
- No historical ciphertext, frame, certificate or session is interpreted as TST.
  Create explicit TST replacement rules in a maintenance window after stopping
  and verifying the historical runtime. There is no automatic plaintext fallback.
- New ForwardOperation rows record actor/workspace/key uniqueness, normalized
  request hash, execution fencing, Forward identity and recoverable progress.
  Managed resources gain a unique reuse identity and unreferenced timestamp.
- A deletion marker retains a rule until its removal is confirmed. Automatic
  Link retirement waits for zero references, pending-operation exclusion,
  grace period and confirmed two-endpoint removal before releasing carrier ports.

Historical multi-target/source storage is kept for audit and recovery. The new
TST compiler rejects such policies; it does not silently drop the fields.

## Before an existing environment upgrade

Record the environment/database identity, current application and Agent versions,
image digests, business counts and the maintenance window. Use the existing
encrypted backup flow to save the database, environment configuration, independent
Link seal key and every node's corresponding private state. Verify checksums and
restore into a separate environment before changing an existing deployment.

Stop/drain incompatible old carriers, verify the real process/listener state and
preserve final traffic. Apply migrations, deploy the matching Panel/Worker and
Agent versions, leave TST disabled, and inspect the quarantined historical rows.
Enable only in an authorized test scope after the release gates pass, then create
and verify replacement rules through `/forwards`. Do not remove historical rows,
keys or checkpoints just to make the new path work.

## Rollback

Switching images alone does not undo migrations or restore stopped historical
sessions. Stop the new paths through their supported lifecycle, preserve their
unconfirmed traffic and verify listeners are closed. Restore the matching backup
to the identified environment together with its original configuration and Agent
state. Restoration can overwrite business data and therefore requires an explicit
environment-specific decision; no such restore or production reset occurred in
this implementation.

## Executed scope

Implementation validation uses isolated loopback `tunex_v2_test` and
`tunex_v2_e2e` databases. Fixture code rejects other database names/hosts. Existing
user databases and production deployments were not reset or modified. Linux
installation, historical production upgrade and full rollback rehearsal are
separate release gates, recorded in testing.md when actually executed.
