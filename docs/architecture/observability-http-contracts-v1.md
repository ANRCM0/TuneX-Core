# Optional Observability HTTP Contracts V1

Date: 2026-10-18. Status: source candidate; not accepted or verified.
This document records the L3 public seam, not an additional execution framework.
The source-only agreement and foundation-readiness.md remain authoritative.

## Public Entry Points

| Entry under apps/control/src/application | Services | Existing scope |
| --- | --- | --- |
| forward-diagnostic-api.ts | ForwardDiagnosticsApi | Passive Forward diagnostic and redacted same-read support view |
| audit-api.ts | AuditEventsApi | Manager-only merge of original owner records |
| station-alert-api.ts | StationAlertsApi | Policy CAS, derived station events, acknowledgement and silence |
| notification-api.ts | NotificationEndpointsApi, NotificationDeliveriesApi | Protected endpoint intent and bounded delivery/attempt history |
| probe-history-api.ts | ProbeRunsApi, ProbePlansApi | Captured original permit history and finite plan commands/previews |
| observation-service-api.ts | ObservationServicesApi | Manager-declared immutable service configuration and metadata |

Each entry declares interface version 1. These versions do not change Control API,
wire, schema, Probe, Core or package versions. Existing telemetry-api.ts covers the
five independently budgeted raw/aggregate telemetry seams. Together they supply
ControlHttpServices without specialized implementation-class/never-Tx views.

Contracts reuse owner ports, not storage implementations or classes. HTTP receives
only the methods it already called. No HTTP view exposes a store, transaction,
worker tick/close, notification enqueue/send, permit recorder or native signer.
Implementations retain their original constructors and method bodies. The old
createApp positional entry still derives optional slots from ControlHttpServices;
named composition uses createControlApp and the same supplied service instances.

## Compatibility Rules

- Preserve undefined/missing service slots and their original unavailable errors;
  they differ from an installed service whose collection/worker is disabled.
- Retain generic request admission before request parsing/authentication and the
  owner-specific actor cooldown/concurrency budgets. Sharing signatures does not
  authorize sharing counters, queues, retry policy or Runtime-pool fallback.
- Record the original DTO shapes explicitly: timestamps keep their ISO-string or
  millisecond representation, absent/optional/null fields remain distinct, wire
  values keep their readonly/literal types and ordinary response fields keep broad
  inferred types. Public API declarations do not enable additional Probe kinds.
- Notification public projections exclude authority digests, credential references,
  raw destinations, signing keys and private credential material. Endpoint GET does
  not read/test a secret; delivery GET does not dispatch. Diagnostic support keeps
  its original aliases/exclusions and is generated from the same bounded read.
- Probe history remains captured original-owner evidence, not an independently
  recomputed proof or current permit/authorization/health. Plan reads do not issue;
  commands and scheduled decisions still use the original issuer and supplied
  transaction. Existing staged echo source is preserved, not completed or enabled.
- Observation service availability flags are configuration only. Trust projection,
  lifecycle and declarations are not ownership, reachability, liveness or health.

modules/observation-policy.ts holds seven existing limit objects and AUDIT_COVERAGE.
It uses the existing public freeze helper for the old deepFreeze objects; the two
notification Object.freeze objects retain readonly literal property types. Values,
runtime freezing and old export identities are source-preservation intent. No
admission, authority or worker state is moved into this policy source. The original
observation-service limits/ALPN stay in their existing owner contract. Old policy
exports and application/probe-plans.ts ProbePlanReceipt remain aliases.

## Integration

An alternate implementation imports its API and owner value contracts, implements
only that seam, and is supplied in the existing named services slot. It does not
extend an implementation class, construct another Runtime, add a composition root,
write another owner's tables or turn an observation into execution permission.
Use existing L1 transaction/authorization/idempotency and lifecycle services where
needed; retain manager versus member authorization and existing transaction order.

The JSON boundary inventory declares these public entries and explicitly retains
mixed application/format/storage dependencies as migration debt. Current owners
still contain native time, Buffer, crypto, wire parsing and some concrete helpers;
several MySQL adapters still reference L3 contracts/parsers. The HTTP adapter also
retains native parsing/transport and a private observation value helper. Public
interfaces do not certify those sources as layer compliant. Full classification,
source separation and later boundary enforcement remain unfinished.

## Acceptance Still Required

Foundation readiness item 31 covers exact frozen-source substitution, old exports,
DTO/readonly/broad-field compatibility, HTTP error/admission order, budgets,
transaction/replay/CAS, manager/member access, redaction, history/cursors/losses,
original plan/permit and notification ownership, and absence of new effects.
It must include type and runtime evidence when verification is authorized. None
has run for this extraction. Functional/MySQL/network/browser/container evidence
belongs in Actions; physical-host and operational/release gates remain separate.
The foundation/parallel gate stays closed.

## Public Owner Follow-Up (2026-10-19)

Audit and Forward diagnostic APIs/policies now have canonical definitions under
modules/audit-owner and modules/forward-diagnostic-owner. The old application API
and observation-policy paths directly alias those leaves; HTTP consumes public
owner roots. The actual original query/projection/read/admission classes move with
them. Public diagnostic wire type aliases come through L2; no DTO/schema changes.
See [owner chains](passive-diagnostic-audit-owners-v1.md), readiness68/69 unexecuted.
Other observability owners remain separate source work; no acceptance gate opens.
## Public Station/Notification Follow-Up (2026-10-19)

Station and Notification APIs/policies now have canonical public owner directories.
HTTP imports those public APIs; old application API and observation-policy entries
are direct leaf aliases. Actual services/rules/storage-value providers moved with
them, keeping original DTOs, redaction, per-instance admission and disabled flags.
No new GET effect or route. See [owner chains](station-notification-owners-v1.md)
and planned readiness70-72; other Probe/telemetry/HTTP source work remains open.
## Public Probe History/Plan Follow-Up (2026-10-19)

Run and finite-plan APIs now belong to their separate public owners, while old
probe-history-api.ts keeps its original version const and combined exact type
exports through canonical leaves. Probe's original command/acceptance declarations
also move into its public owner. HTTP consumes those public APIs; no worker/
recorder/issuer method is added to HTTP. Observation policy now consists of exact
owner-policy aliases. See [owner chains](probe-history-plan-owners-v1.md), planned
readiness73/74. Other telemetry/HTTP/Agent/source work and acceptance remain open.
## Public Telemetry API Follow-Up (2026-10-19)

The exact original shared telemetry API now belongs to telemetry-owner/public.ts,
with wire literals/readonly types supplied by public L2 aliases and original broad
response flags preserved. Old application API/class/query type paths are canonical
leaf aliases; HTTP/query/server consume public contracts. Original five services,
policies/values/providers and independent admission remain; L2 owns only original
ACK formatting, not count/authority decisions. See
[owner chains](telemetry-public-owners-v1.md), planned readiness75-77. Other HTTP/
application/A1/Agent/Runner/classification and acceptance remain open.
## Observation Declaration Public Chain (2026-10-19)

Original inert declaration service/API/contracts/storage values now belong to the
existing public Observation owner. Old application/flat paths are exact leaf
aliases; same server/Control/HTTP roots, lower SQL and legacy override/static paths
remain. See [owner chain](observation-service-owner-v1.md), readiness78 unexecuted.
This source move is not A1/A2/foundation/physical/release acceptance.