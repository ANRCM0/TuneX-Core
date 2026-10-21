# Shared Resource Limit Owner

L3 policy consumes original transaction, scope-owner/member authorization, Node
claims/grants, immutable Forward owner and Runtime Node locks. L2
`MySqlSharedResourceLimitStore` owns only the four `shared_resource_limit_*`
tables. Runtime/Journal retain physical resources, execution and consumption.

Construct `SharedResourceLimits({db, identity, nodes, runtime, owners, store, now,
codec})`; `identity` exposes original `scope`/`owner`, `owners` exposes
`forwardPortOwner`, and `codec` exposes `digest`, canonical millisecond
`formatTime`/`parseTime` and `newID`. Commands are
`set(actor, scope, node, subject, requestId, {expectedRevision, startsAt, endsAt,
bytesPerSecond, burstBytes, byteLimit})`; reads are
`get(actor, scope, node, subject)`. At least one limit is non-null; zero denies.

The command takes original identity/member locks, Runtime Node lock, then its
head lock in the original transaction. Replay, CAS, bucket update, audit and
receipt commit together. Unchanged periods retain bucket identity. Adjacent
periods get new identities. Any overlap with another protected historical bucket
refuses. At 1024 historical buckets per subject/Node, new periods refuse instead
of deleting history. Same-period revisions remain possible.

Inject `SharedResourceLimitPublicationPolicy({nodes, owners, store,
codec:{formatTime}})` into the existing locked Runtime publication transaction;
`SharedResourceLimits.limits` delegates to the same class. No command transaction
or identity controller is required by this read policy. Publication groups by
immutable Forward owner. Private Nodes are exempt, unconfigured shared Nodes
retain unlimited behavior, and configured unsupported/zero policies or a time
outside every configured period exclude their assignments. The bounded complete
history is validated for immutable identity and non-overlapping windows before
choosing the unique period containing the publication time. A scheduled future
head does not truncate an older active period. The boundary switches only to an
explicitly configured adjacent period; no automatic monthly period is created.
Valid buckets and assignment IDs are sorted. Publication caches Node/owner policy
reads within its original transaction so shared assignments read history once.
Original eligibility remains responsible for membership, role and full route.

The view's `revision` and `policy` are the latest configured head for CAS. They
may describe a future period while an older historical bucket is still active
in the execution Snapshot. The view does not claim that this configuration is
the current executing period. The view reports Agent consumption as unavailable, with `usedBytes` and
`remainingBytes` null. Configuration is not measured usage or confirmed balance.
No telemetry counter substitutes for protected Journal consumption.

Contract cases are authored in `shared-resource-limits-contract.test.ts` and real
SQL source in `shared-resource-limits-mysql-acceptance.test.ts`; neither has run.
The latter covers original Identity/Runtime locks, replay/CAS races, cross-Node
key conflicts, receipt rollback and an active old period beneath a future head.
Required later acceptance includes real MySQL duplicate request races,
CAS/overlap races, rollback after audit/receipt failure, publication versus policy
changes under the original Node lock, immutable bucket history, capacity refusal,
authenticated personal/governance HTTP isolation and Agent enforcement. Source
composition, DDL/catalog and wire/Runner integration belong to their original
owners; source closure is not acceptance.
