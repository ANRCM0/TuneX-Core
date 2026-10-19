# IngressGroup Owner And Storage Boundary v1

Date: 2026-10-19 (Asia/Shanghai). Status: source authored, unverified.
Scope: plan A2, original ingress definitions and their shared input/plan rules.

## Public Rules And Lower Storage

modules/ingress-owner/public.ts is source interface candidate 1. Its values.ts
contains the one original group/selection/deployment-input/plan parser implementation;
modules/ingress-contract.ts directly aliases those functions and INGRESS_LIMITS.
The original shared closed-object helper stays shared, rather than copying group
rules into deployment/migration implementations. Public Path selection and hash
rules and existing L2 digest/UTF-8 JSON byte helpers retain their original behavior.
Limits retain the same object identity and runtime mutability.

Closed fields/prototypes, distinct ordered member IDs and path digests, exact group
revision/digest, explicit enabled boolean, original dummy-Forward listener/target
validation, one expansion per member, ordered plan positions and distinct ingress
Nodes/shared target/protocol/enabled rules remain. No default-enabled interpretation,
new parser hardening or listener/target normalization is added.

L1 defines group heads, parameterized revision records and transactional storage
ports over ReadPageWindow. Existing IngressGroupHead/Revision/Store specialize
those shapes with the original product configuration; fields, optional locks,
nullable reads and mutable meanings remain. The L2 MySqlIngressGroupStore in
infrastructure/mysql-ingress-group-store.ts owns the one original SQL implementation.
It imports no application/product type and does raw JSON/Boolean projection only.

Scope/head locks, count-before-list, bound prefix matching, literal bounded paging,
missing-row nulls, archive and audit UUID timing remain original. First publication
rechecks the original 64-group quota and inserts the initial head before its
revision. Later publication inserts an immutable revision then updates the head
only for the previous revision and archived=FALSE, requiring one affected row.
Caller locks and rollback are unchanged; this store opens no pool/transaction,
retries nothing and owns no Forward, listener or Runtime authority.

## Original Owner Chains

- Group list/get -> IngressGroupApi -> IngressGroups -> Scope authorization ->
  lower metadata store -> original group/revision tables -> private product head/
  revision checks and persisted member resolution. get retains its repeated head
  read and original ISO projection. Reads do not reauthorize live references.
- Publish parses the config before original command identity/CAS/request framing;
  archive retains its original zero-revision refusal. Command -> manager check/
  idempotency replay -> Scope lock -> locked head/CAS/archive/previous revision
  checks -> original time sample -> member/reference validation or archive decision
  -> original revision/quota checks -> publish/archive/audit -> idempotent response,
  all in the original transaction. No-op publish still checks time and references;
  original archive no-op time sampling is not silently removed.
- Member resolution sorts template head/revision traversal, then reconstructs the
  original member order. With an actor it locks template heads, refuses archived
  templates and uses NativePathReferences for Node/Profile/Endpoint authorization
  in the same transaction. Without an actor it checks persisted declarations only.
  Distinct ingress Nodes and one business protocol set remain mandatory; do not
  substitute PathGroup's same-ingress branch rules or shared physical execution.
- describeIn -> manager check -> locked exact group -> digest/optional active check
  -> persisted members. Its default active=false retains historical/archive use.
- resolveIn validates and copies explicit member IDs before awaiting, then manager
  check -> locked active exact group -> persisted members -> original requested
  member order. Neither resolver adds live-reference checks to members() without
  an actor. Downstream deployment/Forward preview and original selected Path owner
  retain their authorization responsibility; this result grants no execution.
- Existing deployment and migration consumers use the public shared rules/types.
  Their original SQL, durable decisions, compensation and execution chains are
  separate remaining work, not accepted by this parser or group-store extraction.

IngressGroups retains private product validators and original coordination over
public pagination/digest/request/default-clock/ISO helpers. Clock construction
captures Date.now without reading time; command sampling and digest/request field
order remain original. Metadata stays health:unknown, reserved:false,
executionAuthorized:false, fullPlanAuthorization:false and physicalConnectionSharing:false.

## Precise Legacy Entry And Remaining Work

MySqlIngressGroups retains zero-argument construction and original public async
prototype/subclass methods. publish lazily supplies its own this.count to the one
lower implementation, preserving subclass dispatch at the revision-one quota check
only. Normal lower calls lazily use their own count. This trusted adapter binding
does not replace application quota checks or caller locks and is not user policy.
Control explicitly binds the lower store with public IngressGroupConfig; no new
composition root or state owner is added. Remove aliases only after caller inventory
and accepted compatibility evidence on the same frozen source.

Readiness item 59 is planned only. Type/alias/module initialization, SQL/lock/CAS/
rollback and count dispatch, actor-dependent member behavior, input/plan errors,
native helper timing and non-authorizing resolver flags need later acceptance.
Source-string tooling changes wait for verification authorization; functional/
MySQL/Agent evidence belongs in Actions on the same frozen source. Source is dirty
and uncommitted, not a tested revision.

Remaining deployment/migration storage and application/format owners, Transit, A1
residuals, Agent/native/Runner and full repository classification remain open. No
L0/frozen semantics, schema, protocol, authority, feature or protected-history change
is included. No checks/tests/builds/experiments/CI/commits/pushes/delegation ran. This
does not accept A2/foundation, phase B-E or the independent upper-module gate.
