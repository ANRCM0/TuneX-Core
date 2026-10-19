# PathGroup Owner And Storage Boundary v1

Date: 2026-10-19 (Asia/Shanghai). Status: source authored, unverified.
Scope: plan A2, original immutable groups and their exact Path provenance.

## Public Rules And Lower Storage

modules/path-owner/public.ts exposes the original group configuration/selection
parsers and PATH_GROUP_LIMITS. group-values.ts has the one shared implementation;
modules/path-group-contract.ts directly aliases it and the existing public types.
Closed fields/prototypes, version/kind checks, one-to-eight ordered candidates,
distinct IDs/path digests, exact template selections and original digest/revision
predicates remain. Limits retain the original object identity and runtime mutability;
no extra freeze, normalization or automatic candidate selection is introduced.
Application-private head/revision/provenance validation stays in PathGroups.

L1 has parameterized configuration records and group metadata reader/writer ports,
plus original group selection/provenance records and binding reader/writer ports.
They use existing ForwardIntent/ForwardValue and ReadPageWindow, never an application
or Path product import. Old PathGroup records and storage interfaces specialize
these lower shapes without new required methods, readonly or nullable guarantees.

L2 mysql-path-group-store.ts contains the original metadata and binding SQL in
MySqlPathGroupStore and MySqlPathGroupBindingStore. The configuration type is not a
validator: raw JSON, Boolean projection, missing-row nulls, prefix/revision filters,
Scope predicates, SELECT b.* and count-before-page stay as before. Neither class
opens a connection, creates a transaction, commits, retries or issues authority.

Metadata publication keeps its differences from PathTemplate publication. Revision
one rechecks the original hard-coded 64-group quota before head insertion; later
revisions insert immutable history before the conditional head update, requiring
the previous revision, archived=FALSE and exactly one affected row. The caller
holds Scope then group-head locks in the same transaction. Archive and audit SQL,
UUID evaluation and argument order remain original. No shared generic template
implementation replaces this distinct CAS behavior.

Group binding history retains its original LIMIT 64. Append retains exact numeric/
DECIMAL text conversion, corruption and 64-entry refusal before either write, then
immutable insertion and current-pointer upsert. Detach deletes only the pointer;
protected history is not cleared. Mutations use the original Forward row lock and
supplied transaction. The referenced PathBinding sequence remains in its original
owner and is read through current/at, never copied into a new Path history store.

## Original Owner Chains

- Group list/get -> PathGroupApi -> PathGroups -> Scope authorization -> group
  storage -> lower metadata store -> original group/revision tables. Private head/
  revision checks and template reads remain at their original points. get retains
  its repeated head read and non-authorizing OR-of-complete-AND-path presentation.
  Historical reads do not recheck live grants, reserve resources or prove health.
- Group publish/archive -> original identity/CAS and idempotency framing -> manager
  authorization/claim -> Scope lock -> locked group head and previous revision
  validation -> original clock sample -> publish candidate checks or archive flag
  decision -> original quota/revision checks -> metadata write/audit -> original
  idempotent response, on one transaction. No-op publish still performs the original
  candidate/reference and time checks; it does not silently skip them.
- Publication candidate validation sorts template lock/read traversal by template
  identity/revision, then restores original priority order. With an actor, it locks
  template heads and calls the existing Node/Profile/Endpoint reference owner for
  every branch. Without an actor it validates persisted facts only. Original same
  ingress/protocol and distinct-terminal rules and refusal differences remain.
- Forward applyGroup/publication -> original Forward lock/CAS/source checks ->
  PathGroups.resolve -> group selection/current-provenance checks and locked group
  revision -> persisted candidates plus selected-template archive/expansion check
  -> PathBindings.resolve for the selected path and its live references -> original
  Forward decision/preparation/replacement/Runtime plan/Operation/capacity -> Path
  accept -> group accept -> response. No selection callback grants execution.
- Group accept -> original Path receipt/candidate/revision validation -> original
  no-op comparison or binding append -> provenance check including PathBinding.at
  and, when required, current pointer. Forward normal-update preserve/detach uses
  its original topology and receipt checks and only removes the group pointer.
- Binding/reference/preview reads retain Scope/manager checks, original record/
  history ordering, contiguous-sequence/current-pointer validation, recovery and
  archive refusals. Preview delegates to the public Path preview port. Flags remain
  reserved:false, executionAuthorized:false, fullPlanAuthorization:false, health:
  unknown and automaticSelection:false. Reads remain read-committed, not a global
  snapshot or automatic failover decision.

PathGroups now uses existing L1 pagination and L2 digest/request/default-clock/ISO
helpers at the original evaluation points. Default selection captures Date.now
without reading time. Request bodies/key order, clock sampling before candidate
validation, and item time formatting remain original. Core and execution contracts,
transactions, public API responses and feature defaults are not changed.

## Precise Legacy Entries

MySqlPathGroups and MySqlPathGroupBindings retain zero-argument construction and
their original public async prototype/subclass methods. Their wrappers own no SQL.
The lower metadata publish has an optional trusted count binding solely to retain
the old publish -> this.count dynamic call. Normal lower calls resolve the same
store method lazily; the old wrapper supplies its own this.count lazily. The
callback receives the original transaction/Scope and is invoked only for revision
one, at the original quota check. It does not replace the application quota check,
acquire a lock, open a transaction or become a serialized/user-controlled policy.

Control explicitly binds both lower stores using public PathGroupConfig and keeps
the original Path/PathBinding/Forward collaborators. Legacy parser/type/limit paths
remain aliases. Remove entries only after caller inventory and accepted compatible
frozen-source evidence, not by treating this as a broad reverse-import exemption.

## Evidence And Remaining Work

Readiness item 57 is planned only: public/legacy identity/type/module initialization,
dynamic count override/error/call timing, exact SQL/lock/argument/CAS/rollback,
quota and sequence edges, distinct history bounds, same-transaction provenance,
explicit candidate and non-authorizing query behavior. Source-string tooling moves
only during later authorized verification. Functional/MySQL/Agent evidence belongs
in Actions on the same frozen source.

Remaining Path publication/Ingress storage and format/application owners, Transit,
A1 residuals, Agent/native/Runner and full-repository classification stay open.
No L0/frozen semantic, schema, wire, authority, auto-selection, feature or protected-
history change is included. No checks/tests/builds/experiments/CI/commits/pushes or
delegation ran. This dirty source candidate is not A2/foundation acceptance, a
tested revision, phase B-E implementation or an open upper-module gate.
