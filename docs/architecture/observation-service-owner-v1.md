# Observation Declaration Public Owner

Date: 2026-10-19. Source authored only, not frozen, checked or accepted.
This is the original inert manager-declaration owner, not a new measurement or
execution service. The foundation and parallel-module gates remain closed.

## Original Call Chains

| Entry | Rules and coordination | Public ports and binding | Original state |
| --- | --- | --- | --- |
| HTTP list/get | observation-service-owner/public.ts -> service.ts -> values.ts | L1 TransactionBoundary/ScopeAuthorization, ObservationServiceStore -> MySqlObservationServiceStore | Existing observation metadata tables and bounded audit history |
| HTTP publish/archive | Same original service class and command method | L1 IdempotentRequests, ScopeAuthorization and supplied transaction -> same lower store | Immutable config revisions, CAS head, audit and receipt in one transaction |
| Control Probe resolver | Public ObservationServiceReadPort/reference/config/trust rules | Existing lower store and original caller transaction | Read-only exact declaration; no issuance or network authority |
| Storage values | Public storage-values.ts | Existing ObservationMetadataValues specialization at original lower SQL call points | Original config assertion and publish/archive kind predicate |
| Legacy MySqlObservationServices | Same zero-argument wrapper and module-local default provider | One lower SQL implementation, lazy this.head/this.count overrides and static quarantineRecovery | Same tables and recovery suspension; no alternate store |

The existing server and Control roots bind the same instances, flags, clock and
storage values. The existing HTTP service slot now consumes the public API. No
new root, service instance, worker, ledger, secret provider or network caller is
introduced. L0/L1/L2 public contracts and lower SQL bodies are unchanged.

## Product Contracts And Effects

contracts.ts owns the exact original TLS/echo config, head, revision, audit,
receipt and store specializations, plus the existing reference/read port. api.ts
owns the exact original DTOs and API version. Broad lifecycle/response types and
literal optional trust fields are retained. OBSERVATION_SERVICE_LIMITS remains
the original as-const object, without adding runtime freezing. ALPN and all limits
retain their values and identity through direct legacy aliases.

Product rules still consume public L2 certificate, Ed25519, endpoint, JSON and
digest primitives. The service retains original default wall-clock capture,
monotonic admission/cooldown, ID generation and request framing. Storage values
still assert the config shape; full config/trust validation stays at the original
service/resolver points, not earlier inside SQL.

## Order And Compatibility

Command validation and parsing precede original per-instance actor admission.
Within one transaction: manager Scope authorization -> idempotency claim/replay ->
Scope lock -> locked head/CAS -> previous immutable revision -> clock/window and
quota decisions -> optional immutable revision insert -> changed head/audit ->
idempotent response. Replay precedes metadata locks. Unchanged publication and
repeated archival keep original status, revision and no-write behavior. Recovery
suspension can be cleared only by the existing publication path. Archived service
IDs cannot be reused, and service quota includes archived identities.

The original metadata revision and config-revision limits remain distinct. Clock
regression behind immutable history, exhausted revision, expired publication,
seven-day validity, invalid persisted data, response-size and audit-loss checks
keep original errors and call sites. Later failure rolls back earlier writes.

List/detail retain manager authorization, bounded row uniqueness, exact historical
revision selection, trust validation, archived/recovery/not-yet-valid/expired/
declared precedence, audit truncation and original read-committed disclaimer.
measurementAvailable and echoAvailable retain their constructor values. Neither
declarations nor trust projections prove endpoint ownership, health or permission.

Old application class/API/provider and flat product-port paths directly alias
their canonical leaves with their exact former export surfaces. Existing values
and reference aliases remain. New consumers use public.ts; type/constants-only
legacy imports do not acquire a service-root dependency. Remove compatibility
entries only after consumer inventory, same-revision acceptance and a separately
authorized removal task.

## Deferred Evidence

Readiness item 78 records planned class/API/alias/default identity, admission,
authorization/replay/CAS/clock/quota/archival/recovery order, transaction rollback,
read projections and lower-store override/static behavior. It is unexecuted.
No tests, type/syntax/static/boundary checks, formatters, generators, builds, CI,
native/network/MySQL/browser/container experiments, commits, pushes or delegation
ran for this slice. Functional/MySQL evidence belongs in later authorized Actions
on the exact frozen source. Physical, load, release and production gates remain
separate. A1 Probe coordination, remaining application/HTTP, Agent/native, Runner
and whole-source classification are still open.
