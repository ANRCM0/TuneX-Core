# Path and Ingress coordinator source continuation

Date: 2026-10-19. Source authored only, in the existing dirty foundation worktree.
No tests, type/syntax/static/boundary/import checks, formatters, generators, builds,
CI, network/MySQL/browser experiments or Git writes ran for this slice. The
source is not an accepted or frozen revision and does not open the module gate.

## Scope and public contracts

The original L3 coordinators are canonical under the existing Path and Ingress
owners. L0 APIs and L1 ports retain their semantics. All required reader, writer,
resolver, original Forward command, transaction, authorization and receipt providers
remain supplied separately. Existing L2 digest/clock/ISO/request-ID/JSON operations
and lower storage implementations remain in use. No source was copied from Forwardx.

Path public.ts adds PathTemplateQueries, PathTemplateCommands, PathBindings,
PathGroups and PathPublications. Full original flat template/binding/group/publication
contract declarations now live in local template-contracts.ts, binding-contracts.ts,
group-contracts.ts and publication-contracts.ts. The already canonical template-api.ts
and binding-api.ts remain; full group/publication APIs now live in group-api.ts and
publication-api.ts with their original version constants and DTO types.

Ingress public.ts adds IngressGroups, IngressDeployments and IngressMigrations.
Full original flat ingress contracts live in contracts.ts, migration contracts in
migration-contracts.ts; full public APIs and original version constants live in
group-api.ts, deployment-api.ts and migration-api.ts. Canonical owner internals use
local contract/rule leaves; cross-owner Path/Forward/Console types consume public
entries. No owner implementation imports its own public barrel.

Old application class/API entries and flat contract paths directly alias the same
canonical leaves, preserving original named exports, class identity and prototypes.
The old path-templates.ts also keeps its exact limits/head/revision validator exports.
No wrapper or second SQL/coordination implementation remains at those old entries.

## Original source chains and preserved decisions

Template queries: input/identity/paging -> same-Tx scope read authorization -> required
template reader -> existing lower store -> bounded page/head/immutable revision
validation -> original frozen read view. Get retains head-before-revision lookup,
requested/current revision semantics, capability requirements and non-authorizing
reference flags. Command: parse/config or archival precondition -> exact request
digest -> manage authorization -> receipt replay -> Scope lock -> locked head/CAS ->
archive/current-revision checks -> one captured-default clock call -> required
reference validation -> digest/change detection -> immutable revision/creation quota
-> publish/archive -> audit -> receipt. Existing archived IDs still count; unchanged
and archive responses retain original status/revision semantics and mutability.

Path binding methods with supplied Tx retain it and do not start transactions.
Resolve validates current provenance before target template/head lock and active
check; immutable Profile validation follows. Creation resolution retains its
original identity/spec/selection validation. Accept returns the original unchanged
receipt before sampling time when exact selection/topology matches; otherwise it
appends through the same provenance writer, then validates the stored result.
Preserve/detach/current retain their original historical/current topology checks.
Get retains Forward/current/history read order, sequential immutable validation,
64-entry contiguous sequence checks and current-pointer-in-history requirement.
Preview keeps parse/refusal order and same-Tx manage authorization. References
requests manage only for targetRevision, reads immutable target before page, skips
new reference authorization for archived targets and preserves archived/recovery/
unsupported unavailableReason precedence. It still samples dynamic currentIso only
at the original response tail. No current provenance or execution authority is added.

PathGroup retains candidate template/revision sort for deterministic access, then
restores configured priority order. Actor-present checks use locks/new-use refusal;
passive missing/digest/config failures remain integrity errors. It retains the
distinct-egress and common-ingress/protocol invariants and OR/AND view labels.
Commands preserve manage -> replay/deepFreeze -> Scope/head/CAS -> old revision ->
clock -> candidate/reference validation -> quota/publish/audit -> receipt/deepFreeze.
Group provenance retains original pathBindingSequence history lookup and exact
path/current equality checks, not just matching template IDs. Binding preserve,
detach and current checks retain requireCurrent differences. History remains bounded
and contiguous; preview uses the supplied original path preview in the same Tx.

PathPublication retains Forward-ID sorted preview access and input-position order
in the persisted plan. Create checks manage/replay before Scope quota, then recompiles
the plan and compares previewDigest before generated-ID/time/store/receipt writes.
Get validates immutable attempts and Operation references with original status and
cleanup/recovery flags; missing Operation rows retain their original behavior.
Act/cancel lock and validate the record, original creator and recovery isolation
before receipt replay/CAS. Act invokes the original Forward public methods inside
the original store savepoint; accepted/refused outcome is appended after isolation,
then receipt. Refusal vocabulary and savepoint rollback/release remain lower-store
owned; unknown or retryable failures are not normalized here. Compensation checks
exact accepted/source provenance; the batch is still non-atomic across Forwards.

IngressGroup retains sorted template access followed by original member order,
distinct ingress Nodes/common protocols and actor-dependent missing/archive/digest
failure distinctions. Its command order and quota/receipt/deepFreeze behavior stay
original. describeIn/resolveIn join supplied Tx, reauthorize manage, lock exact group
revision and preserve active/default differences. resolveIn validates/copies requested
member IDs and returns the same requested member order, not the sorted read order.

