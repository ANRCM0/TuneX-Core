# FR-0016: Runtime Status Read Storage And Product Owner

Date: 2026-10-19. Status: implemented-unverified.
Owner: existing foundation source task. Decision uses the human's 2026-10-19
standing authorization for similar foundation source proposals after a complete
record, without repeated confirmation; current subagent authorization permits
parallel disjoint source work only. This record precedes implementation.

## Task Proposal

1. Layers: additive L1 raw Runtime status read port, L2 original MySQL/JSON/time
   binding, L3 existing status projection and recursive path aggregation owner.
2. Consumed public interfaces: existing RuntimeObservationReader/ForwardRuntimeStatus,
   common report/snapshot facts, Policy, StoredValues, and existing transaction.
3. Foundation impact: add RUNTIME_STATUS_STORAGE_INTERFACE_VERSION1 and raw read
   records/methods only. Existing RuntimeObservationReader/Host/Policy/Core unchanged.
4. Contracts: raw node/snapshot reads; original product status coordinator accepts
   explicit storage and codec(read/parseTime/formatTime/now). Old
   MySqlRuntimeObservations(policy) remains a construction subclass and inherited
   status(tx,forward), policy copy and recursive dynamic dispatch remain. No wire,
   schema, query, locking, publication or freshness policy change is intended.
5. Acceptance planned only: raw SQL/arg/missing row behavior, parse/query/clock/
   first-error stages, observation tuple correlation, original freshness truthiness,
   path recursion/order/null aggregation and alias/subclass/constructor compatibility.
   No test/check/build/CI/experiment executes during this source phase.
6. Parallel effects: main agent alone edits framework/public, compatibility/public,
   this status adapter/owner and two composition callers plus shared docs. Other
   agents handle Control startup/client, Agent native engines and read-only inventory.

## Why Existing Extensions Are Insufficient

MySqlRuntimeObservations currently mixes SELECT statements with Forward path
recursion, current assignment/report correlation, readiness/freshness product
policy and native JSON/time operations. RuntimeObservationReader describes the
finished status, so it cannot isolate raw reads while preserving the original
incremental parse/query/clock points. A bulk load would move malformed JSON errors
and queries earlier/later. Reuse existing StoredValues and native time operations;
add only two raw storage methods and a product-specific codec contract.

The status policy belongs to an existing product owner, not a new L1 kernel. L1
storage returns unknown persisted bodies, no native wire type or product class.
This is a read projection, not another authority, ledger or state owner.

## Impact, Compatibility And Migration

Public original users are RuntimeController composition and ControlApplication
detail composition, the old MySqlRuntimeObservations(policy) entry and possible
subclasses overriding status. Compose new public RuntimeStatusQueries explicitly
with MySqlRuntimeStatusStore and nativeRuntimeStatusCodec; retain old constructor
as a real compatibility binding over the same implementation. New direct owner
requires explicit providers, no native default. Preserve policy shallow copy and
status recursion through this.status (not a private helper bypassing overrides).

Raw store keeps SELECT * runtime_nodes by Node, snapshot SELECT by Node/generation,
and the reported snapshot form with session_epoch at the exact old argument/order
sites. It opens no transaction/pool, retries nothing and writes nothing. Missing
node still reaches the original property access failure; malformed persisted JSON
is not normalized or prevalidated. Do not add a safer fallback silently.

L3 decodes report before current query, then current assignments before applied
projection, then queries reported snapshot, then computes freshness, then samples
now only on the original non-null short circuit. Preserve matching assignmentId/
deploymentGeneration/bindingFence, current forward filter and report session check;
no new identity/revision/protocol/freshness guards. Received time zero and fresh
time zero still produce null through the original truthiness formatting. NaN,
invalid dates and formatting errors keep native behavior at original stages.

Path reads remain serial ingress then via, same reconstructed Forward and removed
path field, same spread/key order/applied order/minimum/null/unknown-before-ready
aggregation. Child calls each keep their original independent now sample; parent
time parsing/formatting adds no clock sample.

Interface1 is new and additive; old Runtime read interface/return shape, ADP/native
parser/schema, database tables, authorization/Tx, Runtime writes and protected
Agent/Control history do not change. The old prototype keeps its own status
delegating method. Added private store/codec fields and the new ancestor are not
promised as identical reflection/own-field layout; consumers relying on them need
explicit migration/acceptance. Delete the old wrapper only after all actual
imports/subclasses/tool/source assertions migrate and matching frozen-source tests
pass. Historical passes do not validate this dirty content; no rollback/reset of
protected records or unsupported-protocol acceptance is introduced.

## Acceptance And Known Limits

Record detailed cases in readiness153-155 and source-chain documentation. Include
same SQLs/args/transaction/absence, malformed body and array behavior, tuple matches,
truthiness/NaN/boundary time, policy capture versus native clock lookup, recursive
dispatch and exact output shape. Later authorized GitHub Actions must execute
functional/MySQL/native evidence on the complete frozen source. Public example,
all source/type/private/default/consumer classification, physical/long-run/recovery/
release gates and foundation acceptance remain unproven and independent.

No tests, types/syntax/static/import/boundary checks, formatters/generators/builds,
CI or experiments, commits or pushes are authorized by this FR. Current source
work must not imply foundation stability or upper feature gate acceptance.
