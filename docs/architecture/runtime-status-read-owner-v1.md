# Runtime Status Read Owner V1

Date: 2026-10-19. FR-0016 source implemented; unverified and not accepted.

## Actual Public Chain

| Layer/source | Public API | Owner and effect |
| --- | --- | --- |
| L1 framework/runtime-status-storage-ports.ts | RUNTIME_STATUS_STORAGE_INTERFACE_VERSION1, RuntimeStatusNodeRecord, RuntimeStatusSnapshotRecord, RuntimeStatusStorageReader | Raw persisted facts and three reads; no Forward policy, native JSON/time or SQL |
| L2 infrastructure/mysql-runtime-status-store.ts | MySqlRuntimeStatusStore | Exact old SELECT/argument order, supplied transaction; no pool, decode, retry, clock or writes |
| L3 modules/runtime-status-owner/public.ts | RUNTIME_STATUS_QUERY_INTERFACE_VERSION1, RuntimeStatusQueries, RuntimeStatusCodec | Original status correlation, freshness/readiness and recursive path aggregate |
| L2 compatibility/public.ts | nativeRuntimeStatusCodec | Existing permissive stored-value reader, native parse/ISO/dynamic Date.now; no product owner import |
| Existing modules/runtime/controller.ts composition | RuntimeController old constructor | Explicitly binds raw store/native codec/product reader into same RuntimeHost status port |
| Existing application/control.ts composition | ControlApplication details | Same authorized ControlQueries transaction and Forward; explicit raw store/codec/product reader |
| Legacy infrastructure/mysql-runtime-observations.ts | MySqlRuntimeObservations(policy), own status method | Precise constructor/prototype bridge over one reader; no copied SQL/business body |

Common report/snapshot facts are imported through framework/public, not native
schema types. Unknown database bodies remain unknown until the original read
stage. Current and reported snapshot methods remain distinct: even a malformed
report with undefined sessionEpoch must take the original reported query with its
session_epoch placeholder, not silently fall back to the current query shape.

The existing RuntimeObservationReader/ForwardRuntimeStatus contract and Core/Host
are unchanged. New raw ports and direct product owner require explicit providers.
The native codec imports no product owner. The old wrapper is explicitly a legacy
construction binding, not permission for arbitrary L2-to-L3 dependencies.

## Preserved Query, Parse, Policy And Time Stages

Direct read: node SELECT -> truthy report decode -> optional current snapshot query
-> current assignments decode/filter by forwardId -> report observations tuple
matching -> optional reported snapshot query -> freshness computation -> now on
the original non-null short circuit -> health and truthy time formatting.
Queries remain SELECT-only without added locks/transactions/limits/authorization.
Caller owns scope/Forward authorization and transaction. No missing-node fallback,
strict parse, native protocol revalidation or extra identity check is added.

Tuple matching remains assignmentId/deploymentGeneration/bindingFence; output
keeps original observation fields plus node/forwardRevision/role. Readiness remains
applied count equal to protocol count and every condition ready, after original
freshness. Freshness still uses receivedAt plus observation window and both current/
reported validUntil minus skew, then report session equal to current session.
No clock is sampled until freshUntil is non-null; NaN still evaluates the comparison
with a sample, rather than a newly introduced early return. receivedAt0/freshUntil0
format as null through original truthiness; native invalid-date behavior is retained.

Policy is shallow-copied at construction. Native Date.now is looked up dynamically
per old sample through nativeWallClockNow, not captured at construction. JSON
strings decode using the existing JSON.parse-only-for-strings reader; other driver
values retain reference identity. Current body is read once for assignments and
again for validUntil at its original separate stage. No bulk prefetch/cache/clone.

Path read removes path from spec and calls this.status serially for ingress then
via, reconstructing only ingress nodeId. Dynamic recursion preserves subclass
overrides, including through the legacy own status wrapper. Applied order and
node projection, freshTimes then receivedTimes parsing, unknown-before-all-ready
condition, null propagation/minimum and received-before-fresh output formatting
remain. Each child samples native time independently; parent adds no now sample.

Old MySqlRuntimeObservations has its original constructor arity and own prototype
status method; inherited logic dynamically dispatches child status calls. The new
ancestor/private store/codec fields alter private/reflective layout, so arbitrary
prototype/own-property consumers are not claimed byte-identical. Actual public
callers use the unchanged status contract. Keep the wrapper until all actual
imports/subclasses/tool expectations migrate with matching frozen-source evidence.

## Native Unit Of Work And Migration Owner

The complete original infrastructure/mysql.ts was read and is classified L2;
no new wrapper or code change was made just because it performs native I/O.
rows/write, PoolConnection alias and readStoredValue export are public native APIs.
MySqlUnitOfWork retains createPool8/big-number/timezone options, one original guard
and pool, READ COMMITTED transaction, guard/action/guard/commit order, rollback,
deadlock/wait retry at most3 attempts and connection release. A getConnection error
still occurs before the try. Rollback/release failures retain native behavior.

migrate retains legacy-schema refusal, original named GET_LOCK with30s timeout,
vnext_migrations table, sorted .sql directory reading, semicolon statement splitting,
native implicit-DDL partial failure, 0002 execution_leases history backfill and
GREATEST lease preservation, marker insert, conditional RELEASE_LOCK and connection
release. The native migration format owns these existing storage-version operations;
they are not a second runtime issuer or an excuse to clear protected history.
close retains the same pool.end. These bodies were not executed or validated.

## Planned Acceptance And Remaining Work

FR-0016/readiness153-155 covers original SQL/args/transaction/undefined reported
epoch, malformed report/current/reported values and stage errors, tuple correlation,
clock count/boundaries/NaN/truthy0, policy/reference behavior, path order/minimum/
unknown aggregation and old constructor/prototype/dynamic override consumers.
Original transaction/migration/native adapter cases still require later authorized
exact-source Actions. This declaration is not successful import/type/behavior proof.

Complete server startup/lifecycle/native assembly, ops recovery per-owner quarantine,
native wire/contracts and whole-source/type/private/default/consumer/removal/frozen
candidate/example remain open. No test/check/format/generator/build/CI/experiment,
commit or push occurred. Foundation, physical/long-run/recovery/release and upper
parallel-feature acceptance require independent evidence; source-task concurrency
does not open those gates.