IngressDeployment retains member expansion and preview order, exact shared target/
enabled/protocol checks, frozen plan/digest, archived-inclusive quota and distinct
created Forward validation. Origin reads are historical accepted create receipts,
reject recovered/compensated sources and do not invent current membership. Act/cancel
retain creator/recovery-before-replay order, exact CAS and per-item durable decisions.
Create re-resolves the member in the same original savepoint before original Forward
creation; compensation remains conditional deletion of that exact accepted Forward.
No cross-Forward atomicity or physical resource sharing is claimed.

IngressMigration retains sorted origin resolution, input source order, sorted Forward
inspection, source/target group describe order and complete sorted definition diff.
It preserves explicit add/update/remove, immutable baseline checks and no silent
rebase. Origin reads retain apply-versus-compensate eligibility; only accepted update
restoration can be a compensating live-state origin. Apply rechecks exact lineage
and state, then delegates remove or target member resolution plus add/update to the
original Forward owner inside the original savepoint. Add compensation deletes;
update compensation restores original provenance; remove remains irreversible.
Creator/recovery/replay/CAS/cancel order, attempt validation and flags are unchanged.

All original clock constructor defaults still use nativeWallClockSource at constructor
evaluation; publication/deployment/migration newId positional defaults retain the
same nativeModuleId function. DTO mutable/readonly declarations, mutable limit
objects/rejection Set, existing runtime freezes and deepFreeze call sites remain.
The supplied transaction is still the original owner transaction; no second Runtime
ledger, authority, Journal, event hop or direct foreign-table write is introduced.

## Main integration and remaining source debt

Main imports the five Path classes from modules/path-owner/public.ts and the three
Ingress classes from modules/ingress-owner/public.ts in application/control.ts,
keeping original instances, constructor arguments, lower stores, original Path/Forward
collaborators and cyclic origin resolver callback. HTTP application ports imports
PathGroupApi/PathPublicationApi and IngressGroupApi/IngressDeploymentApi/
IngressMigrationApi from those public entries; template/binding APIs are already
canonical. No shared root, HTTP application-port or shared readiness/boundary/index
file was edited by this slice.

Main serial integration also moved the complete original NativePathReferences
class to path-owner/references.ts. The old class path is its exact leaf alias.
Original ForwardNodeAuthorization/RelayNodeAuthority declarations are canonical in
node-owner/execution-contracts.ts, exposed through Node public with exact old
node-execution-ports aliases. Path references consumes public Node, Transport and
RelayEndpoint contracts, and local Path declarations/rules. It still uses the
same receiver/Tx, sorted Node checks, then Profile, then sorted Endpoint reads and
returns the same profileDigest; no online/Runtime readiness inference is added.

Original PathGroup/Publication limits now belong to path-owner/limits.ts, Ingress/
migration limits to ingress-owner/limits.ts. Rule/API leaves consume local limits;
old path-operation-limits.ts directly aliases both canonical leaves. The same
numbers, mutable objects, migration runtime freeze and broad-number types remain.
Flat parser/rule aliases remain explicit compatibility
bridges; lower storage and complete public/type/default/compatibility classification
and full HTTP adapter chains still require the overall A2/A5 source closure.

## Planned, unexecuted acceptance

After verification authorization, tie evidence to one exact frozen revision in
GitHub Actions. Cover original/new class/API/type/version/limit/validator identities
and legacy named exports; constructor capture/default/callback receiver timing;
same-Tx authorization/store/Forward calls and no nested acceptance transaction;
all identity/input/paging/missing/integrity refusal orders and mutable/frozen shapes.

Template cases: head/revision consistency, archived identity/quota, no-op/archive
status and audit/receipt order, clock failure versus reference/quota order. Binding:
unchanged receipt without clock, 64-entry bounds/sequences, topology/provenance/current
pointer checks, immutable Profile mismatch, supplied-Tx creation/preview/detach,
archived/recovery/unsupported references and original tail observation timing.
Group: sorted read versus priority order, actor-present/passive error distinctions,
distinct-egress/common-protocol invariant, exact original path provenance, bounded
history and unchanged binding. Publication: sorted lock/read versus input position,
stale preview/CAS, original creator/recovery-before-replay, partial rejection and
savepoint failure propagation, attempt immutability, exact conditional compensation,
Operation reference projection and non-atomic flags.

Ingress cases: member/read ordering and distinct Nodes, exact group revision/active
flags, quotas including archive/restored batches, current actor versus historical
reader errors, original creation/conditional deletion receipt shape, live-origin
eligibility and recovery isolation. Migration: sorted origins/Forward inspection,
definition coherence, add/update/remove and explicit replacement restrictions,
lineage changes before apply, irreversible remove, add deletion/update restoration,
accepted compensation eligibility, replay/CAS/attempt/cancel ordering, savepoint
rollback and preserved non-authorizing/unknown-health/physical-sharing flags.
Reference cases additionally compare exact class/type/limits aliases, Node sort
and capability refusal before Profile resolution, Profile mismatch before Endpoint
reads, Endpoint order/revision errors and unchanged caller Tx/receiver. Compare
limit object identity across legacy/public/rule/API imports and runtime freeze only
for the originally frozen migration object. No numeric/literal/mutability widening
or policy change is accepted from this source move without later evidence.
No planned case in this document has been executed by this source slice.
